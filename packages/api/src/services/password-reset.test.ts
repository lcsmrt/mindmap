import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma.js';
import {
  createPasswordResetToken,
  findValidResetToken,
  consumeResetToken,
  RESET_TTL_MINUTES,
} from './password-reset.js';

const MINUTE_MS = 60 * 1000;

async function createUser(email = 'reset@example.com') {
  return prisma.user.create({ data: { email, passwordHash: 'x', name: 'User' } });
}

describe('password-reset service', () => {
  beforeEach(async () => {
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it('cria o token e ele valida (hash determinístico), retornando { id, userId }', async () => {
    const user = await createUser();
    const token = await createPasswordResetToken(user.id);

    const record = await findValidResetToken(token);
    expect(record).toEqual({ id: expect.any(String), userId: user.id });
  });

  it('expira RESET_TTL_MINUTES à frente', async () => {
    const user = await createUser();
    const before = Date.now();
    await createPasswordResetToken(user.id);

    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    const ttlMs = row.expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan((RESET_TTL_MINUTES - 1) * MINUTE_MS);
    expect(ttlMs).toBeLessThanOrEqual((RESET_TTL_MINUTES + 1) * MINUTE_MS);
  });

  it('token desconhecido retorna null', async () => {
    expect(await findValidResetToken('inexistente')).toBeNull();
  });

  it('token expirado retorna null e é removido', async () => {
    const user = await createUser();
    const token = await createPasswordResetToken(user.id);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await findValidResetToken(token)).toBeNull();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it('novo pedido invalida o token anterior (só o último vale)', async () => {
    const user = await createUser();
    const first = await createPasswordResetToken(user.id);
    const second = await createPasswordResetToken(user.id);

    expect(await findValidResetToken(first)).toBeNull();
    expect(await findValidResetToken(second)).not.toBeNull();
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it('consumeResetToken remove o token (uso único)', async () => {
    const user = await createUser();
    const token = await createPasswordResetToken(user.id);
    const record = await findValidResetToken(token);

    await consumeResetToken(record!.id);
    expect(await findValidResetToken(token)).toBeNull();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });
});
