# Nodes (HTML) and edges (SVG)

## Nodes are HTML, not SVG

The `MindNode` is a normal React/HTML component — it reuses the design system (Tailwind, shadcn/ui
primitives), shows the title, custom colors, the task footer (status dot / assignee initials / 🚩),
and the action buttons. We render it **on the HTML layer**, positioned by the canvas. It is **not**
drawn as SVG `<rect>`/`<text>`.

```tsx
// pages/map/components/MindNode.tsx
import { memo } from 'react';
import type { MindNodeData } from './types';

function MindNodeBase({ data }: { data: MindNodeData }) {
  const { node, isRoot, hasChildren, isEditing /* ...callbacks */ } = data;
  return (
    <div
      className="relative flex flex-col rounded-md border bg-card px-3 py-2 shadow-sm"
      style={{ backgroundColor: node.bgColor ?? undefined, color: node.textColor ?? undefined }}
    >
      <div className="flex items-center gap-1">
        {/* collapse chevron, title / inline input, action buttons */}
      </div>
      <NodeTaskIndicators node={node} /> {/* renders null when no task props */}
    </div>
  );
}

export const MindNode = memo(MindNodeBase);
```

What changed coming from React Flow:

- **No `Handle` / `Position`.** There are no connection ports — edges are computed from layout
  positions and drawn on the SVG layer. Delete those imports.
- **Plain props, not `NodeProps`.** The component takes `{ data: MindNodeData }`. The canvas passes
  `data` and positions the wrapper (`position:absolute; left; top; width`).
- Keep `memo` — many nodes re-render on every pan/zoom otherwise.
- **Inline edit is controlled.** Use `useState` + `value`/`onChange`, not `defaultValue`. The old
  uncontrolled input silently lost typed text when the node re-mounted during a relayout
  (CONCERNS.md, Fragile Areas).
- Interact only through `data` callbacks (`onSubmitEdit`, `onAddChild`, `onToggleCollapse`, ...). The
  node never reaches into canvas internals.
- The canvas wraps each node with `data-testid="mind-node"` (+ `data-node-id` / `data-node-title`)
  for e2e — don't rely on any library's internal classes.

## Edges are SVG paths

Each parent→child link is one `<path>` generated from the layout endpoints, inside the transformed
`<g>`. Use visx `LinkVertical` (delegates to `d3-shape.linkVertical`) or call d3-shape yourself.

```tsx
import { LinkVertical } from '@visx/shape';

<g transform={zoom.toString()}>
  {links.map((l) => (
    <LinkVertical
      key={`${l.sourceId}-${l.targetId}`}
      data={l}
      source={(d) => d.source}   // { x, y }
      target={(d) => d.target}   // { x, y }
      x={(p) => p.x}
      y={(p) => p.y}
      className="stroke-border fill-none"
      strokeWidth={1.5}
    />
  ))}
</g>
```

Edge style is **free / least-effort** (a smooth curve is fine; matching React Flow's exact
`smoothstep` look is not required — M7 spec). Endpoints come straight from `useTreeLayout`'s `links`.

## Rules

- Nodes: HTML + `memo`, no handles, controlled inline input, interact via `data` callbacks only.
- Edges: SVG `<path>` from layout endpoints, inside the transformed `<g>`. No per-node anchor handles.
- Colors come from `node.bgColor` / `node.textColor` via inline `style` (user data); everything else
  is Tailwind classes.
- Tag nodes for tests with `data-testid`, never a lib-internal selector.
