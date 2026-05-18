import { describe, it, expect } from 'vitest';
import { simpleTreeLayout } from './treeLayout.js';
import type { NodeDto } from '@mindmap/shared';

function node(id: string, parentId: string | null = null): NodeDto {
  return {
    id,
    mapId: 'map-1',
    parentId,
    title: id,
    sortOrder: 0,
    bgColor: null,
    textColor: null,
    status: null,
    assignee: null,
    isCritical: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('simpleTreeLayout', () => {
  it('lista vazia retorna array vazio', () => {
    expect(simpleTreeLayout([], [])).toEqual([]);
  });

  it('nó único posicionado em (0, 0)', () => {
    const result = simpleTreeLayout([node('root')], []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'root', x: 0, y: 0 });
  });

  it('filhos ficam à direita do pai (x maior)', () => {
    const nodes = [node('root'), node('c1', 'root'), node('c2', 'root')];
    const edges = [
      { parentId: 'root', childId: 'c1' },
      { parentId: 'root', childId: 'c2' },
    ];
    const result = simpleTreeLayout(nodes, edges);
    const root = result.find((p) => p.id === 'root')!;
    const c1 = result.find((p) => p.id === 'c1')!;
    expect(c1.x).toBeGreaterThan(root.x);
  });

  it('todos os nós têm width e height definidos', () => {
    const nodes = [node('root'), node('child', 'root')];
    const edges = [{ parentId: 'root', childId: 'child' }];
    const result = simpleTreeLayout(nodes, edges);
    for (const p of result) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }
  });

  it('nós irmãos ficam em y distintos', () => {
    const nodes = [node('root'), node('c1', 'root'), node('c2', 'root')];
    const edges = [
      { parentId: 'root', childId: 'c1' },
      { parentId: 'root', childId: 'c2' },
    ];
    const result = simpleTreeLayout(nodes, edges);
    const c1 = result.find((p) => p.id === 'c1')!;
    const c2 = result.find((p) => p.id === 'c2')!;
    expect(c1.y).not.toBe(c2.y);
  });

  it('retorna um posicionado por nó de entrada', () => {
    const nodes = [node('root'), node('a', 'root'), node('b', 'a')];
    const edges = [
      { parentId: 'root', childId: 'a' },
      { parentId: 'a', childId: 'b' },
    ];
    const result = simpleTreeLayout(nodes, edges);
    expect(result).toHaveLength(3);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('root');
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});
