# Testing

`vitest` + Fastify's `app.inject()`. Tests hit the **real Postgres** — no mocks.

## Suite layout

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';

describe('Maps API', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await prisma.node.deleteMany();
    await prisma.map.deleteMany();
  });

  it('cria mapa — 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/maps',
      payload: { title: 'Meu mapa' },
    });
    expect(res.statusCode).toBe(201);
  });
});
```

## Rules

- One `buildApp()` per suite in `beforeAll`. Never inside `it()`.
- `beforeEach` only does DB cleanup, in dependency order (children → parents).
- No Prisma mocks; when asserting side effects, query the DB directly (`prisma.node.findFirst(...)`).
- Test descriptions in pt-BR (CLAUDE.md rule); test code in English.
- Run: `pnpm --filter @mindmap/api test`.
