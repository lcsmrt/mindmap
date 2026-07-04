import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '@mindmap/shared';
import { prisma } from '../prisma.js';
import { toAuthUser } from '../mappers/users.js';

export const SESSION_TTL_DAYS = 7;
export const SESSION_TTL_REMEMBER_DAYS = 30;
export const SESSION_COOKIE_NAME = 'mm_session';

const DAY_SECONDS = 24 * 60 * 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  remember: boolean
): Promise<{ token: string; maxAgeSeconds: number }> {
  const token = randomBytes(32).toString('base64url');
  const maxAgeSeconds = (remember ? SESSION_TTL_REMEMBER_DAYS : SESSION_TTL_DAYS) * DAY_SECONDS;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  return { token, maxAgeSeconds };
}

export async function findValidSession(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash: session.tokenHash } });
    return null;
  }

  return toAuthUser(session.user);
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
