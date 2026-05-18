# State

Canvas state has two layers:

1. **React Flow local state** — what the user is seeing/dragging right now. Owned by `useNodesState` / `useEdgesState`.
2. **Server state** — persisted truth. Owned by TanStack Query (see `web-api-integration` skill).

The canvas seeds layer 1 from layer 2 and pushes changes back through mutations.

## Initialization

```tsx
import { useNodesState, useEdgesState } from '@xyflow/react';
import { useMap } from '@/api/maps';

function CanvasInner({ mapId }: { mapId: string }) {
  const { data, isLoading } = useMap(mapId);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    data ? toRFNodes(data.nodes) : []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    data ? toRFEdges(data.edges) : []
  );

  // Re-seed when server data arrives or changes identity
  useEffect(() => {
    if (data) {
      setNodes(toRFNodes(data.nodes));
      setEdges(toRFEdges(data.edges));
    }
  }, [data, setNodes, setEdges]);

  // ...
}
```

`toRFNodes` / `toRFEdges` are local mappers (`src/canvas/mappers.ts`) that turn the shared DTOs into React Flow's `Node` / `Edge` shape.

## Change handlers

- `onNodesChange` / `onEdgesChange` — built-in handlers from the hooks. Always pass them so drag, select, dimensions etc. work. They do NOT persist.
- `onNodeDragStop` — fires once when the user releases a node. Use this to persist position, not the per-pixel updates inside `onNodesChange`.
- `onConnect` — fires when the user creates an edge. Persist via a `createEdge` mutation.

## Rules

- Never use `useNodesState` to *own* server data. It is a view-state hook, not a cache. The cache is TanStack Query.
- Always pass `onNodesChange` and `onEdgesChange` to `<ReactFlow>` — without them, interactions break silently.
- For persistence, prefer the discrete callbacks (`onNodeDragStop`, `onConnect`, `onNodesDelete`, `onEdgesDelete`) over inspecting `onNodesChange` events.
- Convert between server DTOs and React Flow's shape in `src/canvas/mappers.ts`. Don't store React Flow's runtime fields (`positionAbsolute`, `dragging`, etc.) on the server.
