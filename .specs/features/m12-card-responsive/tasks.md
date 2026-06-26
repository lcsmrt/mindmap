# M12 — Card responsivo (texto sempre visível + altura dinâmica): Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Executado (gates verdes; pendente review AD-013, 2026-06-25)

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — idioma (pt-BR em conversa/commits/docs; código/identificadores em **inglês**) e formato de commits (`tipo(escopo): descrição`, escopo = `m12`).
- `.specs/project/STATE.md` — decisões. Relevantes: **AD-002** (posições NÃO são persistidas — segue valendo; **M12 não adiciona schema/coluna**), **AD-015** (stack do canvas = visx + d3-flextree), **AD-013** (review pós-execute obrigatório, chat separado).
- `.specs/features/m12-card-responsive/spec.md` — requisitos `M12-NN`.
- `.specs/features/m12-card-responsive/design.md` — arquitetura (pipeline medir→layout) e o **Invariante de convergência** (correção central).
- Este arquivo.

**Princípios não-negociáveis:**

- TypeScript strict; sem `any` implícito.
- Commits atômicos, um por task, em **português**, Conventional Commits: `feat(m12): T<N> <descrição>` (`test(m12):`/`fix(m12):` quando couber).
- Identificadores/código em **inglês**; commits/comentários/docs em **português**.
- **Escopo: só wrap + altura dinâmica.** A largura segue **fixa** (`NODE_WIDTH=180`). **Sem resize horizontal, sem schema, sem coluna `width`, sem x/y** (resize é milestone futuro). Backend, dialog, mutations, optimistic, `tree.ts` e `slots.ts` (geometria do drop = território M13) **intactos**.
- **Reusar antes de criar** (`.claude/rules/frontend-structure.md`). Componentes/hooks de página ficam em `pages/<pagina>/components/`.

**Estado atual (pré-M12) — o que existe e o que muda:**

- `packages/web/src/lib/nodeSize.ts` — `NODE_WIDTH=180`, `nodeHeight(node)` ∈ {40, 79} (fórmula por `hasTaskProps`). **`nodeHeight` vira `estimateNodeHeight` (estimativa de 1º paint); constantes ficam.**
- `packages/web/src/lib/useTreeLayout.ts` — `computeTreeLayout(tree, nodeSizeFn=nodeHeight)` (pura; **núcleo não muda**, já aceita `nodeSizeFn`) + hook `useTreeLayout(nodes, edges)`. **Hook ganha 3º arg `heights?` e monta o `sizeFn` com fallback.**
- `packages/web/src/lib/useTreeLayout.test.ts` — unit da geometria; o teste de não-sobreposição de alturas variáveis **já foi corrigido no M9** (3 filhos co-laterais). Manter verde.
- `packages/web/src/pages/map/components/MapCanvas.tsx` — `MapCanvasInner` chama `useTreeLayout`; `CanvasLayers` renderiza os wrappers (`data-node-id` já presente, `:152`) e tem o `fitView` (`:80-92`, dispara 1× via `fittedRef`). **Fia a medição: estado de alturas, `registerNode` no wrapper, guarda `allMeasured` no fitView.**
- `packages/web/src/pages/map/components/MindNode.tsx` — span do título com `truncate` (`:199`). **Remover `truncate`, adicionar `break-words`.**
- **Novo:** `packages/web/src/pages/map/components/useMeasuredHeights.ts` — hook com `ResizeObserver` compartilhado + estado `heights` + `registerNode`.

**Padrão de referência:** o `ResizeObserver` do container em `MapCanvas.tsx:197-209` (observer em `ref`, callback ref) — replicar para os cards.

**Invariante de convergência (ler no design):** largura fixa ⇒ reposicionar não muda a altura medida ⇒ o observer não re-dispara por causa do layout. `Math.round` nas alturas + atualização do `Map` **só-se-mudou** (preserva identidade quando estável) garantem ponto fixo em ≤1 relayout, sem loop (M12-12/M12-14).

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Lógica pura (`computeTreeLayout`, `sizeFn` de fallback, reducer `nextHeights`) | unit (Vitest) | `pnpm test` (web) | Yes |
| Hook de medição DOM (`ResizeObserver` wiring) | none unit (AD-007: DOM/timing) → coberto por smoke/e2e | — | No |
| Fiação do canvas + CSS do card (render visual) | e2e existente + **smoke visual obrigatório** (gate L-005) | `pnpm test:e2e` (web) | No |

**Comandos de gate:**

- quick: `cd packages/web && pnpm typecheck && pnpm test`
- full: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`

**Skills aplicáveis:** `mindmap-canvas` (central — layout d3-flextree, nós, viewport: T1/T3), `web-component-creation` (hook/CSS do nó: T2/T4). Sem MCPs necessários. Verificar API de `ResizeObserver` (`borderBoxSize`/`contentRect`) e `d3-flextree` na mão (docs/Context7) antes de fixar — **não assumir** (Knowledge Verification Chain).

---

## Execution Plan

```
Phase 1 (paralelo):  T1 [P]  (nodeSize + useTreeLayout: altura medida com fallback)
                     T2 [P]  (useMeasuredHeights: ResizeObserver + reducer)

Phase 2 (sequencial): T1,T2 ──→ T3 (fia medição→layout no canvas) ──→ T4 (CSS do card) ──→ T5 (smoke + gates)
```

T1 e T2 mexem em arquivos disjuntos e não dependem entre si → paralelos. T3 consome ambos. T4 vem depois de T3 para não deixar um commit intermediário com cards quebrando linha sob layout ainda formulaico (sobreposição visual). T5 valida o conjunto.

---

## Task Breakdown

### T1: layout consome altura medida com fallback de estimativa [P]

**What:** Renomear `nodeHeight` → `estimateNodeHeight` em `nodeSize.ts` (doc: agora é estimativa de 1º paint; `NODE_WIDTH` e as constantes `NODE_HEIGHT_BASE/WITH_FOOTER` permanecem). Estender o hook `useTreeLayout` para aceitar um 3º argumento `heights?: ReadonlyMap<string, number>` e montar `sizeFn = (n) => heights?.get(n.id) ?? estimateNodeHeight(n)`, passado a `computeTreeLayout` (que **não muda**). Extrair o fallback como helper puro `nodeSizeFromHeights(heights, node)` e cobri-lo com unit test. Manter a suíte de `computeTreeLayout` verde.
**Where:** `packages/web/src/lib/nodeSize.ts`, `packages/web/src/lib/useTreeLayout.ts`, `packages/web/src/lib/useTreeLayout.test.ts`
**Depends on:** None
**Reuses:** `computeTreeLayout` (assinatura `nodeSizeFn` já existente — ponto de injeção), `hasTaskProps`, estrutura `LayoutResult`.
**Requirement:** M12-05 (fonte da altura), M12-06 (não-sobreposição com altura injetada), M12-13 (estimativa de 1º paint), M12-17 (unit atualizado), M12-19 (sem schema)

**Tools:**

- MCP: NONE
- Skill: `mindmap-canvas`

**Done when:**

- [ ] `nodeHeight` renomeado para `estimateNodeHeight`; nenhum outro símbolo de `nodeSize.ts` mudou (constantes + `NODE_WIDTH` intactos); `slots.ts` (que importa `NODE_HEIGHT_BASE`) **não** tocado.
- [ ] `useTreeLayout(nodes, edges, heights?)` monta o `sizeFn` com fallback; `computeTreeLayout` permanece com a mesma assinatura/corpo.
- [ ] Helper puro `nodeSizeFromHeights` exportado e testado: altura medida vence; ausente → estimativa.
- [ ] `useMemo` do hook inclui `heights` nas deps.
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: todos os testes web verdes (sobe vs. baseline pelos casos novos; sem deleção silenciosa).

**Tests:** unit
**Gate:** quick

**Verify:** `cd packages/web && pnpm test useTreeLayout` → verde, incl. `nodeSizeFromHeights` (medido vence estimativa).

**Commit:** `feat(m12): T1 layout consome altura medida com fallback de estimativa`

---

### T2: hook `useMeasuredHeights` (ResizeObserver compartilhado + reducer estável) [P]

**What:** Criar o hook que possui o estado `heights: ReadonlyMap<string, number>` e **um único** `ResizeObserver`; expõe `registerNode(id): (el) => void` (ref callbacks **estáveis por id**, memoizados num `Map` interno): `el != null` → `observe`; `el == null` → `unobserve` + remove a entrada. O callback do observer lê `target.dataset.nodeId` e `Math.round(borderBoxSize[0].blockSize ?? contentRect.height)` e aplica o reducer puro `nextHeights(prev, id, h)` (retorna o **mesmo** `Map` se a altura não mudou; novo `Map` se mudou). Extrair `nextHeights` como função pura e cobri-la com unit test (mudou→novo ref; igual→mesmo ref; arredondamento).
**Where:** `packages/web/src/pages/map/components/useMeasuredHeights.ts` (novo), `packages/web/src/pages/map/components/useMeasuredHeights.test.ts` (novo — só o reducer puro)
**Depends on:** None
**Reuses:** padrão de `ResizeObserver` de `MapCanvas.tsx:197-209`.
**Requirement:** M12-07 (mede incl. rodapé), M12-12 (sem salto residual), M12-14 (sem loop: round + só-se-mudou)

**Tools:**

- MCP: NONE
- Skill: `web-component-creation`

**Done when:**

- [ ] `useMeasuredHeights()` retorna `{ heights, registerNode }`; `registerNode(id)` devolve ref callback estável (mesma referência entre renders para o mesmo id).
- [ ] Um único `ResizeObserver` para todos os nós; `unobserve` + limpeza no `el == null`; observer desconectado no unmount do hook.
- [ ] `nextHeights` puro, exportado e testado: altura igual (após `Math.round`) → mesma referência de `Map`; diferente → novo `Map` com o valor atualizado.
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: testes web verdes, incl. os novos de `nextHeights` (sem deleção silenciosa).

**Tests:** unit (reducer puro `nextHeights`; o wiring do observer é coberto por smoke em T5)
**Gate:** quick

**Verify:** `cd packages/web && pnpm test useMeasuredHeights` → verde (identidade do Map preservada quando estável).

**Commit:** `feat(m12): T2 hook useMeasuredHeights (ResizeObserver + reducer estável)`

---

### T3: fia medição→layout no canvas + fitView pós-medida

**What:** Em `MapCanvasInner`: `const { heights, registerNode } = useMeasuredHeights()`; passar `heights` para `useTreeLayout(visNodes, visEdges, heights)`; calcular `allMeasured = positioned.length > 0 && positioned.every(p => heights.has(p.id))`; passar `registerNode` e `allMeasured` a `CanvasLayers`. Em `CanvasLayers`: `ref={registerNode(p.id)}` no wrapper de cada nó (o `data-node-id` já existe); adicionar a guarda `allMeasured` no efeito de `fitView` (só enquadra quando dimensões/bounds existem **e** todos os visíveis foram medidos).
**Where:** `packages/web/src/pages/map/components/MapCanvas.tsx`
**Depends on:** T1, T2
**Reuses:** `useTreeLayout` (3º arg de T1), `useMeasuredHeights` (T2), wrapper/`fittedRef`/efeito de fit existentes, `data-node-id` (`:152`).
**Requirement:** M12-05, M12-06, M12-08 (bounds/fitView reais), M12-09 (editar reposiciona), M12-10 (toggle props re-mede), M12-11 (collapse recompõe), M12-13 (converge sem flicker), M12-15 (drag/slots/ghost seguem)

**Tools:**

- MCP: NONE
- Skill: `mindmap-canvas`

**Done when:**

- [ ] `useTreeLayout` recebe `heights`; o layout reposiciona quando uma altura medida muda (verificável editando um título p/ multi-linha).
- [ ] Cada wrapper de nó registra-se via `registerNode(p.id)`; nós removidos/colapsados desregistram (sem observers vazando).
- [ ] `fitView` só dispara após `allMeasured` (enquadra bounds reais; não enquadra estimativa).
- [ ] Drag-to-place, barra-fantasma, collapse/expand, edição inline, add/delete, dialog seguem funcionando (paridade — derivam de `positioned`). Geometria fina da barra-fantasma é território M13 (não tocar `slots.ts`).
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`

**Tests:** none (integração DOM; sem lógica pura nova — coberta por e2e existente + smoke em T5)
**Gate:** quick

**Verify:** rodar a app; abrir um mapa, editar um nó para um texto de 3 linhas → vizinhos descem sem sobreposição; recarregar → `fitView` enquadra tudo sem corte.

**Commit:** `feat(m12): T3 fia medição→layout no canvas + fitView pós-medida`

---

### T4: título do card quebra linha (remove truncate)

**What:** No span do título de `MindNode` (`:198-199`): remover `truncate`; manter `block`; adicionar `break-words` (palavra única longa quebra dentro dos 180px). Avaliar `items-start` na linha de título/ícones (`:155`) para alinhar chevron/▲ à primeira linha do título multi-linha (refinamento — confirmar no smoke). **Input de edição inline permanece single-line** (fora de escopo). Não tocar a divisória/rodapé M11.
**Where:** `packages/web/src/pages/map/components/MindNode.tsx`
**Depends on:** T3
**Reuses:** estrutura atual do card; container `flex-1 min-w-0` (`:185`) permanece.
**Requirement:** M12-01 (quebra em linhas, sem truncar), M12-02 (`break-words`), M12-03 (curto sem sobra), M12-04 (coexiste com rodapé/divisória)

**Tools:**

- MCP: NONE
- Skill: `web-component-creation`

**Done when:**

- [ ] `truncate` removido do span do título; título longo quebra em múltiplas linhas, sem reticências.
- [ ] Palavra única > 180px quebra dentro do card (`break-words`), sem vazar horizontalmente.
- [ ] Título curto não gera altura sobrando; título + divisória + rodapé coexistem quando há props de tarefa.
- [ ] Alinhamento dos ícones (chevron/▲) ante título multi-linha conferido (smoke).
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`

**Tests:** none (mudança visual/CSS — smoke em T5)
**Gate:** quick

**Verify:** rodar a app; nó com título longo e nó com palavra gigante → ambos inteiros, em linhas, sem corte/vazamento; com o pipeline de T3 a altura acompanha.

**Commit:** `feat(m12): T4 título do card quebra linha (remove truncate)`

---

### T5: smoke visual + gates completos

**What:** Validar o conjunto: smoke visual (screenshot Playwright) de cards multi-linha sem sobreposição + `fitView`; paridade de interação; rodar a tríade + e2e. Conferir os `Success Criteria` e o `git diff` (só frontend, sem schema).
**Where:** — (verificação; ajustes pontuais só se algum gate apontar)
**Depends on:** T4
**Reuses:** suíte e2e existente (seletores `data-testid`, agnósticos à altura).
**Requirement:** M12-01..04 (visual), M12-08, M12-11, M12-12, M12-15, M12-16 (paridade), M12-17 (tríade), M12-18 (e2e), M12-19 (só frontend)

**Tools:**

- MCP: NONE
- Skill: NONE

**Done when:**

- [ ] **Smoke visual obrigatório:** screenshot de um mapa com cards de 1, 2 e 4 linhas + palavra gigante → sem sobreposição, sem truncamento, `fitView` enquadra tudo (gate L-005 — a tríade prova cálculo, não render).
- [ ] Smoke de interação: editar inline (multi-linha reposiciona), colapsar/expandir, add filho, excluir, abrir dialog, ligar/desligar status/responsável (altura re-mede), arrastar (drag-to-place + barra-fantasma) — tudo funciona.
- [ ] Gate full passa: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`.
- [ ] e2e: nenhum spec antes verde vira vermelho por causa da altura dinâmica (`persistence.spec.ts:136` é flaky histórico — não atribuir a M12; ver CONCERNS.md).
- [ ] `git diff` confirma: **só frontend**, sem mudança de backend/schema, sem coluna `width`, sem x/y. AD-002 intacta.

**Tests:** e2e (suíte existente) + smoke visual
**Gate:** full

**Verify:** comparar e2e verdes com o baseline (32/32 no M11 — ver STATE.md); screenshot anexado/conferido com cards multi-linha sem overlap.

**Commit:** sem commit de código próprio se a verificação passa limpa; caso algum ajuste seja necessário, `fix(m12): T5 <descrição>`.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: nodeSize rename + useTreeLayout heights + unit | 2 arquivos coesos (camada pura de layout) + teste | ✅ Granular |
| T2: hook useMeasuredHeights + reducer puro | 1 hook novo + seu teste de reducer | ✅ Granular |
| T3: fiação medição→layout no canvas | 1 arquivo (MapCanvas) | ✅ Granular |
| T4: CSS do título do card | 1 arquivo (MindNode) | ✅ Granular |
| T5: smoke + gates | verificação (sem deliverable de código) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 (início, [P]) | ✅ Match |
| T2 | None | Phase 1 (início, [P]) | ✅ Match |
| T3 | T1, T2 | T1,T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |

T1 e T2 são `[P]` e não dependem um do outro (arquivos disjuntos) → paralelismo válido.

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Lógica pura de layout (`computeTreeLayout`/`nodeSizeFromHeights`) | unit | unit | ✅ OK |
| T2 | Lógica pura (`nextHeights`) + wiring DOM do observer | unit (p/ a parte pura) | unit | ✅ OK¹ |
| T3 | Integração DOM (fiação do canvas) | none (DOM/timing, AD-007) → e2e+smoke em T5 | none | ✅ OK² |
| T4 | Render visual/CSS do card | none (visual) → smoke em T5 | none | ✅ OK² |
| T5 | — (verificação; roda e2e existente + smoke) | e2e + smoke | e2e | ✅ OK |

¹ A parte testável por unit de T2 (o reducer `nextHeights`, crítico para a terminação do loop) é coberta na própria task; o wiring do `ResizeObserver` não é unit-testável de forma barata (DOM/timing, AD-007) e cai no smoke de T5 — **não é deferral** (não há lógica pura adicional a testar em T2).
² T3/T4 não introduzem lógica pura nova (fiação/CSS); a cobertura é a suíte e2e existente + o smoke visual obrigatório, executados no gate full de T5. Consistente com o precedente de M8 (T2 render visual → coberto em T3).

---

## Notas pós-execução (fora do diff de código, para o chat de execução/review)

- Atualizar `ROADMAP.md`/`STATE.md`: **M12 reduziu escopo** para wrap+altura dinâmica; o **resize horizontal virou milestone próprio** com decisões já fixadas (largura `width Int?` **persistida**, espírito AD-002; **alça de resize revelada no hover**). Confirmar a numeração do novo milestone com o usuário.
- **Review AD-013** em chat separado antes de marcar "concluído" ([[feedback-plan-execute-split]]).
