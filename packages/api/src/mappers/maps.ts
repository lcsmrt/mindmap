import type { Map } from '@prisma/client';
import type { MapDetail, MapSummary } from '@mindmap/shared';

export function toMapDetail(map: Map): MapDetail {
  return {
    id: map.id,
    title: map.title,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
  };
}

export function toMapSummary(
  map: Pick<Map, 'id' | 'title' | 'updatedAt'>
): MapSummary {
  return {
    id: map.id,
    title: map.title,
    updatedAt: map.updatedAt.toISOString(),
  };
}
