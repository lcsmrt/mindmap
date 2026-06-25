import { describe, it, expect } from 'vitest';
import type { NodeDto } from '@mindmap/shared';
import type { TreeNode } from './tree.js';
import { computeTreeLayout } from './useTreeLayout.js';
import { computeSlots, nearestSlot, slotToMoveBody, isOriginSlot, type Slot } from './slots.js';

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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function leaf(id: string, overrides: Partial<NodeDto> = {}): TreeNode {
  return { node: node(id, { parentId: 'root', ...overrides }), children: [] };
}

// Árvore: root → A(R,0), B(L,1), C(R,2)→C1
function sampleTree(): TreeNode {
  return {
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
}

describe('computeSlots', () => {
  it('gera slots dos dois lados da raiz (entre/around os filhos de cada lado)', () => {
    const tree = sampleTree();
    const { positioned } = computeTreeLayout(tree);
    const slots = computeSlots(tree, positioned, { draggedId: 'C1' });

    const rootRight = slots.filter((s) => s.parentId === 'root' && s.side === 'RIGHT');
    const rootLeft = slots.filter((s) => s.parentId === 'root' && s.side === 'LEFT');
    // direita = [A, C] → 3 slots (0,1,2); esquerda = [B] → 2 slots (0,1)
    expect(rootRight.map((s) => s.index).sort()).toEqual([0, 1, 2]);
    expect(rootLeft.map((s) => s.index).sort()).toEqual([0, 1]);
  });

  it('lado vazio da raiz gera exatamente 1 slot', () => {
    const tree = sampleTree();
    const { positioned } = computeTreeLayout(tree);
    // arrastando B (único filho à esquerda) → lado esquerdo fica vazio
    const slots = computeSlots(tree, positioned, { draggedId: 'B' });
    const rootLeft = slots.filter((s) => s.parentId === 'root' && s.side === 'LEFT');
    expect(rootLeft).toHaveLength(1);
    expect(rootLeft[0]!.index).toBe(0);
  });

  it('pai profundo com filho gera slots side=null; folha gera 1 slot "primeiro filho"', () => {
    const tree = sampleTree();
    const { positioned } = computeTreeLayout(tree);
    const slots = computeSlots(tree, positioned, { draggedId: 'A' });
    const underC = slots.filter((s) => s.parentId === 'C');
    expect(underC.every((s) => s.side === null)).toBe(true);
    expect(underC.map((s) => s.index).sort()).toEqual([0, 1]); // C tem 1 filho (C1)

    const underA = slots.filter((s) => s.parentId === 'A'); // A é folha
    expect(underA).toHaveLength(1);
    expect(underA[0]!.side).toBeNull();
  });
});

describe('nearestSlot', () => {
  const slots: Slot[] = [
    { parentId: 'p', index: 0, side: null, x: 0, y: 0, height: 40 },
    { parentId: 'p', index: 1, side: null, x: 0, y: 100, height: 40 },
    { parentId: 'sub', index: 0, side: null, x: 500, y: 0, height: 40 },
  ];

  it('escolhe o slot mais próximo do ponto', () => {
    // centro do slot 0 ≈ (90, 20); ponto perto dele
    const near = nearestSlot({ x: 90, y: 25 }, slots, { excludeSubtree: new Set() });
    expect(near?.index).toBe(0);
  });

  it('exclui slots cujo pai está na subárvore do arrastado', () => {
    const near = nearestSlot({ x: 590, y: 20 }, slots, { excludeSubtree: new Set(['sub']) });
    // 'sub' está excluído → cai no próximo mais próximo (não retorna 'sub')
    expect(near?.parentId).not.toBe('sub');
  });

  it('retorna null quando nada está dentro da distância máxima', () => {
    const near = nearestSlot({ x: 99999, y: 99999 }, slots, { excludeSubtree: new Set() });
    expect(near).toBeNull();
  });

  it('é determinístico em empate (primeiro na ordem vence)', () => {
    const tie: Slot[] = [
      { parentId: 'a', index: 0, side: null, x: 0, y: 0, height: 40 },
      { parentId: 'b', index: 0, side: null, x: 0, y: 0, height: 40 },
    ];
    const near = nearestSlot({ x: 90, y: 20 }, tie, { excludeSubtree: new Set() });
    expect(near?.parentId).toBe('a');
  });
});

describe('slotToMoveBody', () => {
  // raiz: [A(R,0), B(L,1), C(R,2), D(L,3)] ordenados por sortOrder
  const rootChildren = [
    { id: 'A', side: 'RIGHT' as const },
    { id: 'B', side: 'LEFT' as const },
    { id: 'C', side: 'RIGHT' as const },
    { id: 'D', side: 'LEFT' as const },
  ];

  it('pai não-raiz: índice local direto, sem side', () => {
    const slot: Slot = { parentId: 'P', index: 2, side: null, x: 0, y: 0, height: 40 };
    expect(slotToMoveBody(slot, rootChildren, 'X')).toEqual({ parentId: 'P', index: 2 });
  });

  it('raiz lado RIGHT, j<m → índice global do j-ésimo do lado', () => {
    // dragged A → newSiblings [B,C,D]; RIGHT = [C] (m=1)
    const slot: Slot = { parentId: 'root', index: 0, side: 'RIGHT', x: 0, y: 0, height: 40 };
    expect(slotToMoveBody(slot, rootChildren, 'A')).toEqual({ parentId: 'root', index: 1, side: 'RIGHT' });
  });

  it('raiz lado RIGHT, j==m → após o último do lado', () => {
    const slot: Slot = { parentId: 'root', index: 1, side: 'RIGHT', x: 0, y: 0, height: 40 };
    // após C (índice 1 em [B,C,D]) → 2
    expect(slotToMoveBody(slot, rootChildren, 'A')).toEqual({ parentId: 'root', index: 2, side: 'RIGHT' });
  });

  it('raiz lado LEFT com vários, mapeia cada posição', () => {
    // dragged A → newSiblings [B,C,D]; LEFT = [B,D]
    const left0: Slot = { parentId: 'root', index: 0, side: 'LEFT', x: 0, y: 0, height: 40 };
    const left1: Slot = { parentId: 'root', index: 1, side: 'LEFT', x: 0, y: 0, height: 40 };
    const left2: Slot = { parentId: 'root', index: 2, side: 'LEFT', x: 0, y: 0, height: 40 };
    expect(slotToMoveBody(left0, rootChildren, 'A').index).toBe(0); // antes de B → 0
    expect(slotToMoveBody(left1, rootChildren, 'A').index).toBe(2); // antes de D → 2
    expect(slotToMoveBody(left2, rootChildren, 'A').index).toBe(3); // após D → 3
  });

  it('lado vazio (m==0) → índice no fim; o side faz a colocação visual', () => {
    const only = [{ id: 'A', side: 'RIGHT' as const }];
    const emptyLeft: Slot = { parentId: 'root', index: 0, side: 'LEFT', x: 0, y: 0, height: 40 };
    // dragged A → newSiblings []; LEFT vazio → index 0 (length)
    expect(slotToMoveBody(emptyLeft, only, 'A')).toEqual({ parentId: 'root', index: 0, side: 'LEFT' });
  });
});

describe('isOriginSlot (no-op)', () => {
  const rootChildren = [
    { id: 'A', side: 'RIGHT' as const },
    { id: 'B', side: 'LEFT' as const },
    { id: 'C', side: 'RIGHT' as const },
  ];

  it('slot na posição atual do nó (mesmo pai/lado/posição local) é origem', () => {
    // C é o 2º filho RIGHT (posição local 1 entre [A,C]) → slot RIGHT index 1 = origem
    const slot: Slot = { parentId: 'root', index: 1, side: 'RIGHT', x: 0, y: 0, height: 40 };
    const dragged = { id: 'C', parentId: 'root', side: 'RIGHT' as const };
    expect(isOriginSlot(slot, dragged, rootChildren)).toBe(true);
  });

  it('slot em outro lado/posição não é origem', () => {
    const other: Slot = { parentId: 'root', index: 0, side: 'LEFT', x: 0, y: 0, height: 40 };
    const dragged = { id: 'C', parentId: 'root', side: 'RIGHT' as const };
    expect(isOriginSlot(other, dragged, rootChildren)).toBe(false);
  });

  it('pai não-raiz: origem é a posição entre os irmãos', () => {
    const siblings = [{ id: 'X', side: null }, { id: 'Y', side: null }];
    const slot: Slot = { parentId: 'P', index: 1, side: null, x: 0, y: 0, height: 40 };
    const dragged = { id: 'Y', parentId: 'P', side: null };
    expect(isOriginSlot(slot, dragged, siblings)).toBe(true);
  });
});
