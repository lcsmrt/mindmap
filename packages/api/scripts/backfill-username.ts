/**
 * Script one-off: destrava a migration `add_user_username` (M23) em bancos que já
 * têm usuários — a migration original assume tabela vazia (`ADD COLUMN ... NOT NULL`
 * sem default) e falha em produção. Gera um username único por local-part de e-mail
 * pra cada usuário sem username, depois promove a coluna pra NOT NULL + índice único.
 * Idempotente e transacional (tudo ou nada); nunca deleta ou sobrescreve dado existente.
 *
 * Uso (a partir de packages/api, com DATABASE_URL do .env apontando pro DB alvo):
 *   pnpm exec tsx scripts/backfill-username.ts --dry-run   # só mostra o preview, não escreve nada
 *   pnpm exec tsx scripts/backfill-username.ts             # aplica de verdade
 *
 * Depois de rodar sem --dry-run com sucesso, resolver a migration pro Prisma parar
 * de tentar reaplicá-la no boot (prisma migrate deploy):
 *   pnpm exec prisma migrate resolve --applied 20260705225341_add_user_username
 */
import 'dotenv/config';
import { prisma } from '../src/prisma.js';
import { backfillUsernames, previewUsernames } from '../src/services/backfill-username.js';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    const preview = previewUsernames(users);
    console.log(`Preview (${preview.length} usuário(s), nada foi escrito no banco):`);
    for (const p of preview) console.log(`  ${p.email} -> ${p.username}`);
    return;
  }

  const { added, alreadyApplied } = await backfillUsernames();
  if (alreadyApplied) {
    console.log('Nenhum usuário sem username — coluna já estava preenchida/finalizada.');
  } else {
    console.log(`${added} username(s) gerado(s) e gravado(s).`);
  }
  console.log(
    'Próximo passo: pnpm exec prisma migrate resolve --applied 20260705225341_add_user_username',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
