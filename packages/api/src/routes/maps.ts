import type { FastifyPluginAsync } from 'fastify';
import type {
  MapListResponse,
  MapDetail,
  CreateMapBody,
  UpdateMapBody,
} from '@mindmap/shared';
import { prisma } from '../prisma.js';

const mapsPlugin: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const maps = await prisma.map.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    });

    const body: MapListResponse = {
      maps: maps.map((m) => ({
        id: m.id,
        title: m.title,
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
    return reply.status(200).send(body);
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const map = await prisma.map.findUnique({ where: { id: req.params.id } });
    if (!map) {
      return reply.status(404).send({ error: 'Map not found' });
    }
    const body: MapDetail = {
      id: map.id,
      title: map.title,
      createdAt: map.createdAt.toISOString(),
      updatedAt: map.updatedAt.toISOString(),
    };
    return reply.status(200).send(body);
  });

  app.post<{ Body: CreateMapBody }>('/', async (req, reply) => {
    const title = req.body?.title?.trim();
    if (!title) {
      return reply.status(400).send({ error: 'Title is required' });
    }

    const map = await prisma.$transaction(async (tx) => {
      const created = await tx.map.create({ data: { title } });
      await tx.node.create({
        data: {
          mapId: created.id,
          parentId: null,
          title: 'Central',
          sortOrder: 0,
        },
      });
      return created;
    });

    const body: MapDetail = {
      id: map.id,
      title: map.title,
      createdAt: map.createdAt.toISOString(),
      updatedAt: map.updatedAt.toISOString(),
    };
    return reply.status(201).send(body);
  });

  app.patch<{ Params: { id: string }; Body: UpdateMapBody }>(
    '/:id',
    async (req, reply) => {
      const title = req.body?.title?.trim();
      if (!title) {
        return reply.status(400).send({ error: 'Title is required' });
      }

      const existing = await prisma.map.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Map not found' });
      }

      const map = await prisma.map.update({
        where: { id: req.params.id },
        data: { title },
      });

      const body: MapDetail = {
        id: map.id,
        title: map.title,
        createdAt: map.createdAt.toISOString(),
        updatedAt: map.updatedAt.toISOString(),
      };
      return reply.status(200).send(body);
    }
  );

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = await prisma.map.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Map not found' });
    }

    await prisma.map.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
};

export default mapsPlugin;
