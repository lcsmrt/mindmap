import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  NodeListResponse,
  NodeDto,
  CreateNodeBody,
  UpdateNodeBody,
  MoveNodeBody,
} from '@mindmap/shared';
import type { QueryOptions, MutationOptions } from './types.js';
import { request } from './_request.js';

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

export const useCreateNode = (options?: MutationOptions<NodeDto, CreateNodeBody>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createNodeRequest,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useUpdateNode = (
  options?: MutationOptions<NodeDto, { id: string; body: UpdateNodeBody }>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateNodeBody }) =>
      updateNodeRequest(id, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useDeleteNode = (
  options?: MutationOptions<void, { id: string; mapId: string }>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; mapId: string }) => deleteNodeRequest(id),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', variables.mapId] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useMoveNode = (
  options?: MutationOptions<NodeDto, { id: string; body: MoveNodeBody }>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MoveNodeBody }) =>
      moveNodeRequest(id, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', data.mapId] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};
