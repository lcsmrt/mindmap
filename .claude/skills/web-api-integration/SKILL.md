---
name: web-api-integration
description: Implements React frontend API integrations using TanStack Query with a standardized architecture based on custom hooks and query/mutation patterns. Use when creating or modifying API calls, queries, or mutations in React applications.
---

# API Integration Skill

This project integrates backend APIs using **TanStack Query wrapped in custom hooks**.

API functions use **plain `fetch`**. Types are imported from **`@mindmap/shared`** — never redefined locally.

## Architecture Overview

All API communication follows this structure:

1. **API functions** (`src/api/<resource>.ts`)
   - Plain `async` functions using `fetch`
   - Responsible only for HTTP requests
   - Throw `Error` on non-ok responses

2. **TanStack Query hooks** (same file as API functions)
   - Wrap API functions with `useQuery` or `useMutation`
   - Own caching, invalidation, and enabled logic
   - Exported alongside the API functions

3. **Components**
   - Call hooks only — never `fetch` directly
   - Own error display via `isError` / `error` from the hook

This separation ensures consistent caching, reusable hooks, and UI decoupled from fetch logic.

---

## Shared Types

All request/response types come from `@mindmap/shared`:

```ts
import type { MapSummary, MapDetail, CreateMapBody } from '@mindmap/shared';
```

Never redefine types that already exist in `@mindmap/shared`.

---

## Implementation Rules

See the detailed rules:

- `references/rules.md`

---

## Query Patterns

See `references/query-patterns.md`:

- Basic list query
- Parameterized (single entity) query
- `enabled` usage for conditional fetching

---

## Mutation Patterns

See `references/mutation-patterns.md`:

- Mutation structure
- Query invalidation on success
- Error handling via hook return values

---

## Query Key Conventions

See `references/query-keys.md`:

- Key structure per resource
- Invalidation-friendly design

---

## Usage Guidance

Use this skill when:

- Implementing a new API integration
- Creating TanStack Query hooks
- Adding queries or mutations
- Refactoring existing `useEffect`-based API calls
