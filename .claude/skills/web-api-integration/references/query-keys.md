# Query Key Conventions

Query keys must be **stable, predictable, and composed of primitive values**.

Never use a plain object as a query key — TanStack Query compares by deep equality, but object keys make partial invalidation harder and can cause subtle caching bugs.

## Key structure

```ts
// Lists
['maps']
['nodes', mapId]

// Single entity
['map', id]
['node', id]
```

## Invalidation

Invalidate at the broadest key that makes sense:

```ts
// Invalidates all map-related queries
queryClient.invalidateQueries({ queryKey: ['maps'] });

// Invalidates a specific map
queryClient.invalidateQueries({ queryKey: ['map', id] });
```

## Rules

- Query keys must include **all parameters** that affect the response
- Query keys must use **flattened primitives** — never `['maps', params]` with a nested object
- The same key structure must be used in both the hook and at invalidation sites
- After a mutation that affects a list, invalidate the list key (`['maps']`) — not just the single entity
