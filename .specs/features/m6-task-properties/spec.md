# M6 — Propriedades de Tarefa (US-04)

## Problem Statement

A visão do produto é "qualquer nó pode carregar metadados de tarefa (status, responsável, prioridade) com exibição progressiva no canvas" — é o diferencial declarado frente ao MindMeister (PROJECT.md). O schema já suporta os três campos (`status`, `assignee`, `isCritical` foram criados na migration `init` de M1 — ver AD-003) e o `NodeDto` já os expõe, mas **nenhum deles é editável nem visível na UI**. O `NodeEditDialog` (M5) só edita título e cores.

M6 entrega: (1) os três campos de tarefa no dialog de edição, (2) persistência via extensão do `PATCH /nodes/:id` (já parcial desde M5), (3) indicação visual progressiva no canvas — só aparece o que está preenchido.

## Goals

- [ ] Dialog de edição expõe `status`, `responsável` e `prioridade` para qualquer nó (folha ou intermediário).
- [ ] `PATCH /nodes/:id` aceita os três campos de forma parcial, com reset via valor vazio/null.
- [ ] Canvas exibe indicadores concisos **apenas** para campos preenchidos (exibição progressiva).
- [ ] Alterações aplicam imediatamente (optimistic, padrão M4) e persistem; restauram ao reabrir o mapa.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa. Specs e2e do milestone passam (AD-014).

## Out of Scope

| Item | Motivo |
| --- | --- |
| Migration de schema (colunas de tarefa) | Já feitas em M1 (`init`) — AD-003. M6 só consome o que existe |
| Filtrar/buscar nós por status ou responsável | Não está na US-04; candidato pós-v1 |
| Lista de responsáveis pré-definida / autocomplete | US-04 define responsável como texto livre. Autocomplete é refinamento futuro |
| Mais de um responsável por nó | US-04 fala em "responsável" (singular). Multi-assignee fora de escopo |
| Datas / prazos / checklists | Não fazem parte de US-04 |
| Propagação de status para a subárvore (rollup) | Pós-v1 |
| Ajuste fino da UI dos indicadores | Escolhido um ponto de partida v1; refinamento iterativo durante o uso (§7 do source-spec) |

---

## Decisões Incorporadas

1. **Sem migration** (AD-003): `status` (enum `NodeStatus`), `assignee`, `isCritical` já existem no Node desde M1. M6 não toca no schema Prisma.
2. **`PATCH /nodes/:id` ganha 3 campos parciais**: estende a validação Zod e o `UpdateNodeBody` para `status?`, `assignee?`, `isCritical?`. Continua valendo a regra "pelo menos um campo presente". `status` aceita os 4 valores do enum ou `null` (reset). `assignee` aceita string (trimmed) ou `null`/vazio (reset). `isCritical` é booleano.
3. **Status via botões segmentados coloridos** (decisão do usuário): grid de 4 botões (Pendente/Em andamento/Concluído/Bloqueado), cada um com cor própria. Clicar no botão ativo limpa (volta a "nenhum" → `status: null`). Mapeamento label↔enum: Pendente=`PENDING`, Em andamento=`IN_PROGRESS`, Concluído=`DONE`, Bloqueado=`BLOCKED`.
4. **Cores de status (paleta semântica)**: Pendente=cinza, Em andamento=azul, Concluído=verde, Bloqueado=vermelho. Tons concretos são decisão de implementação (design.md), coerentes com o theme Tailwind. Mesma cor é reutilizada no indicador do canvas.
5. **Responsável = input de texto livre**: campo `<Input>` no dialog. String vazia (após trim) ⇒ `assignee: null` (reset). Persiste no blur/Enter, mesmo padrão do título (M5).
6. **Prioridade = toggle/checkbox "Crítico"**: booleano. Marcar ⇒ `isCritical: true`; desmarcar ⇒ `false`. Aplica imediatamente ao alternar.
7. **Indicador no canvas = rodapé compacto em linha** (decisão do usuário): linha fina abaixo do título do `MindNode` exibindo, na ordem, **ponto colorido de status** + **iniciais do responsável** + **ícone de prioridade (🚩)**. Cada elemento renderiza **apenas** quando seu campo está preenchido. Se nenhum campo está preenchido, a linha inteira não é renderizada (sem alteração de layout vs. M5).
8. **Optimistic updates** (padrão M4/M5): a mutation de update já existe e já faz `onMutate`/snapshot/rollback. M6 só passa os novos campos por ela; em erro, reverte + toast.
9. **Dialog estende NodeEditForm** (sem refactor estrutural): M5 desenhou o dialog para receber task props "sem refactor" (M5 spec, goal). Os novos controles entram como novas seções no mesmo form.

---

## User Stories

### P1: Editar propriedades de tarefa no dialog ⭐ MVP

**User Story:** Como usuário, quero atribuir status, responsável e prioridade a qualquer nó pelo dialog de edição, para controlar a execução das tarefas sem restrição de posição na árvore.

**Why P1:** É o núcleo da US-04 e o diferencial do produto (PROJECT.md). Sem os controles no dialog não há como definir as propriedades.

**Acceptance Criteria:**

1. WHEN o usuário abre o dialog de edição de um nó THEN o sistema SHALL exibir, além de título e cores, as seções "Status", "Responsável" e "Prioridade".
2. WHEN o usuário clica num botão de status THEN o `status` do nó SHALL atualizar para o valor correspondente (optimistic) e o botão SHALL exibir estado ativo (cor preenchida).
3. WHEN o usuário clica no botão de status que já está ativo THEN o `status` SHALL voltar para `null` (nenhum) e nenhum botão SHALL ficar ativo.
4. WHEN o usuário digita no campo "Responsável" e confirma (Enter ou blur) THEN o `assignee` SHALL atualizar (optimistic) e persistir; string vazia após trim SHALL resultar em `assignee: null`.
5. WHEN o usuário alterna o toggle "Crítico" THEN o `isCritical` SHALL atualizar (optimistic) e persistir imediatamente.
6. WHEN o comportamento é exercido em um nó folha ou intermediário (incluindo raiz) THEN o resultado SHALL ser idêntico — sem restrição por posição na árvore.

**Independent Test:** Abrir o dialog de um nó, marcar "Em andamento", digitar um responsável, marcar "Crítico". Fechar e reabrir o dialog — os três valores estão preservados.

---

### P1: Persistência e restauração das propriedades ⭐ MVP

**User Story:** Como usuário, quero que status, responsável e prioridade sejam salvos automaticamente e restaurados ao reabrir o mapa, para não perder o controle das tarefas.

**Why P1:** US-04 + US-05: estado completo restaurado ao reabrir. Sem persistência a feature não tem valor.

**Acceptance Criteria:**

1. WHEN o usuário define qualquer propriedade de tarefa THEN o sistema SHALL enviar `PATCH /nodes/:id` com o(s) campo(s) alterado(s) e o servidor SHALL persistir.
2. WHEN o `PATCH` recebe `status` com um dos 4 valores válidos THEN o servidor SHALL persistir; WHEN recebe `status: null` THEN SHALL resetar para null.
3. WHEN o `PATCH` recebe um `status` inválido (fora do enum) THEN o servidor SHALL responder 400.
4. WHEN o `PATCH` recebe campos parciais (ex.: só `isCritical`) THEN o servidor SHALL atualizar apenas esse campo, preservando os demais.
5. WHEN o usuário reabre o mapa (`GET /maps/:id/nodes`) THEN os nós SHALL retornar `status`, `assignee` e `isCritical` preservados e o canvas SHALL renderizar os indicadores correspondentes.

**Independent Test:** Definir propriedades em dois nós, navegar para a lista de mapas e voltar; dar F5. Indicadores e valores no dialog permanecem intactos.

---

### P1: Indicação visual progressiva no canvas ⭐ MVP

**User Story:** Como usuário, quero ver de relance, no próprio nó, quais têm status/responsável/prioridade, para identificar tarefas sem abrir o dialog.

**Why P1:** US-04 exige "campos preenchidos geram alguma indicação visual concisa". É o "progressivo" que define o produto.

**Acceptance Criteria:**

1. WHEN um nó tem `status` definido THEN o canvas SHALL exibir um ponto colorido (cor semântica do status) no rodapé do nó.
2. WHEN um nó tem `assignee` definido THEN o canvas SHALL exibir as iniciais do responsável no rodapé do nó.
3. WHEN um nó tem `isCritical = true` THEN o canvas SHALL exibir um ícone de prioridade (🚩) no rodapé do nó.
4. WHEN um campo de tarefa está vazio/null/false THEN o canvas SHALL NOT exibir seu indicador (exibição progressiva).
5. WHEN nenhum dos três campos está preenchido THEN o nó SHALL renderizar exatamente como antes de M6 (sem linha de rodapé, sem mudança de layout).
6. WHEN uma propriedade é alterada no dialog THEN o indicador correspondente no canvas SHALL refletir a mudança imediatamente (optimistic).

**Independent Test:** Um nó sem propriedades não mostra indicadores. Marcar status → ponto colorido aparece. Adicionar responsável → iniciais aparecem. Marcar crítico → 🚩 aparece. Limpar tudo → linha de rodapé some.

---

### P2: Acessibilidade dos controles de tarefa

**User Story:** Como usuário, quero operar os controles de tarefa via teclado, para não depender do mouse.

**Why P2:** Boa prática, não bloqueia lançamento. Coerente com a US P2 de M5.

**Acceptance Criteria:**

1. WHEN o usuário navega por Tab THEN o foco SHALL percorrer os botões de status, o campo responsável e o toggle de prioridade em ordem lógica.
2. WHEN um botão de status tem foco e o usuário pressiona Enter/Space THEN o status SHALL alternar (mesmo comportamento do click).
3. WHEN o toggle de prioridade tem foco e o usuário pressiona Space THEN o `isCritical` SHALL alternar.
4. WHEN os botões de status são renderizados THEN cada um SHALL ter rótulo textual acessível (não depender só da cor).

**Independent Test:** Com o dialog aberto, navegar por Tab até os controles de tarefa e alterar status e prioridade só pelo teclado.

---

## Edge Cases

- WHEN o responsável tem nome de uma só palavra (ex.: "Lucas") THEN as iniciais SHALL derivar de forma definida (ex.: 2 primeiras letras → "LU") — regra exata é decisão de design.md, mas SHALL ser determinística.
- WHEN o responsável tem caracteres não-latinos/emoji THEN a derivação de iniciais SHALL não quebrar o layout (truncar com segurança).
- WHEN o usuário troca de status rapidamente (vários cliques) THEN cada clique SHALL disparar um PATCH independente; last-write-wins (sem debounce), igual às cores de M5.
- WHEN o nó tem `bgColor` escuro e indicadores no rodapé THEN os indicadores SHALL manter contraste legível (decisão de design.md — ex.: chip/contorno neutro).
- WHEN o `assignee` é uma string muito longa THEN o rodapé SHALL exibir só as iniciais (texto completo não vai pro canvas; cabe no dialog/tooltip futuro).
- WHEN a API retorna erro num update de tarefa THEN o valor SHALL reverter (rollback optimistic) e um toast de erro SHALL aparecer (padrão M4).
- WHEN o dialog é aberto para o nó raiz THEN os controles de tarefa SHALL funcionar normalmente (sem restrição).

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M6-01 | Dialog — seção de status (botões segmentados) | P1 | Pending |
| M6-02 | Dialog — clicar status aplica (optimistic) + estado ativo | P1 | Pending |
| M6-03 | Dialog — clicar status ativo limpa (null) | P1 | Pending |
| M6-04 | Dialog — campo responsável (texto livre) aplica no blur/Enter | P1 | Pending |
| M6-05 | Dialog — responsável vazio ⇒ assignee null | P1 | Pending |
| M6-06 | Dialog — toggle prioridade aplica imediatamente | P1 | Pending |
| M6-07 | Dialog — comportamento idêntico p/ folha, intermediário e raiz | P1 | Pending |
| M6-08 | API — PATCH aceita status (enum) parcial + reset null | P1 | Pending |
| M6-09 | API — PATCH aceita assignee parcial + reset (vazio/null) | P1 | Pending |
| M6-10 | API — PATCH aceita isCritical parcial | P1 | Pending |
| M6-11 | API — status inválido retorna 400 | P1 | Pending |
| M6-12 | API — update parcial preserva campos não enviados | P1 | Pending |
| M6-13 | Restauração — GET retorna campos de tarefa, canvas renderiza | P1 | Pending |
| M6-14 | Canvas — ponto colorido de status quando definido | P1 | Pending |
| M6-15 | Canvas — iniciais do responsável quando definido | P1 | Pending |
| M6-16 | Canvas — ícone 🚩 quando crítico | P1 | Pending |
| M6-17 | Canvas — sem indicador para campo vazio (progressivo) | P1 | Pending |
| M6-18 | Canvas — sem rodapé quando nenhum campo preenchido | P1 | Pending |
| M6-19 | Canvas — indicador atualiza optimistic ao editar | P1 | Pending |
| M6-20 | Shared — UpdateNodeBody estende status/assignee/isCritical | P1 | Pending |
| M6-21 | A11y — Tab/Enter/Space nos controles de tarefa | P2 | Pending |
| M6-22 | A11y — rótulo textual acessível nos botões de status | P2 | Pending |

**Coverage:** 22 requisitos — 20 P1, 2 P2.

---

## Success Criteria

- [ ] Dialog de qualquer nó exibe status (4 botões coloridos), responsável (texto) e prioridade (toggle).
- [ ] Selecionar status/responsável/crítico reflete no canvas instantaneamente (optimistic) e persiste após F5.
- [ ] Clicar no status ativo limpa; responsável vazio limpa; tudo limpo ⇒ rodapé do nó some.
- [ ] Nó sem propriedades renderiza igual a M5 (zero mudança de layout).
- [ ] `PATCH` com status inválido ⇒ 400; update parcial preserva os demais campos.
- [ ] Forçar erro na API: valor reverte + toast (padrão M4).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa.
- [ ] Specs e2e do milestone passam (AD-014).

---

## Skills Aplicáveis (executor)

- **`api-backend`** — extensão do `PATCH /nodes/:id` (validação Zod do enum/assignee/isCritical), testes de rota.
- **`web-api-integration`** — passar os novos campos pela mutation de update (optimistic já existe).
- **`web-component-creation`** — controles do dialog (StatusButtons segmentados, toggle de prioridade) reusando primitivos de `ui/`.
- **`react-flow`** — indicadores no rodapé do `MindNode` e exibição progressiva no canvas.
