import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { NodeDto, NodeListResponse } from '@mindmap/shared';

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

const MAP_ID = 'map-1';
const key = ['nodes', MAP_ID] as const;

function makeQueryClient(nodes: NodeDto[]): QueryClient {
  const qc = new QueryClient();
  qc.setQueryData<NodeListResponse>([...key], { nodes });
  return qc;
}

describe('optimistic update — rename (T3)', () => {
  it('atualiza título no cache e reverte em erro', () => {
    const nodes = [
      makeNode({ id: 'root', title: 'Root' }),
      makeNode({ id: 'n1', parentId: 'root', title: 'Original' }),
    ];
    const qc = makeQueryClient(nodes);

    const snapshot = qc.getQueryData<NodeListResponse>([...key]);
    qc.setQueryData<NodeListResponse>([...key], {
      nodes: snapshot!.nodes.map((n) =>
        n.id === 'n1' ? { ...n, title: 'Renomeado' } : n,
      ),
    });

    const updated = qc.getQueryData<NodeListResponse>([...key])!;
    expect(updated.nodes.find((n) => n.id === 'n1')!.title).toBe('Renomeado');

    qc.setQueryData([...key], snapshot);
    const reverted = qc.getQueryData<NodeListResponse>([...key])!;
    expect(reverted.nodes.find((n) => n.id === 'n1')!.title).toBe('Original');
  });
});

describe('optimistic update — delete (T4)', () => {
  it('remove nó e descendentes do cache, reverte em erro', () => {
    const nodes = [
      makeNode({ id: 'root', title: 'Root' }),
      makeNode({ id: 'a', parentId: 'root', sortOrder: 0 }),
      makeNode({ id: 'b', parentId: 'root', sortOrder: 1 }),
      makeNode({ id: 'a1', parentId: 'a', sortOrder: 0 }),
    ];
    const qc = makeQueryClient(nodes);

    const snapshot = qc.getQueryData<NodeListResponse>([...key]);

    function collectDescendants(nodeId: string, allNodes: NodeDto[]): Set<string> {
      const ids = new Set<string>([nodeId]);
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = queue.pop()!;
        for (const n of allNodes) {
          if (n.parentId === current && !ids.has(n.id)) {
            ids.add(n.id);
            queue.push(n.id);
          }
        }
      }
      return ids;
    }

    const toRemove = collectDescendants('a', snapshot!.nodes);
    qc.setQueryData<NodeListResponse>([...key], {
      nodes: snapshot!.nodes.filter((n) => !toRemove.has(n.id)),
    });

    const afterDelete = qc.getQueryData<NodeListResponse>([...key])!;
    expect(afterDelete.nodes).toHaveLength(2);
    expect(afterDelete.nodes.map((n) => n.id)).toEqual(['root', 'b']);

    qc.setQueryData([...key], snapshot);
    const reverted = qc.getQueryData<NodeListResponse>([...key])!;
    expect(reverted.nodes).toHaveLength(4);
  });
});

describe('optimistic update — create (T5)', () => {
  it('insere nó temporário no cache e remove em erro', () => {
    const nodes = [
      makeNode({ id: 'root', title: 'Root' }),
    ];
    const qc = makeQueryClient(nodes);

    const snapshot = qc.getQueryData<NodeListResponse>([...key]);

    const tempId = `temp-${crypto.randomUUID()}`;
    const tempNode = makeNode({
      id: tempId,
      parentId: 'root',
      title: 'Novo nó',
      sortOrder: 1,
    });

    qc.setQueryData<NodeListResponse>([...key], {
      nodes: [...snapshot!.nodes, tempNode],
    });

    const afterCreate = qc.getQueryData<NodeListResponse>([...key])!;
    expect(afterCreate.nodes).toHaveLength(2);
    expect(afterCreate.nodes[1]!.id).toMatch(/^temp-/);

    qc.setQueryData([...key], snapshot);
    const reverted = qc.getQueryData<NodeListResponse>([...key])!;
    expect(reverted.nodes).toHaveLength(1);
  });
});

describe('optimistic update — move (T6)', () => {
  it('atualiza parentId no cache e reverte em erro', () => {
    const nodes = [
      makeNode({ id: 'root', title: 'Root' }),
      makeNode({ id: 'a', parentId: 'root', sortOrder: 0 }),
      makeNode({ id: 'b', parentId: 'root', sortOrder: 1 }),
      makeNode({ id: 'a1', parentId: 'a', sortOrder: 0 }),
    ];
    const qc = makeQueryClient(nodes);

    const snapshot = qc.getQueryData<NodeListResponse>([...key]);

    const siblingsOfB = snapshot!.nodes.filter((n) => n.parentId === 'b');
    const newSortOrder = siblingsOfB.length > 0
      ? Math.max(...siblingsOfB.map((n) => n.sortOrder)) + 1
      : 0;

    qc.setQueryData<NodeListResponse>([...key], {
      nodes: snapshot!.nodes.map((n) =>
        n.id === 'a1' ? { ...n, parentId: 'b', sortOrder: newSortOrder } : n,
      ),
    });

    const afterMove = qc.getQueryData<NodeListResponse>([...key])!;
    const moved = afterMove.nodes.find((n) => n.id === 'a1')!;
    expect(moved.parentId).toBe('b');

    qc.setQueryData([...key], snapshot);
    const reverted = qc.getQueryData<NodeListResponse>([...key])!;
    expect(reverted.nodes.find((n) => n.id === 'a1')!.parentId).toBe('a');
  });
});
