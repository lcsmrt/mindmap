# M10 — Redesign (web) Specification

## Problem Statement

A UI atual é funcional mas visualmente crua: a home é uma lista de texto (título + data + "Renomear/Excluir") e os nós do canvas têm apresentação mínima. Foi produzido um redesign no Claude Design (pasta `Mindmaps system interface/`, telas "Meus Mapas" e "Estudo de Nós" + dialog de edição) com uma estética dark coesa, cards de mapa com métricas, nós ricos (cor/status/responsável/crítico) e um dialog de edição com medidor de contraste. Este milestone porta esse redesign para o produto **sem mudar o modelo de dados** (exceto adicionar métricas read-only à listagem de mapas).

## Goals

- [ ] Home e canvas passam a refletir a estética do export (dark, cards, tipografia Hanken Grotesk), preservando 100% das capacidades atuais (criar/renomear/excluir mapa; add/editar/excluir/mover nó).
- [ ] Cards da home exibem **contagem de nós**, **badge de críticos** e **datas de criação/edição** — exige estender `GET /maps` + `MapSummary` (única mudança de backend).
- [ ] Nós do canvas ganham apresentação rica (cor de fundo/texto, dot+label de status, avatar de responsável, flag ▲ de crítico) + toolbar no hover (add filho / editar / excluir).
- [ ] Dialog de edição reskin com **preview ao vivo** e **medidor de contraste WCAG** sobre os campos que já existem no schema.
- [ ] Nenhuma mudança de schema, nenhum campo novo no `Node`, nenhuma mudança de layout/interação do canvas (M7/M8/M9 intactos — isto é reskin).

## Out of Scope

Explicitamente excluído para evitar scope creep.

| Feature | Reason |
| --- | --- |
| Rebranding "Nodum" / logo de marca | Decisão do usuário: aproveitar só a estética/layout, sem renomear o produto. |
| Mini-preview do mapa nos cards | Decisão do usuário: removido (nem decorativo nem render real). Card = título + métricas + datas. |
| Render real da árvore em miniatura | Exigiria buscar/derivar layout por mapa na home — custo desproporcional. |
| Color picker livre | AD-005 mantida: paleta fixa de swatches. |
| Mudança de schema / novos campos no Node | Todos os campos do redesign já existem (`status`, `assignee`, `isCritical`, `bgColor`, `textColor`). |
| Colaboração / multi-usuário / responsável como entidade | `assignee` segue **string livre** (AD-003); avatar/iniciais derivados da string. Sem tabela de usuários. |
| Mudança de layout/interação do canvas (direção, drag, slots) | M7/M8/M9 ficam intactos; este milestone só reskina os nós e o dialog. |

---

## User Stories

### P1: Home — shell e grid de cards ⭐ MVP

**User Story**: Como usuário, quero a home redesenhada (header, hero "Meus Mapas", grid de cards) para ter uma visão organizada e agradável dos meus mapas.

**Why P1**: É metade do redesign e a primeira tela do app; sem ela o redesign não existe.

**Acceptance Criteria**:

1. WHEN a home carrega THEN o sistema SHALL renderizar header (logo neutro + "Mapas mentais", **sem** "Nodum"), título "Meus Mapas" com contagem total de mapas, e um grid responsivo de cards.
2. WHEN há mapas THEN cada card SHALL exibir título (com ellipsis em overflow), métricas (ver P1-rollups) e datas; e ao clicar no card (fora do menu) SHALL navegar para o canvas do mapa.
3. WHEN não há nenhum mapa THEN o sistema SHALL exibir empty state "Nenhum mapa ainda" com CTA para criar o primeiro.
4. WHEN o usuário clica no menu "⋯" de um card THEN o sistema SHALL oferecer **Renomear** e **Excluir**, preservando o `ConfirmDialog` de exclusão atual.

**Independent Test**: Abrir a home com ≥1 mapa e ver o grid de cards estilizado; clicar num card navega ao canvas; "⋯ → Excluir" abre confirmação.

---

### P1: Home — criar mapa via modal ⭐ MVP

**User Story**: Como usuário, quero criar um mapa por um botão "Novo mapa" que abre um modal, conforme o redesign.

**Why P1**: O fluxo de criação é parte central da home redesenhada (substitui o `CreateMapForm` inline atual).

**Acceptance Criteria**:

1. WHEN o usuário clica em "Novo mapa" (ou no CTA do empty state) THEN o sistema SHALL abrir um modal com input de nome (autofocus).
2. WHEN o nome é não-vazio e o usuário confirma THEN o sistema SHALL criar o mapa (mesma mutation atual) e fechar o modal.
3. WHEN o nome está vazio THEN o sistema SHALL bloquear a criação.
4. WHEN o usuário clica fora / Cancelar / Esc THEN o sistema SHALL fechar o modal sem criar.

**Independent Test**: Clicar "Novo mapa", digitar nome, confirmar; o card novo aparece no grid.

---

### P1: Home — métricas por card (backend) ⭐ MVP

**User Story**: Como usuário, quero ver quantos nós cada mapa tem, quantos são críticos e desde quando existe, direto no card.

**Why P1**: Os cards do redesign são definidos por essas métricas; é a única mudança de backend do milestone.

**Acceptance Criteria**:

1. WHEN o cliente chama `GET /maps` THEN cada item SHALL incluir `nodeCount` (total de nós do mapa), `criticalCount` (nós com `isCritical = true`) e `createdAt`, além dos campos atuais.
2. WHEN um card é renderizado THEN o sistema SHALL exibir um label de nós (ex.: "12 nós" / "1 nó"), e — **somente quando `criticalCount > 0`** — um badge de críticos.
3. WHEN um mapa tem 0 nós THEN o card SHALL exibir "0 nós" e **nenhum** badge de críticos.
4. WHEN o card é renderizado THEN SHALL exibir "Criado {data}" e "Editado {relativo}" a partir de `createdAt`/`updatedAt`.

**Independent Test**: `GET /maps` retorna `nodeCount`/`criticalCount`/`createdAt`; um mapa com nó crítico mostra o badge, um mapa vazio não.

---

### P1: Canvas — nó redesenhado + toolbar no hover ⭐ MVP

**User Story**: Como usuário, quero que os nós do canvas mostrem cor, status, responsável e criticidade de forma rica, com as ações aparecendo ao passar o mouse.

**Why P1**: É a outra metade do redesign; reskin do `MindNode`/`NodeTaskIndicators`.

**Acceptance Criteria**:

1. WHEN um nó tem `bgColor`/`textColor` THEN o sistema SHALL aplicar fundo e texto conforme a paleta, com bordas/divisores adaptados a fundo claro vs. escuro.
2. WHEN um nó tem `status` definido THEN SHALL exibir dot + label do status; WHEN `status` é nulo THEN SHALL omitir a linha de status (disclosure progressiva, AD-003/M6 preservada).
3. WHEN um nó tem `assignee` não-vazio THEN SHALL exibir um avatar com as iniciais derivadas da string (sem entidade de usuário); WHEN vazio THEN SHALL omitir o avatar.
4. WHEN um nó tem `isCritical = true` THEN SHALL exibir o indicador ▲ de crítico junto ao título.
5. WHEN o cursor passa sobre o nó THEN SHALL revelar a toolbar (add filho / editar / excluir); WHEN sai THEN SHALL ocultá-la — sem alterar o comportamento de drag/seleção atual.

**Independent Test**: Um nó verde "Em andamento" com responsável mostra cor + dot + label + avatar; hover revela as 3 ações; um nó crítico mostra ▲.

---

### P1: Canvas — dialog de edição redesenhado ⭐ MVP

**User Story**: Como usuário, quero o dialog de edição redesenhado, com preview ao vivo do nó e as paletas/controles do export.

**Why P1**: O dialog é por onde toda a riqueza do nó é editada; reskin do `NodeEditDialog`.

**Acceptance Criteria**:

1. WHEN o dialog abre THEN SHALL exibir um **preview ao vivo** do card do nó refletindo título, cor de fundo, cor de texto, status, responsável e criticidade conforme o usuário edita.
2. WHEN o usuário escolhe cor de fundo / cor de texto THEN SHALL apresentar swatches da paleta do export (fundo e texto), preservando AD-005 (paleta fixa, sem picker livre); a paleta de texto exibe a prévia "Aa" sobre o fundo atual.
3. WHEN o usuário edita status / responsável / prioridade THEN SHALL usar os controles do export (botões de status, input de responsável com avatar, toggle Normal/Crítico) sobre os campos existentes.
4. WHEN o usuário confirma THEN SHALL persistir via a mutation atual; WHEN cancela/fecha THEN SHALL descartar sem persistir.

**Independent Test**: Abrir o dialog, trocar fundo/texto/status; o preview atualiza ao vivo; confirmar persiste e reflete no canvas.

---

### P2: Home — busca e ordenação

**User Story**: Como usuário, quero buscar mapas por nome e ordená-los (Recentes / A–Z / Mais nós).

**Why P2**: A home funciona sem isso (hoje não tem nenhum dos dois); é refinamento sobre o grid já redesenhado.

**Acceptance Criteria**:

1. WHEN o usuário digita na busca THEN o grid SHALL filtrar por título (case-insensitive).
2. WHEN a busca não retorna nada THEN SHALL exibir o empty state "Nada encontrado" (distinto de "Nenhum mapa ainda").
3. WHEN o usuário escolhe uma ordenação THEN o grid SHALL reordenar por Recentes (`updatedAt`), A–Z (título) ou Mais nós (`nodeCount`).

**Independent Test**: Com vários mapas, buscar um termo filtra; alternar "Mais nós" reordena por contagem.

---

### P2: Canvas — medidor de contraste WCAG no dialog

**User Story**: Como usuário, quero um indicador de contraste texto/fundo no dialog para evitar combinações ilegíveis.

**Why P2**: O dialog redesenhado funciona sem o medidor; é o enhancement-assinatura do export, mas não bloqueia o reskin.

**Acceptance Criteria**:

1. WHEN o usuário tem um par fundo/texto selecionado THEN o sistema SHALL calcular o ratio de contraste WCAG e exibir um rótulo classificado: ratio ≥ 4.5 → "Boa leitura"; ≥ 3 → "Razoável"; < 3 → "Contraste baixo", com o valor "{ratio}:1".
2. WHEN o usuário troca fundo ou texto THEN o medidor SHALL recalcular ao vivo junto do preview.

**Independent Test**: Selecionar texto branco sobre fundo branco mostra "Contraste baixo"; navy sobre verde mostra "Boa leitura".

---

## Edge Cases

- WHEN a lista de mapas está vazia THEN empty state "Nenhum mapa ainda" com CTA (distinto do "Nada encontrado" de busca sem resultado).
- WHEN um título de mapa/nó é longo THEN ellipsis (sem quebrar o layout do card/nó).
- WHEN `assignee` é nulo/vazio THEN nenhum avatar; WHEN `status` é nulo THEN nenhuma linha de status (preserva disclosure de M6).
- WHEN a paleta de texto está em "auto" THEN a cor de texto SHALL derivar da luminância do fundo (claro→texto escuro, escuro→texto claro), como no export.
- WHEN um mapa legado não tem nós THEN `nodeCount`/`criticalCount` = 0 (sem erro); `createdAt` já existe no schema para todos.
- WHEN `GET /maps` agrega contagens THEN a listagem SHALL permanecer performática (decisão de query fica no Design).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| M10-01 | P1: Home shell/grid | Design | Verified |
| M10-02 | P1: Home shell/grid (navegação ao canvas) | Design | Verified |
| M10-03 | P1: Home shell/grid (empty state "Nenhum mapa") | Design | Verified |
| M10-04 | P1: Home shell/grid (menu ⋯ Renomear/Excluir + ConfirmDialog) | Design | Verified |
| M10-05 | P1: Criar via modal (abrir/autofocus) | Design | Verified |
| M10-06 | P1: Criar via modal (confirmar cria + fecha) | Design | Verified |
| M10-07 | P1: Criar via modal (vazio bloqueia) | Design | Verified |
| M10-08 | P1: Criar via modal (cancelar/Esc/fora fecha) | Design | Verified |
| M10-09 | P1: Rollups — `GET /maps`+`MapSummary` com nodeCount/criticalCount/createdAt | Design | Verified |
| M10-10 | P1: Rollups — render label de nós + badge de críticos condicional | Design | Verified |
| M10-11 | P1: Rollups — 0 nós sem badge | Design | Verified |
| M10-12 | P1: Rollups — datas criado/editado no card | Design | Verified |
| M10-13 | P1: Nó — aplicação de cor fundo/texto + bordas adaptadas | Design | Verified |
| M10-14 | P1: Nó — status dot+label / omissão quando nulo | Design | Verified |
| M10-15 | P1: Nó — avatar de responsável por iniciais / omissão quando vazio | Design | Verified |
| M10-16 | P1: Nó — indicador ▲ de crítico | Design | Verified |
| M10-17 | P1: Nó — toolbar no hover (add/editar/excluir) sem mexer no drag | Design | Verified |
| M10-18 | P1: Dialog — preview ao vivo | Design | Verified |
| M10-19 | P1: Dialog — swatches fundo/texto (AD-005) + prévia "Aa" | Design | Verified |
| M10-20 | P1: Dialog — controles status/responsável/prioridade | Design | Verified |
| M10-21 | P1: Dialog — confirmar persiste / cancelar descarta | Design | Verified |
| M10-22 | P2: Home — busca por título | - | Verified |
| M10-23 | P2: Home — empty state "Nada encontrado" | - | Verified |
| M10-24 | P2: Home — ordenação Recentes/A–Z/Mais nós | - | Verified |
| M10-25 | P2: Dialog — medidor de contraste WCAG (classificação + ratio) | - | Verified |
| M10-26 | P2: Dialog — medidor recalcula ao vivo | - | Verified |
| M10-27 | Edge: cor de texto "auto" por luminância | Design | Verified |

**ID format:** `M10-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 27 total, 27 implementados e verificados (M10-NN → tasks T1–T12, gates verdes incl. e2e/smoke visual). ✅ Review AD-013 aprovado (2026-06-25).

---

## Success Criteria

- [ ] Home e canvas batem visualmente com o export (estética, tipografia, cards, nós, dialog), sem regressão funcional de M1–M9.
- [ ] `GET /maps` retorna `nodeCount`/`criticalCount`/`createdAt`; cards refletem as métricas corretamente (incl. 0 nós sem badge).
- [ ] Dialog mostra preview ao vivo; (P2) medidor de contraste classifica corretamente os pares fundo/texto.
- [ ] Gates verdes: `pnpm typecheck && pnpm lint && pnpm test` + `pnpm test:e2e`; nenhum schema/migration novo; AD-002/AD-003/AD-005 preservadas.
- [ ] Smoke visual (screenshot Playwright) das duas telas confirma o reskin (gate que pegou bugs de render em M8 — L-005).
