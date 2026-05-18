# M1 — Fundação do Monorepo e Infra de Dados

## Problem Statement

Antes de qualquer feature do produto, precisamos da base técnica: monorepo configurado, banco Postgres conectado com schema inicial aplicado, API mínima rodando e frontend bootando contra ela. M1 é puramente infraestrutural — não entrega nada visível ao usuário final, mas é pré-requisito para todos os milestones seguintes (M2 a M6).

## Goals

- [ ] Monorepo pnpm com `web`, `api`, `shared` instalável e buildável em ordem topológica.
- [ ] Banco Postgres na VPS Hostinger conectado; schema completo de Map + Node aplicado via Prisma migration única.
- [ ] Fastify expondo `GET /health` em desenvolvimento local.
- [ ] Vite + React renderizando uma página mínima que confirma comunicação com a API (chama `/health` e mostra o status).
- [ ] ESLint + Prettier + Vitest configurados em todos os pacotes, com scripts npm consistentes.
- [ ] TypeScript strict habilitado end-to-end, types compartilhados via `packages/shared`.

## Out of Scope

| Item                                        | Motivo                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| Endpoints CRUD de Map ou Node               | Entram em M2/M3                                          |
| Componentes de canvas (React Flow, elkjs)   | Entram em M3                                             |
| Qualquer feature de produto (US-01 a US-05) | M2 a M6                                                  |
| CI/CD, deploy automatizado                  | Fora do roadmap v1                                       |
| Deploy de produção da API e do web          | Fora do roadmap v1                                       |
| Pre-commit hooks (husky, lint-staged)       | Pode entrar depois; não bloqueia                         |
| Dev/prod DB split                           | Single DB enquanto único usuário — reavaliar ao deployar |
| Autenticação                                | Excluída de v1 (ver PROJECT.md)                          |
| `is_collapsed` no schema                    | Só no cliente — AD-004                                   |

---

## Pré-requisitos Externos

Tarefas que o usuário precisa concluir antes (ou no início) da execução. Estarão também como primeira task em `tasks.md`.

1. **Postgres na VPS Hostinger:**
   - Criar database dedicada (sugestão: `mindmap`).
   - Criar usuário com permissões `CREATE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES` na database.
   - Garantir conectividade da máquina de dev: liberar IP no firewall **ou** abrir túnel SSH.
2. **`DATABASE_URL`** no formato `postgresql://user:pass@host:port/mindmap?sslmode=require` (ajustar `sslmode` conforme config da VPS).
3. **Toolchain local:** Node 20+ e pnpm 9+ instalados.

---

## User Stories

### P1: Dev sobe a stack local ⭐ MVP

**User Story:** Como dev, quero que `pnpm install && pnpm dev` suba os 3 pacotes para começar a trabalhar.

**Why P1:** Sem isso, nada mais existe.

**Acceptance Criteria:**

1. WHEN `pnpm install` é executado a partir da raiz THEN o sistema SHALL instalar dependências dos 3 pacotes sem erros.
2. WHEN `pnpm build` é executado a partir da raiz THEN o sistema SHALL buildar `shared` → `api` → `web` em ordem topológica sem erros.
3. WHEN `pnpm dev` é executado THEN o sistema SHALL subir api e web em paralelo, com hot reload habilitado em ambos.

**Independent Test:** Clonar repo, rodar `pnpm install && pnpm dev`, ver api e web nas portas documentadas.

---

### P1: API healthcheck disponível ⭐ MVP

**User Story:** Como dev, quero um endpoint `/health` no Fastify para confirmar que servidor e DB estão acessíveis.

**Why P1:** Smoke test mínimo de toda a cadeia (Fastify rodando + Prisma conectando + DB respondendo).

**Acceptance Criteria:**

1. WHEN `GET /health` é chamado com DB acessível THEN o sistema SHALL responder HTTP 200 com JSON `{ "status": "ok", "db": "ok" }`.
2. WHEN `GET /health` é chamado com DB inacessível THEN o sistema SHALL responder HTTP 503 com JSON `{ "status": "ok", "db": "unreachable" }` (api viva, DB caído).
3. WHEN o servidor inicia THEN o sistema SHALL logar host e porta em que está escutando.

**Independent Test:** `curl http://localhost:<api-port>/health` retorna o JSON esperado.

---

### P1: Schema do banco aplicado ⭐ MVP

**User Story:** Como dev, quero o schema completo de Map e Node criado no banco para que futuras features possam persistir dados sem novas migrations estruturais.

**Why P1:** Schema completo desde o início evita migrations adicionais nos milestones M2-M6 (decisão AD nas respostas de planejamento).

**Acceptance Criteria:**

1. WHEN `pnpm --filter api prisma migrate deploy` é executado contra a `DATABASE_URL` configurada THEN o sistema SHALL aplicar a migration inicial sem erros.
2. WHEN a migration é aplicada THEN as tabelas SHALL existir com a estrutura abaixo:

   **Map:**

   | coluna       | tipo         | constraints                                        |
   | ------------ | ------------ | -------------------------------------------------- |
   | `id`         | uuid ou cuid | PK                                                 |
   | `title`      | text         | not null                                           |
   | `created_at` | timestamptz  | not null, default `now()`                          |
   | `updated_at` | timestamptz  | not null, default `now()` (atualizada pelo Prisma) |

   **Node:**

   | coluna        | tipo            | constraints                                                     |
   | ------------- | --------------- | --------------------------------------------------------------- |
   | `id`          | uuid ou cuid    | PK                                                              |
   | `map_id`      | FK → Map.id     | not null, `ON DELETE CASCADE`                                   |
   | `parent_id`   | FK → Node.id    | nullable, `ON DELETE CASCADE` (root tem null)                   |
   | `title`       | text            | not null                                                        |
   | `sort_order`  | int             | not null, default 0                                             |
   | `bg_color`    | text            | nullable                                                        |
   | `text_color`  | text            | nullable                                                        |
   | `status`      | enum NodeStatus | nullable (valores: `PENDING`, `IN_PROGRESS`, `DONE`, `BLOCKED`) |
   | `assignee`    | text            | nullable                                                        |
   | `is_critical` | boolean         | not null, default false                                         |
   | `created_at`  | timestamptz     | not null, default `now()`                                       |
   | `updated_at`  | timestamptz     | not null                                                        |

3. WHEN um Map é deletado THEN seus Nodes SHALL ser removidos via cascade.
4. WHEN um Node intermediário é deletado THEN seus filhos SHALL ser removidos via cascade (sub-árvore inteira).
5. WHEN `prisma generate` roda THEN os tipos TypeScript SHALL ficar disponíveis para o pacote `api`.

**Independent Test:** Após migration:

- `\dt` no `psql` lista `Map` e `Node`.
- `SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('Map','Node')` lista todas as colunas previstas com tipos corretos.
- Inserir manualmente um Map + Node, deletar o Map, verificar que o Node sumiu.

**Nota:** `is_collapsed` NÃO entra no schema — fica só no cliente (AD-004 em STATE.md).

---

### P1: Web se comunica com a API ⭐ MVP

**User Story:** Como dev, quero o frontend carregar uma página que chama `/health` e exibe o resultado, para confirmar que o canal web↔api funciona em desenvolvimento.

**Why P1:** Valida CORS/proxy/dev server config — problemas que normalmente só aparecem depois e atrasam M2.

**Acceptance Criteria:**

1. WHEN o web carrega na porta de dev THEN ele SHALL renderizar uma página mínima que faz `fetch` para o endpoint `/health` da API (via proxy do Vite em `/api/*` ou URL configurada).
2. WHEN a resposta chega THEN a página SHALL exibir o status retornado de forma legível (ex.: "API: ok / DB: ok").
3. WHEN a API está offline THEN a página SHALL exibir mensagem de erro tratada (não quebrar com tela branca).
4. WHEN o tipo da resposta de `/health` é definido em `packages/shared` THEN tanto api quanto web SHALL importá-lo (validação prática de que o pacote compartilhado funciona).

**Independent Test:** Subir tudo, abrir `http://localhost:<web-port>`, ver o status renderizado.

---

### P2: Tooling de qualidade configurado

**User Story:** Como dev, quero ESLint, Prettier, Vitest e typecheck rodáveis da raiz para escrever código consistente desde o primeiro commit.

**Why P2:** Não bloqueia M2, mas é muito mais barato configurar agora do que retroativamente com código existente.

**Acceptance Criteria:**

1. WHEN `pnpm lint` é executado da raiz THEN o sistema SHALL rodar ESLint em todos os pacotes e sair com código 0 (codebase passa porque tem pouco código).
2. WHEN `pnpm format` é executado da raiz THEN o sistema SHALL rodar Prettier em todos os pacotes.
3. WHEN `pnpm test` é executado da raiz THEN o sistema SHALL rodar Vitest em todos os pacotes; exit 0 mesmo sem testes ainda.
4. WHEN `pnpm typecheck` é executado da raiz THEN o sistema SHALL rodar `tsc --noEmit` em todos os pacotes; exit 0 com o código atual.
5. WHEN qualquer arquivo TypeScript tem erro de tipo THEN `pnpm typecheck` SHALL falhar com mensagem clara apontando arquivo:linha.

**Independent Test:** Os quatro comandos (`lint`, `format`, `test`, `typecheck`) rodam da raiz e cumprem o prometido.

---

## Edge Cases

- WHEN `DATABASE_URL` está ausente ou vazia THEN a api SHALL falhar na inicialização com mensagem clara apontando a env var faltante.
- WHEN `DATABASE_URL` aponta para host inalcançável THEN a api ainda SHALL subir; `/health` SHALL retornar `db: "unreachable"` (degraded mode aceitável em dev).
- WHEN as portas padrão de api ou web estão ocupadas THEN o sistema SHALL falhar com mensagem clara indicando a porta conflitante (comportamento default de Fastify/Vite é suficiente).
- WHEN o usuário roda `pnpm dev` sem ter rodado `pnpm install` antes THEN o sistema SHALL falhar com mensagem indicando a necessidade de instalar dependências.

---

## Requirement Traceability

| Requirement ID | Story                                         | Phase   | Status  |
| -------------- | --------------------------------------------- | ------- | ------- |
| M1-01          | P1: Stack sobe local — install                | Pending | Pending |
| M1-02          | P1: Stack sobe local — build topológico       | Pending | Pending |
| M1-03          | P1: Stack sobe local — dev paralelo com HMR   | Pending | Pending |
| M1-04          | P1: Healthcheck — 200 com DB ok               | Pending | Pending |
| M1-05          | P1: Healthcheck — 503 com DB unreachable      | Pending | Pending |
| M1-06          | P1: Healthcheck — log de startup              | Pending | Pending |
| M1-07          | P1: Schema — migration aplica                 | Pending | Pending |
| M1-08          | P1: Schema — tabelas/colunas corretas         | Pending | Pending |
| M1-09          | P1: Schema — cascade Map → Node               | Pending | Pending |
| M1-10          | P1: Schema — cascade Node → filhos            | Pending | Pending |
| M1-11          | P1: Schema — Prisma types gerados             | Pending | Pending |
| M1-12          | P1: Web↔API — página chama health             | Pending | Pending |
| M1-13          | P1: Web↔API — exibe status                    | Pending | Pending |
| M1-14          | P1: Web↔API — trata erro de rede              | Pending | Pending |
| M1-15          | P1: Web↔API — type compartilhado via `shared` | Pending | Pending |
| M1-16          | P2: Tooling — lint                            | Pending | Pending |
| M1-17          | P2: Tooling — format                          | Pending | Pending |
| M1-18          | P2: Tooling — test                            | Pending | Pending |
| M1-19          | P2: Tooling — typecheck                       | Pending | Pending |
| M1-20          | P2: Tooling — erro de tipo detectado          | Pending | Pending |

**Coverage:** 20 requisitos. Mapeamento para tasks atômicas será feito em `tasks.md` (próximo passo).

---

## Success Criteria

- [ ] Em uma máquina nova com Node 20+, pnpm 9+ e `DATABASE_URL` válida: `git clone && pnpm install && pnpm --filter api prisma migrate deploy && pnpm dev` sobe a stack completa.
- [ ] `curl http://localhost:<api-port>/health` retorna `{ "status": "ok", "db": "ok" }`.
- [ ] Página inicial do web exibe o status retornado da API.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa sem erros.
- [ ] Inspecionar o Postgres mostra `Map` e `Node` com todas as colunas listadas em M1-08, com FKs em modo CASCADE.
