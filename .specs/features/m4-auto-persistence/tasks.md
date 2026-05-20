# M4 — Persistência Automática: Tasks

**Spec:** [`spec.md`](./spec.md)
**Status:** Done — todas as 9 tasks implementadas e commitadas

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — regras do projeto (idioma, stack fixada, formato de commits)
- `.specs/project/PROJECT.md` — visão, stack, escopo de v1, constraints
- `.specs/project/STATE.md` — decisões arquiteturais (AD-001 a AD-014)
- `.specs/features/m4-auto-persistence/spec.md` — requisitos com IDs `M4-NN`
- Este arquivo

**Princípios não-negociáveis:**

- TypeScript strict em todos os pacotes (`strict: true`, `noUncheckedIndexedAccess: true`)
- Sem `any` implícito; `any` explícito só com comentário justificando
- Commits atômicos: um por task, mensagem em **português** seguindo Conventional Commits — `feat(m4): T<N> <descrição>` (ou `chore(m4):` para scaffold/config, `test(m4):` para testes)
- Idioma: identificadores e código em **inglês**; commits, comentários e docs em **português**
- Não propor mudanças de stack — React + React Flow + TanStack Query + Tailwind v4 + shadcn/ui no frontend; Fastify + Prisma no backend

**Convenções herdadas (importante — não reinventar):**

- Estrutura: `packages/web`, `packages/api`, `packages/shared` (pnpm workspaces)
- Portas dev: api `3000`, web `5173`
- Web chama api via proxy do Vite (`/api/*` → `http://localhost:3000/*`)
- Path alias web: `@/...` aponta para `packages/web/src/...`
- Frontend TanStack Query: hooks em `packages/web/src/api/nodes.ts` — funções `fetch*` privadas + hooks `useX`/`useCreateX`/`useUpdateX`/`useDeleteX` exportados. Types em `./types.ts`. Mutations invalidam queries no `onSuccess`. Helper `request<T>` em `./_request.ts`.
- Componentes UI: shadcn/ui (migrado para Base UI) + Tailwind v4. Tokens semânticos. Já existe `Button`, `Dialog`, `Input`, `ConfirmDialog`.
- Testes API: Vitest com DB real (`packages/api/src/routes/nodes.test.ts`).
- Testes web: Vitest para lógica pura (`tree.test.ts`, `treeLayout.test.ts`); Playwright para interação UI (`e2e/smoke.spec.ts`).
- Canvas: React Flow com `useNodesState`/`useEdgesState`, sync via `useEffect`. Nó customizado `MindNode`. Layout via elkjs worker (`useLayoutedTree`).

**Estado pós-M3 (pré-M4):**

- Mutations de node (create, update, delete, move) já chamam API imediatamente e invalidam `['nodes', mapId]` no `onSuccess`.
- Erros são capturados via `onError` nos hooks e exibidos num banner singular (`canvasError` state string no `MapCanvas`).
- **Sem retry**, sem optimistic updates, sem toast queue.
- Restauração funciona: `useNodes(mapId)` faz fetch no mount e renderiza a árvore completa via `buildTree` → `visibleNodes` → `useLayoutedTree`.
- Campos de cor e tarefa (`bgColor`, `textColor`, `status`, `assignee`, `isCritical`) existem no schema/API mas são `null` (UI de edição vem em M5/M6).

**Postura de testes (AD-007 + AD-014):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Hook TanStack Query (lógica de mutation) | unit | quick (`pnpm test` no web) | Yes |
| Componente UI novo (Toast) | none (declarativo) | build (`pnpm typecheck`) | Yes |
| Integração canvas (optimistic + revert) | e2e (Playwright) | full (`pnpm test:e2e` no web) | No |
| API (sem mudanças em M4) | — | — | — |

---

## Execution Plan

```
Phase 1 (sequential — infra de retry + toast):
  T1 → T2

Phase 2 (parallel — optimistic por operação):
       ┌─→ T3 [P] (optimistic: rename)
  T2 ──┼─→ T4 [P] (optimistic: delete)
       └─→ T5 [P] (optimistic: create)

Phase 3 (sequential — optimistic move + saving indicator):
  T3,T4,T5 → T6 → T7

Phase 4 (sequential — integração canvas + remoção do banner legado):
  T7 → T8

Phase 5 (sequential — e2e):
  T8 → T9
```

---

## Task Breakdown

### T1: Componente Toast com queue

**What**: Criar sistema de toast (componente + contexto) que suporta múltiplos toasts empilhados, auto-dismiss em 5s, dismiss manual, e ícone de erro.
**Where**: `packages/web/src/components/ui/toast.tsx`, `packages/web/src/components/ui/toaster.tsx`
**Depends on**: None
**Reuses**: `packages/web/src/components/ui/button.tsx` (botão de dismiss); padrão shadcn/ui toast (adaptar para Base UI)
**Requirement**: M4-11, M4-12, M4-13, M4-14, M4-15

**Done when**:
- [ ] `ToastProvider` e `useToast()` hook exportados
- [ ] `useToast()` retorna `{ toast(opts) }` que adiciona toast ao state
- [ ] Componente `Toaster` renderiza stack de toasts no canto inferior-direito
- [ ] Cada toast tem: ícone de erro (X vermelho ou similar), mensagem, botão de fechar
- [ ] Auto-dismiss após 5000ms (configurável)
- [ ] Dismiss manual remove toast imediatamente
- [ ] Máximo de 5 toasts visíveis simultâneos (mais antigo sai se exceder)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo — AD-007)
**Gate**: build

**Commit**: `feat(m4): T1 componente Toast com queue`

---

### T2: Configuração de retry nos hooks de mutation + integração com toast

**What**: Configurar retry inteligente (3x backoff para rede/5xx, sem retry para 4xx) nos hooks de mutation de node. Substituir o callback `onError` genérico por chamada ao `useToast`. Remover a lógica de `canvasError` state do `MapCanvas` que será substituída pelo toast.
**Where**: `packages/web/src/api/nodes.ts`, `packages/web/src/api/_request.ts`, `packages/web/src/pages/map/components/MapCanvas.tsx`
**Depends on**: T1
**Reuses**: `packages/web/src/api/nodes.ts` (hooks existentes), `packages/web/src/api/_request.ts`
**Requirement**: M4-01, M4-02, M4-03, M4-04

**Done when**:
- [ ] `_request.ts` lança erro com propriedade `status` acessível (ou classe `ApiError` com `status: number`)
- [ ] Cada `useMutation` em `nodes.ts` configura `retry: (failureCount, error) => ...` — retenta até 3x se `status === 0 || status >= 500`; não retenta em 4xx
- [ ] `retryDelay` usa backoff exponencial: `(attempt) => Math.min(1000 * 2 ** attempt, 4000)`
- [ ] `onError` dos hooks chama `toast({ variant: 'error', description })` em vez de setar `canvasError`
- [ ] Banner de `canvasError` removido de `MapCanvas.tsx` (substituído pelo Toaster global)
- [ ] Testes unitários: 2 testes — retry em 5xx, não-retry em 4xx (mock de fetch)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: testes existentes + 2 novos passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m4): T2 retry com backoff + toast de erro`

---

### T3: Optimistic update — rename [P]

**What**: Implementar optimistic update no `useUpdateNode`: ao confirmar rename, o cache do TanStack Query é atualizado imediatamente com o novo título; em caso de erro, reverte ao snapshot anterior.
**Where**: `packages/web/src/api/nodes.ts` (hook `useUpdateNode`)
**Depends on**: T2
**Reuses**: Pattern `onMutate`/`onError`/`onSettled` do TanStack Query
**Requirement**: M4-06, M4-09, M4-10

**Done when**:
- [ ] `useUpdateNode` implementa `onMutate`: cancela queries pendentes, snapshot do cache `['nodes', mapId]`, atualiza o cache otimisticamente (muda `title` do nó)
- [ ] `onError`: reverte cache para snapshot + chama toast
- [ ] `onSettled`: invalida `['nodes', mapId]` para sincronizar com servidor
- [ ] `mutationFn` recebe `mapId` para invalidação correta (ajustar tipo de variables se necessário)
- [ ] Teste unitário: verifica que cache é atualizado antes do response e revertido em erro
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: testes existentes + 1 novo passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m4): T3 optimistic update no rename`

---

### T4: Optimistic update — delete [P]

**What**: Implementar optimistic update no `useDeleteNode`: ao confirmar delete, o nó e toda sua subárvore são removidos do cache imediatamente; em caso de erro, reverte ao snapshot.
**Where**: `packages/web/src/api/nodes.ts` (hook `useDeleteNode`)
**Depends on**: T2
**Reuses**: Pattern `onMutate`/`onError`/`onSettled`; `buildTree` + descendant logic de `packages/web/src/lib/tree.ts`
**Requirement**: M4-07, M4-09, M4-10

**Done when**:
- [ ] `useDeleteNode` implementa `onMutate`: snapshot do cache, remove nó + todos os descendentes (filtra por `parentId` recursivo) do array de nodes no cache
- [ ] `onError`: reverte cache + toast
- [ ] `onSettled`: invalida queries
- [ ] Teste unitário: verifica que nó e descendentes somem do cache e que rollback restaura tudo
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: testes existentes + 1 novo passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m4): T4 optimistic update no delete`

---

### T5: Optimistic update — create [P]

**What**: Implementar optimistic update no `useCreateNode`: ao adicionar filho, um nó temporário (com ID `temp-*`) aparece no cache imediatamente; quando a API responde, o nó temporário é substituído pelo real.
**Where**: `packages/web/src/api/nodes.ts` (hook `useCreateNode`)
**Depends on**: T2
**Reuses**: Pattern `onMutate`/`onError`/`onSettled`
**Requirement**: M4-05, M4-09, M4-10

**Done when**:
- [ ] `useCreateNode` implementa `onMutate`: gera `NodeDto` temporário com `id: 'temp-' + crypto.randomUUID()`, `sortOrder = max+1`, demais campos do body; insere no cache `['nodes', mapId]`
- [ ] `onSuccess`: substitui o nó temporário pelo nó real retornado pela API (match por `parentId` + `title` ou substituição direta via `setQueryData`)
- [ ] `onError`: reverte cache (remove o temporário) + toast
- [ ] `onSettled`: invalida queries
- [ ] O `MapCanvas` abre `editingId` com o ID temporário; ao receber o real, o `editingId` deve migrar (ou o refetch pós-settled cuida disso naturalmente)
- [ ] Teste unitário: verifica inserção no cache com id `temp-*` e remoção em erro
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: testes existentes + 1 novo passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m4): T5 optimistic update no create`

---

### T6: Optimistic update — move

**What**: Implementar optimistic update no `useMoveNode`: ao soltar o nó em novo pai, o cache é atualizado imediatamente (muda `parentId` e recalcula `sortOrder`); em caso de erro, reverte.
**Where**: `packages/web/src/api/nodes.ts` (hook `useMoveNode`)
**Depends on**: T3, T4, T5 (para padrão consolidado)
**Reuses**: Pattern `onMutate`/`onError`/`onSettled`
**Requirement**: M4-08, M4-09, M4-10

**Done when**:
- [ ] `useMoveNode` implementa `onMutate`: snapshot, atualiza `parentId` do nó no cache, recalcula `sortOrder` (append no final dos irmãos do novo pai)
- [ ] `onError`: reverte cache + toast; também invalida para forçar re-fetch (garante posição correta no canvas)
- [ ] `onSettled`: invalida queries
- [ ] No `MapCanvas.handleNodeDragStop`, remove a invalidação manual no `onError` do move (agora tratada pelo optimistic revert)
- [ ] Teste unitário: verifica que `parentId` muda no cache e que rollback restaura
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: testes existentes + 1 novo passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m4): T6 optimistic update no move`

---

### T7: Indicador de salvamento ("Salvando…")

**What**: Mostrar indicador discreto no canvas enquanto qualquer mutation de node está pendente. Usar `useIsMutating` do TanStack Query.
**Where**: `packages/web/src/pages/map/components/MapCanvas.tsx`
**Depends on**: T6 (todas as mutations finalizadas)
**Reuses**: `useIsMutating` do `@tanstack/react-query`
**Requirement**: M4-16, M4-17, M4-18

**Done when**:
- [ ] `MapCanvas` (ou componente filho `SavingIndicator`) usa `useIsMutating()` para detectar mutations pendentes
- [ ] Quando `isMutating > 0`, exibe "Salvando…" (ou spinner) no canto superior-direito do canvas, com `z-10`, posição `absolute`, fundo semi-transparente
- [ ] Quando `isMutating === 0`, o indicador desaparece (com transição CSS suave, ~200ms)
- [ ] O indicador NÃO bloqueia interação (nenhum overlay, nenhum pointer-events-none no canvas)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo)
**Gate**: build

**Commit**: `feat(m4): T7 indicador de salvamento`

---

### T8: Integração do Toaster no app + limpeza do banner legado

**What**: Montar o `Toaster` no layout global (ou no `MapPage`), garantir que `ToastProvider` envolve a árvore, e remover qualquer resíduo do sistema de banner `canvasError` que T2 não tenha eliminado completamente.
**Where**: `packages/web/src/App.tsx` (ou layout raiz), `packages/web/src/pages/map/components/MapCanvas.tsx`
**Depends on**: T7
**Reuses**: `Toaster` de T1, `ToastProvider` de T1
**Requirement**: M4-11, M4-15

**Done when**:
- [ ] `ToastProvider` envolve o `App` (ou está no nível de `MapPage`)
- [ ] `Toaster` renderiza fora do fluxo do canvas (posição fixa no viewport)
- [ ] Nenhuma referência a `canvasError` ou banner antigo resta no código
- [ ] Toasts funcionam de qualquer ponto da app (não só canvas)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(m4): T8 Toaster global + remoção do banner legado`

---

### T9: Testes e2e — persistência e restauração

**What**: Escrever specs Playwright que verificam: (1) operação persiste e sobrevive a reload; (2) retry funciona (com interceptação de rede); (3) optimistic revert aparece ao forçar erro.
**Where**: `packages/web/e2e/persistence.spec.ts`
**Depends on**: T8 (tudo integrado)
**Reuses**: `packages/web/e2e/smoke.spec.ts` (padrão de seletores e setup)
**Requirement**: M4-19, M4-20, M4-21, M4-22, M4-23, M4-24, M4-01, M4-10

**Done when**:
- [ ] Test: criar nó filho, recarregar página (F5), verificar que o nó persiste na árvore (M4-19, M4-20)
- [ ] Test: renomear nó, recarregar, verificar título persistido
- [ ] Test: mover nó para outro pai, recarregar, verificar hierarquia
- [ ] Test: interceptar API com `page.route()` para forçar 500, verificar que toast de erro aparece e estado reverte (M4-10)
- [ ] Test: interceptar API com falha transiente (1 falha + 1 sucesso), verificar que retry resolve sem toast (M4-01, M4-02)
- [ ] Todos expandidos ao reabrir (M4-23)
- [ ] Gate check passa: `cd packages/web && pnpm test:e2e`
- [ ] Test count: 5+ specs e2e passam

**Tests**: e2e
**Gate**: full

**Commit**: `test(m4): T9 specs e2e de persistência e restauração`

---

## Parallel Execution Map

```
Phase 1 (Sequential — infra):
  T1 ──→ T2

Phase 2 (Parallel — optimistic por operação):
  T2 complete, then:
    ├── T3 [P] (rename)
    ├── T4 [P] (delete)    } Can run simultaneously
    └── T5 [P] (create)

Phase 3 (Sequential — move + UI):
  T3, T4, T5 complete, then:
    T6 ──→ T7 ──→ T8

Phase 4 (Sequential — e2e):
  T8 complete, then:
    T9
```

**Parallelism constraint:** T3/T4/T5 modificam o mesmo arquivo (`nodes.ts`) mas seções independentes (hooks diferentes). O executor pode rodar em paralelo se usar merge no final, ou sequenciar se preferir evitar conflitos de merge. Marcados `[P]` porque a lógica é independente.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Toast component + context | 2 arquivos coesos (componente + provider) | ✅ Granular |
| T2: Retry config + toast integration | 3 arquivos (request, hooks, canvas cleanup) | ⚠️ OK — coeso: retry+error é uma unidade |
| T3: Optimistic rename | 1 hook | ✅ Granular |
| T4: Optimistic delete | 1 hook | ✅ Granular |
| T5: Optimistic create | 1 hook | ✅ Granular |
| T6: Optimistic move | 1 hook + 1 cleanup em MapCanvas | ✅ Granular |
| T7: Saving indicator | 1 componente inline | ✅ Granular |
| T8: Toaster mount + limpeza | 1-2 arquivos (layout + cleanup residual) | ✅ Granular |
| T9: Specs e2e | 1 arquivo de teste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta entrando | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T2 | T2 → T5 | ✅ Match |
| T6 | T3, T4, T5 | T3,T4,T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Componente UI (Toast) | none (declarativo) | none | ✅ OK |
| T2 | Hook TanStack Query (retry logic) | unit | unit | ✅ OK |
| T3 | Hook TanStack Query (optimistic) | unit | unit | ✅ OK |
| T4 | Hook TanStack Query (optimistic) | unit | unit | ✅ OK |
| T5 | Hook TanStack Query (optimistic) | unit | unit | ✅ OK |
| T6 | Hook TanStack Query (optimistic) | unit | unit | ✅ OK |
| T7 | Componente UI (indicator) | none (declarativo) | none | ✅ OK |
| T8 | Layout/wiring | none | none | ✅ OK |
| T9 | Integração canvas (e2e) | e2e | e2e | ✅ OK |
