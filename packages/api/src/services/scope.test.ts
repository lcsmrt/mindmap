import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma.js';
import { NotFoundError } from '../errors.js';
import { findOwnedMap, findOwnedNode } from './scope.js';

async function createUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: 'x', name: email } });
}

async function createMapWithRoot(ownerId: string, title = 'M') {
  const map = await prisma.map.create({ data: { title, ownerId } });
  const root = await prisma.node.create({
    data: { mapId: map.id, parentId: null, title, sortOrder: 0 },
  });
  return { map, root };
}

describe('scope service', () => {
  beforeEach(async () => {
    await prisma.node.deleteMany();
    await prisma.map.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it('findOwnedMap: dono acessa o próprio mapa', async () => {
    const a = await createUser('a@x.com');
    const { map } = await createMapWithRoot(a.id);

    const found = await findOwnedMap(prisma, map.id, a.id);
    expect(found.id).toBe(map.id);
  });

  it('findOwnedMap: outro dono → NotFound', async () => {
    const a = await createUser('a@x.com');
    const b = await createUser('b@x.com');
    const { map } = await createMapWithRoot(a.id);

    await expect(findOwnedMap(prisma, map.id, b.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('findOwnedMap: mapa inexistente → NotFound', async () => {
    const a = await createUser('a@x.com');
    await expect(findOwnedMap(prisma, 'nao-existe', a.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('findOwnedNode: dono acessa nó via relação do mapa', async () => {
    const a = await createUser('a@x.com');
    const { root } = await createMapWithRoot(a.id);

    const found = await findOwnedNode(prisma, root.id, a.id);
    expect(found.id).toBe(root.id);
  });

  it('findOwnedNode: nó de mapa de outro dono → NotFound', async () => {
    const a = await createUser('a@x.com');
    const b = await createUser('b@x.com');
    const { root } = await createMapWithRoot(a.id);

    await expect(findOwnedNode(prisma, root.id, b.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
