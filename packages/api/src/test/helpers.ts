import { prisma } from '../prisma.js';
import { hashPassword } from '../lib/password.js';
import { createSession, SESSION_COOKIE_NAME } from '../services/sessions.js';

interface CreateUserOptions {
  email?: string;
  name?: string;
  password?: string;
  remember?: boolean;
}

export async function createUserWithSession(opts: CreateUserOptions = {}) {
  const email = opts.email ?? 'user@example.com';
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(opts.password ?? 'password123'),
      name: opts.name ?? 'User',
    },
  });
  const { token } = await createSession(user.id, opts.remember ?? false);
  return { user, token, cookie: { [SESSION_COOKIE_NAME]: token } };
}
