# Routes

One **plugin per resource**, registered with a URL prefix in `app.ts`.

## Plugin shape

```ts
// src/routes/maps.ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { toMapDetail, toMapSummary } from '../mappers/maps.js';
import { NotFoundError } from '../errors.js';

const IdParam = z.object({ id: z.string() });
const CreateMapBody = z.object({ title: z.string().trim().min(1) });

const mapsPlugin: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    handler: async () => {
      const maps = await prisma.map.findMany({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, updatedAt: true },
      });
      return { maps: maps.map(toMapSummary) };
    },
  });

  app.get('/:id', {
    schema: { params: IdParam },
    handler: async (req) => {
      const map = await prisma.map.findUnique({ where: { id: req.params.id } });
      if (!map) throw new NotFoundError('Map not found');
      return toMapDetail(map);
    },
  });

  app.post('/', {
    schema: { body: CreateMapBody },
    handler: async (req, reply) => {
      const map = await prisma.map.create({ data: { title: req.body.title } });
      return reply.status(201).send(toMapDetail(map));
    },
  });
};

export default mapsPlugin;
```

## Registration

```ts
// src/app.ts
app.register(mapsPlugin, { prefix: '/maps' });
app.register(nodesPlugin, { prefix: '/nodes' });
```

## Rules

- File: `src/routes/<resource>.ts`. Plural noun, lowercase.
- Plugin type: `FastifyPluginAsyncZod` (gives Zod type inference inside handlers).
- Default export of the plugin.
- Handlers stay slim: validate via schema → call Prisma → return mapped DTO.
- If logic grows beyond orchestration (multi-step workflows, cross-resource invariants), extract to `src/services/<resource>.ts`.
