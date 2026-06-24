# M9 — Drag-to-place unificado (reorder + reparent posicionado + lado persistido)

## Problem Statement

Hoje o drag do canvas só faz **reparent appendado**: soltar um nó sobre outro o torna filho no final; soltar no vazio dá snap-back. Não há como **reordenar irmãos** nem **escolher a posição** ao mover, e o **lado** (esq/dir) de cada ramo é recalculado por peso a cada render (M8/AD-016) — o usuário não consegue fixar um ramo de um lado.

M9 unifica o gesto de arraste num único modelo **"soltar num slot"**: todo drop define `(pai, posição)` e, para filhos de 1º nível, também o **lado**. Reorder, reparent-com-posição e troca de lado passam a ser o mesmo gesto, com um **card-fantasma** indicando onde o nó vai cair. É a materialização da Deferred Idea de "posicionamento dos nós" que, sob auto-layout (AD-017), colapsou em controle de **ordem + pai + lado** — sem nunca persistir coordenadas `x/y` livres.

## Goals

- [ ] Arrastar qualquer nó (exceto a raiz) e soltá-lo numa **posição específica** entre/sob irmãos, com uma única mutação `move({ parentId, index })`.
- [ ] **Reparent já posicionado**: soltar sob outro pai coloca o nó no `index` indicado, não só no final.
- [ ] **Lado persistido**: filhos de 1º nível têm um lado (esq/dir) armazenado; o usuário pode arrastar um ramo para o outro lado e ele **permanece** lá após reload, inclusive deixando tudo de um lado.
- [ ] O **balanceamento por peso (AD-016)** é rebaixado a **heurística de criação** — escolhe o lado default de um nó novo de 1º nível; não re-equilibra nós existentes.
- [ ] **Card-fantasma** durante o arraste indica o slot-alvo (qual pai, qual posição/lado) antes de soltar — estilo MindMeister.
- [ ] `fitView`, edição inline, collapse/expand, add/delete, dialog e indicadores seguem funcionando (paridade). `pnpm typecheck && pnpm lint && pnpm test` passa; e2e seguem verdes + novos casos de drag.

## Out of Scope

| Item | Motivo |
| --- | --- |
| **Posições `x/y` livres** | AD-002 mantida no essencial: persiste-se apenas 1 bit de **lado** por nó de 1º nível (estrutural, não coordenada). Nada de arrastar-e-fixar em pixel arbitrário. |
| **Toggle/alternância de direção do layout** | AD-016 — direção segue fixa (bidirecional horizontal). M9 não adiciona UI de direção. |
| **Radial 360°** | Já descartado em AD-016. |
| **Reorder/move por teclado** (Tab/setas) | Continua Deferred Idea (atalhos de canvas). M9 é só drag. |
| **Multi-seleção / arrastar vários nós** | Um nó por gesto. Seleção múltipla é feature futura. |
| **Undo do move** | Sem histórico/undo nesta feature (segue Deferred). O snap-back só cobre drop inválido. |
| **Animação de transição do reflow** | Ao soltar, o layout reflui (re-render); animar essa transição é polish futuro. O card-fantasma cobre o feedback durante o gesto. |
| **Renumeração de `sortOrder` no DELETE** | Continua Deferred (gaps tolerados). M9 mexe em ordem via move, não no delete. |

---

## Decisões Incorporadas

1. **Gesto unificado "soltar num slot"** (decisão do usuário, 2026-06-24): durante o arraste, calcula-se o slot `(pai, posição)` mais próximo do cursor; o drop chama `move({ parentId, index })` uma única vez. Reorder (mesmo pai), reparent-posicionado (outro pai) e set de lado (slot de 1º nível) são o mesmo gesto. Substitui a regra anterior "hover no card = reparent / fora = reorder", que ficou redundante.
2. **Lado persistido — modelo (b)** (decisão do usuário, 2026-06-24): o lado (esq/dir) de um ramo de 1º nível é **estado armazenado** no Node, não derivado por peso a cada render. Arrastar através do centro troca o lado e persiste. → nova decisão **AD-018** (a formalizar no STATE.md na execução), que **revisa AD-016** e **revisa parcialmente AD-002**.
3. **Balance vira default de criação** (decisão do usuário, 2026-06-24): a heurística de split balanceado (hoje em `splitChildren`, frontend) migra para o **create** no backend — escolhe o lado mais leve para um novo filho de 1º nível. Não atua sobre nós já posicionados.
4. **Card-fantasma no MVP** (decisão do usuário, 2026-06-24): indicador visual de drop estilo MindMeister, mostrando o slot-alvo durante o gesto. É parte do MVP, não polish adiado.
5. **Lado é propriedade do ramo de 1º nível**: só filhos diretos da raiz têm lado significativo; níveis profundos herdam o lado do seu ancestral de 1º nível. (O campo pode existir em todo Node por simplicidade de schema, mas só é consultado para `parentId === root`.)
6. **Backend de `move` já cobre `parentId` + `index`** (AD-008/AD-011): clamp de index, anti-ciclo (`WITH RECURSIVE`), renumeração transacional de `sortOrder`. M9 reusa; a única extensão de backend é o tratamento de **lado** (no create e ao virar/deixar de ser filho de 1º nível) + o campo no schema.
7. **AD-002 preservada no essencial**: sem `x/y`. O único dado de layout que passa a persistir é o lado (1 bit), de natureza estrutural ("em qual lado do centro este ramo vive"), não posicional.

---

## User Stories

### P1: Lado persistido, balance só na criação ⭐ MVP

**User Story:** Como usuário, quero que o lado (esquerda/direita) de cada ramo seja meu para controlar e que ele permaneça onde eu deixei ao reabrir o mapa, para organizar o mindmap como eu quiser — inclusive tudo de um lado.

**Why P1:** É a fundação. Sem lado persistido, qualquer troca de lado por drag seria desfeita no próximo layout.

**Acceptance Criteria:**

1. WHEN um novo nó de 1º nível é criado THEN o sistema SHALL atribuir um lado default pela heurística de balance (lado de menor peso no momento) e persistir esse lado.
2. WHEN um mapa é (re)aberto THEN o layout SHALL posicionar cada ramo de 1º nível no lado **armazenado**, sem recalcular o split por peso.
3. WHEN todos os ramos de 1º nível têm o mesmo lado armazenado THEN o layout SHALL renderizá-los todos desse lado, sem forçar equilíbrio.
4. WHEN um nó profundo (não-1º-nível) é renderizado THEN ele SHALL herdar o lado do seu ramo de 1º nível (sem lado próprio).
5. WHEN o mapa tem só a raiz THEN renderiza 1 nó centrado, sem lados nem edges.

**Independent Test:** Criar vários nós de 1º nível (caem em lados alternados/balanceados por criação); recarregar — todos no mesmo lado de antes. Via API, setar todos para `right`; recarregar — todos à direita.

---

### P1: Drag-to-place unificado (pai + posição numa mutação) ⭐ MVP

**User Story:** Como usuário, quero arrastar um nó e soltá-lo numa posição específica entre os irmãos (sob o pai atual ou outro pai), para reordenar e mover com precisão num só gesto.

**Why P1:** É o coração da feature — reorder e reparent-posicionado unificados.

**Acceptance Criteria:**

1. WHEN o usuário arrasta um nó e solta num slot sob o **mesmo pai** THEN o sistema SHALL chamar `move({ parentId: paiAtual, index })` mudando apenas o `sortOrder` (reorder).
2. WHEN o usuário solta num slot sob **outro pai** THEN o sistema SHALL chamar `move({ parentId: novoPai, index })`, reparentando o nó **na posição indicada** (não no final).
3. WHEN o usuário solta num slot de **1º nível** (filho direto da raiz) THEN o sistema SHALL definir o **lado** do nó = lado daquele slot, além de `parentId=root` e `index`.
4. WHEN o slot-alvo é exatamente a posição/pai atuais do nó THEN o sistema SHALL tratar como **no-op** (sem chamada de move).
5. WHEN o drop resultaria em mover o nó para **si mesmo ou um descendente** THEN o sistema SHALL impedir (sem slot válido oferecido; backend rejeita como salvaguarda — 400).
6. WHEN o gesto é um **clique** (abaixo do limiar de drag) THEN o comportamento de clique (editar/selecionar) SHALL ocorrer, sem move (preserva o limiar atual de `useNodeDrag`).
7. WHEN a raiz é o nó arrastado THEN o sistema SHALL impedir o arraste (raiz não se move — comportamento atual).

**Independent Test:** Arrastar um irmão para cima/baixo entre irmãos → reordena; arrastar para sob outro pai numa posição do meio → vira filho ali; arrastar para um slot do outro lado da raiz → muda de lado. Recarregar confirma persistência.

---

### P1: Card-fantasma indicando o slot-alvo ⭐ MVP

**User Story:** Como usuário, quero ver durante o arraste um card-fantasma no lugar onde o nó vai cair, para entender o que vai acontecer (qual pai, qual posição/lado) antes de soltar.

**Why P1:** Resolve visualmente a ambiguidade do gesto unificado; o usuário pediu explicitamente o feedback estilo MindMeister como parte do MVP.

**Acceptance Criteria:**

1. WHEN o usuário está arrastando e o cursor está sobre um slot válido THEN o sistema SHALL exibir um **card-fantasma** na posição/lado daquele slot.
2. WHEN o slot-alvo muda durante o arraste THEN o card-fantasma SHALL atualizar para o novo slot em tempo real.
3. WHEN não há slot válido sob o cursor THEN o sistema SHALL não exibir card-fantasma (e o drop nesse ponto é no-op/snap-back).
4. WHEN o nó é solto THEN o card-fantasma SHALL desaparecer e o nó SHALL assumir o slot indicado (consistência entre o que o fantasma mostrou e o resultado).

**Independent Test:** Iniciar um arraste e mover o cursor entre posições — o card-fantasma acompanha os slots; soltar coloca o nó exatamente onde o fantasma estava.

---

### P1: Paridade de interação e gates preservados ⭐ MVP

**User Story:** Como mantenedor, quero que edição, collapse, fitView, add/delete, dialog e os testes continuem funcionando após o novo modelo de drag, para confiar que nada regrediu.

**Why P1:** Mudança de interação + schema não pode regredir o resto (L-001, AD-013).

**Acceptance Criteria:**

1. WHEN o usuário colapsa/expande, edita inline, adiciona/exclui, abre dialog, vê indicadores THEN tudo SHALL funcionar como antes (paridade).
2. WHEN o mapa abre THEN o `fitView` SHALL enquadrar a árvore inteira (bounds bilaterais, agora a partir do lado persistido).
3. WHEN `pnpm typecheck && pnpm lint && pnpm test` roda THEN SHALL passar; os unit tests de layout SHALL cobrir o consumo do lado persistido e o cálculo de slot.
4. WHEN `pnpm test:e2e` roda THEN os specs existentes SHALL seguir verdes e SHALL haver novos casos cobrindo reorder, reparent-posicionado e troca de lado com persistência (AD-014).
5. WHEN o schema muda THEN SHALL haver migration aplicável e os testes de API SHALL cobrir o default de lado no create e o move com `index`/lado.

**Independent Test:** Rodar a tríade + e2e; exercitar manualmente edição/collapse/add/delete no novo layout — tudo verde e funcional.

---

### P2: Heurística de balance refinada na criação

**User Story:** Como usuário, quero que nós novos de 1º nível caiam num lado sensato (não sempre o mesmo), para o mapa começar equilibrado antes de eu reorganizar.

**Why P2:** Melhora a experiência inicial, mas o MVP funciona mesmo com um default simples (ex.: alternar lados). O equilíbrio "perfeito" não é crítico já que o usuário reorganiza à mão.

**Acceptance Criteria:**

1. WHEN um novo filho de 1º nível é criado THEN o lado default SHALL ser o de **menor peso** (contagem de nós visíveis) no momento; empate → direita (determinístico).
2. WHEN o usuário já moveu ramos manualmente THEN a heurística SHALL respeitar os lados atuais ao calcular o peso de cada lado (não sobrescreve escolhas do usuário).

**Independent Test:** Com um lado já pesado por escolha do usuário, criar um nó novo → cai no lado mais leve.

---

## Edge Cases

- WHEN o usuário solta exatamente na origem do nó (mesma posição/pai) THEN no-op, sem move nem flicker.
- WHEN o usuário arrasta um nó de 1º nível para virar filho de um nó profundo THEN ele **perde** o lado (vira interno, herda o lado do novo ramo).
- WHEN um nó profundo é arrastado para um slot de 1º nível THEN ele **ganha** lado = o do slot e `parentId=root`.
- WHEN um lado fica sem nós após um move THEN o outro lado renderiza normal e o `fitView` enquadra só o que existe.
- WHEN o `index` calculado excede o range de irmãos THEN o backend clampa para o final (comportamento atual de `move`).
- WHEN o drag termina fora de qualquer slot válido THEN snap-back (sem move), como hoje no drop inválido.
- WHEN dois slots estão muito próximos (irmãos de alturas distintas) THEN o slot escolhido SHALL ser o de menor distância do cursor, de forma determinística.
- WHEN o nó arrastado é solto sobre sua própria subárvore THEN nenhum slot válido é oferecido ali.

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M9-01 | Campo de lado no schema do Node (+ migration) | P1 | Pending |
| M9-02 | Create atribui lado default por balance e persiste | P1 | Pending |
| M9-03 | Layout lê lado armazenado (não recalcula split por peso) | P1 | Pending |
| M9-04 | Todos de um lado é permitido (sem forçar equilíbrio) | P1 | Pending |
| M9-05 | Nó profundo herda lado do ramo de 1º nível | P1 | Pending |
| M9-06 | Só raiz → 1 nó centrado, sem lados/edges | P1 | Pending |
| M9-07 | Drop no mesmo pai → reorder via `move({index})` | P1 | Pending |
| M9-08 | Drop em outro pai → reparent na posição (`parentId`+`index`) | P1 | Pending |
| M9-09 | Drop em slot de 1º nível → seta lado + parent + index | P1 | Pending |
| M9-10 | Drop na posição/pai atuais → no-op | P1 | Pending |
| M9-11 | Move para si/descendente impedido (frontend + 400 backend) | P1 | Pending |
| M9-12 | Limiar de drag vs. clique preservado | P1 | Pending |
| M9-13 | Raiz não arrastável | P1 | Pending |
| M9-14 | Card-fantasma no slot-alvo durante o arraste | P1 | Pending |
| M9-15 | Card-fantasma atualiza em tempo real ao mudar de slot | P1 | Pending |
| M9-16 | Sem slot válido → sem fantasma + no-op/snap-back | P1 | Pending |
| M9-17 | Consistência fantasma↔resultado ao soltar | P1 | Pending |
| M9-18 | Paridade: edição/collapse/add/delete/dialog/indicadores | P1 | Pending |
| M9-19 | `fitView` enquadra bounds bilaterais do lado persistido | P1 | Pending |
| M9-20 | Gates: typecheck/lint/unit verdes; unit de layout+slot | P1 | Pending |
| M9-21 | e2e: existentes verdes + novos (reorder/reparent/lado) | P1 | Pending |
| M9-22 | Testes de API: default de lado no create; move com index/lado | P1 | Pending |
| M9-23 | Balance default = lado mais leve, respeitando lados atuais | P2 | Pending |

**Coverage:** 23 requisitos — 22 P1, 1 P2.

---

## Success Criteria

- [ ] Arrastar um nó o coloca **exatamente** no slot que o card-fantasma indicou (mesmo pai = reorder; outro pai = reparent posicionado; outro lado = troca de lado).
- [ ] O lado de cada ramo **persiste** após reload; é possível deixar todos os ramos de um lado só.
- [ ] Nós novos de 1º nível caem num lado default sensato (balance só na criação), sem re-equilibrar os existentes.
- [ ] Edição, collapse, fitView, add/delete, dialog e indicadores funcionam idênticos a antes.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa; e2e verdes incl. novos casos; migration aplicável.
- [ ] AD-002 preservada no essencial: nenhum `x/y` persistido; apenas o bit de lado. AD-016 revisada (balance → criação). AD-018 registrada.

---

## Skills Aplicáveis (executor)

- **`mindmap-canvas`** — skill central: layout (d3-flextree, agora lendo lado persistido), edges SVG, drag/slot-hit-test, card-fantasma.
- **`api-backend`** — campo de lado no schema (Prisma), migration, default no create, tratamento de lado no `move`, testes de API.
- **`web-api-integration`** — a mutation `move` já existe (TanStack Query); ajustar payload/optimistic para `index`/lado.
- **`web-component-creation`** — caso o card-fantasma vire um componente próprio.

---

## Notas para Design (próxima fase)

- **Onde mora o lado:** campo `side` (enum `LEFT`/`RIGHT`, nullable) no Node — significativo só quando `parentId === rootId`. Avaliar nullable + default na criação vs. coluna não-nula. Como o layout decide o lado de um nó profundo (subir até o ancestral de 1º nível).
- **`sortOrder` por-lado vs. global:** sob a raiz, os filhos compartilham `parentId`; decidir se o `index`/`sortOrder` é interpretado por-lado (cada lado ordena seu grupo) ou global com filtro por lado no layout. Impacto no mapeamento "posição visual do slot → index" e na renumeração de `move`.
- **Cálculo de slots:** dado o `positioned` atual (top-left, bilateral), enumerar os slots `(pai, index)` válidos e achar o mais próximo do cursor (`zoom.applyInverseToPoint`). Reusar/estender `findDropTarget` (hoje binário on-node) para devolver slot, não só id. Slots de 1º nível existem nos dois lados, inclusive "primeiro nó de um lado vazio".
- **Card-fantasma:** componente posicionado pelo slot calculado, na mesma matriz de zoom dos nós HTML. Decidir estilo (outline/placeholder do tamanho do card). Não confundir com o nó-fantasma de offset que já segue o cursor (`ghostOffset`).
- **Backend do `move` + lado:** o `move` atual aceita `parentId`+`index`; estender para setar/limpar `side` quando o destino é/deixa de ser filho da raiz. Manter anti-ciclo e renumeração transacional (AD-008). Migrar `splitChildren` (peso) para o create.
- **Migration de dados existentes:** mapas já criados não têm lado — a migration precisa popular o `side` inicial (rodar a heurística de balance uma vez por mapa na migration, ou no primeiro load). Decidir.
- **Testes:** unit de layout (consumo de lado persistido; "todos de um lado"); unit do cálculo de slot (proximidade determinística, exclusão de auto/descendente); API (default no create, move com index/lado); e2e (reorder, reparent-posicionado, troca de lado + reload).
