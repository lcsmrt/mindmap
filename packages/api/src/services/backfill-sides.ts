import { prisma } from '../prisma.js';
import { subtreeSizes, computeBalancedSides } from './sides.js';

/**
 * Popula o `side` dos filhos de 1º nível de um mapa existente replicando o split
 * balanceado por peso (o mesmo que o M8 já renderiza), para que mapas criados antes
 * da coluna `side` mantenham a aparência atual após o deploy.
 *
 * Idempotente: só grava onde `side IS NULL` em filhos da raiz — não sobrescreve
 * lados já definidos pelo usuário. Retorna quantos nós foram atualizados.
 */
export async function backfillSides(mapId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const nodes = await tx.node.findMany({
      where: { mapId },
      select: { id: true, parentId: true, sortOrder: true, side: true },
    });
    const root = nodes.find((n) => n.parentId === null);
    if (!root) return 0;

    const rootChildren = nodes.filter((n) => n.parentId === root.id);
    const sizes = subtreeSizes(nodes);
    const balanced = computeBalancedSides(rootChildren, sizes);

    let updated = 0;
    for (const child of rootChildren) {
      if (child.side !== null) continue; // respeita lados já definidos
      const side = balanced.get(child.id);
      if (!side) continue;
      await tx.node.update({ where: { id: child.id }, data: { side } });
      updated += 1;
    }
    return updated;
  });
}
