import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  NodeListResponse,
  NodeDto,
  CreateNodeBody,
  UpdateNodeBody,
  MoveNodeBody,
} from '@mindmap/shared';
import type { QueryOptions } from './types.js';
import { ApiError, request } from './_request.js';
import { useToast } from '@/components/ui/toast.js';
import { uid } from '@/lib/uid.js';

function shouldRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 3) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return true;
}

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 4000);
}

async function fetchNodes(mapId: string): Promise<NodeListResponse> {
  return request<NodeListResponse>(`/api/maps/${mapId}/nodes`);
}

async function createNodeRequest(body: CreateNodeBody): Promise<NodeDto> {
  return request<NodeDto>('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function updateNodeRequest(id: string, body: UpdateNodeBody): Promise<NodeDto> {
  return request<NodeDto>(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function deleteNodeRequest(id: string): Promise<void> {
  return request<void>(`/api/nodes/${id}`, { method: 'DELETE' });
}

async function moveNodeRequest(id: string, body: MoveNodeBody): Promise<NodeDto> {
  return request<NodeDto>(`/api/nodes/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const useNodes = (mapId?: string, options?: QueryOptions<NodeListResponse>) =>
  useQuery({
    queryKey: ['nodes', mapId],
    queryFn: () => fetchNodes(mapId!),
    enabled: !!mapId && (options?.enabled ?? true),
    ...options,
  });

export const useCreateNode = (options?: { onSuccess?: (data: NodeDto) => void }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: createNodeRequest,
    retry: shouldRetry,
    retryDelay,
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ['nodes', body.mapId] });
      const snapshot = queryClient.getQueryData<NodeListResponse>(['nodes', body.mapId]);
      if (snapshot) {
        const siblings = snapshot.nodes.filter((n) => n.parentId === body.parentId);
        const maxSort = siblings.length > 0
          ? Math.max(...siblings.map((n) => n.sortOrder))
          : -1;
        const tempNode: NodeDto = {
          id: `temp-${uid()}`,
          mapId: body.mapId,
          parentId: body.parentId,
          title: body.title,
          sortOrder: maxSort + 1,
          bgColor: null,
          textColor: null,
          status: null,
          assignee: null,
          isCritical: false,
          side: null,
          width: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<NodeListResponse>(['nodes', body.mapId], {
          nodes: [...snapshot.nodes, tempNode],
        });
      }
      return { snapshot };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error, body, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['nodes', body.mapId], context.snapshot);
      }
      toast({ variant: 'error', description: `Erro ao criar nó: ${error.message}` });
    },
    onSettled: (_data, _error, body) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', body.mapId] });
    },
  });
};

export const useUpdateNode = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; mapId: string; body: UpdateNodeBody }) =>
      updateNodeRequest(id, body),
    retry: shouldRetry,
    retryDelay,
    onMutate: async ({ id, mapId, body }) => {
      await queryClient.cancelQueries({ queryKey: ['nodes', mapId] });
      const snapshot = queryClient.getQueryData<NodeListResponse>(['nodes', mapId]);
      if (snapshot) {
        queryClient.setQueryData<NodeListResponse>(['nodes', mapId], {
          nodes: snapshot.nodes.map((n) =>
            n.id === id ? { ...n, ...body } : n,
          ),
        });
      }
      return { snapshot };
    },
    onError: (error: Error, { mapId }, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['nodes', mapId], context.snapshot);
      }
      toast({ variant: 'error', description: `Erro ao atualizar nó: ${error.message}` });
    },
    onSettled: (_data, _error, { mapId }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', mapId] });
    },
  });
};

function collectDescendants(nodeId: string, nodes: NodeDto[]): Set<string> {
  const ids = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const n of nodes) {
      if (n.parentId === current && !ids.has(n.id)) {
        ids.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

export const useDeleteNode = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id }: { id: string; mapId: string }) => deleteNodeRequest(id),
    retry: shouldRetry,
    retryDelay,
    onMutate: async ({ id, mapId }) => {
      await queryClient.cancelQueries({ queryKey: ['nodes', mapId] });
      const snapshot = queryClient.getQueryData<NodeListResponse>(['nodes', mapId]);
      if (snapshot) {
        const toRemove = collectDescendants(id, snapshot.nodes);
        queryClient.setQueryData<NodeListResponse>(['nodes', mapId], {
          nodes: snapshot.nodes.filter((n) => !toRemove.has(n.id)),
        });
      }
      return { snapshot };
    },
    onError: (error: Error, { mapId }, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['nodes', mapId], context.snapshot);
      }
      toast({ variant: 'error', description: `Erro ao excluir nó: ${error.message}` });
    },
    onSettled: (_data, _error, { mapId }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', mapId] });
    },
  });
};

export const useMoveNode = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; mapId: string; body: MoveNodeBody }) =>
      moveNodeRequest(id, body),
    retry: shouldRetry,
    retryDelay,
    onMutate: async ({ id, mapId, body }) => {
      await queryClient.cancelQueries({ queryKey: ['nodes', mapId] });
      const snapshot = queryClient.getQueryData<NodeListResponse>(['nodes', mapId]);
      const dragged = snapshot?.nodes.find((n) => n.id === id);
      if (snapshot && dragged) {
        // Espelha a renumeração global do backend: reinsere o nó no destino na posição
        // `index` (clampada) e renumera origem/destino; grava o `side` (RIGHT default se
        // o destino é a raiz e não veio side; null se o destino é profundo). Sem isso o
        // card "pula" para o fim antes do refetch.
        const oldParentId = dragged.parentId;
        const newParent = snapshot.nodes.find((n) => n.id === body.parentId) ?? null;
        const destIsRoot = newParent ? newParent.parentId === null : false;
        const newSide = destIsRoot ? (body.side ?? 'RIGHT') : null;

        const newSiblings = snapshot.nodes
          .filter((n) => n.parentId === body.parentId && n.id !== id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const clamped = Math.max(0, Math.min(body.index, newSiblings.length));
        const destOrder = new Map<string, number>();
        [...newSiblings.slice(0, clamped), dragged, ...newSiblings.slice(clamped)].forEach(
          (n, i) => destOrder.set(n.id, i),
        );

        const originOrder = new Map<string, number>();
        if (oldParentId !== body.parentId) {
          snapshot.nodes
            .filter((n) => n.parentId === oldParentId && n.id !== id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .forEach((n, i) => originOrder.set(n.id, i));
        }

        queryClient.setQueryData<NodeListResponse>(['nodes', mapId], {
          nodes: snapshot.nodes.map((n) => {
            if (n.id === id) {
              return { ...n, parentId: body.parentId, sortOrder: destOrder.get(id)!, side: newSide };
            }
            if (destOrder.has(n.id)) return { ...n, sortOrder: destOrder.get(n.id)! };
            if (originOrder.has(n.id)) return { ...n, sortOrder: originOrder.get(n.id)! };
            return n;
          }),
        });
      }
      return { snapshot };
    },
    onError: (error: Error, { mapId }, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['nodes', mapId], context.snapshot);
      }
      toast({ variant: 'error', description: `Erro ao mover nó: ${error.message}` });
    },
    onSettled: (_data, _error, { mapId }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', mapId] });
    },
  });
};
