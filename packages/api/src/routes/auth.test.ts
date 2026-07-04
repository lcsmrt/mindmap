import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';
import { SESSION_COOKIE_NAME } from '../services/sessions.js';

async function cleanAll() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

const validSignup = {
  email: 'alice@example.com',
  password: 'password123',
  name: 'Alice',
};

function sessionCookie(res: { cookies: Array<{ name: string; value: string }> }) {
  return res.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
}

describe('Auth API', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await cleanAll();
  });

  describe('POST /auth/signup', () => {
    it('cria conta — 201 com usuário público (sem hash) + Set-Cookie httpOnly', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/signup', payload: validSignup });

      expect(res.statusCode).toBe(201);
      const body = res.json<Record<string, unknown>>();
      expect(body).toEqual({
        id: expect.any(String),
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(body.passwordHash).toBeUndefined();

      const cookie = sessionCookie(res);
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite?.toLowerCase()).toBe('lax');
    });

    it('normaliza e-mail (trim+lowercase) e rejeita duplicata case-insensitive — 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: 'Alice@Example.com' },
      });
      const dup = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: { ...validSignup, email: '  ALICE@EXAMPLE.COM ', name: 'Outra' },
      });

      expect(dup.statusCode).toBe(409);
      expect(await prisma.user.count()).toBe(1);
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

    it('credenciais corretas — 200 + cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'alice@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ email: string }>().email).toBe('alice@example.com');
      expect(sessionCookie(res)?.value).toBeTruthy();
    });

    it('senha errada e e-mail inexistente retornam 401 com a MESMA mensagem', async () => {
      const wrongPass = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'alice@example.com', password: 'errada__' },
      });
      const noUser = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ghost@example.com', password: 'password123' },
      });

      expect(wrongPass.statusCode).toBe(401);
      expect(noUser.statusCode).toBe(401);
      expect(wrongPass.json()).toEqual(noUser.json());
    });

    it('remember=true dura 30d; ausente dura 7d (maxAge do cookie)', async () => {
      const def = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'alice@example.com', password: 'password123' },
      });
      const rem = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'alice@example.com', password: 'password123', remember: true },
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
        payload: { ...validSignup, email: 'bob@example.com', name: 'Bob' },
      });
      const secondId = second.json<{ id: string }>().id;

      expect(await prisma.map.count({ where: { ownerId: secondId } })).toBe(0);
      expect(await prisma.map.count({ where: { ownerId: null } })).toBe(0);
    });
  });
});
