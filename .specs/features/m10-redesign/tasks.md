# M10 — Redesign (web): Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Concluído e aprovado (review AD-013, 2026-06-25). T1–T13; gates verdes (typecheck/lint, unit api 56/web 88, e2e 32/32, smoke visual). 1 finding corrigido no review (▲ crítico movido p/ a linha do título, `87bd9de`); 2 não-bloqueantes em CONCERNS.md.

---

## Contexto para o Executor

Auto-suficiente para um agente sem memória do planejamento. Leia, na ordem:

- `CLAUDE.md` (raiz) — idioma (pt-BR em conversa/commits/docs; **código/identificadores em inglês**); commits `tipo(escopo): descrição`, escopo = `m10`.
- `.specs/project/STATE.md` — decisões. Relevantes: **AD-002** (sem `x/y` — M10 não persiste nada de layout), **AD-003** (`status`/`assignee`/`isCritical` no Node; `assignee` é **string livre**), **AD-005** (paleta **fixa**, sem picker), **AD-012** (`GET /maps/:id/nodes` plano — **não** mexer), **AD-013** (review pós-execute obrigatório), **AD-014** (e2e Playwright por user story P1).
- `.specs/features/m10-redesign/spec.md` — requisitos `M10-NN`.
- `.specs/features/m10-redesign/design.md` — arquitetura, reuso, decisões técnicas. **Leitura obrigatória antes de T2 e T11.**
- `.claude/rules/frontend-structure.md` — componente de página em `pages/<pagina>/components/`; **reusar antes de criar**; primitivos globais em `components/ui/`.
- Pasta `Mindmaps system interface/` (raiz) — o export de referência. `Meus Mapas.dc.html` (home) e `Estudo de Nos.dc.html` (canvas+dialog) têm o HTML/CSS/lógica exatos a portar (cores, espaçamentos, a matemática de contraste em `lum`/`ratio`).

**Decisões herdadas (não reabrir):**

- **Sem rebranding** "Nodum" — header neutro (logo genérico + "Mapas mentais").
- **Sem mini-preview** nos cards — card = título + métricas + datas.
- `assignee` segue **string livre**; avatar = iniciais derivadas (sem entidade de usuário).
- **Única** mudança de backend: `GET /maps`/`MapSummary` agregam contagens + `createdAt`. **Sem schema/migration.** `MapDetail` e demais endpoints **intactos**.
- Canvas: **só reskin** — layout/drag/slots de M7/M8/M9 **intactos**. Mexer apenas em apresentação e visibilidade da toolbar (CSS hover), **sem tocar** pointer handlers de drag.
- Cor de texto **"auto"** = `textColor === null` derivado por luminância no render (nullable já existe; **não** cria campo).

**Princípios não-negociáveis:**

- TypeScript strict; sem `any` implícito.
- Commits atômicos, **um por task**, em **português**: `feat(m10): T<N> <descrição>` (`test(m10):` se só teste; `docs(m10):` para a T13).
- Identificadores/código em **inglês**; commits/comentários/docs em **português**.
- **Reusar antes de criar**. AD-005 preservada (paleta fixa). AD-002 preservada (sem x/y).

**Estado atual — o que muda:**

- `packages/shared/src/map.ts` — `MapSummary` ganha campos. **Muda (T1).** Tipos puros, sem teste.
- `packages/api/src/routes/maps.ts` (`GET /` ~linha 12) + `packages/api/src/mappers/maps.ts` (`toMapSummary`). **Mudam (T2).** `packages/api/src/routes/maps.test.ts` — DB **compartilhado** (`beforeEach` limpa). Estender asserts.
- `packages/web/src/api/maps.ts` — `useMaps` é genérico sobre `MapListResponse`; **provavelmente não muda** (os campos novos fluem pelo tipo). Confirmar em T8.
- `packages/web/src/pages/home/HomePage.tsx` — **reescrita (T8).** `CreateMapForm.tsx` (lógica reaproveitada em T7), `RenameMapInput.tsx` (reusar no rename inline do card).
- `packages/web/src/components/ui/` — só button/input/dialog/toast. **Adicionar `menu.tsx` (T5).**
- `packages/web/src/pages/map/components/MindNode.tsx` (**T10**), `NodeTaskIndicators.tsx` (**T9**), `NodeEditDialog.tsx` (**T11**). `ColorSwatchGrid.tsx`/`StatusSelector.tsx`/`task-meta.ts` — **reusar** (T9/T11). `color-palette.ts` — alinhar swatches ao export + "auto" no texto (T11).

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Shared DTO (tipos puros) | none (typecheck) | quick | Yes |
| API endpoint (`GET /maps`) + mapper | integração (Vitest + DB) | quick (api) → full | **No** (DB compartilhado) |
| Lógica pura (contrast, map-sort) | unit (Vitest web) | quick (web) | Yes |
| Primitivo `ui/menu` (declarativo) | none | quick (typecheck/lint) | Yes |
| Componentes declarativos (MapCard, modal, MindNode, dialog, indicators) | none | quick | Yes |
| Integração da home (stories P1) | e2e (T8) | full | **No** (e2e DB) |
| Reskin do canvas + smoke visual | e2e + screenshot (T12) | full | **No** (e2e DB) |

**Comandos de gate:**

- quick (web): `cd packages/web && pnpm typecheck && pnpm test`
- quick (api): `cd packages/api && pnpm typecheck && pnpm test`
- full: `pnpm typecheck && pnpm lint && pnpm test` (root) **+** `cd packages/web && pnpm test:e2e`

**Tools por task:** MCP: NONE em todas. Skills atribuídas por task (`api-backend`, `web-component-creation`, `mindmap-canvas`). Verificar API de libs (Prisma `groupBy`/`_count`, Base UI `Menu`) na mão antes de fixar — **não assumir** (Knowledge Verification Chain).

---

## Execution Plan

```
Fase 1 — Fundações & lógica pura (todas [P], sem cross-deps):
  T1 (shared MapSummary)
  T3 (contrast.ts + unit)
  T4 (map-sort.ts + unit)
  T5 (ui/menu primitivo)

Fase 2 — Componentes (paralelos onde possível):
  Backend:  T2 (GET /maps + mapper + tests)        ← dep T1
  Home:     T6 (MapCard + MapCardMenu)             ← dep T1, T5
            T7 (CreateMapModal)                     ← dep nenhum (reusa Dialog)
  Canvas:   T9 (NodeTaskIndicators reskin)          ← dep nenhum
            T10 (MindNode reskin)                   ← dep T3, T9
            T11 (NodeEditDialog reskin + contraste) ← dep T3

Fase 3 — Integração (sequencial — e2e DB compartilhado):
  T8 (HomePage + home e2e)   ← dep T2, T4, T6, T7
  T12 (canvas e2e + smoke visual) ← dep T8, T10, T11
  T13 (docs: AD-019 + STATE/ROADMAP) ← dep tudo
```

---

## Task Breakdown

### T1: Estender `MapSummary` no shared

**What:** Adicionar `createdAt`, `nodeCount`, `criticalCount` à interface `MapSummary`.
**Where:** `packages/shared/src/map.ts`
**Depends on:** None
**Reuses:** Interface existente. `MapDetail`/`MapListResponse` inalterados.
**Requirement:** M10-09

**Tools:** MCP: NONE · Skill: NONE

**Done when:**
- [ ] `MapSummary` tem `createdAt: string`, `nodeCount: number`, `criticalCount: number` (+ os atuais).
- [ ] `MapDetail` e `MapListResponse` **inalterados**.
- [ ] Gate: `pnpm typecheck` (root) passa.

**Tests:** none · **Gate:** quick (typecheck)
**Commit:** `feat(m10): T1 estende MapSummary com contagens e createdAt`

---

### T3: Utilitários de contraste/luminância (`contrast.ts`) [P]

**What:** Funções puras de cor portadas do export.
**Where:** `packages/web/src/pages/map/components/contrast.ts` (+ `contrast.test.ts`)
**Depends on:** None
**Reuses:** Matemática `lum`/`ratio` de `Mindmaps system interface/Estudo de Nos.dc.html`.
**Requirement:** M10-25, M10-27

**Tools:** MCP: NONE · Skill: NONE

**Interfaces:** `relativeLuminance(hex)`, `contrastRatio(a,b)`, `isDarkBg(hex)`, `autoTextColor(bgHex)`, `contrastVerdict(ratio): { label, level }`.

**Done when:**
- [ ] As 5 funções implementadas e exportadas.
- [ ] `contrastVerdict`: ≥4.5 → "Boa leitura"/good; ≥3 → "Razoável"/ok; <3 → "Contraste baixo"/bad.
- [ ] `autoTextColor`: fundo escuro → texto claro; fundo claro → texto escuro.
- [ ] Unit tests cobrem: branco/branco → bad; navy/verde → good; thresholds 4.5 e 3; isDarkBg nos dois sentidos.
- [ ] Gate: `cd packages/web && pnpm typecheck && pnpm test`.
- [ ] Test count: contagem web sobe (registrar +N).

**Tests:** unit · **Gate:** quick (web)
**Commit:** `feat(m10): T3 utilitários de contraste e luminância`

---

### T4: Filtro + ordenação de mapas (`map-sort.ts`) [P]

**What:** Função pura `filterAndSortMaps(maps, query, sort)`.
**Where:** `packages/web/src/pages/home/components/map-sort.ts` (+ `.test.ts`)
**Depends on:** None
**Reuses:** Tipo `MapSummary` (T1 não bloqueia — campos já tipados).
**Requirement:** M10-22, M10-24

**Tools:** MCP: NONE · Skill: NONE

**Done when:**
- [ ] Filtra por título case-insensitive; ordena Recentes (`updatedAt` desc), A–Z (`localeCompare` 'pt'), Mais nós (`nodeCount` desc).
- [ ] Unit tests: query filtra; cada modo de sort ordena; query vazia retorna tudo.
- [ ] Gate: `cd packages/web && pnpm typecheck && pnpm test`.
- [ ] Test count: +N.

**Tests:** unit · **Gate:** quick (web)
**Commit:** `feat(m10): T4 filtro e ordenação de mapas`

---

### T5: Primitivo `ui/menu` (Base UI) [P]

**What:** Componente de dropdown/menu reutilizável.
**Where:** `packages/web/src/components/ui/menu.tsx`
**Depends on:** None
**Reuses:** Base UI (mesma base do `ui/dialog.tsx`, shadcn v2 / Q-005).
**Requirement:** M10-04 (infra)

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**
- [ ] Exporta `Menu`/`MenuTrigger`/`MenuItem` (ou equivalente Base UI) com estilo do design system.
- [ ] Acessível por teclado (Base UI nativo) e fecha ao selecionar/Esc/clicar fora.
- [ ] Verificar a API do Base UI `Menu` antes (não assumir).
- [ ] Gate: `cd packages/web && pnpm typecheck` + `pnpm lint`.

**Tests:** none (declarativo; coberto por e2e em T8) · **Gate:** quick
**Commit:** `feat(m10): T5 primitivo ui/menu (Base UI)`

---

### T2: `GET /maps` agrega contagens + mapper + tests

**What:** Estender a listagem para incluir `nodeCount`, `criticalCount`, `createdAt`.
**Where:** `packages/api/src/routes/maps.ts` (`GET /`), `packages/api/src/mappers/maps.ts` (`toMapSummary`), `packages/api/src/routes/maps.test.ts`
**Depends on:** T1
**Reuses:** Handler/rota e `toMapSummary` existentes; índice `@@index([mapId])`.
**Requirement:** M10-09, M10-11

**Tools:** MCP: NONE · Skill: `api-backend`

**Approach (ver design):** `findMany` com `_count: { select: { nodes: true } }` para `nodeCount` + `node.groupBy({ by: ['mapId'], where: { isCritical: true }, _count: { _all: true } })` para `criticalCount`; merge por `mapId` (default 0). **Nota de semântica:** `nodeCount` aqui é **total de nós (inclui a raiz)** — um mapa recém-criado mostra "1 nó". Se preferir excluir a raiz, trocar por `groupBy` com `parentId: { not: null }` (decisão de implementação, anotar no SUMMARY).

**Done when:**
- [ ] `GET /maps` retorna cada item com `nodeCount`, `criticalCount`, `createdAt` + campos atuais.
- [ ] `toMapSummary` atualizado (assinatura aceita as contagens).
- [ ] Tests cobrem: mapa sem nós extras → `criticalCount` 0; mapa com nó crítico → contagem certa; `createdAt` presente; ordenação por `updatedAt` preservada.
- [ ] Gate: `cd packages/api && pnpm typecheck && pnpm test`.
- [ ] Test count: api sobe (registrar +N; sem deleções silenciosas).

**Tests:** integration (DB) · **Gate:** quick (api) → full
**Commit:** `feat(m10): T2 GET /maps agrega nodeCount/criticalCount/createdAt`

---

### T6: `MapCard` + `MapCardMenu`

**What:** Card de mapa (título/ellipsis, label de nós, badge condicional de críticos, datas) + menu ⋯ (Renomear/Excluir).
**Where:** `packages/web/src/pages/home/components/MapCard.tsx`, `MapCardMenu.tsx`
**Depends on:** T1, T5
**Reuses:** `ui/menu` (T5), `Button`, `Intl.DateTimeFormat`.
**Requirement:** M10-04, M10-10, M10-11, M10-12

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**
- [ ] `MapCard` exibe título com ellipsis, "N nó(s)" (singular/plural), datas "Criado …"/"Editado …".
- [ ] Badge de críticos **só** quando `criticalCount > 0`.
- [ ] `MapCardMenu` oferece Renomear e Excluir; props `onRename`/`onDelete`/`onOpen`.
- [ ] Estilo fiel a `Meus Mapas.dc.html` (card `#17171c`, borda, hover).
- [ ] Gate: `cd packages/web && pnpm typecheck` + `pnpm lint`.

**Tests:** none (declarativo; coberto por e2e T8) · **Gate:** quick
**Commit:** `feat(m10): T6 MapCard e menu de ações do card`

---

### T7: `CreateMapModal`

**What:** Modal "Novo mapa" (input autofocus, Criar/Cancelar, validação não-vazio).
**Where:** `packages/web/src/pages/home/components/CreateMapModal.tsx`
**Depends on:** None
**Reuses:** `ui/dialog`, `ui/input`, `ui/button`; lógica de validação de `CreateMapForm.tsx`.
**Requirement:** M10-05, M10-06, M10-07, M10-08

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**
- [ ] Abre com input autofocus; confirma só com nome não-vazio; fecha em Cancelar/Esc/clique fora sem criar.
- [ ] Props `{ open, isPending, onCreate(title), onClose }`.
- [ ] `CreateMapForm.tsx` antigo removido **ou** marcado para remoção em T8 (sem código morto ao fim).
- [ ] Gate: `cd packages/web && pnpm typecheck` + `pnpm lint`.

**Tests:** none (coberto por e2e T8) · **Gate:** quick
**Commit:** `feat(m10): T7 modal de criação de mapa`

---

### T9: Reskin `NodeTaskIndicators` [P]

**What:** Linha de meta do nó: dot **+ label** de status, avatar circular de iniciais, ▲ de crítico.
**Where:** `packages/web/src/pages/map/components/NodeTaskIndicators.tsx`
**Depends on:** None
**Reuses:** `statusMeta`/`getInitials`/`hasTaskProps` (`task-meta.ts`). Mantém retorno `null` sem props (disclosure M6).
**Requirement:** M10-14, M10-15, M10-16

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**
- [ ] Status: dot + label (hoje só dot); omitido quando `status` nulo.
- [ ] Responsável: avatar circular com iniciais; omitido quando vazio.
- [ ] Crítico: indicador ▲ quando `isCritical`.
- [ ] Estilo fiel a `Estudo de Nos.dc.html`.
- [ ] `data-testid="node-task-indicators"` preservado (e2e).
- [ ] Gate: `cd packages/web && pnpm typecheck` + `pnpm lint && pnpm test` (sem quebrar `task-meta.test.ts`).

**Tests:** none (helpers já testados; visual coberto por e2e T12) · **Gate:** quick
**Commit:** `feat(m10): T9 reskin dos indicadores de tarefa do nó`

---

### T10: Reskin `MindNode` (cor + borda adaptada + toolbar no hover)

**What:** Card de nó rico; toolbar revelada no hover; borda/divisor adaptados a fundo claro vs. escuro.
**Where:** `packages/web/src/pages/map/components/MindNode.tsx`
**Depends on:** T3, T9
**Reuses:** `contrast.ts` (`isDarkBg`), `NodeTaskIndicators` (T9), `Button`.
**Requirement:** M10-13, M10-17

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**
- [ ] Aplica `bgColor`/`textColor` (texto `null` → `autoTextColor(bgColor)`); bordas/divisores via `isDarkBg`.
- [ ] Toolbar (add/editar/excluir) passa de sempre-visível a revelada no hover (CSS `group`/opacity).
- [ ] **Drag por pointer events, edição inline, collapse — intactos** (não tocar handlers).
- [ ] Estilo fiel ao export.
- [ ] Gate: `cd packages/web && pnpm typecheck && pnpm test` + `pnpm lint`.

**Tests:** none (interação coberta por e2e T12) · **Gate:** quick
**Commit:** `feat(m10): T10 reskin do nó com toolbar no hover`

---

### T11: Reskin `NodeEditDialog` (preview ao vivo + paletas + medidor de contraste)

**What:** Dialog com preview ao vivo do card, swatches (fundo + texto com "Aa"/"auto"), controles de status/responsável/prioridade e medidor de contraste WCAG.
**Where:** `packages/web/src/pages/map/components/NodeEditDialog.tsx`, `color-palette.ts`
**Depends on:** T3
**Reuses:** `ColorSwatchGrid`, `StatusSelector`, `contrast.ts`, `task-meta.ts`, `ui/dialog`/`ui/input`.
**Requirement:** M10-18, M10-19, M10-20, M10-21, M10-25, M10-26

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**
- [ ] Preview ao vivo reflete título/fundo/texto/status/responsável/crítico conforme edita.
- [ ] `color-palette.ts` alinhado ao export; opção **"auto"** no texto grava `textColor = null`; swatch de texto mostra "Aa" sobre o fundo atual (AD-005 preservada).
- [ ] Status/responsável/prioridade sobre os campos existentes; persiste via `onUpdateNode` (optimistic atual intacto); cancelar/fechar descarta.
- [ ] Medidor de contraste (P2): classifica e mostra "{ratio}:1", recalcula ao vivo (usa `contrast.ts`).
- [ ] `data-testid="assignee-input"`/`"critical-toggle"` preservados.
- [ ] Gate: `cd packages/web && pnpm typecheck && pnpm test` + `pnpm lint`.

**Tests:** none (contrast já unit em T3; visual coberto por e2e T12) · **Gate:** quick
**Commit:** `feat(m10): T11 reskin do dialog de edição com medidor de contraste`

---

### T8: `HomePage` reescrita + e2e da home

**What:** Casca da home (header neutro, hero + contagem, busca/sort, grid de `MapCard`, modal, empty states, rename inline, ConfirmDialog) + specs e2e das stories P1 da home.
**Where:** `packages/web/src/pages/home/HomePage.tsx`, `packages/web/e2e/` (spec nova)
**Depends on:** T2, T4, T6, T7
**Reuses:** hooks `useMaps`/`useCreateMap`/`useUpdateMap`/`useDeleteMap`, `ConfirmDialog`, `RenameMapInput`, `map-sort` (T4), `MapCard` (T6), `CreateMapModal` (T7).
**Requirement:** M10-01, M10-02, M10-03, M10-22, M10-23, M10-24

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**
- [ ] Header neutro (sem "Nodum"), hero "Meus Mapas" + contagem total; grid responsivo.
- [ ] Clique no card navega ao canvas; menu ⋯ → Renomear (inline) / Excluir (ConfirmDialog atual).
- [ ] Empty states distintos: "Nenhum mapa ainda" (CTA) vs. "Nada encontrado" (busca).
- [ ] Busca filtra; sort Recentes/A–Z/Mais nós (via `map-sort`).
- [ ] Modal "Novo mapa" cria e o card aparece.
- [ ] `CreateMapForm.tsx` removido se substituído (sem código morto).
- [ ] e2e: criar via modal; card mostra métricas; excluir via ⋯ com confirmação.
- [ ] Gate full: `pnpm typecheck && pnpm lint && pnpm test` + `cd packages/web && pnpm test:e2e`.
- [ ] Test count: e2e sobe (registrar +N; sem deleções).

**Tests:** e2e · **Gate:** full
**Commit:** `feat(m10): T8 reescreve a home com grid de cards, busca e modal`

---

### T12: e2e do canvas + smoke visual das duas telas

**What:** Specs e2e do nó redesenhado/dialog + screenshot Playwright das duas telas (gate visual de L-005).
**Where:** `packages/web/e2e/` (spec nova / estender)
**Depends on:** T8, T10, T11
**Reuses:** Infra Playwright (AD-014); seletores `data-testid` preservados em T9/T11.
**Requirement:** M10-13..21 (verificação visual/interativa)

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**
- [ ] e2e: abrir nó, editar cor/status no dialog, ver preview atualizar e persistir no canvas.
- [ ] Hover no nó revela a toolbar; ações funcionam.
- [ ] Screenshot das duas telas conferido (reskin coerente, sem render quebrado).
- [ ] Gate full: `pnpm typecheck && pnpm lint && pnpm test` + `cd packages/web && pnpm test:e2e`.
- [ ] Test count: e2e total registrado (sem deleções).

**Tests:** e2e · **Gate:** full
**Commit:** `test(m10): T12 e2e do canvas redesenhado e smoke visual`

---

### T13: Formalizar AD-019 + atualizar STATE/ROADMAP

**What:** Registrar a decisão de agregação na listagem de mapas e fechar o milestone na memória do projeto.
**Where:** `.specs/project/STATE.md`, `.specs/project/ROADMAP.md`
**Depends on:** T1–T12
**Reuses:** Padrão de AD/Current Work do STATE.
**Requirement:** rastreabilidade

**Tools:** MCP: NONE · Skill: `tlc-spec-driven`

**Done when:**
- [ ] AD-019 registrada (GET /maps agrega `nodeCount`/`criticalCount`/`createdAt`; sem schema; trade-off da semântica de `nodeCount`).
- [x] STATE `Current Work` reflete M10 executado (gates verdes, contagens de teste) — review AD-013 aprovado (2026-06-25).
- [x] ROADMAP: M10 movido para "concluído" após o review.
- [ ] Traceability da spec atualizada (Pending → Verified).

**Tests:** none · **Gate:** —
**Commit:** `docs(m10): T13 formaliza AD-019 e atualiza STATE/ROADMAP`

---

## Parallel Execution Map

```
Fase 1 (paralela):  T1 [P]   T3 [P]   T4 [P]   T5 [P]
Fase 2:
  Backend:  T2            (dep T1)
  Home:     T6 (dep T1,T5)   T7 (dep —)
  Canvas:   T9 (dep —)   T10 (dep T3,T9)   T11 (dep T3)
            → T6, T7, T9, T11 paralelizáveis; T10 após T9; T2 isolado (DB)
Fase 3 (sequencial — e2e):  T8 (dep T2,T4,T6,T7) → T12 (dep T8,T10,T11) → T13
```

**Constraint:** T2 é a única task de API (DB compartilhado) — sem conflito de paralelismo, mas seus tests rodam isolados. T8 e T12 rodam e2e → **sequenciais entre si** (DB de e2e compartilhado).

---

## Pre-Approval Validation

### Check 1 — Task Granularity

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | 1 interface (shared) | ✅ |
| T2 | 1 endpoint + 1 mapper + tests | ✅ |
| T3 | 1 módulo puro (5 fns) | ✅ |
| T4 | 1 fn pura | ✅ |
| T5 | 1 primitivo ui | ✅ |
| T6 | 2 componentes coesos (card + seu menu) | ✅ |
| T7 | 1 componente | ✅ |
| T8 | 1 página (integração) + e2e | ✅ |
| T9 | 1 componente | ✅ |
| T10 | 1 componente | ✅ |
| T11 | 1 componente + paleta | ✅ |
| T12 | e2e + visual | ✅ |
| T13 | docs | ✅ |

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | Depends on (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | — | ✅ |
| T3 | None | — | ✅ |
| T4 | None | — | ✅ |
| T5 | None | — | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T6 | T1, T5 | T1,T5→T6 | ✅ |
| T7 | None | — | ✅ |
| T9 | None | — | ✅ |
| T10 | T3, T9 | T3,T9→T10 | ✅ |
| T11 | T3 | T3→T11 | ✅ |
| T8 | T2, T4, T6, T7 | →T8 | ✅ |
| T12 | T8, T10, T11 | →T12 | ✅ |
| T13 | T1–T12 | →T13 | ✅ |

### Check 3 — Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Shared DTO puro | none | none | ✅ |
| T2 | API endpoint + mapper | integração | integration | ✅ |
| T3 | Lógica pura (contrast) | unit | unit | ✅ |
| T4 | Lógica pura (sort) | unit | unit | ✅ |
| T5 | Primitivo declarativo | none | none | ✅ |
| T6 | Componente declarativo | none | none | ✅ |
| T7 | Componente declarativo | none | none | ✅ |
| T8 | Integração home (story P1) | e2e | e2e | ✅ |
| T9 | Componente declarativo | none | none | ✅ |
| T10 | Componente declarativo | none | none | ✅ |
| T11 | Componente declarativo (contrast já unit em T3) | none | none | ✅ |
| T12 | Reskin canvas (story P1) | e2e | e2e | ✅ |
| T13 | docs | none | none | ✅ |

Todas ✅ — pronto para aprovação.

---

## Cobertura de Requisitos

27 requisitos `M10-NN` → todos mapeados: M10-01/02/03/22/23/24 (T8), 04 (T5/T6), 05–08 (T7), 09/11 (T1/T2), 10/12 (T6), 13/17 (T10), 14/15/16 (T9), 18/19/20/21/25/26 (T11), 27 (T3, aplicado em T10/T11), verificação visual P1 (T12). **0 não-mapeados.**
