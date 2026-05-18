import type {
  MapListResponse,
  MapDetail,
  CreateMapBody,
  UpdateMapBody,
} from '@mindmap/shared';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listMaps(): Promise<MapListResponse> {
  return request<MapListResponse>('/api/maps');
}

export function getMap(id: string): Promise<MapDetail> {
  return request<MapDetail>(`/api/maps/${id}`);
}

export function createMap(body: CreateMapBody): Promise<MapDetail> {
  return request<MapDetail>('/api/maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateMap(id: string, body: UpdateMapBody): Promise<MapDetail> {
  return request<MapDetail>(`/api/maps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteMap(id: string): Promise<void> {
  return request<void>(`/api/maps/${id}`, { method: 'DELETE' });
}
