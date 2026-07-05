# M23 — Context (gray areas resolvidas)

Decisões do usuário na fase *discuss* do planejamento (2026-07-05).

## C1 — Username obrigatório (não opcional)

**Decisão:** todo usuário tem username **único e obrigatório** (modelo GitHub); o signup passa a exigir.

**Por quê:** o usuário pediu "similar ao que o GitHub faz". Username como identidade de 1ª classe
(não um extra opcional) mantém a UX consistente e simplifica o login por identifier. A alternativa
(opcional, login só quando definido) foi preterida — menos consistente e ainda exigiria toda a
superfície de validação/unicidade.

## C2 — Case: lowercase-only

**Decisão:** username **armazenado minúsculo**; normaliza `trim().toLowerCase()` na entrada, igual ao
`EmailField` de hoje.

**Por quê:** unicidade trivial (sem `citext`/índice funcional/coluna normalizada) e coerente com o
e-mail. Preservar o case de exibição (GitHub-exato, unicidade case-insensitive) foi preterido — ganho
cosmético que não paga a complexidade de normalização no Postgres numa ferramenta pessoal.

## C3 — Sem backfill

**Decisão:** a migration adiciona `username` **required + unique** direto, **sem** etapa de backfill.

**Por quê:** não há usuários ainda ("ainda não tem usuários, relaxa"). Coluna obrigatória numa tabela
vazia aplica limpa. Se o `dev_mindmap` tiver linhas de teste, reset — banco descartável
([[feedback-shared-dev-db-destructive]]). Não vale escrever lógica de derivação de username (do
local-part do e-mail) que nunca rodaria em dado real. *(Nota pra M22: a criação via OAuth **vai**
precisar gerar um username — aí sim entra um gerador; ver spec M23-19.)*

## C4 — Editar username no /profile agora

**Decisão:** a edição de username entra **nesta feature**, no `/profile` (hoje só edita nome).

**Por quê:** fecha o ciclo — sem edição, um username escolhido no signup (ou, no futuro, auto-gerado
via OAuth) ficaria permanente. `PATCH /auth/me` já existe (M20) e é o lugar natural.

## C5 — Login por campo único "usuário ou e-mail"

**Decisão:** um **único** campo no login (identifier), resolvido pelo `@` no backend — não dois campos
separados.

**Por quê:** é exatamente o modelo do GitHub que o usuário citou. Menos fricção; o backend decide a
coluna de busca. Implica renomear `LoginBody.email` → `identifier` (M23-04).

## C6 — @username no menu de conta

**Decisão:** o dropdown do `AccountMenu` mostra **`@username`** abaixo do nome.

**Por quê:** reforça a identidade recém-introduzida a custo trivial (o `AuthUser` já vai carregar o
username via cache).

## C7 — Ordem: M23 antes do M22 (Google OAuth)

**Decisão:** fazer **username (M23) antes** do Google OAuth (M22).

**Por quê:** username obrigatório vira **invariante do `User`**. O fluxo do Google precisa respeitá-lo,
mas o provedor entrega e-mail + nome, **não** um handle — então a criação de conta via OAuth terá que
gerar/pedir username. É mais limpo desenhar esse caminho já sabendo a forma final do `User` do que
construir o OAuth sem username e retrofitar depois. Além disso, o M23 já entrega o escape que o OAuth
vai usar (edição de username no `/profile`), e é a peça menor e mais self-contained (sem app no Google
Cloud / `@fastify/oauth2` / callback). O Google fica sendo a última peça do lote, contra um `User`
estável. Numeração: fica **M23** (M22 já é o Google em AD-025/ROADMAP; não renumerar), mas executa antes.
