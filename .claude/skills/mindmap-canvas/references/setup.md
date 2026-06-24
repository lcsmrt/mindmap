# Setup

## Packages

```bash
pnpm --filter @mindmap/web add @visx/zoom @visx/shape @visx/group d3-flextree
pnpm --filter @mindmap/web add -D @types/d3-flextree
```

- `@visx/zoom` (^4) — pan/zoom. In v4 it is built on `@use-gesture/react` (not d3-zoom); that dep
  comes transitively, you don't add it yourself.
- `@visx/shape` (^4) — `LinkVertical`/`LinkHorizontal` for edges; bundles d3-shape via `@visx/vendor`,
  so you do **not** need a standalone `d3-shape`.
- `@visx/group` (^4) — optional `<g transform>` helper.
- `d3-flextree` (^2) — variable-size tidy tree layout. Types live in `@types/d3-flextree` (not bundled).

There is **no** CSS import and **no** provider component to wrap (unlike React Flow). The canvas is
just a `<Zoom>` render-prop plus your own SVG/HTML.

## The two-layer skeleton

```tsx
import { Zoom } from '@visx/zoom';
import { LinkVertical } from '@visx/shape';

function MapCanvas({ width, height }: { width: number; height: number }) {
  const { positioned, links, bounds } = useTreeLayout(visNodes, visEdges); // see layout.md

  return (
    <Zoom<SVGSVGElement>
      width={width}
      height={height}
      scaleXMin={0.1}
      scaleXMax={3}
      scaleYMin={0.1}
      scaleYMax={3}
    >
      {(zoom) => (
        <div
          ref={zoom.containerRef}
          className="relative h-full w-full overflow-hidden bg-background touch-none"
        >
          {/* EDGE layer (SVG) */}
          <svg width={width} height={height} className="absolute inset-0">
            <g transform={zoom.toString()}>
              {links.map((l) => (
                <LinkVertical
                  key={`${l.sourceId}-${l.targetId}`}
                  data={l}
                  x={(d) => d.x}
                  y={(d) => d.y}
                  className="stroke-border fill-none"
                />
              ))}
            </g>
          </svg>

          {/* NODE layer (HTML) — SAME transform, origin 0 0 */}
          <div
            className="absolute left-0 top-0"
            style={{ transform: zoom.toString(), transformOrigin: '0 0' }}
          >
            {positioned.map((p) => (
              <div
                key={p.id}
                className="absolute"
                style={{ left: p.x, top: p.y, width: p.width }}
                data-testid="mind-node"
                data-node-id={p.id}
              >
                <MindNode data={mindNodeData(p.id)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Zoom>
  );
}
```

Measure `width`/`height` with a `ResizeObserver` on the wrapper (no extra dep), or `@visx/responsive`'s
`ParentSize` if you prefer. Guard against `0×0` before computing fitView.

## Rules

- Use `@visx/zoom` for pan/zoom; never reach for d3-zoom directly.
- The SVG `<g>` and the HTML node `<div>` MUST share the exact same `zoom.toString()`. The HTML div MUST
  set `transform-origin: 0 0`.
- `touch-none` (or `style={{ touchAction: 'none' }}`) on the gesture container so wheel/drag aren't
  hijacked by the browser.
- No `@xyflow/react`, no `ReactFlowProvider`, no React Flow CSS — those are gone.
