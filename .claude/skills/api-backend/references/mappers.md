# Mappers

Pure functions that transform Prisma models into shared DTOs. They live in `src/mappers/<resource>.ts`.

## Why

- Prisma models carry `Date` objects; DTOs carry ISO strings.
- DTOs may project a subset of fields.
- Centralizing avoids drift between endpoints that return the same resource.

## Example

```ts
// src/mappers/maps.ts
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
```

## Rules

- Pure functions, no I/O.
- Naming: `to<Resource><Variant>` (e.g. `toMapDetail`, `toMapSummary`).
- Input type from `@prisma/client`; output type from `@mindmap/shared`.
- If the same resource is mapped in 2+ places, the mapper is mandatory.
