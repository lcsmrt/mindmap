import type { MoveNodeBody } from '@mindmap/shared';
import type { TreeNode } from './tree.js';
import { type PositionedNode, GAP_X } from './useTreeLayout.js';
import { NODE_WIDTH, NODE_HEIGHT_BASE } from './nodeSize.js';

/**
 * Slot de drop: uma posição `(parentId, index)` onde o nó arrastado pode cair, com o
 * `side` quando o pai é a raiz. `x`/`y`/`height` descrevem o retângulo (top-left, em
 * coordenadas de mundo) onde o card-fantasma aparece. `index` é a posição visual
 * **local** dentro do grupo (entre os filhos do pai, ou do lado, já sem o arrastado);
 * a conversão para o índice global da raiz mora em `slotToMoveBody`.
 */
export interface Slot {
  parentId: string;
  index: number;
  side: 'LEFT' | 'RIGHT' | null;
  x: number;
  y: number;
  height: number;
}

// Altura do placeholder do card-fantasma (tamanho de um card base).
const PLACEHOLDER_H = NODE_HEIGHT_BASE;

// Distância máxima (em px de mundo) do cursor a um slot para considerá-lo alvo. Além
// disso, não há slot válido → snap-back. ~1,5 card cobre um card e a folga ao redor.
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
      // centro vertical do pai.
      const colX = parentPos.x + dir * (NODE_WIDTH + GAP_X);
      const centerY = parentPos.y + parentPos.height / 2;
      slots.push({ parentId, index: 0, side, x: colX, y: centerY - PLACEHOLDER_H / 2, height: PLACEHOLDER_H });
      return;
    }
    const colX = children[0]!.x;
    for (let j = 0; j <= m; j++) {
      let anchorY: number;
      if (j === 0) anchorY = children[0]!.y; // topo do primeiro filho
      else if (j === m) anchorY = children[m - 1]!.y + children[m - 1]!.height; // base do último
      else anchorY = (children[j - 1]!.y + children[j - 1]!.height + children[j]!.y) / 2; // gap
      slots.push({ parentId, index: j, side, x: colX, y: anchorY - PLACEHOLDER_H / 2, height: PLACEHOLDER_H });
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

/**
 * Slot mais próximo do ponto (centro do slot), de forma determinística (empate → o
 * primeiro na ordem de enumeração). Exclui slots cujo pai está na subárvore do nó
 * arrastado (e o próprio) — nunca oferece soltar dentro de si mesmo. Retorna `null`
 * se nenhum slot está dentro de `SLOT_MAX_DISTANCE` (drop fora de alvo → snap-back).
 */
export function nearestSlot(
  point: { x: number; y: number },
  slots: Slot[],
  opts: { excludeSubtree: Set<string> },
): Slot | null {
  let best: Slot | null = null;
  let bestDist = Infinity;
  for (const slot of slots) {
    if (opts.excludeSubtree.has(slot.parentId)) continue;
    const cx = slot.x + NODE_WIDTH / 2;
    const cy = slot.y + slot.height / 2;
    const dist = Math.hypot(point.x - cx, point.y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = slot;
    }
  }
  return best !== null && bestDist <= SLOT_MAX_DISTANCE ? best : null;
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
