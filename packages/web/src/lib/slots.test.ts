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

// Helper: slot com geometria neutra (para testes que só verificam parentId/index/side).
function mkSlot(overrides: Pick<Slot, 'parentId' | 'index' | 'side'> & Partial<Slot>): Slot {
  return { colX: 0, anchorY: 0, bandTop: -Infinity, bandBottom: Infinity, ...overrides };
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

  it('lado vazio tem band cobrindo a coluna inteira (-∞, +∞)', () => {
    const tree = sampleTree();
    const { positioned } = computeTreeLayout(tree);
    const slots = computeSlots(tree, positioned, { draggedId: 'B' });
    const emptyLeft = slots.find((s) => s.parentId === 'root' && s.side === 'LEFT')!;
    expect(emptyLeft.bandTop).toBe(-Infinity);
    expect(emptyLeft.bandBottom).toBe(Infinity);
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

  it('bands do primeiro e último slot são abertas (-∞/+∞); slots do meio são fechados', () => {
    const tree = sampleTree();
    const { positioned } = computeTreeLayout(tree);
    // direita tem [A, C] → 3 slots (j=0,1,2)
    const slots = computeSlots(tree, positioned, { draggedId: 'B' });
    const right = slots
      .filter((s) => s.parentId === 'root' && s.side === 'RIGHT')
      .sort((a, b) => a.index - b.index);
    expect(right[0]!.bandTop).toBe(-Infinity);   // j=0: banda aberta no topo
    expect(right[2]!.bandBottom).toBe(Infinity); // j=m: banda aberta no fundo
    // fronteira entre slot 0 e 1 = centro de A; entre slot 1 e 2 = centro de C
    expect(isFinite(right[0]!.bandBottom)).toBe(true);
    expect(isFinite(right[1]!.bandTop)).toBe(true);
    expect(isFinite(right[1]!.bandBottom)).toBe(true);
    expect(isFinite(right[2]!.bandTop)).toBe(true);
    // contiguidade: bandBottom[j] === bandTop[j+1]
    expect(right[0]!.bandBottom).toBe(right[1]!.bandTop);
    expect(right[1]!.bandBottom).toBe(right[2]!.bandTop);
  });
});

describe('nearestSlot', () => {
  // colX=0, colCenter=90 (NODE_WIDTH/2)
  // Dois slots na coluna 'p': p/0 cobre y<60, p/1 cobre y≥60
  // Coluna separada 'sub' em colX=180 (colCenter=270)
  const slots: Slot[] = [
    { parentId: 'p', index: 0, side: null, colX: 0,   anchorY:  20, bandTop: -Infinity, bandBottom: 60       },
    { parentId: 'p', index: 1, side: null, colX: 0,   anchorY: 120, bandTop: 60,        bandBottom: Infinity },
    { parentId: 'sub', index: 0, side: null, colX: 180, anchorY: 20, bandTop: -Infinity, bandBottom: Infinity },
  ];

  it('escolhe o slot cujo band contém o ponto (slot 0, y<60)', () => {
    const near = nearestSlot({ x: 90, y: 25 }, slots, { excludeSubtree: new Set() });
    expect(near?.index).toBe(0);
    expect(near?.parentId).toBe('p');
  });

  it('exclui slots cujo pai está na subárvore do arrastado', () => {
    // ponto perto da coluna 'sub' (colCenter=270); excluindo 'sub' cai na coluna 'p'
    const near = nearestSlot({ x: 270, y: 20 }, slots, { excludeSubtree: new Set(['sub']) });
    expect(near?.parentId).not.toBe('sub');
  });

  it('retorna null quando nada está dentro da distância máxima horizontal', () => {
    const near = nearestSlot({ x: 99999, y: 99999 }, slots, { excludeSubtree: new Set() });
    expect(near).toBeNull();
  });

  it('é determinístico em empate (primeiro na ordem vence)', () => {
    const tie: Slot[] = [
      { parentId: 'a', index: 0, side: null, colX: 0, anchorY: 0, bandTop: -Infinity, bandBottom: Infinity },
      { parentId: 'b', index: 0, side: null, colX: 0, anchorY: 0, bandTop: -Infinity, bandBottom: Infinity },
    ];
    const near = nearestSlot({ x: 90, y: 20 }, tie, { excludeSubtree: new Set() });
    expect(near?.parentId).toBe('a');
  });

  it('troca de slot ao cruzar o centro do card (fronteira em y=60)', () => {
    // y=59 → no band de p/0 [−∞, 60)
    expect(nearestSlot({ x: 90, y: 59 }, slots, { excludeSubtree: new Set() })?.index).toBe(0);
    // y=61 → no band de p/1 [60, ∞); a troca ocorre ao cruzar a fronteira
    expect(nearestSlot({ x: 90, y: 61 }, slots, { excludeSubtree: new Set() })?.index).toBe(1);
  });

  it('anti-flip: múltiplos pontos dentro do mesmo band → sempre o mesmo slot', () => {
    // band de p/0 = [-∞, 60); todos os pontos abaixo de y=60 → slot 0
    const ys = [0, 10, 30, 50, 59];
    const results = ys.map((y) =>
      nearestSlot({ x: 90, y }, slots, { excludeSubtree: new Set() }),
    );
    expect(results.every((s) => s?.index === 0)).toBe(true);
  });

  it('alturas variáveis: band proporcional ao centro do card, sem assimetria', () => {
    // card pequeno (h=40) em y=0..40 → centro=20
    // card grande (h=79) em y=50..129 → centro=89.5
    // slot 0: bandTop=-∞, bandBottom=20 (centro do card pequeno)
    // slot 1: bandTop=20, bandBottom=89.5 (entre os dois centros)
    // slot 2: bandTop=89.5, bandBottom=∞
    const mixed: Slot[] = [
      { parentId: 'p', index: 0, side: null, colX: 0, anchorY:  -5, bandTop: -Infinity, bandBottom: 20   },
      { parentId: 'p', index: 1, side: null, colX: 0, anchorY:  45, bandTop: 20,        bandBottom: 89.5 },
      { parentId: 'p', index: 2, side: null, colX: 0, anchorY: 135, bandTop: 89.5,      bandBottom: Infinity },
    ];
    // acima do centro do card pequeno → slot 0
    expect(nearestSlot({ x: 90, y: 10 }, mixed, { excludeSubtree: new Set() })?.index).toBe(0);
    // no vão entre os dois cards → slot 1
    expect(nearestSlot({ x: 90, y: 50 }, mixed, { excludeSubtree: new Set() })?.index).toBe(1);
    // abaixo do centro do card grande → slot 2
    expect(nearestSlot({ x: 90, y: 100 }, mixed, { excludeSubtree: new Set() })?.index).toBe(2);
  });

  it('snap-back: dx > SLOT_MAX_DISTANCE (NODE_WIDTH * 1.5 = 270) → null', () => {
    // colCenter = 0 + 90 = 90; x=362 → dx=272 > 270 (apenas slots p/0 e p/1 na coluna)
    const near = nearestSlot({ x: 362, y: 20 }, slots.slice(0, 2), { excludeSubtree: new Set() });
    expect(near).toBeNull();
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
    const s = mkSlot({ parentId: 'P', index: 2, side: null });
    expect(slotToMoveBody(s, rootChildren, 'X')).toEqual({ parentId: 'P', index: 2 });
  });

  it('raiz lado RIGHT, j<m → índice global do j-ésimo do lado', () => {
    // dragged A → newSiblings [B,C,D]; RIGHT = [C] (m=1)
    const s = mkSlot({ parentId: 'root', index: 0, side: 'RIGHT' });
    expect(slotToMoveBody(s, rootChildren, 'A')).toEqual({ parentId: 'root', index: 1, side: 'RIGHT' });
  });

  it('raiz lado RIGHT, j==m → após o último do lado', () => {
    const s = mkSlot({ parentId: 'root', index: 1, side: 'RIGHT' });
    // após C (índice 1 em [B,C,D]) → 2
    expect(slotToMoveBody(s, rootChildren, 'A')).toEqual({ parentId: 'root', index: 2, side: 'RIGHT' });
  });

  it('raiz lado LEFT com vários, mapeia cada posição', () => {
    // dragged A → newSiblings [B,C,D]; LEFT = [B,D]
    const left0 = mkSlot({ parentId: 'root', index: 0, side: 'LEFT' });
    const left1 = mkSlot({ parentId: 'root', index: 1, side: 'LEFT' });
    const left2 = mkSlot({ parentId: 'root', index: 2, side: 'LEFT' });
    expect(slotToMoveBody(left0, rootChildren, 'A').index).toBe(0); // antes de B → 0
    expect(slotToMoveBody(left1, rootChildren, 'A').index).toBe(2); // antes de D → 2
    expect(slotToMoveBody(left2, rootChildren, 'A').index).toBe(3); // após D → 3
  });

  it('lado vazio (m==0) → índice no fim; o side faz a colocação visual', () => {
    const only = [{ id: 'A', side: 'RIGHT' as const }];
    const emptyLeft = mkSlot({ parentId: 'root', index: 0, side: 'LEFT' });
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
    const s = mkSlot({ parentId: 'root', index: 1, side: 'RIGHT' });
    const dragged = { id: 'C', parentId: 'root', side: 'RIGHT' as const };
    expect(isOriginSlot(s, dragged, rootChildren)).toBe(true);
  });

  it('slot em outro lado/posição não é origem', () => {
    const other = mkSlot({ parentId: 'root', index: 0, side: 'LEFT' });
    const dragged = { id: 'C', parentId: 'root', side: 'RIGHT' as const };
    expect(isOriginSlot(other, dragged, rootChildren)).toBe(false);
  });

  it('pai não-raiz: origem é a posição entre os irmãos', () => {
    const siblings = [{ id: 'X', side: null }, { id: 'Y', side: null }];
    const s = mkSlot({ parentId: 'P', index: 1, side: null });
    const dragged = { id: 'Y', parentId: 'P', side: null };
    expect(isOriginSlot(s, dragged, siblings)).toBe(true);
  });
});
