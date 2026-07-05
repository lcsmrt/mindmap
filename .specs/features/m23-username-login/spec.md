# M23 — Login por username (estilo GitHub) — Spec

> Etapa do lote de autenticação (AD-025), **não** prevista nas 5 originais — surgiu do uso.
> Depende de M18 (núcleo backend), M19 (tela/guarda) e M20 (`/profile`, `PATCH /auth/me`).
> Full-stack, **sem infra nova**. **Executa antes do M22 (Google OAuth)** — ver ordem em
> [context.md](./context.md) C7. Planejamento apenas; execução em chat separado
> ([[feedback-plan-execute-split]]).
>
> Gray areas resolvidas em [context.md](./context.md); arquitetura em [design.md](./design.md);
> quebra em [tasks.md](./tasks.md).

## Objetivo

Permitir login por **username OU e-mail** no mesmo campo (modelo GitHub) e tornar o username uma
identidade de primeira classe: obrigatório e único para todo usuário, definido no signup e editável
no perfil. Hoje o `User` só tem `email` (único) e `name` (display, não-único) — não há username.

## Fluxo (happy path)

1. No **cadastro**, além de nome/e-mail/senha, escolhe um **usuário** (validado ao vivo).
2. No **login**, digita **usuário ou e-mail** num único campo + senha → entra.
3. O backend resolve o campo: contém `@` ⇒ busca por e-mail; senão ⇒ busca por username.
4. No **`/profile`**, pode trocar o username (mesma regra de formato/unicidade).
5. O **menu de conta** mostra `@username` abaixo do nome.

## Requisitos

### Dados & normalização (backend)

- **M23-01** — `User` ganha `username String @unique`. Migration `add_user_username`. **Sem backfill**
  (tabela vazia; se o `dev_mindmap` tiver linhas de teste, reset — banco descartável).
- **M23-02** — Formato do username (subset do GitHub): 1–39 chars, minúsculo, alfanumérico com
  hífens **internos** e **não** consecutivos, sem hífen no início/fim.
  Regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$` + `min(1).max(39)`. *(Refina o rascunho da fase discuss —
  a forma por segmentos também barra hífens consecutivos, mais fiel ao GitHub. Ver design.)*
- **M23-03** — Normalização: `UsernameField` faz `trim().toLowerCase()` na entrada e valida o formato,
  espelhando o `EmailField`. Aplicado no signup e no update de perfil. Armazenado minúsculo.

### Login

- **M23-04** — DTO `LoginBody.email` → **`identifier`** (aceita e-mail **ou** username). Renomeio
  propaga em `@mindmap/shared`, schema zod, handler, frontend e e2e.
- **M23-05** — Handler de login resolve o `identifier`: `identifier.includes('@')` ⇒
  `findUnique({ email })`, senão ⇒ `findUnique({ username })`. Mantém a proteção de timing
  (`DUMMY_PASSWORD_HASH` quando não acha), e a resposta genérica `401` (não vaza qual campo falhou).

### Signup

- **M23-06** — `SignupBody` ganha `username` (obrigatório). O handler cria o usuário com o username.
- **M23-07** — Conflito de unicidade no signup **distingue o campo**: e-mail já em uso vs usuário já
  em uso, com mensagem específica (`409`). Hoje o handler global mapeia `P2002` → `409 "Conflict"`
  genérico; com dois campos únicos isso fica ambíguo — o handler do signup inspeciona `err.meta.target`.

### Contrato & perfil

- **M23-08** — `AuthUser` ganha `username`; `toAuthUser` inclui. Reflete no cache `['auth','me']` do
  front (avatar/menu/perfil leem sem reload).
- **M23-09** — `UpdateProfileBody` ganha `username?`. `PATCH /auth/me` valida formato + unicidade e
  atualiza; conflito de username → `409` (mensagem específica, mesmo tratamento do signup).

### Telas (frontend)

- **M23-10** — Cadastro no `AuthPage` ganha campo **"Usuário"** com validação inline (`validateUsername`),
  posicionado entre Nome e E-mail.
- **M23-11** — Login no `AuthPage`: o campo de e-mail vira **"Usuário ou e-mail"** (identifier). A
  validação relaxa (só **não-vazio**; sem checagem de formato de e-mail, já que pode ser username).
  `autocomplete="username"`.
- **M23-12** — `api/auth.ts`: login envia `identifier`; signup envia `username`.
- **M23-13** — `validateUsername` no padrão manual (AD-028 — sem zod no client), **fonte única**
  reusada por cadastro e perfil.
- **M23-14** — `/profile` ganha campo **username editável** (espelha o de nome); `useUpdateProfile`
  já sincroniza o cache `['auth','me']`. Conflito → banner de erro.
- **M23-15** — Dropdown do `AccountMenu` mostra **`@username`** abaixo do nome.

### Testes

- **M23-16** — Unit api (`auth.test.ts`): signup exige e grava username; login por e-mail (regressão)
  **e** por username; e-mail duplicado → `409` específico; username duplicado → `409` específico;
  formato inválido → `400`; username inexistente no login → `401` (timing/dummy hash); `PATCH /auth/me`
  troca username e barra duplicado (`409`).
- **M23-17** — Unit web: `validateUsername` (válidos/limites/inválidos); hooks enviam
  `identifier`/`username` corretos.
- **M23-18** — e2e (Playwright): cadastro com username → logout → **login por username** → logout →
  **login por e-mail**. Atualizar os specs existentes de login/cadastro pro novo campo.

## Fora de escopo

- **M23-19** — **Google OAuth (M22)** vem depois; a criação de conta via OAuth vai precisar
  **gerar/pedir** username (o provedor dá e-mail + nome, não handle) — nota de design pra M22.
  **Reserved usernames** (admin/api/root…) fora (ferramenta single-user). **Preservar case de
  exibição** fora (lowercase-only, C2). Trocar o **e-mail** da conta continua fora. Rename com
  histórico/redirect de username antigo — fora.
