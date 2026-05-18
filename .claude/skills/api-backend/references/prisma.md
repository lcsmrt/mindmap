# Prisma

## Client

Singleton in `src/prisma.ts`. Import everywhere via:

```ts
import { prisma } from '../prisma.js';
```

## Migrations

```bash
pnpm --filter @mindmap/api prisma migrate dev --name <descricao_em_snake_case>
```

- Never edit a migration that has already been applied.
- Schema lives in `packages/api/prisma/schema.prisma`.

## Transactions

Use `prisma.$transaction` when multiple writes must succeed atomically (e.g. creating a map together with its root node):

```ts
const map = await prisma.$transaction(async (tx) => {
  const created = await tx.map.create({ data: { title } });
  await tx.node.create({
    data: { mapId: created.id, parentId: null, title: 'Central', sortOrder: 0 },
  });
  return created;
});
```

## Known errors

Mapped by the central `errorHandler` (see `errors.md`):

- `P2025` — record not found → `404`
- `P2002` — unique constraint violated → `409`

Add new mappings to the handler as new error codes appear.

## Field selection

For list endpoints, use `select` to keep payloads tight:

```ts
await prisma.map.findMany({
  orderBy: { updatedAt: 'desc' },
  select: { id: true, title: true, updatedAt: true },
});
```
