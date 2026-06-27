import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Side } from '@prisma/client';
import { prisma } from '../prisma.js';
import { NotFoundError, ApiError } from '../errors.js';
import { toNodeDto } from '../mappers/nodes.js';
import { subtreeSizes, chooseSideForNewChild } from '../services/sides.js';

const IdParam = z.object({ id: z.string() });

const nodesPlugin: FastifyPluginAsyncZod = async (app) => {
  app.post('/', {
    schema: {
      body: z.object({
        mapId: z.string(),
        parentId: z.string(),
        title: z.string().trim().min(1),
      }),
    },
    handler: async (req, reply) => {
      const { mapId, parentId, title } = req.body;

      const created = await prisma.$transaction(async (tx) => {
        const parent = await tx.node.findUnique({ where: { id: parentId } });
        if (!parent) throw new NotFoundError('Parent not found');
        if (parent.mapId !== mapId) {
          throw new ApiError(400, 'Parent and node must belong to the same map');
        }

        const agg = await tx.node.aggregate({
          _max: { sortOrder: true },
          where: { parentId },
        });
        const nextOrder = (agg._max.sortOrder ?? -1) + 1;

        // Filho de 1º nível (pai = raiz) ganha lado default pela heurística de
        // balance (lado mais leve, empate → RIGHT); profundos ficam sem lado.
        let side: Side | null = null;
        if (parent.parentId === null) {
          const mapNodes = await tx.node.findMany({
            where: { mapId },
            select: { id: true, parentId: true, side: true },
          });
          const sizes = subtreeSizes(mapNodes);
          const rootChildren = mapNodes.filter((n) => n.parentId === parent.id);
          side = chooseSideForNewChild(rootChildren, sizes);
        }

        return tx.node.create({
          data: { mapId, parentId, title, sortOrder: nextOrder, side },
        });
      });

      return reply.status(201).send(toNodeDto(created));
    },
  });

  app.patch('/:id', {
    schema: {
      params: IdParam,
      body: z.object({
        title: z.string().trim().min(1).optional(),
        bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
        textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']).nullable().optional(),
        assignee: z.string().trim().min(1).nullable().optional(),
        isCritical: z.boolean().optional(),
        width: z.number().int().positive().max(1000).optional(),
      }).refine(
        (d) => Object.values(d).some((v) => v !== undefined),
        { message: 'At least one field must be provided' },
      ),
    },
    handler: async (req) => {
      const existing = await prisma.node.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Node not found');

      const { title, bgColor, textColor, status, assignee, isCritical, width } = req.body;
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (bgColor !== undefined) data.bgColor = bgColor;
      if (textColor !== undefined) data.textColor = textColor;
      if (status !== undefined) data.status = status;
      if (assignee !== undefined) data.assignee = assignee;
      if (isCritical !== undefined) data.isCritical = isCritical;
      if (width !== undefined) data.width = width;

      const updated = await prisma.node.update({
        where: { id: req.params.id },
        data,
      });
      return toNodeDto(updated);
    },
  });

  app.delete('/:id', {
    schema: { params: IdParam },
    handler: async (req, reply) => {
      const existing = await prisma.node.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Node not found');
      if (existing.parentId === null) throw new ApiError(400, 'Cannot delete root');

      await prisma.node.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  });

  app.patch('/:id/move', {
    schema: {
      params: IdParam,
      body: z.object({
        parentId: z.string(),
        index: z.number().int(),
        side: z.enum(['LEFT', 'RIGHT']).optional(),
      }),
    },
    handler: async (req) => {
      const { id } = req.params;
      const { parentId: newParentId, index, side } = req.body;

      const updated = await prisma.$transaction(async (tx) => {
        const node = await tx.node.findUnique({ where: { id } });
        if (!node) throw new NotFoundError('Node not found');
        if (node.parentId === null) throw new ApiError(400, 'Cannot move root');

        const newParent = await tx.node.findUnique({ where: { id: newParentId } });
        if (!newParent) throw new NotFoundError('Parent not found');
        if (newParent.mapId !== node.mapId) {
          throw new ApiError(400, 'Parent and node must belong to the same map');
        }

        const descendants = await tx.$queryRaw<{ id: string }[]>`
          WITH RECURSIVE descendants AS (
            SELECT id FROM "Node" WHERE id = ${id}
            UNION ALL
            SELECT n.id FROM "Node" n
            JOIN descendants d ON n.parent_id = d.id
          )
          SELECT 1 as id FROM descendants WHERE id = ${newParentId} LIMIT 1
        `;
        if (descendants.length > 0) {
          throw new ApiError(400, 'Cannot move node into itself or its descendant');
        }

        const oldParentId = node.parentId;

        if (oldParentId !== newParentId) {
          const oldSiblings = await tx.node.findMany({
            where: { parentId: oldParentId, NOT: { id } },
            orderBy: { sortOrder: 'asc' },
          });
          await Promise.all(
            oldSiblings.map((s, i) =>
              tx.node.update({ where: { id: s.id }, data: { sortOrder: i } })
            )
          );
        }

        // Lado: gravado só quando o destino é a raiz (filho de 1º nível); ao virar
        // profundo, é limpo (null). Default RIGHT se ausente (salvaguarda).
        const newSide: Side | null = newParent.parentId === null ? (side ?? 'RIGHT') : null;

        const newSiblings = await tx.node.findMany({
          where: { parentId: newParentId, NOT: { id } },
          orderBy: { sortOrder: 'asc' },
        });
        const clampedIndex = Math.max(0, Math.min(index, newSiblings.length));
        const ordered = [
          ...newSiblings.slice(0, clampedIndex),
          { id },
          ...newSiblings.slice(clampedIndex),
        ];
        await Promise.all(
          ordered.map((n, i) =>
            tx.node.update({
              where: { id: n.id },
              data: {
                sortOrder: i,
                ...(n.id === id ? { parentId: newParentId, side: newSide } : {}),
              },
            })
          )
        );

        return tx.node.findUniqueOrThrow({ where: { id } });
      });

      return toNodeDto(updated);
    },
  });
};

export default nodesPlugin;
