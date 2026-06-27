import { describe, it, expect } from 'vitest';
import type { NodeDto } from '@mindmap/shared';
import type { TreeNode } from '../../../lib/tree.js';
import { computeTreeLayout } from '../../../lib/useTreeLayout.js';
import { buildDragContext, resolveDrop } from './useNodeDrag.js';

function node(id: string, overrides: Partial<NodeDto> = {}): NodeDto {
  return {
    id,
    mapId: 'map-1',
    parentId: overrides.parentId ?? null,
    title: id,
    sortOrder: 0,
    bgColor: null,
    textColor: null,
    status: null,
    assignee: null,
    isCritical: false,
    side: null,
    width: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function leaf(id: string, overrides: Partial<NodeDto> = {}): TreeNode {
  return { node: node(id, { parentId: 'root', ...overrides }), children: [] };
}

// root → A(R,0), B(L,1), C(R,2)→C1
function sample(): { tree: TreeNode; positioned: ReturnType<typeof computeTreeLayout>['positioned'] } {
  const tree: TreeNode = {
    node: node('root'),
    children: [
      leaf('A', { sortOrder: 0, side: 'RIGHT' }),
      leaf('B', { sortOrder: 1, side: 'LEFT' }),
      {
        node: node('C', { parentId: 'root', sortOrder: 2, side: 'RIGHT' }),
        children: [leaf('C1', { parentId: 'C', sortOrder: 0 })],
      },
    ],
  };
  return { tree, positioned: computeTreeLayout(tree).positioned };
}

describe('buildDragContext', () => {
  it('captura info do nó, irmãos ordenados e a subárvore a excluir', () => {
    const { tree, positioned } = sample();
    const ctx = buildDragContext(tree, positioned, 'C')!;
    expect(ctx).not.toBeNull();
    expect(ctx.draggedInfo).toEqual({ id: 'C', parentId: 'root', side: 'RIGHT' });
    expect(ctx.currentSiblingsOrdered.map((s) => s.id)).toEqual(['A', 'B', 'C']);
    // subárvore de C inclui C e C1 (não soltar dentro de si)
    expect(ctx.excludeSubtree.has('C')).toBe(true);
    expect(ctx.excludeSubtree.has('C1')).toBe(true);
    expect(ctx.excludeSubtree.has('A')).toBe(false);
  });

  it('retorna null para um id que não está na árvore', () => {
    const { tree, positioned } = sample();
    expect(buildDragContext(tree, positioned, 'inexistente')).toBeNull();
  });
});

describe('resolveDrop', () => {
  it('place: ponto perto de um slot válido ≠ origem', () => {
    const { tree, positioned } = sample();
    const ctx = buildDragContext(tree, positioned, 'B')!; // arrasta B (esquerda)
    // mira a coluna direita, perto de A
    const a = positioned.find((p) => p.id === 'A')!;
    const res = resolveDrop({ x: a.x + a.width / 2, y: a.y }, ctx);
    expect(res.kind).toBe('place');
  });

  it('noop: ponto na posição de origem do nó arrastado', () => {
    const { tree, positioned } = sample();
    const ctx = buildDragContext(tree, positioned, 'C')!;
    // C é o 2º filho à direita; soltar exatamente onde C está = origem
    const c = positioned.find((p) => p.id === 'C')!;
    const res = resolveDrop({ x: c.x + c.width / 2, y: c.y + c.height / 2 }, ctx);
    expect(res.kind).toBe('noop');
  });

  it('invalid: ponto longe de qualquer slot → snap-back', () => {
    const { tree, positioned } = sample();
    const ctx = buildDragContext(tree, positioned, 'A')!;
    const res = resolveDrop({ x: 99999, y: 99999 }, ctx);
    expect(res.kind).toBe('invalid');
  });

  it('nunca oferece slot dentro da subárvore do arrastado', () => {
    const { tree, positioned } = sample();
    const ctx = buildDragContext(tree, positioned, 'C')!; // subárvore C, C1
    // mira o slot "primeiro filho de C" (dentro da própria subárvore)
    const c1 = positioned.find((p) => p.id === 'C1')!;
    const res = resolveDrop({ x: c1.x + c1.width / 2, y: c1.y + c1.height / 2 }, ctx);
    if (res.kind === 'place') {
      expect(ctx.excludeSubtree.has(res.slot.parentId)).toBe(false);
    }
  });
});
