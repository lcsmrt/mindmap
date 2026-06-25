import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../prisma.js';
import { backfillSides } from './backfill-sides.js';

async function cleanAll() {
  await prisma.node.deleteMany();
  await prisma.map.deleteMany();
}

/** Cria um mapa legado (sem `side`) com a estrutura pedida, direto no banco. */
async function seedLegacyMap() {
  const map = await prisma.map.create({ data: { title: 'Legacy' } });
  const root = await prisma.node.create({
    data: { mapId: map.id, parentId: null, title: 'Root', sortOrder: 0, side: null },
  });
  // A é pesado (subárvore de 3); B e C pesam 1 cada.
  const a = await prisma.node.create({
    data: { mapId: map.id, parentId: root.id, title: 'A', sortOrder: 0, side: null },
  });
  await prisma.node.create({
    data: { mapId: map.id, parentId: a.id, title: 'A1', sortOrder: 0, side: null },
  });
  await prisma.node.create({
    data: { mapId: map.id, parentId: a.id, title: 'A2', sortOrder: 1, side: null },
  });
  const b = await prisma.node.create({
    data: { mapId: map.id, parentId: root.id, title: 'B', sortOrder: 1, side: null },
  });
  const c = await prisma.node.create({
    data: { mapId: map.id, parentId: root.id, title: 'C', sortOrder: 2, side: null },
  });
  return { mapId: map.id, a, b, c };
}

describe('backfillSides', () => {
  beforeEach(async () => {
    await cleanAll();
  });

  it('popula os lados dos filhos de 1º nível replicando o split por peso', async () => {
    const { mapId, a, b, c } = await seedLegacyMap();

    const updated = await backfillSides(mapId);
    expect(updated).toBe(3);

    const [aAfter, bAfter, cAfter] = await Promise.all([
      prisma.node.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.node.findUniqueOrThrow({ where: { id: b.id } }),
      prisma.node.findUniqueOrThrow({ where: { id: c.id } }),
    ]);
    // Greedy por peso desc: A(3)→RIGHT, B(1)→LEFT, C(1)→LEFT.
    expect(aAfter.side).toBe('RIGHT');
    expect(bAfter.side).toBe('LEFT');
    expect(cAfter.side).toBe('LEFT');
  });

  it('não dá lado a nós profundos nem à raiz', async () => {
    const { mapId } = await seedLegacyMap();
    await backfillSides(mapId);

    const deep = await prisma.node.findFirstOrThrow({ where: { mapId, title: 'A1' } });
    const root = await prisma.node.findFirstOrThrow({ where: { mapId, parentId: null } });
    expect(deep.side).toBeNull();
    expect(root.side).toBeNull();
  });

  it('é idempotente: a 2ª execução não altera nada', async () => {
    const { mapId, a, b, c } = await seedLegacyMap();

    await backfillSides(mapId);
    const before = await Promise.all(
      [a.id, b.id, c.id].map((id) =>
        prisma.node.findUniqueOrThrow({ where: { id } }).then((n) => n.side),
      ),
    );

    const updatedAgain = await backfillSides(mapId);
    expect(updatedAgain).toBe(0);

    const after = await Promise.all(
      [a.id, b.id, c.id].map((id) =>
        prisma.node.findUniqueOrThrow({ where: { id } }).then((n) => n.side),
      ),
    );
    expect(after).toEqual(before);
  });
});
