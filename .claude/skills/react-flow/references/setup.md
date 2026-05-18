# Setup

## Package

```bash
pnpm --filter @mindmap/web add @xyflow/react
```

## CSS

Import once, at the entry point of the canvas (e.g. top of `MindmapCanvas.tsx`):

```ts
import '@xyflow/react/dist/style.css';
```

## Provider

`<ReactFlowProvider>` must wrap any component that uses React Flow hooks (`useReactFlow`, `useNodesState`, `useEdgesState`, `useViewport`, ...). Wrap the canvas page or the canvas root:

```tsx
import { ReactFlowProvider } from '@xyflow/react';

export function MindmapCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
```

The provider must sit **above** any component that calls `useReactFlow` etc.

## nodeTypes / edgeTypes registries

These objects MUST be stable across renders. Declare them at module scope (preferred) or `useMemo` with empty deps. Re-creating them on each render makes React Flow reset all nodes and emit warnings.

```tsx
// src/canvas/nodes/index.ts
import { MindNode } from './MindNode';

export const nodeTypes = {
  mind: MindNode,
} as const;
```

```tsx
// in the canvas component
import { nodeTypes } from './nodes';

<ReactFlow nodeTypes={nodeTypes} ... />
```

Same pattern for `edgeTypes`.

## Rules

- Always `@xyflow/react`. Never the old `reactflow` package.
- One `import '@xyflow/react/dist/style.css'` per app, at the canvas entry.
- `nodeTypes` / `edgeTypes` declared outside the component. No inline object literals on `<ReactFlow>`.
- The `ReactFlowProvider` wraps the canvas tree at exactly one level.
