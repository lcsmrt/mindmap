import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { toMapDetail, toMapSummary } from '../mappers/maps.js';
import { toNodeDto } from '../mappers/nodes.js';
import { requireAuth, requireUser } from '../plugins/auth-guard.js';
import { findOwnedMap } from '../services/scope.js';

const IdParam = z.object({ id: z.string() });
const TitleBody = z.object({ title: z.string().trim().min(1) });

const mapsPlugin: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get('/', {
    handler: async (req) => {
      const { id: ownerId } = requireUser(req);

      const maps = await prisma.map.findMany({
        where: { ownerId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { nodes: true } },
        },
      });

      const criticalGroups = await prisma.node.groupBy({
        by: ['mapId'],
        where: { isCritical: true, map: { ownerId } },
        _count: { _all: true },
      });
      const criticalByMap = new Map(
        criticalGroups.map((group) => [group.mapId, group._count._all])
      );

      return {
        maps: maps.map((map) =>
          toMapSummary(map, criticalByMap.get(map.id) ?? 0)
        ),
      };
    },
  });

  app.get('/:id', {
    schema: { params: IdParam },
    handler: async (req) => {
      const { id: ownerId } = requireUser(req);
      const map = await findOwnedMap(prisma, req.params.id, ownerId);
      return toMapDetail(map);
    },
  });

  app.post('/', {
    schema: { body: TitleBody },
    handler: async (req, reply) => {
      const { id: ownerId } = requireUser(req);
      const map = await prisma.$transaction(async (tx) => {
        const created = await tx.map.create({
          data: { title: req.body.title, ownerId },
        });
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
      const { id: ownerId } = requireUser(req);
      await findOwnedMap(prisma, req.params.id, ownerId);

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
      const { id: ownerId } = requireUser(req);
      await findOwnedMap(prisma, req.params.id, ownerId);

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
      const { id: ownerId } = requireUser(req);
      await findOwnedMap(prisma, req.params.id, ownerId);

      await prisma.map.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  });
};

export default mapsPlugin;
