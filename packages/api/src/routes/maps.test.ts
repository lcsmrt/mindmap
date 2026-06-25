import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';

async function cleanMaps() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
}

describe('Maps API', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await cleanMaps();
  });

  describe('GET /maps', () => {
    it('retorna lista vazia inicialmente', async () => {
      const res = await app.inject({ method: 'GET', url: '/maps' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ maps: [] });
    });

    it('retorna mapas ordenados por updatedAt desc', async () => {
      await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Primeiro' },
      });
      await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Segundo' },
      });

      const res = await app.inject({ method: 'GET', url: '/maps' });
      const body = res.json<{ maps: Array<{ title: string }> }>();

      expect(res.statusCode).toBe(200);
      expect(body.maps[0]?.title).toBe('Segundo');
      expect(body.maps[1]?.title).toBe('Primeiro');
    });

    it('mapa recém-criado tem nodeCount 1 (inclui raiz) e criticalCount 0', async () => {
      await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Solo' },
      });

      const res = await app.inject({ method: 'GET', url: '/maps' });
      const body = res.json<{
        maps: Array<{ nodeCount: number; criticalCount: number }>;
      }>();

      expect(res.statusCode).toBe(200);
      expect(body.maps).toHaveLength(1);
      expect(body.maps[0]?.nodeCount).toBe(1);
      expect(body.maps[0]?.criticalCount).toBe(0);
    });

    it('agrega nodeCount e criticalCount corretamente', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Com nós' },
      });
      const { id } = created.json<{ id: string }>();
      const root = await prisma.node.findFirstOrThrow({
        where: { mapId: id, parentId: null },
      });

      await prisma.node.createMany({
        data: [
          {
            mapId: id,
            parentId: root.id,
            title: 'Crítico A',
            sortOrder: 0,
            isCritical: true,
          },
          {
            mapId: id,
            parentId: root.id,
            title: 'Crítico B',
            sortOrder: 1,
            isCritical: true,
          },
          {
            mapId: id,
            parentId: root.id,
            title: 'Normal',
            sortOrder: 2,
            isCritical: false,
          },
        ],
      });

      const res = await app.inject({ method: 'GET', url: '/maps' });
      const body = res.json<{
        maps: Array<{ id: string; nodeCount: number; criticalCount: number }>;
      }>();

      const item = body.maps.find((m) => m.id === id);
      expect(item?.nodeCount).toBe(4);
      expect(item?.criticalCount).toBe(2);
    });

    it('inclui createdAt em cada item', async () => {
      await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Com data' },
      });

      const res = await app.inject({ method: 'GET', url: '/maps' });
      const body = res.json<{ maps: Array<{ createdAt: string }> }>();

      expect(body.maps).toHaveLength(1);
      expect(typeof body.maps[0]?.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(body.maps[0]!.createdAt))).toBe(false);
    });
  });

  describe('POST /maps', () => {
    it('cria mapa com título válido — 201 com body correto e nó raiz', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Meu Mapa' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ id: string; title: string }>();
      expect(body.title).toBe('Meu Mapa');
      expect(typeof body.id).toBe('string');

      const rootNode = await prisma.node.findFirst({
        where: { mapId: body.id, parentId: null },
      });
      expect(rootNode).not.toBeNull();
      expect(rootNode?.title).toBe('Meu Mapa');
    });

    it('rejeita título vazio — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejeita título com só espaços — 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: '   ' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /maps/:id', () => {
    it('retorna mapa existente — 200', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Teste' },
      });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({ method: 'GET', url: `/maps/${id}` });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ title: string }>().title).toBe('Teste');
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/maps/nao-existe',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /maps/:id', () => {
    it('atualiza título — 200 com título atualizado', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Original' },
      });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({
        method: 'PATCH',
        url: `/maps/${id}`,
        payload: { title: 'Renomeado' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ title: string }>().title).toBe('Renomeado');
    });

    it('rejeita título vazio — 400', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Original' },
      });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({
        method: 'PATCH',
        url: `/maps/${id}`,
        payload: { title: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/maps/nao-existe',
        payload: { title: 'Qualquer' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /maps/:id', () => {
    it('deleta mapa existente — 204', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/maps',
        payload: { title: 'Para deletar' },
      });
      const { id } = created.json<{ id: string }>();

      const res = await app.inject({ method: 'DELETE', url: `/maps/${id}` });
      expect(res.statusCode).toBe(204);
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/maps/nao-existe',
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
