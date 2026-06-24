import ELK from 'elkjs/lib/elk.bundled.js';
import type { NodeDto } from '@mindmap/shared';
import { NODE_HEIGHT_BASE, NODE_WIDTH, nodeHeight } from './nodeSize.js';

const elk = new ELK();

export interface LayoutInput {
  nodes: NodeDto[];
  edges: Array<{ parentId: string; childId: string }>;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutOutput {
  positioned: PositionedNode[];
}

export interface LayoutError {
  error: string;
}

self.onmessage = async (event: MessageEvent<LayoutInput>) => {
  const { nodes, edges } = event.data;

  try {
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '20',
        'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      },
      children: nodes.map((n) => ({
        id: n.id,
        width: NODE_WIDTH,
        height: nodeHeight(n),
      })),
      edges: edges.map((e) => ({
        id: `${e.parentId}-${e.childId}`,
        sources: [e.parentId],
        targets: [e.childId],
      })),
    };

    const layout = await elk.layout(graph);

    const positioned: PositionedNode[] = (layout.children ?? []).map((child) => ({
      id: child.id,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? NODE_WIDTH,
      height: child.height ?? NODE_HEIGHT_BASE,
    }));

    self.postMessage({ positioned } satisfies LayoutOutput);
  } catch (err) {
    self.postMessage({ error: String(err) } satisfies LayoutError);
  }
};
