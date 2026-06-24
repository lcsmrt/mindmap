# M7 — Migração do Canvas para visx: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Draft — aguardando aprovação para Execute (em chat separado, ver [[feedback-plan-execute-split]])

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — regras do projeto (idioma, formato de commits). **Atenção:** o CLAUDE.md ainda diz "stack fixado: React Flow / não propor trocas". A **AD-015** é um override consciente do usuário **só para o canvas** — esta migração É a troca aprovada. Não reabrir a decisão.
- `.specs/project/STATE.md` — decisões (AD-001…AD-015, com destaque para **AD-015** e **AD-002** que segue valendo: sem posições x/y persistidas) e `CONCERNS.md`.
- `.specs/features/m7-canvas-visx/spec.md` — requisitos `M7-NN`.
- `.specs/features/m7-canvas-visx/design.md` — arquitetura, **Research verificado** (APIs visx/flextree) e componentes.
- Este arquivo.

**Princípios não-negociáveis:**

- TypeScript strict; sem `any` implícito (`any` explícito só com comentário).
- Commits atômicos: um por task, em **português**, Conventional Commits — `feat(m7): T<N> <descrição>` (`chore(m7):` para deps/cleanup, `test(m7):` para testes/e2e).
- Identificadores e código em **inglês**; commits/comentários/docs em **português**.
- **Escopo: paridade _funcional_ + remoção da logo.** Direção do layout, estilo de edge e background são **livres (menor esforço)**. As 3 queixas de UX (posicionamento livre, escolher direção, reorder de irmãos) estão **fora de escopo** (Deferred Ideas). Não persistir x/y (AD-002).

**Estado atual (pré-M7) — o que existe:**

- Canvas em `@xyflow/react@^12` em **2 arquivos**: `pages/map/components/MapCanvas.tsx` (`<ReactFlow>`, `ReactFlowProvider`, `Background`, `useNodesState/useEdgesState`, `onNodeDragStop`, `fitView`, `panOnDrag`, `zoomOnScroll`, min/max 0.1/3, CSS import) e `pages/map/components/MindNode.tsx` (`Handle`/`Position` left/right).
- Layout: `lib/useLayoutedTree.ts` (orquestra) + `lib/layout.worker.ts` (elkjs, `direction: RIGHT`) + `lib/treeLayout.ts` (fallback síncrono). `lib/nodeSize.ts` expõe `NODE_WIDTH=180`, `NODE_HEIGHT_BASE=40`, `NODE_HEIGHT_WITH_FOOTER=58`, `nodeHeight(node)`.
- Pipeline de dados: `lib/tree.ts` (`buildTree`, `visibleNodes`) — **fica intacto**.
- Mutations: `api/nodes.ts` (`useCreateNode/useUpdateNode/useDeleteNode/useMoveNode`, optimistic+rollback+toast) — **ficam intactas**.
- `MindNode` recebe `MindNodeData` via `data` (React Flow injeta). Tipos em `pages/map/components/types.ts`.
- e2e: 4 specs (`smoke`, `persistence`, `edit-dialog`, `task-properties`) usam **40×** o seletor `.react-flow__node`. `persistence.spec.ts:136` está **vermelho por bug pré-existente** (`.first()` frágil + DB compartilhado — CONCERNS.md) — **não consertar aqui**, só migrar o seletor.

**Stack-alvo (verificada — ver Research no design.md):**

- `@visx/zoom@^4` (pan/zoom; v4 usa `@use-gesture/react`, **não** d3-zoom; `zoom.toString()` → `matrix()` CSS).
- `@visx/shape@^4` (`LinkVertical` p/ edges; traz d3-shape via vendor).
- `@visx/group@^4` (opcional).
- `d3-flextree@^2.1.2` + `@types/d3-flextree@^2.1.4` (layout de **altura variável** — `d3.tree()`/`<Tree>` só fazem uniforme).
- Sai: `@xyflow/react`, `elkjs`.

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Deps / config (`package.json`) | none | build (`pnpm typecheck`) | Yes |
| Lógica pura de layout (`computeTreeLayout`) | unit (Vitest) | `pnpm test` (web) | Yes |
| Lógica pura de hit-test do drag (`findDropTarget`) | unit (Vitest) | `pnpm test` (web) | Yes |
| Hook de pointer/gesto (wiring) | none (coberto por e2e) | build | Yes |
| Render do canvas / MindNode (interação UI) | e2e (Playwright) | `pnpm test:e2e` (web) | No |
| Cleanup (remoção deps/arquivos) | none | full (typecheck+lint+test+e2e) | No |

**Comandos de gate:**

- build: `pnpm typecheck` (root) — e `pnpm lint` quando tocar código de produção.
- quick: `cd packages/web && pnpm typecheck && pnpm test`.
- full: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`.

**Skills aplicáveis:** `mindmap-canvas` (skill de canvas do projeto, visx+d3 — T2, T3, T4), `web-component-creation` (T4 — MindNode), `web-api-integration` (confirmar mutations sem nova lógica).

---

## Estratégia de ordenação (migração sem quebrar o build)

Para nenhum passo intermediário ficar sem compilar: **primeiro adiciona** as deps novas e constrói os módulos novos ao lado dos antigos (T1–T3); **depois** faz a troca da camada de render (T4), que remove todo uso de React Flow do código; **então** migra os seletores e2e e prova a paridade (T5); **por fim** remove deps/arquivos mortos (T6).

---

## Execution Plan

```
Phase 1 (deps):
  T1                       (add visx/flextree — mantém RF/elkjs ainda)

Phase 2 (módulos novos, paralelos — não tocam React Flow):
  ├─ T2 [P]  (useTreeLayout + computeTreeLayout + unit)
  └─ T3 [P]  (useNodeDrag + findDropTarget + unit)

Phase 3 (a troca):
  T2,T3 ──→ T4             (MapCanvas+MindNode em visx; RF some do código)

Phase 4 (verificação e2e):
  T4 ──→ T5                (migrar seletores e2e + rodar e2e = prova de paridade)

Phase 5 (limpeza):
  T5 ──→ T6                (remove @xyflow/react + elkjs + arquivos mortos; full gate)
```

---

## Task Breakdown

### T1: Adicionar dependências visx + d3-flextree

**What**: Adicionar ao `packages/web/package.json` as deps `@visx/zoom`, `@visx/shape`, `@visx/group` (`^4.0.0`), `d3-flextree` (`^2.1.2`) e devDep `@types/d3-flextree` (`^2.1.4`). **Manter** `@xyflow/react` e `elkjs` por enquanto (removidos em T6). Rodar install.
**Where**: `packages/web/package.json` (+ lockfile)
**Depends on**: None
**Reuses**: —
**Requirement**: M7-23 (parte "add")

**Tools**: Skill: NONE

**Done when**:
- [ ] As 4 deps + 1 devDep aparecem no `package.json` nas versões acima
- [ ] `pnpm install` completa sem erro; lockfile atualizado
- [ ] Import sanity: `import { flextree } from 'd3-flextree'` e `import { Zoom } from '@visx/zoom'` resolvem (typecheck)
- [ ] `@xyflow/react` e `elkjs` ainda presentes (app atual continua compilando e rodando)
- [ ] Gate check passa: `pnpm typecheck`

**Tests**: none
**Gate**: build

**Commit**: `chore(m7): T1 adiciona deps visx e d3-flextree`

---

### T2: `useTreeLayout` com flextree (layout síncrono de altura variável) [P]

**What**: Criar `lib/useTreeLayout.ts` expondo uma função **pura** `computeTreeLayout(tree, nodeSizeFn)` que usa `d3-flextree` para produzir `{ positioned: PositionedNode[], links: LayoutLink[], bounds }` (direção vertical, raiz no topo), e o hook `useTreeLayout(nodes, edges)` que memoiza sobre os nós visíveis. Usa `nodeHeight` por nó (altura variável 40/58). **Não** deletar `useLayoutedTree/treeLayout/worker` ainda (T6).
**Where**: `packages/web/src/lib/useTreeLayout.ts`, `packages/web/src/lib/useTreeLayout.test.ts`
**Depends on**: T1
**Reuses**: `buildTree`/`visibleNodes` (`lib/tree.ts`), `nodeHeight`/`NODE_WIDTH` (`lib/nodeSize.ts`)
**Requirement**: M7-05, M7-17, M7-18

**Tools**: Skill: `mindmap-canvas`

**Done when**:
- [ ] `PositionedNode { id, x, y, width, height }` e `LayoutLink { source:{x,y}, target:{x,y} }` exportados
- [ ] `computeTreeLayout` monta a hierarquia (a partir da árvore visível) e roda `flextree().nodeSize(n => [NODE_WIDTH + GAP, nodeHeight(n.data) + GAP])`; lê `node.x/node.y`
- [ ] Retorna `bounds { width, height, minX, minY }` (dos extents) para o fitView
- [ ] É **síncrono** (sem worker, sem estado async, sem `isLayouting`)
- [ ] Arquivo não importa React Flow nem elkjs
- [ ] Unit test (`useTreeLayout.test.ts`) sobre `computeTreeLayout`: (a) todo nó visível recebe uma posição; (b) nº de links = nº de nós − 1 (árvore conectada); (c) determinístico (mesma entrada ⇒ mesma saída); (d) nó com task props (footer) usa `height=58` e nó sem usa `height=40`; (e) árvore só com a raiz ⇒ 1 positioned, 0 links
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: novos testes de `useTreeLayout.test.ts` passam (sem deleção de testes existentes)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m7): T2 useTreeLayout com d3-flextree`

---

### T3: `useNodeDrag` — drag-to-reparent por pointer events [P]

**What**: Criar `pages/map/components/useNodeDrag.ts` com (a) função **pura** `findDropTarget(worldPoint, candidates, opts)` que retorna o id do nó cujo bounds contém o ponto (excluindo o próprio nó arrastado e respeitando a raiz como não-alvo-de-si), e (b) o hook que gerencia `pointerdown/move/up` com `setPointerCapture`, converte tela→mundo via `applyInverseToPoint` (injetado), aplica limiar clique-vs-drag, e chama `onReparent`/`onInvalidDrop`. **Não** wirar no MapCanvas ainda (T4).
**Where**: `packages/web/src/pages/map/components/useNodeDrag.ts`, `packages/web/src/pages/map/components/useNodeDrag.test.ts`
**Depends on**: T1
**Reuses**: tipos `PositionedNode` de T2 (importar o tipo); padrão de bounds `[x,y,width,height]`
**Requirement**: M7-14, M7-15 (snap-back via `onInvalidDrop`)

**Tools**: Skill: `mindmap-canvas`

**Done when**:
- [ ] `findDropTarget(point, candidates, { excludeId, isRoot })` retorna o id do alvo quando o ponto cai dentro do bounds; `null` quando não há alvo
- [ ] Exclui o próprio nó arrastado (`excludeId`) e nunca retorna ele mesmo
- [ ] Hook expõe `{ onNodePointerDown(id, e), draggingId, ghostOffset }` (ou equivalente); nó raiz não inicia drag
- [ ] `pointerdown` faz `stopPropagation` (não vaza pro pan do Zoom) + `setPointerCapture`
- [ ] Deslocamento abaixo do limiar ⇒ tratado como clique (não dispara `onReparent`)
- [ ] Unit test (`useNodeDrag.test.ts`) sobre `findDropTarget`: ponto dentro de um nó ⇒ id; ponto no vazio ⇒ null; ponto sobre o próprio nó (excludeId) ⇒ null; sobreposição de candidatos ⇒ regra determinística (ex.: primeiro/topo)
- [ ] Gate check passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: novos testes de `useNodeDrag.test.ts` passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(m7): T3 useNodeDrag (reparent por pointer events)`

---

### T4: Trocar a camada de render — MapCanvas + MindNode em visx

**What**: Reescrever `MapCanvas` para renderizar via `<Zoom>` com **duas camadas** (SVG das edges `LinkVertical` + `<div>` dos nós HTML), ambas com `transform={zoom.toString()}` (div com `transformOrigin:'0 0'`); integrar `useTreeLayout` (T2) e `useNodeDrag` (T3); implementar `fitView` inicial via `setTransformMatrix` (a partir de `bounds`), min/max 0.1/3, wheel-zoom + drag-pan via `zoom.containerRef`; medir o container (ResizeObserver — sem dep nova); background liso (classe Tailwind). Adaptar `MindNode`: **remover** `Handle`/`Position` e o import de `@xyflow/react`, receber `{ data: MindNodeData }` direto, **input inline controlado** (`useState`+`value/onChange`, fecha a Fragile Area), e o MapCanvas o posiciona num wrapper `absolute {left,top,width}` com `data-testid="mind-node"` (+ `data-node-id`/`data-node-title`). Remover `useNodesState/useEdgesState`/sync e o CSS do React Flow. Mutations e handlers de estado (`collapsedIds/editingId/deleteTarget/editDialogNodeId`, add/delete/rename/collapse/dialog) **preservados sem mudança de lógica**.
**Where**: `packages/web/src/pages/map/components/MapCanvas.tsx`, `packages/web/src/pages/map/components/MindNode.tsx` (+ `types.ts` se o shape de props mudar)
**Depends on**: T2, T3
**Reuses**: `useTreeLayout` (T2), `useNodeDrag` (T3), `NodeTaskIndicators`/`MindNode` visual (M6), hooks de mutation (`api/nodes.ts`), `buildTree/visibleNodes`, `NodeEditDialog`
**Requirement**: M7-01, M7-02 (logo ausente), M7-03, M7-04, M7-06, M7-07, M7-08, M7-09, M7-10, M7-11, M7-12, M7-13, M7-14, M7-15, M7-19, M7-24, M7-25

**Tools**: Skill: `mindmap-canvas`, `web-component-creation`

**Done when**:
- [ ] `MapCanvas` não importa mais nada de `@xyflow/react` (nem o CSS); `MindNode` idem (sem `Handle`/`Position`)
- [ ] Render via `<Zoom>` com camada SVG (`LinkVertical` por link de `useTreeLayout`) + camada HTML (nós), mesma `matrix()` aplicada às duas; `transform-origin:0 0` no div HTML
- [ ] Pan (drag no fundo) + zoom (wheel) funcionam; escala limitada a [0.1, 3]
- [ ] `fitView` inicial enquadra a árvore (1x quando `bounds` fica disponível; guard p/ container 0×0)
- [ ] Background liso (sem logo, sem `<pattern>`); **nenhuma atribuição do React Flow na tela**
- [ ] Edição inline (clique no texto → input focado, Enter/blur salva, Escape cancela) funciona; input é **controlado**
- [ ] Collapse/expand, add child, delete (com confirm), abrir dialog, indicadores de tarefa (M6) e optimistic/rollback/toast funcionam como antes
- [ ] Raiz: sem delete, não-arrastável
- [ ] Drag de um nó sobre outro ⇒ `useMoveNode({ parentId })`; drop no vazio ⇒ refetch (snap-back); move cíclico ⇒ backend rejeita + rollback
- [ ] Cada nó tem `data-testid="mind-node"` (e `data-node-id`/`data-node-title`)
- [ ] Sem `useNodesState/useEdgesState`; render derivado de uma fonte única (sem o `useEffect` de `setNodes`) — Fragile Area eliminada (M7-24)
- [ ] App roda no browser (smoke manual): abrir um mapa real renderiza igual, navega, edita, arrasta
- [ ] Gate check passa: `pnpm typecheck && pnpm lint` (root)

**Tests**: none neste passo — a interação UI é coberta por e2e em **T5** (dependência de execução: os e2e só passam após a migração dos seletores; ver "merge forward" na ordenação). Verificação interina = build + lint + smoke manual.
**Gate**: build (+ lint)

**Commit**: `feat(m7): T4 canvas em visx (Zoom + edges SVG + nós HTML)`

---

### T5: Migrar seletores e2e e provar paridade

**What**: Substituir os **40 usos** de `.react-flow__node` pelos novos seletores (`[data-testid="mind-node"]` e, onde útil, `[data-node-id]`/`[data-node-title]`) nos 4 specs, **preservando a semântica** das asserções (count, visibilidade, `.truncate`, `input`, `getByTitle`). Rodar a suíte e2e completa e confirmar que os specs que estavam verdes seguem verdes. Documentar o status de `persistence.spec.ts:136` (bug pré-existente do `.first()`): **não** consertar — apenas adaptar o seletor; se o status mudar, anotar no relatório.
**Where**: `packages/web/e2e/smoke.spec.ts`, `e2e/persistence.spec.ts`, `e2e/edit-dialog.spec.ts`, `e2e/task-properties.spec.ts`
**Depends on**: T4
**Reuses**: `data-testid` adicionados em T4
**Requirement**: M7-20, M7-22, M7-16 (anti-ciclo verificado via e2e/manual)

**Tools**: Skill: NONE

**Done when**:
- [ ] Zero ocorrências de `.react-flow__node` nos specs (substituídas por `[data-testid="mind-node"]` ou equivalente)
- [ ] Semântica das asserções preservada (mesmos counts/fluxos)
- [ ] `cd packages/web && pnpm test:e2e` roda; os specs verdes pré-migração seguem verdes (smoke, edit-dialog, task-properties)
- [ ] `persistence.spec.ts:136`: seletor migrado; comportamento do bug pré-existente documentado (sem tentativa de fix)
- [ ] Gate check passa: `cd packages/web && pnpm test:e2e`
- [ ] Test count: nenhum spec verde vira vermelho por causa da troca de lib (comparar com baseline pré-T4)

**Tests**: e2e
**Gate**: full

**Commit**: `test(m7): T5 migra seletores e2e para data-testid`

---

### T6: Remover React Flow, elkjs e arquivos de layout mortos

**What**: Remover `@xyflow/react` e `elkjs` do `packages/web/package.json`; deletar `lib/layout.worker.ts`, `lib/useLayoutedTree.ts` e `lib/treeLayout.ts` (substituídos por `useTreeLayout`); remover qualquer import remanescente. Rodar `pnpm install` e o full gate.
**Where**: `packages/web/package.json`, deletar `lib/layout.worker.ts`, `lib/useLayoutedTree.ts`, `lib/treeLayout.ts`
**Depends on**: T5
**Reuses**: —
**Requirement**: M7-02 (RF fora do bundle), M7-17, M7-23 (parte "remove"), M7-21

**Tools**: Skill: NONE

**Done when**:
- [ ] `@xyflow/react` e `elkjs` ausentes do `package.json`; `pnpm install` ok; lockfile atualizado
- [ ] `layout.worker.ts`, `useLayoutedTree.ts`, `treeLayout.ts` deletados
- [ ] `grep -r "@xyflow/react\|elkjs\|layout.worker\|useLayoutedTree\|treeLayout" packages/web/src` não retorna nada (fora de comentários históricos)
- [ ] Gate check passa (full): `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`
- [ ] Test count: todas as suítes (api, web unit, e2e) verdes; contagem ≥ baseline + novos unit de T2/T3

**Tests**: none (remoção; coberto pelo full gate)
**Gate**: full

**Commit**: `chore(m7): T6 remove React Flow, elkjs e layout antigo`

---

## Parallel Execution Map

```
Phase 1:  T1
Phase 2:  T1 → ├── T2 [P]
               └── T3 [P]
Phase 3:  T2,T3 → T4
Phase 4:  T4 → T5
Phase 5:  T5 → T6
```

**Parallelism constraint:** T2 e T3 são arquivos novos distintos, sem estado compartilhado, testes unit parallel-safe → `[P]`. T4 (a troca) precisa de ambos e mexe nos arquivos centrais → sequencial. T5 (e2e) é parallel-safe: No. T6 (cleanup + full gate) depende do e2e verde de T5 → sequencial.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: deps | 1 arquivo (package.json) | ✅ Granular |
| T2: useTreeLayout + teste | 2 arquivos coesos | ✅ Granular |
| T3: useNodeDrag + teste | 2 arquivos coesos | ✅ Granular |
| T4: MapCanvas + MindNode | 2 arquivos fortemente acoplados (1 contrato de render) | ⚠️→✅ Cohesive: a troca da camada compartilha o contrato nó↔canvas; separar gera estado intermediário que não compila/roda. Mantido junto por design (ver "Resolving compilation dependencies") |
| T5: seletores e2e | 4 specs (mesma mudança mecânica) | ✅ Granular (mudança única replicada) |
| T6: cleanup | package.json + 3 deleções | ✅ Granular (uma limpeza coesa) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | sem entrada | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T2, T3 | T2,T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Deps/config | none | none | ✅ OK |
| T2 | Lógica pura de layout | unit | unit | ✅ OK |
| T3 | Lógica pura de hit-test | unit | unit | ✅ OK |
| T4 | Render canvas / MindNode (interação UI) | e2e | none aqui (e2e em T5) | ⚠️ Merge-forward: os e2e só são executáveis após os seletores migrarem (T5). Verificação movida p/ T5 — não é deferral arbitrário, é dependência de runnability documentada |
| T5 | Integração canvas (e2e) | e2e | e2e | ✅ OK |
| T6 | Remoção | none | none (full gate) | ✅ OK |

> Nota sobre T4: a regra "Tests: none só quando a matriz diz none" é respeitada via **merge-forward** (referências `tasks.md` §"Resolving compilation dependencies"): a camada de UI de T4 é coberta pelos e2e de T5, que é o ponto mais cedo em que rodam. T4 não fica sem verificação alguma — tem build+lint+smoke manual; a verificação de interação completa é T5.

---

## Pergunta ao usuário antes do Execute (MCPs/Skills por task)

As skills propostas por task estão nos cabeçalhos (`mindmap-canvas`, `web-component-creation`, `web-api-integration`). Nenhum MCP é necessário. Confirme ou ajuste no início do chat de execução.
