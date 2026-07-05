# Folder structure

Canvas code lives under `packages/web/src/pages/map/` (page-scoped, per the project's
frontend-structure rule): rich components in `components/`, pure layout helpers in `lib/`.

```
packages/web/src/
├── pages/map/
│   ├── components/
│   │   ├── MapCanvas.tsx          # Root: <Zoom> + SVG edge layer + HTML node layer; wires handlers/mutations
│   │   ├── GhostBar.tsx           # Drop placeholder rendered at the target slot during drag   [M17]
│   │   ├── MindNode.tsx           # HTML node component (memo, no handles, controlled inline edit)
│   │   ├── NodeTaskIndicators.tsx # Progressive task footer (status dot / initials / 🚩)  [M6]
│   │   ├── StatusSelector.tsx     # Segmented status buttons (used by the dialog)           [M6]
│   │   ├── ColorSwatchGrid.tsx    # Color palette swatches (used by the dialog)             [M5]
│   │   ├── NodeEditDialog.tsx     # Edit dialog (title, colors, task props) — lib-agnostic
│   │   ├── useNodeDrag.ts         # Pointer-event drag-to-reparent + pure findDropTarget
│   │   ├── useContainerSize.ts    # ResizeObserver container size hook                       [M17]
│   │   ├── useNodeEditing.ts      # Inline-edit + edit-dialog state extracted from MapCanvas [M17]
│   │   ├── useMeasuredHeights.ts  # Shared ResizeObserver → measured node heights            [M12]
│   │   ├── task-meta.ts           # STATUS_OPTIONS, getInitials, hasTaskProps (pure)
│   │   └── types.ts               # MindNodeData and related prop types
│   └── lib/
│       ├── tree.ts                # buildTree + visibleNodes (adjacency list → visible tree)
│       ├── slots.ts               # Drop-slot geometry: computeSlots / nearestSlot (pure)    [M9/M13]
│       ├── nodeSize.ts            # NODE_WIDTH, MIN_NODE_WIDTH, nodeWidth / estimateNodeHeight
│       └── useTreeLayout.ts       # d3-flextree layout: computeTreeLayout (pure) + useTreeLayout hook
└── api/
    ├── nodes.ts               # useNodes + create/update/delete/move mutations (optimistic)
    ├── maps.ts                # map queries
    └── _request.ts            # shared request<T> helper
```

Removed in M7 (do not recreate): `lib/layout.worker.ts`, `lib/useLayoutedTree.ts`,
`lib/treeLayout.ts` (all replaced by `useTreeLayout.ts`).

## Rules

- One component per file; filename matches the component (`MindNode.tsx`).
- Pure, testable logic (layout math, `findDropTarget`, `getInitials`, `hasTaskProps`) stays free of
  React/DOM so it can be unit-tested. Co-locate `*.test.ts` next to the source.
- API hooks stay in `src/api/`; the canvas imports them and never defines its own `fetch`.
- Page-scoped components live under `pages/map/components/`. Only promote to `src/components/` when
  shared by 2+ pages; reuse `src/components/ui/` primitives before creating new ones.
- No file imports `@xyflow/react` or `elkjs` — they're gone.
