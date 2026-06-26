# M12 — Card responsivo (texto sempre visível + altura dinâmica)

## Problem Statement

Hoje o título do nó é cortado com `truncate` (`MindNode.tsx:199`) quando passa da largura fixa de 180px, e a altura do card vem de uma **fórmula** discreta (`nodeSize.ts`: 40px base / 79px com rodapé de tarefa) — não do conteúdo real. Em uso real isso esconde texto (o usuário não lê o nó inteiro sem abrir o dialog) e a altura "chutada" não acompanha um título que precisaria de várias linhas.

M12 inverte isso: o texto passa a ser **sempre 100% visível** (sem truncamento — quebra em linhas), e a **altura do card passa a ser derivada da medição real** do conteúdo renderizado, realimentando o `d3-flextree`. É a primeira metade do item "Card responsivo + resize" do backlog de polish (ROADMAP M12); o **resize horizontal** foi fatiado para um milestone seguinte (decisão do usuário, 2026-06-25 — ver _Out of Scope_).

## Goals

- [ ] Título do nó **nunca é truncado**: quebra em múltiplas linhas e cabe inteiro no card, inclusive palavras longas sem espaço.
- [ ] A **altura do card é derivada da medição real** do DOM (não da fórmula 40/79), refletindo quantas linhas o texto ocupa + o rodapé de tarefa quando presente.
- [ ] O layout (`computeTreeLayout` / `d3-flextree`) usa essas alturas reais → **sem sobreposição** vertical entre irmãos, qualquer que seja o número de linhas.
- [ ] Mudanças de conteúdo que alteram a altura (editar título, ligar/desligar props de tarefa) **reposicionam** a árvore.
- [ ] `fitView`, drag, collapse/expand, edição inline, dialog, edges e indicadores continuam funcionando (paridade — derivam de `positioned`).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa; specs e2e seguem verdes (AD-014).

## Out of Scope

| Item | Motivo |
| --- | --- |
| **Resize horizontal (largura arrastável por nó)** | **Fatiado para um milestone seguinte** (decisão do usuário, 2026-06-25). M12 entrega só "texto sempre visível + altura dinâmica". A largura segue **fixa em `NODE_WIDTH=180`**. **Decisões já fixadas para o milestone de resize** (não perder): largura **persistida no schema** (coluna `width Int?` no Node, espírito AD-002 — 1 dado estrutural a mais, sem x/y livre) e **alça de resize revelada no hover** (consistente com a toolbar M10). |
| **Recalibrar a geometria da barra-fantasma de drop (M13)** | `lib/slots.ts` usa `PLACEHOLDER_H` fixo (40) para o card arrastado; com alturas dinâmicas a assimetria do drop muda. É exatamente o escopo do **M13**, que **depende de M12**. M12 não mexe nessa calibração (os _anchors_ dos slots já leem a altura real de `children[].height`; só o placeholder do arrastado fica fixo). |
| **Hierarquia visual por profundidade / "central maior" (M14)** | Milestone separado. M12 não muda skin por profundidade nem tamanho relativo por nível. |
| **Backend / schema / endpoints** | M12 é **só frontend**. Nenhuma coluna nova, nenhuma migration. (A coluna `width` fica para o milestone de resize.) AD-002 intacta. |
| **Mudar largura padrão, paleta, dialog, mutations, optimistic** | Inalterados. M12 mexe em como o card mede a própria altura e em remover o `truncate`. |
| **Wrapping/medição do _input_ inline de edição** | O `Input` de edição inline (`MindNode.tsx:187`) é single-line por ora; a medição/altura dinâmica vale para o estado **não-editando** (texto exibido). Se a edição multi-linha aparecer como dor, vira item próprio. |

---

## Decisões Incorporadas

1. **Texto sempre visível, sem truncamento** (decisão do usuário / ROADMAP M12). Remove o `truncate` do título; o texto quebra em linhas e o card cresce em altura para caber.
2. **Largura é a dimensão controlada; altura é derivada** (decisão do usuário, confirmada). Em M12 a largura é **constante** (`NODE_WIDTH=180`); a variável é a altura, agora vinda de medição. O controle de largura pelo usuário (resize) é o milestone seguinte.
3. **Altura por medição real do DOM** (não fórmula). A fórmula `nodeHeight`/`NODE_HEIGHT_BASE`/`NODE_HEIGHT_WITH_FOOTER` (`nodeSize.ts`) deixa de ser a fonte da altura no layout. Pode **sobreviver apenas como estimativa do primeiro paint** (antes da medição), a critério do `design.md` — nunca como verdade final.
4. **Pipeline medir→layout** (núcleo arquitetural). Renderiza o card na largura fixa → mede a altura real no DOM → realimenta o `computeTreeLayout` (que já aceita `nodeSizeFn` e cujo `d3-flextree` já trata altura por nó) → reposiciona. O **mecanismo concreto** (ex.: `ResizeObserver` por nó reportando altura para cima vs. medição off-screen) é **decisão de `design.md`**.
5. **Só frontend, layout derivado** (AD-002). A mudança vive em `MindNode.tsx` (remove truncate, reporta altura), `MapCanvas.tsx` (coleta/realimenta alturas), `useTreeLayout.ts`/`nodeSize.ts` (consome altura medida). Backend, schema, `sortOrder`, mutations e dialog intactos.
6. **Quebra de palavra longa**: título sem espaços maior que a largura SHALL quebrar dentro do card (`break-words`/`overflow-wrap`), sem estourar a largura nem vazar para fora.
7. **Resize fatiado, decisões preservadas** (ver _Out of Scope_): quando o resize for speccado, largura **persistida** (coluna `width Int?`) e **alça no hover**.

---

## User Stories

### P1: Título do nó sempre 100% visível ⭐ MVP

**User Story:** Como usuário, quero ver o título inteiro do nó no canvas (sem reticências), para ler o conteúdo sem precisar abrir o dialog de edição.

**Why P1:** É a dor principal levantada em uso real — o coração da feature.

**Acceptance Criteria:**

1. WHEN um título excede a largura do card THEN o canvas SHALL exibi-lo quebrado em múltiplas linhas, sem reticências/truncamento.
2. WHEN o título é uma palavra única mais larga que o card THEN ela SHALL quebrar dentro da largura (`break-words`), sem vazar horizontalmente.
3. WHEN o título é curto THEN o card SHALL ocupar só a(s) linha(s) necessária(s) (sem altura sobrando artificial).
4. WHEN o nó tem rodapé de tarefa (status/responsável) THEN o título quebrado e o rodapé SHALL coexistir, ambos visíveis, com a divisória entre eles (M11).

**Independent Test:** Criar um nó com um título longo (e outro com uma palavra gigante); ambos aparecem inteiros no card, em várias linhas, sem corte nem vazamento.

---

### P1: Altura do card derivada da medição real ⭐ MVP

**User Story:** Como usuário, quero que a altura de cada card acompanhe o conteúdo real (quantas linhas o texto ocupa), para o mapa não ter cards cortados nem espaços vazios.

**Why P1:** Sem altura real, o texto multi-linha sobrepõe os vizinhos ou estoura o card — torna o wrap inútil.

**Acceptance Criteria:**

1. WHEN um card é renderizado THEN sua altura no layout SHALL ser a altura **medida** do card no DOM (conteúdo real), não a fórmula 40/79.
2. WHEN irmãos têm números de linhas diferentes THEN o `d3-flextree` SHALL posicioná-los sem sobreposição vertical, respeitando o `GAP_Y`.
3. WHEN o rodapé de tarefa está presente THEN a altura medida SHALL incluí-lo (a constante reservada `NODE_HEIGHT_WITH_FOOTER` deixa de ser a fonte).
4. WHEN o layout é calculado THEN os `bounds` (usados por `fitView`) e os _anchors_ das edges SHALL refletir as alturas reais.

**Independent Test:** Mapa com nós de 1, 2 e 4 linhas lado a lado; nenhum se sobrepõe, cada card tem exatamente a altura do seu conteúdo, e o `fitView` enquadra tudo.

---

### P1: Re-layout quando a altura muda ⭐ MVP

**User Story:** Como usuário, quero que ao editar um nó (ou mudar suas propriedades de tarefa) o mapa se reorganize, para nada ficar sobreposto depois da mudança.

**Why P1:** Edição é o caminho mais comum de alterar a altura; sem re-layout o canvas fica inconsistente após cada edição.

**Acceptance Criteria:**

1. WHEN o usuário edita um título e o número de linhas muda THEN a árvore SHALL ser reposicionada com a nova altura do nó.
2. WHEN o usuário liga/desliga status ou responsável (alterando presença do rodapé) THEN a altura do nó SHALL ser re-medida e a árvore reposicionada.
3. WHEN um ramo é colapsado/expandido THEN o layout SHALL recompor com as alturas reais dos nós visíveis.
4. WHEN a altura de um nó muda THEN NÃO SHALL haver "salto" visível persistente nem sobreposição residual após a estabilização do layout.

**Independent Test:** Editar um nó curto para um texto de 3 linhas; os nós abaixo descem para acomodar, sem sobreposição; desfazer e eles voltam.

---

### P1: Interações e gates preservados ⭐ MVP

**User Story:** Como mantenedor, quero que drag, fitView, collapse, edição, dialog e os testes continuem funcionando com altura dinâmica, para confiar que foi só a camada de medição/layout.

**Why P1:** Mudança de pipeline de layout não pode regredir interação (L-001, AD-013).

**Acceptance Criteria:**

1. WHEN o usuário arrasta um nó THEN o drag-to-place SHALL funcionar (hit-test/slots derivam de `positioned`, agora com alturas reais); a barra-fantasma SHALL aparecer (calibração fina da geometria é M13).
2. WHEN o mapa abre THEN o `fitView` SHALL enquadrar a árvore com as alturas reais.
3. WHEN o usuário colapsa/expande, edita inline, adiciona/exclui, abre o dialog THEN tudo SHALL funcionar como antes (paridade).
4. WHEN `pnpm typecheck && pnpm lint && pnpm test` roda THEN SHALL passar; os unit tests de `computeTreeLayout`/`nodeSize` SHALL ser atualizados para o modelo de altura medida (sem depender das constantes 40/79 como verdade).
5. WHEN `pnpm test:e2e` roda THEN os specs SHALL seguir verdes (seletores `data-testid`, agnósticos à altura).

**Independent Test:** Rodar a tríade + e2e; arrastar/colapsar/editar um nó com altura dinâmica — tudo verde e funcional.

---

## Edge Cases

- WHEN o título é vazio (não deveria ocorrer — `commit` impede) THEN o card SHALL ter uma altura mínima sã (não 0px), sem quebrar o layout.
- WHEN o título é extremamente longo (ex.: centenas de caracteres) THEN o card SHALL crescer em altura sem limite rígido de M12 (clamp de altura, se necessário, é decisão de design — o padrão é "cabe tudo").
- WHEN a árvore ainda não foi medida (primeiro paint) THEN o layout SHALL usar uma estimativa razoável (sem sobreposição grosseira nem `fitView` num bounds zerado) e convergir para as alturas reais sem flicker perceptível persistente.
- WHEN muitos nós mudam de altura ao mesmo tempo (ex.: expandir um ramo grande) THEN a re-medição SHALL completar sem loop infinito de medir↔layout (estabilização garantida).
- WHEN o nó raiz usa o título do mapa e ele é longo THEN a raiz também SHALL quebrar/crescer (vale para todos os nós, inclusive a raiz).
- WHEN um nó tem rodapé mas título curto THEN a altura SHALL ser a real do conjunto (título + divisória + rodapé), podendo divergir do antigo 79px fixo.

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M12-01 | Título longo quebra em múltiplas linhas, sem truncar | P1 | Done |
| M12-02 | Palavra única longa quebra dentro do card (`break-words`) | P1 | Done |
| M12-03 | Título curto não gera altura sobrando | P1 | Done |
| M12-04 | Título quebrado coexiste com rodapé + divisória (M11) | P1 | Done |
| M12-05 | Altura no layout = altura medida no DOM (não 40/79) | P1 | Done |
| M12-06 | Irmãos de alturas diferentes sem sobreposição (`GAP_Y`) | P1 | Done |
| M12-07 | Altura medida inclui o rodapé de tarefa | P1 | Done |
| M12-08 | `bounds`/`fitView` e anchors de edge usam alturas reais | P1 | Done |
| M12-09 | Editar título que muda nº de linhas reposiciona a árvore | P1 | Done |
| M12-10 | Ligar/desligar props de tarefa re-mede e reposiciona | P1 | Done |
| M12-11 | Collapse/expand recompõe com alturas reais dos visíveis | P1 | Done |
| M12-12 | Sem salto/sobreposição residual após estabilização | P1 | Done |
| M12-13 | Primeiro paint usa estimativa sã e converge sem flicker | P1 | Done |
| M12-14 | Sem loop infinito medir↔layout (estabilização) | P1 | Done |
| M12-15 | Drag/slots/barra-fantasma seguem funcionando (geometria fina → M13) | P1 | Done |
| M12-16 | Collapse/edição/add/delete/dialog/optimistic preservados | P1 | Done |
| M12-17 | `typecheck && lint && test` verde; unit de layout/nodeSize atualizados | P1 | Done |
| M12-18 | e2e seguem verdes | P1 | Done |
| M12-19 | Só frontend; AD-002 intacta (sem schema, sem x/y, sem coluna `width`) | P1 | Done |

**Coverage:** 19 requisitos — todos P1.

---

## Success Criteria

- [ ] Nós com títulos longos aparecem inteiros no canvas, quebrados em linhas, sem reticências nem vazamento.
- [ ] A altura de cada card acompanha o conteúdo real; irmãos de alturas distintas não se sobrepõem.
- [ ] Editar um título / mudar props de tarefa reorganiza a árvore corretamente.
- [ ] `fitView`, drag, collapse, edição inline e dialog funcionam idênticos a antes.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa; e2e verdes; unit de `computeTreeLayout`/`nodeSize` atualizados para altura medida.
- [ ] Diff é **só frontend**: sem schema, sem migration, sem coluna `width`, sem x/y. AD-002 intacta.
- [ ] Smoke visual (screenshot Playwright) confirma cards multi-linha sem sobreposição (gate L-005 — a tríade prova cálculo, não render).

---

## Skills Aplicáveis (executor)

- **`mindmap-canvas`** — skill central: layout (`d3-flextree`), nós HTML, viewport, drag. O pipeline medir→layout é exatamente o domínio dela.
- **`web-component-creation`** — se a medição exigir ajuste estrutural no `MindNode` (ex.: wrapper de medição, `ResizeObserver`).

---

## Notas para Design (próxima fase)

O coração do `design.md` é o **pipeline medir→layout**. Pontos a fechar (verificar APIs via Context7/docs, não assumir — Knowledge Verification Chain):

- **Mecanismo de medição.** Avaliar:
  - `ResizeObserver` por `MindNode` reportando a altura medida para cima (o `MapCanvas` já usa `ResizeObserver` para o container — padrão conhecido no código); o layout recomputa quando o mapa de alturas muda.
  - vs. medição off-screen/`useLayoutEffect` antes do paint.
  - Critério: evitar flicker no primeiro paint e loop medir↔layout (alturas alimentam o layout, que muda posições — garantir que **posição** não realimenta **altura**).
- **Onde a altura medida entra no `computeTreeLayout`.** A função já aceita `nodeSizeFn: (node) => number` (`useTreeLayout.ts:74`) — provavelmente passar um `nodeSizeFn` que lê de um `Map<id, height>` medido, com fallback para a estimativa. Decidir o estado que segura esse mapa (no `MapCanvasInner`).
- **Destino da fórmula antiga** (`nodeSize.ts`): `NODE_HEIGHT_BASE`/`NODE_HEIGHT_WITH_FOOTER`/`nodeHeight`. Manter só como **estimativa de primeiro paint** ou remover? Definir e ajustar os usos (`useTreeLayout.ts:5`, `lib/slots.ts:4,23`). Atenção: `slots.ts` usa `NODE_HEIGHT_BASE` como `PLACEHOLDER_H` — isso é território M13; manter como está em M12.
- **CSS do título.** Remover `truncate` (`MindNode.tsx:199`); adicionar quebra de palavra (`break-words`/`overflow-wrap: anywhere`); revisar `min-w-0` do container.
- **Estabilização.** Garantir convergência: medir → setar altura → relayout não deve mudar a **largura** (fixa) e portanto não deve mudar a altura medida → ponto fixo numa iteração. Documentar essa invariância.
- **Testes.** `useTreeLayout.test.ts` passa a injetar `nodeSizeFn` com alturas arbitrárias (já é injetável) — asserções de não-sobreposição com alturas variadas reais (corrige inclusive o teste vacuoso apontado em L-005). Smoke visual obrigatório (cards multi-linha).
- **Roadmap.** Atualizar `ROADMAP.md`/`STATE.md`: M12 reduz escopo para wrap+altura; o resize vira milestone próprio (com as decisões já fixadas: `width` persistido, alça no hover). Confirmar numeração com o usuário.
