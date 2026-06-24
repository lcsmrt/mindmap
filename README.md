# Mindmap

Ferramenta web pessoal de mindmaps. Consulte [.specs/project/PROJECT.md](.specs/project/PROJECT.md) para visão, stack e escopo.

## Pré-requisitos

- Node.js v24+
- pnpm v11+
- PostgreSQL (hospedado em VPS, acessível via túnel SSH)
- Playwright (apenas para e2e)

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Abrir túnel SSH para o Postgres da VPS (manter aberto em outro terminal)
ssh -L 5432:localhost:5432 root@<VPS_HOST> -N

# 3. Configurar variáveis de ambiente
cp packages/api/.env.example packages/api/.env
# Editar packages/api/.env com as credenciais reais

# 4. Gerar o Prisma Client e aplicar migrations
pnpm --filter @mindmap/api exec prisma generate
pnpm --filter @mindmap/api exec prisma migrate deploy
```

## Desenvolvimento

```bash
# Inicia web (Vite, :5173) e api (Fastify, :3000) em paralelo
pnpm dev
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia frontend e backend em paralelo |
| `pnpm build` | Build de produção de todos os pacotes |
| `pnpm typecheck` | Type-check em todos os pacotes |
| `pnpm test` | Testes unitários (Vitest) |
| `pnpm lint` | ESLint em todos os pacotes |
| `pnpm --filter @mindmap/web test:e2e` | Testes e2e (Playwright — sobe api e web automaticamente) |

## Estrutura

```
packages/
  api/      # Fastify + Prisma
  web/      # React + Vite + React Flow + TanStack Query + Tailwind v4
  shared/   # Tipos compartilhados (DTOs, schemas Zod)
```
