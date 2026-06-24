# Sync with backend

All persistence flows through TanStack Query mutations defined in `packages/web/src/api/nodes.ts`
(see the `web-api-integration` skill). The canvas calls those hooks from its interaction handlers —
it never calls `fetch` directly.

The hooks already exist and already implement optimistic update + rollback + toast:
`useCreateNode`, `useUpdateNode`, `useDeleteNode`, `useMoveNode`. **Reuse them as-is** — the migration
to visx did not change the data contract.

## What gets persisted (and what doesn't)

| Interaction | Mutation | Persisted? |
| --- | --- | --- |
| Rename / color / status / assignee / critical | `useUpdateNode` | yes |
| Add child | `useCreateNode` | yes |
| Delete | `useDeleteNode` | yes |
| Drag onto another node (reparent) | `useMoveNode({ parentId })` | yes (`parentId`, `sortOrder`) |
| **Node x/y position** | — | **NO — never** |
| **Collapse / expand** | — | no (client-only, AD-004) |

**Never persist positions (AD-002).** The server stores structure only (`parentId`, `sortOrder`).
Layout is always recomputed by flextree. The `Node` schema has no `x/y`, and there is no
`updateNodePosition` mutation — if you find yourself wanting one, stop: that's the deferred
"free positioning" decision, not part of this canvas.

## Optimistic pattern (already in place)

```ts
// packages/web/src/api/nodes.ts (shape — already implemented)
export function useUpdateNode(mapId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateNodeBody }) => updateNodeRequest(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ['nodes', mapId] });
      const previous = qc.getQueryData<NodeDto[]>(['nodes', mapId]);
      qc.setQueryData<NodeDto[]>(['nodes', mapId], (old) =>
        old?.map((n) => (n.id === id ? { ...n, ...body } : n)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(['nodes', mapId], ctx.previous);
      // toast handled by the shared error path
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['nodes', mapId] }),
  });
}
```

The `onMutate` is generic (`{ ...n, ...body }`), so new fields flow through without changing the hook.

## Drag-to-reparent persistence

On a valid drop, call the move mutation; on an invalid drop, refetch to snap the node back to its
flextree position:

```ts
const move = useMoveNode(mapId);

function onReparent(childId: string, newParentId: string) {
  move.mutate({ id: childId, body: { parentId: newParentId } }); // appends to end (AD-011)
}
function onInvalidDrop() {
  qc.invalidateQueries({ queryKey: ['nodes', mapId] }); // re-layout → node returns to place
}
```

The server's `WITH RECURSIVE` guard rejects cyclic moves; rollback + toast handle the failure. No
client-side cycle check.

## Rules

- The canvas never calls `fetch`. All I/O via hooks in `src/api/`.
- Always pair `onMutate` with `onError` rollback; invalidate the `['nodes', mapId]` query on settle.
- Continuous interactions (drag) persist on the **end** event (pointerup → one `useMoveNode` call),
  never per-move.
- Positions and collapse state are **not** persisted (AD-002, AD-004).
