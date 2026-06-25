# M9 — Drag-to-place unificado: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md) (Approved 2026-06-25)
**Status:** Draft

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — idioma (pt-BR em conversa/commits/docs; **código/identificadores em inglês**) e formato de commits (`tipo(escopo): descrição`, escopo = `m9` para feature; `api`/`web` se preferir área).
- `.specs/project/STATE.md` — decisões. Relevantes: **AD-002** (sem `x/y` persistido — M9 persiste só 1 bit de **lado**, estrutural, mantendo o espírito), **AD-008** (renumeração transacional + anti-ciclo do `move` — **núcleo a preservar**), **AD-011** (`move` aceita `index`), **AD-013** (review pós-execute obrigatório), **AD-014** (e2e Playwright por user story P1), **AD-015/AD-016** (canvas visx + layout bidirecional). **AD-018** ainda **não está formalizada** — é a T11.
- `.specs/features/m9-drag-to-place/spec.md` — requisitos `M9-NN` e a seção "Notas para Design".
- `.specs/features/m9-drag-to-place/design.md` — arquitetura, modelo de dados, e o **mapeamento de índice** (slot visual → índice global). **Leitura obrigatória antes da T7.**
- Este arquivo.

**Decisão-chave herdada do design (não reabrir):** `sortOrder` dos filhos da raiz é **global**; `side` é coluna **independente** (`LEFT`/`RIGHT`), significativa só quando `parentId === root`. O `move` mantém renumeração **global** — só passa a gravar/limpar `side`. A conversão "slot visual de um lado → índice global" vive no frontend (`lib/slots.ts`, função pura).

**Princípios não-negociáveis:**

- TypeScript strict; sem `any` implícito.
- Commits atômicos, **um por task**, em **português**, Conventional Commits: `feat(m9): T<N> <descrição>` (`test(m9):` se só teste; `docs(m9):` para a T11).
- Identificadores/código em **inglês**; commits/comentários/docs em **português**.
- **Reusar antes de criar** (`.claude/rules/frontend-structure.md`). Componentes de página em `pages/<pagina>/components/`.
- **AD-002 no essencial:** nenhum `x/y` no banco. O único dado de layout novo é `side` (1 bit).
- **Não tocar** o núcleo de renumeração/anti-ciclo do `move` (AD-008) — só **adicionar** o tratamento de `side`.

**Estado atual — o que existe e o que muda:**

- `packages/api/prisma/schema.prisma` — `model Node` sem `side`. **Muda (T1).** Só existe a migration `20260517231305_init`; M9 adiciona a 2ª.
- `packages/api/src/routes/nodes.ts` — `create` (linha ~10) e `move` (linha ~91). **Mudam (T3, T4).** O `move` já faz clamp de index, anti-ciclo (`WITH RECURSIVE`) e renumeração transacional — **reusar, não reescrever.**
- `packages/api/src/mappers/nodes.ts` — `toNodeDto`. **Muda (T3).**
- `packages/api/src/routes/nodes.test.ts` — DB **compartilhado** (`prisma.node.deleteMany()` em `beforeAll`/`beforeEach`). Por isso **tasks de API não rodam em paralelo entre si** (clobber de DB). **Muda (T3, T4, T5).**
- `packages/shared/src/node.ts` — `NodeDto`, `MoveNodeBody`. **Mudam (T2).** Tipos puros, sem teste.
- `packages/web/src/lib/useTreeLayout.ts` — `computeTreeLayout` faz split por **peso** (`splitChildren`). **Muda (T6):** passa a ler `side`. A lógica de peso é **portada para o backend** (T3/T5), não duplicada.
- `packages/web/src/lib/useTreeLayout.test.ts` — tem o teste vacuoso de não-sobreposição (`:165-189`, ver CONCERNS.md). **Corrigir na T6** (≥2 filhos no mesmo lado).
- `packages/web/src/pages/map/components/useNodeDrag.ts` (+ `.test.ts`) — `findDropTarget` (hit-test binário on-node) + limiar de drag/clique + pointer capture. **Generalizar (T7/T8).**
- `packages/web/src/pages/map/components/MapCanvas.tsx` — `handleReparent` manda `index: MAX_SAFE_INTEGER` (append). **Muda (T9):** vira `handlePlace(slot)`; renderiza card-fantasma.
- `packages/web/src/api/nodes.ts` — `useMoveNode` optimistic só faz **append**. **Muda (T9):** refletir `index` real + `side`.

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Prisma schema/migration | none (verificado por `prisma generate` + typecheck) | quick (api) | No (DB) |
| Shared DTO (tipos puros) | none | quick (typecheck) | Yes |
| API endpoints (`create`/`move`) + mapper | integração (Vitest + DB) | quick (api) → full | **No** (DB compartilhado) |
| `backfillSides` util | integração (Vitest + DB) | quick (api) | **No** (DB compartilhado) |
| Lógica pura de layout/slots | unit (Vitest web) | quick (web) | Yes |
| `useNodeDrag` (hook, lógica) | unit (Vitest web) | quick (web) | Yes |
| Card-fantasma/MapCanvas/optimistic (UI visual) | e2e (T10) | full | No |
| Interação drag (reorder/reparent/lado + reload) | e2e | full | No |

**Comandos de gate:**

- quick (web): `cd packages/web && pnpm typecheck && pnpm test`
- quick (api): `cd packages/api && pnpm typecheck && pnpm test`
- full: `pnpm typecheck && pnpm lint && pnpm test` (root) **+** `cd packages/web && pnpm test:e2e`
- migration: `cd packages/api && pnpm exec prisma migrate dev --name add_node_side` (gera migration + aplica no DB de dev + `prisma generate`). O **DB de teste da API e o DB de e2e precisam da migration aplicada** antes de rodar os gates respectivos.

**Tools por task:** MCP: NONE em todas. Skills atribuídas por task (ver "Skills Aplicáveis" da spec). Verificar API de libs (Prisma, d3-flextree, visx) na mão antes de fixar — **não assumir** (Knowledge Verification Chain).

---

## Execution Plan

Dois tracks correm **em paralelo** após a fundação, convergindo na integração. O track de backend é **interno-sequencial** (DB de teste compartilhado).

```
Fase 1 — Fundação:
  T1 (schema+migration) ─┐
  T2 (shared DTO) [P] ───┘  (T1 e T2 independentes)

Fase 2 — dois tracks em paralelo (ambos após T1+T2):

  Backend track (sequencial — DB de teste compartilhado):
    T3 (create + mapper) ──→ T4 (move + side) ──→ T5 (backfillSides)

  Frontend track:
    T6 (layout lê side) [P] ─┐
    T7 (lib/slots.ts)  [P] ──┴─→ T8 (useNodeDrag) ──→ T9 (card-fantasma + wiring + optimistic)
        (T8 depende de T7; T6 e T7 são paralelos)

Fase 3 — Integração:
    {T4, T5, T9} ──→ T10 (e2e + gate full) ──→ T11 (formaliza AD-018 + STATE)
```

---

## Task Breakdown

### T1: Schema — enum `Side` + coluna `side` + migration

**What:** Adicionar `enum Side { LEFT RIGHT }` e `side Side? @map("side")` em `model Node`; gerar e aplicar a migration.
**Where:** `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/<nova>/`
**Depends on:** None
**Reuses:** Padrão do enum existente `NodeStatus`; convenção `@map` (snake_case) dos demais campos.
**Requirement:** M9-01

**Tools:** MCP: NONE · Skill: `api-backend`

**Done when:**

- [ ] `enum Side` + coluna `side Side?` (nullable, sem default no banco) no schema.
- [ ] Migration criada e aplicada no DB de dev: `cd packages/api && pnpm exec prisma migrate dev --name add_node_side`.
- [ ] `prisma generate` rodou; o tipo `Node` do client expõe `side: Side | null`.
- [ ] Gate quick passa: `cd packages/api && pnpm typecheck && pnpm test` (suíte atual segue verde — 42 testes API baseline).
- [ ] Test count: 42 testes API verdes (sem deleção silenciosa).

**Tests:** none · **Gate:** quick (api)
**Verify:** `pnpm exec prisma migrate status` → up to date; coluna `side` existe na tabela `Node`.
**Commit:** `feat(m9): T1 schema do lado (enum Side + coluna side + migration)`

---

### T2: Shared DTO — `side` em `NodeDto` e `MoveNodeBody` [P]

**What:** Adicionar `side: 'LEFT' | 'RIGHT' | null` em `NodeDto` e `side?: 'LEFT' | 'RIGHT'` em `MoveNodeBody`. `CreateNodeBody` **não muda** (lado é server-side).
**Where:** `packages/shared/src/node.ts`
**Depends on:** None
**Reuses:** União de strings literais já usada em `status`.
**Requirement:** M9-01 (contrato), suporte a M9-09/M9-22

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] `NodeDto.side` e `MoveNodeBody.side?` definidos com os literais corretos.
- [ ] Gate quick passa: `pnpm typecheck` (root) — sem erros nos consumidores existentes (o campo é aditivo).

**Tests:** none (tipos puros) · **Gate:** quick (typecheck)
**Verify:** `pnpm -r typecheck` verde.
**Commit:** `feat(m9): T2 side em NodeDto e MoveNodeBody`

---

### T3: `create` atribui lado default + mapper expõe `side`

**What:** Em `toNodeDto`, mapear `side`. No `create`: se o pai é a raiz (pai sem `parentId`), calcular o lado default pela heurística de balance — lado de **menor peso** entre os filhos atuais da raiz, respeitando os `side` já gravados; empate → `RIGHT` — e gravar; senão `side = null`. Heurística de peso portada de `splitChildren` (contagem de nós/subárvore).
**Where:** `packages/api/src/routes/nodes.ts` (handler `create`), `packages/api/src/mappers/nodes.ts`, `packages/api/src/routes/nodes.test.ts`
**Depends on:** T1, T2
**Reuses:** Transação + `aggregate` de `sortOrder` do `create` atual; lógica de peso de `splitChildren` (`useTreeLayout.ts:45-79`) portada para TS no backend.
**Requirement:** M9-02, M9-23, M9-22 (parte create)

**Tools:** MCP: NONE · Skill: `api-backend`

**Done when:**

- [ ] `toNodeDto` retorna `side`.
- [ ] Filho direto da raiz criado recebe `side` = lado mais leve (empate → `RIGHT`), respeitando os lados já existentes.
- [ ] Filho de nó **profundo** criado recebe `side = null`.
- [ ] API tests novos cobrem: default de lado no 1º nível; alternância conforme peso; `side null` em profundo.
- [ ] Gate quick passa: `cd packages/api && pnpm typecheck && pnpm test`.
- [ ] Test count: 42 + novos, todos verdes.

**Tests:** integration (API) · **Gate:** quick (api)
**Verify:** `cd packages/api && pnpm test nodes` → casos de side no create verdes.
**Commit:** `feat(m9): T3 create atribui lado default por balance + mapper`

---

### T4: `move` grava/limpa `side` (renumeração global intacta)

**What:** Estender o body do `move` com `side?`. No handler: quando o destino é a raiz, gravar `node.side = side` (default `RIGHT` se ausente, salvaguarda); quando o destino **não** é a raiz, gravar `node.side = null`. **Não alterar** o anti-ciclo nem a renumeração global de `sortOrder`.
**Where:** `packages/api/src/routes/nodes.ts` (handler `move`), `packages/api/src/routes/nodes.test.ts`
**Depends on:** T3
**Reuses:** Todo o corpo atual do `move` (AD-008): clamp de index, `WITH RECURSIVE` anti-ciclo, renumeração transacional, `toNodeDto` (já com `side` da T3).
**Requirement:** M9-07, M9-08, M9-09, M9-10, M9-11 (400 self/descendente), M9-22 (parte move)

**Tools:** MCP: NONE · Skill: `api-backend`

**Done when:**

- [ ] Body aceita `side?: 'LEFT' | 'RIGHT'`.
- [ ] Move para a raiz grava o `side` informado; move para pai profundo zera `side` (`null`).
- [ ] Reorder por `index` sob o mesmo pai segue funcionando (sortOrder global renumerado) — comportamento atual preservado.
- [ ] Move para si/descendente segue retornando 400 (anti-ciclo intacto).
- [ ] API tests novos: set de lado ao mover para raiz; limpeza de lado ao virar profundo; reorder via index inalterado.
- [ ] Gate quick passa: `cd packages/api && pnpm typecheck && pnpm test`.

**Tests:** integration (API) · **Gate:** quick (api)
**Verify:** `cd packages/api && pnpm test nodes` → casos de side no move verdes; casos de move pré-existentes seguem verdes.
**Commit:** `feat(m9): T4 move grava e limpa o lado`

---

### T5: `backfillSides(mapId)` util + script de migração de dados

**What:** Função `backfillSides(mapId)` que popula `side` dos filhos de 1º nível de mapas existentes replicando o split por **peso** atual (mesma heurística do M8), idempotente (só onde `side IS NULL` em filho da raiz). Expor via script one-off executável.
**Where:** `packages/api/src/` (util novo, ex. `services/backfill-sides.ts`), script em `packages/api/` (ex. `scripts/backfill-sides.ts`), teste em `packages/api/src/`
**Depends on:** T1, T2 (executa após T4 no track de backend por compartilhar DB de teste)
**Reuses:** Lógica de `splitChildren`/`subtreeSize` (a mesma portada na T3 — extrair p/ módulo compartilhável no backend e reusar nas duas).
**Requirement:** M9-01 (dados existentes), suporte a M9-03 em mapas legados

**Tools:** MCP: NONE · Skill: `api-backend`

**Done when:**

- [ ] `backfillSides(mapId)` grava `side` em todos os filhos diretos da raiz conforme o split por peso; profundos/raiz ficam `null`.
- [ ] Idempotente: rodar 2x não altera o resultado nem sobrescreve lados já definidos.
- [ ] Script executável documentado (como rodar) no topo do arquivo.
- [ ] Test (Vitest + DB): mapa seedado sem `side` → após backfill, lados batem com o split por peso; 2ª execução é no-op.
- [ ] Gate quick passa: `cd packages/api && pnpm typecheck && pnpm test`.

**Tests:** integration (API) · **Gate:** quick (api)
**Verify:** `cd packages/api && pnpm test backfill` → verde.
**Commit:** `feat(m9): T5 backfill de lado para mapas existentes`

---

### T6: `computeTreeLayout` lê `side` persistido (split por peso sai do layout) [P]

**What:** Trocar a fonte do split em `computeTreeLayout`: em vez de `splitChildren` por peso, repartir os filhos de 1º nível por `side` persistido — `right = filter(side === 'RIGHT')`, `left = filter(side === 'LEFT')`, cada um já em ordem de `sortOrder`. Fallback defensivo: filho de 1º nível com `side` nulo → tratar como `RIGHT` (não persiste). Geometria bilateral, edges e `bounds` **inalterados**. Remover `splitChildren` do layout. Corrigir o teste vacuoso de não-sobreposição (CONCERNS.md) usando ≥2 filhos no mesmo lado.
**Where:** `packages/web/src/lib/useTreeLayout.ts`, `packages/web/src/lib/useTreeLayout.test.ts`
**Depends on:** T2
**Reuses:** Toda a geometria de `layoutSide` (flextree horizontal, espelhamento, ancoragem no centro da raiz, `bounds`); `nodeSize.ts`; tipos de `tree.ts`.
**Requirement:** M9-03, M9-04, M9-05, M9-06, M9-19

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] Split lê `side` (não peso); `NodeDto.side` consumido via `TreeNode.node.side`.
- [ ] Todos os filhos com o mesmo `side` → todos do mesmo lado, sem forçar equilíbrio (M9-04).
- [ ] Nó profundo herda o lado do ancestral de 1º nível (vive no grupo do seu ancestral — sem lado próprio) (M9-05).
- [ ] Só-raiz → 1 nó centrado, sem lados/edges (M9-06).
- [ ] `bounds` bilaterais corretos para o `fitView` (M9-19).
- [ ] Teste vacuoso de não-sobreposição corrigido: ≥2 filhos no mesmo lado, asserção real de não-overlap de alturas variáveis.
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`.
- [ ] Test count: testes de layout verdes (nº sobe vs. baseline; o teste vacuoso agora assere de fato).

**Tests:** unit (Vitest web) · **Gate:** quick (web)
**Verify:** `cd packages/web && pnpm test useTreeLayout` → asserções "todos de um lado", herança de lado, e não-overlap com ≥2 mesmo lado.
**Commit:** `feat(m9): T6 layout lê o lado persistido`

---

### T7: `lib/slots.ts` — enumeração de slots, nearest e mapeamento de índice [P]

**What:** Módulo puro com: `computeSlots(tree, positioned)` → `Slot[]` (slots entre/around filhos de cada pai visível; para a raiz, dos **dois lados**, incl. slot de lado vazio); `nearestSlot(point, slots, { excludeSubtree })` (menor distância determinística, exclui slots cujo pai está na subárvore do arrastado); `slotToMoveBody(slot, rootChildrenOrdered, draggedId)` → `{ parentId, index, side? }` aplicando o **mapeamento de índice** do design (slot visual de um lado → índice global). `Slot = { parentId; index; side: 'LEFT'|'RIGHT'|null; x; y; height }`.
**Where:** `packages/web/src/lib/slots.ts` (novo), `packages/web/src/lib/slots.test.ts` (novo)
**Depends on:** T2
**Reuses:** `PositionedNode`/tipos de `useTreeLayout.ts`; a ideia de hit-test de `findDropTarget` (generalizada); `NODE_WIDTH`/`nodeHeight`.
**Requirement:** M9-07, M9-08, M9-09, M9-10 (no-op detectável), M9-11 (exclui subárvore), M9-16

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] `computeSlots` gera slots corretos para pais profundos (index direto) e para a raiz (dois lados + lado vazio).
- [ ] `nearestSlot` é determinístico em empates e **nunca** oferece slot dentro da subárvore do arrastado nem o próprio (M9-11/M9-16).
- [ ] `slotToMoveBody` aplica o mapeamento de índice do design (casos `j<m`, `j==m`, lado vazio) e omite `side` para pais não-raiz.
- [ ] Unit tests cobrem: proximidade determinística; exclusão de auto/descendente; lado vazio; cada ramo do mapeamento de índice; no-op (slot == origem).
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`.

**Tests:** unit (Vitest web) · **Gate:** quick (web)
**Verify:** `cd packages/web && pnpm test slots` → todos os casos verdes.
**Commit:** `feat(m9): T7 cálculo de slots e mapeamento de índice`

---

### T8: `useNodeDrag` — slot-alvo durante o arraste + `onPlace`

**What:** Estender `useNodeDrag` para, no `pointermove`, calcular o slot-alvo via `slots.ts` e expô-lo (`targetSlot`); no `pointerup`, chamar `onPlace(draggedId, slot)` quando houver slot ≠ origem, no-op quando slot == origem, e `onInvalidDrop` quando não houver slot. Preservar limiar drag/clique, raiz não-arrastável e pointer capture. Substituir `onReparent` por `onPlace`.
**Where:** `packages/web/src/pages/map/components/useNodeDrag.ts`, `packages/web/src/pages/map/components/useNodeDrag.test.ts`
**Depends on:** T7
**Reuses:** Toda a máquina atual de `useNodeDrag` (limiar `DRAG_THRESHOLD`, `setPointerCapture`, `ghostOffset`); `nearestSlot`/`computeSlots` da T7; `clientToWorld`.
**Requirement:** M9-10 (no-op), M9-12 (limiar), M9-13 (raiz), M9-16 (sem slot → snap-back), M9-17 (slot escolhido = resultado)

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] `targetSlot` exposto e atualizado em tempo real durante o move.
- [ ] `onPlace(draggedId, slot)` chamado no drop com slot válido ≠ origem; no-op se == origem; `onInvalidDrop` se sem slot.
- [ ] Limiar clique vs. drag preservado (clique abaixo do limiar não dispara place); raiz não arrasta.
- [ ] `useNodeDrag.test.ts` atualizado: place em slot, no-op na origem, snap-back sem slot, limiar, raiz.
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`.

**Tests:** unit (Vitest web) · **Gate:** quick (web)
**Verify:** `cd packages/web && pnpm test useNodeDrag` → verde.
**Commit:** `feat(m9): T8 drag rastreia o slot-alvo e dispara onPlace`

---

### T9: Card-fantasma + fiação no `MapCanvas` + optimistic com índice/lado

**What:** Renderizar o **card-fantasma** (placeholder tracejado tamanho do card, `pointer-events:none`) na posição do `targetSlot`, na mesma matriz de zoom dos nós HTML. Fiar `MapCanvas`: passar `tree`/`positioned`/`rootId` ao `useNodeDrag`; `handleReparent` → `handlePlace(draggedId, slot)` chamando `moveNode({ id, mapId, body: slotToMoveBody(...) })`. Ajustar o optimistic de `useMoveNode` para refletir o `index` real (reinserção na posição) e o `side`.
**Where:** `packages/web/src/pages/map/components/MapCanvas.tsx`, `packages/web/src/api/nodes.ts` (`useMoveNode`)
**Depends on:** T6, T7, T8
**Reuses:** Camada de nós HTML transformada (matriz de zoom); `useMoveNode` (estrutura optimistic/rollback/toast existente); `slotToMoveBody` da T7.
**Requirement:** M9-14, M9-15, M9-17, M9-18 (paridade da fiação), suporte a M9-07/08/09

**Tools:** MCP: NONE · Skill: `mindmap-canvas`, `web-api-integration` (optimistic), `web-component-creation` (se o fantasma virar componente próprio)

**Done when:**

- [ ] Card-fantasma aparece no slot-alvo durante o arraste e some ao soltar; sem slot → sem fantasma.
- [ ] O nó assume exatamente o slot que o fantasma indicou (consistência — M9-17).
- [ ] `handlePlace` dispara uma única `move` com `{ parentId, index, side? }`; no-op não dispara mutação.
- [ ] Optimistic reflete `index` + `side` (sem "pulo" antes do refetch); rollback/toast preservados.
- [ ] Paridade: edição inline, collapse, add/delete, dialog, indicadores seguem funcionando.
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`.

**Tests:** none (UI visual — coberta pelos e2e da T10) · **Gate:** quick (web)
**Verify:** rodar a app: arrastar entre irmãos (reorder), para outro pai numa posição do meio (reparent posicionado), para o outro lado da raiz (troca de lado) — o fantasma acompanha e o resultado bate.
**Commit:** `feat(m9): T9 card-fantasma, fiação do place e optimistic com índice/lado`

---

### T10: e2e (reorder / reparent posicionado / troca de lado + reload) + gate full

**What:** Specs Playwright cobrindo as user stories P1: reorder sob o mesmo pai; reparent numa posição do meio sob outro pai; troca de lado de um ramo de 1º nível com persistência após reload. Aplicar a migration no DB de e2e. Rodar a tríade + e2e completos.
**Where:** `packages/web/e2e/` (specs novos), garantir migration aplicada no DB de e2e
**Depends on:** T4, T5, T9
**Reuses:** Infra Playwright existente; **padrão M6 de isolamento** (criar nós próprios via API com títulos únicos, limpar no `afterEach`, localizar por `data-testid`/`data-node-id` — **não** por ordem no DOM, ver CONCERNS.md).
**Requirement:** M9-18, M9-20, M9-21, M9-22 (validação integrada)

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] e2e: reorder entre irmãos altera a ordem e persiste após reload.
- [ ] e2e: reparent posicionado coloca o nó no índice indicado sob o novo pai.
- [ ] e2e: arrastar ramo de 1º nível para o outro lado → muda de lado e **persiste** após reload (inclusive deixar tudo de um lado).
- [ ] Specs e2e pré-existentes seguem verdes (sem regressão de paridade).
- [ ] Gate full passa: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`.
- [ ] Test count: e2e baseline (22) + novos, todos verdes (`persistence.spec.ts:136` é flaky histórico — ver L-004/L-005, não atribuir a M9).

**Tests:** e2e · **Gate:** full
**Verify:** `cd packages/web && pnpm test:e2e` → suíte verde incl. os novos casos.
**Commit:** `test(m9): T10 e2e de drag-to-place e persistência de lado`

---

### T11: Formalizar AD-018 + atualizar STATE.md/traceabilidade

**What:** Escrever o bloco **AD-018** em `STATE.md` (Recent Decisions, formato `Decision/Reason/Trade-off/Impact` com o schema/migração/endpoint já concretos do design); anotar a revisão de **AD-016** (balance → heurística de criação) e a revisão parcial de **AD-002** (1 bit de lado, sem `x/y`); atualizar `Current Work`, e marcar os requisitos `M9-NN` como `Done` na tabela de traceabilidade da spec.
**Where:** `.specs/project/STATE.md`, `.specs/features/m9-drag-to-place/spec.md` (coluna Status), este `tasks.md` (resultado da execução)
**Depends on:** T10
**Reuses:** Formato dos blocos AD-016/AD-017 existentes.
**Requirement:** AD-018 (Success Criteria da spec), workflow do CLAUDE.md (atualizar STATE.md ao concluir milestone)

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] Bloco AD-018 escrito (Decision/Reason/Trade-off/Impact) com cross-refs a AD-016 e AD-002.
- [ ] AD-016 e AD-002 anotadas com a revisão.
- [ ] `Current Work` do STATE.md reflete M9 concluído.
- [ ] Tabela de traceabilidade da spec com `M9-NN` em `Done`.

**Tests:** none (doc) · **Gate:** none
**Verify:** revisão visual do STATE.md e da spec.
**Commit:** `docs(m9): T11 formaliza AD-018 e atualiza STATE`

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | schema + migration (1 arquivo + migration) | ✅ Granular |
| T2 | 1 arquivo de tipos | ✅ Granular |
| T3 | 1 endpoint + mapper (coesos: create precisa do mapper) | ✅ Granular |
| T4 | 1 endpoint | ✅ Granular |
| T5 | 1 util + script (coesos) | ✅ Granular |
| T6 | 1 função pura + seus testes | ✅ Granular |
| T7 | 1 módulo puro novo + testes | ✅ Granular |
| T8 | 1 hook | ✅ Granular |
| T9 | fiação UI (MapCanvas + optimistic) — 2 arquivos coesos do mesmo gesto | ✅ Granular |
| T10 | specs e2e (verificação integrada) | ✅ Granular |
| T11 | docs/state | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | (início) | ✅ Match |
| T2 | None | (início, [P] com T1) | ✅ Match |
| T3 | T1, T2 | T1→T3, T2→T3 | ✅ Match |
| T4 | T3 | T3→T4 | ✅ Match |
| T5 | T1, T2 | T1→T5, T2→T5 (serializado após T4 no track) | ✅ Match¹ |
| T6 | T2 | T2→T6 ([P] com T7) | ✅ Match |
| T7 | T2 | T2→T7 ([P] com T6) | ✅ Match |
| T8 | T7 | T7→T8 | ✅ Match |
| T9 | T6, T7, T8 | T6→T9, T7→T9, T8→T9 | ✅ Match |
| T10 | T4, T5, T9 | {T4,T5,T9}→T10 | ✅ Match |
| T11 | T10 | T10→T11 | ✅ Match |

¹ T5 depende de código só de T1/T2; roda **após T4** no track de backend por compartilhar o DB de teste (serialização de execução, não dependência de código).

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Prisma schema/migration | none | none | ✅ OK |
| T2 | Shared DTO (tipos puros) | none | none | ✅ OK |
| T3 | API endpoint + mapper | integração (API) | integration | ✅ OK |
| T4 | API endpoint | integração (API) | integration | ✅ OK |
| T5 | util backend + DB | integração (API) | integration | ✅ OK |
| T6 | Lógica pura de layout | unit | unit | ✅ OK |
| T7 | Lógica pura de slots | unit | unit | ✅ OK |
| T8 | Hook (lógica) | unit | unit | ✅ OK |
| T9 | UI visual (card-fantasma/MapCanvas/optimistic) | e2e (T10) | none | ✅ OK² |
| T10 | Interação drag (integrada) | e2e | e2e | ✅ OK |
| T11 | docs/state | none | none | ✅ OK |

² T9 é render/fiação visual sem lógica pura nova testável por unit (o cálculo testável vive em T6/T7, o comportamento do gesto em T8); a cobertura é a suíte e2e da T10, executada no gate full. Não é deferral de teste novo — não há unidade pura introduzida em T9.

---

## Parallel Execution Map

```
Fase 1 (Fundação):
  T1 ─┐
  T2 ─┘ [P]  (independentes)

Fase 2 (dois tracks em paralelo):
  Backend (sequencial — DB de teste compartilhado, sem [P] interno):
    T3 → T4 → T5
  Frontend:
    T6 [P] ─┐
    T7 [P] ─┴→ T8 → T9

Fase 3 (Integração, sequencial):
  {T4, T5, T9} → T10 → T11
```

**Constraint de paralelismo:** API tests (T3/T4/T5) compartilham o DB de teste (`deleteMany` global) → **nunca** rodar em paralelo entre si. e2e (T10) não é parallel-safe. Tasks web puras (T6/T7) são parallel-safe (Vitest, sem DB). Os dois tracks (backend/frontend) só compartilham o DTO (T2), já pronto na fundação → correm em paralelo.
</content>
