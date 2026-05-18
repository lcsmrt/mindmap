# Mutation Pattern

## API function

```ts
async function createMap(body: CreateMapBody): Promise<MapDetail> {
  const res = await fetch('/api/maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<MapDetail>;
}
```

## Hook

```ts
import type { MutationOptions } from './types';

export const useCreateMap = (options?: MutationOptions<MapDetail, CreateMapBody>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMap,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      options?.onSuccess?.(data, variables);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
};
```

## Component usage

```tsx
const { mutate: create, isPending, isError } = useCreateMap({
  onSuccess: () => setTitle(''),
});

// on submit:
create({ title });
```

---

## Rules

- Mutations must invalidate related queries in `onSuccess` before calling `options?.onSuccess`
- `options?.onSuccess` and `options?.onError` are always called after internal logic
- Error display is the component's responsibility — hooks do not show toasts
- For DELETE operations that return 204 (no body), the API function returns `Promise<void>` and `fetch` is not parsed as JSON
- Always check `res.ok` before parsing the response body
