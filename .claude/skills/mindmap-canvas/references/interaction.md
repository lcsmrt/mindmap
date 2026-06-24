# Interaction: pan/zoom and drag-to-reparent

## Pan & zoom (@visx/zoom)

`<Zoom>` owns the viewport transform and wires gestures. In v4 it runs on `@use-gesture/react`
(not d3-zoom). The render-prop `zoom` gives you everything you need:

| member | use |
| --- | --- |
| `zoom.toString()` | CSS `matrix(...)` — apply to the SVG `<g>` **and** the HTML node `<div>` |
| `zoom.transformMatrix` | `{ scaleX, scaleY, translateX, translateY, ... }` (read scale for math) |
| `zoom.applyInverseToPoint({x,y})` | screen → world coords (essential for hit-testing under zoom) |
| `zoom.setTransformMatrix(m)` | set the viewport programmatically (used for fitView) |
| `zoom.containerRef` | attach to the gesture container; wheel-zoom + drag-pan auto-wired |
| `scaleXMin/Max`, `scaleYMin/Max` | clamp zoom (use 0.1 / 3 to match prior behavior) |

Wheel zoom and drag pan come for free once `containerRef` is attached and the container has
`touch-action: none`. Keep min/max in sync on both axes.

### Fit to view (manual)

There's no built-in `fitView`. Compute it once from the layout `bounds`:

```ts
useEffect(() => {
  if (!width || !height || bounds.width === 0) return; // guard 0×0 and empty
  const scale = clamp(Math.min(width / bounds.width, height / bounds.height), 0.1, 3);
  const translateX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const translateY = (height - bounds.height * scale) / 2 - bounds.minY * scale;
  zoom.setTransformMatrix({ scaleX: scale, scaleY: scale, translateX, translateY, skewX: 0, skewY: 0 });
  // run once when bounds first become available (not on every layout tick)
}, [width, height, bounds, zoom]);
```

## Drag-to-reparent (manual pointer events)

Use pointer events, **not** `@visx/drag`. `@visx/drag` works in screen pixels and conflicts with an
active zoom (you'd have to divide deltas by scale, and it competes with the pan gesture — visx#1684).
Pointer events + `applyInverseToPoint` give world coordinates directly and let you stop the event from
leaking into the pan.

```ts
// pages/map/components/useNodeDrag.ts
function onNodePointerDown(id: string, e: React.PointerEvent) {
  if (isRoot(id)) return;                 // root is not draggable
  e.stopPropagation();                    // don't start the Zoom pan
  (e.target as Element).setPointerCapture(e.pointerId);
  start = { x: e.clientX, y: e.clientY };
  // track move/up on the captured element
}

function onPointerMove(e: React.PointerEvent) {
  const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
  if (dist < DRAG_THRESHOLD) return;      // below threshold = click, not drag
  dragging = true;
  // optionally render a ghost following the cursor (world coords via applyInverseToPoint)
}

function onPointerUp(e: React.PointerEvent) {
  if (!dragging) return;                   // was a click — let click handlers run
  const world = zoom.applyInverseToPoint(toLocal(e));  // screen → world
  const targetId = findDropTarget(world, positioned, { excludeId: draggedId });
  if (targetId) onReparent(draggedId, targetId);       // → useMoveNode({ parentId: targetId })
  else onInvalidDrop();                                 // refetch → snap back
}
```

`findDropTarget` is **pure** (unit-test it):

```ts
export function findDropTarget(
  point: { x: number; y: number },
  candidates: PositionedNode[],
  opts: { excludeId: string },
): string | null {
  for (const c of candidates) {
    if (c.id === opts.excludeId) continue;
    if (point.x >= c.x && point.x <= c.x + c.width && point.y >= c.y && point.y <= c.y + c.height) {
      return c.id; // first/topmost hit — keep the rule deterministic
    }
  }
  return null;
}
```

The backend rejects cycles (`PATCH /nodes/:id/move`, `WITH RECURSIVE`); the move mutation rolls back
on error. So you don't need a client-side cycle check — just call `useMoveNode` and let optimistic
rollback handle the rejection.

## Inline edit

Click the node title → controlled input → Enter/blur commits via `useUpdateNode({ title })`, Escape
cancels. Keep the input controlled (`useState`), and `stopPropagation` on the title's pointerdown so a
text click doesn't start a node drag.

## Rules

- One `zoom.toString()` on both layers; HTML div gets `transform-origin: 0 0`.
- Hit-test in **world** coords via `applyInverseToPoint` — never raw client pixels.
- `stopPropagation` + `setPointerCapture` on node pointerdown so drag doesn't become a pan.
- Distinguish click from drag with a small movement threshold.
- Root: not draggable, no delete. No client-side cycle check — trust the backend + rollback.
- Keep `findDropTarget` and the fitView math pure and unit-tested; the pointer wiring is covered by e2e.
