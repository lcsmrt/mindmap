import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { SignupBody, LoginBody } from '@mindmap/shared';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { UnauthorizedError } from '../errors.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../lib/password.js';
import { createSession, deleteSession, SESSION_COOKIE_NAME } from '../services/sessions.js';
import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
} from '../plugins/auth-guard.js';
import { toAuthUser } from '../mappers/users.js';

const EmailField = z.string().trim().toLowerCase().pipe(z.email());

const SignupBodySchema = z.object({
  email: EmailField,
  password: z.string().min(8),
  name: z.string().trim().min(1),
  remember: z.boolean().optional(),
}) satisfies z.ZodType<SignupBody>;

const LoginBodySchema = z.object({
  email: EmailField,
  password: z.string(),
  remember: z.boolean().optional(),
}) satisfies z.ZodType<LoginBody>;

const authPlugin: FastifyPluginAsyncZod = async (app) => {
  app.post('/signup', {
    schema: { body: SignupBodySchema },
    handler: async (req, reply) => {
      const { email, password, name, remember } = req.body;
      const passwordHash = await hashPassword(password);

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, passwordHash, name },
        });
        const userCount = await tx.user.count();
        if (userCount === 1) {
          await tx.map.updateMany({
            where: { ownerId: null },
            data: { ownerId: created.id },
          });
        }
        return created;
      });

      const { token, maxAgeSeconds } = await createSession(user.id, remember ?? false);
      setSessionCookie(reply, token, maxAgeSeconds);
      return reply.status(201).send(toAuthUser(user));
    },
  });

  app.post('/login', {
    schema: { body: LoginBodySchema },
    handler: async (req, reply) => {
      const { email, password, remember } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      // verifica sempre (contra hash dummy quando o e-mail não existe) p/ não vazar
      // existência da conta por tempo de resposta
      const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
      if (!user || !passwordOk) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const { token, maxAgeSeconds } = await createSession(user.id, remember ?? false);
      setSessionCookie(reply, token, maxAgeSeconds);
      return reply.status(200).send(toAuthUser(user));
    },
  });

  app.post('/logout', {
    handler: async (req, reply) => {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (token) await deleteSession(token);
      clearSessionCookie(reply);
      return reply.status(204).send();
    },
  });

  app.get('/me', {
    preHandler: requireAuth,
    handler: async (req) => req.user,
  });
};

export default authPlugin;
