import { useMemo } from 'react';
import { flextree } from 'd3-flextree';
import type { NodeDto } from '@mindmap/shared';
import type { TreeNode } from './tree.js';
import { NODE_WIDTH, nodeHeight } from './nodeSize.js';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutLink {
  source: { x: number; y: number };
  target: { x: number; y: number };
}

export interface LayoutBounds {
  width: number;
  height: number;
  minX: number;
  minY: number;
}

export interface LayoutResult {
  positioned: PositionedNode[];
  links: LayoutLink[];
  bounds: LayoutBounds;
}

// Espaço extra entre nós: GAP_X separa irmãos, GAP_Y separa níveis.
const GAP_X = 24;
const GAP_Y = 24;

const EMPTY_LAYOUT: LayoutResult = {
  positioned: [],
  links: [],
  bounds: { width: 0, height: 0, minX: 0, minY: 0 },
};

/**
 * Layout síncrono de altura variável via d3-flextree. Função pura (sem React/DOM),
 * unit-testável. Direção vertical: raiz no topo, profundidade para baixo.
 *
 * O flextree posiciona cada nó com `x` no centro da largura e `y` na borda superior
 * do nó (van der Ploeg 2013). Convertemos para coordenadas top-left para casar com o
 * posicionamento absoluto dos nós HTML e com o hit-test do drag (`findDropTarget`).
 */
export function computeTreeLayout(
  tree: TreeNode,
  nodeSizeFn: (node: NodeDto) => number = nodeHeight,
): LayoutResult {
  const layout = flextree<TreeNode>({
    // [breadth, depth] = [largura, altura] no layout vertical.
    nodeSize: (n) => [NODE_WIDTH + GAP_X, nodeSizeFn(n.data.node) + GAP_Y],
    spacing: 0,
  });

  const root = layout.hierarchy(tree, (d) => d.children);
  layout(root);

  const positioned: PositionedNode[] = [];
  const links: LayoutLink[] = [];

  root.each((n) => {
    const height = nodeSizeFn(n.data.node);
    positioned.push({
      id: n.data.node.id,
      x: n.x - NODE_WIDTH / 2,
      y: n.y,
      width: NODE_WIDTH,
      height,
    });

    if (n.parent) {
      links.push({
        // do centro-base do pai ao centro-topo do filho
        source: { x: n.parent.x, y: n.parent.y + nodeSizeFn(n.parent.data.node) },
        target: { x: n.x, y: n.y },
      });
    }
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positioned) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }

  return {
    positioned,
    links,
    bounds: { width: maxX - minX, height: maxY - minY, minX, minY },
  };
}

/**
 * Reconstrói a árvore visível a partir dos nós/arestas já filtrados por
 * `visibleNodes` (subárvores colapsadas removidas). A raiz visível é o único nó
 * que não aparece como filho em nenhuma aresta.
 */
function buildVisibleTree(
  nodes: NodeDto[],
  edges: Array<{ parentId: string; childId: string }>,
): TreeNode | null {
  if (nodes.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const childIds = new Set(edges.map((e) => e.childId));
  const rootDto = nodes.find((n) => !childIds.has(n.id));
  if (!rootDto) return null;

  const childrenOf = new Map<string, NodeDto[]>();
  for (const e of edges) {
    const child = byId.get(e.childId);
    if (!child) continue;
    const list = childrenOf.get(e.parentId) ?? [];
    list.push(child);
    childrenOf.set(e.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function build(node: NodeDto): TreeNode {
    return { node, children: (childrenOf.get(node.id) ?? []).map(build) };
  }
  return build(rootDto);
}

export function useTreeLayout(
  nodes: NodeDto[],
  edges: Array<{ parentId: string; childId: string }>,
): LayoutResult {
  return useMemo(() => {
    const tree = buildVisibleTree(nodes, edges);
    if (!tree) return EMPTY_LAYOUT;
    return computeTreeLayout(tree);
  }, [nodes, edges]);
}
