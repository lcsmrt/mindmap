import type { NodeDto } from '@mindmap/shared';
import type { PositionedNode } from './useLayoutedTree.js';

const NODE_W = 180;
const NODE_H = 40;
const GAP_X = 60;
const GAP_Y = 20;

export function simpleTreeLayout(
  nodes: NodeDto[],
  edges: Array<{ parentId: string; childId: string }>,
): PositionedNode[] {
  if (nodes.length === 0) return [];

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
    return nodes.map((n, i) => ({
      id: n.id,
      x: 0,
      y: i * (NODE_H + GAP_Y),
      width: NODE_W,
      height: NODE_H,
    }));
  }

  const result: PositionedNode[] = [];
  let nextY = 0;

  function place(nodeId: string, depth: number): number {
    const x = depth * (NODE_W + GAP_X);
    const kids = childrenOf.get(nodeId) ?? [];

    if (kids.length === 0) {
      const y = nextY;
      result.push({ id: nodeId, x, y, width: NODE_W, height: NODE_H });
      nextY += NODE_H + GAP_Y;
      return y;
    }

    const childYs = kids.map((k) => place(k, depth + 1));
    const y = (childYs[0]! + childYs[childYs.length - 1]!) / 2;
    result.push({ id: nodeId, x, y, width: NODE_W, height: NODE_H });
    return y;
  }

  place(rootNode.id, 0);
  return result;
}
