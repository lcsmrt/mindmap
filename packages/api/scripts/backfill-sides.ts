/**
 * Script one-off: popula `side` dos filhos de 1º nível de TODOS os mapas existentes,
 * replicando o split por peso do M8. Idempotente (só grava onde side IS NULL).
 *
 * Uso (a partir de packages/api, com o DATABASE_URL do .env apontando para o DB alvo):
 *   pnpm exec tsx scripts/backfill-sides.ts
 */
import 'dotenv/config';
import { prisma } from '../src/prisma.js';
import { backfillSides } from '../src/services/backfill-sides.js';

async function main(): Promise<void> {
  const maps = await prisma.map.findMany({ select: { id: true, title: true } });
  let total = 0;
  for (const map of maps) {
    const updated = await backfillSides(map.id);
    total += updated;
    console.log(`mapa ${map.id} (${map.title}): ${updated} lado(s) gravado(s)`);
  }
  console.log(`Total: ${total} nó(s) atualizado(s) em ${maps.length} mapa(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
