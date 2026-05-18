# Query Patterns

## API function

Plain `async` function using `fetch`. Throws on non-ok responses:

```ts
async function listMaps(): Promise<MapListResponse> {
  const res = await fetch('/api/maps');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<MapListResponse>;
}
```

## Hook

```ts
import type { QueryOptions } from './types';

export const useMaps = (options?: QueryOptions<MapListResponse>) => {
  return useQuery({
    queryKey: ['maps'],
    queryFn: listMaps,
    ...options,
  });
};
```

---

## Parameterized Query

For single-entity fetches where the parameter may be undefined:

```ts
async function getMap(id: string): Promise<MapDetail> {
  const res = await fetch(`/api/maps/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<MapDetail>;
}

export const useMap = (id?: string, options?: QueryOptions<MapDetail>) => {
  const enabled = !!id && (options?.enabled ?? true);

  return useQuery({
    queryKey: ['map', id],
    queryFn: () => getMap(id!),
    enabled,
    ...options,
  });
};
```

Pass `enabled: false` or omit `id` to disable the query — no `useEffect` guards.

---

## Error Handling

Components read `isError` and `error` from the hook return:

```tsx
const { data, isLoading, isError } = useMaps();

if (isLoading) return <p>Carregando…</p>;
if (isError) return <p>Erro ao carregar mapas.</p>;
```

No toast infrastructure — components own the error display.

---

## Rules

- API functions are plain `async` functions — no class wrappers, no Axios
- `fetch` responses must be checked with `res.ok`; throw `Error` on failure
- Hooks reference API functions through `queryFn` — never inline fetch inside `useQuery`
- `QueryOptions` is always spread last into the query config
- Parameterized hooks guard `enabled` against undefined params
- Never use `useEffect` to trigger API calls — always use `useQuery` or `useMutation`
