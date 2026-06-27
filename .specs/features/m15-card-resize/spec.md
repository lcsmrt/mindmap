# M15 — Resize horizontal do card

## Problem Statement

Hoje a largura do card é uma constante global (`NODE_WIDTH = 180`, `nodeSize.ts:4`). O M12 entregou texto sempre visível + altura derivada de medição real, mas com a largura **fixa** um título longo só pode crescer **para baixo** (mais linhas) — o usuário não consegue dar mais respiro horizontal a um nó importante nem compactar um nó secundário. A largura deveria ser **controlada pelo usuário**, por nó, e **persistida** entre sessões.

M15 é a segunda metade do item "Card responsivo + resize" do backlog de polish, **fatiada de M12** (decisão do usuário 2026-06-25, AD-020). Introduz uma alça de resize na borda direita do card (revelada no hover, consistente com a toolbar do M10), torna `NODE_WIDTH` uma **largura por nó** que flui pelo layout / slots / barra-fantasma / render, e persiste a largura numa nova coluna `width Int?` no `Node` (full-stack — revisa parcialmente AD-002, mesmo precedente do `side`/M9). A altura segue **derivada** (M12 já entrega o pipeline medir→layout); ao redimensionar, o texto reflui e a altura se reajusta sozinha.

## Goals

- [ ] Cada card tem uma **alça de resize na borda direita**, revelada no hover (CSS `group-hover`, padrão da toolbar M10); arrastá-la altera a **largura daquele nó**.
- [ ] A largura deixa de ser a constante `NODE_WIDTH` e passa a ser **largura por nó** (`node.width ?? NODE_WIDTH`) consumida por `useTreeLayout.ts` (d3-flextree), `lib/slots.ts` (geometria do drop), barra-fantasma e render do `MindNode`.
- [ ] Ao soltar a alça, a largura é **persistida** (`PATCH /nodes/:id` com `width`); update **otimista** reflete imediato no canvas e o re-layout reposiciona a árvore.
- [ ] Redimensionar **reflui o texto** e a **altura se reajusta** via o pipeline de medição do M12 (sem loop medir↔layout — ver invariante).
- [ ] Limites: largura mínima sã (piso) e **máxima limitada ao conteúdo** — não é possível arrastar além da largura que faz **todo o texto caber em uma linha** (sem espaço em branco inútil à direita).
- [ ] Largura `null` (nós existentes e novos) renderiza no default atual (`NODE_WIDTH = 180`) — **zero regressão visual** para quem nunca redimensionou.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa (unit web + api); migration aplicada; e2e seguem verdes (AD-014); smoke visual confirma a alça e o resize.

## Out of Scope

| Item | Motivo |
| --- | --- |
| **Resize vertical / altura manual** | A altura é **derivada** (M12). M15 controla só a largura; a altura continua vindo da medição do conteúdo reflowed. |
| **Reset da largura ao default (auto)** | Decisão do usuário (2026-06-27): **sem reset por agora**. Uma vez redimensionado, fica. Vira item futuro (Deferred) se incomodar — candidatos: duplo-clique na alça ou item no menu ⋯. |
| **Alinhamento de colunas por profundidade** | Decisão do usuário (2026-06-27): colunas **por nó** (natural do d3-flextree) — os filhos de cada nó começam após a largura **daquele** nó; colunas ficam escalonadas entre ramos de larguras diferentes. Sem cálculo de largura-máxima por nível. |
| **Larguras diferentes mudam x/y livre (AD-002 total)** | A largura é **1 dado estrutural** a mais por nó (espírito AD-002, mesmo precedente do `side`/M9). **Não** persiste posição em pixel (x/y livre) — a largura não é posição. |
| **Resize por toque / mobile** | App desktop; o gesto é pointer/mouse com alça no hover. Touch não entra no escopo. |
| **Persistir/medir o input inline de edição** | Como no M12, a medição/cap de largura vale para o estado **não-editando** (texto exibido). O `Input` inline segue como está. |
| **Recalibrar a geometria vertical do drop (M13)** | M13 já fechou a seleção de slot por band vertical. M15 toca o **eixo da largura** em `slots.ts` (colX/ghost por largura-por-nó), não a banda vertical — ortogonal, coordenar não duplicar. |
| **Hierarquia visual / "central maior em largura" (M14)** | M14 consome a largura-por-nó do M15 para o sub-item "central maior em largura", mas é milestone separado. M15 só entrega o **mecanismo** de largura por nó + resize; não muda skin por profundidade. |

---

## Decisões Incorporadas

1. **Alça de resize na borda direita, revelada no hover** (decisão fixada 2026-06-25; ROADMAP M15 + M12 Out-of-Scope). Consistente com a toolbar M10 (CSS `group`/opacity, sem novo padrão de UI). O handler de pointer da alça **isola** o evento (`stopPropagation`) para não disparar o drag-to-place do card.
2. **Largura persistida em coluna nova `width Int?`** (decisão fixada 2026-06-25). Full-stack: schema + migration + DTO + endpoint + mutation otimista. Revisa **parcialmente AD-002** (1 dado estrutural a mais por nó, **sem x/y livre**) — mesmo precedente e justificativa do `side`/M9 (AD-018). A registrar como **AD-023** na execução.
3. **`NODE_WIDTH` vira largura-por-nó** (decisão fixada 2026-06-25). `node.width ?? NODE_WIDTH` em `useTreeLayout.ts` (depth do d3-flextree e `PositionedNode.width`), `lib/slots.ts` (colX a partir da largura real do pai; centro/ghost a partir da largura do nó arrastado), barra-fantasma (`MapCanvas.tsx`) e render (`MindNode`). O default `NODE_WIDTH = 180` permanece como largura de quem tem `width = null`.
4. **Altura segue derivada (M12); largura é o novo input do usuário** (decisão do usuário, confirmada em M12). Ao redimensionar, o texto reflui → a altura é **re-medida** pelo `ResizeObserver` compartilhado (`useMeasuredHeights`) → o `d3-flextree` reposiciona. **Invariante de convergência (estendido do M12):** a **largura** é um input independente (vem de `node.width`, do drag ou da persistência), **nunca** derivada do layout; reposicionar muda x/y, não largura ⇒ não re-dispara medição de altura ⇒ sem loop. O drag de resize é a única origem de mudança de largura, e é um evento pontual.
5. **Teto da largura = largura de conteúdo numa linha** (decisão do usuário, 2026-06-27). O usuário **não** pode arrastar a largura além do ponto em que **todo o texto do nó cabe em uma única linha** (sem espaço em branco inútil). Abaixo desse teto o texto quebra em linhas (M12 cuida da altura). O **piso** é uma largura mínima sã (a definir em `design.md`, ordem de ~120px, suficiente para a toolbar do hover). Mecanismo de medição do teto (largura de conteúdo / `max-content` / `scrollWidth`) é decisão de `design.md` — não assumir, verificar.
6. **Sem reset por agora** (decisão do usuário, 2026-06-27). Não há gesto para voltar `width` a `null`/auto. Largura redimensionada permanece. Deferred Idea registrada.
7. **Colunas por nó** (decisão do usuário, 2026-06-27). Mantém o comportamento natural do d3-flextree (cada nó espaça seus filhos pela própria largura) — colunas escalonadas entre ramos de larguras distintas, sem alinhar por profundidade. Preserva a simplicidade e o invariante de convergência.

---

## User Stories

### P1: Redimensionar a largura de um card ⭐ MVP

**User Story:** Como usuário, quero arrastar a borda direita de um nó para deixá-lo mais largo ou mais estreito, para controlar quanto respiro horizontal cada nó tem (destacar um importante, compactar um secundário).

**Why P1:** É o coração da feature — o gesto de resize em si.

**Acceptance Criteria:**

1. WHEN o ponteiro entra na área do card THEN uma **alça de resize** SHALL aparecer na borda direita (revelada via hover, como a toolbar M10); fora do hover ela fica oculta.
2. WHEN o usuário pressiona e arrasta a alça horizontalmente THEN a **largura daquele card** SHALL acompanhar o ponteiro em tempo real (arraste livre em pixels), refluindo o texto.
3. WHEN o arraste de resize está em curso THEN o **drag-to-place** do card (mover/reparent) NÃO SHALL ser acionado (o handler da alça isola o evento).
4. WHEN a largura muda durante o arraste THEN o **texto SHALL refluir** (mais/menos linhas) e a **altura do card SHALL se reajustar** sem sobreposição com vizinhos (pipeline M12), sem loop de medição.
5. WHEN o nó tem `width = null` THEN ele SHALL renderizar com a largura default (`NODE_WIDTH = 180`) — idêntico ao comportamento atual.

**Independent Test:** Passar o mouse sobre um nó → a alça aparece à direita; arrastar para a direita/esquerda → o card alarga/estreita e o texto reflui; nenhum nó vira/move de pai durante o resize.

---

### P1: Largura persistida entre sessões ⭐ MVP

**User Story:** Como usuário, quero que a largura que escolhi para um nó seja salva, para reencontrá-la ao reabrir o mapa.

**Why P1:** Sem persistência o resize é efêmero e inútil na prática.

**Acceptance Criteria:**

1. WHEN o usuário **solta** a alça de resize THEN a nova largura SHALL ser persistida via `PATCH /nodes/:id` com o campo `width`.
2. WHEN o resize é solto THEN o cache local (TanStack Query) SHALL ser atualizado de forma **otimista** (largura aplicada imediatamente, sem esperar o servidor), com rollback em erro (mesmo padrão de `useUpdateNode`).
3. WHEN o mapa é **reaberto** THEN cada nó SHALL ser renderizado com sua `width` persistida (e os nós sem `width` com o default 180).
4. WHEN o `PATCH` recebe `width` THEN o backend SHALL validar e gravar um inteiro positivo na coluna `width` do `Node`, retornando o `NodeDto` com `width`.
5. WHEN um nó é criado THEN sua `width` SHALL ser `null` (default; nenhuma largura explícita até o usuário redimensionar).

**Independent Test:** Redimensionar um nó, recarregar a página (F5) → o nó reabre com a largura escolhida; um nó nunca redimensionado reabre em 180px.

---

### P1: Teto e piso da largura ⭐ MVP

**User Story:** Como usuário, quero que a largura tenha limites sãos — não tão estreita que o card fique inútil, nem tão larga que sobre espaço em branco depois do texto.

**Why P1:** Define a faixa válida do gesto; sem o teto de conteúdo, o card vira um retângulo com texto numa ponta e vazio na outra (a dor que o usuário citou).

**Acceptance Criteria:**

1. WHEN o usuário arrasta a alça para a **direita** THEN a largura SHALL parar quando **todo o texto do nó couber em uma única linha** (largura de conteúdo) — não SHALL ultrapassar esse teto, evitando espaço em branco à direita.
2. WHEN o usuário arrasta a alça para a **esquerda** THEN a largura SHALL parar num **piso mínimo** sã (definido em `design.md`), sem permitir um card degenerado.
3. WHEN o texto de conteúdo numa linha é mais estreito que o piso THEN a faixa válida SHALL degenerar de forma graciosa (o card não fica abaixo do piso; o teto não cai abaixo do piso) — sem travar nem oscilar.
4. WHEN a largura persistida de um nó (de uma sessão anterior) excede o teto de conteúdo atual (ex.: o texto encolheu numa edição) THEN o render SHALL se comportar de forma sã (o teto vale para **novos arrastes**; uma largura já gravada não SHALL quebrar o layout — clamp/efeito a definir em `design.md`).

**Independent Test:** Num nó de texto curto, a alça praticamente não alarga (teto colado no conteúdo); num nó de texto longo, dá pra alargar até o texto virar uma linha só; arrastando ao máximo para a esquerda o card para num mínimo legível.

---

### P1: Layout e slots usam largura por nó ⭐ MVP

**User Story:** Como usuário, quero que ao redimensionar um nó os filhos e a barra-fantasma de drop acompanhem a nova largura, para o mapa não ficar com colunas sobrepostas ou a barra de drop no lugar errado.

**Why P1:** A largura por nó tem que fluir por todo o cálculo de posição/drop, senão alargar um nó sobrepõe os filhos ou desalinha o drop.

**Acceptance Criteria:**

1. WHEN um nó tem largura X THEN o `d3-flextree` (`computeTreeLayout`) SHALL espaçar seus **filhos** após X (não após `NODE_WIDTH` fixo), e `PositionedNode.width` SHALL ser X.
2. WHEN as larguras de irmãos diferem THEN as colunas SHALL ficar **escalonadas por nó** (comportamento natural do flextree), sem sobreposição entre nó e filhos.
3. WHEN o usuário arrasta um nó para reposicionar (drag-to-place) THEN os **slots** (`colX`) e a **barra-fantasma** SHALL ser computados a partir das **larguras reais** (do pai/vizinhos e do nó arrastado), não da constante.
4. WHEN um nó é redimensionado THEN `bounds`/`fitView` e as âncoras das edges SHALL refletir a nova largura.

**Independent Test:** Alargar um nó com filhos → os filhos deslocam para a direita sem sobrepor; arrastar outro nó perto dele → a barra-fantasma aparece na coluna certa, dimensionada pela largura real.

---

### P1: Full-stack — schema, contrato e gates ⭐ MVP

**User Story:** Como mantenedor, quero a coluna `width` no schema, no DTO compartilhado e no endpoint, com migration e testes, para a feature ser íntegra de ponta a ponta sem regressão.

**Why P1:** É a metade full-stack do milestone; sem ela a largura não persiste e o contrato fica inconsistente.

**Acceptance Criteria:**

1. WHEN a migration roda THEN a tabela `Node` SHALL ganhar a coluna `width Int?` (nullable, sem default no banco — `null` = usa o default do front), sem afetar dados existentes (todos `null`).
2. WHEN o `NodeDto` e o `UpdateNodeBody` (em `packages/shared`) são usados THEN SHALL incluir `width` (`number | null` no DTO; `width?: number` no update), e o mapper `toNodeDto` SHALL mapear o campo.
3. WHEN `PATCH /nodes/:id` recebe `width` THEN o Zod schema SHALL validá-lo (inteiro positivo; limites de sanidade a definir em `design.md`) e persistir; demais campos do PATCH **intactos**.
4. WHEN `pnpm typecheck && pnpm lint && pnpm test` roda THEN SHALL passar; unit **web** (layout/slots com largura por nó; cap de largura) e **api** (PATCH aceita/valida `width`; mapper) SHALL ser atualizados/adicionados.
5. WHEN `pnpm test:e2e` roda THEN os specs SHALL seguir verdes; **um** smoke novo SHALL cobrir resize + persistência (arrastar a alça, recarregar, conferir a largura). Atenção ao isolamento de DB do Playwright (L-007 — `.env` aponta pra prod pós-AD-022): o smoke roda contra o banco de teste, não o de produção.

**Independent Test:** Rodar a tríade + e2e; aplicar a migration; `PATCH` um nó com `width` e ler de volta via `GET /maps/:id/nodes` — o valor persiste.

---

## Edge Cases

- WHEN o nó é a **raiz** com título longo THEN a alça de resize SHALL valer também para a raiz (largura por nó vale para todos, inclusive a raiz — como no M12).
- WHEN o usuário dá um clique simples na alça (sem arrastar) THEN NÃO SHALL haver mudança de largura nem efeito colateral (sem reset — decisão 2026-06-27).
- WHEN o texto é editado depois de um resize, ficando **mais curto** que a largura gravada THEN o card SHALL manter a largura gravada (sobra espaço) **ou** clampar ao novo teto de conteúdo — comportamento único definido em `design.md`; não SHALL quebrar o layout.
- WHEN o texto é editado ficando **mais longo** THEN dentro da largura gravada o texto reflui em mais linhas (altura cresce, M12); a largura gravada não muda sozinha.
- WHEN muitos nós são redimensionados/medidos em sequência THEN NÃO SHALL haver loop medir↔layout (invariante: largura é input, não output do layout).
- WHEN a `width` persistida vem corrompida/fora de faixa (defensivo) THEN o front SHALL aplicar clamp ao [piso, teto] ou cair no default, sem crash.
- WHEN o nó está **colapsado** THEN sua largura SHALL valer para o card visível (a alça só aparece em nós renderizados; filhos ocultos não importam ao cap).

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M15-01 | Alça de resize revelada no hover na borda direita | P1 | Pending |
| M15-02 | Arrastar a alça muda a largura do nó em tempo real (texto reflui) | P1 | Pending |
| M15-03 | Resize isola o evento; não dispara drag-to-place | P1 | Pending |
| M15-04 | Largura muda → texto reflui → altura se reajusta (M12), sem loop | P1 | Pending |
| M15-05 | `width = null` renderiza no default 180 (zero regressão) | P1 | Pending |
| M15-06 | Soltar a alça persiste via `PATCH /nodes/:id` com `width` | P1 | Pending |
| M15-07 | Update otimista da largura + rollback em erro | P1 | Pending |
| M15-08 | Reabrir o mapa restaura a `width` por nó | P1 | Pending |
| M15-09 | Backend valida/grava inteiro positivo em `width`; retorna no DTO | P1 | Pending |
| M15-10 | Nó novo nasce com `width = null` | P1 | Pending |
| M15-11 | Teto da largura = conteúdo numa linha (sem espaço em branco à direita) | P1 | Pending |
| M15-12 | Piso mínimo de largura | P1 | Pending |
| M15-13 | Faixa degenerada (conteúdo < piso) tratada com graça | P1 | Pending |
| M15-14 | Largura gravada > teto atual não quebra o layout (clamp/efeito def. design) | P1 | Pending |
| M15-15 | `computeTreeLayout` espaça filhos pela largura do pai; `PositionedNode.width` por nó | P1 | Pending |
| M15-16 | Colunas escalonadas por nó (sem sobreposição), sem alinhar por profundidade | P1 | Pending |
| M15-17 | `slots.ts` (colX/ghost) usa larguras reais do pai/vizinhos/nó arrastado | P1 | Pending |
| M15-18 | `bounds`/`fitView`/âncoras de edge refletem a largura nova | P1 | Pending |
| M15-19 | Migration adiciona `width Int?` (nullable, dados existentes intactos) | P1 | Pending |
| M15-20 | `NodeDto`/`UpdateNodeBody` + mapper incluem `width` | P1 | Pending |
| M15-21 | Zod do PATCH valida `width`; demais campos intactos | P1 | Pending |
| M15-22 | `typecheck && lint && test` verde; unit web+api atualizados | P1 | Pending |
| M15-23 | e2e verdes + 1 smoke de resize/persistência (DB de teste, L-007) | P1 | Pending |
| M15-24 | Raiz também redimensionável; clique simples na alça sem efeito | P1 | Pending |

**Coverage:** 24 requisitos — todos P1.

---

## Success Criteria

- [ ] Passar o mouse sobre qualquer nó revela a alça na borda direita; arrastá-la redimensiona o card e o texto reflui em tempo real.
- [ ] A largura não passa do necessário para o texto caber numa linha (teto de conteúdo) nem fica abaixo de um piso legível.
- [ ] Soltar a alça persiste a largura; recarregar o mapa restaura cada largura; nós nunca redimensionados seguem em 180px.
- [ ] Alargar um nó com filhos não sobrepõe os filhos; a barra-fantasma de drop usa a largura real; `fitView` enquadra tudo.
- [ ] Resize nunca aciona o drag-to-place; sem loop medir↔layout.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa (web + api); migration aplicada; e2e verdes + 1 smoke de resize.
- [ ] Smoke visual (screenshot Playwright) confirma a alça e um card redimensionado + reflow (gate L-005).
- [ ] Diff full-stack consciente: migration + `width` em schema/DTO/endpoint/mutation + largura-por-nó no front. AD-002 revisada parcialmente (1 dado estrutural, sem x/y) — registrar **AD-023**.

---

## Skills Aplicáveis (executor)

- **`mindmap-canvas`** — skill central: layout (`d3-flextree`), nós HTML, slots/drag, viewport. A largura-por-nó atravessa `useTreeLayout`/`slots.ts`/ghost/`MindNode` — domínio dela.
- **`api-backend`** — coluna `width` no schema/migration, `PATCH /nodes/:id` (Zod + Prisma), mapper, testes de integração da API.
- **`web-api-integration`** — `UpdateNodeBody` com `width`, mutation otimista no `useUpdateNode`.
- **`web-component-creation`** — a alça de resize como controle no `MindNode` (hover, pointer handlers, acessibilidade).

---

## Notas para Design (próxima fase)

Pontos a fechar em `design.md` (verificar APIs/limites — não assumir; Knowledge Verification Chain):

- **Mecanismo do teto de conteúdo.** Como medir "largura para o texto caber numa linha": `scrollWidth`/`max-content` do título (e do rodapé de tarefa, que pode ser mais largo), reusando ou estendendo a infra de medição do M12 (`useMeasuredHeights` → talvez `useMeasuredSizes` com largura). Cuidado para a medição de largura **não** realimentar a largura escolhida (invariante). Considerar o rodapé (status+label+avatar) como possível elemento mais largo que o título.
- **Piso mínimo.** Valor concreto (~120px? o suficiente para a toolbar de 3 botões + ▲ crítico). Justificar.
- **Gesto de drag da alça.** Pointer events na borda direita do `MindNode` (cursor `ew-resize`), `setPointerCapture`, conversão de delta de tela → delta de mundo pela matriz de zoom do visx (a barra-fantasma e os nós HTML já compartilham essa matriz — ver M9/M13). Estado local de largura durante o arraste (sem persistir a cada pixel) → persistir só no `pointerup`. Isolar de `useNodeDrag` (stopPropagation / não iniciar drag-to-place).
- **Threading da largura no layout.** `nodeSize` do d3-flextree: depth vira `nodeWidth(n) + GAP_X`; `PositionedNode.width` por nó; offsets de x em `computeTreeLayout` que hoje somam `NODE_WIDTH`. Mapear cada uso (relatório de exploração: `useTreeLayout.ts:5,95,97,112,126,127,130,138`).
- **`slots.ts`.** `colX = parentPos.x + dir*(parentWidth + GAP_X)` (largura do pai, não constante); `SLOT_MAX_DISTANCE` e `colCenter` por largura real; ghost no `MapCanvas` (`:145`) dimensionado pela largura do nó arrastado. Coordenar com a band vertical do M13 (não regredir).
- **Persistência da largura gravada vs. teto atual.** Definir o comportamento único quando `width` gravada > teto de conteúdo após edição (manter com espaço vs. clamp no render). Documentar como invariante.
- **Backend.** Tipo/limites do Zod (`z.number().int().positive()` + max de sanidade alinhado ao teto de UI? ou só positivo, deixando o cap no front?); migration nullable sem default. Testes de integração: PATCH aceita `width`, rejeita inválido, mapper devolve.
- **Default.** `NODE_WIDTH` permanece como o fallback de `width=null` (não remover a constante; ela vira o default, não a verdade única).
- **AD-023.** Registrar na execução: largura persistida revisa parcialmente AD-002 (mesmo precedente do `side`/AD-018).
