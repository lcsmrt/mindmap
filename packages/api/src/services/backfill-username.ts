import { prisma } from '../prisma.js';

/** Espelha o charset/limite de `UsernameField` em `routes/auth.ts` (duplicado por
 * design — mesma decisão da AD-031: dedup de validação vira Deferred Idea). */
const USERNAME_MAX_LENGTH = 39;

/** Normaliza um texto livre (local-part de e-mail ou nome) pro charset de username:
 * minúsculo, sem acento, `[a-z0-9]` com `-` como separador, sem `-` nas pontas. */
export function sanitizeUsername(raw: string): string {
  const ascii = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = slug.slice(0, USERNAME_MAX_LENGTH).replace(/-+$/g, '');
  return truncated || 'user';
}

/** Resolve colisão anexando `-2`, `-3`… até achar um candidato livre, truncando a
 * base se o sufixo estourar o limite de tamanho. */
export function uniqueUsername(base: string, isTaken: (candidate: string) => boolean): string {
  if (!isTaken(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
}

/** Gera usernames determinísticos e sem colisão pra uma lista ordenada de usuários,
 * a partir do local-part do e-mail. Pura — não toca o banco; usada tanto pelo preview
 * (`--dry-run`) quanto pelo backfill real. */
export function previewUsernames(
  users: Array<{ id: string; email: string }>,
): Array<{ id: string; email: string; username: string }> {
  const taken = new Set<string>();
  return users.map((user) => {
    const base = sanitizeUsername(user.email.split('@')[0] ?? user.email);
    const username = uniqueUsername(base, (c) => taken.has(c));
    taken.add(username);
    return { id: user.id, email: user.email, username };
  });
}

/**
 * Backfill idempotente e transacional do `User.username` em produção, pra destravar
 * a migration `add_user_username` (M23) que falha em tabelas não-vazias (ADD COLUMN
 * NOT NULL sem default). Passos, sempre condicionais (seguro re-rodar):
 *   1. adiciona a coluna `username` (nullable) se ainda não existir;
 *   2. gera um username único por local-part de e-mail pra cada linha com username NULL;
 *   3. se não sobrar nenhum NULL, promove a coluna pra NOT NULL + cria o índice único
 *      (mesmo estado final da migration original — só não gravado como "aplicada" no
 *      `_prisma_migrations`; isso é resolvido à parte via `prisma migrate resolve`).
 * Nunca deleta ou sobrescreve dado existente — só preenche o que está NULL.
 */
export async function backfillUsernames(): Promise<{ added: number; alreadyApplied: boolean }> {
  return prisma.$transaction(async (tx) => {
    const columns = await tx.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'username'
    `;
    if (columns.length === 0) {
      await tx.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "username" TEXT`);
    }

    const pending = await tx.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email FROM "User" WHERE username IS NULL ORDER BY "created_at" ASC
    `;
    const taken = new Set(
      (
        await tx.$queryRaw<Array<{ username: string }>>`
          SELECT username FROM "User" WHERE username IS NOT NULL
        `
      ).map((r) => r.username),
    );

    let added = 0;
    for (const user of pending) {
      const base = sanitizeUsername(user.email.split('@')[0] ?? user.email);
      const username = uniqueUsername(base, (c) => taken.has(c));
      taken.add(username);
      await tx.$executeRaw`UPDATE "User" SET username = ${username} WHERE id = ${user.id}`;
      added += 1;
    }

    const stillNull = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "User" WHERE username IS NULL
    `;
    const alreadyApplied = pending.length === 0;
    if (stillNull[0]!.count === 0n) {
      await tx.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL`);
      const index = await tx.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes WHERE tablename = 'User' AND indexname = 'User_username_key'
      `;
      if (index.length === 0) {
        await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX "User_username_key" ON "User"("username")`);
      }
    }

    return { added, alreadyApplied };
  });
}
