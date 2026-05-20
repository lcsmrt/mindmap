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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({ variant: 'error', description: `Erro ao criar nó: ${error.message}` });
    },
  });
};

export const useUpdateNode = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateNodeBody }) =>
      updateNodeRequest(id, body),
    retry: shouldRetry,
    retryDelay,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', description: `Erro ao renomear nó: ${error.message}` });
    },
  });
};

export const useDeleteNode = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id }: { id: string; mapId: string }) => deleteNodeRequest(id),
    retry: shouldRetry,
    retryDelay,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', variables.mapId] });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', description: `Erro ao excluir nó: ${error.message}` });
    },
  });
};

export const useMoveNode = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MoveNodeBody }) =>
      moveNodeRequest(id, body),
    retry: shouldRetry,
    retryDelay,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', description: `Erro ao mover nó: ${error.message}` });
    },
  });
};
