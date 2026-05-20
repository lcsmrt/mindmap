# M5 — Dialog de Edição e Cores: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Implemented

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — regras do projeto (idioma, stack fixada, formato de commits)
- `.specs/project/PROJECT.md` — visão, stack, escopo de v1, constraints
- `.specs/project/STATE.md` — decisões arquiteturais (AD-001 a AD-014)
- `.specs/features/m5-edit-dialog-colors/spec.md` — requisitos com IDs `M5-NN`
- `.specs/features/m5-edit-dialog-colors/design.md` — design detalhado com componentes, data models e decisões
- Este arquivo

**Princípios não-negociáveis:**

- TypeScript strict em todos os pacotes (`strict: true`, `noUncheckedIndexedAccess: true`)
- Sem `any` implícito; `any` explícito só com comentário justificando
- Commits atômicos: um por task, mensagem em **português** seguindo Conventional Commits — `feat(m5): T<N> <descrição>` (ou `chore(m5):` para scaffold/config, `test(m5):` para testes)
- Idioma: identificadores e código em **inglês**; commits, comentários e docs em **português**
- Não propor mudanças de stack — React + React Flow + TanStack Query + Tailwind v4 + shadcn/ui no frontend; Fastify + Prisma no backend

**Convenções herdadas (importante — não reinventar):**

- Estrutura: `packages/web`, `packages/api`, `packages/shared` (pnpm workspaces)
- Portas dev: api `3000`, web `5173`
- Web chama api via proxy do Vite (`/api/*` → `http://localhost:3000/*`)
- Path alias web: `@/...` aponta para `packages/web/src/...`
- Frontend TanStack Query: hooks em `packages/web/src/api/nodes.ts` — funções `fetch*` privadas + hooks `useX`/`useCreateX`/`useUpdateX`/`useDeleteX` exportados. Types em `./types.ts`. Mutations invalidam queries no `onSuccess`. Helper `request<T>` em `./_request.ts`.
- Componentes UI: shadcn/ui + Tailwind v4. Tokens semânticos. Já existe `Button`, `Dialog`, `Input`, `ConfirmDialog`.
- Testes API: Vitest com DB real (`packages/api/src/routes/nodes.test.ts`).
- Testes web: Vitest para lógica pura; Playwright para interação UI (`e2e/`).
- Canvas: React Flow com `useNodesState`/`useEdgesState`, sync via `useEffect`. Nó customizado `MindNode`. Layout via elkjs worker (`useLayoutedTree`).
- Optimistic updates: padrão M4 — `onMutate` snapshot + cache update, `onError` rollback + toast, `onSettled` invalidate.

**Estado pós-M4 (pré-M5):**

- Mutations de node (create, update, delete, move) todas com optimistic update, retry inteligente e toast de erro.
- `useUpdateNode` atualmente recebe `{ title: string }` no body — update parcial não existe ainda.
- Campos `bgColor` e `textColor` existem no Prisma schema como `String?`, no `toNodeDto` mapper e no `NodeDto` — mas são sempre `null` (nunca editados).
- `PATCH /nodes/:id` aceita apenas `{ title: string }` (Zod schema rígido).
- `UpdateNodeBody` em `packages/shared/src/node.ts` é `{ title: string }`.
- `MindNode` tem barra de ações: collapse toggle, add child (+), delete (X). Sem botão de edição de propriedades.
- Toast global funciona (M4-T8). Indicador "Salvando…" funciona (M4-T7).

**Postura de testes (AD-007 + AD-014):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| API (Zod schema + handler parcial) | unit (Vitest DB real) | `pnpm test` no api | Yes |
| Componente UI novo (dialog, swatches) | none (declarativo) | build (`pnpm typecheck`) | Yes |
| Integração canvas (cor + dialog) | e2e (Playwright) | `pnpm test:e2e` no web | No |

**Skills aplicáveis (referência para o executor):**

- `api-backend` — extensão do PATCH /nodes/:id
- `react-flow` — renderização de cores nos nós, integração dialog ↔ canvas
- `web-component-creation` — NodeEditDialog, ColorSwatchGrid
- `web-api-integration` — mutation estendida, optimistic update parcial

---

## Execution Plan

```
Phase 1 (sequential — backend + shared types):
  T1 → T2

Phase 2 (parallel — componentes UI independentes):
       ┌─→ T3 [P] (ColorSwatchGrid)
  T2 ──┤
       └─→ T4 [P] (NodeEditDialog)

Phase 3 (sequential — integração canvas):
  T3,T4 → T5 → T6

Phase 4 (sequential — e2e):
  T6 → T7
```

---

## Task Breakdown

### T1: Expandir PATCH /nodes/:id para update parcial (bgColor, textColor)

**What**: Alterar o Zod schema e handler do `PATCH /nodes/:id` para aceitar `{ title?, bgColor?, textColor? }` com pelo menos um campo presente. Cores validadas como hex 6 dígitos (`/^#[0-9a-fA-F]{6}$/`), aceita `null` para reset. Handler faz update parcial no Prisma (só campos presentes).
**Where**: `packages/api/src/routes/nodes.ts` (schema Zod + handler), `packages/api/src/routes/nodes.test.ts` (testes)
**Depends on**: None
**Reuses**: Handler existente de PATCH (linhas ~43-58), `toNodeDto` mapper (já mapeia bgColor/textColor)
**Requirement**: M5-16, M5-17

**Done when**:
- [ ] Zod schema aceita `title` optional (`z.string().trim().min(1).optional()`)
- [ ] Zod schema aceita `bgColor` como `z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()`
- [ ] Zod schema aceita `textColor` com mesma validação
- [ ] `.refine()` garante pelo menos um campo presente
- [ ] Handler constrói objeto `data` condicionalmente — só campos com `!== undefined`
- [ ] Teste: PATCH com apenas `{ bgColor: "#fecaca" }` retorna 200 com bgColor atualizado, título inalterado
- [ ] Teste: PATCH com `{ bgColor: null }` retorna 200 com bgColor null (reset)
- [ ] Teste: PATCH com `{ textColor: "#dc2626" }` retorna 200 com textColor atualizado
- [ ] Teste: PATCH com body vazio `{}` retorna 400
- [ ] Teste: PATCH com `{ bgColor: "invalid" }` retorna 400
- [ ] Testes existentes de rename continuam passando
- [ ] Gate check passa: `cd packages/api && pnpm typecheck && pnpm test`

**Tests**: unit (Vitest DB real)
**Gate**: quick

**Commit**: `feat(m5): T1 PATCH parcial com bgColor e textColor`

---

### T2: Expandir UpdateNodeBody (shared) + optimistic update genérico

**What**: Tornar `UpdateNodeBody` parcial no `packages/shared` (todos os campos opcionais, pelo menos um presente). Ajustar `useUpdateNode` para fazer spread genérico no `onMutate` (em vez de spread fixo de `title`), permitindo optimistic update de qualquer campo.
**Where**: `packages/shared/src/node.ts`, `packages/web/src/api/nodes.ts` (hook `useUpdateNode`)
**Depends on**: T1
**Reuses**: Pattern de optimistic update existente no `useUpdateNode` (M4-T3)
**Requirement**: M5-14, M5-15

**Done when**:
- [ ] `UpdateNodeBody` tem `title?: string`, `bgColor?: string | null`, `textColor?: string | null` — todos opcionais
- [ ] `useUpdateNode.onMutate` faz `{ ...n, ...body }` em vez de spread fixo de `{ title }` — campos `undefined` não sobrescrevem, `null` limpa
- [ ] Mutation existente de rename continua funcionando (title-only body)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test` e `cd packages/shared && pnpm typecheck`

**Tests**: nenhum novo (testes existentes de rename cobrem regressão)
**Gate**: build

**Commit**: `feat(m5): T2 UpdateNodeBody parcial + optimistic genérico`

---

### T3: Componente ColorSwatchGrid [P]

**What**: Criar componente `ColorSwatchGrid` — grid de swatches coloridos com opção "Padrão" (null) e indicador visual de seleção. Criar arquivo `color-palette.ts` com `BG_PALETTE` e `TEXT_PALETTE`.
**Where**: `packages/web/src/pages/map/components/ColorSwatchGrid.tsx`, `packages/web/src/pages/map/components/color-palette.ts`
**Depends on**: T2
**Reuses**: `Button` de `components/ui/button.tsx` (ou `<button>` nativo com Tailwind)
**Requirement**: M5-06, M5-09, M5-10, M5-20, M5-21

**Done when**:
- [ ] `color-palette.ts` exporta `BG_PALETTE` (10 swatches) e `TEXT_PALETTE` (8 swatches) conforme design
- [ ] Interface `ColorSwatch` com `hex: string` e `name: string`
- [ ] `ColorSwatchGrid` aceita props: `label`, `colors`, `value`, `onSelect`
- [ ] Primeiro item do grid é botão "Padrão" (ícone Ban do lucide) que chama `onSelect(null)`
- [ ] Cada swatch é `<button>` circular (`w-7 h-7`) com `backgroundColor` do hex
- [ ] Swatch selecionado tem `ring-2 ring-primary ring-offset-2`
- [ ] Cada swatch tem `aria-label` com nome da cor
- [ ] Swatches focáveis via Tab, ativáveis via Enter/Space (M5-20, M5-21)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo)
**Gate**: build

**Commit**: `feat(m5): T3 ColorSwatchGrid + paleta de cores`

---

### T4: Componente NodeEditDialog [P]

**What**: Criar o dialog modal de edição de nó com título editável e seções de cor (bg + text). Usa `Dialog` do shadcn/ui. Cada ação (swatch click, título blur/Enter) é atômica — sem botão "Salvar".
**Where**: `packages/web/src/pages/map/components/NodeEditDialog.tsx`
**Depends on**: T2
**Reuses**: `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` de `components/ui/dialog.tsx`, `Input` de `components/ui/input.tsx`, `ColorSwatchGrid` de T3
**Requirement**: M5-01, M5-02, M5-03, M5-04, M5-05, M5-19, M5-22

**Nota**: T4 e T3 são paralelos — se T4 for executado antes de T3, usar placeholder para `ColorSwatchGrid` e integrar depois. Se T3 já estiver pronto, importar diretamente.

**Done when**:
- [ ] `NodeEditDialog` aceita props: `node: NodeDto | null`, `onUpdateNode: (fields: UpdateNodeBody) => void`, `onClose: () => void`
- [ ] `open` derivado de `node !== null`
- [ ] Título renderizado em `Input` controlado; submit em Enter ou blur chama `onUpdateNode({ title })`. Título vazio rejeitado (mantém anterior)
- [ ] Duas seções com label: "Cor de fundo" com `ColorSwatchGrid` usando `BG_PALETTE`, "Cor de texto" com `TEXT_PALETTE`
- [ ] Swatch click chama `onUpdateNode({ bgColor: "#hex" })` ou `onUpdateNode({ textColor: "#hex" })` imediatamente
- [ ] Dialog fecha via X, Escape ou click no overlay — chama `onClose()`
- [ ] Overlay escurece o fundo (padrão do `DialogContent` do shadcn)
- [ ] Foco inicial no campo de título ao abrir (M5-19)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo)
**Gate**: build

**Commit**: `feat(m5): T4 NodeEditDialog com título e cores`

---

### T5: Renderização de cores no MindNode + botão de edição

**What**: Aplicar `bgColor` e `textColor` via inline style no `MindNode`. Adicionar botão Palette na barra de ações que dispara `onOpenEditDialog`. Quando cores são `null`, estilo padrão do tema prevalece.
**Where**: `packages/web/src/pages/map/components/MindNode.tsx`, `packages/web/src/pages/map/components/types.ts`
**Depends on**: T3, T4
**Reuses**: Ícone `Palette` do `lucide-react`, `Button` existente
**Requirement**: M5-01, M5-11, M5-12, M5-13

**Done when**:
- [ ] `MindNodeData` em `types.ts` tem `onOpenEditDialog: () => void`
- [ ] Wrapper `<div>` do `MindNode` recebe `style={{ backgroundColor: node.bgColor ?? undefined, color: node.textColor ?? undefined }}`
- [ ] Quando `bgColor` é `null`, nenhum inline style de background — classes Tailwind padrão prevalecem
- [ ] Quando `textColor` é `null`, nenhum inline style de color — herda do tema
- [ ] Botão Palette (`lucide-react`) na barra de ações, entre add (+) e delete (X)
- [ ] Click no Palette chama `data.onOpenEditDialog()`
- [ ] Nós com cor personalizada renderizam corretamente no canvas
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo)
**Gate**: build

**Commit**: `feat(m5): T5 cores inline no MindNode + botão de edição`

---

### T6: Integração dialog ↔ canvas no MapCanvas

**What**: Orquestrar o `NodeEditDialog` no `MapCanvas`: estado `editDialogNodeId`, derivar nó para o dialog, handler de update parcial que reutiliza `updateNode`, passar `onOpenEditDialog` para cada `MindNode`.
**Where**: `packages/web/src/pages/map/components/MapCanvas.tsx`
**Depends on**: T5
**Reuses**: `useUpdateNode` (mutation existente com optimistic genérico de T2), `NodeEditDialog` de T4
**Requirement**: M5-01, M5-07, M5-08, M5-14, M5-15

**Done when**:
- [ ] Estado: `const [editDialogNodeId, setEditDialogNodeId] = useState<string | null>(null)`
- [ ] Nó derivado: `editDialogNode` busca no `data?.nodes` pelo ID
- [ ] `handleDialogUpdate` chama `updateNode({ id: editDialogNodeId, mapId, body: fields })` — funciona para title, bgColor e textColor
- [ ] `onOpenEditDialog` passado no `MindNodeData` de cada nó, seta `editDialogNodeId`
- [ ] `<NodeEditDialog>` renderizado ao lado do `<ConfirmDialog>` existente
- [ ] Dialog abre com dados corretos do nó, swatches refletem cor atual
- [ ] Selecionar swatch muda cor do nó no canvas imediatamente (optimistic via T2)
- [ ] Editar título no dialog atualiza nó no canvas
- [ ] Fechar dialog não causa efeitos colaterais
- [ ] Erro na API: cor reverte + toast (rollback do optimistic — já funciona via M4)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm lint`

**Tests**: none (integração testada via e2e em T7)
**Gate**: build

**Commit**: `feat(m5): T6 integração dialog ↔ canvas`

---

### T7: Testes e2e — dialog e cores

**What**: Escrever specs Playwright que verificam: dialog abre/fecha, título edita, swatch aplica cor, cor persiste após reload, reset para padrão funciona, rollback em erro.
**Where**: `packages/web/e2e/edit-dialog.spec.ts`
**Depends on**: T6 (tudo integrado)
**Reuses**: `packages/web/e2e/smoke.spec.ts` e `persistence.spec.ts` (padrão de seletores e setup)
**Requirement**: M5-01 a M5-18

**Done when**:
- [ ] Test: clicar no botão Palette de um nó abre o dialog com título correto
- [ ] Test: editar título no dialog, fechar, ver título atualizado no canvas
- [ ] Test: selecionar swatch de cor de fundo, ver nó mudar de cor no canvas (verificar inline style)
- [ ] Test: selecionar swatch de cor de texto, ver texto mudar de cor
- [ ] Test: recarregar página (F5), verificar que cores persistem
- [ ] Test: clicar "Padrão" para bg, verificar que cor reseta (inline style removido)
- [ ] Test: fechar dialog via Escape, verificar que fecha sem efeito colateral
- [ ] Test: interceptar API com erro 500, selecionar swatch, verificar rollback + toast
- [ ] Gate check passa: `cd packages/web && pnpm test:e2e`

**Tests**: e2e
**Gate**: full

**Commit**: `test(m5): T7 specs e2e do dialog e cores`

---

## Parallel Execution Map

```
Phase 1 (Sequential — backend + shared):
  T1 ──→ T2

Phase 2 (Parallel — componentes UI):
  T2 complete, then:
    ├── T3 [P] (ColorSwatchGrid + paleta)
    └── T4 [P] (NodeEditDialog)

Phase 3 (Sequential — integração canvas):
  T3, T4 complete, then:
    T5 ──→ T6

Phase 4 (Sequential — e2e):
  T6 complete, then:
    T7
```

**Parallelism constraint:** T3 e T4 são arquivos diferentes sem dependência de compilação entre si. T4 importa `ColorSwatchGrid` de T3 — se executados em paralelo, T4 pode usar import com placeholder e integrar depois, ou T3 pode ser executado primeiro. Marcados `[P]` porque a lógica é independente.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: PATCH parcial (backend) | 2 arquivos (route + testes) | ✅ Granular |
| T2: UpdateNodeBody + optimistic genérico | 2 arquivos (shared type + hook) | ✅ Granular |
| T3: ColorSwatchGrid + paleta | 2 arquivos novos coesos | ✅ Granular |
| T4: NodeEditDialog | 1 arquivo novo | ✅ Granular |
| T5: MindNode cores + botão | 2 arquivos (componente + types) | ✅ Granular |
| T6: Integração MapCanvas | 1 arquivo (orquestração) | ✅ Granular |
| T7: Specs e2e | 1 arquivo de teste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta entrando | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T3, T4 | T3,T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | API (Zod + handler) | unit (Vitest DB real) | unit | ✅ OK |
| T2 | Shared type + hook | none (regressão via existentes) | none | ✅ OK |
| T3 | Componente UI (swatches) | none (declarativo) | none | ✅ OK |
| T4 | Componente UI (dialog) | none (declarativo) | none | ✅ OK |
| T5 | Componente UI (MindNode) | none (declarativo) | none | ✅ OK |
| T6 | Integração canvas | none (e2e em T7) | none | ✅ OK |
| T7 | Integração e2e | e2e (Playwright) | e2e | ✅ OK |
