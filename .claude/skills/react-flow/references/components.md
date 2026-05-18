# Custom Nodes and Edges

## Custom node shape

```tsx
// src/canvas/nodes/MindNode.tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type MindNodeData = {
  title: string;
  isCritical?: boolean;
};

function MindNodeBase({ data, selected }: NodeProps<MindNodeData>) {
  return (
    <div
      className={cn(
        'rounded-md border bg-white px-3 py-2 shadow-sm',
        selected && 'ring-2 ring-blue-500',
        data.isCritical && 'border-red-500'
      )}
    >
      <Handle type="target" position={Position.Top} />
      <span className="text-sm font-medium">{data.title}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const MindNode = memo(MindNodeBase);
```

## Rules

- Always `memo` the custom node. React Flow re-renders all nodes on viewport changes if you don't.
- Props type is `NodeProps<TData>`. Define `TData` next to the component and re-export it.
- Style with Tailwind on the wrapper. Don't inline `style={{ ... }}` unless using a value from `data` (e.g. user-chosen bg color).
- Handles: at least one `target` and/or `source` per node. `Position.Top` / `Position.Bottom` for parent/child mind-map relationships.
- Never read or mutate React Flow's internal store from inside the node — interact through `data` and emit changes upward via callbacks passed in `data`.

## Custom edges

Same pattern: `memo`, props typed as `EdgeProps<TData>`, registered in `src/canvas/edges/index.ts` as `edgeTypes`.
