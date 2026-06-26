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
  bandTop: number;    // início da faixa de seleção (inclusive); pode ser -Infinity
  bandBottom: number; // fim da faixa (exclusive); pode ser +Infinity
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
      slots.push({ parentId, index: 0, side, colX, anchorY, bandTop, bandBottom });
      return;
    }
    const colX = children[0]!.x;
    for (let j = 0; j <= m; j++) {
      // anchorY: ponta = borda do card ± GAP_Y/2; meio = centro do vão.
      let anchorY: number;
      if (j === 0) anchorY = children[0]!.y - GAP_Y / 2;
      else if (j === m) anchorY = children[m - 1]!.y + children[m - 1]!.height + GAP_Y / 2;
      else anchorY = (children[j - 1]!.y + children[j - 1]!.height + children[j]!.y) / 2;
      // bands: fronteiras no centro dos cards vizinhos.
      const bandTop = j === 0 ? -Infinity : center(children[j - 1]!);
      const bandBottom = j === m ? Infinity : center(children[j]!);
      slots.push({ parentId, index: j, side, colX, anchorY, bandTop, bandBottom });
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
 * Slot selecionado por band vertical + proximidade horizontal, de forma determinística
 * (empate → primeiro na ordem de enumeração). Cada slot carrega a faixa `[bandTop,
 * bandBottom)` que o seleciona; score = dx (dist. horizontal ao centro da coluna) +
 * dy (0 se dentro do band, senão dist. à borda). Exclui slots cujo pai está na
 * subárvore do arrastado. Retorna `null` se o melhor `dx` excede `SLOT_MAX_DISTANCE`
 * (afastamento horizontal → snap-back).
 */
export function nearestSlot(
  point: { x: number; y: number },
  slots: Slot[],
  opts: { excludeSubtree: Set<string> },
): Slot | null {
  let best: Slot | null = null;
  let bestScore = Infinity;
  let bestDx = Infinity;
  for (const slot of slots) {
    if (opts.excludeSubtree.has(slot.parentId)) continue;
    const colCenter = slot.colX + NODE_WIDTH / 2;
    const dx = Math.abs(point.x - colCenter);
    const inBand = point.y >= slot.bandTop && point.y < slot.bandBottom;
    const dy = inBand ? 0 : point.y < slot.bandTop ? slot.bandTop - point.y : point.y - slot.bandBottom;
    const score = dx + dy;
    if (score < bestScore) {
      bestScore = score;
      best = slot;
      bestDx = dx;
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
