import { useMemo } from 'react';
import { flextree } from 'd3-flextree';
import type { NodeDto } from '@mindmap/shared';
import type { TreeNode } from './tree.js';
import { estimateNodeHeight, nodeWidth } from './nodeSize.js';

export function nodeSizeFromHeights(
  heights: ReadonlyMap<string, number> | undefined,
  node: NodeDto,
): number {
  return heights?.get(node.id) ?? estimateNodeHeight(node);
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface LayoutLink {
  source: { x: number; y: number };
  target: { x: number; y: number };
  branchHeadId: string | null;
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

// exportados para slots.ts usar a mesma geometria do layout
export const GAP_X = 40;
export const GAP_Y = 40;

const EMPTY_LAYOUT: LayoutResult = {
  positioned: [],
  links: [],
  bounds: { width: 0, height: 0, minX: 0, minY: 0 },
};

function splitChildren(children: TreeNode[]): { right: TreeNode[]; left: TreeNode[] } {
  const right = children.filter((c) => c.node.side !== 'LEFT');
  const left = children.filter((c) => c.node.side === 'LEFT');
  return { right, left };
}

export function computeTreeLayout(
  tree: TreeNode,
  nodeSizeFn: (node: NodeDto) => number = estimateNodeHeight,
  nodeWidthFn: (node: NodeDto) => number = nodeWidth,
): LayoutResult {
  const positioned: PositionedNode[] = [];
  const links: LayoutLink[] = [];

  // Raiz centrada na origem; a edge raiz→1º nível parte do seu centro (M8-09).
  const rootHeight = nodeSizeFn(tree.node);
  const rootW = nodeWidthFn(tree.node);
  positioned.push({
    id: tree.node.id,
    x: -rootW / 2,
    y: -rootHeight / 2,
    width: rootW,
    height: rootHeight,
    depth: 0,
  });
  const rootCenter = { x: 0, y: 0 };

  const { right, left } = splitChildren(tree.children);

  function layoutSide(sideChildren: TreeNode[], dir: 1 | -1): void {
    if (sideChildren.length === 0) return;

    const sideTree: TreeNode = { node: tree.node, children: sideChildren };
    const layout = flextree<TreeNode>({
      // [breadth, depth] = [altura, largura] no layout horizontal.
      nodeSize: (n) => [nodeSizeFn(n.data.node) + GAP_Y, nodeWidthFn(n.data.node) + GAP_X],
      spacing: 0,
    });
    const sideRoot = layout.hierarchy(sideTree, (d) => d.children);
    layout(sideRoot);

    const breadthOffset = sideRoot.x;
    // n.y é borda-near (van der Ploeg 2013), não centro — constante rootW/2 evita sobreposição entre larguras distintas
    const depthShift = rootW / 2;

    // branchHeadId por nó (id da N2 ancestral, ou o próprio nó quando ele é a N2) — cada
    // nó só precisa do valor do pai, já visitado (each() percorre em breadth-first).
    const branchHeadById = new Map<string, string>();

    sideRoot.each((n) => {
      if (n === sideRoot) return; // raiz já emitida uma única vez

      const height = nodeSizeFn(n.data.node);
      const w = nodeWidthFn(n.data.node);
      const cy = n.x - breadthOffset; // centro vertical do nó no mundo
      const nearX = dir * (n.y - depthShift); // borda do nó voltada para a raiz
      const worldX = dir === 1 ? nearX : nearX - w; // top-left (lado esq. espelhado)
      positioned.push({
        id: n.data.node.id,
        x: worldX,
        y: cy - height / 2,
        width: w,
        height,
        depth: n.depth,
      });

      const branchHeadId =
        n.parent === sideRoot
          ? n.data.node.id
          : (branchHeadById.get(n.parent!.data.node.id) ?? null);
      if (branchHeadId) branchHeadById.set(n.data.node.id, branchHeadId);

      if (n.parent === sideRoot) {
        // 1º nível: sai do centro da raiz (M8-09) em direção ao lado.
        links.push({ source: rootCenter, target: { x: nearX, y: cy }, branchHeadId });
      } else {
        // Níveis profundos: horizontal pai→filho no mesmo lado (M8-10).
        const p = n.parent!;
        const parentCy = p.x - breadthOffset;
        const wp = nodeWidthFn(p.data.node);
        const parentFarX = dir * (p.y - depthShift + wp); // borda externa do pai
        links.push({
          source: { x: parentFarX, y: parentCy },
          target: { x: nearX, y: cy },
          branchHeadId,
        });
      }
    });
  }

  layoutSide(right, 1);
  layoutSide(left, -1);

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
  heights?: ReadonlyMap<string, number>,
  activeResize?: { id: string; width: number } | null,
): LayoutResult {
  return useMemo(() => {
    const tree = buildVisibleTree(nodes, edges);
    if (!tree) return EMPTY_LAYOUT;
    const widthFn = (n: NodeDto) =>
      activeResize?.id === n.id ? activeResize.width : nodeWidth(n);
    return computeTreeLayout(
      tree,
      (node) => nodeSizeFromHeights(heights, node),
      widthFn,
    );
  }, [nodes, edges, heights, activeResize]);
}
