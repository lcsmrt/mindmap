# M20 — Contexto (decisões do usuário)

Decisões tomadas na fase *discuss* do spec (chat de planejamento, 2026-07-05). Registram as escolhas em áreas cinzentas que não têm design mockado.

## Escopo fatiado (decidido antes do spec)

- **Tema claro/escuro FORA do M20** (2026-07-05). Não implementar; vira milestone/quick task própria. Some do dropdown.
- **Consolidar o header** entrou no M20 (2026-07-05): hoje há dois `<header>` inline divergentes (`HomePage.tsx` com branding + "Sair" provisório; `MapPage.tsx` com voltar + título, sem Sair). Vira um header compartilhado que leva o menu de conta às duas telas.

## Áreas cinzentas resolvidas

| # | Pergunta | Decisão | Razão |
|---|----------|---------|-------|
| 1 | Ao clicar "Perfil", o que abre pra editar nome? | **Página dedicada `/profile`** | O usuário quer que ela cresça no futuro (mais campos/opções). Vale a rota nova apesar de hoje editar só o nome. |
| 2 | O que o Perfil edita/mostra? | **Nome editável + e-mail read-only** | Mostra o e-mail como identidade; trocar e-mail exige re-auth/verificação → fora do M20. |
| 3 | Item "Ajuda" do header do design entra? | **Adiar (fora do M20)** | Mantém o M20 enxuto; "Ajuda & atalhos" já estava marcado como mínimo/deferred no ROADMAP. |

## Fatos do código/design levantados no planejamento

- **Avatar = monograma de iniciais** (sem upload de imagem). O design "Meus Mapas v3" mostra um quadrado 32px com iniciais ("EU") no header; o model `User` (Prisma) **não tem campo de imagem** (`id`, `email`, `passwordHash`, `name`, timestamps).
- **Backend de auth existente:** `GET /auth/me` → `AuthUser {id,email,name}`; `POST /auth/logout` já existe (usado pelo `useLogout`). Editar nome precisa de **endpoint novo** (decisão de rota fica pro design: `PATCH /auth/me` vs. rota de perfil).
- **Front:** `useSession()` (`src/api/auth.ts`) já entrega o user atual via `fetchMe`. O "Sair" já existe inline na Home (`HomePage.tsx`, marcado `{/* Provisório até o menu de conta do M20 */}`) — parte do M20 é **migrar** pro dropdown, não código novo.
- **Divergência intencional do design:** o design "Estudo de Nós" (mapa) não tem avatar no header; levar o menu de conta pra lá foi pedido explícito do usuário (consistência entre telas).
- **Sem design do dropdown aberto nem da página de Perfil** — UI nova, definida no design do M20.
- **Rotas atuais:** `/login` (fora da guarda), `/`, `/maps/:id` (sob `RequireAuth`). `/profile` entra sob `RequireAuth`.
