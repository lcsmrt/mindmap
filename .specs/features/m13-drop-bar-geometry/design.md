# M13 — Design: seleção de slot por band vertical

Decisão arquitetural a registrar no review: **AD-021** (band-based slot selection).

## 1. Modelo: band vertical em vez de distância ao centro

Hoje `nearestSlot` mistura X e Y numa única distância euclidiana ao `anchorY` (centro do
vão). Trocamos por um modelo de **partição vertical**:

Para um grupo de `m` filhos visíveis (ordenados top→bottom) sob um pai, numa coluna
`colX`, com centros verticais `c_i = child_i.y + child_i.height/2`:

| slot `j`       | band `[bandTop, bandBottom)` | seleção quando            |
| -------------- | ---------------------------- | ------------------------- |
| `0` (antes 1º) | `(-∞, c_0)`                  | `y < c_0`                 |
| `0 < j < m`    | `[c_{j-1}, c_j)`             | `c_{j-1} ≤ y < c_j`       |
| `m` (após últ) | `[c_{m-1}, +∞)`              | `y ≥ c_{m-1}`             |
| grupo vazio    | `(-∞, +∞)`                   | sempre (coluna inteira)   |

As fronteiras caem **exatamente no centro de cada card** (M13-01). Dentro de um band a
seleção é constante → **anti-flip** (M13-02), trocando só ao cruzar o centro de um card —
o ponto mais intuitivo. Independe das alturas → **simétrico** com cards variáveis (M13-03).

`(-∞, +∞)` na prática: `bandTop = -Infinity`, `bandBottom = +Infinity` (ou
`Number.NEGATIVE_INFINITY/POSITIVE_INFINITY`), que comparam corretamente.

## 2. Seleção combinada (X coluna + Y band)

`nearestSlot(point, slots, { excludeSubtree })`:

1. Para cada slot (pulando os de pai em `excludeSubtree`), calcular:
   - `dy = 0` se `point.y ∈ [bandTop, bandBottom)`; senão a distância à borda mais próxima
     do band.
   - `dx = |point.x - colCenterX|`, com `colCenterX = colX + NODE_WIDTH/2`.
   - `score = dx + dy`.
2. Menor `score` vence; **empate → primeiro na ordem de enumeração** (M13-07).
3. **Snap-back** (M13-05): se o melhor `dx` exceder `SLOT_MAX_DISTANCE`, retorna `null`.
   (Mantém o cap **horizontal** atual `NODE_WIDTH * 1.5`. O eixo Y deixa de ter cap — todo
   ponto cai em algum band da coluna escolhida, que é o comportamento desejado: a barra
   "gruda" no vão mais próximo verticalmente, e só o afastamento horizontal invalida.)

Dentro de uma coluna, todos os slots têm o mesmo `dx`; exatamente um tem `dy = 0` → vence
de forma estável em todo o band. Entre colunas, o `dx` decide o grupo (preserva reparent
sob outro pai e os dois lados da raiz — M13-04).

> Por que `dx + dy` e não só band: pontos fora de qualquer coluna (ou entre colunas)
> precisam de um desempate horizontal coerente; somar mantém a função pura, total e
> determinística sem ramificações especiais por "qual grupo".

## 3. Novo shape do `Slot`

`PLACEHOLDER_H` é **vestigial** (cancela em seleção e render — ver spec). Removê-lo e
tornar o anchor explícito:

```ts
export interface Slot {
  parentId: string;
  index: number;
  side: 'LEFT' | 'RIGHT' | null;
  colX: number;       // X (top-left) da coluna onde a barra desenha
  anchorY: number;    // centro vertical do vão — onde a barra-fantasma é desenhada
  bandTop: number;    // início da faixa de seleção (inclusive); pode ser -Infinity
  bandBottom: number; // fim da faixa (exclusive); pode ser +Infinity
}
```

Substitui os antigos `x`, `y`, `height`. `computeSlots` passa a preencher `anchorY`
diretamente (o que hoje é `anchorY`, sem o `- PLACEHOLDER_H/2`) e os limites de band a
partir dos centros dos cards.

**Render** (`MapCanvas.tsx`): a barra desenha centrada em `anchorY` —
`top = anchorY - GHOST_BAR_HEIGHT/2`, `left = colX`, `width = NODE_WIDTH`,
`height = GHOST_BAR_HEIGHT` (M13-06). Remove o uso de `slot.y`/`slot.height`.

## 4. `computeSlots` — bands por grupo

Em `pushGroup`, além do `anchorY` (já calculado hoje), emitir os limites de band:

- **grupo vazio** (`m === 0`): 1 slot, `anchorY = parentPos.y + parentPos.height/2`,
  `bandTop = -Infinity`, `bandBottom = +Infinity`.
- **grupo com `m` filhos** (`j = 0..m`):
  - `anchorY`: como hoje (ponta = borda ± `GAP_Y/2`; meio = centro do vão).
  - `bandTop = j === 0 ? -Infinity : center(children[j-1])`
  - `bandBottom = j === m ? +Infinity : center(children[j])`
  - onde `center(c) = c.y + c.height/2`.

`colX` = `children[0].x` (grupo não-vazio) ou a coluna do primeiro filho hipotético
(grupo vazio) — igual ao `colX` de hoje.

## 5. Impacto / arquivos

- `packages/web/src/lib/slots.ts` — `Slot` (shape), `computeSlots` (emite bands+anchorY),
  `nearestSlot` (score band+coluna). `slotToMoveBody` e `isOriginSlot` **inalterados**
  (operam sobre `parentId`/`index`/`side`, não sobre geometria) → mutações idênticas
  (M13-08).
- `packages/web/src/pages/map/components/MapCanvas.tsx` — render do `ghost-slot` usa
  `anchorY`/`colX` em vez de `y`/`height`. Remove `PLACEHOLDER_H` (já não importado).
- `packages/web/src/lib/slots.test.ts` — fixtures de `Slot` migram para o novo shape;
  novos casos de band (ver tasks).
- `useNodeDrag.ts`/`useNodeDrag.test.ts` — **só** se referenciarem campos antigos do `Slot`
  (hoje tratam o slot como opaco — provável zero mudança).

**AD-002 intacta**, só frontend, sem schema (M13-09).

## 6. Alternativa considerada (rejeitada)

**Manter `x/y/height` e só adicionar `bandTop/bandBottom`** (menor churn, não remove
`PLACEHOLDER_H`). Rejeitada: deixa um conceito morto (`PLACEHOLDER_H`/`height`) que o
próprio roadmap apontou como suspeito, e mantém dois caminhos para a mesma posição
vertical (`y + height/2` vs. `anchorY`). O design escolhido remove a ambiguidade — é a
clarificação que o milestone pede. Custo extra: migrar as fixtures de `Slot` nos testes
(mecânico).

## 7. Design pulável?

Não. Embora seja 1 função pura, a **definição precisa das bands e da métrica combinada** é
a substância do milestone e a execução é em chat separado — este documento viaja com a
spec. (M8, comparável em tamanho, pulou design por ser tradução direta de fórmula; aqui há
uma decisão de algoritmo.)
