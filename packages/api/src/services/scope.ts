import type { Map, Node, Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../errors.js';

type Db = PrismaClient | Prisma.TransactionClient;

export async function findOwnedMap(db: Db, mapId: string, userId: string): Promise<Map> {
  const map = await db.map.findFirst({ where: { id: mapId, ownerId: userId } });
  if (!map) throw new NotFoundError('Map not found');
  return map;
}

export async function findOwnedNode(db: Db, nodeId: string, userId: string): Promise<Node> {
  const node = await db.node.findFirst({ where: { id: nodeId, map: { ownerId: userId } } });
  if (!node) throw new NotFoundError('Node not found');
  return node;
}
