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

// Espaço extra entre nós: GAP_Y separa irmãos (eixo vertical/breadth),
// GAP_X separa níveis (eixo horizontal/depth). Exportados para o cálculo de slots
// (lib/slots.ts) usar a mesma geometria do layout.
export const GAP_X = 24;
export const GAP_Y = 24;

const EMPTY_LAYOUT: LayoutResult = {
  positioned: [],
  links: [],
  bounds: { width: 0, height: 0, minX: 0, minY: 0 },
};

/**
 * Reparte os filhos de 1º nível entre os dois lados pelo `side` persistido (M9): cada
 * filho direto da raiz tem um lado fixado (`LEFT`/`RIGHT`); o split não recalcula peso.
 * Cada grupo mantém a ordem de entrada (já em `sortOrder`, vinda de `buildVisibleTree`).
 * Fallback defensivo: `side` nulo num filho de 1º nível conta como `RIGHT` — nunca
 * quebra o render se o backfill não rodou (não persiste nada).
 */
function splitChildren(children: TreeNode[]): { right: TreeNode[]; left: TreeNode[] } {
  const right = children.filter((c) => c.node.side !== 'LEFT');
  const left = children.filter((c) => c.node.side === 'LEFT');
  return { right, left };
}

/**
 * Layout síncrono de altura variável via d3-flextree. Função pura (sem React/DOM),
 * unit-testável. Direção **bidirecional horizontal** (estilo MindMeister): a raiz fica
 * centrada na origem; os filhos de 1º nível são repartidos entre dois lados pelo
 * `side` persistido (M9); cada lado é uma árvore horizontal que cresce afastando-se
 * da raiz (direita → +x; esquerda → −x, espelhada).
 *
 * Geometria do flextree na horizontal: `nodeSize = [breadth=altura, depth=largura]`,
 * então `n.x` é o centro vertical (breadth) do nó e `n.y` a borda do nó no eixo de
 * profundidade (van der Ploeg 2013). Rodamos um flextree por lado (raiz + filhos do
 * lado), alinhamos ambos no ponto da raiz subtraindo o `x` da raiz, e espelhamos o
 * lado esquerdo. As coordenadas finais são top-left, para casar com os nós HTML e o
 * hit-test do drag (`findDropTarget`).
 */
export function computeTreeLayout(
  tree: TreeNode,
  nodeSizeFn: (node: NodeDto) => number = nodeHeight,
): LayoutResult {
  const positioned: PositionedNode[] = [];
  const links: LayoutLink[] = [];

  // Raiz centrada na origem; a edge raiz→1º nível parte do seu centro (M8-09).
  const rootHeight = nodeSizeFn(tree.node);
  positioned.push({
    id: tree.node.id,
    x: -NODE_WIDTH / 2,
    y: -rootHeight / 2,
    width: NODE_WIDTH,
    height: rootHeight,
  });
  const rootCenter = { x: 0, y: 0 };

  const { right, left } = splitChildren(tree.children);

  // Posiciona um lado: roda flextree na raiz + filhos do lado, alinha no ponto da raiz
  // e converte para top-left. `dir` = +1 (direita) ou −1 (esquerda, espelhado).
  function layoutSide(sideChildren: TreeNode[], dir: 1 | -1): void {
    if (sideChildren.length === 0) return;

    const sideTree: TreeNode = { node: tree.node, children: sideChildren };
    const layout = flextree<TreeNode>({
      // [breadth, depth] = [altura, largura] no layout horizontal.
      nodeSize: (n) => [nodeSizeFn(n.data.node) + GAP_Y, NODE_WIDTH + GAP_X],
      spacing: 0,
    });
    const sideRoot = layout.hierarchy(sideTree, (d) => d.children);
    layout(sideRoot);

    // Alinha a raiz deste lado no centro vertical (breadth) global.
    const breadthOffset = sideRoot.x;

    sideRoot.each((n) => {
      if (n === sideRoot) return; // raiz já emitida uma única vez

      const height = nodeSizeFn(n.data.node);
      const cy = n.x - breadthOffset; // centro vertical do nó no mundo
      const worldX = dir * n.y - NODE_WIDTH / 2; // top-left x (espelhado à esquerda)
      positioned.push({ id: n.data.node.id, x: worldX, y: cy - height / 2, width: NODE_WIDTH, height });

      // Âncora do nó voltada para a raiz (borda interna).
      const nearX = dir * (n.y - NODE_WIDTH / 2);
      if (n.parent === sideRoot) {
        // 1º nível: sai do centro da raiz (M8-09) em direção ao lado.
        links.push({ source: rootCenter, target: { x: nearX, y: cy } });
      } else {
        // Níveis profundos: horizontal pai→filho no mesmo lado (M8-10).
        const p = n.parent!;
        const parentCy = p.x - breadthOffset;
        const parentFarX = dir * (p.y + NODE_WIDTH / 2); // borda externa do pai
        links.push({ source: { x: parentFarX, y: parentCy }, target: { x: nearX, y: cy } });
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
