import type { MapSummary } from '@mindmap/shared';

export type MapSort = 'recent' | 'alpha' | 'nodes';

export function filterAndSortMaps(
  maps: MapSummary[],
  query: string,
  sort: MapSort,
): MapSummary[] {
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? maps.filter((map) => map.title.toLowerCase().includes(trimmed))
    : maps;

  const sorted = [...filtered];

  switch (sort) {
    case 'recent':
      sorted.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      break;
    case 'alpha':
      sorted.sort((a, b) =>
        a.title.localeCompare(b.title, 'pt', { sensitivity: 'base' }),
      );
      break;
    case 'nodes':
      sorted.sort((a, b) => b.nodeCount - a.nodeCount);
      break;
  }

  return sorted;
}
