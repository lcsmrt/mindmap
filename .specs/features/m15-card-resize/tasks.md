# M15 — Resize horizontal do card: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Draft

---

## Contexto para o Executor

Auto-suficiente para um agente sem memória da conversa de planejamento. Ler primeiro, nesta ordem:

- `CLAUDE.md` (raiz) — idioma (pt-BR em conversa/commits/docs; código/identificadores em **inglês**), commits `tipo(escopo): descrição` (escopo = `m15`), **não escrever comentários** (exceto o *porquê* não-óbvio, ≤1 linha).
- `.specs/project/STATE.md` — decisões. Relevantes: **AD-002** (posições x/y NÃO são persistidas — M15 a revisa **parcialmente**: persiste `width`, 1 dado estrutural, **sem x/y livre**, mesmo precedente do `side`/M9-**AD-018**; registrar **AD-023**), **AD-015** (stack canvas = visx + d3-flextree), **AD-021** (`slots.ts` seleção por band vertical — **não regredir**), **AD-013** (review pós-execute obrigatório, chat separado), **AD-014** (smoke de UI). **Nota:** o **L-007** (risco de Playwright rodar contra o banco de prod) **não se aplica mais** — ver "Ambiente" nos gates.
- `.specs/features/m15-card-resize/spec.md` — requisitos `M15-NN`.
- `.specs/features/m15-card-resize/design.md` — arquitetura, **Invariante de convergência**, riscos, Tech Decisions.
- `.specs/features/m12-card-responsive/{spec,design,tasks}.md` — base do pipeline medir→layout que M15 estende.
- Este arquivo.

**Princípios não-negociáveis:**

- TypeScript strict; sem `any` implícito.
- Commits atômicos, um por task, **português**, Conventional Commits: `feat(m15): T<N> <descrição>` (`test(m15):`/`fix(m15):` quando couber).
- **Reusar antes de criar** (`.claude/rules/frontend-structure.md`); componentes/hooks de página em `pages/<pagina>/components/`.
- **Escopo:** largura por nó controlada por arraste + persistida (`width Int?`). **Sem** resize vertical, **sem** reset ao default, **sem** x/y livre, **sem** alinhar colunas por profundidade (colunas **por nó**, decisão do usuário 2026-06-27). Altura segue derivada (M12). A seleção de slot por band vertical (M13/AD-021) fica **intacta** — M15 toca só o **eixo X** de `slots.ts`.

**Decisões já fixadas (não reabrir):** alça revelada no hover (borda direita); largura persistida (`width Int?`); colunas por nó; teto = largura do texto numa linha (sem espaço em branco à direita); piso mínimo sã; **sem reset**; render aplica `width` gravada verbatim (sem auto-clamp). Ver `design.md` → Tech Decisions.

**Verificar antes de fixar (Knowledge Verification Chain — não assumir):** (a) semântica de `n.y` no `d3-flextree` com profundidade **variável por nó** (T3); (b) mecanismo robusto de medição do **teto de conteúdo** (largura numa linha) — probe `max-content`/`nowrap` vs `canvas.measureText` (T5). Consultar Context7/MDN.

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Lógica pura web (`nodeWidth`, `computeTreeLayout`, `slots.ts`, `clampWidth`) | unit (Vitest) | `cd packages/web && pnpm typecheck && pnpm test` | Yes |
| Mapper/contrato API (`toNodeDto`) | unit (Vitest) | `cd packages/api && pnpm test` | Yes |
| Endpoint API (`PATCH /:id` width) | integration (Vitest, banco dev) | `cd packages/api && pnpm test` | No (DB) |
| Migration Prisma | none (aplicação) → coberta por integração | — | No (DB) |
| Gesto/medição DOM (alça, teto, screen→world) | none unit (DOM/timing, AD-007) → **e2e + smoke visual obrigatório** (gate L-005) | `cd packages/web && pnpm test:e2e` | No |
| Helper puro do clamp (`clampWidth`) | unit (Vitest) | web quick | Yes |

**Comandos de gate:**

- **quick (web):** `cd packages/web && pnpm typecheck && pnpm test`
- **quick (api):** `cd packages/api && pnpm test` (única `.env` → banco **dev**; integração + e2e rodam contra o dev, descartável)
- **migration:** `cd packages/api && pnpm prisma migrate dev --name add_node_width` (gera + aplica no único banco dev)
- **full:** `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`
- ℹ️ **Ambiente (correção do usuário, 2026-06-27):** há **uma só** `.env`, apontando pro banco **dev**; `.env.test` foi removida. Tudo local (vitest API + Playwright) conecta no **dev**, nunca em prod (prod só roda no servidor, AD-022). O **L-007** — risco de Playwright tocar prod — **não se aplica mais**. Integração/e2e mutam o dev (dados descartáveis); pode rodar `pnpm test:e2e` à vontade.

**Skills aplicáveis:** `api-backend` (T1/T2 — schema/migration/route/mapper/testes API), `mindmap-canvas` (T3/T4/T5 — layout d3-flextree, slots, nós, viewport/zoom), `web-component-creation` (T5 — alça no `MindNode`), `web-api-integration` (T5 — `UpdateNodeBody`/mutation). Sem MCPs necessários.

---

## Execution Plan

```
Phase 1 (fundação):    T1  (data model: schema+migration+shared+mapper)

Phase 2 (paralelo):    T1 ─┬─→ T2 [P]  (PATCH /:id aceita width + integração)
                           └─→ T3 [P]  (largura por nó no layout + unit)

Phase 3 (sequencial):  T3 ──→ T4  (slots.ts: colX/colWidth por largura real + unit)
                       T2,T4 ──→ T5  (alça de resize + estado + persistência)
                       T5 ──→ T6  (smoke visual + e2e + gates + AD-023)
```

T2 (backend) e T3 (frontend layout) tocam pacotes disjuntos (`api` vs `web`) e só dependem de T1 → paralelos. T4 depende de T3 (usa `PositionedNode.width`). T5 amarra back (T2) + layout (T3/T4). T6 valida o conjunto.

---

## Task Breakdown

### T1: data model — coluna `width`, contrato e mapper

**What:** Adicionar `width Int? @map("width")` ao `Node` (`schema.prisma`) e gerar a migration aditiva (`add_node_width`, `ALTER TABLE "Node" ADD COLUMN "width" INTEGER`, nullable, sem default). Adicionar `width: number | null` a `NodeDto` e `width?: number` a `UpdateNodeBody` (`packages/shared`). Mapear `width: node.width` em `toNodeDto`. Atualizar/ë adicionar unit do mapper.
**Where:** `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/<ts>_add_node_width/`, `packages/shared/src/node.ts`, `packages/api/src/mappers/nodes.ts` (+ teste do mapper se existir suíte)
**Depends on:** None
**Reuses:** precedente da migration `add_node_side`; molde de `toNodeDto`/`NodeDto`/`UpdateNodeBody` (campo `side`).
**Requirement:** M15-19 (migration nullable), M15-20 (DTO/UpdateNodeBody + mapper), M15-10 (nó novo nasce `width=null` — `POST /` não seta width)

**Tools:** MCP: NONE · Skill: `api-backend`

**Done when:**

- [ ] `Node.width Int?` no schema; migration gerada e **aplicada** no banco dev (única `.env`); dados existentes ficam `width = NULL`.
- [ ] `NodeDto.width: number | null` e `UpdateNodeBody.width?: number` em `packages/shared`; `toNodeDto` devolve `width`.
- [ ] `POST /` **não** seta `width` (nó novo = `null`); `/:id/move` intacto.
- [ ] Gate quick (api) passa: `cd packages/api && pnpm test`; typecheck root verde (contrato compartilhado compila no front).
- [ ] Test count: testes api ≥ baseline (56); sem deleção silenciosa.

**Tests:** unit (mapper) · **Gate:** quick (api)

**Verify:** `cd packages/api && pnpm prisma migrate status` (migration aplicada) + `pnpm test` verde; `toNodeDto` de um node com `width=200` devolve `200`, com `null` devolve `null`.

**Commit:** `feat(m15): T1 coluna width no Node + contrato compartilhado e mapper`

---

### T2: `PATCH /nodes/:id` aceita e valida `width` [P]

**What:** Estender o Zod body do `PATCH /:id` com `width: z.number().int().positive().max(WIDTH_MAX).optional()` (`WIDTH_MAX` de sanidade, ex.: 1000 — comentar o *porquê* em ≤1 linha: teto real é do front). Incluir `width` no `data` condicional (`if (width !== undefined) data.width = width`). O `.refine` "ao menos um campo" já cobre `width`. Teste de integração: aceita `width` válida e persiste (read-back via `GET /maps/:id/nodes` ou novo fetch); rejeita inválida (0, negativo, não-inteiro, > max) com 400; demais campos do PATCH intactos.
**Where:** `packages/api/src/routes/nodes.ts` (PATCH `/:id`), `packages/api/test/...` (integração de nodes)
**Depends on:** T1
**Reuses:** molde dos campos opcionais existentes (`bgColor`/`status`/…) no schema + `data`-build; suíte de integração de nodes existente.
**Requirement:** M15-09 (valida/grava inteiro positivo; retorna no DTO), M15-21 (Zod do PATCH; demais campos intactos)

**Tools:** MCP: NONE · Skill: `api-backend`

**Done when:**

- [ ] `PATCH /:id` aceita `{ width }` (int positivo ≤ max), persiste e retorna `NodeDto` com `width`.
- [ ] `width` inválida → 400 (Zod); `PATCH` sem `width` segue funcionando (title/cores/status/etc.).
- [ ] Integração nova: PATCH width → read-back confirma o valor; caso inválido rejeitado.
- [ ] Gate quick (api) passa: `cd packages/api && pnpm test`.
- [ ] Test count: testes api sobem vs. baseline (casos novos); sem deleção silenciosa.

**Tests:** integration · **Gate:** quick (api, banco dev)

**Verify:** `cd packages/api && pnpm test` verde; `PATCH /nodes/:id {width:240}` → 200 + `width:240`; `{width:0}` → 400.

**Commit:** `feat(m15): T2 PATCH /nodes/:id aceita e valida width`

---

### T3: largura por nó no layout (`computeTreeLayout` + `useTreeLayout`) [P]

**What:** Em `nodeSize.ts`: adicionar `export function nodeWidth(node) { return node.width ?? NODE_WIDTH }` e `export const MIN_NODE_WIDTH = 120` (`NODE_WIDTH` permanece como default). Em `computeTreeLayout`: novo 3º param `nodeWidthFn: (node) => number = () => NODE_WIDTH`; usar `nodeWidthFn(n.data.node)` no `flextree.nodeSize` (componente depth = `width + GAP_X`) e substituir **cada** `NODE_WIDTH/2`/`NODE_WIDTH` de posicionamento pela largura **daquele** nó (raiz `-w/2`; `worldX`, `nearX` com `w` do nó; `parentFarX` com `w` do pai; `PositionedNode.width = nodeWidthFn(node)`). Em `useTreeLayout`: novo arg `activeResize?: {id,width}|null`; montar `widthFn = (n) => activeResize?.id===n.id ? activeResize.width : nodeWidth(n)`; deps do `useMemo` += `activeResize`. **Verificar a semântica de `n.y` do flextree com depth variável** antes de fixar os offsets. Unit tests: larguras mistas sem sobreposição; colunas escalonam por nó; `PositionedNode.width` por nó; `nodeWidth` (fallback).
**Where:** `packages/web/src/lib/nodeSize.ts`, `packages/web/src/lib/useTreeLayout.ts`, `packages/web/src/lib/useTreeLayout.test.ts`
**Depends on:** T1 (tipo `NodeDto.width`)
**Reuses:** ponto de injeção `nodeSizeFn` (M12) como molde do `nodeWidthFn`; suíte `useTreeLayout.test.ts` (já injeta `nodeSizeFn` — agora injeta `nodeWidthFn`).
**Requirement:** M15-15 (filhos espaçados pela largura do pai; `PositionedNode.width` por nó), M15-16 (colunas por nó sem sobreposição), M15-05 (`width=null`→180), M15-18 (bounds/fitView/âncoras refletem largura)

**Tools:** MCP: NONE · Skill: `mindmap-canvas` (verificar `d3-flextree` via Context7/docs — não assumir)

**Done when:**

- [ ] `nodeWidth` puro + `MIN_NODE_WIDTH` exportados; `NODE_WIDTH` intacto como default.
- [ ] `computeTreeLayout` aceita `nodeWidthFn` (default = constante → testes atuais seguem verdes sem mudança); `PositionedNode.width` é por nó; offsets usam a largura do nó/pai.
- [ ] `useTreeLayout(nodes, edges, heights?, activeResize?)` monta o `widthFn` com override do rascunho.
- [ ] Unit novo: 2 irmãos de larguras diferentes com filhos → filhos não sobrepõem o pai; colunas escalonam (verifica `n.y`/offset); `bounds` cobre o nó mais largo.
- [ ] Gate quick (web) passa: `cd packages/web && pnpm typecheck && pnpm test`.
- [ ] Test count: web sobe vs. baseline (104); sem deleção silenciosa.

**Tests:** unit · **Gate:** quick (web)

**Verify:** `cd packages/web && pnpm test useTreeLayout` verde, incl. casos de largura mista (sem sobreposição) e `nodeWidth` (medido/persistido vence default).

**Commit:** `feat(m15): T3 largura por nó no layout (flextree depth por width)`

---

### T4: `slots.ts` — geometria do drop por largura real

**What:** Estender `Slot` com `colWidth: number`. Pai/lado **vazio**: `colX = parentPos.x + dir*(parentPos.width + GAP_X)` e `colWidth = parentPos.width` (largura do pai, não `NODE_WIDTH`). Grupo **populado**: `colX = children[0].x`, `colWidth = children[0].width`. Em `nearestSlot`: `colCenter = slot.colX + slot.colWidth/2` (substitui `NODE_WIDTH/2`). **Não alterar** a seleção por band vertical (`bandTop/bandBottom`/`groupTop/groupBottom`/lexicográfica — M13/AD-021). `SLOT_MAX_DISTANCE` pode seguir `NODE_WIDTH*1.5` (limiar fixo). Atualizar `slots.test.ts`: fixtures com `width` por nó; band vertical intacta (não regredir os 23 casos); novos casos de `colX`/`colWidth` por largura.
**Where:** `packages/web/src/lib/slots.ts`, `packages/web/src/lib/slots.test.ts`
**Depends on:** T3 (`PositionedNode.width` por nó)
**Reuses:** toda a lógica M9+M13 de band/lado/índice — **só o eixo X muda**.
**Requirement:** M15-17 (colX/ghost por larguras reais do pai/vizinhos/arrastado)

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] `Slot.colWidth` presente; `colX` de pai vazio usa `parentPos.width`; populado usa `children[0].x/.width`.
- [ ] `nearestSlot` usa `colWidth` no `dx`; **seleção por band vertical inalterada** (23 casos do M13 verdes).
- [ ] Unit novo: pai redimensionado → `colX`/`colWidth` do slot do 1º filho batem com a largura real.
- [ ] Gate quick (web) passa: `cd packages/web && pnpm typecheck && pnpm test`.
- [ ] Test count: web sobe vs. T3; nenhum caso de band do M13 regride.

**Tests:** unit · **Gate:** quick (web)

**Verify:** `cd packages/web && pnpm test slots` verde, incl. `colWidth` por largura e regressão de band do M13.

**Commit:** `feat(m15): T4 slots.ts usa largura por nó no eixo X`

---

### T5: alça de resize + estado de arraste + persistência

**What:** **`clampWidth` (helper puro)** `(startWidth, worldDx, floor, ceiling) => Math.max(floor, Math.min(startWidth+worldDx, Math.max(floor,ceiling)))` + unit (piso/teto/teto<piso). **Medição do teto de conteúdo** (`measureContentWidth`) — verificar mecanismo (probe `max-content`/`nowrap` no `pointerdown`; fallback `canvas.measureText`). **`MindNode`:** `<div data-testid="resize-handle" class="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 ...">` com `onPointerDown` → `e.stopPropagation()` + `setPointerCapture` + `data.onResizeStart(node.id, e)`; novos callbacks em `MindNodeData` (`types.ts`). **`MapCanvasInner`/`CanvasLayers`:** estado `activeResize`; no pointerdown medir teto + `startWidth=nodeWidth(node)` + `startClientX`; no pointermove `worldDx=(clientX-startClientX)/scale` → `clampWidth(...)` → `setActiveResize`; no pointerup `updateNode({id,mapId,body:{width:Math.round(w)}})` + `setActiveResize(null)`; passar `activeResize` ao `useTreeLayout`; o card e os filhos reflowam ao vivo (vêm de `positioned`). Ghost do drop: `width: targetSlot.colWidth` (de T4) em vez de `NODE_WIDTH`. Clique simples na alça (sem mover) → no-op (sem reset).
**Where:** `packages/web/src/pages/map/components/MindNode.tsx`, `MapCanvas.tsx`, `types.ts`, novos `clampWidth.ts`/medição (+ `clampWidth.test.ts`)
**Depends on:** T2 (endpoint width), T3 (layout lê `activeResize`), T4 (ghost/colWidth)
**Reuses:** `useNodeDrag` (padrão pointer-capture + rascunho + persiste no drop), `clientToWorld`/`scale` (`MapCanvas.tsx:69/102`), `useUpdateNode` (optimistic — `width` flui no `{...n,...body}` sem mudança no hook), toolbar hover (`MindNode.tsx:217`), `useMeasuredHeights` como referência de medição.
**Requirement:** M15-01 (alça no hover), M15-02 (arrasta muda largura ao vivo), M15-03 (isola; não dispara drag-to-place), M15-04 (reflui+altura reajusta sem loop), M15-06 (persiste no pointerup), M15-07 (optimistic+rollback), M15-08 (reabrir restaura), M15-11 (teto=conteúdo numa linha), M15-12 (piso), M15-13 (faixa degenerada), M15-14 (width>teto não quebra), M15-24 (raiz redimensionável; clique simples no-op)

**Tools:** MCP: NONE · Skill: `mindmap-canvas`, `web-component-creation`, `web-api-integration` (verificar medição de largura via MDN/Context7 — não assumir)

**Done when:**

- [ ] Hover revela a alça na borda direita (incl. a raiz); fora do hover, oculta.
- [ ] Arrastar a alça muda a largura do card ao vivo (texto reflui; filhos reposicionam); soltar persiste via `PATCH width` (optimistic).
- [ ] Resize **não** dispara drag-to-place (`stopPropagation` + pointer capture); clique simples na alça = no-op.
- [ ] Teto = largura do texto numa linha (sem espaço em branco à direita); piso = `MIN_NODE_WIDTH`; teto<piso degenera no piso.
- [ ] `width=null` → 180; `width` gravada > teto atual renderiza verbatim (sem auto-clamp, sem quebrar layout).
- [ ] `clampWidth` puro + unit (piso/teto/degenerado); ghost usa `colWidth`.
- [ ] Gate quick (web) passa: `cd packages/web && pnpm typecheck && pnpm test`.
- [ ] Test count: web sobe (casos de `clampWidth`); sem deleção silenciosa.

**Tests:** unit (`clampWidth`; o wiring DOM/medição cai no smoke+e2e de T6) · **Gate:** quick (web)

**Verify:** rodar a app (DB de dev); hover → alça aparece; arrastar à direita até o texto virar 1 linha (não passa disso) e à esquerda até o piso; soltar + F5 → largura mantida; arrastar a alça não move o nó de pai.

**Commit:** `feat(m15): T5 alça de resize com largura por nó persistida`

---

### T6: smoke visual + e2e + gates

**What:** Validar o conjunto. **Smoke visual obrigatório** (screenshot Playwright, gate L-005): card redimensionado largo + reflow de texto; card no piso; alça aparece no hover; filhos reposicionam sem sobreposição. **e2e novo:** arrastar a alça (pointer real) → recarregar → conferir a largura persistida (seletor `data-testid="resize-handle"`/`mind-node`); arrastar a alça **não** muda pai/posição. Rodar a tríade + e2e (contra o banco **dev** — única `.env`; prod intocado). Conferir `Success Criteria` e `git diff` (full-stack consciente: migration + `width` em schema/DTO/endpoint + largura por nó no front). **Registrar AD-023** (nas notas pós-execução; o registro em STATE.md é no chat de execução/review).
**Where:** `packages/web/e2e/...` (spec novo de resize) — código só se algum gate apontar ajuste
**Depends on:** T5
**Reuses:** suíte e2e existente (drag por pointer do M9/M13 como molde do gesto), `data-testid` (`mind-node`/`ghost-slot`/`resize-handle`).
**Requirement:** M15-22 (tríade verde; unit web+api atualizados), M15-23 (e2e verdes + 1 smoke de resize/persistência), + verificação visual de M15-01/02/04/11/16

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] **Smoke visual:** screenshot confirma alça no hover + card redimensionado + reflow + filhos sem sobreposição (gate L-005). Anexar/conferir.
- [ ] **e2e novo:** resize por pointer + reload preserva a largura; resize não altera pai/posição. Verde.
- [ ] e2e existentes seguem verdes (nenhum vira vermelho por causa da largura por nó; `persistence.spec.ts:136` flaky histórico — não atribuir a M15).
- [ ] e2e roda contra o banco **dev** (única `.env`); prod fica intocado (roda só no servidor). Sem o risco L-007 (corrigido pelo usuário).
- [ ] Gate full passa: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`.
- [ ] `git diff` confere: full-stack consciente (migration + width + largura por nó); AD-002 revisada parcialmente (sem x/y). AD-023 anotada para o review.

**Tests:** e2e + smoke visual · **Gate:** full

**Verify:** comparar e2e com baseline (34/34 no M13 — ver STATE.md) + o novo spec de resize verde; screenshot conferido.

**Commit:** sem commit de código se a verificação passa limpa; ajustes pontuais → `fix(m15): T6 <descrição>`.

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | data model coeso (schema+migration+shared+mapper de 1 campo) | ✅ Granular |
| T2 | 1 endpoint (PATCH width) + integração | ✅ Granular |
| T3 | camada pura de layout (largura por nó) + unit | ✅ Granular |
| T4 | 1 arquivo (`slots.ts`) eixo X + unit | ✅ Granular |
| T5 | gesto de resize (alça + estado + persistência) — coeso num fluxo | ✅ Granular |
| T6 | smoke + e2e + gates (verificação) | ✅ Granular |

> T5 toca 3-4 arquivos (`MindNode`, `MapCanvas`, `types`, helper), mas é **um** deliverable coeso (o gesto de resize ponta-a-ponta no front); fatiar (alça sem estado, ou estado sem persistência) geraria commits intermediários sem comportamento observável. Mantido como uma task, no espírito do T3 do M12 (fiação do canvas) e do drag do M9.

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 (início) | ✅ Match |
| T2 | T1 | T1 → T2 [P] | ✅ Match |
| T3 | T1 | T1 → T3 [P] | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T2, T4 | T2,T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |

T2 e T3 são `[P]`: dependem só de T1, tocam pacotes disjuntos (`api` vs `web`), sem estado compartilhado. T5 depende de T3 transitivamente via T4 (e diretamente de T2/T4) — consistente.

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Mapper/contrato (lógica pura api) + migration | unit (mapper); migration none | unit | ✅ OK |
| T2 | Endpoint API (`PATCH`) | integration | integration | ✅ OK |
| T3 | Lógica pura de layout | unit | unit | ✅ OK |
| T4 | Lógica pura de slots | unit | unit | ✅ OK |
| T5 | Gesto/medição DOM + helper puro `clampWidth` | unit (parte pura) + none (DOM→e2e/smoke T6) | unit | ✅ OK¹ |
| T6 | Verificação (roda e2e + smoke) | e2e + smoke | e2e | ✅ OK |

¹ A parte testável por unit de T5 (`clampWidth`) é coberta na própria task; o wiring DOM (pointer capture, screen→world, medição do teto) é DOM/timing (AD-007), coberto pelo e2e + smoke obrigatório de T6 — **não é deferral** (não há lógica pura adicional a testar em T5). Mesmo precedente de M12-T3/T4 (fiação/CSS → smoke em T5).

---

## Notas pós-execução (fora do diff de código, para o chat de execução/review)

- **Registrar AD-023** em `STATE.md`: largura persistida (`width Int?`) revisa **parcialmente AD-002** (1 dado estrutural a mais por nó, **sem x/y livre**) — mesmo precedente/justificativa do `side`/AD-018. Anotar a revisão também em AD-002 e AD-020 (M15 era o "resize fatiado").
- Atualizar `ROADMAP.md` (M15 → concluído) e `STATE.md` (Current Work). **M14** ("central maior em largura") passa a poder consumir a largura por nó.
- Adicionar Deferred Idea: **reset de largura ao default** (sem reset em M15 por decisão do usuário) — candidatos: duplo-clique na alça ou item no menu ⋯.
- **Review AD-013** em chat separado antes de marcar "concluído" ([[feedback-plan-execute-split]]).
- Se a medição do teto de conteúdo (#6 do design) exigir um probe DOM permanente por nó, avaliar o custo em mapas grandes (RNF-01) e anotar em CONCERNS se virar dívida.
