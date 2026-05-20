import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  MapListResponse,
  MapDetail,
  CreateMapBody,
  UpdateMapBody,
} from '@mindmap/shared';
import type { QueryOptions, MutationOptions } from './types.js';
import { request } from './_request.js';

async function fetchMaps(): Promise<MapListResponse> {
  return request<MapListResponse>('/api/maps');
}

async function fetchMap(id: string): Promise<MapDetail> {
  return request<MapDetail>(`/api/maps/${id}`);
}

async function createMapRequest(body: CreateMapBody): Promise<MapDetail> {
  return request<MapDetail>('/api/maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function updateMapRequest(id: string, body: UpdateMapBody): Promise<MapDetail> {
  return request<MapDetail>(`/api/maps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function deleteMapRequest(id: string): Promise<void> {
  return request<void>(`/api/maps/${id}`, { method: 'DELETE' });
}

// --- Hooks ---

export const useMaps = (options?: QueryOptions<MapListResponse>) =>
  useQuery({ queryKey: ['maps'], queryFn: fetchMaps, ...options });

export const useMap = (id?: string, options?: QueryOptions<MapDetail>) =>
  useQuery({
    queryKey: ['map', id],
    queryFn: () => fetchMap(id!),
    enabled: !!id && (options?.enabled ?? true),
    ...options,
  });

export const useCreateMap = (options?: MutationOptions<MapDetail, CreateMapBody>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMapRequest,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useUpdateMap = (
  options?: MutationOptions<MapDetail, { id: string; body: UpdateMapBody }>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMapBody }) =>
      updateMapRequest(id, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      queryClient.invalidateQueries({ queryKey: ['map', variables.id] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useDeleteMap = (options?: MutationOptions<void, string>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMapRequest,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      queryClient.removeQueries({ queryKey: ['map', id] });
      options?.onSuccess?.(data, id);
    },
    onError: (error) => options?.onError?.(error),
  });
};
