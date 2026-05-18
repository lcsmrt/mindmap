import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { HealthResponse } from '@mindmap/shared';
import { prisma } from './prisma.js';
import { ApiError } from './errors.js';
import mapsPlugin from './routes/maps.js';
import nodesPlugin from './routes/nodes.js';

export function buildApp() {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return reply.status(404).send({ error: 'Not found' });
      }
      if (err.code === 'P2002') {
        return reply.status(409).send({ error: 'Conflict' });
      }
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({ error: 'Validation failed' });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'Internal server error' });
  });

  app.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const body: HealthResponse = { status: 'ok', db: 'ok' };
      return reply.status(200).send(body);
    } catch (err) {
      app.log.warn(err, 'DB health check failed');
      const body: HealthResponse = { status: 'ok', db: 'unreachable' };
      return reply.status(503).send(body);
    }
  });

  app.register(mapsPlugin, { prefix: '/maps' });
  app.register(nodesPlugin, { prefix: '/nodes' });

  return app;
}
