import type { AuthUser } from '@mindmap/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}
