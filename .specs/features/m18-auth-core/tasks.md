# M18 — Núcleo de auth backend — Tasks

**Design**: `.specs/features/m18-auth-core/design.md`
**Status**: Executado (2026-07-04) — 12/12 tasks; gates verdes (typecheck, lint, unit api 63→97, web 121 intocado). Review AD-013 pendente em chat separado.

> Execução em **chat separado** ([[feedback-plan-execute-split]]). Só backend (`packages/api` + `packages/shared`).
> Skill recomendada para tasks de rota/mapper/teste: **`api-backend`**.

---

## Gate Check Commands

| Nível              | Comando                                                                              | Precisa de DB?          |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------- |
| **quick**          | `pnpm --filter @mindmap/api typecheck && pnpm --filter @mindmap/api lint`            | Não                     |
| **unit (arquivo)** | `pnpm --filter @mindmap/api exec vitest run <arquivo.test.ts>`                        | Não (só libs puras)     |
| **full**           | `pnpm -r run typecheck && pnpm lint && pnpm --filter @mindmap/api test`               | **Sim** (test DB)       |

**DB de teste:** `.env.test` → `dev_mindmap` via túnel SSH (AD-006). Isolado do prod — seguro rodar (L-007).
**e2e/smoke visual:** fora do M18 (não há UI) — entram no M19 e no review AD-013.

### Matriz de cobertura (definida aqui — não há `.specs/codebase/TESTING.md`)

| Camada                                   | Tipo de teste exigido | Onde roda                         |
| ---------------------------------------- | --------------------- | --------------------------------- |
| Lib/serviço puro (`password`, `sessions`, `scope`) | **unit**     | co-locado no arquivo `*.test.ts`  |
| Rota Fastify (`auth`, `maps`, `nodes`)   | **integration** (`app.inject`) | co-locado no `*.test.ts` da rota |
| Hook/plugin de infra (`auth-guard`)      | integration (via rota) | **merge-forward** → testado em T9/T10/T11 |
| Schema/migração, tipos shared, deps      | none                  | verificado por typecheck + downstream |

---

## Execution Plan

### Fase 1 — Fundação (deps, schema, tipos)

```
T1 (deps)  [P]
T2 (schema+migração)  [P]
T3 (tipos shared)  [P]
```

### Fase 2 — Libs e serviços puros

```
T1 ─→ T4 (password)        [P]
T2 ─→ T7 (scope)           [P]
T2,T3 ─→ T5 (mapper) ─→ T6 (sessions)
```

### Fase 3 — Guarda e rotas de auth

```
T6 ─┐
T1 ─┼─→ T8 (auth-guard) ─┐
T3 ─┘                    ├─→ T9 (routes/auth + wiring + helper de teste)
T4,T5 ───────────────────┘
```

### Fase 4 — Escopo por dono (sequencial — testes compartilham o test DB)

```
T7,T8,T9 ─→ T10 (maps scoping) ─→ T11 (nodes scoping)
```

### Fase 5 — Gate final

```
T10,T11 ─→ T12 (full gate + guarda anti-vazamento)
```

---

## Task Breakdown

### T1: Adicionar deps `argon2` e `@fastify/cookie` [P]

**What**: Instalar as duas dependências novas no pacote da API.
**Where**: `packages/api/package.json` (+ lockfile)
**Depends on**: None
**Reuses**: —
**Requirement**: M18-19 (cookie), base de M18-01/05 (argon2)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `pnpm --filter @mindmap/api add argon2 @fastify/cookie` executado; ambos em `dependencies`.
- [ ] `@fastify/cookie` resolve para versão compatível com Fastify 5 (^11).
- [ ] Gate quick passa: `pnpm --filter @mindmap/api typecheck && pnpm --filter @mindmap/api lint`

**Tests**: none · **Gate**: quick
**Commit**: `chore(m18): adiciona deps argon2 e @fastify/cookie`

---

### T2: Schema + migração (User, Session, Map.ownerId) [P]

**What**: Modelos `User`/`Session` + coluna `Map.ownerId` nullable com FK/índices; gerar migração aditiva.
**Where**: `packages/api/prisma/schema.prisma`, `packages/api/prisma/migrations/*_add_auth_users_sessions_owner/`
**Depends on**: None
**Reuses**: Convenções de schema atuais (`@map`, `cuid()`, `@@index`)
**Requirement**: M18-16

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `User` (email `@unique`, `passwordHash`, name, timestamps), `Session` (`tokenHash @unique`, `userId`, `expiresAt`, `@@index([userId])`, `onDelete: Cascade`), `Map.ownerId String?` + relação `owner` (`onDelete: Cascade`) + `@@index([ownerId])` conforme `design.md`.
- [ ] `pnpm --filter @mindmap/api exec prisma migrate dev --name add_auth_users_sessions_owner` roda no dev DB; migração é **aditiva** (nenhum drop/alter destrutivo; `ownerId` nullable).
- [ ] `prisma generate` atualiza o client (tipos `User`/`Session` disponíveis).
- [ ] Mapas existentes permanecem com `ownerId = NULL` (nada apagado).
- [ ] Gate quick passa.

**Tests**: none (verificado por migrate + tipos + tasks downstream) · **Gate**: quick (+ migrate no dev DB)
**Verify**: `prisma migrate status` limpo; `SELECT count(*) FROM "Map" WHERE owner_id IS NULL` = total atual.
**Commit**: `feat(m18): schema User/Session + Map.ownerId e migração aditiva`

---

### T3: Tipos compartilhados de auth [P]

**What**: `AuthUser`, `SignupBody`, `LoginBody`, `AuthResponse` + reexport.
**Where**: `packages/shared/src/auth.ts`, `packages/shared/src/index.ts`
**Depends on**: None
**Reuses**: Padrão de `packages/shared/src/map.ts`
**Requirement**: M18-20

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `auth.ts` define os 4 tipos do `design.md` (`AuthUser` sem `passwordHash`).
- [ ] Reexportado em `index.ts`.
- [ ] Gate quick passa: `pnpm --filter @mindmap/shared typecheck` + `pnpm --filter @mindmap/api typecheck`.

**Tests**: none · **Gate**: quick
**Commit**: `feat(m18): tipos compartilhados de auth`

---

### T4: `lib/password.ts` (wrapper argon2) + unit [P]

**What**: `hashPassword`/`verifyPassword` sobre argon2id, com teste unit.
**Where**: `packages/api/src/lib/password.ts` (+ `password.test.ts`)
**Depends on**: T1
**Reuses**: —
**Requirement**: M18-01, M18-05

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `hashPassword(plain)` → string argon2id; `verifyPassword(hash, plain)` → boolean (exceção → `false`).
- [ ] Unit: hash ≠ plain; `verify(hash, plain)` = true; `verify(hash, 'errada')` = false; hash inválido → false.
- [ ] Gate unit passa: `pnpm --filter @mindmap/api exec vitest run src/lib/password.test.ts`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m18): wrapper de senha com argon2`

---

### T5: `mappers/users.ts` (toAuthUser)

**What**: Projeção pública do usuário (`{ id, email, name }`, nunca hash).
**Where**: `packages/api/src/mappers/users.ts`
**Depends on**: T2, T3
**Reuses**: Padrão de `mappers/maps.ts`
**Requirement**: M18-01, M18-09, M18-20

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `toAuthUser(user: User): AuthUser` retorna só `{ id, email, name }`.
- [ ] Nenhuma referência a `passwordHash` na saída.
- [ ] Gate quick passa.

**Tests**: none (função trivial de projeção; exercida em T6/T9 integração) · **Gate**: quick
**Commit**: `feat(m18): mapper toAuthUser`

---

### T6: `services/sessions.ts` (ciclo de sessão) + unit

**What**: `createSession`/`findValidSession`/`deleteSession` + `sha256` + TTL 7d/30d.
**Where**: `packages/api/src/services/sessions.ts` (+ `sessions.test.ts`)
**Depends on**: T2, T5
**Reuses**: `prisma`, `toAuthUser`, `crypto` (node)
**Requirement**: M18-07, M18-08, M18-09, M18-10, M18-17-safety

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `createSession(userId, remember)` grava `sha256(token)` + `expiresAt = now + (remember?30d:7d)`; retorna `{ token, maxAgeSeconds }`.
- [ ] `findValidSession(token)`: token desconhecido → null; expirado → apaga a linha + null; válido → `AuthUser`.
- [ ] `deleteSession(token)` idempotente (0 linhas ok).
- [ ] Constantes `SESSION_TTL_DAYS=7`, `SESSION_TTL_REMEMBER_DAYS=30`, `SESSION_COOKIE_NAME='mm_session'` exportadas.
- [ ] Unit (integração com DB de teste): sha256 estável para o mesmo token; sessão expirada → null e removida; maxAge reflete remember.
- [ ] Gate full passa (usa DB): `pnpm --filter @mindmap/api test`

**Tests**: unit/integration (toca DB) · **Gate**: full
**Commit**: `feat(m18): serviço de sessão server-side (token hasheado + TTL)`

---

### T7: `services/scope.ts` (posse por dono) + unit [P]

**What**: `findOwnedMap`/`findOwnedNode` via relation-filter, 404 em não-posse.
**Where**: `packages/api/src/services/scope.ts` (+ `scope.test.ts`)
**Depends on**: T2
**Reuses**: `NotFoundError`, `prisma` types
**Requirement**: M18-13, M18-14

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `findOwnedMap(db, mapId, userId)` = `findFirst({ where:{ id, ownerId } })`; null → `NotFoundError('Map not found')`.
- [ ] `findOwnedNode(db, nodeId, userId)` = `findFirst({ where:{ id, map:{ ownerId } } })`; null → `NotFoundError('Node not found')`.
- [ ] Aceita `tx` ou `prisma`.
- [ ] Unit (com DB): dono acessa; outro dono → NotFound; inexistente → NotFound.
- [ ] Gate full passa.

**Tests**: unit/integration (toca DB) · **Gate**: full
**Commit**: `feat(m18): helpers de escopo por dono`

---

### T8: `auth-guard` (requireAuth + cookie helpers) + errors/env

**What**: PreHandler `requireAuth`, helpers `setSessionCookie`/`clearSessionCookie`, `UnauthorizedError`, `env.COOKIE_SECURE`, augment de tipo `req.user`.
**Where**: `packages/api/src/plugins/auth-guard.ts`, `packages/api/src/errors.ts` (modify), `packages/api/src/env.ts` (modify), `packages/api/src/types/fastify.d.ts`
**Depends on**: T1, T3, T6
**Reuses**: `services/sessions`, `ApiError`
**Requirement**: M18-11, M18-19

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `UnauthorizedError extends ApiError(401)` em `errors.ts`.
- [ ] `env.COOKIE_SECURE` (default `false`).
- [ ] `requireAuth(req, reply)`: sem/invalid/expirado → `clearSessionCookie` + `throw UnauthorizedError`; válido → `req.user = authUser`.
- [ ] `setSessionCookie`/`clearSessionCookie` com `{ httpOnly, sameSite:'lax', path:'/', secure: env.COOKIE_SECURE, maxAge }`.
- [ ] `declare module 'fastify'` adiciona `user: AuthUser | null` a `FastifyRequest`.
- [ ] Gate quick passa (comportamento coberto por integração em T9).

**Tests**: none (infra de hook; **merge-forward** → guarda validada em T9 via `/me` e em T10/T11) · **Gate**: quick
**Commit**: `feat(m18): guarda de sessão (requireAuth) + cookie helpers`

---

### T9: `routes/auth.ts` + wiring no app + helper de teste + integração

**What**: Endpoints `signup`/`login`/`logout`/`me`; registrar `@fastify/cookie` + `decorateRequest` + plugin `/auth` no `app.ts`; helper de teste `createUserWithSession`; testes de integração de auth + herança.
**Where**: `packages/api/src/routes/auth.ts` (+ `auth.test.ts`), `packages/api/src/app.ts` (modify), `packages/api/src/test/helpers.ts`
**Depends on**: T3, T4, T5, T6, T8
**Reuses**: Padrão `FastifyPluginAsyncZod`, error handler central, `lib/password`, `services/sessions`, `plugins/auth-guard`, `mappers/users`
**Requirement**: M18-01, M18-02, M18-03, M18-04, M18-05, M18-06, M18-07, M18-08, M18-09, M18-10, M18-17, M18-18

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `POST /auth/signup`: Zod `{ email, password(min8), name(min1), remember? }`; normaliza email (`trim`+`lowercase`); `$transaction` cria User (hash) → se `count()===1` `map.updateMany({ where:{ownerId:null}, data:{ownerId:user.id} })` → `createSession` + `setSessionCookie`; `201` `toAuthUser`. Email dup → `409` (P2002).
- [ ] `POST /auth/login`: normaliza; verify; falha → `401 'Invalid credentials'` **idêntico** p/ email inexistente e senha errada; sucesso → session + cookie + `200`.
- [ ] `POST /auth/logout`: apaga sessão (se houver) + `clearSessionCookie`; `204` sempre (sem `requireAuth`).
- [ ] `GET /auth/me`: `preHandler: requireAuth`; `200` `req.user`.
- [ ] `app.ts`: `app.register(fastifyCookie)`, `app.decorateRequest('user', null)`, `app.register(authPlugin, { prefix:'/auth' })`.
- [ ] Helper `createUserWithSession()` (cria user via prisma + `createSession`, devolve `{ user, cookie }`) para reuso em T10/T11.
- [ ] Integração cobre: signup 201+`Set-Cookie`; email dup 409; senha curta 400; email malformado/nome vazio 400; login ok/errado (401 genérico idêntico); logout 204 → reenviar cookie → `/me` 401; `/me` sem cookie 401, com cookie 200; **herança**: banco com mapa órfão → 1º signup vê o mapa; 2º signup vê vazio.
- [ ] `beforeEach` limpa `Session`/`User` além de node/map.
- [ ] Gate full passa; segredo (hash) nunca aparece em resposta.

**Tests**: integration · **Gate**: full
**Commit**: `feat(m18): endpoints signup/login/logout/me + sessão em cookie`

---

### T10: Escopo por dono em `routes/maps.ts` + reconciliar testes

**What**: `requireAuth` + filtro/posse por `ownerId` em todas as rotas de maps; reconciliar `maps.test.ts` para autenticar; testes de isolamento.
**Where**: `packages/api/src/routes/maps.ts` (modify), `packages/api/src/routes/maps.test.ts` (modify)
**Depends on**: T7, T8, T9
**Reuses**: `findOwnedMap`, `requireAuth`, `createUserWithSession`
**Requirement**: M18-11, M18-12, M18-13, M18-15

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `app.addHook('preHandler', requireAuth)` no topo do plugin.
- [ ] `GET /` → `findMany({ where:{ ownerId } })` + `groupBy` críticos com `where:{ isCritical:true, map:{ ownerId } }`.
- [ ] `POST /` seta `ownerId: req.user.id` (map **e** nó raiz continuam na mesma transação).
- [ ] `GET/PATCH/DELETE /:id` e `GET /:id/nodes` usam `findOwnedMap` (não-posse/inexistente → 404).
- [ ] `maps.test.ts` reconciliado: todo `inject` autentica via `createUserWithSession`; `beforeEach` limpa User/Session.
- [ ] Novos testes: sem cookie → 401; user A não vê mapa de B em `GET /`; `GET/DELETE /maps/:idB` → 404 (isolamento **não-vacuoso**).
- [ ] Comportamento do dono idêntico ao anterior (contagens/ordenação preservadas).
- [ ] Gate full passa; contagem de testes reportada (sem deleção silenciosa).

**Tests**: integration · **Gate**: full
**Commit**: `feat(m18): escopo por dono nas rotas de maps`

---

### T11: Escopo por dono em `routes/nodes.ts` + reconciliar testes

**What**: `requireAuth` + posse por `ownerId` em todas as rotas de nodes; reconciliar `nodes.test.ts`; testes de isolamento.
**Where**: `packages/api/src/routes/nodes.ts` (modify), `packages/api/src/routes/nodes.test.ts` (modify)
**Depends on**: T7, T8, T9 (sequencial após T10 — testes compartilham o test DB)
**Reuses**: `findOwnedNode`, `requireAuth`, `createUserWithSession`
**Requirement**: M18-11, M18-14, M18-15

**Tools**: MCP: NONE · Skill: `api-backend`

**Done when**:

- [ ] `app.addHook('preHandler', requireAuth)` no topo do plugin.
- [ ] `POST /` valida `parentId` via `findOwnedNode(parentId, userId)` (não-posse → 404); lógica de `side`/sortOrder intacta.
- [ ] `PATCH/DELETE /:id` e `PATCH /:id/move` resolvem o nó via `findOwnedNode`; `move` valida também `newParentId` via `findOwnedNode`. Anti-ciclo (AD-008), renumeração global, `side`/`width` **inalterados**.
- [ ] `nodes.test.ts` reconciliado (autentica via helper; limpa User/Session).
- [ ] Novos testes: sem cookie → 401; user B `PATCH/DELETE /nodes/:noDeA` → 404; `move` com parent de outro dono → 404 (isolamento não-vacuoso).
- [ ] Gate full passa; contagem reportada.

**Tests**: integration · **Gate**: full
**Commit**: `feat(m18): escopo por dono nas rotas de nodes`

---

### T12: Gate final + guarda anti-vazamento de segredo

**What**: Rodar a suíte completa, confirmar contagens e garantir que hash/token nunca vazam em resposta/log.
**Where**: — (verificação; sem novo código de produção)
**Depends on**: T10, T11
**Reuses**: —
**Requirement**: Success Criteria da spec

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `pnpm -r run typecheck` ✅, `pnpm lint` ✅.
- [ ] `pnpm --filter @mindmap/api test` ✅ — todos verdes; contagem de testes registrada (api anterior 61 → novo total).
- [ ] `pnpm --filter @mindmap/web test` ✅ (web intocado: 121 verdes).
- [ ] Grep-guard: nenhuma rota serializa `passwordHash`/`tokenHash` (`grep -rn "passwordHash\|tokenHash" packages/api/src/routes packages/api/src/mappers` só em contexto interno, nunca em `.send`/DTO).
- [ ] Concern registrado em `CONCERNS.md`: cookie `Secure` off em prod HTTP (AD-022) — recomendação de TLS.
- [ ] Confirmar `git diff` só em `packages/api` + `packages/shared` (frontend intocado).

**Tests**: full suite (verificação) · **Gate**: full
**Commit**: `chore(m18): gate final + registro de concern de cookie Secure`

---

## Pré-aprovação — Validações obrigatórias

### Check 1 — Granularidade

| Task | Escopo                                             | Status      |
| ---- | -------------------------------------------------- | ----------- |
| T1   | 1 mudança de config (deps)                         | ✅ Granular |
| T2   | 1 schema + 1 migração                              | ✅ Granular |
| T3   | 1 arquivo de tipos                                 | ✅ Granular |
| T4   | 1 lib + teste                                      | ✅ Granular |
| T5   | 1 mapper                                            | ✅ Granular |
| T6   | 1 serviço + teste                                  | ✅ Granular |
| T7   | 1 serviço + teste                                  | ✅ Granular |
| T8   | 1 plugin + 2 edits pequenos (errors/env) coesos   | ⚠️ OK (coeso: infra da guarda) |
| T9   | 1 plugin de rota + wiring + helper (coeso: auth)  | ⚠️ OK (1 endpoint-group + sua infra de teste) |
| T10  | 1 rota (maps) + seus testes                        | ✅ Granular |
| T11  | 1 rota (nodes) + seus testes                       | ✅ Granular |
| T12  | verificação/gate                                   | ✅ Granular |

T8/T9 agrupam arquivos coesos por responsabilidade única (a guarda; o grupo de endpoints de auth). Dividir mais criaria código não-testável isoladamente (merge-forward já aplicado).

### Check 2 — Cross-check diagrama × definição

| Task | Depends on (corpo) | Diagrama (setas)     | Status   |
| ---- | ------------------ | -------------------- | -------- |
| T1   | —                  | —                    | ✅ Match |
| T2   | —                  | —                    | ✅ Match |
| T3   | —                  | —                    | ✅ Match |
| T4   | T1                 | T1→T4                | ✅ Match |
| T5   | T2, T3             | T2,T3→T5             | ✅ Match |
| T6   | T2, T5             | T5→T6 (T2 via T5)    | ✅ Match |
| T7   | T2                 | T2→T7                | ✅ Match |
| T8   | T1, T3, T6         | T6,T1,T3→T8          | ✅ Match |
| T9   | T3, T4, T5, T6, T8 | T8,T4,T5→T9          | ✅ Match |
| T10  | T7, T8, T9         | T7,T8,T9→T10         | ✅ Match |
| T11  | T7, T8, T9         | T9→...→T11 (após T10) | ✅ Match |
| T12  | T10, T11           | T10,T11→T12          | ✅ Match |

### Check 3 — Co-locação de teste

| Task | Camada criada/modificada           | Matriz exige | Task diz     | Status |
| ---- | ---------------------------------- | ------------ | ------------ | ------ |
| T1   | deps                               | none         | none         | ✅ OK  |
| T2   | schema/migração                    | none         | none         | ✅ OK  |
| T3   | tipos shared                       | none         | none         | ✅ OK  |
| T4   | lib pura (password)                | unit         | unit         | ✅ OK  |
| T5   | mapper (projeção trivial)          | none         | none         | ✅ OK  |
| T6   | serviço (sessions)                 | unit/integr. | unit/integr. | ✅ OK  |
| T7   | serviço (scope)                    | unit/integr. | unit/integr. | ✅ OK  |
| T8   | hook de infra (guard)              | integr. (via rota, merge-fwd) | none→T9 | ✅ OK  |
| T9   | rota (auth)                        | integration  | integration  | ✅ OK  |
| T10  | rota (maps)                        | integration  | integration  | ✅ OK  |
| T11  | rota (nodes)                       | integration  | integration  | ✅ OK  |
| T12  | —                                  | full         | full         | ✅ OK  |

**Nota de paralelismo:** T10 e T11 **não** são `[P]` entre si — os testes de integração compartilham o test DB (não paralelo-seguro), então rodam sequenciais (T10 → T11). `[P]` só nas fases 1–2 (código puro sem estado compartilhado).

---

## Rastreabilidade — cobertura dos requisitos

| Requisito | Task(s)      | Requisito | Task(s)     |
| --------- | ------------ | --------- | ----------- |
| M18-01    | T4, T5, T9   | M18-12    | T10         |
| M18-02    | T9           | M18-13    | T7, T10     |
| M18-03    | T9           | M18-14    | T7, T11     |
| M18-04    | T9           | M18-15    | T10, T11    |
| M18-05    | T4, T9       | M18-16    | T2          |
| M18-06    | T9           | M18-17    | T9          |
| M18-07    | T6, T9       | M18-18    | T9          |
| M18-08    | T6, T9       | M18-19    | T1, T8      |
| M18-09    | T5, T6, T9   | M18-20    | T3, T5      |
| M18-10    | T6, T9       | M18-21    | T10, T11    |
| M18-11    | T8, T10, T11 |           |             |

**Cobertura:** 21/21 requisitos mapeados para tasks. Nenhum órfão.
</content>
