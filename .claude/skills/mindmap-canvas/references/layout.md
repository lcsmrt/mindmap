# Layout & state

## One source of truth

There is exactly **one** owner of what's on screen: a derived `positioned` array. The pipeline is
pure and one-directional:

```
server data (TanStack Query: useNodes)
   → buildTree(nodes)              // pages/map/lib/tree.ts — adjacency list → tree, sorted by sortOrder
   → visibleNodes(tree, collapsed) // pages/map/lib/tree.ts — drops collapsed subtrees
   → useTreeLayout(nodes, edges)   // pages/map/lib/useTreeLayout.ts — d3-flextree → positions
   → render (edges + HTML nodes)
```

Do **not** mirror this into a second state container. Under React Flow we kept a `useNodesState`
copy and a `useEffect` that re-pushed `setNodes(rfNodes)` on every change — two owners of the same
state. That was the project's #1 source of interaction bugs (CONCERNS.md, Fragile Areas). With visx
we render straight from `positioned`; UI-only concerns (`editingId`, `collapsedIds`) are plain React
state held in `MapCanvas` and read while building each node's props.

## d3-flextree (variable node heights)

Nodes are not uniform: 40px without a task footer, 58px with one. `d3.tree()` and visx's `<Tree>`
take a single `nodeSize` for all nodes, so they can't express that. **`d3-flextree`** can.

```ts
// pages/map/lib/useTreeLayout.ts
import { flextree } from 'd3-flextree';
import { NODE_WIDTH, estimateNodeHeight } from './nodeSize';

const GAP_X = 24;
const GAP_Y = 16;

export function computeTreeLayout(tree: TreeNode) {
  const layout = flextree<NodeDto>()
    // vertical layout: [breadth, depth] = [width, height]
    .nodeSize((n) => [NODE_WIDTH + GAP_X, estimateNodeHeight(n.data) + GAP_Y])
    .spacing(() => 0);

  const root = layout.hierarchy(tree, (d) => d.children); // builds a d3-hierarchy-derived node
  layout(root);

  const positioned: PositionedNode[] = [];
  root.each((n) => {
    positioned.push({ id: n.data.id, x: n.x, y: n.y, width: NODE_WIDTH, height: estimateNodeHeight(n.data) });
  });

  const links: LayoutLink[] = root.links().map((l) => ({
    sourceId: l.source.data.id,
    targetId: l.target.data.id,
    x: l.source.x, y: l.source.y,     // shape accessors read these (see nodes-edges.md)
    // ...carry both endpoints however your LinkVertical expects
  }));

  const bounds = boundsFromExtents(root); // min/max x,y → { width, height, minX, minY }
  return { positioned, links, bounds };
}
```

Key facts:

- **Synchronous & O(n)** — call it in a `useMemo`. No web worker, no `isLayouting` flag, no async
  "first frame is empty then jumps". elkjs and `layout.worker.ts` were removed.
- `flextree().hierarchy(data, children)` returns a node you read `node.x` / `node.y` from directly
  (it's a subclass of d3-hierarchy).
- `nodeSize` returns `[breadth, depth]`. For the vertical layout we use, that's `[width, height]`.
  Direction is free / least-effort (vertical is flextree's natural orientation) — see AD-015 and the
  M7 spec; choosing/toggling direction is a deferred decision, not part of the migration.

## Wrapping it in a hook

```ts
export function useTreeLayout(nodes: NodeDto[], edges: VisibleEdge[]): LayoutResult {
  return useMemo(() => {
    const tree = buildTreeFromVisible(nodes, edges);
    if (!tree) return EMPTY_LAYOUT;
    return computeTreeLayout(tree);
  }, [nodes, edges]);
}
```

## Rules

- Render from the single `positioned` array. No `useNodesState`/`useEdgesState`, no `useEffect`
  re-pushing derived state.
- Layout is pure — keep `computeTreeLayout` free of React/DOM so it can be unit-tested
  (positions exist for every visible node; links = nodes − 1; deterministic; footer node → 58px).
- Heights come from `estimateNodeHeight(node)` in `pages/map/lib/nodeSize.ts`. Don't hardcode 40/58 elsewhere.
- Never write positions back to the server (AD-002).
