import { describe, it, expect } from 'vitest';
import { buildTree, visibleNodes } from './tree.js';
import type { NodeDto } from '@mindmap/shared';

function makeNode(overrides: Partial<NodeDto> & { id: string }): NodeDto {
  return {
    mapId: 'map-1',
    parentId: null,
    title: overrides.id,
    sortOrder: 0,
    bgColor: null,
    textColor: null,
    status: null,
    assignee: null,
    isCritical: false,
    side: null,
    width: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const root = makeNode({ id: 'root', parentId: null, sortOrder: 0 });
const child1 = makeNode({ id: 'c1', parentId: 'root', sortOrder: 0 });
const child2 = makeNode({ id: 'c2', parentId: 'root', sortOrder: 1 });
const grandchild = makeNode({ id: 'gc1', parentId: 'c1', sortOrder: 0 });

describe('buildTree', () => {
  it('árvore com 1 nó (só root)', () => {
    const tree = buildTree([root]);
    expect(tree?.node.id).toBe('root');
    expect(tree?.children).toHaveLength(0);
  });

  it('árvore com múltiplos níveis', () => {
    const tree = buildTree([root, child1, child2, grandchild]);
    expect(tree?.children).toHaveLength(2);
    expect(tree?.children[0]?.children).toHaveLength(1);
    expect(tree?.children[0]?.children[0]?.node.id).toBe('gc1');
  });

  it('filhos ordenados por sortOrder', () => {
    const reversed = [
      makeNode({ id: 'c3', parentId: 'root', sortOrder: 2 }),
      child1,
      child2,
    ];
    const tree = buildTree([root, ...reversed]);
    const ids = tree?.children.map((c) => c.node.id);
    expect(ids).toEqual(['c1', 'c2', 'c3']);
  });

  it('retorna null se não há root', () => {
    const orphan = makeNode({ id: 'orphan', parentId: 'missing', sortOrder: 0 });
    expect(buildTree([orphan])).toBeNull();
  });
});

describe('visibleNodes', () => {
  it('lista vazia para root null', () => {
    const { nodes, edges } = visibleNodes(null, new Set());
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('exibe todos os nós sem collapsed', () => {
    const tree = buildTree([root, child1, child2, grandchild])!;
    const { nodes, edges } = visibleNodes(tree, new Set());
    expect(nodes).toHaveLength(4);
    expect(edges).toHaveLength(3);
  });

  it('collapsedIds oculta subárvore mas mantém o nó colapsado', () => {
    const tree = buildTree([root, child1, child2, grandchild])!;
    const { nodes } = visibleNodes(tree, new Set(['c1']));
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain('c1');
    expect(ids).not.toContain('gc1');
    expect(nodes).toHaveLength(3);
  });

  it('collapsedIds em nó folha é no-op', () => {
    const tree = buildTree([root, child1])!;
    const { nodes } = visibleNodes(tree, new Set(['c1']));
    expect(nodes).toHaveLength(2);
  });
});
