# M19 — Tela de auth + guarda no front — Specification

> Etapa 2 de 5 do lote de Autenticação (ver ROADMAP → "Pós-v1 — Autenticação" e **AD-025**).
> **1ª fatia jogável ponta-a-ponta** (email+senha). Só frontend (`packages/web`); consome o
> contrato pronto do M18. Decisões de HOW em `context.md`.

## Problem Statement

O M18 entregou identidade, sessão e escopo por dono **no backend**, mas o front ainda é o app
single-user: não há tela de login, toda rota é pública e a camada de API sequer envia o cookie de
sessão. Hoje um usuário não tem como se autenticar pela interface — e, com a guarda do M18 ativa,
as telas quebram (401) sem uma sessão. Esta etapa fecha o laço: uma tela para **criar conta /
entrar**, uma **guarda** que protege as rotas do app e faz o bootstrap da sessão, e **logout** —
tornando o produto multi-usuário utilizável de ponta a ponta.

## Goals

- [ ] Tela de auth KAOS com modos **Entrar** e **Criar conta** (email+senha; nome só no cadastro), toggle de olho e "manter conectado".
- [ ] Camada de API de auth (`signup`/`login`/`logout`/`me`) enviando o cookie de sessão em todas as requisições.
- [ ] Estado de sessão no cliente: bootstrap via `/me` no load, usuário atual disponível ao app, invalidação no logout.
- [ ] Guarda de rota: rotas do app exigem sessão; sem ela → redirect pro login com **return-to**; logado que abre o login → Home.
- [ ] Logout acionável (botão temporário no header da Home).
- [ ] Feedback de erro híbrido (validação por campo + banner no card) e estado de loading no submit.
- [ ] Zero mudança de backend/contrato; testes de front verdes; e2e cobrindo o fluxo entrar→app→sair.

## Out of Scope

| Item                                             | Motivo                                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| "Esqueci a senha" / modo recuperar               | M21 — puxa infra de e-mail/SMTP.                            |
| "Continuar com Google" / SSO                     | M22 — `@fastify/oauth2` + app no Google Cloud.             |
| Menu de conta (avatar, dropdown, tema, perfil)   | M20 — no M19 o logout é um botão simples no header.        |
| Footer legal (Termos/Privacidade/Ajuda)          | Sem conteúdo; deferred.                                     |
| Qualquer mudança de backend/schema/contrato      | M18 já entregou o contrato; M19 só consome.                |
| Editar nome / trocar senha logado / excluir conta | Não requisitado; candidato a M20/quick task.               |
| Verificação de e-mail no cadastro                | Sem infra de e-mail até M21; signup entra na hora.         |

---

## User Stories

Fatia jogável mínima = Entrar/Criar conta + guarda + logout. Todas P1 exceto onde marcado.

### P1: Criar conta pela tela ⭐ MVP

**User Story**: Como visitante, quero criar conta com nome, e-mail e senha na tela para passar a usar o app com mapas próprios.

**Acceptance Criteria**:

1. WHEN estou no modo **Criar conta** e submeto nome/e-mail/senha válidos THEN o app SHALL chamar `POST /auth/signup`, e em `201` estabelecer a sessão (usuário atual disponível) e navegar para o destino (return-to ou Home).
2. WHEN o e-mail já existe (`409`) THEN o app SHALL exibir no **banner do card** "Este e-mail já está em uso" e permanecer na tela, sem limpar os campos.
3. WHEN a senha tem menos de 8 caracteres, o e-mail é malformado, ou o nome está vazio THEN o app SHALL barrar o submit com **erro inline no campo** correspondente (validação client-side), sem chamar a API.
4. WHEN o cadastro está em andamento THEN o botão de submit SHALL ficar em estado de loading (desabilitado + label de progresso).

**Independent Test**: preencher cadastro válido → app autenticado na Home; repetir com e-mail já usado → banner 409; senha curta → erro inline sem request.

---

### P1: Entrar ⭐ MVP

**User Story**: Como usuário cadastrado, quero entrar com e-mail e senha para acessar meus mapas.

**Acceptance Criteria**:

1. WHEN submeto e-mail/senha no modo **Entrar** THEN o app SHALL chamar `POST /auth/login` e, em `200`, estabelecer a sessão e navegar para o destino (return-to ou Home).
2. WHEN as credenciais estão erradas (`401`) THEN o app SHALL exibir no banner do card **uma mensagem única** "E-mail ou senha incorretos" (idêntica para e-mail inexistente e senha errada — não vaza existência de conta).
3. WHEN "manter conectado neste dispositivo" está marcado THEN a chamada SHALL enviar `remember: true` (sessão de 30d; senão 7d). O checkbox aparece **só no modo Entrar**.
4. WHEN o login está em andamento THEN o botão SHALL ficar em loading (desabilitado + label).

**Independent Test**: login com senha certa → autenticado; senha errada → banner "E-mail ou senha incorretos"; marcar "manter conectado" → payload com `remember:true`.

---

### P1: Guarda de rota + bootstrap de sessão ⭐ MVP

**User Story**: Como usuário, quero que o app me leve ao login quando não estou autenticado e me devolva ao que eu tentei abrir depois de entrar.

**Acceptance Criteria**:

1. WHEN o app carrega THEN SHALL fazer bootstrap da sessão via `GET /auth/me`, exibindo um estado de carregamento até resolver (sem piscar conteúdo protegido nem a tela de login indevidamente).
2. WHEN uma rota protegida (`/`, `/maps/:id`) é acessada **sem** sessão válida THEN o app SHALL redirecionar para a tela de login, **guardando o destino tentado**.
3. WHEN o login/cadastro conclui com sucesso THEN o app SHALL redirecionar para o **destino guardado** (return-to) ou, na ausência dele, para a Home.
4. WHEN um usuário **já autenticado** acessa a tela de login THEN o app SHALL redirecioná-lo para a Home.
5. WHEN qualquer request do app recebe `401` (sessão expirada/revogada no servidor) THEN o app SHALL tratar como deslogado e cair na guarda (voltar ao login).

**Independent Test**: deslogado abrindo `/maps/abc` → cai no login; após entrar → volta em `/maps/abc`; logado abrindo `/login` → Home.

---

### P1: Sair ⭐ MVP

**User Story**: Como usuário logado, quero sair da conta neste dispositivo.

**Acceptance Criteria**:

1. WHEN aciono "Sair" (botão no header da Home) THEN o app SHALL chamar `POST /auth/logout`, limpar o estado de sessão do cliente e redirecionar para o login.
2. WHEN o logout conclui THEN uma nova tentativa de acessar rota protegida SHALL cair na guarda (deslogado de fato).

**Independent Test**: logar → Sair → cai no login; voltar em `/` manda pro login.

---

### P1: Camada de API envia a sessão ⭐ MVP

**User Story**: (técnica) Como app com guarda de sessão no backend, preciso que toda request envie o cookie de sessão.

**Acceptance Criteria**:

1. WHEN qualquer request à API é feita THEN SHALL incluir as credenciais de forma que o cookie httpOnly `mm_session` seja enviado (as chamadas de maps/nodes existentes passam a autenticar).
2. WHEN o backend responde erro THEN o cliente SHALL continuar lendo `{ error }` como hoje (contrato inalterado), traduzindo para mensagens pt-BR na camada de UI de auth.

**Independent Test**: com sessão ativa, listar mapas → 200 (não 401); as chamadas existentes seguem funcionando autenticadas.

---

## Requirements (rastreáveis)

### Tela de auth
- **M19-01** — Rota de auth dedicada (proposta `/login`), tela única com toggle **Entrar ⇄ Criar conta** (espelha o design; footer alterna o modo).
- **M19-02** — Campos: Nome (só no cadastro), E-mail, Senha com **toggle de olho** (mostrar/ocultar).
- **M19-03** — "Manter conectado neste dispositivo" **só no modo Entrar**, mapeado para `remember`.
- **M19-04** — Elementos fora de escopo **removidos** da tela: Google + divisória "ou", "Esqueci a senha"/recuperar, footer legal. Mantém o cabeçalho/sigilo KAOS.
- **M19-05** — Visual aderente ao design M16 (tokens do design system); sem hex inline (regra do projeto).

### Validação e feedback
- **M19-06** — Validação client-side por campo antes do submit: e-mail malformado, senha < 8, nome vazio (cadastro) → **erro inline** no campo, sem chamar a API.
- **M19-07** — **Banner no card** para erros do servidor: login `401` → "E-mail ou senha incorretos" (única); signup `409` → "Este e-mail já está em uso".
- **M19-08** — Botão de submit em **loading** (desabilitado + label de progresso) durante a request; reabilita ao concluir/errar.
- **M19-09** — Mensagens de erro em pt-BR amigável; o front **não** ecoa a string crua do backend.

### Sessão e guarda
- **M19-10** — Estado de sessão no cliente: bootstrap via `GET /auth/me` no load; usuário atual (`{id,email,name}`) exposto ao app.
- **M19-11** — Guarda de rota: `/` e `/maps/:id` exigem sessão; sem sessão → redirect pro login guardando o destino (**return-to**).
- **M19-12** — Após login/cadastro → redirect pro destino guardado ou Home; logado que abre o login → Home.
- **M19-13** — Estado de carregamento durante o bootstrap (não piscar conteúdo protegido nem login indevido).
- **M19-14** — `401` em qualquer request → tratar como deslogado e cair na guarda.
- **M19-15** — Logout: botão "Sair" **temporário no header da Home**, chama `POST /auth/logout`, limpa sessão do cliente, redireciona pro login.

### Camada de API
- **M19-16** — Todas as requests enviam credenciais (cookie `mm_session`); contrato de leitura de erro `{ error }` inalterado.
- **M19-17** — Funções de API de auth: `signup`, `login`, `logout`, `me`, tipadas via `packages/shared`.

### Qualidade
- **M19-18** — Zero mudança de backend/schema/contrato; nenhum endpoint novo.
- **M19-19** — Testes unitários do front cobrindo validação/feedback e a lógica da guarda; **e2e** cobrindo criar conta/entrar → app → sair (e return-to).
- **M19-20** — Gates verdes: typecheck, lint (sem hex inline), unit (web/api) e e2e.

---

## Dependencies

- **M18** (backend de auth) — executado; fornece `signup`/`login`/`logout`/`me`, cookie `mm_session`, escopo por dono.
- Design system M16 (tokens/estilos), React Router já no app, TanStack Query, ToastProvider (não usado para erro de form).
- Tipos compartilhados em `packages/shared` (usuário público, payloads de auth) — verificar o que o M18 já expôs; adicionar tipos de request de auth se faltarem (sem tocar no runtime do backend).
