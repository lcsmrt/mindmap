# Validation (Zod)

All request validation goes through `zod` schemas wired via `fastify-type-provider-zod`. The schema validates **and** infers the TS type of `req.params` / `req.body` / `req.query`.

## One-time setup (in `src/app.ts`)

```ts
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

export function buildApp() {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // ...register plugins, errorHandler
  return app;
}
```

## Defining a route

```ts
import { z } from 'zod';

const CreateMapBody = z.object({
  title: z.string().trim().min(1),
});

app.post('/', {
  schema: { body: CreateMapBody },
  handler: async (req, reply) => {
    // req.body.title is `string`, already validated and trimmed
    const map = await prisma.map.create({ data: { title: req.body.title } });
    return reply.status(201).send(toMapDetail(map));
  },
});
```

## Rules

- Schemas live in the route file. If reused across files, move to `src/schemas/<resource>.ts`.
- When the input mirrors a shared DTO, constrain the schema to the DTO type:
  ```ts
  const CreateMapBody = z.object({ title: z.string().trim().min(1) })
    satisfies z.ZodType<CreateMapBody>;
  ```
- Never call `.trim()` / `null` checks manually inside the handler — push them into the schema.
- Zod validation failures are mapped to `400` automatically by the type provider; do not catch them.
