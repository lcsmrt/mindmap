import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hash difere do texto plano e usa argon2id', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verify retorna true para a senha correta', async () => {
    const hash = await hashPassword('s3nha-valida');
    expect(await verifyPassword(hash, 's3nha-valida')).toBe(true);
  });

  it('verify retorna false para senha errada', async () => {
    const hash = await hashPassword('s3nha-valida');
    expect(await verifyPassword(hash, 'errada')).toBe(false);
  });

  it('verify retorna false (sem lançar) para hash inválido', async () => {
    expect(await verifyPassword('nao-e-um-hash', 'qualquer')).toBe(false);
  });
});
