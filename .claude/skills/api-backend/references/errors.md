# Errors

Handlers **throw** `ApiError` subclasses. A central `errorHandler` formats the response. No handler calls `reply.status(4xx).send(...)` directly.

## `ApiError` (in `src/errors.ts`)

```ts
export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}
```

Add new subclasses (`ForbiddenError`, `UnauthorizedError`, ...) when a new status code class is needed.

## `errorHandler` (in `src/app.ts`)

```ts
import { Prisma } from '@prisma/client';
import { ApiError } from './errors.js';

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ApiError) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return reply.status(404).send({ error: 'Not found' });
    if (err.code === 'P2002') return reply.status(409).send({ error: 'Conflict' });
  }
  app.log.error(err);
  return reply.status(500).send({ error: 'Internal server error' });
});
```

## Response shape

All errors return `{ error: string }`. The HTTP status code carries the discriminator.

## Inside a handler

```ts
const map = await prisma.map.findUnique({ where: { id: req.params.id } });
if (!map) throw new NotFoundError('Map not found');
return reply.status(200).send(toMapDetail(map));
```

## Rules

- Never `return reply.status(4xx).send(...)` from a handler. Throw.
- Validation errors are handled by `fastify-type-provider-zod` — don't touch them.
- Prefer `findUnique` + manual throw over `findUniqueOrThrow` (clearer error message).
