# API Integration Rules

1. Define API requests in **separate `async` functions** using plain `fetch`
2. Wrap API functions in **custom TanStack Query hooks** in the same file
3. Components must **never call fetch or API functions directly** — always go through hooks
4. API functions and their hooks live in `src/api/<resource>.ts`
   - Only hooks reused across multiple resources go in `src/hooks/`
5. All types come from `@mindmap/shared` — never redefine request/response shapes locally
6. Query keys must be **stable and composed of primitive values** — never a plain object
7. Hooks expose `QueryOptions` or `MutationOptions` for optional customization
8. Error handling: components read `isError` and `error` from the hook — no toast infrastructure

Components always use hooks instead of calling API functions directly.
