---
name: api-backend
description: Implements Fastify routes with Prisma in this project's backend (packages/api). Use when adding or modifying endpoints, request/response schemas, error handling, mappers, or backend tests.
---

# API Backend Skill

This project's backend uses **Fastify 5 + Prisma 6 + Zod**, tested with **vitest** + `app.inject()`.

## Architecture Overview

Every endpoint follows this pipeline:

1. **Plugin per resource** (`src/routes/<resource>.ts`)
   - One `FastifyPluginAsyncZod`, registered in `app.ts` with a URL prefix.
2. **Zod schemas**
   - Validate `params` / `body` / `querystring`; request types are inferred.
   - Wired via `fastify-type-provider-zod`.
3. **Handler**
   - Reads the validated request, calls Prisma, returns a mapped DTO.
   - Throws `ApiError` subclasses on failure (never calls `reply.status(4xx)` directly).
4. **Mapper** (`src/mappers/<resource>.ts`)
   - Pure function: Prisma model → shared DTO (Dates → ISO strings).
5. **errorHandler** (`src/app.ts`)
   - Converts `ApiError` and known Prisma errors to a uniform JSON shape.

## Shared Types

DTOs come from `@mindmap/shared`. Mappers return these types; never redefine them.

## References

- `references/validation.md` — Zod schemas + `fastify-type-provider-zod`
- `references/errors.md` — `ApiError` class + central `errorHandler`
- `references/routes.md` — plugin structure + registration in `app.ts`
- `references/mappers.md` — Prisma → DTO transformers
- `references/testing.md` — vitest + `app.inject` patterns
- `references/prisma.md` — client singleton, transactions, migrations, known errors

## Usage Guidance

Use this skill when:

- Adding a new endpoint or resource
- Defining or refactoring request/response schemas
- Adding backend tests
- Touching Prisma client usage or migrations
