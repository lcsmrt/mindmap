# M21 — Reset de senha por e-mail — Tasks

> Backend (`packages/api`) + frontend (`packages/web`) + `@mindmap/shared` + infra de e-mail.
> Cada task = 1 commit atômico `feat(m21)`/`test(m21)`/`chore(m21)`. Rastreabilidade → `spec.md`
> (M21-NN). Gray areas → `context.md`. Arquitetura → `design.md`. Executar em chat separado
> ([[feedback-plan-execute-split]]).
>
> **Ganchos-chave (do design):** token de reset espelha `services/sessions.ts` (sha256 + expiração,
> single-use = delete-on-consume); e-mail via **nodemailer + SMTP por env** (sem SMTP → console, dev);
> endpoints no `authPlugin` existente (prefixo `/auth`); **sem auto-login** (volta pro `/login`);
> flag `logoutOtherDevices` default `true`.

**Grafo de dependências:**

```
T1 (shared DTOs)          [P] ─────────────────────────┬──────────────→ T6 (front API/hooks) ─┬─→ T7 (ForgotPage) ─┐
T2 (Prisma model+migration)[P] ─→ T3 (token service) ──┐                                       └─→ T8 (ResetPage) ──┼─→ T9 (e2e + gate)
T4 (email service+env+dep) [P] ────────────────────────┴─→ T5 (endpoints + api tests) ─────────────────────────────┘
```

- **T1**, **T2**, **T4** são paralelos `[P]` (áreas disjuntas).
- **T3** precisa do modelo (T2). **T5** precisa de T1 (DTOs) + T3 (token) + T4 (e-mail).
- **T6** precisa de T1. **T7**/**T8** precisam de T6. **T9** precisa de tudo (T5 + T7 + T8).

---

## T1 — Shared: DTOs `ForgotPasswordBody` / `ResetPasswordBody` `[P]`

- **What**: contratos compartilhados dos dois endpoints.
- **Where**: `packages/shared/src/auth.ts` (add interfaces + export).
- **Depends on**: —
- **Reuses**: padrão dos DTOs existentes (`SignupBody`/`UpdateProfileBody`).
- **Done when**: `ForgotPasswordBody { email }` e `ResetPasswordBody { token; password; logoutOtherDevices? }`
  exportados de `@mindmap/shared`.
- **Tests**: none (só tipos).
- **Traces**: M21-18.
- **Gate**: `pnpm -r typecheck` ✓.

## T2 — Backend: modelo `PasswordResetToken` + migration `[P]`

- **What**: tabela do token de reset, espelhando `Session`.
- **Where**: `packages/api/prisma/schema.prisma` (modelo + relação inversa em `User`),
  migration `add_password_reset_token`.
- **Depends on**: —
- **Reuses**: shape/anotações do `Session` (`tokenHash @unique`, `@map`, `@@index([userId])`,
  `onDelete: Cascade`).
- **Done when**:
  - Modelo `PasswordResetToken` (`id`, `tokenHash` único, `userId`, `expiresAt`, `createdAt`) criado.
  - `User.resetTokens PasswordResetToken[]` adicionado.
  - Migration aplicada; `prisma generate` ok.
- **Tests**: none (schema).
- **Traces**: M21-01.
- **Gate**: typecheck ✓; migration roda limpa num banco vazio.

## T3 — Backend: serviço de token `services/password-reset.ts`

- **What**: criação/validação/consumo do token de reset.
- **Where**: `packages/api/src/services/password-reset.ts` (novo), `services/password-reset.test.ts` (novo).
- **Depends on**: T2.
- **Reuses**: `services/sessions.ts` como molde (`randomBytes(32).base64url`, `sha256`, expiração);
  `prisma`.
- **Done when**:
  - `createPasswordResetToken(userId)`: **apaga tokens anteriores** do user, cria novo (TTL 60 min),
    retorna o token cru.
  - `findValidResetToken(token)`: `null` se ausente; se expirado, apaga e retorna `null`; senão `{ id, userId }`.
  - Uso único garantido pelo consumo (delete) — feito na transação do T5.
- **Tests**: unit (vitest, DB de teste) — cria e valida; expirado retorna `null` e some; novo pedido
  invalida o anterior.
- **Traces**: M21-01, M21-03.
- **Gate**: typecheck ✓, lint ✓, unit api ✓.

## T4 — Backend: serviço de e-mail + env + dep `[P]`

- **What**: envio de e-mail provider-agnóstico (nodemailer/SMTP por env; console em dev) + env novas.
- **Where**: `packages/api/src/services/email.ts` (novo), `packages/api/src/env.ts` (add vars),
  `package.json` (dep `nodemailer` + dev `@types/nodemailer`), `.env.example`, `.env.production.example`,
  `docker-compose.yml` (passar `SMTP_*`/`APP_URL`).
- **Depends on**: —
- **Reuses**: padrão do `env.ts` (leitura + default); `NODE_ENV` pro captador de test seam.
- **Done when**:
  - `buildTransport()`: com `SMTP_HOST` → transport SMTP; sem → transport console que loga `to`/`url`.
  - `sendPasswordResetEmail(to, resetUrl)` monta e envia (from `SMTP_FROM`, link no corpo).
  - Env `APP_URL`/`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` — **opcionais**, ausência
    **não** derruba o boot.
  - Em `NODE_ENV=test`, guarda o último `{ to, resetUrl }` em memória (pro seam do T9).
- **Tests**: unit leve — sem `SMTP_HOST` usa o transporte console (não lança); captador registra o último envio.
- **Traces**: M21-09, M21-10.
- **Gate**: typecheck ✓, lint ✓, unit api ✓.

## T5 — Backend: endpoints `forgot`/`validate`/`reset` + testes

- **What**: as três rotas no `authPlugin`, com neutralidade, single-use e flag de sessões.
- **Where**: `packages/api/src/routes/auth.ts` (add rotas + schemas zod), `routes/auth.test.ts` (add casos).
  Rota test-only `GET /auth/__test/last-reset` **só quando `NODE_ENV==='test'`**.
- **Depends on**: T1, T3, T4.
- **Reuses**: `authPlugin`, `EmailField`, `hashPassword` (`lib/password.js`), `prisma.$transaction`,
  error handler global; padrão `satisfies z.ZodType<…>`.
- **Done when**:
  - `POST /auth/forgot-password` → **`204` sempre**; user existe ⇒ `createPasswordResetToken` +
    `sendPasswordResetEmail` (try/catch, não vira 500); user não existe ⇒ nada. Resposta idêntica (M21-02/04).
  - `GET /auth/reset-password/validate?token` → `204`/`400`, sem consumir (M21-05).
  - `POST /auth/reset-password` → transação: troca `passwordHash`, deleta o token (single-use),
    `logoutOtherDevices ?? true` ⇒ `session.deleteMany({ userId })`; `204`. Token inválido/expirado/usado
    ou senha < 8 → `400` (M21-06/07/08).
  - Rota `__test/last-reset` inexistente fora de `NODE_ENV=test`.
- **Tests**: unit `auth.test.ts` — 204 neutro (existe/não existe), token só pro existente (mock do e-mail),
  single-use (2º reset → 400), expirado → 400, flag true zera sessões / false preserva, senha curta → 400,
  novo pedido invalida token anterior. Mock `services/email` via `vi.mock`.
- **Traces**: M21-02, M21-03, M21-04, M21-05, M21-06, M21-07, M21-08, M21-19.
- **Gate**: typecheck ✓, lint ✓, unit api ✓.

## T6 — Front: camada de API + hooks

- **What**: requests + hooks/query dos três endpoints.
- **Where**: `packages/web/src/api/auth.ts` (add), `src/api/auth.test.ts` (add casos).
- **Depends on**: T1.
- **Reuses**: `request` de `_request.js`; `MutationOptions`; `useMutation`/`useQuery`;
  DTOs de `@mindmap/shared`.
- **Done when**:
  - `useForgotPassword` → `POST /api/auth/forgot-password`.
  - `useResetPassword` → `POST /api/auth/reset-password`.
  - `useValidateResetToken(token)` → query `GET …/validate?token` com `enabled: !!token`.
- **Tests**: unit `auth.test.ts` — cada hook chama o endpoint/método certo; erro propaga (mock `request`).
- **Traces**: M21-13 (validate), suporte a M21-12/14/16.
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T7 — Front: `/forgot-password` + link no login

- **What**: tela "Recuperar acesso" (estado form + estado neutro enviado) e o link "Esqueci a senha".
- **Where**: `packages/web/src/pages/auth/ForgotPasswordPage.tsx` (novo), `App.tsx` (rota sob
  `RedirectIfAuthed`), `pages/auth/AuthPage.tsx` (link no modo *entrar*), `pages/auth/validation.ts`
  (regra de e-mail, se necessário).
- **Depends on**: T6.
- **Reuses**: shell visual do `AuthPage` (`BrandMark`, card, `AuthField`, `ErrorBanner`, `Button`);
  `resolveReturnTo`/react-router.
- **Done when**:
  - Link "Esqueci a senha" visível no modo *entrar* → `/forgot-password` (M21-11).
  - `/forgot-password`: e-mail → `useForgotPassword` → **estado neutro** de confirmação + "Voltar para
    entrar" (M21-12). Erro de rede não vaza existência (mensagem neutra mantida).
- **Tests**: none (UI declarativa; coberto no e2e do T9 — AD-007/AD-014).
- **Traces**: M21-11, M21-12, M21-17.
- **Gate**: typecheck ✓, lint ✓.

## T8 — Front: `/reset-password` (validar token + nova senha)

- **What**: página aberta pelo link — valida token, form de nova senha + confirmação + flag, sucesso → login.
- **Where**: `packages/web/src/pages/auth/ResetPasswordPage.tsx` (novo), `App.tsx` (rota pública),
  `pages/auth/validation.ts` (+ `validateResetPassword`), `pages/auth/validation.test.ts` (add),
  `AuthPage.tsx` (banner de sucesso via `location.state.resetSuccess`).
- **Depends on**: T6.
- **Reuses**: `PasswordField`, `Checkbox`, `ErrorBanner`, shell do card; `useSearchParams`.
- **Done when**:
  - Lê `?token`; `useValidateResetToken` decide: validando → splash; inválido/expirado → mensagem +
    link pra `/forgot-password`, **sem** form (M21-13).
  - Válido → form: nova senha + confirmar (precisam bater, `validateResetPassword`) + checkbox
    "Desconectar de outros dispositivos" **marcado por padrão** → `useResetPassword({ …, logoutOtherDevices })`
    (M21-14/15).
  - Sucesso → `navigate('/login', { state: { resetSuccess: true } })`; login mostra banner de sucesso (M21-16).
- **Tests**: unit `validation.test.ts` — `validateResetPassword` (match + tamanho). Resto no e2e (T9).
- **Traces**: M21-13, M21-14, M21-15, M21-16, M21-17.
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T9 — e2e happy path + gate final do milestone

- **What**: spec Playwright do fluxo ponta-a-ponta usando o test seam; rodar a tríade completa.
- **Where**: `packages/web/e2e/password-reset.spec.ts` (novo).
- **Depends on**: T5, T7, T8.
- **Reuses**: helpers de e2e existentes; a rota `GET /auth/__test/last-reset` (T5) pra capturar o link.
- **Done when**:
  - Fluxo: cria conta → logout → `/login` → "Esqueci a senha" → envia e-mail → confirmação neutra →
    lê `resetUrl` do seam → abre `/reset-password?token` → nova senha → redireciona pro `/login` com
    aviso de sucesso → loga com a **nova** senha.
  - Extra: token inválido mostra o estado de erro (sem form).
  - Gate final: `pnpm -r typecheck` ✓, `pnpm -r lint` ✓, unit api ✓, unit web ✓, `pnpm test:e2e` ✓
    (M21 verde + suíte anterior sem regressão).
- **Tests**: e2e `password-reset.spec.ts` (happy path + token inválido).
- **Traces**: M21-20 + fechamento de M21-11..M21-17.
- **Gate**: tríade completa + e2e ✓.

---

## Definition of Done (milestone)

- 21 requisitos (M21-01..M21-21) implementados ou conscientemente fora (M21-21 é out-of-scope).
- Commits atômicos `feat(m21)`/`test(m21)`/`chore(m21)`, um por task.
- Gates verdes: typecheck, lint, unit api, unit web, e2e.
- `.env.example`/`.env.production.example` atualizados; nota no deploy sobre setar `SMTP_*`/`APP_URL` no Portainer.
- Review AD-013 em chat separado antes de marcar "concluído".

---

## Execução (2026-07-05) — ✅ todas as tasks, gates verdes

Commits atômicos, um por task (todos `feat(m21)`/`test(m21)`):

| Task | Commit | Notas |
|---|---|---|
| T1 | `d98627f` | DTOs `ForgotPasswordBody`/`ResetPasswordBody` em `@mindmap/shared`. |
| T2 | `c7b8d23` | Modelo `PasswordResetToken` + migration `add_password_reset_token` (aplicada no dev_mindmap). |
| T3 | `736e3de` | `services/password-reset.ts` + `consumeResetToken`; 6 unit tests. |
| T4 | `57f1091` | `services/email.ts` (nodemailer/SMTP por env; console sem SMTP) + envs + dep; captor do seam. |
| T5 | `16bfafd` | 3 rotas no `authPlugin` + seam `__test/last-reset` (só `NODE_ENV=test`); auth.test.ts estendido. |
| T6 | `7071b6e` | Hooks `useForgotPassword`/`useResetPassword`/`useValidateResetToken` (query retorna `true`/erro). |
| T7 | `c5a54de` | `/forgot-password` + `AuthShell` (reuso do card) + link no login; `isValidEmail` exportado. |
| T8 | `694a723` | `/reset-password` (splash/inválido/form) + banner de sucesso no login; `validateResetPassword`. |
| T9 | `7287732` | e2e `password-reset.spec.ts` (happy path + token inválido); `NODE_ENV=test` no api do playwright. |

**Desvios do plano — levantados e resolvidos num passo de ajustes (2026-07-05):**
- **Erro 400:** virou `BadRequestError` em `errors.ts` (segue o padrão das outras subclasses de
  `ApiError`); a rota `reset` usa. ✅
- **`/validate`:** deixou de ser `204`/`400` + sentinela `true`; agora é `GET 200 { valid: boolean }`
  (verdict como dado — revisa M21-05). `useValidateResetToken` expõe `data.valid` direto, sem
  sentinela nem erro-como-fluxo. ✅ (ver AD-030)
- **`AuthShell`:** ganhou slot `footer` e o `AuthPage` (M19) foi migrado pra usá-lo — **uma única**
  representação da casca entre as três telas de auth. ✅

**Gates finais:** `pnpm -r typecheck` ✓, `pnpm -r lint` ✓, unit api 124 ✓, unit web 162 ✓,
`pnpm test:e2e` 47 ✓ (M21 verde + suíte anterior sem regressão).

**Pendente:** Review AD-013 (chat separado) antes de marcar o milestone como "concluído" no STATE/ROADMAP.
