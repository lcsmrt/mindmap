# M20 — Menu de conta e perfil — Specification

## Problem Statement

Depois do portão de auth (M18/M19), o app tem um usuário logado mas nenhum lugar coeso pra ele se ver e se gerenciar. Pior: cada tela desenhou seu próprio header inline — a Home tem branding + um botão "Sair" provisório; a tela de mapas tem só voltar + título e **nenhuma forma de sair**. É inconsistente e viola a convenção de header compartilhado. O M20 dá ao usuário um ponto único de identidade/conta (avatar + menu) presente em todas as telas e um lugar pra editar seu nome.

## Goals

- [ ] Um header compartilhado usado por Home e Mapa, eliminando os dois `<header>` inline duplicados.
- [ ] Menu de conta (avatar de iniciais + dropdown) idêntico nas duas telas, com "Sair" funcional em ambas.
- [ ] Página de Perfil (`/profile`) onde o usuário edita o próprio nome; e-mail exibido read-only.
- [ ] Nome persiste no backend e reflete imediatamente no avatar/dropdown.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tema claro/escuro | Fatiado pra fora do M20 (decisão do usuário, 2026-07-05); vira milestone/quick task própria. |
| Item "Ajuda" / atalhos | Adiado (decisão do usuário); já era mínimo/deferred no ROADMAP. |
| Editar e-mail | Exige re-auth/verificação de e-mail — fora do escopo; e-mail é read-only. |
| Upload de imagem de avatar | `User` não tem campo de imagem; avatar é monograma de iniciais. |
| Trocar senha / preferências | Não pedido; página de Perfil cresce em milestones futuros. |

---

## User Stories

### P1: Menu de conta no header compartilhado ⭐ MVP

**User Story**: Como usuário logado, quero um menu de conta consistente no topo de qualquer tela, para me identificar e sair de onde eu estiver.

**Why P1**: Resolve a dor concreta que motivou o milestone (headers inconsistentes, sem "Sair" no mapa) e é o ponto de entrada de todo o resto.

**Acceptance Criteria**:

1. WHEN a Home ou a tela de Mapa renderiza THEN o sistema SHALL usar um único componente de header compartilhado (em `components/`), não markup inline por página.
2. WHEN o header renderiza na Home THEN o sistema SHALL preservar o conteúdo à esquerda (marca KAOS + "mapas mentais").
3. WHEN o header renderiza na tela de Mapa THEN o sistema SHALL preservar o conteúdo à esquerda (voltar "Mapas" + título do mapa).
4. WHEN qualquer header renderiza THEN o sistema SHALL exibir, à direita, um avatar com as iniciais derivadas do nome do usuário.
5. WHEN o usuário aciona o avatar THEN o sistema SHALL abrir um dropdown exibindo nome + e-mail do usuário e os itens "Perfil" e "Sair".
6. WHEN o usuário aciona "Sair" THEN o sistema SHALL efetuar logout com o mesmo comportamento/redirect do botão provisório atual (encerra sessão + volta pro login), e o botão "Sair" inline da Home SHALL deixar de existir.
7. WHEN o usuário aciona "Perfil" THEN o sistema SHALL navegar para `/profile`.
8. WHEN o dropdown está aberto THEN o sistema SHALL ser acessível por teclado (abrir/fechar, foco, `Esc` fecha) e fechar ao clicar fora.

**Independent Test**: Logar, abrir Home e um mapa — ver o mesmo avatar/menu nos dois; abrir o dropdown e clicar "Sair" volta pro login; a tela de mapa agora tem como sair.

---

### P1: Editar nome na página de Perfil ⭐ MVP

**User Story**: Como usuário logado, quero uma página de Perfil onde edito meu nome, para corrigir/personalizar como sou identificado no app.

**Why P1**: É o segundo entregável central do M20 e uma fatia vertical completa (front + back).

**Acceptance Criteria**:

1. WHEN um usuário autenticado acessa `/profile` THEN o sistema SHALL renderizar a página sob `RequireAuth` (não autenticado → fluxo de login, como as demais rotas).
2. WHEN a página de Perfil carrega THEN o sistema SHALL pré-preencher o campo de nome com o nome atual e exibir o e-mail em modo read-only.
3. WHEN o usuário salva um nome válido THEN o sistema SHALL persistir a alteração via backend e refletir o novo nome no avatar/dropdown sem reload manual.
4. WHEN o usuário salva THEN o backend SHALL atualizar somente o nome do **usuário autenticado** (nunca outro), retornando o `AuthUser` atualizado.
5. WHEN o nome é inválido (vazio/só espaços ou acima do limite) THEN o sistema SHALL bloquear o envio e mostrar mensagem de validação, sem chamar o backend com valor inválido.
6. WHEN a persistência falha (rede/servidor) THEN o sistema SHALL exibir erro e preservar o valor digitado.
7. WHEN a sessão expira durante a operação THEN o sistema SHALL cair no tratamento global de 401 já existente (guarda/redirect).

**Independent Test**: Ir em `/profile`, trocar o nome, salvar, ver o avatar/dropdown atualizarem; recarregar a página e o nome persistiu; e-mail não é editável.

---

## Edge Cases

- WHEN o nome tem só espaços em branco THEN o sistema SHALL rejeitar (trim antes de validar).
- WHEN o nome excede o limite (alinhar às regras do signup do M18) THEN o sistema SHALL rejeitar client e server-side.
- WHEN o usuário salva sem mudar o nome THEN o sistema SHALL aceitar como no-op idempotente (sem erro).
- WHEN o nome tem 1 palavra vs. várias THEN as iniciais SHALL degradar de forma sensata (ex.: 1ª+última palavra, ou 1ª letra se só uma palavra).
- WHEN o nome é acionado com espaços internos/acentos THEN as iniciais SHALL lidar sem quebrar.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|----------------|-------|-------|--------|
| M20-01 | P1 Menu — header compartilhado em `components/` | Design | Pending |
| M20-02 | P1 Menu — lado esquerdo da Home preservado | Design | Pending |
| M20-03 | P1 Menu — lado esquerdo do Mapa preservado | Design | Pending |
| M20-04 | P1 Menu — avatar de iniciais à direita nas duas telas | Design | Pending |
| M20-05 | P1 Menu — iniciais derivadas do nome | Design | Pending |
| M20-06 | P1 Menu — dropdown mostra nome + e-mail | Design | Pending |
| M20-07 | P1 Menu — "Sair" no dropdown (remove botão inline provisório) | Design | Pending |
| M20-08 | P1 Menu — "Perfil" navega para `/profile` | Design | Pending |
| M20-09 | P1 Menu — dropdown acessível (teclado, Esc, click-fora) | Design | Pending |
| M20-10 | P1 Perfil — rota `/profile` sob `RequireAuth` | Design | Pending |
| M20-11 | P1 Perfil — nome pré-preenchido editável + e-mail read-only | Design | Pending |
| M20-12 | P1 Perfil — salvar persiste via backend | Design | Pending |
| M20-13 | P1 Perfil — backend atualiza só o user autenticado; retorna AuthUser | Design | Pending |
| M20-14 | P1 Perfil — validação de nome (trim, obrigatório, limite; alinha ao signup) | Design | Pending |
| M20-15 | P1 Perfil — nome novo reflete no avatar/dropdown (cache atualizado) | Design | Pending |
| M20-16 | P1 Perfil — erro de rede/servidor tratado, valor preservado | Design | Pending |

**Coverage:** 16 total, 0 mapeados a tasks (Design/Tasks pendentes).

---

## Success Criteria

- [ ] Home e Mapa usam o mesmo header; zero markup de header inline duplicado.
- [ ] "Sair" acessível a partir de qualquer tela via menu de conta.
- [ ] Usuário edita o nome em `/profile`, persiste, e o avatar/dropdown refletem sem reload.
- [ ] Backend só permite editar o próprio nome; e-mail não editável.
- [ ] Gates verdes: typecheck/lint, unit (web/api), e2e do fluxo (menu + editar nome).
