# M8 — Layout bidirecional horizontal do canvas

## Problem Statement

Hoje o canvas usa layout **vertical** (raiz no topo, profundidade para baixo), escolhido em M7 pelo caminho de menor esforço — não por ser o ideal. Em mindmaps reais a árvore cresce para os lados, e o vertical empilha tudo para baixo, desperdiçando o eixo horizontal da tela e ficando difícil de ler em mapas largos.

M8 troca a direção para **bidirecional horizontal** (estilo MindMeister): raiz no centro, ramos de primeiro nível divididos e **balanceados** entre esquerda e direita, e cada lado uma árvore horizontal que cresce afastando-se da raiz. É a primeira das "Deferred Ideas — direção do layout" (AD-015) a ser destravada pós-conversão visx.

## Goals

- [ ] Canvas renderiza a árvore como **bidirecional horizontal**: raiz no centro, filhos de 1º nível repartidos entre os dois lados, cada lado crescendo para fora na horizontal.
- [ ] A repartição dos ramos entre os lados é **balanceada** por peso de subárvore (não "primeira metade à esquerda"), aproximando a distribuição equilibrada do MindMeister.
- [ ] Alturas variáveis de nó (40px / 58px com rodapé — `nodeSize.ts`) seguem respeitadas, sem sobreposição.
- [ ] Edges conectam pai→filho de forma legível e ancoram no **centro** da raiz para os dois lados.
- [ ] `fitView`, hit-test do drag-to-reparent, collapse/expand e todas as interações de nó continuam funcionando (derivam de `positioned` — paridade).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa; specs e2e seguem verdes (AD-014).

## Out of Scope

| Item | Motivo |
| --- | --- |
| **Toggle/alternância de direção na UI** | Decisão do usuário (2026-06-24): direção **fixa** por enquanto. Pode virar feature depois. Sem estado de UI nem condicional de direção. |
| **Radial 360° de verdade** | Avaliado e descartado nesta rodada: texto apertado/girado, maior esforço. O print de referência é bidirecional, não radial. |
| **Persistir direção/posição por mapa** | AD-002 mantida — nada de x/y nem preferência de view no banco. Layout segue 100% derivado no cliente. |
| **Reorder entre irmãos via drag** (AD-011) | Continua deferred; não entra aqui. |
| **Backend / schema / endpoints** | Nada muda. M8 é só a camada de layout/render do frontend. |
| **`MindNode`, dialog, mutations, optimistic** | Inalterados — M8 só muda de onde cada nó é posicionado e como a edge é desenhada. |
| **Mudança de estilo de curva das edges** além do necessário para horizontal | Troca `LinkVertical`→horizontal por paridade; refino estético de curva não é o foco. |

---

## Decisões Incorporadas

1. **Formato: bidirecional horizontal** (decisão do usuário, 2026-06-24, com base no print do MindMeister). Raiz no centro; filhos de 1º nível repartidos entre esquerda e direita; cada lado é uma árvore horizontal independente crescendo para fora.
2. **Repartição balanceada por peso de subárvore** (decisão do usuário — "ficou muito bem distribuído"). O critério concreto de peso (contagem de folhas vs. contagem de nós vs. altura visual) e o algoritmo de atribuição (ex.: guloso — maior subárvore vai para o lado mais leve) são **decisão de `design.md`**. O spec exige apenas: distribuição visualmente equilibrada e determinística (mesmo input → mesmo lado).
3. **Direção fixa, sem toggle** (decisão do usuário, 2026-06-24). Bidirecional vira o único layout. Nada de estado de UI de direção.
4. **Só frontend, layout derivado** (AD-002): a mudança vive em `useTreeLayout.ts` (algoritmo) + `MapCanvas.tsx` (tipo/ancoragem das edges). Backend, `sortOrder`, `MindNode`, mutations e dialog intactos.
5. **Alturas variáveis preservadas**: continua usando `d3-flextree` (que já trata alturas por nó); no eixo horizontal o "breadth" passa a ser a altura do nó e a "depth" a largura. A reconciliação dos dois lados em torno da raiz é decisão de `design.md` (provável: rodar flextree por lado e alinhar ambos no ponto da raiz).
6. **Edges ancoram no centro da raiz**: para os filhos de 1º nível, a edge sai do centro (vertical) do nó raiz em direção ao lado correspondente — replicando o visual do print (linhas saindo do centro para os dois lados). Demais níveis: pai→filho horizontal padrão.
7. **Paridade de interação**: `fitView`, `useNodeDrag` (hit-test por bounds em `positioned`), `collapsedIds`/`visibleNodes`, edição inline, add/delete/dialog, indicadores e optimistic permanecem idênticos — todos já derivam de `positioned`/`links`, que continuam sendo a fonte única.

---

## User Stories

### P1: Árvore renderiza bidirecional, raiz no centro ⭐ MVP

**User Story:** Como usuário, quero ver minha árvore com a raiz no centro e os ramos abrindo para os dois lados, para aproveitar a largura da tela e ler o mapa como num mindmap de verdade.

**Why P1:** É o coração da feature — sem isto, nada muda.

**Acceptance Criteria:**

1. WHEN o usuário abre um mapa com filhos no 1º nível THEN o canvas SHALL posicionar a raiz no centro e repartir esses filhos entre o lado esquerdo e o direito.
2. WHEN um filho está no lado direito THEN sua subárvore SHALL crescer para a direita (profundidade → +x); WHEN está no lado esquerdo THEN SHALL crescer para a esquerda (profundidade → −x), espelhada.
3. WHEN os nós são posicionados THEN as alturas variáveis (40/58) SHALL ser respeitadas sem sobreposição vertical entre irmãos de um mesmo lado.
4. WHEN há um único filho no 1º nível THEN ele SHALL ir para um lado default determinístico (ex.: direita), sem quebrar o layout.
5. WHEN o mapa tem só a raiz THEN o canvas SHALL renderizar 1 nó centrado, sem edges.

**Independent Test:** Abrir um mapa com vários ramos; a raiz aparece no centro, ramos divididos esquerda/direita, cada lado crescendo para fora.

---

### P1: Distribuição balanceada entre os lados ⭐ MVP

**User Story:** Como usuário, quero que os ramos fiquem bem distribuídos entre os dois lados (não todos amontoados de um lado), para que o mapa fique equilibrado e legível.

**Why P1:** O "bem distribuído" é o que diferencia o resultado de um split ingênuo; foi o ponto que o usuário destacou.

**Acceptance Criteria:**

1. WHEN a raiz tem N filhos de 1º nível com subárvores de tamanhos diferentes THEN a atribuição aos lados SHALL equilibrar o peso visual dos dois lados (não simplesmente metade/metade por ordem).
2. WHEN o mesmo mapa é reaberto sem mudanças THEN a atribuição de lados SHALL ser idêntica (determinística — sem aleatoriedade).
3. WHEN um ramo é colapsado/expandido THEN o rebalanceamento SHALL refletir os nós visíveis (peso considera apenas `visibleNodes`).

**Independent Test:** Mapa com um ramo "pesado" e vários leves — o pesado fica sozinho de um lado e os leves do outro, lados visualmente comparáveis.

---

### P1: Edges saindo do centro da raiz ⭐ MVP

**User Story:** Como usuário, quero as conexões saindo do centro do nó raiz para os dois lados, como no print, para o mapa ter o visual radial-ish esperado.

**Why P1:** É o detalhe visual que o usuário identificou no print ("linhas saindo do centro nas duas direções").

**Acceptance Criteria:**

1. WHEN uma edge liga a raiz a um filho de 1º nível THEN ela SHALL partir do centro (vertical) do nó raiz em direção ao lado do filho.
2. WHEN uma edge liga níveis mais profundos (pai→filho não-raiz) THEN ela SHALL ser uma conexão horizontal legível pai→filho, no mesmo lado.
3. WHEN o lado é o esquerdo THEN as edges SHALL apontar para −x (espelhadas), sem cruzar para o lado direito.

**Independent Test:** Inspecionar a raiz: edges saem do centro dela para ambos os lados; nenhuma edge cruza o eixo central indevidamente.

---

### P1: Interações e gates preservados ⭐ MVP

**User Story:** Como mantenedor, quero que drag, fitView, collapse, edição e os testes continuem funcionando após a troca de direção, para confiar que foi só layout.

**Why P1:** Mudança de layout não pode regredir interação (L-001, AD-013).

**Acceptance Criteria:**

1. WHEN o usuário arrasta um nó sobre outro THEN o drag-to-reparent SHALL funcionar igual (hit-test por bounds em `positioned`, agora com novas coordenadas).
2. WHEN o mapa abre THEN o `fitView` SHALL enquadrar a árvore inteira (bounds agora abrangem −x e +x).
3. WHEN o usuário colapsa/expande, edita inline, adiciona/exclui, abre dialog THEN tudo SHALL funcionar como antes (paridade — derivam de `positioned`).
4. WHEN `pnpm typecheck && pnpm lint && pnpm test` roda THEN SHALL passar; os unit tests de `computeTreeLayout` SHALL ser atualizados para a geometria bidirecional.
5. WHEN `pnpm test:e2e` roda THEN os specs SHALL seguir verdes (seletores são `data-testid`, agnósticos à direção).

**Independent Test:** Rodar a tríade + e2e; arrastar/colapsar/editar um nó no novo layout — tudo verde e funcional.

---

## Edge Cases

- WHEN a raiz tem 0 filhos visíveis THEN renderiza só a raiz centrada, sem edges nem lados.
- WHEN a raiz tem 1 filho visível THEN ele vai para o lado default (determinístico), sem layout degenerado.
- WHEN todos os filhos de 1º nível têm subárvores de peso igual THEN o desempate de lado SHALL ser determinístico (ex.: por `sortOrder`).
- WHEN um lado fica vazio após colapsos THEN o outro lado SHALL renderizar normalmente e o `fitView` SHALL enquadrar só o que existe.
- WHEN dois nós de lados opostos teriam o mesmo y central THEN NÃO SHALL haver sobreposição com a raiz (folga horizontal mínima preservada dos dois lados).
- WHEN o mapa é grande THEN o layout síncrono SHALL completar sem travar perceptível em uso pessoal típico (não regredir vs. vertical de hoje; RNF-01/500 nós segue no Gate v1 adiado).

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M8-01 | Raiz centrada; filhos de 1º nível repartidos nos dois lados | P1 | Done |
| M8-02 | Subárvore do lado direito cresce +x; esquerda espelhada −x | P1 | Done |
| M8-03 | Alturas variáveis (40/58) respeitadas sem sobreposição | P1 | Done |
| M8-04 | 1 filho → lado default determinístico | P1 | Done |
| M8-05 | Só raiz → 1 nó centrado, sem edges | P1 | Done |
| M8-06 | Distribuição balanceada por peso de subárvore | P1 | Done |
| M8-07 | Atribuição de lados determinística (sem aleatoriedade) | P1 | Done |
| M8-08 | Peso considera apenas `visibleNodes` (rebalanceia no collapse) | P1 | Done |
| M8-09 | Edge raiz→filho 1º nível sai do centro da raiz | P1 | Done |
| M8-10 | Edges de níveis profundos: horizontal pai→filho no mesmo lado | P1 | Done |
| M8-11 | Lado esquerdo espelhado (−x), sem cruzar o eixo | P1 | Done |
| M8-12 | Drag-to-reparent preservado (hit-test em `positioned`) | P1 | Done |
| M8-13 | `fitView` enquadra bounds bilaterais (−x e +x) | P1 | Done |
| M8-14 | Collapse/edição/add/delete/dialog/optimistic preservados | P1 | Done |
| M8-15 | `typecheck && lint && test` verde; unit de layout atualizados | P1 | Done |
| M8-16 | e2e seguem verdes (seletores agnósticos à direção) | P1 | Done |
| M8-17 | Direção fixa, sem toggle (verificável: sem estado de direção) | P1 | Done |
| M8-18 | Backend/AD-002 intactos (sem x/y, sem schema novo) | P1 | Done |

**Coverage:** 18 requisitos — todos P1.

---

## Success Criteria

- [ ] Abrir um mapa mostra a raiz no centro com ramos abrindo para os dois lados, cada lado crescendo para fora na horizontal.
- [ ] Os lados ficam visualmente equilibrados (split por peso de subárvore, determinístico).
- [ ] Edges saem do centro da raiz para ambos os lados; níveis profundos conectam horizontalmente no mesmo lado.
- [ ] Alturas variáveis respeitadas; sem sobreposição.
- [ ] Drag, fitView, collapse, edição, dialog e indicadores funcionam idênticos a antes.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa; e2e verdes; unit de `computeTreeLayout` atualizados para a geometria nova.
- [ ] Diff é só frontend: sem mudança de backend/schema, sem colunas x/y, sem toggle de direção.

---

## Skills Aplicáveis (executor)

- **`mindmap-canvas`** — skill de canvas do projeto (visx+d3): cobre layout (d3-flextree), edges SVG, viewport e drag. É o skill central desta feature.
- **`web-component-creation`** — caso a ancoragem de edge no centro da raiz exija um pequeno componente/custom link.

---

## Notas para Design (próxima fase)

- **Algoritmo de bidirecionalidade com `d3-flextree`:** flextree posiciona uma árvore a partir de uma raiz. Avaliar rodar **dois** flextrees (raiz + filhos do lado direito; raiz + filhos do lado esquerdo), alinhar ambos no ponto da raiz e espelhar o X do lado esquerdo — vs. um único flextree pós-processado. Verificar geometria do flextree (x=breadth/altura, y=depth/largura) ao rotacionar para horizontal.
- **Critério de peso para o split:** decidir entre contagem de folhas, contagem de nós ou soma de alturas; algoritmo guloso (ordenar filhos por peso desc, cada um vai para o lado atualmente mais leve) com desempate por `sortOrder`. Deve operar sobre `visibleNodes`.
- **Ancoragem da edge no centro da raiz:** hoje `LinkVertical` sai da base do pai. Decidir entre `LinkHorizontal` do `@visx/shape` com source ajustado para o centro da raiz, ou um link custom — verificar API via Context7/docs (não assumir).
- **Conversão de coordenadas top-left:** manter a convenção atual (`positioned` em top-left para casar com nós HTML e hit-test do drag). Revisar `bounds` para abranger x negativo.
- **Testes:** atualizar `useTreeLayout.test.ts` para asserções de geometria bilateral (ex.: algum filho com x<0, algum com x>0; raiz centrada; balanceamento).
