import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

export const RESET_TTL_MINUTES = 60;

const MINUTE_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * MINUTE_MS);

  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  return token;
}

export async function findValidResetToken(
  token: string,
): Promise<{ id: string; userId: string } | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record) return null;

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash: record.tokenHash } });
    return null;
  }

  return { id: record.id, userId: record.userId };
}

export function consumeResetToken(
  tokenId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<unknown> {
  return tx.passwordResetToken.delete({ where: { id: tokenId } });
}
