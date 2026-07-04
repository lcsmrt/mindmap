# M18 — Núcleo de auth backend (multi-tenancy) — Specification

> Etapa 1 de 5 do lote de Autenticação (ver ROADMAP → "Pós-v1 — Autenticação" e **AD-025**).
> Só backend. É a fundação de que M19–M22 dependem e a parte mais crítica de segurança.

## Problem Statement

O app é hoje single-user e **sem dono**: qualquer requisição lê e escreve qualquer mapa/nó, sem
autenticação. O usuário quer **contas reais e multi-usuário** — cada pessoa vê e edita apenas os
próprios mapas. Esta etapa introduz identidade (User/Session), o portão de autenticação e a
**tenancy** (`Map.ownerId`) que reescreve todo acesso a maps/nodes para filtrar por dono. Sem ela,
nenhuma tela de login (M19) tem contra o que autenticar.

## Goals

- [ ] Modelos `User` e `Session` no schema + `Map.ownerId`, com migração e herança dos mapas órfãos de hoje.
- [ ] Endpoints de auth: `signup`, `login`, `logout`, `me`, com sessão server-side em cookie httpOnly (revogável).
- [ ] Guarda global: toda rota de `maps`/`nodes` exige sessão válida (401 sem ela).
- [ ] Escopo por dono: nenhuma query/mutação de maps/nodes alcança dado de outro usuário (isolamento comprovado por teste).
- [ ] Zero regressão funcional nos endpoints existentes quando autenticado (o comportamento de maps/nodes é idêntico, só que escopado).

## Out of Scope

Explicitamente excluído — documentado para conter creep.

| Item                                        | Motivo                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Qualquer UI (tela de login, guarda no front) | É o M19 (1ª fatia jogável). M18 é só backend + contrato.           |
| Reset de senha por e-mail                    | M21 — puxa infra de e-mail/SMTP que ainda não existe.              |
| Google OAuth / "Continuar com Google"        | M22 — `@fastify/oauth2` + app no Google Cloud.                     |
| Menu de conta, editar perfil, tema           | M20.                                                               |
| Verificação de e-mail no cadastro            | Sem infra de e-mail até M21; signup fica ativo na hora.            |
| Rate limiting / lockout de login             | Deferred (ver STATE → Deferred Ideas). M18 mitiga só com erro genérico + hash lento (argon2). |
| Exclusão de conta / trocar a própria senha logado | Não requisitado nesta etapa; candidato a M20/quick task.       |
| Tornar `Map.ownerId` NOT NULL no schema      | Deferred: nulos só existem na janela pré-primeiro-signup, quando ninguém está autenticado (ver M18-16). Enforçar depois evita 2ª migration agora. |

---

## User Stories

Todas P1 — M18 é fundação indivisível; a fatia jogável ponta-a-ponta só fecha no M19, mas o backend
inteiro precisa existir junto (um endpoint de auth sem escopo, ou escopo sem sessão, não entrega nada).

### P1: Cadastro de conta ⭐ MVP

**User Story**: Como visitante sem conta, quero me cadastrar com nome, e-mail e senha para passar a ter mapas próprios.

**Why P1**: Sem criar usuário não há a quem escopar mapas; é a porta de entrada do sistema multi-usuário.

**Acceptance Criteria**:

1. WHEN `POST /auth/signup` recebe `{ email, password, name }` válidos e o e-mail ainda não existe THEN o sistema SHALL criar o `User` (senha via `argon2`), abrir uma `Session`, setar o cookie de sessão e responder `201` com o usuário público (`{ id, email, name }`, **nunca** o hash).
2. WHEN o e-mail já existe (comparação **case-insensitive**, após `trim`+`lowercase`) THEN o sistema SHALL responder `409` sem criar nada.
3. WHEN a senha tem menos de **8 caracteres** THEN o sistema SHALL responder `400` (sem regra de composição — comprimento é o único critério).
4. WHEN o e-mail é malformado ou o nome é vazio (após `trim`) THEN o sistema SHALL responder `400`.
5. WHEN o cadastro é o **primeiro** do sistema e existem mapas órfãos (`ownerId IS NULL`) THEN o sistema SHALL, na mesma transação, atribuir **todos** os mapas órfãos ao novo usuário (ver M18-16).

**Independent Test**: `POST /auth/signup` com corpo válido → 201 + cookie `Set-Cookie`; repetir com mesmo e-mail (outra caixa) → 409.

---

### P1: Login ⭐ MVP

**User Story**: Como usuário cadastrado, quero entrar com e-mail e senha para acessar meus mapas de qualquer dispositivo.

**Why P1**: Sem login a sessão só existiria no instante do cadastro.

**Acceptance Criteria**:

1. WHEN `POST /auth/login` recebe `{ email, password }` que casam com um usuário THEN o sistema SHALL abrir uma `Session`, setar o cookie e responder `200` com o usuário público.
2. WHEN o e-mail não existe **ou** a senha está errada THEN o sistema SHALL responder `401` com uma **mensagem genérica** idêntica nos dois casos (não vaza se a conta existe).
3. WHEN o corpo inclui `remember: true` THEN a `Session` e o cookie SHALL durar **30 dias**; WHEN ausente/`false` THEN SHALL durar **7 dias** (ambos persistentes; expiração fixa, não deslizante).
4. WHEN a verificação de senha ocorre THEN SHALL usar `argon2.verify` (custo constante o suficiente para não distinguir "conta inexistente" de "senha errada" por timing grosseiro).

**Independent Test**: cadastrar, depois `POST /auth/login` com a senha certa → 200 + cookie; com senha errada → 401 mesma mensagem.

---

### P1: Logout (revogar sessão) ⭐ MVP

**User Story**: Como usuário logado, quero sair para encerrar a sessão neste dispositivo.

**Why P1**: Sessão revogável (tabela `Session`) é o motivo de não usarmos JWT stateless; logout precisa apagá-la de fato.

**Acceptance Criteria**:

1. WHEN `POST /auth/logout` é chamado com sessão válida THEN o sistema SHALL **apagar** a linha de `Session` correspondente e limpar o cookie (`Max-Age=0`), respondendo `204`.
2. WHEN chamado sem cookie/sessão válida THEN o sistema SHALL responder `204` mesmo assim (idempotente; sem vazar estado).
3. WHEN a sessão foi apagada THEN o cookie antigo, se reenviado, SHALL falhar a validação (não há mais linha) → requisições subsequentes a maps/nodes recebem `401`.

**Independent Test**: login → logout (204) → reenviar o cookie antigo em `GET /auth/me` → 401.

---

### P1: Sessão atual (`me`) ⭐ MVP

**User Story**: Como cliente (M19), quero descobrir se há sessão válida e de quem, para inicializar o app.

**Why P1**: O bootstrap do front (M19) depende de `/me` para decidir entre app e tela de login.

**Acceptance Criteria**:

1. WHEN `GET /auth/me` é chamado com cookie de sessão válido e não expirado THEN o sistema SHALL responder `200` com o usuário público.
2. WHEN não há cookie, o cookie é inválido, ou a sessão expirou THEN o sistema SHALL responder `401` (e, se expirada, SHALL limpar o cookie).
3. WHEN a sessão está expirada por `expiresAt` THEN SHALL ser tratada como inválida mesmo que a linha ainda exista no banco.

**Independent Test**: sem cookie → `GET /auth/me` = 401; após login → 200 com `{ id, email, name }`.

---

### P1: Isolamento por dono (guarda global + escopo) ⭐ MVP

**User Story**: Como usuário, quero que meus mapas sejam invisíveis e intocáveis para qualquer outra conta.

**Why P1**: É a razão de ser da feature. Um vazamento aqui é a pior falha possível do lote.

**Acceptance Criteria**:

1. WHEN qualquer rota sob `/maps` ou `/nodes` é chamada **sem** sessão válida THEN o sistema SHALL responder `401` antes de tocar o banco.
2. WHEN `GET /maps` é chamado com sessão THEN SHALL retornar **apenas** os mapas cujo `ownerId` é o do usuário (`nodeCount`/`criticalCount` também escopados ao mapa do dono).
3. WHEN `POST /maps` cria um mapa THEN o `ownerId` SHALL ser o do usuário da sessão (o cliente não envia `ownerId`).
4. WHEN qualquer operação de mapa por id (`GET/PATCH/DELETE /maps/:id`, `GET /maps/:id/nodes`) referencia um mapa que **não pertence** ao usuário (ou não existe) THEN o sistema SHALL responder `404` (mesma resposta para "não existe" e "não é seu" — não vaza existência).
5. WHEN qualquer operação de nó (`POST /nodes`, `PATCH /nodes/:id`, `DELETE /nodes/:id`, `PATCH /nodes/:id/move`) toca um nó cujo mapa não pertence ao usuário THEN o sistema SHALL responder `404`; WHEN o `move`/`create` referencia um `parentId` de mapa de outro dono THEN SHALL responder `404`/`400` sem efeito.
6. WHEN as operações são feitas **pelo dono** THEN o comportamento SHALL ser idêntico ao de hoje (sortOrder global, anti-ciclo AD-008, side/AD-018, width/AD-023 intactos) — só o filtro por dono é novo.

**Independent Test**: usuário A cria mapa; usuário B (outra sessão) faz `GET /maps` (não vê o de A), `GET /maps/:idDeA` → 404, `PATCH /nodes/:noDeA` → 404.

---

### P1: Migração + herança dos mapas de hoje ⭐ MVP

**User Story**: Como dono atual dos mapas globais, quero que eles passem a ser meus ao criar minha conta, sem perder nada.

**Why P1**: Sem isso, ligar a guarda esconderia todos os mapas existentes (ficariam órfãos e inacessíveis).

**Acceptance Criteria**:

1. WHEN a migração roda THEN SHALL criar as tabelas `User`/`Session` e a coluna `Map.ownerId` (FK → `User`, **nullable** por ora), sem apagar dados existentes.
2. WHEN o **primeiro** usuário do sistema se cadastra (M18-05) THEN todos os mapas com `ownerId IS NULL` SHALL ser atribuídos a ele, **na mesma transação** do signup.
3. WHEN já existe pelo menos um usuário THEN um novo cadastro **não** SHALL herdar mapas órfãos (a herança é evento único do primeiro dono).
4. WHEN a herança roda THEN SHALL ser segura em concorrência (transação; `UPDATE ... WHERE ownerId IS NULL` cobre exatamente os órfãos, idempotente por natureza — nada a herdar depois).

**Independent Test**: partir de um banco com mapas sem dono → primeiro signup → `GET /maps` do novo usuário lista todos os mapas antes órfãos; um segundo signup lista vazio.

---

## Edge Cases

- WHEN o cookie de sessão referencia uma `Session` inexistente (apagada/rotacionada) THEN SHALL tratar como não autenticado (401), limpando o cookie.
- WHEN dois signups concorrem com o mesmo e-mail THEN a `@unique` do e-mail SHALL garantir que só um vence (o outro recebe 409 via `P2002`).
- WHEN o e-mail vem com espaços/maiúsculas (`  Foo@Bar.com `) THEN SHALL ser normalizado (`trim`+`lowercase`) antes de gravar e comparar.
- WHEN `DELETE /maps/:id` de um mapa de outro dono THEN SHALL ser 404 (não deleta) — cobre o vetor de deleção cruzada.
- WHEN o usuário logado é deletado do banco mas o cookie persiste THEN a validação de sessão SHALL falhar (FK/consulta não encontra o usuário) → 401.
- WHEN a sessão expira no meio do uso THEN a próxima requisição a maps/nodes SHALL receber 401 (o front M19 trata o redirect).

---

## Requirement Traceability

| ID      | Story                        | Descrição curta                                                        | Phase  | Status  |
| ------- | ---------------------------- | ---------------------------------------------------------------------- | ------ | ------- |
| M18-01  | P1 Cadastro                  | `POST /auth/signup` cria User (argon2) + Session + cookie, retorna público | Design | Pending |
| M18-02  | P1 Cadastro                  | E-mail único case-insensitive (`trim`+`lowercase`) → 409 em duplicata   | Design | Pending |
| M18-03  | P1 Cadastro                  | Política de senha: mínimo 8, sem composição → 400                       | Design | Pending |
| M18-04  | P1 Cadastro                  | Validação de e-mail malformado / nome vazio → 400                       | Design | Pending |
| M18-05  | P1 Login                     | `POST /auth/login` verifica argon2, abre Session, seta cookie          | Design | Pending |
| M18-06  | P1 Login                     | Erro genérico único para e-mail inexistente **ou** senha errada (401)  | Design | Pending |
| M18-07  | P1 Login                     | `remember`: 30d marcado / 7d default; expiração fixa (Session + cookie) | Design | Pending |
| M18-08  | P1 Logout                    | `POST /auth/logout` apaga Session + limpa cookie (204, idempotente)    | Design | Pending |
| M18-09  | P1 Me                        | `GET /auth/me` retorna usuário público com sessão válida; 401 sem      | Design | Pending |
| M18-10  | P1 Me                        | Sessão expirada por `expiresAt` tratada como inválida + limpa cookie   | Design | Pending |
| M18-11  | P1 Isolamento                | Guarda: 401 em toda rota `/maps`·`/nodes` sem sessão                    | Design | Pending |
| M18-12  | P1 Isolamento                | `GET /maps` + `POST /maps` escopados por `ownerId` (list filtra, create seta) | Design | Pending |
| M18-13  | P1 Isolamento                | Ops de mapa por id não-pertencente → 404 (não vaza existência)         | Design | Pending |
| M18-14  | P1 Isolamento                | Ops de nó em mapa não-pertencente → 404/400 sem efeito                  | Design | Pending |
| M18-15  | P1 Isolamento                | Comportamento do dono idêntico ao atual (sortOrder/anti-ciclo/side/width intactos) | Design | Pending |
| M18-16  | P1 Migração                  | Migração cria `User`/`Session`/`Map.ownerId` (nullable) sem perder dados | Design | Pending |
| M18-17  | P1 Migração                  | Primeiro signup herda todos os mapas órfãos na mesma transação         | Design | Pending |
| M18-18  | P1 Migração                  | Cadastros seguintes não herdam (herança é evento único)                | Design | Pending |
| M18-19  | Contrato/Infra               | Cookie httpOnly, SameSite=Lax, Path=/, Secure gated por env; token de sessão de alta entropia guardado de forma não-reversível | Design | Pending |
| M18-20  | Contrato                     | Tipos compartilhados (`packages/shared`): `AuthUser`, corpos de signup/login, respostas | Design | Pending |
| M18-21  | Testes                       | Reconciliar `maps.test.ts`/`nodes.test.ts` existentes para autenticar (a guarda os quebra) | Tasks  | Pending |

**Coverage:** 21 requisitos. Todos P1. Mapeamento para tasks no `tasks.md` (fase seguinte).

---

## Success Criteria

- [ ] Um usuário só enxerga/edita os próprios mapas; teste de isolamento A↔B verde (não-vacuoso).
- [ ] Cadastro/login/logout/me funcionam ponta-a-ponta via cookie httpOnly; sessão revogável de fato no logout.
- [ ] Migração roda no banco de dev sem perda; primeiro signup herda os mapas antes órfãos.
- [ ] Nenhum endpoint de maps/nodes responde sem sessão (401 uniforme).
- [ ] Gates verdes: typecheck, lint, unit (api — novos testes de auth/escopo) — **e2e/smoke ficam para M19** (não há UI aqui) e para o review AD-013.
- [ ] Segredo nunca vaza: hash de senha e token de sessão nunca aparecem em resposta ou log.

---

## Notas de risco (para o Design)

- **Cookie `Secure` × prod em HTTP.** A prod hoje é `http://72.60.1.97:8080` (AD-022, sem TLS). Cookie `Secure` **não** é enviado sobre HTTP → a sessão trafega em claro. Para ferramenta pessoal por IP é tolerável, mas é um **concern** a registrar (CONCERNS.md) e o `Secure` deve ser **gated por env** (on em HTTPS futuro, off no HTTP atual). Recomendação: TLS eventual.
- **CSRF.** SPA e API são **mesma origem** (nginx serve a SPA e faz proxy de `/api` — AD-022). `SameSite=Lax` já barra POST cross-site; M18 fica só com Lax (sem token CSRF separado). Reavaliar se surgir origem cruzada.
- **Reescrita de escopo é ampla.** Toca **todas** as rotas de maps/nodes existentes e **todos** os testes de integração delas (M18-21). Risco de regressão silenciosa se algum caminho escapar do filtro — o design deve centralizar o escopo (helper `assertMapOwner`/preHandler) em vez de espalhar `where` manuais.
- **Ordem da migração vs deploy.** Com "primeiro cadastro herda", os mapas ficam órfãos (invisíveis) entre o deploy da migração e o seu primeiro signup. Nesse intervalo ninguém está autenticado, então nada os acessa — mas **cadastre-se logo após o deploy** para reivindicá-los. Enforçar `ownerId NOT NULL` fica deferred (evita 2ª migration; nulos só existem nessa janela).
</content>
</invoke>
