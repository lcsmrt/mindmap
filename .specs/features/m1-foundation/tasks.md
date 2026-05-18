# M1 — Fundação: Tasks

**Spec:** [`spec.md`](./spec.md)
**Status:** Draft

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro:

- `.specs/project/PROJECT.md` — stack, escopo de v1, constraints
- `.specs/project/STATE.md` — decisões arquiteturais (AD-001 a AD-007)
- `.specs/features/m1-foundation/spec.md` — requisitos com IDs `M1-NN`
- Este arquivo

**Princípios não-negociáveis:**

- TypeScript strict em todos os pacotes (`strict: true`, `noUncheckedIndexedAccess: true` recomendado)
- Sem `any` implícito; `any` explícito só com comentário justificando
- Commits atômicos: um por task, mensagem `feat(m1): T<N> <descrição>` (ou `chore(m1):` para tarefas de scaffold/config)
- Idioma: identificadores e commits em **inglês**; comentários e docs em **português** quando agregar (ver memória `user_language`)

**Convenções acordadas:**

- Estrutura: `packages/web`, `packages/api`, `packages/shared` (pnpm workspaces)
- Node 20+, pnpm 9+
- Portas dev: api `3000`, web `5173` (defaults de Fastify/Vite)
- Web chama api via proxy do Vite (`/api/*` → `http://localhost:3000/*`) — não usar CORS em dev
- Prisma `cuid()` como default de IDs (compacto, URL-safe); usuário pode trocar antes de T7 se preferir uuid
- ESLint flat config (`eslint.config.js`), não legacy `.eslintrc`
- Variáveis sensíveis em `.env` (gitignored); `.env.example` commitado com chaves vazias
- Postura de testes: ver AD-007 — Vitest unit em código com lógica; UI declarativa e configs sem testes; verificação manual de integração

---

## Pré-requisitos Externos (manuais — usuário executa antes de T2)

### T1 (manual): Confirmar acesso ao Postgres da VPS

**Quem:** Usuário.
**Contexto:** O Postgres já está provisionado na VPS Hostinger do usuário. Database `mindmap` já criada. Existe um único user com acesso (admin); para v1 single-user é aceitável usar ele mesmo — não vamos criar user dedicado de aplicação agora.

O Postgres na VPS **só escuta em `localhost`** (sem porta exposta pra internet). Acesso externo é feito via **túnel SSH**.

**Checklist:**

- [ ] Em um terminal dedicado, subir o túnel SSH (deixar rodando enquanto desenvolve):

  ```
  ssh -L 5432:localhost:5432 root@<SEU_VPS_HOST> -N
  ```

  - `-L 5432:localhost:5432`: encaminha porta local 5432 → porta 5432 do localhost no servidor.
  - `-N`: não abre shell, só mantém o túnel.
  - Adicionar `-f` se quiser que vá para background.

- [ ] Validar com `psql "postgresql://USER:SENHA@localhost:5432/mindmap?sslmode=disable" -c '\conninfo'` — deve retornar a conexão sem erro.
- [ ] Ter as credenciais à mão (USER + SENHA do admin) para preencher `packages/api/.env` em T4. **Não commitar esse arquivo.**

**Notas operacionais:**

- O IP real da VPS, USER e SENHA **NÃO** entram neste arquivo nem em qualquer arquivo do repo. Ficam só em `packages/api/.env` (gitignored em T2).
- `sslmode=disable` porque o tráfego já é criptografado pelo SSH. Tentar `sslmode=require` por cima do túnel falha sem certificados expostos no localhost do servidor.
- Quando o túnel cai, qualquer chamada a `/health` da api vai retornar `db: "unreachable"` (comportamento esperado — ver M1-05).

**Requirement:** Pré-requisito de M1-07 a M1-11.

---

## Execution Plan

```
Phase 1 (sequential — foundation):
  T2 → T3

Phase 2 (parallel — package skeletons):
       ┌─→ T4 [P]
  T3 ──┤
       └─→ T5 [P]

Phase 3 (sequential — schema):
  T4 → T6 → T7

Phase 4 (sequential — health endpoint, contract-first):
  T3 → T8 → T9 → T10
       (T7 também precisa estar feito antes de T9 — DB precisa existir)

Phase 5 (sequential — web smoke):
  T5, T8, T9 → T11

Phase 6 (parallel — tooling):
       ┌─→ T12 [P]
  T2 ──┼─→ T13 [P]
       └─→ T14 [P]
```

---

## Task Breakdown

### T2: Root files do monorepo

**What:** Cria raiz do monorepo: workspace config, tsconfig base, scripts agregadores, devDeps comuns, gitignore.
**Where:**

- `/package.json` (root)
- `/pnpm-workspace.yaml`
- `/tsconfig.base.json`
- `/.gitignore`
- `/.editorconfig`
- `/README.md` (mínimo — link para `.specs/project/PROJECT.md`)

**Depends on:** T1 (porque o usuário precisa ter a `DATABASE_URL` antes de avançar; T2 em si não usa o DB, mas T7 vai usar e a sequência fica travada se T1 não terminou)
**Reuses:** N/A (greenfield)
**Requirement:** M1-01, M1-02, M1-03

**Conteúdo esperado:**

- `pnpm-workspace.yaml` lista `packages/*`
- `tsconfig.base.json` com `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `noUncheckedIndexedAccess: true`, `skipLibCheck: true`
- Root `package.json` declara devDeps comuns: `typescript`, `prettier`, `eslint`, `vitest`, `@types/node`, `tsx` (para rodar a api em dev)
- Root `package.json` scripts:
  - `dev`: `pnpm -r --parallel run dev`
  - `build`: `pnpm -r run build` (ordem topológica)
  - `typecheck`: `pnpm -r run typecheck`
  - `test`: `pnpm -r run test`
  - `lint`: `eslint .`
  - `format`: `prettier --write .`
- `.gitignore` cobre: `node_modules/`, `dist/`, `.env`, `.env.local`, `*.log`, `.DS_Store`

**Tools:** Built-in (Write, Bash). Sem MCP.

**Done when:**

- [ ] Os 6 arquivos existem com conteúdo acima.
- [ ] `pnpm install` na raiz roda sem erros.
- [ ] `node -e "require('./pnpm-workspace.yaml')"` ou `pnpm m ls` lista os workspaces (mesmo que vazios por enquanto).

**Tests:** none (scaffolding)
**Gate:** `pnpm install` exit 0

**Commit:** `chore(m1): T2 monorepo root scaffolding`

---

### T3: Package `shared` skeleton

**What:** Cria o pacote de tipos compartilhados, vazio mas buildável.
**Where:**

- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`

**Depends on:** T2
**Reuses:** `tsconfig.base.json` (extends)
**Requirement:** Pré-requisito de M1-15 (será preenchido em T8)

**Conteúdo esperado:**

- `package.json`: `name: "@mindmap/shared"`, `version: "0.0.0"`, `type: "module"`, `main: "dist/index.js"`, `types: "dist/index.d.ts"`, scripts `build` (`tsc`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `dev` (`tsc --watch`)
- `tsconfig.json`: extends base, `outDir: "dist"`, `rootDir: "src"`, `composite: true`, `declaration: true`
- `src/index.ts`: comentário `// shared types — populated in later tasks` (placeholder válido)

**Tools:** Built-in.

**Done when:**

- [ ] Arquivos existem.
- [ ] `pnpm --filter @mindmap/shared build` gera `dist/index.js` e `dist/index.d.ts` sem erros.
- [ ] `pnpm --filter @mindmap/shared typecheck` passa.

**Tests:** none (placeholder)
**Gate:** `pnpm --filter @mindmap/shared build` exit 0

**Commit:** `chore(m1): T3 shared package skeleton`

---

### T4 [P]: Package `api` skeleton

**What:** Cria o pacote da API com Fastify bare, sem rotas reais ainda.
**Where:**

- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/api/src/server.ts`
- `packages/api/src/env.ts`
- `packages/api/.env.example`

**Depends on:** T3 (declara `@mindmap/shared` como dep workspace, mesmo que não use ainda)
**Reuses:** `tsconfig.base.json`
**Requirement:** M1-03, M1-06

**Conteúdo esperado:**

- `package.json`: `name: "@mindmap/api"`, deps `fastify` (^5), `@prisma/client`; devDeps `prisma`, `tsx`, `@types/node`; deps de workspace `"@mindmap/shared": "workspace:*"`
- Scripts: `dev` (`tsx watch src/server.ts`), `build` (`tsc`), `start` (`node dist/server.js`), `typecheck`, `test` (`vitest run`), `lint`
- `tsconfig.json`: extends base, `outDir: "dist"`, `rootDir: "src"`, references `[{ path: "../shared" }]`
- `src/env.ts`: carrega `DATABASE_URL` de `process.env`; falha cedo com mensagem clara se ausente (requirement M1 edge case)
- `src/server.ts`: cria instância Fastify, registra rota `/health` stub que ainda retorna `{ status: "ok", db: "stub" }`, escuta em porta `process.env.PORT ?? 3000`, loga `Listening on http://localhost:<port>`
- `.env.example`:
  ```
  # Postgres acessível via túnel SSH — ver T1 em tasks.md para o comando.
  # Quando o túnel está ativo, host é localhost; SSL desnecessário pois o SSH já criptografa.
  DATABASE_URL=postgresql://user:password@localhost:5432/mindmap?sslmode=disable
  PORT=3000
  ```

**Tools:** Built-in.

**Done when:**

- [ ] Arquivos existem.
- [ ] `pnpm --filter @mindmap/api typecheck` passa.
- [ ] Com `.env` válido apontando para qualquer DB (ou nem isso — T4 não chama o DB), `pnpm --filter @mindmap/api dev` sobe e loga porta.
- [ ] `curl http://localhost:3000/health` retorna o stub `{ status: "ok", db: "stub" }`.
- [ ] `pnpm --filter @mindmap/api dev` sem `DATABASE_URL` no env falha imediatamente com mensagem clara.

**Tests:** none (rota real e teste vêm em T9/T10)
**Gate:** typecheck + smoke manual com `curl`

**Commit:** `chore(m1): T4 api package skeleton with stub /health`

---

### T5 [P]: Package `web` skeleton

**What:** Cria o pacote web com Vite + React mínimo. Tela mostra "Mindmap" estático.
**Where:**

- `packages/web/package.json`
- `packages/web/tsconfig.json`
- `packages/web/tsconfig.node.json`
- `packages/web/vite.config.ts`
- `packages/web/index.html`
- `packages/web/src/main.tsx`
- `packages/web/src/App.tsx`
- `packages/web/src/styles.css` (reset mínimo)

**Depends on:** T3
**Reuses:** `tsconfig.base.json`, layout idiomático de Vite + React + TS
**Requirement:** M1-03

**Conteúdo esperado:**

- `package.json`: `name: "@mindmap/web"`, deps `react` (^18), `react-dom` (^18); devDeps `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`; workspace `"@mindmap/shared": "workspace:*"`
- Scripts: `dev` (`vite`), `build` (`tsc -b && vite build`), `preview` (`vite preview`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `lint`
- `vite.config.ts`: plugin React; **sem** proxy ainda (vem em T11)
- `App.tsx`: componente que renderiza `<h1>Mindmap</h1>` apenas
- `main.tsx`: bootstrap React 18 em `#root`

**Tools:** Built-in.

**Done when:**

- [ ] Arquivos existem.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.
- [ ] `pnpm --filter @mindmap/web dev` sobe Vite em 5173 e a página mostra "Mindmap".
- [ ] `pnpm --filter @mindmap/web build` gera `dist/` sem erros.

**Tests:** none (UI declarativa sem lógica — ver AD-007)
**Gate:** typecheck + smoke manual (abrir browser)

**Commit:** `chore(m1): T5 web package skeleton`

---

### T6: Prisma schema (Map, Node, NodeStatus)

**What:** Define schema Prisma completo conforme M1-08, sem aplicar migration ainda.
**Where:**

- `packages/api/prisma/schema.prisma`

**Depends on:** T4
**Reuses:** N/A
**Requirement:** M1-08, M1-11

**Conteúdo esperado:**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum NodeStatus {
  PENDING
  IN_PROGRESS
  DONE
  BLOCKED
}

model Map {
  id        String   @id @default(cuid())
  title     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  nodes     Node[]

  @@map("Map")
}

model Node {
  id         String      @id @default(cuid())
  mapId      String      @map("map_id")
  parentId   String?     @map("parent_id")
  title      String
  sortOrder  Int         @default(0) @map("sort_order")
  bgColor    String?     @map("bg_color")
  textColor  String?     @map("text_color")
  status     NodeStatus?
  assignee   String?
  isCritical Boolean     @default(false) @map("is_critical")
  createdAt  DateTime    @default(now())  @map("created_at")
  updatedAt  DateTime    @updatedAt       @map("updated_at")

  map      Map     @relation(fields: [mapId], references: [id], onDelete: Cascade)
  parent   Node?   @relation("NodeChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children Node[]  @relation("NodeChildren")

  @@index([mapId])
  @@index([parentId])
  @@map("Node")
}
```

**Tools:** Built-in.

**Done when:**

- [ ] Arquivo existe com conteúdo acima.
- [ ] `pnpm --filter @mindmap/api exec prisma format` retorna sem mudar o arquivo (sintaxe válida).
- [ ] `pnpm --filter @mindmap/api exec prisma validate` passa.

**Tests:** none (declarativo)
**Gate:** `prisma validate` exit 0

**Commit:** `feat(m1): T6 prisma schema for Map and Node`

---

### T7: Aplicar migration inicial no DB da VPS

**What:** Gera e aplica a primeira migration contra o Postgres da VPS, verifica resultado.
**Where:**

- `packages/api/prisma/migrations/<timestamp>_init/migration.sql` (gerado)

**Depends on:** T1, T6
**Reuses:** N/A
**Requirement:** M1-07, M1-08, M1-09, M1-10, M1-11

**Passos:**

1. Confirmar com usuário que `DATABASE_URL` está em `packages/api/.env` e aponta para a VPS.
2. Rodar `pnpm --filter @mindmap/api exec prisma migrate dev --name init` (gera migration SQL + aplica + `prisma generate`).
3. Verificar via `psql "$DATABASE_URL" -c "\dt"` que `Map` e `Node` existem.
4. Verificar via `psql "$DATABASE_URL" -c "\d \"Node\""` que todas as colunas e FKs (com `ON DELETE CASCADE`) estão presentes.
5. Smoke test manual de cascade:
   ```sql
   INSERT INTO "Map" (id, title, created_at, updated_at) VALUES ('test', 'temp', now(), now());
   INSERT INTO "Node" (id, map_id, title, created_at, updated_at) VALUES ('n1', 'test', 'root', now(), now());
   INSERT INTO "Node" (id, map_id, parent_id, title, created_at, updated_at) VALUES ('n2', 'test', 'n1', 'child', now(), now());
   DELETE FROM "Map" WHERE id = 'test';
   SELECT COUNT(*) FROM "Node" WHERE map_id = 'test';  -- esperado: 0
   ```

**Tools:** Built-in (Bash para `pnpm`, `psql`).

**Done when:**

- [ ] Migration aplicada sem erros.
- [ ] `Map` e `Node` listados em `\dt`.
- [ ] Todas as colunas de M1-08 presentes com tipos corretos.
- [ ] FKs com `ON DELETE CASCADE` em `Node.map_id` e `Node.parent_id`.
- [ ] Smoke test de cascade retorna 0.
- [ ] `prisma generate` rodou; tipos disponíveis em `node_modules/.prisma/client` para o pacote api.

**Tests:** none (verificação via psql)
**Gate:** `prisma migrate status` retorna sem migrações pendentes; smoke test manual passa

**Commit:** `feat(m1): T7 apply initial migration to production database`

---

### T8: Tipo `HealthResponse` em `shared`

**What:** Define o contrato da resposta de `/health` no pacote compartilhado.
**Where:** `packages/shared/src/health.ts` + export em `packages/shared/src/index.ts`

**Depends on:** T3
**Reuses:** N/A
**Requirement:** M1-15

**Conteúdo esperado:**

```ts
// packages/shared/src/health.ts
export type DbStatus = 'ok' | 'unreachable';

export interface HealthResponse {
  status: 'ok';
  db: DbStatus;
}
```

Reexport em `index.ts`: `export * from './health.js';`

**Tools:** Built-in.

**Done when:**

- [ ] Arquivos existem.
- [ ] `pnpm --filter @mindmap/shared build` regenera `dist/` com `health.js` e `health.d.ts`.
- [ ] `import { HealthResponse } from '@mindmap/shared'` funciona em api e web.

**Tests:** none (tipo)
**Gate:** `pnpm --filter @mindmap/shared build` exit 0

**Commit:** `feat(m1): T8 shared HealthResponse contract`

---

### T9: Handler real de `/health` na api

**What:** Substitui o stub de `/health` por um handler que pinga o DB via Prisma e retorna o shape de `HealthResponse`.
**Where:**

- `packages/api/src/server.ts` (modificar)
- `packages/api/src/prisma.ts` (novo — exporta singleton `PrismaClient`)

**Depends on:** T7, T8
**Reuses:** `HealthResponse` de `@mindmap/shared`
**Requirement:** M1-04, M1-05, M1-06

**Comportamento:**

- Handler chama `prisma.$queryRaw\`SELECT 1\`` dentro de try/catch.
- Sucesso → HTTP 200 com `{ status: "ok", db: "ok" }`.
- Falha (qualquer erro) → HTTP 503 com `{ status: "ok", db: "unreachable" }`. Logar o erro original em nível `warn`, não retornar detalhes ao cliente.
- Manter o log de startup já existente em T4.

**Tools:** Built-in.

**Done when:**

- [ ] `prisma.ts` exporta um `PrismaClient` singleton com graceful shutdown registrado.
- [ ] `/health` retorna `HealthResponse` corretamente em ambos os caminhos.
- [ ] Logs de erro de DB aparecem com nível `warn` no console quando DB cai.
- [ ] TypeScript: o handler usa o tipo `HealthResponse` importado, sem `any`.
- [ ] `pnpm --filter @mindmap/api typecheck` passa.

**Verify manual:**

- Com DB ok: `curl -s http://localhost:3000/health | jq` → `{"status":"ok","db":"ok"}`, status 200.
- Com DB derrubado (parar Postgres, ou apontar `DATABASE_URL` para porta morta): mesmo curl → `{"status":"ok","db":"unreachable"}`, status 503.

**Tests:** unit (em T10)
**Gate:** typecheck + smoke manual dos dois caminhos

**Commit:** `feat(m1): T9 /health handler with db ping`

---

### T10: Unit test do handler de `/health`

**What:** Teste Vitest do handler isolado, mockando `prisma.$queryRaw`.
**Where:** `packages/api/src/server.test.ts` (ou `packages/api/src/routes/health.test.ts` se T9 extrair a rota para módulo próprio)

**Depends on:** T9
**Reuses:** Fastify `inject` para chamadas in-process; vi.mock para Prisma
**Requirement:** M1-04, M1-05 (verificação automatizada)

**Cenários:**

1. `prisma.$queryRaw` resolve → resposta 200, body `{ status: "ok", db: "ok" }`.
2. `prisma.$queryRaw` rejeita → resposta 503, body `{ status: "ok", db: "unreachable" }`.

**Padrão sugerido:**

```ts
import { describe, it, expect, vi } from 'vitest';
// importar factory que cria a instância Fastify, não a instância já escutando
// se T9 deixou o app embutido no server.ts, refatorar para exportar buildApp() — tarefa pequena dentro de T10
```

Se isso exigir refator do `server.ts`, fazer o refator dentro desta task (extrai `buildApp()` em `packages/api/src/app.ts`, server.ts vira só boot + listen).

**Tools:** Built-in.

**Done when:**

- [ ] Arquivo de teste existe com os dois cenários acima.
- [ ] `pnpm --filter @mindmap/api test` roda Vitest e os dois testes passam.
- [ ] Cobertura cobre ambos os branches (sucesso e falha).
- [ ] Nenhum teste é silenciosamente skipado (sem `.skip`, sem `it.todo`).

**Tests:** unit (é o próprio test)
**Gate:** `pnpm --filter @mindmap/api test` exit 0 com 2 passes

**Commit:** `test(m1): T10 unit tests for /health handler`

---

### T11: Página de smoke do web chamando `/api/health`

**What:** Vite proxy + `App.tsx` que faz fetch de `/api/health` e renderiza o status, com tratamento de erro.
**Where:**

- `packages/web/vite.config.ts` (modificar — adicionar proxy)
- `packages/web/src/App.tsx` (substituir)

**Depends on:** T5, T8, T9
**Reuses:** `HealthResponse` de `@mindmap/shared`
**Requirement:** M1-12, M1-13, M1-14, M1-15

**Proxy do Vite:**

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

**App.tsx esperado:**

- Hook `useEffect` faz `fetch('/api/health')` no mount.
- Estados: `loading | ok | error` (tipo de união discriminada).
- Render:
  - loading → "Checking…"
  - ok → `API: ok / DB: ${response.db}`
  - error → "API unreachable" (mensagem fixa; sem expor detalhe do erro)
- Tipo da resposta: `HealthResponse` de `@mindmap/shared`.

**Tools:** Built-in.

**Done when:**

- [ ] Vite proxy redireciona `/api/*` para `http://localhost:3000/*`.
- [ ] `App.tsx` usa `HealthResponse` importado de `@mindmap/shared`.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.
- [ ] `pnpm dev` na raiz sobe api+web; abrir `http://localhost:5173` mostra "API: ok / DB: ok".
- [ ] Derrubar api → recarregar página → mostra "API unreachable" sem crash.

**Tests:** none (UI declarativa — AD-007); verificação manual nos dois cenários.
**Gate:** typecheck + smoke manual nos dois caminhos

**Commit:** `feat(m1): T11 web smoke page calling /api/health`

---

### T12 [P]: Prettier config

**What:** Configura Prettier na raiz.
**Where:**

- `/.prettierrc.json`
- `/.prettierignore`

**Depends on:** T2
**Reuses:** N/A
**Requirement:** M1-17

**Conteúdo esperado:**

- `.prettierrc.json`: `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100, "arrowParens": "always" }`
- `.prettierignore`: `node_modules`, `dist`, `.next` (caso de uso futuro), `pnpm-lock.yaml`, `packages/api/prisma/migrations`

**Tools:** Built-in.

**Done when:**

- [ ] Arquivos existem.
- [ ] `pnpm format` da raiz roda sem erros (pode mudar arquivos — esperado; commitar resultado junto).
- [ ] `pnpm format --check` exit 0 após o primeiro `pnpm format`.

**Tests:** none (config)
**Gate:** `pnpm format --check` exit 0

**Commit:** `chore(m1): T12 prettier config`

---

### T13 [P]: ESLint flat config

**What:** Configura ESLint com flat config, suportando TS e React.
**Where:** `/eslint.config.js`

**Depends on:** T2
**Reuses:** N/A
**Requirement:** M1-16, M1-20

**Conteúdo esperado:**

- `eslint.config.js` (ESM) com:
  - `@eslint/js` recommended
  - `typescript-eslint` recommended (use o plugin novo `typescript-eslint` que já entrega flat config)
  - `eslint-plugin-react` + `eslint-plugin-react-hooks` para `packages/web/**/*.{ts,tsx}`
  - Ignora `dist/`, `node_modules/`, `**/prisma/migrations/**`
  - Regra: `no-unused-vars` como warn; sobrescrever com `@typescript-eslint/no-unused-vars` (pattern `^_` ignorado)

Adicionar devDeps no root: `eslint`, `typescript-eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `globals`.

**Tools:** Built-in.

**Done when:**

- [ ] `eslint.config.js` existe.
- [ ] `pnpm lint` exit 0 (codebase atual passa).
- [ ] Introduzir um `const x: any = 1; console.log(x)` num arquivo qualquer faz `pnpm lint` falhar; remover faz voltar a passar (validação manual rápida).

**Tests:** none (config)
**Gate:** `pnpm lint` exit 0

**Commit:** `chore(m1): T13 eslint flat config`

---

### T14 [P]: Vitest config base por pacote

**What:** Configura Vitest mínimo em `api` (onde já há teste em T10). `shared` e `web` herdam config via root devDep mas não recebem arquivo de config até precisarem.
**Where:**

- `packages/api/vitest.config.ts`
- (opcional) `vitest.workspace.ts` na raiz se Vitest exigir para `pnpm -r test` funcionar bem

**Depends on:** T2
**Reuses:** N/A
**Requirement:** M1-18

**Conteúdo esperado:**

- `packages/api/vitest.config.ts`: `defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } })`
- Se necessário: `vitest.workspace.ts` apontando `['packages/*']` para o `pnpm test` raiz agregar.

**Tools:** Built-in.

**Done when:**

- [ ] Config existe.
- [ ] `pnpm test` da raiz roda Vitest e os 2 testes de T10 passam (assume T10 já foi feito; se T14 rodar antes em paralelo, `pnpm test` retorna 0 com 0 testes).
- [ ] `pnpm --filter @mindmap/shared test` e `pnpm --filter @mindmap/web test` retornam exit 0 mesmo sem testes (`vitest run --passWithNoTests`).

**Tests:** none (config)
**Gate:** `pnpm test` da raiz exit 0

**Commit:** `chore(m1): T14 vitest config`

---

## Validações Pré-Aprovação

### Granularidade

| Task | Escopo                                                  | Status                            |
| ---- | ------------------------------------------------------- | --------------------------------- |
| T1   | 1 ação manual do usuário                                | ✅                                |
| T2   | 6 arquivos de scaffold coeso                            | ✅ (cohesive root setup)          |
| T3   | 3 arquivos, pacote skeleton                             | ✅                                |
| T4   | 5 arquivos, pacote skeleton api                         | ✅                                |
| T5   | 7 arquivos, pacote skeleton web                         | ✅ (Vite tem skeleton idiomático) |
| T6   | 1 arquivo (schema)                                      | ✅                                |
| T7   | 1 ação (migrate) + verificação                          | ✅                                |
| T8   | 1 tipo em 2 arquivos                                    | ✅                                |
| T9   | 1 handler + 1 singleton (2 arquivos coesos)             | ✅                                |
| T10  | 1 arquivo de teste                                      | ✅                                |
| T11  | 1 proxy + 1 componente (2 arquivos coesos para o smoke) | ✅                                |
| T12  | 2 arquivos de config                                    | ✅                                |
| T13  | 1 arquivo de config                                     | ✅                                |
| T14  | 1-2 arquivos de config                                  | ✅                                |

### Diagram-Definition Cross-Check

| Task | Depends on (task body) | Diagrama mostra                          | Status |
| ---- | ---------------------- | ---------------------------------------- | ------ |
| T2   | T1                     | T1 → T2 (implícito; T1 é Phase 0 manual) | ✅     |
| T3   | T2                     | T2 → T3                                  | ✅     |
| T4   | T3                     | T3 → T4 [P]                              | ✅     |
| T5   | T3                     | T3 → T5 [P]                              | ✅     |
| T6   | T4                     | T4 → T6                                  | ✅     |
| T7   | T1, T6                 | T6 → T7 (T1 implícito)                   | ✅     |
| T8   | T3                     | T3 → T8                                  | ✅     |
| T9   | T7, T8                 | T8 → T9; T7 listado no body de T9        | ✅     |
| T10  | T9                     | T9 → T10                                 | ✅     |
| T11  | T5, T8, T9             | T5, T8, T9 → T11                         | ✅     |
| T12  | T2                     | T2 → T12 [P]                             | ✅     |
| T13  | T2                     | T2 → T13 [P]                             | ✅     |
| T14  | T2                     | T2 → T14 [P]                             | ✅     |

Parallelism: T4/T5 não dependem entre si ✅. T12/T13/T14 não dependem entre si ✅.

### Test Co-location (postura definida em AD-007)

| Task    | Camada criada                 | Postura AD-007                              | Task diz    | Status      |
| ------- | ----------------------------- | ------------------------------------------- | ----------- | ----------- |
| T2      | Root scaffold                 | none (config)                               | none        | ✅          |
| T3      | shared skeleton               | none (placeholder)                          | none        | ✅          |
| T4      | api skeleton (stub /health)   | none (será substituído em T9)               | none        | ✅          |
| T5      | web skeleton (UI declarativa) | none                                        | none        | ✅          |
| T6      | Prisma schema                 | none (declarativo)                          | none        | ✅          |
| T7      | Migration aplicada            | none (verificação via psql)                 | none        | ✅          |
| T8      | Tipo compartilhado            | none (compile-time)                         | none        | ✅          |
| T9      | Handler com lógica            | unit (lógica branching)                     | unit em T10 | ⚠️ ver nota |
| T10     | O próprio teste               | unit (é o teste)                            | unit        | ✅          |
| T11     | UI com fetch                  | none (AD-007: UI declarativa, smoke manual) | none        | ✅          |
| T12-T14 | Configs                       | none                                        | none        | ✅          |

**Nota sobre T9/T10:** Em projeto greenfield sem TESTING.md, optei por colocar handler (T9) e teste (T10) em tasks separadas porque T10 exige refator pequeno (extrair `buildApp()`) que fica mais limpo numa task própria. Isso é tolerado em greenfield; em projeto consolidado, mesclaria T10 dentro de T9 para evitar "código não verificado" entre as duas tasks. Mitigação: T9 já tem smoke manual obrigatório no done-when, então não vai ficar um commit com handler quebrado.

---

## Resumo Final

- **14 tasks** (1 manual + 13 codificáveis).
- **3 fases paralelas:** Phase 2 (T4/T5), Phase 6 (T12/T13/T14).
- **Caminho crítico estimado** (sequencial mais longo): T1 → T2 → T3 → T4 → T6 → T7 → T9 → T10 → T11 (9 tasks). Phase 6 roda em paralelo a qualquer ponto após T2.
- **Commits planejados:** 13 (T1 não gera commit — é setup externo).
- **Próximo passo:** abrir um chat novo, apontar para este arquivo e executar a partir de T2 (após T1 estar concluído pelo usuário).
