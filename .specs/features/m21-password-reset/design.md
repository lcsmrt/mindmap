# M21 — Design

> Design **não** foi pulado (milestone Large: full-stack + infra nova de e-mail + superfície de
> segurança). Padrões novos: lifecycle de token de reset, serviço de e-mail provider-agnóstico,
> test seam pro e2e. Convenções e decisões de gray area: [context.md](./context.md).

## Princípio-guia

**Espelhar o que M18 já fez.** O token de reset é o gêmeo do `Session`: token opaco de alta entropia,
guardado como `sha256` no banco, com expiração. Reusar o padrão minimiza superfície nova e mantém
consistência. Nada de JWT, nada de token no corpo do e-mail além do opaco.

## Modelo de dados

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique @map("token_hash")
  userId    String   @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("PasswordResetToken")
}
```

- **Uso único = delete-on-consume** (mesmo espírito do `deleteSession`). Sem coluna `usedAt`: um token
  consumido some, e "já usado" é indistinguível de "inválido" → `400` genérico (não vaza estado).
- `onDelete: Cascade` no `User` (deletar conta limpa tokens).
- `User` ganha a relação inversa `resetTokens PasswordResetToken[]`.
- Migration: `add_password_reset_token`.

## Serviço de token — `services/password-reset.ts`

Espelha `services/sessions.ts`. **Self-contained** (tem seu próprio `hashToken`, como o sessions tem):
não refatora M18 pra evitar escopo fora do pedido. *(Dedup de `hashToken`/geração de token num
`lib/token.ts` compartilhado fica como Deferred Idea — melhoria de org sem urgência.)*

```
RESET_TTL_MINUTES = 60

createPasswordResetToken(userId): Promise<string>   // raw token
  → deleteMany({ userId })                           // invalida links anteriores (M21-03)
  → randomBytes(32).base64url  → sha256 → create({ tokenHash, userId, expiresAt })
  → retorna o token cru (só existe aqui e no e-mail)

findValidResetToken(token): Promise<{ id, userId } | null>
  → findUnique({ tokenHash }); null se ausente
  → se expirado: deleteMany + null
  → senão retorna { id, userId }

consumeResetToken(tokenId, tx?)                       // delete dentro da transação do reset
```

## Serviço de e-mail — `services/email.ts` (provider-agnóstico, D1)

```
buildTransport():
  se env.SMTP_HOST definido → nodemailer.createTransport({ host, port, auth:{user,pass}, secure })
  senão (dev)               → transporte "console": loga `[email] to=… url=…` e resolve
                              (dev não precisa de SMTP real — M21-09)

sendPasswordResetEmail(to, resetUrl):
  transport.sendMail({ from: env.SMTP_FROM, to, subject, text/html com o link })
  em NODE_ENV=test → também empurra { to, resetUrl } pro captador em memória (test seam, abaixo)
```

- `resetUrl = ${env.APP_URL}/reset-password?token=${rawToken}`.
- O transporte é **um módulo importável** (não injeção via DI) — as rotas chamam `sendPasswordResetEmail`
  direto; os testes de rota mockam esse módulo (`vi.mock`), sem SMTP real.
- Falha de envio **não** vira `500` na `forgot`: try/catch, loga server-side, responde `204` mesmo assim
  (neutralidade M21-02 acima de tudo).

### Env (`env.ts`)

Novas, **todas opcionais** (degradam, não derrubam o boot — contraste com `DATABASE_URL`):
`APP_URL` (default `http://localhost:5173`), `SMTP_HOST`, `SMTP_PORT` (default 587),
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (default `no-reply@kaos.local`). Atualizar `.env.example`,
`.env.production.example` e passar `SMTP_*`/`APP_URL` no `docker-compose.yml` (definidos no Portainer).

## Endpoints (dentro do `authPlugin`, prefixo `/auth`)

Nenhum plugin/rota-raiz novo — tudo mora no `authPlugin` existente, herda `fastifyCookie` e o
error handler global (Zod inválido → 400; `ApiError` → status).

| Método | Rota | Body/Query | Resposta | Notas |
|---|---|---|---|---|
| POST | `/auth/forgot-password` | `{ email }` | `204` sempre | neutro (M21-02/04). Se user existe: cria token + envia e-mail (try/catch). |
| GET | `/auth/reset-password/validate` | `?token=` | `204` / `400` | pré-valida no load da página; **sem** consumir (M21-05). |
| POST | `/auth/reset-password` | `{ token, password, logoutOtherDevices? }` | `204` / `400` | transação: troca hash + consome token + (flag) apaga sessões. |

**Transação do reset** (`$transaction`):
```
const rec = await findValidResetToken(token)      // fora da tx; null → 400
tx.user.update({ where:{id:rec.userId}, data:{ passwordHash: await hashPassword(password) } })
tx.passwordResetToken.delete({ where:{ id: rec.id } })          // single-use (M21-06)
if (logoutOtherDevices ?? true) tx.session.deleteMany({ where:{ userId: rec.userId } })  // M21-08
→ 204
```
Validação de senha (`min(8)`) no schema zod do body (mesma do signup). `logoutOtherDevices` default
`true` no schema.

## Contrato compartilhado (`@mindmap/shared`)

```ts
export interface ForgotPasswordBody { email: string }
export interface ResetPasswordBody { token: string; password: string; logoutOtherDevices?: boolean }
```
Schemas zod no backend com `satisfies z.ZodType<…>` (padrão M18/M20). `email` reusa o `EmailField`
(`trim().toLowerCase().pipe(z.email())`) já definido em `routes/auth.ts`.

## Frontend

### Camada de API (`api/auth.ts`)
- `forgotPasswordRequest(body)` → `POST /api/auth/forgot-password` → hook `useForgotPassword`.
- `resetPasswordRequest(body)` → `POST /api/auth/reset-password` → hook `useResetPassword`.
- `validateResetTokenRequest(token)` → `GET …/validate?token=` → **query** `useValidateResetToken(token)`
  (`enabled: !!token`), pra pré-validar no load. Reusa `request` de `_request.js` e `MutationOptions`.

### Páginas & rotas (`App.tsx`)
- `/forgot-password` — `pages/auth/ForgotPasswordPage.tsx`, sob `RedirectIfAuthed`. Campo e-mail →
  `useForgotPassword` → troca pro **estado neutro** de confirmação (mesmo componente, dois estados) +
  "Voltar para entrar" (`/login`). Reusa `AuthField`/`ErrorBanner`/`Button`/`BrandMark`/shell do card.
- `/reset-password` — `pages/auth/ResetPasswordPage.tsx`, **público** (sem guarda). Lê `?token=` via
  `useSearchParams`; `useValidateResetToken` decide o estado:
  - *validando* → spinner/splash;
  - *inválido/expirado* → mensagem + link pra `/forgot-password` (M21-13), **sem** form;
  - *válido* → form: `PasswordField` (nova senha) + `PasswordField` (confirmar) + `Checkbox`
    "Desconectar de outros dispositivos" (default checked) → `useResetPassword` →
    `navigate('/login', { state: { resetSuccess: true } })` (M21-16).
- `AuthPage.tsx`: (a) link "Esqueci a senha" no modo *entrar* → `/forgot-password` (M21-11);
  (b) lê `location.state.resetSuccess` e mostra banner de sucesso no login.

### Validação client-side (`pages/auth/validation.ts`)
Estende no padrão manual atual (AD-028 — **sem zod no client**): `validateResetPassword({ password, confirm })`
→ senha ≥ 8 e `password === confirm`. E-mail da `forgot` reusa a regra de e-mail já existente.

## Testes

- **api unit** (`routes/auth.test.ts` estendido + `services/password-reset.test.ts` novo): neutralidade
  (existe vs. não existe → mesmo 204, token só pro existente), single-use (2º reset com o mesmo token → 400),
  expiração (token vencido → 400 e some), flag (`true` zera sessões / `false` preserva), senha curta → 400,
  invalidação de tokens anteriores (novo pedido mata o antigo). E-mail mockado via `vi.mock('services/email')`.
- **web unit** (`api/auth.test.ts` + `pages/auth/validation.test.ts`): hooks chamam os endpoints certos;
  `validateResetPassword` (match/tamanho).
- **e2e** (`e2e/password-reset.spec.ts`, AD-014): happy path forgot → reset → login. **Test seam**:
  em `NODE_ENV=test` o `email.ts` guarda o último `{ to, resetUrl }` em memória, exposto por uma rota
  **test-only** `GET /auth/__test/last-reset` **montada só quando `NODE_ENV==='test'`** (nunca em prod).
  O spec lê o `resetUrl` de lá pra abrir a página de reset — captura o token sem e-mail real.

## Riscos / notas

- **Timing de enumeração:** a `forgot` faz trabalho diferente pra conta existente (hash não; só cria token
  + envia). Pra single-user, timing não é vetor real; a mensagem neutra é a defesa (M21-04). Não vamos
  costurar delay artificial. Registrar em CONCERNS se virar preocupação.
- **Test seam em prod:** a rota `__test` é gated por `NODE_ENV==='test'` no registro — garantir que o build
  de prod nunca roda com `NODE_ENV=test`. Cobrir com uma asserção no teste (rota ausente fora de test).
- **Sem domínio:** o link aponta pro IP (`APP_URL`). Se um dia entrar domínio, é só trocar a env.
