import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { NotFoundError } from '../errors.js';
import { toMapDetail, toMapSummary } from '../mappers/maps.js';
import { toNodeDto } from '../mappers/nodes.js';

const IdParam = z.object({ id: z.string() });
const TitleBody = z.object({ title: z.string().trim().min(1) });

const mapsPlugin: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    handler: async () => {
      const maps = await prisma.map.findMany({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, updatedAt: true },
      });
      return { maps: maps.map(toMapSummary) };
    },
  });

  app.get('/:id', {
    schema: { params: IdParam },
    handler: async (req) => {
      const map = await prisma.map.findUnique({ where: { id: req.params.id } });
      if (!map) throw new NotFoundError('Map not found');
      return toMapDetail(map);
    },
  });

  app.post('/', {
    schema: { body: TitleBody },
    handler: async (req, reply) => {
      const map = await prisma.$transaction(async (tx) => {
        const created = await tx.map.create({ data: { title: req.body.title } });
        await tx.node.create({
          data: {
            mapId: created.id,
            parentId: null,
            title: req.body.title,
            sortOrder: 0,
          },
        });
        return created;
      });
      return reply.status(201).send(toMapDetail(map));
    },
  });

  app.patch('/:id', {
    schema: { params: IdParam, body: TitleBody },
    handler: async (req) => {
      const existing = await prisma.map.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) throw new NotFoundError('Map not found');

      const map = await prisma.map.update({
        where: { id: req.params.id },
        data: { title: req.body.title },
      });
      return toMapDetail(map);
    },
  });

  app.get('/:id/nodes', {
    schema: { params: IdParam },
    handler: async (req) => {
      const map = await prisma.map.findUnique({ where: { id: req.params.id } });
      if (!map) throw new NotFoundError('Map not found');

      const nodes = await prisma.node.findMany({
        where: { mapId: req.params.id },
        orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
      });
      return { nodes: nodes.map(toNodeDto) };
    },
  });

  app.delete('/:id', {
    schema: { params: IdParam },
    handler: async (req, reply) => {
      const existing = await prisma.map.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) throw new NotFoundError('Map not found');

      await prisma.map.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  });
};

export default mapsPlugin;
