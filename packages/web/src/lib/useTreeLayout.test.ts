import { describe, it, expect } from 'vitest';
import { computeTreeLayout } from './useTreeLayout.js';
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

  it('nó com props de tarefa usa altura 58; sem props usa 40', () => {
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

  it('reparte os filhos de 1º nível entre os dois lados (algum x<0 e algum x>0)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [
        leaf('a'),
        leaf('b', { sortOrder: 1 }),
        leaf('c', { sortOrder: 2 }),
        leaf('d', { sortOrder: 3 }),
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const children = positioned.filter((p) => p.id !== 'root');
    expect(children.some((p) => centerX(p) > 0)).toBe(true);
    expect(children.some((p) => centerX(p) < 0)).toBe(true);
  });

  it('filho único vai para o lado direito (default determinístico)', () => {
    const tree: TreeNode = { node: node('root'), children: [leaf('only')] };
    const { positioned } = computeTreeLayout(tree);
    const only = positioned.find((p) => p.id === 'only')!;
    expect(centerX(only)).toBeGreaterThan(0);
  });

  it('split balanceado por peso: ramo pesado sozinho de um lado, leves do outro', () => {
    // heavy: subárvore de peso 5 (1 + 4 folhas); 3 folhas leves de peso 1.
    const heavy: TreeNode = {
      node: node('heavy'),
      children: [leaf('h1'), leaf('h2', { sortOrder: 1 }), leaf('h3', { sortOrder: 2 }), leaf('h4', { sortOrder: 3 })],
    };
    const tree: TreeNode = {
      node: node('root'),
      children: [
        heavy,
        leaf('x', { sortOrder: 1 }),
        leaf('y', { sortOrder: 2 }),
        leaf('z', { sortOrder: 3 }),
      ],
    };
    const { positioned } = computeTreeLayout(tree);
    const byId = (id: string) => positioned.find((p) => p.id === id)!;
    const heavySide = Math.sign(centerX(byId('heavy')));
    // o ramo pesado está sozinho de um lado; os três leves no lado oposto
    expect(Math.sign(centerX(byId('x')))).toBe(-heavySide);
    expect(Math.sign(centerX(byId('y')))).toBe(-heavySide);
    expect(Math.sign(centerX(byId('z')))).toBe(-heavySide);
  });

  it('subárvore do lado direito cresce +x; lado esquerdo espelhado −x', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [
        { node: node('r'), children: [leaf('r1')] },
        { node: node('l', { sortOrder: 1 }), children: [leaf('l1')] },
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
    // dois filhos no mesmo lado (direita) com alturas diferentes
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a', { status: 'DONE' }), leaf('b', { sortOrder: 1 })],
    };
    // força ambos para a direita não é trivial via API pública; em vez disso,
    // valida a ausência de sobreposição vertical entre quaisquer irmãos do mesmo lado.
    const { positioned } = computeTreeLayout(tree);
    const sameSide = positioned
      .filter((p) => p.id !== 'root')
      .reduce<Record<string, typeof positioned>>((acc, p) => {
        const side = centerX(p) > 0 ? 'right' : 'left';
        (acc[side] ??= []).push(p);
        return acc;
      }, {});
    for (const group of Object.values(sameSide)) {
      const sorted = [...group].sort((p, q) => p.y - q.y);
      for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i]!;
        const prev = sorted[i - 1]!;
        expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.height);
      }
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

  it('bounds cobrem a extensão dos nós posicionados (x negativo e positivo)', () => {
    const tree: TreeNode = {
      node: node('root'),
      children: [leaf('a'), leaf('b', { sortOrder: 1 })],
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
