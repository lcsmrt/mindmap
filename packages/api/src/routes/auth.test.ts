import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';
import { SESSION_COOKIE_NAME } from '../services/sessions.js';
import { createPasswordResetToken } from '../services/password-reset.js';
import { sendPasswordResetEmail } from '../services/email.js';

vi.mock('../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  getLastResetEmail: vi.fn().mockReturnValue(null),
}));

async function cleanAll() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
}

const validSignup = {
  email: 'alice@example.com',
  username: 'alice',
  password: 'password123',
  name: 'Alice',
};

function sessionCookie(res: LightMyRequestResponse) {
  return res.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
}

describe('Auth API', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await cleanAll();
    vi.mocked(sendPasswordResetEmail).mockClear();
  });

  describe('POST /auth/signup', () => {
    it('cria conta — 201 com usuário público (sem hash) + Set-Cookie httpOnly', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });

      expect(res.statusCode).toBe(201);
      const body = res.json<Record<string, unknown>>();
      expect(body).toEqual({
        id: expect.any(String),
        email: 'alice@example.com',
        username: 'alice',
        name: 'Alice',
      });
      expect(body.passwordHash).toBeUndefined();

      const cookie = sessionCookie(res);
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite?.toLowerCase()).toBe('lax');
    });

    it('normaliza e-mail (trim+lowercase) e rejeita duplicata case-insensitive — 409 mensagem de e-mail', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'Alice@Example.com' },
      });
      const dup = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: '  ALICE@EXAMPLE.COM ', username: 'outra', name: 'Outra' },
      });

      expect(dup.statusCode).toBe(409);
      expect(dup.json<{ error: string }>().error).toBe('E-mail já cadastrado');
      expect(await prisma.user.count()).toBe(1);
    });

    it('normaliza username (trim+lowercase) e rejeita duplicata — 409 mensagem de usuário', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, username: 'Alice' },
      });
      const dup = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'outra@example.com', username: '  ALICE  ', name: 'Outra' },
      });

      expect(dup.statusCode).toBe(409);
      expect(dup.json<{ error: string }>().error).toBe('Nome de usuário já em uso');
      expect(await prisma.user.count()).toBe(1);
    });

    it('username com formato inválido — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, username: '-alice-' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('senha com menos de 8 caracteres — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, password: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('e-mail malformado — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('nome vazio (após trim) — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, name: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
    });

    it('credenciais corretas por e-mail — 200 + cookie (regressão)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ email: string }>().email).toBe('alice@example.com');
      expect(sessionCookie(res)?.value).toBeTruthy();
    });

    it('credenciais corretas por username — 200 + cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ username: string }>().username).toBe('alice');
      expect(sessionCookie(res)?.value).toBeTruthy();
    });

    it('senha errada, e-mail inexistente e username inexistente retornam 401 com a MESMA mensagem', async () => {
      const wrongPass = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice@example.com', password: 'errada__' },
      });
      const noUserByEmail = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'ghost@example.com', password: 'password123' },
      });
      const noUserByUsername = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'ghost', password: 'password123' },
      });

      expect(wrongPass.statusCode).toBe(401);
      expect(noUserByEmail.statusCode).toBe(401);
      expect(noUserByUsername.statusCode).toBe(401);
      expect(wrongPass.json()).toEqual(noUserByEmail.json());
      expect(noUserByUsername.json()).toEqual(noUserByEmail.json());
    });

    it('remember=true dura 30d; ausente dura 7d (maxAge do cookie)', async () => {
      const def = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice@example.com', password: 'password123' },
      });
      const rem = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice@example.com', password: 'password123', remember: true },
      });

      expect(sessionCookie(def)?.maxAge).toBe(7 * 24 * 60 * 60);
      expect(sessionCookie(rem)?.maxAge).toBe(30 * 24 * 60 * 60);
    });
  });

  describe('POST /auth/logout', () => {
    it('apaga a sessão: cookie antigo reenviado falha em /me (401)', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;

      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: { [SESSION_COOKIE_NAME]: token },
      });
      expect(logout.statusCode).toBe(204);

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
      });
      expect(me.statusCode).toBe(401);
    });

    it('sem cookie — 204 (idempotente)', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('GET /auth/me', () => {
    it('sem cookie — 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/auth/me' });
      expect(res.statusCode).toBe(401);
    });

    it('com sessão válida — 200 com usuário público', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ email: string }>().email).toBe('alice@example.com');
    });
  });

  describe('PATCH /auth/me', () => {
    it('sem sessão — 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        payload: { name: 'Novo Nome' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('nome válido — atualiza e retorna o AuthUser', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;
      const userId = signup.json<{ id: string }>().id;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: 'Alice Nova' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        id: userId,
        email: 'alice@example.com',
        username: 'alice',
        name: 'Alice Nova',
      });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe(
        'Alice Nova',
      );
    });

    it('nome vazio/só espaços — 400, sem tocar o banco', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;
      const userId = signup.json<{ id: string }>().id;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: '   ' },
      });

      expect(res.statusCode).toBe(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe('Alice');
    });

    it('nome acima do limite — 400', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: 'a'.repeat(101) },
      });

      expect(res.statusCode).toBe(400);
    });

    it('campos extras (email/id) no body são ignorados — só o nome muda', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;
      const userId = signup.json<{ id: string }>().id;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: 'Alice Nova', email: 'other@example.com', id: 'someone-else' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        id: userId,
        email: 'alice@example.com',
        username: 'alice',
        name: 'Alice Nova',
      });
    });

    it('troca username — atualiza e retorna o AuthUser', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;
      const userId = signup.json<{ id: string }>().id;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: 'Alice', username: 'AliceNova' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ username: string }>().username).toBe('alicenova');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).username).toBe(
        'alicenova',
      );
    });

    it('username duplicado — 409, sem tocar o banco', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'bob@example.com', username: 'bob', name: 'Bob' },
      });
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;
      const userId = signup.json<{ id: string }>().id;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: 'Alice', username: 'bob' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json<{ error: string }>().error).toBe('Nome de usuário já em uso');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).username).toBe(
        'alice',
      );
    });

    it('username com formato inválido — 400', async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const token = sessionCookie(signup)!.value;

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: token },
        payload: { name: 'Alice', username: '-alice-' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('afeta só o próprio usuário — outro user permanece intocado', async () => {
      const signupA = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const tokenA = sessionCookie(signupA)!.value;
      const signupB = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'bob@example.com', username: 'bob', name: 'Bob' },
      });
      const userBId = signupB.json<{ id: string }>().id;

      await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: tokenA },
        payload: { name: 'Alice Nova' },
      });

      expect((await prisma.user.findUniqueOrThrow({ where: { id: userBId } })).name).toBe('Bob');
    });
  });

  describe('POST /auth/forgot-password', () => {
    beforeEach(async () => {
      await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
    });

    it('sempre 204 e corpo idêntico — conta existente ou não (neutro)', async () => {
      const existing = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'alice@example.com' },
      });
      const ghost = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'ghost@example.com' },
      });

      expect(existing.statusCode).toBe(204);
      expect(ghost.statusCode).toBe(204);
      expect(existing.body).toBe(ghost.body);
    });

    it('conta existente gera 1 token e dispara o e-mail', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'alice@example.com' },
      });

      expect(await prisma.passwordResetToken.count()).toBe(1);
      expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(sendPasswordResetEmail).mock.calls[0]?.[0]).toBe('alice@example.com');
    });

    it('conta inexistente não cria token nem envia e-mail', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'ghost@example.com' },
      });

      expect(await prisma.passwordResetToken.count()).toBe(0);
      expect(vi.mocked(sendPasswordResetEmail)).not.toHaveBeenCalled();
    });

    it('novo pedido invalida o token anterior (só o último vale)', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'alice@example.com' },
      });
      await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'alice@example.com' },
      });

      expect(await prisma.passwordResetToken.count()).toBe(1);
    });
  });

  describe('GET /auth/reset-password/validate', () => {
    let userId: string;

    beforeEach(async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      userId = signup.json<{ id: string }>().id;
    });

    it('token válido → 200 { valid: true } sem consumir (validar não apaga)', async () => {
      const token = await createPasswordResetToken(userId);

      const first = await app.inject({
        method: 'GET',
        url: `/auth/reset-password/validate?token=${token}`,
      });
      const second = await app.inject({
        method: 'GET',
        url: `/auth/reset-password/validate?token=${token}`,
      });

      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ valid: true });
      expect(second.statusCode).toBe(200);
      expect(await prisma.passwordResetToken.count()).toBe(1);
    });

    it('token inválido → 200 { valid: false } (verdict como dado, não erro)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/reset-password/validate?token=inexistente',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ valid: false });
    });
  });

  describe('POST /auth/reset-password', () => {
    let userId: string;
    let sessionToken: string;

    beforeEach(async () => {
      const signup = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      userId = signup.json<{ id: string }>().id;
      sessionToken = sessionCookie(signup)!.value;
    });

    it('token válido troca a senha e permite login com a nova (204 + single-use)', async () => {
      const token = await createPasswordResetToken(userId);

      const reset = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'novasenha123', logoutOtherDevices: false },
      });
      expect(reset.statusCode).toBe(204);

      const withNew = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice@example.com', password: 'novasenha123' },
      });
      const withOld = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: 'alice@example.com', password: 'password123' },
      });

      expect(withNew.statusCode).toBe(200);
      expect(withOld.statusCode).toBe(401);
    });

    it('single-use: reutilizar o token → 400', async () => {
      const token = await createPasswordResetToken(userId);

      const first = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'novasenha123', logoutOtherDevices: false },
      });
      const second = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'outrasenha123', logoutOtherDevices: false },
      });

      expect(first.statusCode).toBe(204);
      expect(second.statusCode).toBe(400);
    });

    it('token expirado → 400', async () => {
      const token = await createPasswordResetToken(userId);
      await prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'novasenha123' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('senha < 8 caracteres → 400', async () => {
      const token = await createPasswordResetToken(userId);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'curta' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('logoutOtherDevices default (true) derruba as sessões existentes', async () => {
      const token = await createPasswordResetToken(userId);

      await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'novasenha123' },
      });

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: sessionToken },
      });
      expect(me.statusCode).toBe(401);
    });

    it('logoutOtherDevices false preserva as sessões existentes', async () => {
      const token = await createPasswordResetToken(userId);

      await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token, password: 'novasenha123', logoutOtherDevices: false },
      });

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE_NAME]: sessionToken },
      });
      expect(me.statusCode).toBe(200);
    });
  });

  describe('seam de teste /auth/__test/last-reset', () => {
    it('existe em NODE_ENV=test', async () => {
      const res = await app.inject({ method: 'GET', url: '/auth/__test/last-reset' });
      expect(res.statusCode).toBe(200);
    });

    it('ausente fora de NODE_ENV=test', async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const prodApp = buildApp();
      try {
        const res = await prodApp.inject({ method: 'GET', url: '/auth/__test/last-reset' });
        expect(res.statusCode).toBe(404);
      } finally {
        process.env.NODE_ENV = original;
      }
    });
  });

  describe('herança dos mapas órfãos', () => {
    it('primeiro signup herda todos os mapas órfãos; segundo não herda', async () => {
      const orphanA = await prisma.map.create({ data: { title: 'Órfão A' } });
      const orphanB = await prisma.map.create({ data: { title: 'Órfão B' } });

      const first = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });
      const firstId = first.json<{ id: string }>().id;

      const claimedA = await prisma.map.findUniqueOrThrow({ where: { id: orphanA.id } });
      const claimedB = await prisma.map.findUniqueOrThrow({ where: { id: orphanB.id } });
      expect(claimedA.ownerId).toBe(firstId);
      expect(claimedB.ownerId).toBe(firstId);

      const second = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'bob@example.com', username: 'bob', name: 'Bob' },
      });
      const secondId = second.json<{ id: string }>().id;

      expect(await prisma.map.count({ where: { ownerId: secondId } })).toBe(0);
      expect(await prisma.map.count({ where: { ownerId: null } })).toBe(0);
    });
  });
});
