# Sync with backend

All persistence flows through TanStack Query mutations defined in `src/api/` (see `web-api-integration` skill). The canvas calls those mutations from React Flow's discrete callbacks.

## Optimistic updates

For interactions where the UI must feel immediate (drag, rename, color change), use `onMutate` to write to the query cache before the request returns, and roll back on error.

```ts
// src/api/nodes.ts
export function useUpdateNodePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: { x: number; y: number } }) =>
      updateNodeRequest(id, { position }),
    onMutate: async ({ id, position }) => {
      await queryClient.cancelQueries({ queryKey: ['map', mapId] });
      const previous = queryClient.getQueryData<MapDetail>(['map', mapId]);
      queryClient.setQueryData<MapDetail>(['map', mapId], (old) =>
        old ? { ...old, nodes: old.nodes.map((n) => (n.id === id ? { ...n, position } : n)) } : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['map', mapId], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['map', mapId] }),
  });
}
```

## Debouncing continuous changes

Drag and resize emit many events per second. Persist on the **end** event, not on every change:

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onNodeDragStop={(_evt, node) => {
    updateNodePosition.mutate({ id: node.id, position: node.position });
  }}
/>
```

For changes that don't have a natural "end" event (e.g. inline rename committed on blur), debounce with a small helper hook (`useDebouncedCallback`, ~300ms) before calling `.mutate`.

## Rules

- Continuous interactions (drag, resize) → persist on the discrete end event (`onNodeDragStop`, `onResizeEnd`).
- Text edits → debounce ~300ms, then mutate.
- Always pair `onMutate` with `onError` rollback. Never write to the cache without a rollback path.
- After a mutation settles, invalidate the parent query (`['map', mapId]`) so the server stays authoritative.
- The canvas never calls `fetch` directly. All I/O goes through hooks from `src/api/`.
