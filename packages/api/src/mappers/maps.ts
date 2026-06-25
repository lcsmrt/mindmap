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
  map: Pick<Map, 'id' | 'title' | 'createdAt' | 'updatedAt'> & {
    _count: { nodes: number };
  },
  criticalCount: number
): MapSummary {
  return {
    id: map.id,
    title: map.title,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
    nodeCount: map._count.nodes,
    criticalCount,
  };
}
