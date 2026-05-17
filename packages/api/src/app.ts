import Fastify from 'fastify';
import type { HealthResponse } from '@mindmap/shared';
import { prisma } from './prisma.js';

export function buildApp() {
  const app = Fastify({ logger: true });

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

  return app;
}
