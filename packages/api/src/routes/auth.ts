import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type {
  SignupBody,
  LoginBody,
  UpdateProfileBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  ResetTokenStatus,
} from '@mindmap/shared';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../errors.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../lib/password.js';
import { createSession, deleteSession, SESSION_COOKIE_NAME } from '../services/sessions.js';
import {
  createPasswordResetToken,
  findValidResetToken,
  consumeResetToken,
} from '../services/password-reset.js';
import { sendPasswordResetEmail, getLastResetEmail } from '../services/email.js';
import {
  requireAuth,
  requireUser,
  setSessionCookie,
  clearSessionCookie,
} from '../plugins/auth-guard.js';
import { toAuthUser } from '../mappers/users.js';

const EmailField = z.string().trim().toLowerCase().pipe(z.email());
const NameField = z.string().trim().min(1).max(100);
const UsernameField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().min(1).max(39).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

const SignupBodySchema = z.object({
  email: EmailField,
  username: UsernameField,
  password: z.string().min(8),
  name: NameField,
  remember: z.boolean().optional(),
}) satisfies z.ZodType<SignupBody>;

const LoginBodySchema = z.object({
  email: EmailField,
  password: z.string(),
  remember: z.boolean().optional(),
}) satisfies z.ZodType<LoginBody>;

const UpdateProfileBodySchema = z.object({
  name: NameField,
}) satisfies z.ZodType<UpdateProfileBody>;

const ForgotPasswordBodySchema = z.object({
  email: EmailField,
}) satisfies z.ZodType<ForgotPasswordBody>;

const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  logoutOtherDevices: z.boolean().optional(),
}) satisfies z.ZodType<ResetPasswordBody>;

const ResetValidateQuerySchema = z.object({
  token: z.string().min(1),
});

const authPlugin: FastifyPluginAsyncZod = async (app) => {
  app.post('/signup', {
    schema: { body: SignupBodySchema },
    handler: async (req, reply) => {
      const { email, username, password, name, remember } = req.body;
      const passwordHash = await hashPassword(password);

      let user;
      try {
        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: { email, username, passwordHash, name },
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
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = err.meta?.target as string[] | string | undefined;
          const field = Array.isArray(target) ? target.join(',') : String(target ?? '');
          if (field.includes('email')) throw new ConflictError('E-mail já cadastrado');
          if (field.includes('username')) throw new ConflictError('Nome de usuário já em uso');
        }
        throw err;
      }

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

  app.patch('/me', {
    preHandler: requireAuth,
    schema: { body: UpdateProfileBodySchema },
    handler: async (req) => {
      const { id } = requireUser(req);
      const user = await prisma.user.update({
        where: { id },
        data: { name: req.body.name },
      });
      return toAuthUser(user);
    },
  });

  app.post('/forgot-password', {
    schema: { body: ForgotPasswordBodySchema },
    handler: async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (user) {
        // Falha de envio não pode virar 500 nem vazar a existência da conta (M21-02/04):
        // logamos server-side e respondemos o mesmo 204 neutro.
        try {
          const token = await createPasswordResetToken(user.id);
          const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
          await sendPasswordResetEmail(user.email, resetUrl);
        } catch (err) {
          req.log.error(err, 'failed to send password reset email');
        }
      }
      return reply.status(204).send();
    },
  });

  app.get('/reset-password/validate', {
    schema: { querystring: ResetValidateQuerySchema },
    handler: async (req): Promise<ResetTokenStatus> => {
      const record = await findValidResetToken(req.query.token);
      return { valid: record !== null };
    },
  });

  app.post('/reset-password', {
    schema: { body: ResetPasswordBodySchema },
    handler: async (req, reply) => {
      const { token, password, logoutOtherDevices } = req.body;
      const record = await findValidResetToken(token);
      if (!record) throw new BadRequestError('Invalid or expired token');

      const passwordHash = await hashPassword(password);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
        await consumeResetToken(record.id, tx);
        if (logoutOtherDevices ?? true) {
          await tx.session.deleteMany({ where: { userId: record.userId } });
        }
      });

      return reply.status(204).send();
    },
  });

  // Seam de teste: expõe o último link de reset capturado em memória para o e2e
  // (evita e-mail real). Montada só em test — nunca em prod.
  if (process.env.NODE_ENV === 'test') {
    app.get('/__test/last-reset', {
      handler: async () => getLastResetEmail() ?? {},
    });
  }
};

export default authPlugin;
