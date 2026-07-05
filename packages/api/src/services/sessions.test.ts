import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma.js';
import {
  createSession,
  findValidSession,
  deleteSession,
  SESSION_TTL_DAYS,
  SESSION_TTL_REMEMBER_DAYS,
} from './sessions.js';

const DAY_SECONDS = 24 * 60 * 60;

async function createUser(email = 'u@example.com') {
  const username = email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return prisma.user.create({
    data: { email, username, passwordHash: 'x', name: 'User' },
  });
}

describe('sessions service', () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it('createSession grava a sessão e o token valida (hash determinístico)', async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, false);

    const authUser = await findValidSession(token);
    expect(authUser).toEqual({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
    });
  });

  it('maxAge reflete remember: 7d default, 30d com remember', async () => {
    const user = await createUser();
    const def = await createSession(user.id, false);
    const rem = await createSession(user.id, true);

    expect(def.maxAgeSeconds).toBe(SESSION_TTL_DAYS * DAY_SECONDS);
    expect(rem.maxAgeSeconds).toBe(SESSION_TTL_REMEMBER_DAYS * DAY_SECONDS);
  });

  it('token desconhecido retorna null', async () => {
    expect(await findValidSession('inexistente')).toBeNull();
  });

  it('sessão expirada retorna null e é removida', async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, false);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await findValidSession(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it('deleteSession é idempotente e revoga a sessão', async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, false);

    await deleteSession(token);
    expect(await findValidSession(token)).toBeNull();
    await expect(deleteSession(token)).resolves.toBeUndefined();
  });
});
