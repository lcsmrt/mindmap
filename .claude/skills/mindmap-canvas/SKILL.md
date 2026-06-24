---
name: mindmap-canvas
description: Builds and modifies the mindmap canvas using visx (@visx/zoom, @visx/shape) + d3 (d3-flextree) in a hybrid SVG-edges / HTML-nodes architecture. Use when touching the canvas render, custom nodes, edges, tree layout, pan/zoom, drag-to-reparent, or syncing canvas state with the backend.
---

# Mindmap Canvas Skill

The canvas renders a hierarchical mindmap with **visx + d3**, not a general graph editor.
It is deliberately **not** React Flow (removed in M7 — the attribution logo was a dealbreaker;
see AD-015 in `STATE.md`). All canvas code lives under `packages/web/src/pages/map/components/`
and `packages/web/src/lib/`.

## The architecture in one picture: hybrid SVG + HTML

The single most important idea: **edges are SVG, nodes are HTML, and one shared transform
keeps them aligned.** We do not draw nodes as SVG — the rich `MindNode` (title, colors, task
footer, buttons, inline edit) stays an HTML/React component, absolutely positioned over the SVG.

```
<Zoom> (from @visx/zoom — pan/zoom state)
  <div ref={zoom.containerRef}>            ← gestures (wheel zoom, drag pan) wired here
    <svg><g transform={zoom.toString()}>   ← EDGE layer: <path> per link (visx LinkVertical)
        ...edges...
    </g></svg>
    <div style={{ transform: zoom.toString(), transformOrigin: '0 0' }}>  ← NODE layer
        {positioned.map(p => <MindNode style={{position:'absolute', left:p.x, top:p.y}} />)}
    </div>
  </div>
</Zoom>
```

`zoom.toString()` returns a CSS `matrix(...)` — the **same string** drives the SVG `<g transform>`
and the HTML `<div>`'s CSS `transform`. The one gotcha: the HTML div needs
`transform-origin: 0 0` (CSS defaults to center; SVG's origin is 0,0). Get this wrong and nodes
drift away from their edges as you zoom.

## The four pillars (and the non-obvious facts behind them)

1. **Layout — `d3-flextree`, synchronous.** Nodes have *variable* heights (40px without a task
   footer, 58px with). `d3.tree()` and visx's `<Tree>` only do **uniform** node sizes, so we use
   **`d3-flextree`** (`.nodeSize(n => [w, h])`, read `node.x/node.y`). It is O(n) and synchronous —
   **no web worker** (elkjs and the worker were removed). Layout is ready on first render, so there
   is no async "jump". See `references/layout.md`.

2. **Pan/zoom — `@visx/zoom`.** In v4 it is built on `@use-gesture/react`, **not** d3-zoom. You get
   `transformMatrix`, `toString()` (→ CSS matrix), `applyInverseToPoint` (screen→world), `setTransformMatrix`,
   and `containerRef` (auto-wires gestures with `passive:false`). Clamp scale with `scaleXMin/Max`.
   "Fit to view" is computed manually from the layout bounds. See `references/interaction.md`.

3. **Drag-to-reparent — manual pointer events.** Not `@visx/drag` (it works in screen pixels and
   fights the zoom — visx#1684). On a node: `pointerdown` → `setPointerCapture` + `stopPropagation`
   (so it does not leak into the pan gesture); `pointermove` → `zoom.applyInverseToPoint` to get
   world coords; `pointerup` → hit-test the dragged node's box against the others and call
   `useMoveNode({ parentId })`, or snap back. See `references/interaction.md`.

4. **One source of truth.** The render is derived from a single `positioned` array
   (`data → buildTree → visibleNodes → useTreeLayout`). There is **no** `useNodesState`/`useEdgesState`
   mirror and **no** `useEffect` re-pushing state — that duplicate-owner pattern was the recurring
   bug source under React Flow (CONCERNS.md) and was deliberately eliminated. See `references/layout.md`.

## Hard rules

- **Never persist node positions.** Structure (`parentId`, `sortOrder`) is the truth; layout is always
  recomputed by flextree (AD-002). The `Node` schema has no `x/y`.
- **Nodes are HTML, edges are SVG.** Don't render nodes as `<rect>`/SVG; reuse the `MindNode` component.
- **No library-specific selectors in tests.** Tag nodes with `data-testid="mind-node"` (and
  `data-node-id` / `data-node-title`). The old `.react-flow__node` selectors caused brittle e2e — don't
  recreate that coupling with any new lib's internal classes.
- **All I/O via TanStack Query hooks** in `packages/web/src/api/` — the canvas never calls `fetch`.
  Optimistic + rollback + toast already exist; reuse them (`references/sync.md`).
- **Keep layout & hit-test logic pure and unit-tested.** Interaction (pointer/gesture/render) is covered
  by Playwright e2e (AD-007 + AD-014).

## References

- `references/setup.md` — packages, the `<Zoom>` two-layer skeleton, no provider/CSS
- `references/layout.md` — `d3-flextree` layout, variable heights, single source of truth
- `references/nodes-edges.md` — HTML `MindNode` (no handles), SVG edges, inline edit
- `references/interaction.md` — pan/zoom (visx Zoom, fitView, matrix), drag-to-reparent
- `references/sync.md` — TanStack Query mutations, optimistic updates, AD-002
- `references/structure.md` — actual folder layout under `pages/map/components/` + `lib/`

## Usage Guidance

Use this skill when:

- Building or modifying the canvas render, layout, or viewport behavior
- Adding/changing the `MindNode` or the edge rendering
- Wiring pan/zoom, drag, selection, or inline edit
- Syncing canvas interactions with the backend
- Touching anything under `pages/map/components/` or the layout helpers in `lib/`
