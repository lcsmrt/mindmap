import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';
import { createUserWithSession } from '../test/helpers.js';

async function cleanAll() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

describe('Maps API', () => {
  let app: FastifyInstance;
  let cookie: Record<string, string>;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await cleanAll();
    ({ cookie } = await createUserWithSession());
  });

  describe('guarda de sessão', () => {
    it('sem cookie — 401 em GET /maps', async () => {
      const res = await app.inject({ method: 'GET', url: '/maps' });
      expect(res.statusCode).toBe(401);
    });

    it('sem cookie — 401 em POST /maps', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'X' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /maps', () => {
    it('retorna lista vazia inicialmente', async () => {
      const res = await app.inject({ method: 'GET', url: '/maps', cookies: cookie });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ maps: [] });
    });

    it('retorna mapas ordenados por updatedAt desc', async () => {
      await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Primeiro' }, cookies: cookie });
      await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Segundo' }, cookies: cookie });

      const res = await app.inject({ method: 'GET', url: '/maps', cookies: cookie });
      const body = res.json<{ maps: Array<{ title: string }> }>();

      expect(res.statusCode).toBe(200);
      expect(body.maps[0]?.title).toBe('Segundo');
      expect(body.maps[1]?.title).toBe('Primeiro');
    });

    it('mapa recém-criado tem nodeCount 1 (inclui raiz) e criticalCount 0', async () => {
      await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Solo' }, cookies: cookie });

      const res = await app.inject({ method: 'GET', url: '/maps', cookies: cookie });
      const body = res.json<{
        maps: Array<{ nodeCount: number; criticalCount: number }>;
      }>();

      expect(res.statusCode).toBe(200);
      expect(body.maps).toHaveLength(1);
      expect(body.maps[0]?.nodeCount).toBe(1);
      expect(body.maps[0]?.criticalCount).toBe(0);
    });

    it('agrega nodeCount e criticalCount corretamente', async () => {
      const created = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Com nós' }, cookies: cookie });
      const { id } = created.json<{ id: string }>();
      const root = await prisma.node.findFirstOrThrow({
        where: { mapId: id, parentId: null },
      });

      await prisma.node.createMany({
        data: [
          { mapId: id, parentId: root.id, title: 'Crítico A', sortOrder: 0, isCritical: true },
          { mapId: id, parentId: root.id, title: 'Crítico B', sortOrder: 1, isCritical: true },
          { mapId: id, parentId: root.id, title: 'Normal', sortOrder: 2, isCritical: false },
        ],
      });

      const res = await app.inject({ method: 'GET', url: '/maps', cookies: cookie });
      const body = res.json<{
        maps: Array<{ id: string; nodeCount: number; criticalCount: number }>;
      }>();

      const item = body.maps.find((m) => m.id === id);
      expect(item?.nodeCount).toBe(4);
      expect(item?.criticalCount).toBe(2);
    });

    it('inclui createdAt em cada item', async () => {
      await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Com data' }, cookies: cookie });

      const res = await app.inject({ method: 'GET', url: '/maps', cookies: cookie });
      const body = res.json<{ maps: Array<{ createdAt: string }> }>();

      expect(body.maps).toHaveLength(1);
      expect(typeof body.maps[0]?.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(body.maps[0]!.createdAt))).toBe(false);
    });
  });

  describe('POST /maps', () => {
    it('cria mapa com título válido — 201 com body correto, nó raiz e ownerId do dono', async () => {
      const res = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Meu Mapa' }, cookies: cookie });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ id: string; title: string }>();
      expect(body.title).toBe('Meu Mapa');
      expect(typeof body.id).toBe('string');

      const stored = await prisma.map.findUniqueOrThrow({ where: { id: body.id } });
      expect(stored.ownerId).not.toBeNull();

      const rootNode = await prisma.node.findFirst({
        where: { mapId: body.id, parentId: null },
      });
      expect(rootNode).not.toBeNull();
      expect(rootNode?.title).toBe('Meu Mapa');
    });

    it('rejeita título vazio — 400', async () => {
      const res = await app.inject({ method: 'POST', url: '/maps', payload: { title: '' }, cookies: cookie });
      expect(res.statusCode).toBe(400);
    });

    it('rejeita título com só espaços — 400', async () => {
      const res = await app.inject({ method: 'POST', url: '/maps', payload: { title: '   ' }, cookies: cookie });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /maps/:id', () => {
    it('retorna mapa existente — 200', async () => {
      const created = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Teste' }, cookies: cookie });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({ method: 'GET', url: `/maps/${id}`, cookies: cookie });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ title: string }>().title).toBe('Teste');
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await app.inject({ method: 'GET', url: '/maps/nao-existe', cookies: cookie });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /maps/:id', () => {
    it('atualiza título — 200 com título atualizado', async () => {
      const created = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Original' }, cookies: cookie });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({ method: 'PATCH', url: `/maps/${id}`, payload: { title: 'Renomeado' }, cookies: cookie });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ title: string }>().title).toBe('Renomeado');
    });

    it('rejeita título vazio — 400', async () => {
      const created = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Original' }, cookies: cookie });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({ method: 'PATCH', url: `/maps/${id}`, payload: { title: '' }, cookies: cookie });
      expect(res.statusCode).toBe(400);
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await app.inject({ method: 'PATCH', url: '/maps/nao-existe', payload: { title: 'Qualquer' }, cookies: cookie });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /maps/:id', () => {
    it('deleta mapa existente — 204', async () => {
      const created = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Para deletar' }, cookies: cookie });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({ method: 'DELETE', url: `/maps/${id}`, cookies: cookie });
      expect(res.statusCode).toBe(204);
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/maps/nao-existe', cookies: cookie });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('isolamento por dono (A ↔ B)', () => {
    it('B não vê o mapa de A no GET /maps, e por id recebe 404 (get/patch/delete)', async () => {
      const createdA = await app.inject({ method: 'POST', url: '/maps', payload: { title: 'Mapa de A' }, cookies: cookie });
      const { id: idA } = createdA.json<{ id: string }>();

      const { cookie: cookieB } = await createUserWithSession({ email: 'b@example.com', name: 'Bob' });

      const listB = await app.inject({ method: 'GET', url: '/maps', cookies: cookieB });
      expect(listB.json<{ maps: unknown[] }>().maps).toHaveLength(0);

      const getB = await app.inject({ method: 'GET', url: `/maps/${idA}`, cookies: cookieB });
      expect(getB.statusCode).toBe(404);

      const patchB = await app.inject({ method: 'PATCH', url: `/maps/${idA}`, payload: { title: 'Invadido' }, cookies: cookieB });
      expect(patchB.statusCode).toBe(404);

      const delB = await app.inject({ method: 'DELETE', url: `/maps/${idA}`, cookies: cookieB });
      expect(delB.statusCode).toBe(404);

      const stillThere = await prisma.map.findUnique({ where: { id: idA } });
      expect(stillThere).not.toBeNull();
    });
  });
});
