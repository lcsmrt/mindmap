import type { NodeDto } from '@mindmap/shared';

export interface TreeNode {
  node: NodeDto;
  children: TreeNode[];
}

export function buildTree(nodes: NodeDto[]): TreeNode | null {
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return null;

  const byParent = new Map<string, NodeDto[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function buildSubtree(node: NodeDto): TreeNode {
    const children = (byParent.get(node.id) ?? []).map(buildSubtree);
    return { node, children };
  }

  return buildSubtree(root);
}

export function visibleNodes(
  root: TreeNode | null,
  collapsedIds: ReadonlySet<string>,
): { nodes: NodeDto[]; edges: Array<{ parentId: string; childId: string }> } {
  if (!root) return { nodes: [], edges: [] };

  const nodes: NodeDto[] = [];
  const edges: Array<{ parentId: string; childId: string }> = [];

  function walk(treeNode: TreeNode): void {
    nodes.push(treeNode.node);
    if (collapsedIds.has(treeNode.node.id)) return;
    for (const child of treeNode.children) {
      edges.push({ parentId: treeNode.node.id, childId: child.node.id });
      walk(child);
    }
  }

  walk(root);
  return { nodes, edges };
}
