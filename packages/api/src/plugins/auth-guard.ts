import '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from '@mindmap/shared';
import { env } from '../env.js';
import { UnauthorizedError } from '../errors.js';
import { SESSION_COOKIE_NAME, findValidSession } from '../services/sessions.js';

export function setSessionCookie(reply: FastifyReply, token: string, maxAgeSeconds: number): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.COOKIE_SECURE,
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[SESSION_COOKIE_NAME];
  const authUser = token ? await findValidSession(token) : null;

  if (!authUser) {
    clearSessionCookie(reply);
    throw new UnauthorizedError();
  }

  req.user = authUser;
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
