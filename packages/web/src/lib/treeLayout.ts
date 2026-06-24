import type { NodeDto } from '@mindmap/shared';
import type { PositionedNode } from './useLayoutedTree.js';
import { NODE_HEIGHT_BASE, NODE_WIDTH, nodeHeight } from './nodeSize.js';

const GAP_X = 60;
const GAP_Y = 20;

export function simpleTreeLayout(
  nodes: NodeDto[],
  edges: Array<{ parentId: string; childId: string }>,
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const nodeById = new Map<string, NodeDto>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
  }

  const childrenOf = new Map<string, string[]>();
  const hasParentEdge = new Set<string>();
  for (const e of edges) {
    const kids = childrenOf.get(e.parentId) ?? [];
    kids.push(e.childId);
    childrenOf.set(e.parentId, kids);
    hasParentEdge.add(e.childId);
  }

  const rootNode = nodes.find((n) => !hasParentEdge.has(n.id));
  if (!rootNode) {
    let stackY = 0;
    return nodes.map((n) => {
      const y = stackY;
      const height = nodeHeight(n);
      stackY += height + GAP_Y;
      return {
        id: n.id,
        x: 0,
        y,
        width: NODE_WIDTH,
        height,
      };
    });
  }

  const result: PositionedNode[] = [];
  let nextY = 0;

  function place(nodeId: string, depth: number): number {
    const x = depth * (NODE_WIDTH + GAP_X);
    const node = nodeById.get(nodeId);
    const height = node ? nodeHeight(node) : NODE_HEIGHT_BASE;
    const kids = childrenOf.get(nodeId) ?? [];

    if (kids.length === 0) {
      const y = nextY;
      result.push({ id: nodeId, x, y, width: NODE_WIDTH, height });
      nextY += height + GAP_Y;
      return y;
    }

    const childYs = kids.map((k) => place(k, depth + 1));
    const y = (childYs[0]! + childYs[childYs.length - 1]!) / 2;
    result.push({ id: nodeId, x, y, width: NODE_WIDTH, height });
    return y;
  }

  place(rootNode.id, 0);
  return result;
}
