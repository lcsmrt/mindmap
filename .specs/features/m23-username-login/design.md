# M23 — Design

> Design **não** pulado (Large: full-stack, mexe em tenancy/identidade, renomeio de DTO com ripple,
> nova regra de conflito). Sem infra nova. Gray areas: [context.md](./context.md).

## Princípio-guia

**Username é o gêmeo do e-mail.** Coluna única, normalizada (lowercase) na entrada pelo mesmo padrão do
`EmailField`, buscada por `findUnique`. O login vira uma escolha de coluna, não um mecanismo novo. Nada
de tabela nova, nada de índice especial — só mais um campo único no `User`.

## Modelo de dados

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique          // novo (lowercase, M23-01)
  passwordHash String   @map("password_hash")
  name         String
  // …resto inalterado
}
```

- Migration `add_user_username`. **Sem backfill** (tabela vazia, C3). Coluna `NOT NULL UNIQUE` aplica
  limpa; se o `dev_mindmap` tiver linhas, reset ([[feedback-shared-dev-db-destructive]]).
- Sem `citext` / índice funcional: unicidade é sobre o valor já-minúsculo (lowercase-only, C2).

## Normalização & formato — `UsernameField` (zod, `routes/auth.ts`)

Espelha o `EmailField` existente (`z.string().trim().toLowerCase().pipe(z.email())`):

```ts
const UsernameField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().min(1).max(39).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
```

- `^[a-z0-9]+(?:-[a-z0-9]+)*$` = segmentos alfanuméricos separados por **um** hífen ⇒ barra
  início/fim com hífen **e** hífens consecutivos (mais fiel ao GitHub que o rascunho da discuss).
- `toLowerCase()` antes do `regex` ⇒ um input `LucasMrt` é aceito e gravado `lucasmrt` (não rejeitado).
- Reusado por `SignupBodySchema`, `UpdateProfileBody` e, no client, pelo `validateUsername` (regra
  duplicada de propósito no front — AD-028 mantém validação client-side manual, sem zod).

## Login — resolução por identifier (M23-04/05)

`LoginBody.email` → `identifier`. Schema: `identifier: z.string().trim().toLowerCase().min(1)` (não
valida como e-mail — pode ser username; lowercar é seguro pros dois).

```ts
const login = req.body.identifier;
const user = login.includes('@')
  ? await prisma.user.findUnique({ where: { email: login } })
  : await prisma.user.findUnique({ where: { username: login } });

const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
if (!user || !passwordOk) throw new UnauthorizedError('Invalid credentials');
```

- Mantém o `DUMMY_PASSWORD_HASH` (timing) e o `401` genérico — não revela se o campo era e-mail ou
  username, nem se existe.
- `includes('@')` é suficiente: username nunca contém `@` (regex proíbe), e-mail sempre contém.

## Signup — criar com username + conflito específico (M23-06/07)

`SignupBodySchema` ganha `username: UsernameField`. O `create` pode violar **dois** `@unique`; o handler
global só sabe dizer `409 "Conflict"` genérico (`app.ts:34`). Pra mensagem específica, o handler do
signup captura o `P2002` e lê `err.meta.target`:

```ts
try {
  // …prisma.$transaction(create + adoção de mapas órfãos, inalterado)
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = err.meta?.target as string[] | string | undefined;
    const field = Array.isArray(target) ? target.join(',') : String(target ?? '');
    if (field.includes('email')) throw new ConflictError('E-mail já cadastrado');
    if (field.includes('username')) throw new ConflictError('Nome de usuário já em uso');
  }
  throw err;
}
```

- `ConflictError` (409) **já existe** (`src/errors.ts:19`) — sem subclasse nova.
- Fallback (`throw err`) preserva o comportamento global pra qualquer outro P2002.
- Mesma tática reusada no `PATCH /auth/me` (só o ramo `username`).

## Contrato & mapper (M23-08)

```ts
// @mindmap/shared
interface AuthUser { id: string; email: string; username: string; name: string }
interface SignupBody { email; username; password; name; remember? }
interface LoginBody  { identifier; password; remember? }        // era { email; … }
interface UpdateProfileBody { name?; username? }
```

`toAuthUser` (`mappers/users.ts`) passa a incluir `username`. Nunca expõe `passwordHash` (inalterado).

## Perfil — `PATCH /auth/me` (M23-09)

`UpdateProfileBodySchema` ganha `username: UsernameField.optional()`. O update aplica; conflito de
username → `409` via o mesmo tratamento de `P2002`/`meta.target` (ramo username). Escopado por
`req.user.id` (inalterado, M20).

## Frontend

### Camada de API (`api/auth.ts`) — M23-12
- `login` envia `{ identifier, password, remember }` (era `email`).
- `signup` envia `{ …, username }`.
- `useUpdateProfile` já existe (M20) — passa `username` quando presente; segue atualizando o cache
  `['auth','me']`.

### Validação client-side (`pages/auth/validation.ts`) — M23-13
`validateUsername(value)` no padrão manual (AD-028): não-vazio, `≤ 39`, regex
`^[a-z0-9]+(?:-[a-z0-9]+)*$` (após `trim().toLowerCase()`), mensagens em pt-BR. **Fonte única**:
o `ProfilePage` importa daqui (função pura, não componente — ok cruzar de página).
`validateAuth` passa a cobrir `username` no modo cadastro. No login, o campo identifier valida só
**não-vazio** (sem `isValidEmail`).

### `AuthPage.tsx` — M23-10/11
- **Cadastro:** novo `AuthField` "Usuário" entre Nome e E-mail (`autocomplete="username"`), erro inline.
- **Login:** o `AuthField` de e-mail vira label "Usuário ou e-mail", `type="text"`,
  `autocomplete="username"`, placeholder tipo `voce@exemplo.com ou seu-usuario`. Estado interno
  `email` → `identifier`; envia `identifier` no login e `email` separado só no cadastro.

### `ProfilePage.tsx` — M23-14
Campo username editável espelhando o de nome (usa `validateUsername`); e-mail segue read-only. Sucesso
reflete no avatar/menu via cache. Conflito → banner de erro (reusa o padrão de erro da página).

### `AccountMenu` — M23-15
Dropdown mostra `@${user.username}` abaixo do nome (o `AuthUser` do cache já traz `username`).

## Testes

- **api unit** (`routes/auth.test.ts`): signup grava username; login por e-mail (regressão) e por
  username; e-mail duplicado → 409 "E-mail já cadastrado"; username duplicado → 409 "Nome de usuário
  já em uso"; formato inválido no signup → 400; login com username inexistente → 401 (dummy hash);
  `PATCH /auth/me` troca username e barra duplicado (409). Ajustar os testes de login existentes
  (`email` → `identifier`).
- **web unit** (`pages/auth/validation.test.ts` + `api/auth.test.ts`): `validateUsername`
  (válidos: `ab`, `a-b-c`, 39 chars; inválidos: vazio, `-x`, `x-`, `a--b`, `A`→vira `a` ok,
  `x_y`, 40 chars); hooks enviam `identifier`/`username`.
- **e2e** (`e2e/…`): cadastro com username → logout → login **por username** → logout → login
  **por e-mail**. Atualizar os specs de login/cadastro existentes pro novo campo/label.

## Riscos / notas

- **Ripple do rename `email` → `identifier`:** toca `@mindmap/shared`, schema+handler de login,
  `api/auth.ts`, `AuthPage`, e specs e2e. O typecheck do monorepo pega os pontos esquecidos (o campo
  some do tipo). Fazer numa task só (T4) pra o commit ser coerente.
- **`autocomplete`:** campo combinado usa `autocomplete="username"` (browsers casam e-mail e usuário);
  no cadastro, e-mail volta a `autocomplete="email"`.
- **`meta.target` do Prisma:** o formato (array de colunas) é estável no Postgres, mas o código trata
  array **e** string por robustez. Se um dia mudar, o fallback `throw err` degrada pro 409 genérico —
  não quebra, só perde a mensagem específica.
- **Nota pra M22 (Google OAuth):** username obrigatório vira invariante; a criação via OAuth precisará
  **gerar** (ex.: do local-part do e-mail, sanitizado + sufixo numérico em colisão) ou **pedir** um
  username. O gerador não entra aqui (C3) — é peça do M22. A edição no `/profile` (M23-14) é o escape.
