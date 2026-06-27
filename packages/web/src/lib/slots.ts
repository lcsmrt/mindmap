import type { MoveNodeBody } from '@mindmap/shared';
import type { TreeNode } from './tree.js';
import { type PositionedNode, GAP_X, GAP_Y } from './useTreeLayout.js';
import { NODE_WIDTH } from './nodeSize.js';

/**
 * Slot de drop: uma posição `(parentId, index)` onde o nó arrastado pode cair, com o
 * `side` quando o pai é a raiz. `colX`/`anchorY` descrevem onde a barra-fantasma
 * aparece; `bandTop`/`bandBottom` definem a faixa vertical `[bandTop, bandBottom)` que
 * seleciona este slot — as fronteiras caem no centro dos cards vizinhos. `index` é a
 * posição visual **local** dentro do grupo (entre os filhos do pai, ou do lado, já sem
 * o arrastado); a conversão para o índice global da raiz mora em `slotToMoveBody`.
 */
export interface Slot {
  parentId: string;
  index: number;
  side: 'LEFT' | 'RIGHT' | null;
  colX: number;       // X (top-left) da coluna onde a barra desenha
  anchorY: number;    // centro vertical do vão — onde a barra-fantasma é desenhada
  bandTop: number;
  bandBottom: number;
  groupTop: number;    // span vertical do grupo; desempata grupos co-coluna (ver AD-021)
  groupBottom: number;
}

// Distância máxima horizontal (em px de mundo) do cursor ao centro da coluna para que
// o slot seja considerado alvo. Além disso → snap-back. ~1,5 card cobre a folga.
const SLOT_MAX_DISTANCE = NODE_WIDTH * 1.5;

type Group = 'LEFT' | 'RIGHT' | null;

/**
 * Enumera todos os slots de drop a partir da árvore visível e do layout posicionado.
 * Para cada pai visível gera os slots entre/around seus filhos (excluindo o nó
 * arrastado). Para a raiz, gera slots dos **dois lados** (incl. o slot único de um
 * lado vazio). Pais profundos sem filhos visíveis ganham 1 slot "primeiro filho".
 */
export function computeSlots(
  tree: TreeNode,
  positioned: PositionedNode[],
  opts: { draggedId: string },
): Slot[] {
  const posById = new Map(positioned.map((p) => [p.id, p] as const));
  const slots: Slot[] = [];

  function center(c: PositionedNode): number {
    return c.y + c.height / 2;
  }

  function pushGroup(
    parentPos: PositionedNode,
    parentId: string,
    children: PositionedNode[],
    side: Group,
    dir: 1 | -1,
  ): void {
    const m = children.length;
    if (m === 0) {
      // Lado/pai vazio: 1 slot na coluna onde o primeiro filho cairia, alinhado ao
      // centro vertical do pai. Para a raiz (side != null), band cobre toda a coluna —
      // cada lado tem coluna X distinta, sem colisão. Para pais não-raiz (side === null),
      // limita ao range Y do pai para evitar que múltiplos cards folha na mesma coluna
      // compitam com band idêntica (o primeiro sempre venceria o empate).
      const colX = parentPos.x + dir * (NODE_WIDTH + GAP_X);
      const anchorY = parentPos.y + parentPos.height / 2;
      const bandTop = side === null ? parentPos.y : -Infinity;
      const bandBottom = side === null ? parentPos.y + parentPos.height : Infinity;
      slots.push({
        parentId, index: 0, side, colX, anchorY, bandTop, bandBottom,
        groupTop: bandTop, groupBottom: bandBottom,
      });
      return;
    }
    const colX = children[0]!.x;
    const groupTop = center(children[0]!);
    const groupBottom = center(children[m - 1]!);
    for (let j = 0; j <= m; j++) {
      // anchorY: ponta = borda do card ± GAP_Y/2; meio = centro do vão.
      let anchorY: number;
      if (j === 0) anchorY = children[0]!.y - GAP_Y / 2;
      else if (j === m) anchorY = children[m - 1]!.y + children[m - 1]!.height + GAP_Y / 2;
      else anchorY = (children[j - 1]!.y + children[j - 1]!.height + children[j]!.y) / 2;
      // bands: fronteiras no centro dos cards vizinhos.
      const bandTop = j === 0 ? -Infinity : center(children[j - 1]!);
      const bandBottom = j === m ? Infinity : center(children[j]!);
      slots.push({ parentId, index: j, side, colX, anchorY, bandTop, bandBottom, groupTop, groupBottom });
    }
  }

  function walk(t: TreeNode): void {
    const parentPos = posById.get(t.node.id);
    if (parentPos) {
      const visible = t.children.filter(
        (c) => posById.has(c.node.id) && c.node.id !== opts.draggedId,
      );
      if (t.node.parentId === null) {
        // Raiz: reparte por side (null → RIGHT, igual ao layout) e gera os dois lados.
        const right = visible.filter((c) => c.node.side !== 'LEFT').map((c) => posById.get(c.node.id)!);
        const left = visible.filter((c) => c.node.side === 'LEFT').map((c) => posById.get(c.node.id)!);
        pushGroup(parentPos, t.node.id, right, 'RIGHT', 1);
        pushGroup(parentPos, t.node.id, left, 'LEFT', -1);
      } else {
        const kids = visible.map((c) => posById.get(c.node.id)!);
        const dir: 1 | -1 = parentPos.x + parentPos.width / 2 >= 0 ? 1 : -1;
        pushGroup(parentPos, t.node.id, kids, null, dir);
      }
    }
    for (const c of t.children) walk(c);
  }

  walk(tree);
  return slots;
}

const SAME_COLUMN_EPS = 0.5;

/**
 * Seleção lexicográfica do slot: coluna (`dx`) → grupo co-coluna (`groupDy`) → banda do Y.
 * Determinística no empate (primeiro enumerado); `null` se o melhor `dx` excede
 * `SLOT_MAX_DISTANCE` (snap-back). Ver AD-021.
 */
export function nearestSlot(
  point: { x: number; y: number },
  slots: Slot[],
  opts: { excludeSubtree: Set<string> },
): Slot | null {
  let best: Slot | null = null;
  let bestDx = Infinity;
  let bestGroupDy = Infinity;
  let bestInBand = false;
  for (const slot of slots) {
    if (opts.excludeSubtree.has(slot.parentId)) continue;
    const colCenter = slot.colX + NODE_WIDTH / 2;
    const dx = Math.abs(point.x - colCenter);
    const inBand = point.y >= slot.bandTop && point.y < slot.bandBottom;
    const groupDy =
      point.y < slot.groupTop ? slot.groupTop - point.y
      : point.y > slot.groupBottom ? point.y - slot.groupBottom
      : 0;

    let better: boolean;
    if (best === null) better = true;
    else if (Math.abs(dx - bestDx) > SAME_COLUMN_EPS) better = dx < bestDx;
    else if (groupDy !== bestGroupDy) better = groupDy < bestGroupDy;
    else if (inBand !== bestInBand) better = inBand;
    else better = false;

    if (better) {
      best = slot;
      bestDx = dx;
      bestGroupDy = groupDy;
      bestInBand = inBand;
    }
  }
  return best !== null && bestDx <= SLOT_MAX_DISTANCE ? best : null;
}

/**
 * Converte um slot visual no corpo da mutação `move`. Para pais não-raiz, o índice
 * local já é o final (`side` omitido). Para a raiz, mapeia a posição visual `j` dentro
 * do lado para o **índice global** entre os filhos da raiz (sortOrder global, AD-008):
 * ordena os filhos do lado (sem o arrastado) como `[s_0..s_{m-1}]` e
 * `newSiblings` = todos os filhos da raiz sem o arrastado.
 *   - `j < m`  → índice de `s_j` em `newSiblings`
 *   - `j == m` → índice de `s_{m-1}` em `newSiblings` + 1
 *   - `m == 0` (lado vazio) → `newSiblings.length`
 */
export function slotToMoveBody(
  slot: Slot,
  rootChildrenOrdered: Array<{ id: string; side: 'LEFT' | 'RIGHT' | null }>,
  draggedId: string,
): MoveNodeBody {
  if (slot.side === null) {
    return { parentId: slot.parentId, index: slot.index };
  }

  const newSiblings = rootChildrenOrdered.filter((c) => c.id !== draggedId);
  const sideSiblings = newSiblings.filter((c) => (c.side ?? 'RIGHT') === slot.side);
  const j = slot.index;
  const m = sideSiblings.length;

  let index: number;
  if (m === 0) index = newSiblings.length;
  else if (j < m) index = newSiblings.findIndex((c) => c.id === sideSiblings[j]!.id);
  else index = newSiblings.findIndex((c) => c.id === sideSiblings[m - 1]!.id) + 1;

  return { parentId: slot.parentId, index, side: slot.side };
}

/**
 * Verdadeiro se o slot representa a posição **atual** do nó arrastado (origem) — o
 * drop ali é no-op. A comparação é no nível do slot (pai + lado + posição local),
 * que é o que importa visualmente: a ordem relativa dentro do lado é o que o layout
 * desenha; o índice global pode diferir sem mudar a aparência.
 */
export function isOriginSlot(
  slot: Slot,
  dragged: { id: string; parentId: string | null; side: 'LEFT' | 'RIGHT' | null },
  currentSiblingsOrdered: Array<{ id: string; side: 'LEFT' | 'RIGHT' | null }>,
): boolean {
  if (slot.parentId !== dragged.parentId) return false;
  if (slot.side === null) {
    return slot.index === currentSiblingsOrdered.findIndex((c) => c.id === dragged.id);
  }
  const draggedSide = dragged.side ?? 'RIGHT';
  if (slot.side !== draggedSide) return false;
  const group = currentSiblingsOrdered.filter((c) => (c.side ?? 'RIGHT') === draggedSide);
  return slot.index === group.findIndex((c) => c.id === dragged.id);
}
