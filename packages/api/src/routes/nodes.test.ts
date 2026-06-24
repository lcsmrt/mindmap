import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';

async function cleanAll() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
}

async function createMap(app: FastifyInstance, title = 'Test Map') {
  const res = await app.inject({
    method: 'POST',
    url: '/maps',
    payload: { title },
  });
  return res.json<{ id: string }>();
}

async function getRootNode(mapId: string) {
  const node = await prisma.node.findFirst({ where: { mapId, parentId: null } });
  if (!node) throw new Error('Root node not found');
  return node;
}

describe('Nodes API', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await cleanAll();
  });

  describe('GET /maps/:id/nodes', () => {
    it('mapa novo retorna lista com 1 nó (root)', async () => {
      const { id } = await createMap(app);
      const res = await app.inject({ method: 'GET', url: `/maps/${id}/nodes` });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ nodes: unknown[] }>();
      expect(body.nodes).toHaveLength(1);
    });

    it('mapa inexistente retorna 404', async () => {
      const res = await app.inject({ method: 'GET', url: '/maps/nao-existe/nodes' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /nodes', () => {
    it('cria filho com sortOrder correto — 0, 1, 2 para três filhos', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      for (let i = 0; i < 3; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/nodes',
          payload: { mapId, parentId: root.id, title: `Filho ${i}` },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json<{ sortOrder: number }>().sortOrder).toBe(i);
      }
    });

    it('title vazio retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('parentId inexistente retorna 404', async () => {
      const { id: mapId } = await createMap(app);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: 'nao-existe', title: 'Filho' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('parentId de outro mapa retorna 400', async () => {
      const { id: mapId1 } = await createMap(app, 'Mapa 1');
      const { id: mapId2 } = await createMap(app, 'Mapa 2');
      const root2 = await getRootNode(mapId2);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId: mapId1, parentId: root2.id, title: 'Filho' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /nodes/:id', () => {
    it('renomeia nó — 200 com título atualizado', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Original' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { title: 'Renomeado' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ title: string }>().title).toBe('Renomeado');
    });

    it('title vazio retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { title: '' },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('id inexistente retorna 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/nodes/nao-existe',
        payload: { title: 'Qualquer' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('PATCH com apenas bgColor retorna 200 com bgColor atualizado e título inalterado', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Original' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: '#fecaca' },
      });
      expect(patch.statusCode).toBe(200);
      const body = patch.json<{ title: string; bgColor: string | null }>();
      expect(body.bgColor).toBe('#fecaca');
      expect(body.title).toBe('Original');
    });

    it('PATCH com bgColor null retorna 200 com bgColor null (reset)', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: '#fecaca' },
      });

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: null },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ bgColor: string | null }>().bgColor).toBeNull();
    });

    it('PATCH com apenas textColor retorna 200 com textColor atualizado', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { textColor: '#dc2626' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ textColor: string | null }>().textColor).toBe('#dc2626');
    });

    it('PATCH com body vazio retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: {},
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com bgColor inválido retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: 'invalid' },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com status retorna 200 com status atualizado e demais campos inalterados', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: 'IN_PROGRESS' },
      });
      expect(patch.statusCode).toBe(200);
      const body = patch.json<{ status: string | null; title: string }>();
      expect(body.status).toBe('IN_PROGRESS');
      expect(body.title).toBe('Tarefa');
    });

    it('PATCH com status null retorna 200 com status null (reset)', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: 'DONE' },
      });

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: null },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ status: string | null }>().status).toBeNull();
    });

    it('PATCH com status inválido retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: 'INVALIDO' },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com assignee retorna 200 com assignee atualizado', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { assignee: 'Lucas' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ assignee: string | null }>().assignee).toBe('Lucas');
    });

    it('PATCH com assignee null retorna 200 com assignee null (reset)', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { assignee: 'Lucas' },
      });

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { assignee: null },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ assignee: string | null }>().assignee).toBeNull();
    });

    it('PATCH com isCritical true retorna 200 e preserva title/cores', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: '#fecaca', textColor: '#dc2626' },
      });

      const patch = await app.inject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { isCritical: true },
      });
      expect(patch.statusCode).toBe(200);
      const body = patch.json<{
        isCritical: boolean;
        title: string;
        bgColor: string | null;
        textColor: string | null;
      }>();
      expect(body.isCritical).toBe(true);
      expect(body.title).toBe('Tarefa');
      expect(body.bgColor).toBe('#fecaca');
      expect(body.textColor).toBe('#dc2626');
    });
  });

  describe('DELETE /nodes/:id', () => {
    it('deleta nó intermediário e subárvore — 204', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const filho = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Filho' },
      });
      const { id: filhoId } = filho.json<{ id: string }>();

      await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: filhoId, title: 'Neto' },
      });

      const del = await app.inject({ method: 'DELETE', url: `/nodes/${filhoId}` });
      expect(del.statusCode).toBe(204);

      const nodesRes = await app.inject({ method: 'GET', url: `/maps/${mapId}/nodes` });
      expect(nodesRes.json<{ nodes: unknown[] }>().nodes).toHaveLength(1);
    });

    it('deletar root retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const res = await app.inject({ method: 'DELETE', url: `/nodes/${root.id}` });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toBe('Cannot delete root');
    });

    it('id inexistente retorna 404', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/nodes/nao-existe' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /nodes/:id/move', () => {
    it('move nó para novo pai — sortOrders renumerados', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const a = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>());
      const c = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: a.id, title: 'C' } })
        .then((r) => r.json<{ id: string }>());

      const res = await app.inject({
        method: 'PATCH',
        url: `/nodes/${c.id}/move`,
        payload: { parentId: b.id, index: 0 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ parentId: string }>().parentId).toBe(b.id);
    });

    it('index fora do range clampa para o final', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const a = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>());

      const res = await app.inject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: b.id, index: 9999 },
      });
      expect(res.statusCode).toBe(200);
    });

    it('mover para si mesmo retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const a = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());

      const res = await app.inject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: a.id, index: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('mover para descendente retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const a = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: a.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>());

      const res = await app.inject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: b.id, index: 0 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toBe(
        'Cannot move node into itself or its descendant'
      );
    });

    it('mover root retorna 400', async () => {
      const { id: mapId } = await createMap(app);
      const root = await getRootNode(mapId);

      const a = await app
        .inject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());

      const res = await app.inject({
        method: 'PATCH',
        url: `/nodes/${root.id}/move`,
        payload: { parentId: a.id, index: 0 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toBe('Cannot move root');
    });
  });
});
