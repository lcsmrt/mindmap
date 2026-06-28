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
  web/      # React + Vite + visx (zoom/shape) + d3-flextree + TanStack Query + Tailwind v4 + Base UI
  shared/   # Tipos compartilhados (DTOs, schemas Zod)
```

O canvas é renderizado com visx (`@visx/zoom` para pan/zoom, `@visx/shape` para as
arestas em SVG) e `d3-flextree` para o layout de árvore de altura variável; os nós são
componentes HTML posicionados sobre o SVG (arquitetura híbrida). A versão exibida no
badge do app vem de `packages/web/package.json` (injetada em build via `vite.config.ts`).

## Deploy

Servido na VPS via stack Docker de dois serviços — `mindmap-api` (Fastify) e
`mindmap-web` (nginx servindo a SPA buildada + proxy de `/api`). O deploy é contínuo:
push no `master` dispara a GitHub Action `deploy.yml`, que aciona um webhook do
Portainer para rebuildar/redeployar a stack. Detalhes em `.specs/project/STATE.md`
(AD-022); arquivos: `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`,
`nginx.conf`, `.github/workflows/deploy.yml`.
