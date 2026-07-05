# M23 — Login por username — Tasks

> Backend (`packages/api`) + frontend (`packages/web`) + `@mindmap/shared`. Sem infra nova.
> Cada task = 1 commit atômico `feat(m23)`/`test(m23)`. Rastreabilidade → `spec.md` (M23-NN).
> Gray areas → `context.md`. Arquitetura → `design.md`. Executar em chat separado
> ([[feedback-plan-execute-split]]).
>
> **Ganchos-chave (do design):** username é o gêmeo do e-mail (coluna única, `UsernameField` lowercase
> espelhando `EmailField`); login por `identifier` (`includes('@')` escolhe a coluna); conflito de
> unicidade distinguido por `err.meta.target` → `ConflictError` (já existe); tudo dentro do `authPlugin`.

**Grafo de dependências:**

```
T1 (shared DTOs) [P] ─┬─→ T3 (signup+schema+mapper) ─→ T4 (login identifier) ─→ T5 (PATCH username) ─┐
T2 (Prisma) [P] ──────┘                                                                              │
T1 ─┬─→ T6 (front api/auth) ─┐                                                                        ├─→ T11 (e2e+gate)
    └─→ T10 (AccountMenu) ────┤                                                                       │
T7 (validateUsername) [P] ───┴─→ T8 (AuthPage fields) ──┐                                             │
                                 T9 (ProfilePage) ───────┴─────────────────────────────────────────┘
```

- **T1**, **T2**, **T7** paralelos `[P]` (áreas disjuntas).
- Backend **T3→T4→T5** sequencial (mesmo arquivo `routes/auth.ts`). Precisam de T1 (DTOs) + T2 (coluna).
- Front: **T6** e **T7** alimentam **T8**/**T9**; **T10** só precisa de T1. **T11** precisa de tudo.

---

## T1 — Shared: DTOs de username + rename `identifier` `[P]`

- **What**: contrato dos campos novos + renomeio do login.
- **Where**: `packages/shared/src/auth.ts` (ou equivalente onde vivem `SignupBody`/`LoginBody`/`AuthUser`/`UpdateProfileBody`).
- **Depends on**: —
- **Reuses**: padrão dos DTOs existentes.
- **Done when**: `SignupBody` ganha `username`; `LoginBody.email` → `identifier`; `AuthUser` ganha
  `username`; `UpdateProfileBody` ganha `username?`. Exportados de `@mindmap/shared`.
- **Tests**: none (só tipos).
- **Traces**: M23-04, M23-06, M23-08, M23-09.
- **Gate**: `pnpm -r typecheck` — **vai quebrar** nos consumidores (esperado; T3/T4/T6 fecham). Compila o pacote shared isolado ✓.

## T2 — Backend: `User.username` único + migration `[P]`

- **What**: coluna única de username.
- **Where**: `packages/api/prisma/schema.prisma` (`User`), migration `add_user_username`.
- **Depends on**: —
- **Reuses**: anotação `@unique` do `email`.
- **Done when**: `username String @unique` no `User`; migration aplica limpa (tabela vazia, sem backfill —
  C3); `prisma generate` ok. Se o `dev_mindmap` tiver linhas, reset antes ([[feedback-shared-dev-db-destructive]]).
- **Tests**: none (schema).
- **Traces**: M23-01.
- **Gate**: typecheck ✓; migration roda limpa num banco vazio.

## T3 — Backend: `UsernameField` + signup (username + conflito específico) + mapper

- **What**: validação/normalização do username, signup gravando username com 409 específico, e `AuthUser.username`.
- **Where**: `packages/api/src/routes/auth.ts` (`UsernameField`, `SignupBodySchema`, handler signup),
  `src/mappers/users.ts` (`toAuthUser` inclui `username`), `routes/auth.test.ts` (casos).
- **Depends on**: T1, T2.
- **Reuses**: `EmailField` como molde; `ConflictError` (`src/errors.ts:19`); `Prisma.PrismaClientKnownRequestError`;
  a `$transaction` de adoção de mapas órfãos (inalterada).
- **Done when**:
  - `UsernameField = z.string().trim().toLowerCase().pipe(z.string().min(1).max(39).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))`.
  - `SignupBodySchema` ganha `username: UsernameField`; handler cria com `username`.
  - `P2002` no signup capturado: `meta.target` inclui `email` → `ConflictError('E-mail já cadastrado')`;
    inclui `username` → `ConflictError('Nome de usuário já em uso')`; senão `throw err`.
  - `toAuthUser` retorna `username`.
- **Tests**: unit — signup grava username; e-mail duplicado → 409 msg e-mail; username duplicado → 409 msg
  usuário; formato inválido → 400. Ajustar fixtures de signup existentes (agora exigem `username`).
- **Traces**: M23-02, M23-03, M23-06, M23-07, M23-08, M23-16.
- **Gate**: typecheck ✓, lint ✓, unit api ✓.

## T4 — Backend: login por `identifier`

- **What**: login aceita e-mail ou username no mesmo campo.
- **Where**: `packages/api/src/routes/auth.ts` (`LoginBodySchema`, handler login), `routes/auth.test.ts`.
- **Depends on**: T1, T3 (mesmo arquivo; `UsernameField` já entrou).
- **Reuses**: `verifyPassword`/`DUMMY_PASSWORD_HASH`/`UnauthorizedError` (timing + 401 genérico).
- **Done when**:
  - `LoginBodySchema`: `identifier: z.string().trim().toLowerCase().min(1)` (sem validar como e-mail),
    `password`, `remember?`.
  - Handler: `identifier.includes('@')` → `findUnique({ email })`, senão `findUnique({ username })`;
    mantém dummy hash + `401` genérico.
- **Tests**: unit — login por e-mail (regressão), por username, username inexistente → 401, senha errada → 401.
  Migrar os testes de login existentes de `email` → `identifier`.
- **Traces**: M23-04, M23-05, M23-16.
- **Gate**: typecheck ✓, lint ✓, unit api ✓.

## T5 — Backend: `PATCH /auth/me` aceita `username`

- **What**: edição de username no perfil, com unicidade.
- **Where**: `packages/api/src/routes/auth.ts` (schema + handler do `PATCH /auth/me`), `routes/auth.test.ts`.
- **Depends on**: T3 (`UsernameField`).
- **Reuses**: `UsernameField.optional()`; o mesmo tratamento de `P2002`/`meta.target` (ramo username) do T3;
  escopo por `req.user.id` (M20).
- **Done when**: `UpdateProfileBodySchema` ganha `username: UsernameField.optional()`; update aplica;
  username duplicado → `ConflictError('Nome de usuário já em uso')` (409).
- **Tests**: unit — troca username ok; duplicado → 409; formato inválido → 400.
- **Traces**: M23-09, M23-16.
- **Gate**: typecheck ✓, lint ✓, unit api ✓.

## T6 — Front: `api/auth.ts` envia `identifier`/`username`

- **What**: camada de API alinhada ao contrato novo.
- **Where**: `packages/web/src/api/auth.ts`, `src/api/auth.test.ts`.
- **Depends on**: T1.
- **Reuses**: `request` de `_request.js`; hooks `useLogin`/`useSignup`/`useUpdateProfile` existentes.
- **Done when**: `login` envia `{ identifier, password, remember }`; `signup` envia `{ …, username }`;
  `useUpdateProfile` repassa `username` quando presente.
- **Tests**: unit — cada hook envia o corpo certo (mock `request`).
- **Traces**: M23-12.
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T7 — Front: `validateUsername` (fonte única) `[P]`

- **What**: validador client-side manual do username.
- **Where**: `packages/web/src/pages/auth/validation.ts` (+ export), `pages/auth/validation.test.ts`.
- **Depends on**: —
- **Reuses**: padrão dos validadores manuais existentes (AD-028 — sem zod no client).
- **Done when**: `validateUsername(value)` — não-vazio, `≤ 39`, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`
  (após `trim().toLowerCase()`), mensagens pt-BR. `validateAuth` cobre `username` no modo cadastro; no
  login, valida identifier só como não-vazio (sem `isValidEmail`).
- **Tests**: unit — válidos (`ab`, `a-b-c`, 39 chars, `Lucas`→`lucas`), inválidos (vazio, `-x`, `x-`,
  `a--b`, `x_y`, 40 chars).
- **Traces**: M23-13.
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T8 — Front: `AuthPage` — campo usuário (cadastro) + identifier (login)

- **What**: os dois ajustes de campo na tela dupla.
- **Where**: `packages/web/src/pages/auth/AuthPage.tsx`.
- **Depends on**: T6, T7.
- **Reuses**: `AuthField`; `validateUsername`/`validateAuth`.
- **Done when**:
  - Cadastro: `AuthField` "Usuário" entre Nome e E-mail, `autocomplete="username"`, erro inline (M23-10).
  - Login: campo de e-mail vira "Usuário ou e-mail" (`type="text"`, `autocomplete="username"`); estado
    `email` → `identifier`; envia `identifier` no login, `email` só no cadastro (M23-11).
- **Tests**: none (UI declarativa; coberto no e2e T11 — AD-007/AD-014).
- **Traces**: M23-10, M23-11.
- **Gate**: typecheck ✓, lint ✓.

## T9 — Front: `/profile` — username editável

- **What**: campo de username no perfil.
- **Where**: `packages/web/src/pages/profile/ProfilePage.tsx`, `pages/profile/validation.ts` (usa `validateUsername`).
- **Depends on**: T6, T7.
- **Reuses**: o campo de nome como molde; `useUpdateProfile`; `validateUsername` (importado de `pages/auth/validation`).
- **Done when**: campo username editável espelhando o de nome; e-mail segue read-only; sucesso reflete
  no menu/avatar via cache; conflito (409) → banner de erro da página.
- **Tests**: none (coberto por T5 no backend + smoke no e2e).
- **Traces**: M23-14.
- **Gate**: typecheck ✓, lint ✓.

## T10 — Front: `@username` no `AccountMenu`

- **What**: mostrar o handle no dropdown.
- **Where**: `packages/web/src/components/AccountMenu.tsx` (ou onde o dropdown renderiza nome/e-mail).
- **Depends on**: T1.
- **Reuses**: o `AuthUser` do cache `['auth','me']` (já traz `username` via T3/mapper).
- **Done when**: dropdown mostra `@username` abaixo do nome.
- **Tests**: none (coberto no e2e/smoke).
- **Traces**: M23-15.
- **Gate**: typecheck ✓, lint ✓.

## T11 — e2e + gate final do milestone

- **What**: fluxo ponta-a-ponta dos dois modos de login + atualização dos specs existentes.
- **Where**: specs Playwright de auth em `packages/web/e2e` (atualizar login/cadastro; add caso username).
- **Depends on**: T4, T5, T8, T9, T10.
- **Reuses**: helpers de e2e existentes.
- **Done when**:
  - Fluxo: cadastro com username → logout → **login por username** → logout → **login por e-mail**.
  - Specs de login/cadastro existentes atualizados pro novo campo/label (sem regressão).
  - Gate final: `pnpm -r typecheck` ✓, `pnpm -r lint` ✓, unit api ✓, unit web ✓, `pnpm test:e2e` ✓.
- **Tests**: e2e (username + e-mail).
- **Traces**: M23-18 + fechamento de M23-10..M23-15.
- **Gate**: tríade completa + e2e ✓.

---

## Definition of Done (milestone)

- 18 requisitos (M23-01..M23-18) implementados; M23-19 conscientemente fora.
- Commits atômicos `feat(m23)`/`test(m23)`, um por task.
- Gates verdes: typecheck, lint, unit api, unit web, e2e.
- Sem backfill na migration (C3); confirmar `User` vazio antes de aplicar.
- Review AD-013 em chat separado antes de marcar "concluído".
