import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../prisma.js';
import { createUserWithSession } from '../test/helpers.js';

async function cleanAll() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

async function getRootNode(mapId: string) {
  const node = await prisma.node.findFirst({ where: { mapId, parentId: null } });
  if (!node) throw new Error('Root node not found');
  return node;
}

describe('Nodes API', () => {
  let app: FastifyInstance;
  let cookie: Record<string, string>;

  function authedInject(opts: InjectOptions) {
    return app.inject({ ...opts, cookies: cookie });
  }

  async function createMap(title = 'Test Map') {
    const res = await authedInject({ method: 'POST', url: '/maps', payload: { title } });
    return res.json<{ id: string }>();
  }

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(async () => {
    await cleanAll();
    ({ cookie } = await createUserWithSession());
  });

  describe('GET /maps/:id/nodes', () => {
    it('mapa novo retorna lista com 1 nó (root)', async () => {
      const { id } = await createMap();
      const res = await authedInject({ method: 'GET', url: `/maps/${id}/nodes` });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ nodes: unknown[] }>();
      expect(body.nodes).toHaveLength(1);
    });

    it('mapa inexistente retorna 404', async () => {
      const res = await authedInject({ method: 'GET', url: '/maps/nao-existe/nodes' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /nodes', () => {
    it('cria filho com sortOrder correto — 0, 1, 2 para três filhos', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      for (let i = 0; i < 3; i++) {
        const res = await authedInject({
          method: 'POST',
          url: '/nodes',
          payload: { mapId, parentId: root.id, title: `Filho ${i}` },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json<{ sortOrder: number }>().sortOrder).toBe(i);
      }
    });

    it('title vazio retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('parentId inexistente retorna 404', async () => {
      const { id: mapId } = await createMap();

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: 'nao-existe', title: 'Filho' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('parentId de outro mapa retorna 400', async () => {
      const { id: mapId1 } = await createMap('Mapa 1');
      const { id: mapId2 } = await createMap('Mapa 2');
      const root2 = await getRootNode(mapId2);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId: mapId1, parentId: root2.id, title: 'Filho' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /nodes — lado (side)', () => {
    async function addChild(mapId: string, parentId: string, title: string) {
      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId, title },
      });
      return res.json<{ id: string; side: 'LEFT' | 'RIGHT' | null }>();
    }

    it('primeiro filho de 1º nível cai à direita (empate → RIGHT)', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const first = await addChild(mapId, root.id, 'A');
      expect(first.side).toBe('RIGHT');
    });

    it('filhos de 1º nível alternam pelo lado mais leve', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await addChild(mapId, root.id, 'A'); // right=0,left=0 → RIGHT
      const b = await addChild(mapId, root.id, 'B'); // right=1,left=0 → LEFT
      const c = await addChild(mapId, root.id, 'C'); // right=1,left=1 → RIGHT
      expect([a.side, b.side, c.side]).toEqual(['RIGHT', 'LEFT', 'RIGHT']);
    });

    it('respeita o peso de subárvore ao escolher o lado mais leve', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await addChild(mapId, root.id, 'A'); // RIGHT
      // Engorda a subárvore de A (direita): 2 netos.
      await addChild(mapId, a.id, 'A1');
      await addChild(mapId, a.id, 'A2');
      // right=3, left=0 → novo filho de 1º nível cai à esquerda.
      const b = await addChild(mapId, root.id, 'B');
      expect(b.side).toBe('LEFT');
    });

    it('filho de nó profundo não tem lado (side null)', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await addChild(mapId, root.id, 'A');
      const deep = await addChild(mapId, a.id, 'A1');
      expect(deep.side).toBeNull();
    });
  });

  describe('PATCH /nodes/:id', () => {
    it('renomeia nó — 200 com título atualizado', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Original' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { title: 'Renomeado' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ title: string }>().title).toBe('Renomeado');
    });

    it('title vazio retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { title: '' },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('id inexistente retorna 404', async () => {
      const res = await authedInject({
        method: 'PATCH',
        url: '/nodes/nao-existe',
        payload: { title: 'Qualquer' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('PATCH com apenas bgColor retorna 200 com bgColor atualizado e título inalterado', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Original' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
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
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: '#fecaca' },
      });

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: null },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ bgColor: string | null }>().bgColor).toBeNull();
    });

    it('PATCH com apenas textColor retorna 200 com textColor atualizado', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { textColor: '#dc2626' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ textColor: string | null }>().textColor).toBe('#dc2626');
    });

    it('PATCH com body vazio retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: {},
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com bgColor inválido retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: 'invalid' },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com status retorna 200 com status atualizado e demais campos inalterados', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
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
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: 'DONE' },
      });

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: null },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ status: string | null }>().status).toBeNull();
    });

    it('PATCH com status inválido retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { status: 'INVALIDO' },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com assignee retorna 200 com assignee atualizado', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { assignee: 'Lucas' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ assignee: string | null }>().assignee).toBe('Lucas');
    });

    it('PATCH com assignee null retorna 200 com assignee null (reset)', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { assignee: 'Lucas' },
      });

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { assignee: null },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ assignee: string | null }>().assignee).toBeNull();
    });

    it('PATCH com isCritical true retorna 200 e preserva title/cores', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Tarefa' },
      });
      const { id } = res.json<{ id: string }>();

      await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { bgColor: '#fecaca', textColor: '#dc2626' },
      });

      const patch = await authedInject({
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

    it('PATCH com width: 240 retorna 200 e persiste via read-back', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Redimensionável' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { width: 240 },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ width: number | null }>().width).toBe(240);

      const nodesRes = await authedInject({ method: 'GET', url: `/maps/${mapId}/nodes` });
      const nodes = nodesRes.json<{ nodes: { id: string; width: number | null }[] }>().nodes;
      const found = nodes.find((n) => n.id === id);
      expect(found?.width).toBe(240);
    });

    it('PATCH com width: 1000 (no limite) retorna 200', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { width: 1000 },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ width: number | null }>().width).toBe(1000);
    });

    it('PATCH com width: 0 retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { width: 0 },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com width: -10 retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { width: -10 },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com width: 1500 (acima do max) retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { width: 1500 },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('PATCH com width: 1.5 (não-inteiro) retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Teste' },
      });
      const { id } = res.json<{ id: string }>();

      const patch = await authedInject({
        method: 'PATCH',
        url: `/nodes/${id}`,
        payload: { width: 1.5 },
      });
      expect(patch.statusCode).toBe(400);
    });

    it('nó recém-criado nasce com width: null (POST não seta width)', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Novo' },
      });
      const { id } = res.json<{ id: string }>();

      const nodesRes = await authedInject({ method: 'GET', url: `/maps/${mapId}/nodes` });
      const nodes = nodesRes.json<{ nodes: { id: string; width: number | null }[] }>().nodes;
      expect(nodes.find((n) => n.id === id)?.width).toBeNull();
    });
  });

  describe('DELETE /nodes/:id', () => {
    it('deleta nó intermediário e subárvore — 204', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const filho = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Filho' },
      });
      const { id: filhoId } = filho.json<{ id: string }>();

      await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: filhoId, title: 'Neto' },
      });

      const del = await authedInject({ method: 'DELETE', url: `/nodes/${filhoId}` });
      expect(del.statusCode).toBe(204);

      const nodesRes = await authedInject({ method: 'GET', url: `/maps/${mapId}/nodes` });
      expect(nodesRes.json<{ nodes: unknown[] }>().nodes).toHaveLength(1);
    });

    it('deletar root retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const res = await authedInject({ method: 'DELETE', url: `/nodes/${root.id}` });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toBe('Cannot delete root');
    });

    it('id inexistente retorna 404', async () => {
      const res = await authedInject({ method: 'DELETE', url: '/nodes/nao-existe' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /nodes/:id/move', () => {
    it('move nó para novo pai — sortOrders renumerados', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>());
      const c = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: a.id, title: 'C' } })
        .then((r) => r.json<{ id: string }>());

      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${c.id}/move`,
        payload: { parentId: b.id, index: 0 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ parentId: string }>().parentId).toBe(b.id);
    });

    it('index fora do range clampa para o final', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>());

      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: b.id, index: 9999 },
      });
      expect(res.statusCode).toBe(200);
    });

    it('mover para si mesmo retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());

      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: a.id, index: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('mover para descendente retorna 400', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: a.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>());

      const res = await authedInject({
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
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());

      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${root.id}/move`,
        payload: { parentId: a.id, index: 0 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toBe('Cannot move root');
    });

    it('mover para a raiz grava o lado informado', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string; side: string }>());
      expect(a.side).toBe('RIGHT');

      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: root.id, index: 0, side: 'LEFT' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ side: string }>().side).toBe('LEFT');
    });

    it('mover para a raiz sem side assume RIGHT (salvaguarda)', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());

      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: root.id, index: 0 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ side: string }>().side).toBe('RIGHT');
    });

    it('mover para pai profundo limpa o lado (null)', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string }>());
      const b = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'B' } })
        .then((r) => r.json<{ id: string; side: string }>());
      expect(b.side).toBe('LEFT');

      // B (1º nível, com lado) vira filho de A (profundo) → perde o lado.
      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${b.id}/move`,
        payload: { parentId: a.id, index: 0 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ side: string | null }>().side).toBeNull();
    });

    it('reorder sob o mesmo pai renumera sortOrder e preserva o lado', async () => {
      const { id: mapId } = await createMap();
      const root = await getRootNode(mapId);

      const a = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'A' } })
        .then((r) => r.json<{ id: string; side: string }>()); // RIGHT
      const b = await authedInject({ method: 'POST', url: '/nodes', payload: { mapId, parentId: root.id, title: 'B' } })
        .then((r) => r.json<{ id: string }>()); // LEFT

      // Move A para depois de B sob a raiz, mantendo o lado RIGHT.
      const res = await authedInject({
        method: 'PATCH',
        url: `/nodes/${a.id}/move`,
        payload: { parentId: root.id, index: 1, side: a.side },
      });
      expect(res.statusCode).toBe(200);
      const moved = res.json<{ sortOrder: number; side: string }>();
      expect(moved.sortOrder).toBe(1);
      expect(moved.side).toBe('RIGHT');

      // b foi renumerado para 0.
      const bAfter = await prisma.node.findUniqueOrThrow({ where: { id: b.id } });
      expect(bAfter.sortOrder).toBe(0);
    });
  });

  describe('guarda de sessão', () => {
    it('sem cookie — 401 em POST /nodes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId: 'x', parentId: 'y', title: 'Z' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('sem cookie — 401 em PATCH /nodes/:id', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/nodes/x',
        payload: { title: 'Z' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('isolamento por dono (A ↔ B)', () => {
    it('B não consegue ler/editar/mover/deletar nós de A → 404, sem efeito', async () => {
      const { id: mapId } = await createMap('Mapa de A');
      const root = await getRootNode(mapId);
      const nodeA = await authedInject({
        method: 'POST',
        url: '/nodes',
        payload: { mapId, parentId: root.id, title: 'Nó de A' },
      }).then((r) => r.json<{ id: string }>());

      const { cookie: cookieB } = await createUserWithSession({ email: 'b@example.com', name: 'Bob' });
      const injectB = (opts: InjectOptions) => app.inject({ ...opts, cookies: cookieB });

      const patchB = await injectB({
        method: 'PATCH',
        url: `/nodes/${nodeA.id}`,
        payload: { title: 'Invadido' },
      });
      expect(patchB.statusCode).toBe(404);

      const delB = await injectB({ method: 'DELETE', url: `/nodes/${nodeA.id}` });
      expect(delB.statusCode).toBe(404);

      const bMap = await createMapFor(cookieB, 'Mapa de B');
      const bRoot = await getRootNode(bMap);
      const moveB = await injectB({
        method: 'PATCH',
        url: `/nodes/${nodeA.id}/move`,
        payload: { parentId: bRoot.id, index: 0 },
      });
      expect(moveB.statusCode).toBe(404);

      const stored = await prisma.node.findUniqueOrThrow({ where: { id: nodeA.id } });
      expect(stored.title).toBe('Nó de A');
      expect(stored.parentId).toBe(root.id);
    });

    it('move de B com parentId de mapa de A → 404 (parent de outro dono)', async () => {
      const { id: mapA } = await createMap('Mapa de A');
      const rootA = await getRootNode(mapA);

      const { cookie: cookieB } = await createUserWithSession({ email: 'b@example.com', name: 'Bob' });
      const injectB = (opts: InjectOptions) => app.inject({ ...opts, cookies: cookieB });
      const mapB = await createMapFor(cookieB, 'Mapa de B');
      const rootB = await getRootNode(mapB);
      const childB = await injectB({
        method: 'POST',
        url: '/nodes',
        payload: { mapId: mapB, parentId: rootB, title: 'Filho de B' },
      }).then((r) => r.json<{ id: string }>());

      const res = await injectB({
        method: 'PATCH',
        url: `/nodes/${childB.id}/move`,
        payload: { parentId: rootA.id, index: 0 },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  async function createMapFor(c: Record<string, string>, title: string) {
    const res = await app.inject({ method: 'POST', url: '/maps', payload: { title }, cookies: c });
    return res.json<{ id: string }>().id;
  }
});
