import { describe, it, expect } from 'vitest';
import { computeTreeLayout, nodeSizeFromHeights } from './useTreeLayout.js';
import type { TreeNode } from './tree.js';
import { NODE_WIDTH, NODE_HEIGHT_BASE, NODE_HEIGHT_WITH_FOOTER } from './nodeSize.js';
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
    side: null,
    width: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function leaf(id: string, overrides: Partial<NodeDto> = {}): TreeNode {
  return { node: node(id, overrides), children: [] };
}

/** Centro horizontal de um nó posicionado (top-left → centro). */
function centerX(p: { x: number; width: number }): number {
  return p.x + p.width / 2;
}

describe('computeTreeLayout', () => {
  it('todo nó visível recebe uma posição', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), { node: node('b', { sortOrder: 1 }), children: [leaf('c')] }],
    };
    const { positioned } = computeTreeLayout(tree);
    const ids = positioned.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'root']);
  });

  it('número de links = número de nós − 1 (árvore conectada)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [
        leaf('a'),
        { node: node('b', { sortOrder: 1 }), children: [leaf('c'), leaf('d', { sortOrder: 1 })] },
      ],
    };
    const { positioned, links } = computeTreeLayout(tree);
    expect(positioned).toHaveLength(5);
    expect(links).toHaveLength(4);
  });

  it('é determinístico (mesma entrada ⇒ mesma saída)', () => {
    const make = (): TreeNode => ({
      node: node('root'),
      children: [leaf('a'), { node: node('b', { sortOrder: 1 }), children: [leaf('c')] }],
    });
    const first = computeTreeLayout(make());
    const second = computeTreeLayout(make());
    expect(first).toEqual(second);
  });

  it('nó com props de tarefa usa NODE_HEIGHT_WITH_FOOTER; sem props NODE_HEIGHT_BASE', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('task', { status: 'DONE' }), leaf('plain', { sortOrder: 1 })],
    };
    const { positioned } = computeTreeLayout(tree);
    const task = positioned.find((p) => p.id === 'task')!;
    const plain = positioned.find((p) => p.id === 'plain')!;
    expect(task.height).toBe(NODE_HEIGHT_WITH_FOOTER);
    expect(plain.height).toBe(NODE_HEIGHT_BASE);
  });

  it('árvore só com a raiz ⇒ 1 positioned centrado, 0 links', () => {
    const { positioned, links } = computeTreeLayout(leaf('root'));
    expect(positioned).toHaveLength(1);
    expect(links).toHaveLength(0);
    // raiz centrada na origem
    const root = positioned.find((p) => p.id === 'root')!;
    expect(centerX(root)).toBe(0);
    expect(root.y + root.height / 2).toBe(0);
  });

  it('raiz fica centrada na origem (x ≈ 0)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), leaf('b', { sortOrder: 1 }), leaf('c', { sortOrder: 2 })],
    };
    const { positioned } = computeTreeLayout(tree);
    const root = positioned.find((p) => p.id === 'root')!;
    expect(centerX(root)).toBe(0);
  });

  it('reparte os filhos de 1º nível pelo side persistido (algum x<0 e algum x>0)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [
        leaf('a', { side: 'RIGHT' }),
        leaf('b', { sortOrder: 1, side: 'RIGHT' }),
        leaf('c', { sortOrder: 2, side: 'LEFT' }),
        leaf('d', { sortOrder: 3, side: 'LEFT' }),
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const byId = (id: string) => positioned.find((p) => p.id === id)!;
    expect(centerX(byId('a'))).toBeGreaterThan(0);
    expect(centerX(byId('b'))).toBeGreaterThan(0);
    expect(centerX(byId('c'))).toBeLessThan(0);
    expect(centerX(byId('d'))).toBeLessThan(0);
  });

  it('filho de 1º nível com side nulo cai à direita (fallback defensivo)', () => {
    const tree: TreeNode = { node: node('root'), children: [leaf('only')] };
    const { positioned } = computeTreeLayout(tree);
    const only = positioned.find((p) => p.id === 'only')!;
    expect(centerX(only)).toBeGreaterThan(0);
  });

  it('o split segue o side, não o peso: ramo pesado fica do lado que o side manda', () => {
    // heavy é o ramo mais pesado (subárvore 5) mas tem side LEFT; as folhas leves RIGHT.
    // Sob split por peso o heavy iria sozinho à direita — aqui prova-se que segue o side.
    const heavy: TreeNode = {
      node: node('heavy', { side: 'LEFT' }),
      children: [leaf('h1'), leaf('h2', { sortOrder: 1 }), leaf('h3', { sortOrder: 2 }), leaf('h4', { sortOrder: 3 })],
    };
    const tree: TreeNode = {
      node: node('root'),
      children: [
        heavy,
        leaf('x', { sortOrder: 1, side: 'RIGHT' }),
        leaf('y', { sortOrder: 2, side: 'RIGHT' }),
        leaf('z', { sortOrder: 3, side: 'RIGHT' }),
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const byId = (id: string) => positioned.find((p) => p.id === id)!;
    expect(centerX(byId('heavy'))).toBeLessThan(0); // LEFT, apesar de pesado
    expect(centerX(byId('x'))).toBeGreaterThan(0);
    expect(centerX(byId('y'))).toBeGreaterThan(0);
    expect(centerX(byId('z'))).toBeGreaterThan(0);
  });

  it('todos os filhos com o mesmo side ⇒ todos do mesmo lado (sem forçar equilíbrio)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [
        leaf('a', { side: 'RIGHT' }),
        leaf('b', { sortOrder: 1, side: 'RIGHT' }),
        leaf('c', { sortOrder: 2, side: 'RIGHT' }),
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const children = positioned.filter((p) => p.id !== 'root');
    expect(children.every((p) => centerX(p) > 0)).toBe(true);
  });

  it('nó profundo herda o lado do ramo de 1º nível (sem side próprio)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [{ node: node('branch', { side: 'LEFT' }), children: [leaf('deep')] }],
    };
    const { positioned } = computeTreeLayout(tree);
    const byId = (id: string) => positioned.find((p) => p.id === id)!;
    // branch está à esquerda; deep (side null) vive no mesmo grupo → também à esquerda.
    expect(centerX(byId('branch'))).toBeLessThan(0);
    expect(centerX(byId('deep'))).toBeLessThan(centerX(byId('branch')));
  });

  it('subárvore do lado direito cresce +x; lado esquerdo espelhado −x', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [
        { node: node('r', { side: 'RIGHT' }), children: [leaf('r1')] },
        { node: node('l', { sortOrder: 1, side: 'LEFT' }), children: [leaf('l1')] },
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const byId = (id: string) => positioned.find((p) => p.id === id)!;
    // 'r' (1º filho) → direita; seu filho fica mais à direita ainda.
    expect(centerX(byId('r'))).toBeGreaterThan(0);
    expect(centerX(byId('r1'))).toBeGreaterThan(centerX(byId('r')));
    // 'l' (2º filho) → esquerda; seu filho fica mais à esquerda ainda.
    expect(centerX(byId('l'))).toBeLessThan(0);
    expect(centerX(byId('l1'))).toBeLessThan(centerX(byId('l')));
  });

  it('alturas variáveis não se sobrepõem entre irmãos do mesmo lado', () => {
    // Três filhos forçados ao MESMO lado (direita) com alturas distintas (com/sem
    // props de tarefa). Exercita de fato o empilhamento vertical de alturas variáveis
    // — o caso que o teste antigo não cobria (split mandava 1 por lado).
    const tree: TreeNode = {
      node: node('root'),
      children: [
        leaf('a', { side: 'RIGHT', status: 'DONE' }),
        leaf('b', { sortOrder: 1, side: 'RIGHT' }),
        leaf('c', { sortOrder: 2, side: 'RIGHT', status: 'BLOCKED' }),
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const rightGroup = positioned.filter((p) => p.id !== 'root');
    expect(rightGroup).toHaveLength(3);
    expect(rightGroup.every((p) => centerX(p) > 0)).toBe(true);

    const sorted = [...rightGroup].sort((p, q) => p.y - q.y);
    // alturas realmente variam (base vs com rodapé) — senão o caso seria vacuoso de novo.
    expect(new Set(sorted.map((p) => p.height)).size).toBeGreaterThan(1);
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i]!;
      const prev = sorted[i - 1]!;
      expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.height);
    }
  });

  it('edge raiz→1º nível parte do centro da raiz (origem)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), leaf('b', { sortOrder: 1 })],
    };
    const { links } = computeTreeLayout(tree);
    // toda edge de 1º nível tem source na origem
    const firstLevel = links.filter((l) => l.source.x === 0 && l.source.y === 0);
    expect(firstLevel.length).toBe(2);
  });

  it('alturas medidas injetadas alimentam o layout (sem sobreposição com valores reais)', () => {
    // Injeta alturas medidas arbitrárias (não as constantes 40/79) via nodeSizeFn —
    // prova que o layout posiciona pela altura medida, não pela fórmula.
    const tree: TreeNode = {
      node: node('root'),
      children: [
        leaf('a', { side: 'RIGHT' }),
        leaf('b', { sortOrder: 1, side: 'RIGHT' }),
        leaf('c', { sortOrder: 2, side: 'RIGHT' }),
      ],
    };
    const heights = new Map<string, number>([
      ['root', 50],
      ['a', 120],
      ['b', 33],
      ['c', 88],
    ]);
    const { positioned } = computeTreeLayout(tree, (n) => nodeSizeFromHeights(heights, n));
    const byId = (id: string) => positioned.find((p) => p.id === id)!;
    expect(byId('a').height).toBe(120);
    expect(byId('b').height).toBe(33);
    expect(byId('c').height).toBe(88);

    const group = positioned.filter((p) => p.id !== 'root').sort((p, q) => p.y - q.y);
    for (let i = 1; i < group.length; i++) {
      expect(group[i]!.y).toBeGreaterThanOrEqual(group[i - 1]!.y + group[i - 1]!.height);
    }
  });

  it('bounds cobrem a extensão dos nós posicionados (x negativo e positivo)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a', { side: 'RIGHT' }), leaf('b', { sortOrder: 1, side: 'LEFT' })],
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
    // bilateral: extensão atravessa a origem
    expect(minX).toBeLessThan(0);
    expect(maxX).toBeGreaterThan(0);
    expect(NODE_WIDTH).toBe(180);
  });
});

describe('nodeSizeFromHeights', () => {
  it('altura medida vence a estimativa', () => {
    const n = node('x', { status: 'DONE' }); // estimativa seria NODE_HEIGHT_WITH_FOOTER
    const heights = new Map<string, number>([['x', 137]]);
    expect(nodeSizeFromHeights(heights, n)).toBe(137);
  });

  it('sem altura medida, cai na estimativa de 1º paint', () => {
    const plain = node('p');
    const task = node('t', { assignee: 'Ana' });
    const heights = new Map<string, number>([['other', 99]]);
    expect(nodeSizeFromHeights(heights, plain)).toBe(NODE_HEIGHT_BASE);
    expect(nodeSizeFromHeights(heights, task)).toBe(NODE_HEIGHT_WITH_FOOTER);
  });

  it('heights indefinido ⇒ estimativa (primeiro paint, antes de medir)', () => {
    expect(nodeSizeFromHeights(undefined, node('p'))).toBe(NODE_HEIGHT_BASE);
    expect(nodeSizeFromHeights(undefined, node('t', { status: 'PENDING' }))).toBe(
      NODE_HEIGHT_WITH_FOOTER,
    );
  });
});
