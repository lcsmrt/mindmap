import type { MoveNodeBody } from '@mindmap/shared';
import type { TreeNode } from './tree.js';
import { type PositionedNode, GAP_X, GAP_Y } from './useTreeLayout.js';
import { NODE_WIDTH } from './nodeSize.js';

export interface Slot {
  parentId: string;
  index: number;
  side: 'LEFT' | 'RIGHT' | null;
  colX: number;
  colWidth: number;
  anchorY: number;
  bandTop: number;
  bandBottom: number;
  groupTop: number;    // desempata grupos co-coluna (ver AD-021)
  groupBottom: number;
}

// ~1,5 card cobre a folga entre colunas; além disso → snap-back
const SLOT_MAX_DISTANCE = NODE_WIDTH * 1.5;

type Group = 'LEFT' | 'RIGHT' | null;

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
      // pais não-raiz: limita band ao range Y do pai para evitar empate em co-coluna
      const colX = parentPos.x + dir * (parentPos.width + GAP_X);
      const colWidth = parentPos.width;
      const anchorY = parentPos.y + parentPos.height / 2;
      const bandTop = side === null ? parentPos.y : -Infinity;
      const bandBottom = side === null ? parentPos.y + parentPos.height : Infinity;
      slots.push({
        parentId, index: 0, side, colX, colWidth, anchorY, bandTop, bandBottom,
        groupTop: bandTop, groupBottom: bandBottom,
      });
      return;
    }
    const colX = children[0]!.x;
    const colWidth = children[0]!.width;
    const groupTop = center(children[0]!);
    const groupBottom = center(children[m - 1]!);
    for (let j = 0; j <= m; j++) {
      // anchorY: ponta = borda do card ± GAP_Y/2; meio = centro do vão.
      let anchorY: number;
      if (j === 0) anchorY = children[0]!.y - GAP_Y / 2;
      else if (j === m) anchorY = children[m - 1]!.y + children[m - 1]!.height + GAP_Y / 2;
      else anchorY = (children[j - 1]!.y + children[j - 1]!.height + children[j]!.y) / 2;
      const bandTop = j === 0 ? -Infinity : center(children[j - 1]!);
      const bandBottom = j === m ? Infinity : center(children[j]!);
      slots.push({ parentId, index: j, side, colX, colWidth, anchorY, bandTop, bandBottom, groupTop, groupBottom });
    }
  }

  function walk(t: TreeNode): void {
    const parentPos = posById.get(t.node.id);
    if (parentPos) {
      const visible = t.children.filter(
        (c) => posById.has(c.node.id) && c.node.id !== opts.draggedId,
      );
      if (t.node.parentId === null) {
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
    const colCenter = slot.colX + slot.colWidth / 2;
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
