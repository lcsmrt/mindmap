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
| `pnpm lint` | ESLint em todos os pacotes |

## Testes

Os testes **não** rodam automaticamente durante o desenvolvimento — execute-os
manualmente quando necessário. Um CI para barrar regressões antes do merge fica
para depois.

### Unitários (Vitest)

```bash
# Todos os pacotes
pnpm test

# Um pacote específico
pnpm --filter @mindmap/web test
pnpm --filter @mindmap/api test
pnpm --filter @mindmap/shared test
```

> ⚠️ **A suíte da `api` é destrutiva.** Ela carrega `packages/api/.env.test`, que
> aponta para o banco `dev_mindmap` local (via túnel SSH), e limpa os dados nos
> testes. Não rode com um túnel apontando para produção nem com dados que você
> queira preservar em `dev_mindmap`.

### E2E (Playwright)

```bash
pnpm --filter @mindmap/web test:e2e
```

Sobe api (:3000) e web (:5173) automaticamente (reusa instâncias já rodando).
Requer o túnel SSH aberto e o Playwright instalado (`pnpm --filter @mindmap/web exec playwright install`).

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
push no `master` dispara a GitHub Action `deploy.yml`, que chama a API do Portainer
(`PUT /stacks/{id}/git/redeploy`, mesmo caminho do botão "Pull and redeploy") para
**re-pullar o repo e rebuildar** as imagens. O webhook simples de stack era
insuficiente: recriava os containers reusando a imagem já buildada (código velho),
pois o compose builda localmente (`build:` + `image:`, sem registry). Secret
necessário: `PORTAINER_API_KEY` (Access Token do Portainer). Detalhes em
`.specs/project/STATE.md` (AD-022); arquivos: `Dockerfile.api`, `Dockerfile.web`,
`docker-compose.yml`, `nginx.conf`, `.github/workflows/deploy.yml`.
