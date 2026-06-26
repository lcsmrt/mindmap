# M13 — Geometria da barra de inserção (drag)

**Status:** especificado (planejamento; execução em chat separado — [[feedback-plan-execute-split]])
**Escopo:** Medium — só frontend, função pura `lib/slots.ts` + render + testes
**Depende de:** M12 (alturas dinâmicas por medição). Sem dependência de M15.

## Problema

Arrastando um nó para entre dois irmãos, a barra de inserção (card-fantasma) **pula**
entre o vão alvo e os vãos adjacentes conforme micro-movimentos do cursor: em alguns
pontos encosta na borda superior do card de baixo, subindo um pouco fica no meio
(correto), subindo mais encosta na borda inferior do card de cima. Confirmado em uso
em 2026-06-25, logo após o M12 tornar as alturas dinâmicas (cards de 1 linha vs.
multi-linha agora coexistem). **Não é regressão do M12** (escopo deferido explicitamente),
mas o M12 o tornou visível. **Não há sobreposição real de cards** — é só a barra-fantasma.

### Causa-raiz (confirmada por leitura do código)

`nearestSlot` (`lib/slots.ts:104`) seleciona o slot por **distância euclidiana ao centro
do slot**. O centro vertical de cada slot coincide com o `anchorY` calculado em
`computeSlots`:

- slots do meio: centro do vão `(child[j-1].bottom + child[j].top) / 2`;
- slots de ponta: `GAP_Y/2` além da borda do primeiro/último card.

A fronteira de decisão "qual vão vence" cai no **ponto médio entre dois `anchorY`
consecutivos**. Como os slots de ponta usam espaçamento `GAP_Y/2` enquanto os do meio
usam centro-de-vão, e como as alturas dos cards variam (M12), essas fronteiras caem em
posições **assimétricas** e não-intuitivas — daí o flip com micro-movimentos e a barra
parecer colada no card maior.

`PLACEHOLDER_H` (`lib/slots.ts:23`, hoje `NODE_HEIGHT_BASE = 40`) é **vestigial**: cancela
algebricamente tanto na seleção (`slot.y + slot.height/2 == anchorY`) quanto no render
(`MapCanvas.tsx:144`: `slot.y + slot.height/2 - GHOST_BAR_HEIGHT/2`). A hipótese do
roadmap sobre "`PLACEHOLDER_H` fixo" é, portanto, um falso culpado para a seleção; o
lever real é a **métrica de seleção**.

## Solução

Trocar a seleção por **distância ao centro** por seleção por **band vertical**: cada slot
passa a carregar a faixa Y `[bandTop, bandBottom)` que o seleciona; as fronteiras entre
slots de um mesmo grupo ficam exatamente no **centro vertical dos cards vizinhos**. A
coluna/grupo (qual pai, qual lado da raiz) continua escolhida por proximidade
**horizontal**. Ver `design.md` para o algoritmo e o novo shape do `Slot`.

## Requisitos

### Funcionais

- **M13-01** — Ao arrastar sobre um grupo de irmãos, o slot selecionado é aquele cujo
  **band vertical** contém o Y do cursor. As fronteiras entre slots consecutivos do grupo
  ficam no **centro vertical** dos cards vizinhos.
- **M13-02** *(anti-flip)* — Dentro de um mesmo grupo/coluna a seleção é **estável**: mover
  o cursor dentro de um band não troca o slot; a troca só ocorre ao cruzar o centro de um
  card.
- **M13-03** — A geometria é **simétrica e correta com alturas variáveis** (cards de 1 e de
  várias linhas, pós-M12): a barra não "sobe" nem "cola" no card maior.
- **M13-04** — A escolha do **grupo/coluna** (qual pai; qual lado da raiz) é por proximidade
  **horizontal** do cursor à coluna. O reparent (soltar sob outro pai) e os dois lados da
  raiz continuam funcionando.
- **M13-05** *(snap-back)* — Cursor além do alcance horizontal de qualquer coluna →
  nenhum slot → drop inválido (snap-back), preservando o comportamento atual de
  `SLOT_MAX_DISTANCE`.
- **M13-06** — A **posição de render** da barra-fantasma continua no **centro do vão**
  entre os cards (gap center) — nunca sobre um card. Altura de render permanece
  `GHOST_BAR_HEIGHT` (6px).
- **M13-07** *(determinismo)* — Empate resolve para o primeiro slot na ordem de
  enumeração (comportamento atual mantido).

### Invariantes preservadas (regressão proibida)

- **M13-08** — Casos de borda inalterados: lado/pai **vazio** (1 slot, band = coluna
  inteira); **folha** (1 slot "primeiro filho"); **exclusão da subárvore** do arrastado;
  **no-op na origem** (`isOriginSlot`); **`slotToMoveBody`** (mesma semântica de
  índice/lado ⇒ **mesmas mutações `move`** ⇒ e2e de drag-to-place permanece verde).

### Não-funcionais / restrições

- **M13-09** — **Só frontend.** Sem schema, sem migration; **AD-002 intacta**. Mudança
  restrita a `lib/slots.ts`, ao render do ghost em `MapCanvas.tsx` (se o shape do `Slot`
  mudar) e aos testes.
- **M13-10** — `PLACEHOLDER_H` (vestigial) é **removido**; o `Slot` passa a expor o anchor
  de render explicitamente (`design.md`). A altura de render do ghost permanece
  `GHOST_BAR_HEIGHT`.
- **M13-11** *(testes — proporcional, [[feedback-test-proportionality]])* —
  - **Unitários** da função pura: fronteira no centro do card; estabilidade dentro do
    band (anti-flip); alturas variáveis simétricas; snap-back; empate determinístico;
    casos de borda (lado vazio, folha, exclusão de subárvore).
  - **Smoke visual** (screenshot Playwright) confirmando a barra simétrica entre cards de
    alturas diferentes — gate que já pegou bugs invisíveis aos unitários (L-004/L-005).
  - **e2e** de drag-to-place **reconciliado** só se algum seletor/geometria quebrar; a
    semântica de `move` não muda, então não deve quebrar.

## Fora de escopo

- Eixo da **largura** (resize / ghost horizontal) → **M15** revisita a mesma `slots.ts` no
  eixo ortogonal; o fix vertical do M13 assenta sem conflito.
- Qualquer mudança em backend, schema ou nas mutações resultantes.
