import { describe, it, expect } from 'vitest';
import { computeTreeLayout } from './useTreeLayout.js';
import type { TreeNode } from './tree.js';
import { NODE_HEIGHT_BASE, NODE_HEIGHT_WITH_FOOTER } from './nodeSize.js';
import type { NodeDto } from '@mindmap/shared';

function node(id: string, overrides: Partial<NodeDto> = {}): NodeDto {
  return {
    id,
    mapId: 'map-1',
    parentId: null,
    title: id,
    sortOrder: 0,
    bgColor: null,
    textColor: null,
    status: null,
    assignee: null,
    isCritical: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function leaf(id: string, overrides: Partial<NodeDto> = {}): TreeNode {
  return { node: node(id, overrides), children: [] };
}

describe('computeTreeLayout', () => {
  it('todo nó visível recebe uma posição', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), { node: node('b'), children: [leaf('c')] }],
    };
    const { positioned } = computeTreeLayout(tree);
    const ids = positioned.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'root']);
  });

  it('número de links = número de nós − 1 (árvore conectada)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), { node: node('b'), children: [leaf('c'), leaf('d')] }],
    };
    const { positioned, links } = computeTreeLayout(tree);
    expect(positioned).toHaveLength(5);
    expect(links).toHaveLength(4);
  });

  it('é determinístico (mesma entrada ⇒ mesma saída)', () => {
    const make = (): TreeNode => ({
      node: node('root'),
      children: [leaf('a'), { node: node('b'), children: [leaf('c')] }],
    });
    const first = computeTreeLayout(make());
    const second = computeTreeLayout(make());
    expect(first).toEqual(second);
  });

  it('nó com props de tarefa usa altura 58; sem props usa 40', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('task', { status: 'DONE' }), leaf('plain')],
    };
    const { positioned } = computeTreeLayout(tree);
    const task = positioned.find((p) => p.id === 'task')!;
    const plain = positioned.find((p) => p.id === 'plain')!;
    expect(task.height).toBe(NODE_HEIGHT_WITH_FOOTER);
    expect(plain.height).toBe(NODE_HEIGHT_BASE);
  });

  it('árvore só com a raiz ⇒ 1 positioned, 0 links', () => {
    const { positioned, links } = computeTreeLayout(leaf('root'));
    expect(positioned).toHaveLength(1);
    expect(links).toHaveLength(0);
  });

  it('bounds cobrem a extensão dos nós posicionados', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), leaf('b')],
    };
    const { positioned, bounds } = computeTreeLayout(tree);
    const minX = Math.min(...positioned.map((p) => p.x));
    const minY = Math.min(...positioned.map((p) => p.y));
    const maxX = Math.max(...positioned.map((p) => p.x + p.width));
    const maxY = Math.max(...positioned.map((p) => p.y + p.height));
    expect(bounds.minX).toBe(minX);
    expect(bounds.minY).toBe(minY);
    expect(bounds.width).toBe(maxX - minX);
    expect(bounds.height).toBe(maxY - minY);
  });
});
