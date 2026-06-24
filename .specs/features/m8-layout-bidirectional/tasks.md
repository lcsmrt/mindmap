# M8 — Layout bidirecional horizontal: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** nenhum (feature pequena — decisão do usuário 2026-06-24; algoritmo capturado nas "Notas para Design" da spec).
**Status:** Executado (T1–T3) — pendente review AD-013

**Resultado da execução (2026-06-24):**

- **T1** ✅ `feat(m8): T1 layout bidirecional com split balanceado` (`abc4ad8`) — `computeTreeLayout` reescrito; `useTreeLayout.test.ts` 6→13 testes (raiz centrada, bilateral x<0/x>0, split por peso, filho único→direita, espelhamento, sem sobreposição, edge no centro, bounds bilaterais). Gate quick verde.
- **T2** ✅ `feat(m8): T2 edges horizontais bidirecionais no canvas` (`2889ac1`) — `LinkVertical`→`LinkHorizontal`. Gate quick verde.
- **T3** ✅ sem commit de código (nada precisou ajuste). Gate full verde: typecheck ✅, lint ✅, test (api 42, web 48) ✅, **e2e 22/22** ✅ (incl. `persistence.spec.ts:136`, flaky histórico, verde). Diff só frontend (3 arquivos); backend/schema/AD-002 intactos; sem toggle de direção. Smokes de interação cobertos pela suíte e2e.

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — idioma (pt-BR em conversa/commits/docs; código em inglês) e formato de commits (`tipo(escopo): descrição`, escopo = `m8`).
- `.specs/project/STATE.md` — decisões. Relevantes: **AD-002** (posições NÃO são persistidas — segue valendo, nada de x/y no banco), **AD-015** (stack do canvas = visx + d3-flextree), **AD-013** (review pós-execute obrigatório).
- `.specs/features/m8-layout-bidirectional/spec.md` — requisitos `M8-NN` e a seção **"Notas para Design"** (guia de algoritmo).
- Este arquivo.

**Princípios não-negociáveis:**

- TypeScript strict; sem `any` implícito.
- Commits atômicos, um por task, em **português**, Conventional Commits: `feat(m8): T<N> <descrição>` (`test(m8):` se a task for só teste).
- Identificadores/código em **inglês**; commits/comentários/docs em **português**.
- **Escopo: só a direção do layout.** Bidirecional horizontal, direção **fixa** (sem toggle). Backend, `MindNode`, dialog, mutations, optimistic e `tree.ts` (`buildTree`/`visibleNodes`) **intactos**. AD-002 mantida (sem x/y).
- **Reusar antes de criar** (`.claude/rules/frontend-structure.md`). Componentes de página ficam em `pages/<pagina>/components/`.

**Estado atual (pré-M8) — o que existe e o que muda:**

- `packages/web/src/lib/useTreeLayout.ts` — `computeTreeLayout(tree, nodeSizeFn)` roda **um** `flextree` na direção **vertical** (`nodeSize: (n) => [NODE_WIDTH + GAP_X, nodeHeight + GAP_Y]`, i.e. `[breadth=largura, depth=altura]`), converte para coordenadas top-left (`x = n.x - NODE_WIDTH/2`, `y = n.y`), e monta `links` do centro-base do pai ao centro-topo do filho. Também calcula `bounds`. **É o arquivo principal da mudança.**
- `packages/web/src/lib/useTreeLayout.test.ts` — unit tests da geometria atual (vertical). **Atualizar para a geometria bidirecional.**
- `packages/web/src/lib/nodeSize.ts` — `NODE_WIDTH=180`, `nodeHeight(node)` ∈ {40, 58}. **Intacto** (reusar).
- `packages/web/src/pages/map/components/MapCanvas.tsx` — camada de edges usa `<LinkVertical>` do `@visx/shape` sobre `links`. `fitView` e o hit-test do drag (`useNodeDrag`) já derivam de `positioned`/`bounds`, então **seguem funcionando** com as novas coordenadas; só a edge precisa virar horizontal.
- `packages/web/src/pages/map/components/useNodeDrag.ts` — hit-test por bounds em `positioned`. **Não precisa mudar** (coordenadas novas entram automático). Conferir no smoke.
- `packages/web/src/lib/tree.ts` — `buildTree`/`visibleNodes`. **Intacto.**

**Geometria a implementar (resumo — detalhe nas "Notas para Design" da spec):**

- Repartir os **filhos de 1º nível da raiz** (já filtrados por `visibleNodes`) em dois grupos, lado **direito** e **esquerdo**, balanceando por **peso de subárvore** (definir peso: contagem de nós visíveis da subárvore é o mais simples). Algoritmo guloso: ordenar filhos por peso desc; cada um vai para o lado atualmente mais leve; desempate determinístico por `sortOrder`. Filho único → lado **direito** (default).
- Para cada lado, rodar `flextree` na **horizontal**: `nodeSize: (n) => [altura_do_nó + GAP, NODE_WIDTH + GAP]` (agora breadth=altura, depth=largura). Posicionar a raiz uma única vez no centro; o lado esquerdo tem o eixo de profundidade **espelhado** (x negativo). Alinhar os dois lados no ponto da raiz.
- `links`: edge raiz→filho-de-1º-nível sai do **centro vertical da raiz** em direção ao lado do filho (M8-09); edges de níveis profundos = horizontal pai→filho no mesmo lado (M8-10).
- `bounds` deve abranger x negativo (lado esquerdo) e positivo (lado direito) para o `fitView` enquadrar tudo (M8-13).
- Manter a convenção **top-left** em `positioned` (casa com os nós HTML e o hit-test do drag).

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Lógica pura de layout (`computeTreeLayout`, split) | unit (Vitest) | `pnpm test` (web) | Yes |
| Render de edges no canvas (interação/visual UI) | e2e existente (não escrever novos) | `pnpm test:e2e` (web) | No |

**Comandos de gate:**

- quick: `cd packages/web && pnpm typecheck && pnpm test`
- full: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`

**Skills aplicáveis:** `mindmap-canvas` (skill central — layout d3-flextree + edges SVG, T1 e T2). Sem MCPs necessários. Verificar API do `d3-flextree`/`@visx/shape` na mão (Context7/docs) antes de fixar — **não assumir** (Knowledge Verification Chain).

---

## Execution Plan

```
T1 (layout bidirecional + split + unit) ──→ T2 (edges horizontais no canvas) ──→ T3 (gates + smoke)
```

Cadeia sequencial — T2 depende das coordenadas/`links` que T1 produz; T3 valida o conjunto. Sem paralelismo.

---

## Task Breakdown

### T1: `computeTreeLayout` bidirecional + split balanceado + unit tests

**What:** Reescrever `computeTreeLayout` para layout bidirecional horizontal: repartir os filhos de 1º nível em dois lados balanceados por peso de subárvore (guloso, determinístico, desempate por `sortOrder`, filho único → direita), rodar `flextree` horizontal por lado, espelhar o lado esquerdo (x<0), alinhar na raiz, e produzir `positioned` (top-left), `links` (raiz→1º nível saindo do centro da raiz; demais horizontais pai→filho no mesmo lado) e `bounds` abrangendo x negativo e positivo. Atualizar os unit tests para a geometria nova.
**Where:** `packages/web/src/lib/useTreeLayout.ts`, `packages/web/src/lib/useTreeLayout.test.ts`
**Depends on:** None
**Reuses:** `nodeSize.ts` (`NODE_WIDTH`, `nodeHeight`), `tree.ts` types (`TreeNode`), `d3-flextree` (já instalado), a estrutura de retorno `LayoutResult` (`positioned`/`links`/`bounds`).
**Requirement:** M8-01, M8-02, M8-03, M8-04, M8-05, M8-06, M8-07, M8-08, M8-09 (coordenadas), M8-10, M8-11, M8-17

**Tools:**

- MCP: NONE
- Skill: `mindmap-canvas`

**Done when:**

- [ ] Função pura, sem React/DOM; `useTreeLayout` (o hook `useMemo`) segue chamando-a com a mesma assinatura externa (`LayoutResult`).
- [ ] Filhos de 1º nível repartidos em dois lados; lado direito com x>0 (relativo à raiz), esquerdo espelhado x<0; raiz no centro (x≈0).
- [ ] Split balanceado por peso de subárvore visível, determinístico (mesmo input → mesma atribuição); filho único → direita.
- [ ] Alturas variáveis (40/58) respeitadas sem sobreposição entre irmãos do mesmo lado.
- [ ] `links` raiz→1º nível ancoram no centro vertical da raiz; `bounds` abrange x negativo e positivo.
- [ ] `useTreeLayout.test.ts` atualizado: asserções de raiz centrada, algum filho x<0 e algum x>0, balanceamento e determinismo; edge cases (só raiz; 1 filho).
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`
- [ ] Test count: todos os testes web verdes (não deletar testes silenciosamente; o nº sobe vs. baseline por causa dos casos novos).

**Tests:** unit
**Gate:** quick

**Verify:** `cd packages/web && pnpm test useTreeLayout` → verde, com asserções bilaterais.

**Commit:** `feat(m8): T1 layout bidirecional com split balanceado`

---

### T2: edges horizontais ancoradas no centro da raiz no canvas

**What:** Trocar a renderização das edges no `MapCanvas.tsx` de `<LinkVertical>` para conexões **horizontais** (`<LinkHorizontal>` do `@visx/shape` ou link custom — verificar API), consumindo os `links` produzidos por T1 (que já trazem as coordenadas corretas, inclusive a ancoragem no centro da raiz). Garantir que o lado esquerdo desenha para −x sem cruzar o eixo.
**Where:** `packages/web/src/pages/map/components/MapCanvas.tsx`
**Depends on:** T1
**Reuses:** `links`/`positioned`/`bounds` de `useTreeLayout`; o container transformado (mesma matriz de zoom) já existente; classes Tailwind das edges atuais (`stroke-border fill-none`).
**Requirement:** M8-09, M8-10, M8-11, M8-12 (drag continua via `positioned`), M8-13 (fitView)

**Tools:**

- MCP: NONE
- Skill: `mindmap-canvas`

**Done when:**

- [ ] Edges renderizam horizontais; raiz→1º nível saem do centro da raiz para os dois lados; níveis profundos conectam pai→filho no mesmo lado.
- [ ] `LinkVertical` removido do import/uso se não for mais necessário.
- [ ] `fitView` enquadra a árvore inteira (lados −x e +x visíveis).
- [ ] Drag-to-reparent ainda funciona (hit-test em `positioned`, sem mudança no `useNodeDrag`).
- [ ] Gate quick passa: `cd packages/web && pnpm typecheck && pnpm test`

**Tests:** none (render visual — coberto pelos e2e existentes em T3; sem unit novo aqui)
**Gate:** quick

**Verify:** rodar a app, abrir um mapa com vários ramos: raiz no centro, ramos nos dois lados, edges saindo do centro da raiz.

**Commit:** `feat(m8): T2 edges horizontais bidirecionais no canvas`

---

### T3: smoke manual + gates completos

**What:** Validar paridade de interação no novo layout e rodar a tríade + e2e. Conferir os `Success Criteria` da spec.
**Where:** — (verificação; sem mudança de código além de ajustes pontuais se algum gate apontar)
**Depends on:** T2
**Reuses:** suíte e2e existente (seletores `data-testid`, agnósticos à direção).
**Requirement:** M8-12, M8-13, M8-14, M8-15, M8-16, M8-18

**Tools:**

- MCP: NONE
- Skill: NONE

**Done when:**

- [ ] Smoke manual: abrir mapa → raiz centrada, ramos bilaterais balanceados; editar inline, colapsar/expandir, add filho, excluir, abrir dialog, ver indicador de tarefa — tudo funciona.
- [ ] Drag-to-reparent: arrastar nó sobre outro → reparent; soltar no vazio → snap-back; raiz não arrasta.
- [ ] Gate full passa: `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`.
- [ ] e2e: nenhum spec que estava verde vira vermelho por causa da mudança de direção.
- [ ] `git diff` confirma: só frontend, sem mudança de backend/schema, sem colunas x/y, sem estado de direção/toggle.

**Tests:** e2e (suíte existente)
**Gate:** full

**Verify:** comparar o conjunto de e2e verdes com o baseline pré-M8 (ver L-004: 22/22 no M7; `persistence.spec.ts:136` é flaky histórico, não atribuir a M8).

**Commit:** sem commit de código próprio se nada mudou além da verificação; caso algum ajuste seja necessário, `fix(m8): T3 <descrição>`.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: layout bidirecional + split + unit | 1 função pura + seus testes (2 arquivos coesos) | ✅ Granular |
| T2: edges horizontais | 1 arquivo (camada de edges do MapCanvas) | ✅ Granular |
| T3: smoke + gates | verificação (sem deliverable de código) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | (início) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Lógica pura de layout (`computeTreeLayout`) | unit | unit | ✅ OK |
| T2 | Render de edges (UI visual) | e2e (existente, em T3) | none | ✅ OK¹ |
| T3 | — (verificação; roda e2e existente) | e2e | e2e | ✅ OK |

¹ T2 é render visual sem lógica pura nova; a cobertura é a suíte e2e existente, executada no gate full de T3 (não é deferral de teste novo — não há lógica testável por unit em T2; o cálculo testável vive em T1).
