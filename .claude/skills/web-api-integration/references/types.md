# Shared Types

All API request/response types are defined in `@mindmap/shared` and imported directly:

```ts
import type {
  MapSummary,
  MapDetail,
  MapListResponse,
  CreateMapBody,
  UpdateMapBody,
} from '@mindmap/shared';
```

Never redefine these types locally in the web package.

---

## QueryOptions

A thin wrapper over TanStack's `UseQueryOptions` that removes `queryKey` (always controlled by the hook):

```ts
import type { UseQueryOptions } from '@tanstack/react-query';

export type QueryOptions<TData = unknown> = Omit<UseQueryOptions<TData>, 'queryKey'>;
```

Defined once in `src/api/types.ts` and imported by each hook file.

---

## MutationOptions

Optional callbacks exposed by mutation hooks:

```ts
export type MutationOptions<TData = unknown, TVariables = unknown> = {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error) => void;
};
```

Defined in `src/api/types.ts`. Components receive `onSuccess`/`onError` through this interface — they do not call `useMutation` directly.
