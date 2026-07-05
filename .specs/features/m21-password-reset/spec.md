# M21 — Reset de senha por e-mail — Spec

> 4ª etapa do lote de autenticação (AD-025). Depende de M18 (núcleo backend) e M19
> (tela + guarda no front). Full-stack + **infra nova de e-mail**. Executar em chat
> separado ([[feedback-plan-execute-split]]).
>
> Gray areas resolvidas em [context.md](./context.md); arquitetura em [design.md](./design.md);
> quebra em [tasks.md](./tasks.md).

## Objetivo

Permitir que o usuário recupere o acesso quando esquece a senha, via link enviado por
e-mail, sem vazar quais e-mails têm conta. Fecha o buraco deixado por M19 (o link
"Esqueci a senha" existe no design mas não funciona).

## Fluxo (happy path)

1. Na tela de login, clica **"Esqueci a senha"** → `/forgot-password`.
2. Digita o e-mail → **"Enviar link de acesso"**.
3. Vê confirmação **neutra** ("Se existe uma conta com esse e-mail, enviamos um link")
   — a mesma mensagem independente de a conta existir.
4. Recebe e-mail com link `…/reset-password?token=…` (TTL 60 min, uso único).
5. Abre o link → página valida o token → form de **nova senha + confirmação** +
   checkbox **"Desconectar de outros dispositivos"** (marcado por padrão).
6. Confirma → senha trocada → **redireciona pro `/login`** com aviso de sucesso.
7. Loga com a nova senha.

## Requisitos

### Dados & serviços (backend)

- **M21-01** — Modelo `PasswordResetToken` (`tokenHash` sha256 único, `userId`, `expiresAt`),
  espelhando o padrão de `Session`. Token de uso único (consumido = deletado).
- **M21-02** — `POST /auth/forgot-password` responde **sempre `204`** (neutro), independente
  de a conta existir.
- **M21-03** — Para conta existente: gera token (TTL 60 min) e envia e-mail com o link.
  Uma nova requisição de reset **invalida tokens anteriores** do mesmo usuário (só o último link vale).
- **M21-04** — Para conta inexistente: **nenhum** token/e-mail; resposta idêntica à M21-02
  (não vaza existência da conta — nem por corpo, nem por status).
- **M21-05** — `GET /auth/reset-password/validate?token=…` → `200 { valid: boolean }`. O verdict é
  **dado** (`valid: false` para inválido/expirado), não erro HTTP. **Sem efeito colateral** (não
  consome o token). *(Revisado na execução — AD-030; era `204`/`400`, mas token inválido é uma
  resposta legítima da checagem, não uma falha de request.)*
- **M21-06** — `POST /auth/reset-password` com token válido troca a senha (hash argon2),
  **consome o token** (single-use) e responde `204`.
- **M21-07** — Token inválido / expirado / já usado → `400`. Senha < 8 caracteres → `400`
  (mesma regra do signup, M18).
- **M21-08** — Body do reset aceita `logoutOtherDevices` (**default `true`**): quando `true`,
  apaga **todas** as `Session` do usuário no reset; quando `false`, preserva as sessões existentes.
- **M21-09** — Serviço de e-mail **provider-agnóstico**: nodemailer com SMTP configurado por env.
  Sem SMTP configurado (dev) → transporte que **loga o link no console** (dev não precisa de SMTP real).
- **M21-10** — Env novas: `APP_URL` (base do link), `SMTP_HOST/PORT/USER/PASS`, `SMTP_FROM`.
  Ausência de SMTP **não derruba o boot** (degrada pro console) — diferente de `DATABASE_URL`.

### Contrato compartilhado

- **M21-18** — DTOs `ForgotPasswordBody` (`{ email }`) e `ResetPasswordBody`
  (`{ token; password; logoutOtherDevices? }`) em `@mindmap/shared`, com schema zod no backend.

### Telas (frontend)

- **M21-11** — Link **"Esqueci a senha"** no modo *entrar* do `AuthPage` → navega pra `/forgot-password`.
- **M21-12** — `/forgot-password`: campo de e-mail → envia → estado neutro de confirmação +
  link **"Voltar para entrar"**. Reusa o shell visual do `AuthPage` (BrandMark, card, campos).
- **M21-13** — `/reset-password?token=…`: valida o token no load. Token inválido/expirado →
  mensagem clara + link pra pedir novo (`/forgot-password`), **sem** mostrar o form de senha.
- **M21-14** — Form de nova senha: **senha + confirmação** (precisam bater; validação client-side
  no padrão manual atual — sem zod no client, AD-028). Submit troca a senha.
- **M21-15** — Checkbox **"Desconectar de outros dispositivos"** marcado por padrão → envia
  `logoutOtherDevices` conforme o estado.
- **M21-16** — Sucesso → **redireciona pro `/login`** com aviso de sucesso visível; o usuário
  loga com a nova senha (sem auto-login).
- **M21-17** — Rotas: `/forgot-password` sob `RedirectIfAuthed`; `/reset-password` público
  (funciona logado ou não).

### Testes

- **M21-19** — Unit api cobre: neutralidade da `forgot` (existe vs. não existe), single-use,
  expiração, flag `logoutOtherDevices` (true derruba sessões / false preserva), validações de senha/token,
  e invalidação de tokens anteriores.
- **M21-20** — e2e (Playwright) happy path: forgot → reset → login com a nova senha, usando o
  **test seam** (`NODE_ENV=test` expõe o último link de reset) para capturar o token sem e-mail real.

## Fora de escopo

- **M21-21** — **Rate limiting** da `forgot-password` fica fora (ferramenta single-user; a mensagem
  neutra é a defesa principal contra enumeração). Candidato a hardening futuro (`@fastify/rate-limit`) — deferred.
- Troca de e-mail da conta (só senha). Verificação de e-mail no signup. Notificar por e-mail que a
  senha foi trocada. "Magic link" / login sem senha. Tudo fora — M21 é só recuperação de senha.
