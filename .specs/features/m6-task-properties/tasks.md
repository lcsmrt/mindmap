# M6 — Propriedades de Tarefa: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Executado (T1–T9 ✅) — pronto para Review AD-013

> **Execução (2026-06-23):** 9 tasks, 9 commits atômicos (`0dcb547`→`1d9154c`).
> Gates finais: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (api 42, web 36) · `pnpm test:e2e` ✅ (22 specs, 6 novos M6).

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — regras do projeto (idioma, stack fixada, formato de commits)
- `.specs/project/PROJECT.md` — visão, stack, escopo de v1, constraints
- `.specs/project/STATE.md` — decisões arquiteturais (AD-001 a AD-014) e CONCERNS relevantes
- `.specs/features/m6-task-properties/spec.md` — requisitos com IDs `M6-NN`
- `.specs/features/m6-task-properties/design.md` — design detalhado com componentes e decisões
- Este arquivo

**Princípios não-negociáveis:**

- TypeScript strict em todos os pacotes (`strict: true`, `noUncheckedIndexedAccess: true`)
- Sem `any` implícito; `any` explícito só com comentário justificando
- Commits atômicos: um por task, mensagem em **português** seguindo Conventional Commits — `feat(m6): T<N> <descrição>` (ou `chore(m6):` para scaffold/config, `test(m6):` para testes)
- Idioma: identificadores e código em **inglês**; commits, comentários e docs em **português**
- Não propor mudanças de stack — React + React Flow + TanStack Query + Tailwind v4 + shadcn/ui no frontend; Fastify + Prisma no backend

**Convenções herdadas (importante — não reinventar):**

- Estrutura: `packages/web`, `packages/api`, `packages/shared` (pnpm workspaces). Portas dev: api `3000`, web `5173`. Proxy Vite `/api/*`. Path alias web `@/...`.
- Frontend TanStack Query: hooks em `packages/web/src/api/nodes.ts`. `useUpdateNode` já faz optimistic genérico (`onMutate` = `{ ...n, ...body }`) — **não precisa mudar** para M6.
- Componentes UI: shadcn/ui (Base UI) + Tailwind v4, tokens semânticos. Existem `Button`, `Dialog`, `Input`, `ConfirmDialog`, `Toast`. **Não existe** `Switch`/`Checkbox` — usar `<button aria-pressed>` para o toggle (decisão do design).
- Colocação (regra `.claude/rules/frontend-structure.md`): componentes de página em `pages/<pagina>/components/`; só vai pra `components/` o compartilhado entre 2+ páginas; reusar primitivos de `ui/` antes de criar.
- Testes API: Vitest com DB real (`packages/api/src/routes/nodes.test.ts`).
- Testes web: Vitest para lógica pura; Playwright para interação UI (`e2e/`).
- Canvas: React Flow + `MindNode`. Layout via elkjs worker (`lib/layout.worker.ts`) com fallback síncrono (`lib/treeLayout.ts`); `lib/useLayoutedTree.ts` orquestra. **Fragile area** (CONCERNS): manter worker e fallback consistentes; não tocar no sync `rfNodes`↔`useNodesState`.

**Estado pós-M5 (pré-M6):**

- `PATCH /nodes/:id` aceita `{ title?, bgColor?, textColor? }` (parcial, refine "≥1 campo"). **Não** aceita `status/assignee/isCritical` ainda (`packages/api/src/routes/nodes.ts:43-71`).
- `UpdateNodeBody` (`packages/shared/src/node.ts:26`) = `{ title?, bgColor?, textColor? }`.
- Prisma `Node` **já tem** `status` (enum `NodeStatus`: PENDING/IN_PROGRESS/DONE/BLOCKED), `assignee String?`, `isCritical Boolean @default(false)` — desde M1 (AD-003). `NodeDto` e `toNodeDto` já os expõem. **Nenhuma migration em M6.**
- `NodeEditDialog`/`NodeEditForm` (`pages/map/components/NodeEditDialog.tsx`) edita título + 2 `ColorSwatchGrid`. Foi desenhado para receber task props sem refactor.
- `MapCanvas` já orquestra o dialog: `handleDialogUpdate` repassa `body: fields` direto pro `updateNode` (genérico) — **nenhuma mudança no MapCanvas em M6**.
- `MindNode` é uma linha única (`flex items-center`) com collapse/título/ações. Sem rodapé de tarefa.
- Layout: `layout.worker.ts` e `treeLayout.ts` usam constantes locais `NODE_WIDTH=180`/`NODE_HEIGHT=40` (e `NODE_W`/`NODE_H`). O worker já lê `child.height ?? NODE_HEIGHT` — aceita altura por nó.

**Postura de testes (AD-007 + AD-014):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| API (Zod schema + handler parcial) | unit (Vitest DB real) | `pnpm test` no api | Yes |
| Função pura não-trivial (`getInitials`) | unit (Vitest) | `pnpm test` no web | Yes |
| Helper de layout trivial / integração worker | none (worker untested — AD-009) | build (`pnpm typecheck`) | Yes |
| Componente UI novo/declarativo | none | build (`pnpm typecheck`) | Yes |
| Integração canvas (dialog + indicadores) | e2e (Playwright) | `pnpm test:e2e` no web | No |

**Skills aplicáveis (referência para o executor):**

- `api-backend` — extensão do `PATCH /nodes/:id` (T1)
- `web-component-creation` — StatusSelector, controles do form, NodeTaskIndicators (T5, T6, T7)
- `react-flow` — reestruturação do MindNode + integração de altura no layout (T4, T8)
- `web-api-integration` — confirmar fluxo da mutation (sem nova lógica)

---

## Execution Plan

```
Phase 1 (foundations — backend/shared em sequência; helper em paralelo):
  T1 → T2            (api → shared)
  T3                 (task-meta — independente)

Phase 2 (após T3 — peças de UI/layout, paralelas):
  ├─ T4 [P] (nodeSize + integração layout)
  ├─ T5 [P] (StatusSelector)
  └─ T6 [P] (NodeTaskIndicators)

Phase 3 (integração UI — arquivos distintos, paralelas):
  T2,T3,T5 → T7 [P] (NodeEditForm estendido)
  T4,T6    → T8 [P] (MindNode reestruturado)

Phase 4 (e2e):
  T1,T2,T7,T8 → T9
```

---

## Task Breakdown

### T1: Estender PATCH /nodes/:id para status, assignee, isCritical

**What**: Adicionar ao Zod body e ao handler do `PATCH /nodes/:id` os campos `status` (enum nullable), `assignee` (string trimmed nullable) e `isCritical` (boolean). Manter o refine "≥1 campo presente". `status` fora do enum ⇒ 400 automático. Handler adiciona ao `data` só os campos presentes.
**Where**: `packages/api/src/routes/nodes.ts` (schema + handler), `packages/api/src/routes/nodes.test.ts` (testes)
**Depends on**: None
**Reuses**: Estrutura de update parcial existente (M5), `toNodeDto` (já mapeia os 3 campos — sem mudança)
**Requirement**: M6-08, M6-09, M6-10, M6-11, M6-12

**Tools**:
- Skill: `api-backend`

**Done when**:
- [ ] Zod body aceita `status: z.enum(['PENDING','IN_PROGRESS','DONE','BLOCKED']).nullable().optional()`
- [ ] Zod body aceita `assignee: z.string().trim().min(1).nullable().optional()`
- [ ] Zod body aceita `isCritical: z.boolean().optional()`
- [ ] Refine "≥1 campo" atualizado (cobre os campos novos — ex.: `Object.values(d).some(v => v !== undefined)`)
- [ ] Handler adiciona ao `data` `status`/`assignee`/`isCritical` quando `!== undefined`
- [ ] Teste: PATCH `{ status: 'IN_PROGRESS' }` ⇒ 200, status atualizado, demais campos inalterados
- [ ] Teste: PATCH `{ status: null }` ⇒ 200, status resetado para null
- [ ] Teste: PATCH `{ status: 'INVALIDO' }` ⇒ 400 (M6-11)
- [ ] Teste: PATCH `{ assignee: 'Lucas' }` ⇒ 200; PATCH `{ assignee: null }` ⇒ 200 reset
- [ ] Teste: PATCH `{ isCritical: true }` ⇒ 200; update parcial preserva title/cores (M6-12)
- [ ] Testes existentes (rename, cores) continuam passando
- [ ] Gate check passa: `cd packages/api && pnpm typecheck && pnpm test`
- [ ] Test count: suíte de `nodes.test.ts` cresce com os casos acima, todos verdes (sem deleção silenciosa)

**Tests**: unit (Vitest DB real)
**Gate**: quick

**Commit**: `feat(m6): T1 PATCH aceita status, assignee e isCritical`

---

### T2: Estender UpdateNodeBody (shared)

**What**: Adicionar `status?`, `assignee?`, `isCritical?` ao `UpdateNodeBody`. A mutation `useUpdateNode` **não muda** (optimistic já é genérico).
**Where**: `packages/shared/src/node.ts`
**Depends on**: T1
**Reuses**: `NodeDto['status']` union já definido no mesmo arquivo
**Requirement**: M6-20

**Tools**:
- Skill: NONE

**Done when**:
- [ ] `UpdateNodeBody` ganha `status?: 'PENDING'|'IN_PROGRESS'|'DONE'|'BLOCKED'|null`, `assignee?: string | null`, `isCritical?: boolean`
- [ ] `useUpdateNode` permanece inalterado (confirmar que `{ ...n, ...body }` cobre os novos campos)
- [ ] Gate check passa: `cd packages/shared && pnpm typecheck` e `cd packages/web && pnpm typecheck`

**Tests**: none (regressão coberta pelos e2e/typecheck; tipo sem lógica)
**Gate**: build

**Commit**: `feat(m6): T2 UpdateNodeBody com campos de tarefa`

---

### T3: task-meta.ts — constantes e helpers de tarefa

**What**: Criar `task-meta.ts` com `STATUS_OPTIONS` (value/label pt-BR/cor semântica), `statusMeta(value)`, `getInitials(assignee)` (determinístico) e `hasTaskProps(node)`. Arquivo **puro** (sem React/DOM) para poder ser importado pelo worker.
**Where**: `packages/web/src/pages/map/components/task-meta.ts`, `packages/web/src/pages/map/components/task-meta.test.ts`
**Depends on**: None
**Reuses**: tipo `NodeDto` de `@mindmap/shared`
**Requirement**: M6-01 (labels), M6-15 (iniciais), M6-17/18 (hasTaskProps)

**Tools**:
- Skill: NONE

**Done when**:
- [ ] `STATUS_OPTIONS` exporta os 4 status: Pendente/`PENDING`/cinza, Em andamento/`IN_PROGRESS`/azul, Concluído/`DONE`/verde, Bloqueado/`BLOCKED`/vermelho (hex concretos)
- [ ] `statusMeta(value)` retorna o `StatusMeta` correspondente
- [ ] `getInitials`: 2+ palavras ⇒ iniciais das 2 primeiras ("Lucas Martins"→"LM"); 1 palavra ⇒ 2 primeiras letras ("Lucas"→"LU"); sempre uppercase, máx 2 chars; usa `Array.from` (seguro p/ acento/emoji)
- [ ] `hasTaskProps(node)` ⇒ `true` se `status != null || (assignee && assignee.length) || isCritical`
- [ ] Arquivo não importa nada de React nem toca DOM
- [ ] Teste unit `task-meta.test.ts`: cobre `getInitials` (2 palavras, 1 palavra, string com acento/emoji, string com espaços extras) e `hasTaskProps` (cada campo isolado + todos vazios)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: novos testes de `task-meta.test.ts` passam

**Tests**: unit (Vitest — função pura não-trivial)
**Gate**: quick

**Commit**: `feat(m6): T3 task-meta com STATUS_OPTIONS, getInitials e hasTaskProps`

---

### T4: nodeSize.ts + integração de altura no layout [P]

**What**: Criar `lib/nodeSize.ts` com `NODE_WIDTH`, `NODE_HEIGHT_BASE`, `NODE_HEIGHT_WITH_FOOTER` e `nodeHeight(node)` = `hasTaskProps(node) ? WITH_FOOTER : BASE`. Substituir as constantes locais de altura no `layout.worker.ts` e `treeLayout.ts` por `nodeHeight(node)` por nó (largura segue constante).
**Where**: `packages/web/src/lib/nodeSize.ts` (novo), `packages/web/src/lib/layout.worker.ts`, `packages/web/src/lib/treeLayout.ts`
**Depends on**: T3
**Reuses**: `hasTaskProps` de T3; estrutura atual do worker (já lê `height` por nó)
**Requirement**: M6-18 (sem footer ⇒ altura base), suporte a M6-14/15/16 (espaço reservado p/ rodapé)

**Tools**:
- Skill: `react-flow`

**Done when**:
- [ ] `nodeSize.ts` exporta as constantes e `nodeHeight(node: NodeDto): number`
- [ ] `layout.worker.ts` usa `nodeHeight(node)` para root e filhos (substitui `NODE_HEIGHT` fixo); `NODE_WIDTH` reusado de `nodeSize.ts`
- [ ] `treeLayout.ts` usa `nodeHeight(n)` por nó (inclusive no `nextY += nodeHeight + GAP_Y`); remove `NODE_H` local
- [ ] Worker continua funcionando (sem import de React/DOM no caminho); `task-meta.ts`/`nodeSize.ts` permanecem puros
- [ ] Nó sem task props mantém altura 40 (zero mudança visual vs M5)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm lint`

**Tests**: none (worker/layout sem cobertura — AD-009; `nodeHeight` é ternário trivial sobre `hasTaskProps` já testado em T3)
**Gate**: build

**Commit**: `feat(m6): T4 altura do nó com rodapé no layout`

---

### T5: Componente StatusSelector [P]

**What**: Criar `StatusSelector` — 4 botões segmentados coloridos para escolher status; clicar no ativo limpa (`null`). Acessível (label textual, aria-pressed, Enter/Space).
**Where**: `packages/web/src/pages/map/components/StatusSelector.tsx`
**Depends on**: T3
**Reuses**: `STATUS_OPTIONS`/`statusMeta` de T3; padrão visual/aria do `ColorSwatchGrid`; `Button` ou `<button>` nativo
**Requirement**: M6-01, M6-02, M6-03, M6-21, M6-22

**Tools**:
- Skill: `web-component-creation`

**Done when**:
- [ ] Props: `value: NodeDto['status']`, `onSelect: (status: NodeDto['status']) => void`
- [ ] Renderiza 4 botões a partir de `STATUS_OPTIONS` com label textual visível (M6-22)
- [ ] Botão ativo: `backgroundColor` = cor do status + texto contrastante; inativos: outline neutro
- [ ] Click em inativo ⇒ `onSelect(value)`; click no ativo ⇒ `onSelect(null)` (M6-03)
- [ ] Cada botão `<button type="button">` com `aria-pressed`, focável, ativável por Enter/Space (M6-21)
- [ ] `data-testid` nos botões para os e2e (ex.: `status-btn-IN_PROGRESS`)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo)
**Gate**: build

**Commit**: `feat(m6): T5 StatusSelector com botões segmentados`

---

### T6: Componente NodeTaskIndicators [P]

**What**: Criar `NodeTaskIndicators` — rodapé compacto com ponto de status + iniciais do responsável + ícone de prioridade, cada um renderizado só se presente. Retorna `null` quando nenhum campo preenchido.
**Where**: `packages/web/src/pages/map/components/NodeTaskIndicators.tsx`
**Depends on**: T3
**Reuses**: `statusMeta`/`getInitials`/`hasTaskProps` de T3; ícone `Flag` de `lucide-react` (já usado no projeto)
**Requirement**: M6-14, M6-15, M6-16, M6-17, M6-18

**Tools**:
- Skill: `web-component-creation`

**Done when**:
- [ ] Props: `{ node: NodeDto }`
- [ ] `!hasTaskProps(node)` ⇒ retorna `null` (M6-18)
- [ ] Status definido ⇒ ponto `w-2 h-2 rounded-full` com `backgroundColor` da cor do status, `title`/`aria-label` = label (M6-14)
- [ ] Assignee definido ⇒ `getInitials(node.assignee)` com `title={node.assignee}` (M6-15)
- [ ] `isCritical` ⇒ ícone `Flag`/🚩 com `aria-label="Crítico"` (M6-16)
- [ ] Campo vazio ⇒ indicador ausente (M6-17); ordem: status → iniciais → prioridade
- [ ] Indicadores legíveis sobre `bgColor` (herdam `currentColor`/contorno neutro)
- [ ] `data-testid="node-task-indicators"` no wrapper para os e2e
- [ ] Gate check passa: `cd packages/web && pnpm typecheck`

**Tests**: none (componente declarativo; lógica de iniciais/presença testada em T3)
**Gate**: build

**Commit**: `feat(m6): T6 NodeTaskIndicators (rodapé progressivo)`

---

### T7: Estender NodeEditForm com status, responsável e prioridade [P]

**What**: Adicionar ao `NodeEditForm` (abaixo das cores) as seções: Status (`StatusSelector`), Responsável (`Input` com submit em Enter/blur, vazio⇒`null`) e Prioridade (toggle `<button aria-pressed>` "Crítico"). Cada ação chama `onUpdateNode` com o campo correspondente.
**Where**: `packages/web/src/pages/map/components/NodeEditDialog.tsx` (modificar `NodeEditForm`)
**Depends on**: T2, T3, T5
**Reuses**: `StatusSelector` (T5), `Input`, padrão de submit do título (Enter/blur + guard "mudou"), `space-y-4`/label do dialog
**Requirement**: M6-01, M6-02, M6-04, M6-05, M6-06, M6-07

**Tools**:
- Skill: `web-component-creation`

**Done when**:
- [ ] Seção "Status": `<StatusSelector value={node.status} onSelect={(s) => onUpdateNode({ status: s })} />`
- [ ] Seção "Responsável": `Input` controlado (init `node.assignee ?? ''`); em Enter/blur faz `const v = value.trim(); onUpdateNode({ assignee: v === '' ? null : v })`, só dispara se mudou (M6-04, M6-05)
- [ ] Seção "Prioridade": `<button aria-pressed={node.isCritical}>` que faz `onUpdateNode({ isCritical: !node.isCritical })` (M6-06)
- [ ] Cada seção com `<label>` no mesmo padrão das cores; `data-testid` no input de responsável e no toggle
- [ ] Comportamento idêntico para folha/intermediário/raiz (sem branch por posição) (M6-07)
- [ ] Título e cores existentes continuam funcionando
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm lint`

**Tests**: none (componente declarativo; persistência coberta por e2e em T9)
**Gate**: build

**Commit**: `feat(m6): T7 controles de tarefa no dialog`

---

### T8: Reestruturar MindNode com rodapé de indicadores [P]

**What**: Transformar o container do `MindNode` de linha única em coluna: header (collapse/título/ações atuais) numa linha + `<NodeTaskIndicators node={node} />` abaixo. Handles permanecem filhos diretos do container.
**Where**: `packages/web/src/pages/map/components/MindNode.tsx`
**Depends on**: T4, T6
**Reuses**: `NodeTaskIndicators` (T6); todo o header atual intacto
**Requirement**: M6-14, M6-15, M6-16, M6-18, M6-19

**Tools**:
- Skill: `react-flow`

**Done when**:
- [ ] Container externo vira `flex flex-col` (mantém `relative`, borda, `bg-card`, padding, `minWidth`)
- [ ] Conteúdo atual (collapse + título + ações) embrulhado num `<div className="flex items-center gap-1">`
- [ ] `<NodeTaskIndicators node={node} />` renderizado abaixo do header
- [ ] `<Handle>` Left/Right permanecem como filhos diretos do container (posição inalterada)
- [ ] Nó sem task props renderiza igual a M5 (indicadores retornam null; sem linha extra)
- [ ] Editar uma propriedade no dialog reflete o indicador imediatamente (optimistic — via cache) (M6-19)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm lint`

**Tests**: none (componente declarativo; integração coberta por e2e em T9)
**Gate**: build

**Commit**: `feat(m6): T8 MindNode em coluna com rodapé de tarefa`

---

### T9: Testes e2e — propriedades de tarefa

**What**: Specs Playwright cobrindo: definir status/responsável/crítico no dialog, ver indicadores aparecerem no canvas, exibição progressiva (vazio⇒sem rodapé), persistência após F5, limpar status (clicar ativo) e responsável (vazio).
**Where**: `packages/web/e2e/task-properties.spec.ts`
**Depends on**: T1, T2, T7, T8
**Reuses**: padrões de seletor/setup de `e2e/edit-dialog.spec.ts` e `persistence.spec.ts`; `data-testid` de T5/T6/T7
**Requirement**: M6-01 a M6-19 (caminhos P1)

**Tools**:
- Skill: NONE

**Done when**:
- [ ] Test: abrir dialog, marcar status "Em andamento" ⇒ ponto colorido aparece no nó
- [ ] Test: digitar responsável ⇒ iniciais aparecem no rodapé
- [ ] Test: marcar "Crítico" ⇒ ícone 🚩 aparece
- [ ] Test: nó sem propriedades não tem `node-task-indicators`
- [ ] Test: clicar no status ativo limpa (ponto some); responsável vazio limpa (iniciais somem)
- [ ] Test: F5 ⇒ status/responsável/crítico persistem (indicadores reaparecem)
- [ ] Gate check passa: `cd packages/web && pnpm test:e2e`
- [ ] Test count: novas specs de `task-properties.spec.ts` passam; specs M5/M4 existentes continuam verdes

**Tests**: e2e
**Gate**: full

**Commit**: `test(m6): T9 specs e2e das propriedades de tarefa`

---

## Parallel Execution Map

```
Phase 1 (foundations):
  T1 ──→ T2        (api → shared)
  T3               (task-meta, em paralelo ao backend)

Phase 2 (após T3):
  ├── T4 [P]  (nodeSize + layout)
  ├── T5 [P]  (StatusSelector)
  └── T6 [P]  (NodeTaskIndicators)

Phase 3 (integração UI — arquivos distintos):
  T2,T3,T5 ──→ T7 [P]  (NodeEditForm)
  T4,T6    ──→ T8 [P]  (MindNode)

Phase 4 (e2e):
  T1,T2,T7,T8 ──→ T9
```

**Parallelism constraint:** T4/T5/T6 mexem em arquivos distintos sem estado compartilhado (testes none/unit parallel-safe). T7 e T8 são arquivos distintos (dialog vs MindNode) — paralelos. T9 (e2e) é parallel-safe: No → roda sozinho ao final.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: PATCH estendido (backend) | 2 arquivos (route + testes) | ✅ Granular |
| T2: UpdateNodeBody | 1 arquivo (tipo) | ✅ Granular |
| T3: task-meta + testes | 2 arquivos coesos | ✅ Granular |
| T4: nodeSize + layout | 3 arquivos (1 novo + 2 integrações coesas) | ✅ Granular (mesma mudança) |
| T5: StatusSelector | 1 componente | ✅ Granular |
| T6: NodeTaskIndicators | 1 componente | ✅ Granular |
| T7: NodeEditForm estendido | 1 arquivo | ✅ Granular |
| T8: MindNode reestruturado | 1 arquivo | ✅ Granular |
| T9: specs e2e | 1 arquivo de teste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | nenhuma seta entrando | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | sem entrada (paralela) | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T3 | T3 → T5 | ✅ Match |
| T6 | T3 | T3 → T6 | ✅ Match |
| T7 | T2, T3, T5 | T2,T3,T5 → T7 | ✅ Match |
| T8 | T4, T6 | T4,T6 → T8 | ✅ Match |
| T9 | T1, T2, T7, T8 | T1,T2,T7,T8 → T9 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | API (Zod + handler) | unit (Vitest DB real) | unit | ✅ OK |
| T2 | Shared type (sem lógica) | none | none | ✅ OK |
| T3 | Função pura não-trivial (`getInitials`) | unit | unit | ✅ OK |
| T4 | Helper trivial + worker/layout (AD-009 untested) | none | none | ✅ OK |
| T5 | Componente UI declarativo | none | none | ✅ OK |
| T6 | Componente UI declarativo | none | none | ✅ OK |
| T7 | Componente UI declarativo | none | none | ✅ OK |
| T8 | Componente UI declarativo | none | none | ✅ OK |
| T9 | Integração canvas (dialog + indicadores) | e2e (Playwright) | e2e | ✅ OK |
