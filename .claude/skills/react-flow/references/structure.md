# Folder structure

All canvas code lives under `packages/web/src/canvas/`.

```
src/canvas/
├── MindmapCanvas.tsx       # Root component (wraps ReactFlowProvider)
├── mappers.ts              # Shared DTO <-> React Flow Node/Edge
├── nodes/
│   ├── MindNode.tsx        # One file per custom node type
│   └── index.ts            # Exports `nodeTypes` registry
├── edges/
│   ├── MindEdge.tsx        # (when custom edges exist)
│   └── index.ts            # Exports `edgeTypes` registry
└── hooks/
    └── useCanvasSync.ts    # Canvas-specific hooks (e.g. seeding, autosave)
```

## Rules

- One node component per file. Filename matches the component name (`MindNode.tsx`).
- `nodes/index.ts` and `edges/index.ts` only export the registry — no logic.
- Mappers between server DTOs and React Flow shapes go in `canvas/mappers.ts`, not in `api/`.
- API hooks stay in `src/api/` (per `web-api-integration` skill). The canvas imports from there; it does not define its own fetches.
- Components outside `src/canvas/` should not import from `@xyflow/react` directly — the canvas is the only consumer.
