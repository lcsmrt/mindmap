---
name: react-flow
description: Builds the mindmap canvas using @xyflow/react. Use when adding or modifying the canvas, custom nodes/edges, viewport behavior, or synchronization between canvas state and the backend.
---

# React Flow Skill

The mindmap canvas uses **`@xyflow/react`** (the maintained successor to the old `reactflow` package). All canvas code lives under `packages/web/src/canvas/`.

## Architecture Overview

1. **`MindmapCanvas`** (`src/canvas/MindmapCanvas.tsx`)
   - Top-level component wrapped in `<ReactFlowProvider>`.
   - Owns local node/edge state via `useNodesState` / `useEdgesState`, seeded from server data.
2. **Custom node/edge types** (`src/canvas/nodes/`, `src/canvas/edges/`)
   - Each type is a memoized React component.
   - Registries (`nodeTypes`, `edgeTypes`) are declared **outside** any component or memoized with empty deps.
3. **Sync layer** (`src/canvas/hooks/`)
   - Reads initial state via TanStack Query.
   - Persists changes through mutations (optimistic, debounced for continuous changes like drag).

## Shared Types

Node/edge payloads live in `@mindmap/shared`. The canvas converts those DTOs to React Flow's `Node` / `Edge` shape and back — never store React Flow's runtime shape on the server.

## References

- `references/setup.md` — `ReactFlowProvider`, `nodeTypes`/`edgeTypes` registry, CSS import
- `references/components.md` — custom node/edge components (handles, memo, props)
- `references/state.md` — `useNodesState` / `useEdgesState` vs server-owned state
- `references/sync.md` — TanStack Query integration, optimistic updates, debounced drag
- `references/structure.md` — folder layout under `src/canvas/`

## Usage Guidance

Use this skill when:

- Adding the canvas or any new node/edge type
- Wiring viewport, selection, or interaction behavior
- Synchronizing canvas state with the backend
- Touching anything under `src/canvas/`
