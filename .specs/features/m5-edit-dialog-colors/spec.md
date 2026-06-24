# M5 — Dialog de Edição e Cores (US-03)

## Problem Statement

Todos os nós do mindmap são visualmente idênticos — mesma cor de fundo, mesmo texto. O schema já suporta `bgColor` e `textColor` mas nenhum deles é exibido ou editável via UI. A única forma de interagir com um nó é o rename inline (click no texto) e os botões de add/delete/collapse. Falta um ponto de entrada para editar propriedades visuais (e, futuramente em M6, propriedades de tarefa).

M5 entrega: (1) um dialog de edição estilo Trello que centraliza as propriedades do nó, (2) paleta fixa de swatches para `bgColor` e `textColor` (AD-005), (3) aplicação imediata no canvas com persistência via API.

## Goals

- [ ] Dialog de edição abre a partir de qualquer nó no canvas, exibindo título editável e controles de cor.
- [ ] Paleta fixa de swatches para cor de fundo e cor de texto (sem color picker livre — AD-005).
- [ ] Alterações de cor refletem imediatamente no canvas (optimistic update, padrão M4).
- [ ] Cores são persistidas via `PATCH /nodes/:id` e restauradas ao reabrir o mapa.
- [ ] Dialog é extensível para receber propriedades de tarefa em M6 sem refactor.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa. Specs e2e do milestone passam (AD-014).

## Out of Scope

| Item | Motivo |
| --- | --- |
| Color picker livre (hex/RGB) | AD-005 — paleta fixa é constraint do spec |
| Propriedades de tarefa (status, responsável, prioridade) | M6 |
| Cor de borda ou forma do nó | Não está na US-03; pode virar deferred idea |
| Aplicar cor a subárvore inteira (bulk) | Refinamento de UX pós-v1 |
| Undo de cor (ctrl+z) | Fora de v1 (undo persistente é deferred) |
| Edição de cor do nó raiz | Nó raiz pode receber cores como qualquer outro — sem restrição |

---

## Decisões Incorporadas

1. **Paleta fixa de swatches** (AD-005): grid de botões coloridos; sem input hex. A paleta concreta (quantidade, tons) é decisão de implementação — o spec define o mecanismo, não as cores exatas.
2. **`PATCH /nodes/:id` vira update parcial**: body passa de `{ title: string }` para campos opcionais `{ title?, bgColor?, textColor? }`. Pelo menos um campo deve estar presente. Prepara o endpoint para M6 (task props) sem breaking change.
3. **Trigger do dialog — botão dedicado no nó**: um ícone (ex: `Palette` ou `Settings`) aparece na barra de ações do `MindNode`. Click-no-texto continua sendo inline edit (não quebra UX existente). Double-click continua funcionando. O dialog é o ponto de entrada _complementar_ ao rename inline.
4. **Dialog edita título também**: além de cores, o dialog exibe o título do nó em um campo editável. Permite rename sem depender do inline. Justificativa: coerência com modelo Trello ("card detail edita tudo"), e prepara terreno para M6.
5. **Optimistic updates para cores**: mesmo padrão de M4 (`onMutate` → cache snapshot → rollback em erro). A mutation de update já existe; só precisa tratar os novos campos.
6. **Cores aplicadas via `style` inline no `MindNode`**: `bgColor` vira `backgroundColor`, `textColor` vira `color`. Quando null, o nó usa os estilos padrão do Tailwind (theme-aware). Sem override de classes — inline style tem precedência.

---

## User Stories

### P1: Dialog de edição de nó ⭐ MVP

**User Story:** Como usuário, quero abrir um dialog de edição ao interagir com um nó, para acessar propriedades que não cabem no inline do canvas.

**Why P1:** É o container para toda edição de propriedades (cores agora, task props em M6). Sem ele não há como expor os controles de cor.

**Acceptance Criteria:**

1. WHEN o usuário clica no botão de edição (ícone) de um nó THEN o sistema SHALL abrir um dialog modal centralizado com o título do nó como heading editável.
2. WHEN o dialog está aberto THEN o sistema SHALL exibir seções de "Cor de fundo" e "Cor de texto", cada uma com a paleta de swatches.
3. WHEN o usuário edita o título no dialog e confirma (Enter ou blur) THEN o título SHALL atualizar no canvas imediatamente (optimistic) e persistir via API.
4. WHEN o usuário fecha o dialog (botão X, Escape, ou click no overlay) THEN o dialog SHALL fechar sem efeitos colaterais — alterações já aplicadas por swatch permanecem.
5. WHEN o dialog está aberto THEN o canvas por trás SHALL ficar visível mas não-interativo (overlay escurece o fundo).

**Independent Test:** Abrir o mapa, clicar no botão de edição de um nó, ver o dialog abrir com o título correto. Editar o título, fechar o dialog, ver o título atualizado no canvas.

---

### P1: Paleta de cores com swatches ⭐ MVP

**User Story:** Como usuário, quero escolher cor de fundo e cor de texto a partir de uma paleta visual de swatches, para diferenciar nós sem precisar saber códigos hex.

**Why P1:** É o core da US-03 — a forma de aplicar cores.

**Acceptance Criteria:**

1. WHEN o dialog de edição exibe a seção de cor THEN o sistema SHALL renderizar um grid de swatches (botões coloridos) com cores predefinidas.
2. WHEN o usuário clica num swatch de "Cor de fundo" THEN o `bgColor` do nó SHALL atualizar imediatamente (optimistic) para o valor hex do swatch. O swatch selecionado SHALL exibir indicador visual de seleção (ex: borda, checkmark).
3. WHEN o usuário clica num swatch de "Cor de texto" THEN o `textColor` do nó SHALL atualizar imediatamente (optimistic) para o valor hex do swatch. O swatch selecionado SHALL exibir indicador visual de seleção.
4. WHEN o nó não tem cor personalizada (bgColor=null) THEN nenhum swatch SHALL estar selecionado; um botão "Padrão" ou primeiro swatch representando "sem cor" SHALL estar disponível.
5. WHEN o usuário seleciona "Padrão" / limpa a cor THEN o sistema SHALL enviar `bgColor: null` (ou `textColor: null`) e o nó SHALL voltar ao estilo padrão do tema.

**Independent Test:** Abrir dialog, clicar num swatch azul para fundo, ver o nó no canvas mudar de cor imediatamente. Recarregar a página, ver que a cor persiste.

---

### P1: Aplicação imediata no canvas ⭐ MVP

**User Story:** Como usuário, quero ver a cor aplicada no nó em tempo real ao selecionar um swatch, para ter feedback visual instantâneo.

**Why P1:** US-03 exige "alterações se refletem imediatamente no canvas".

**Acceptance Criteria:**

1. WHEN o `bgColor` de um nó é definido (não null) THEN o nó no canvas SHALL renderizar com `backgroundColor` igual ao valor hex. O texto e outros elementos internos SHALL manter contraste legível.
2. WHEN o `textColor` de um nó é definido (não null) THEN o texto do título no canvas SHALL renderizar com `color` igual ao valor hex.
3. WHEN ambos `bgColor` e `textColor` são null THEN o nó SHALL renderizar com os estilos padrão do tema (classes Tailwind `bg-card text-foreground`).
4. WHEN o usuário seleciona um swatch THEN a atualização no canvas SHALL ser optimistic — visível antes da resposta da API.
5. WHEN a API retorna erro THEN a cor SHALL reverter ao valor anterior (rollback do optimistic update) e um toast de erro SHALL aparecer (padrão M4).

**Independent Test:** Com throttle de 2s na rede, selecionar um swatch; ver a cor mudar instantaneamente no canvas; após 2s confirmar que persistiu. Forçar erro na API; ver cor reverter + toast.

---

### P1: Persistência e restauração de cores ⭐ MVP

**User Story:** Como usuário, quero que as cores que defini sejam restauradas ao reabrir o mapa, para não perder personalização.

**Why P1:** US-03: "cores são persistidas e restauradas ao reabrir o mapa". Sem isso, a feature não tem valor.

**Acceptance Criteria:**

1. WHEN o usuário seleciona uma cor de fundo THEN o sistema SHALL enviar `PATCH /nodes/:id` com `{ bgColor: "<hex>" }` e o servidor SHALL persistir o valor.
2. WHEN o usuário seleciona uma cor de texto THEN o sistema SHALL enviar `PATCH /nodes/:id` com `{ textColor: "<hex>" }` e o servidor SHALL persistir o valor.
3. WHEN o usuário reabre o mapa (`GET /api/maps/:id/nodes`) THEN os nós SHALL retornar com `bgColor` e `textColor` preservados e o canvas SHALL renderizá-los com as cores corretas.
4. WHEN o `PATCH /nodes/:id` recebe campos parciais (ex: só `bgColor` sem `title`) THEN o servidor SHALL atualizar apenas os campos enviados, sem alterar os demais.
5. WHEN o `PATCH /nodes/:id` recebe `{ bgColor: null }` THEN o servidor SHALL setar `bgColor` para null (reset).

**Independent Test:** Setar bgColor e textColor em dois nós. Navegar para a lista de mapas, voltar ao mapa. Ver que as cores estão preservadas. F5 para forçar reload completo — cores ainda intactas.

---

### P2: Acessibilidade mínima do dialog e swatches

**User Story:** Como usuário, quero navegar o dialog e selecionar cores via teclado, para não depender exclusivamente do mouse.

**Why P2:** Boa prática, mas não bloqueia lançamento. Refinamento de UX.

**Acceptance Criteria:**

1. WHEN o dialog abre THEN o foco SHALL ir para o campo de título.
2. WHEN o usuário pressiona Tab THEN o foco SHALL percorrer: título → swatches de bg → swatches de texto → botão fechar.
3. WHEN um swatch tem foco e o usuário pressiona Enter/Space THEN o swatch SHALL ser selecionado (mesmo comportamento de click).
4. WHEN o usuário pressiona Escape THEN o dialog SHALL fechar.

**Independent Test:** Abrir dialog via teclado (se possível), Tab até um swatch, pressionar Enter, ver cor aplicada.

---

## Edge Cases

- WHEN o usuário seleciona múltiplas cores rapidamente (clica 5 swatches em sequência) THEN cada seleção SHALL disparar um PATCH independente. O último a resolver vence (last-write-wins). Não há debounce — cada clique é uma ação deliberada.
- WHEN o texto do nó é escuro e o usuário seleciona um `bgColor` escuro SEM alterar `textColor` THEN o texto pode ficar ilegível. O spec não exige ajuste automático de contraste — responsabilidade do usuário. A paleta deve oferecer opções claras e escuras tanto para bg quanto para texto para mitigar.
- WHEN o nó tem `bgColor` definido mas `textColor` null THEN o texto usará a cor padrão do tema (`text-foreground`). Se o tema for escuro e o bg for escuro, pode ficar ilegível. Novamente, responsabilidade do usuário via seleção de textColor.
- WHEN o dialog está aberto e outra aba/sessão modifica o mesmo nó THEN última escrita vence (single-user, same-browser; sync entre abas fora de escopo — AD-010/M4).
- WHEN o dialog é aberto para o nó raiz THEN o dialog SHALL funcionar normalmente — nó raiz pode ter cores como qualquer outro.
- WHEN o usuário edita o título no dialog para string vazia e confirma THEN o sistema SHALL rejeitar (manter título anterior), mesmo comportamento do inline edit.

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M5-01 | Dialog — botão de edição no nó abre dialog | P1 | Pending |
| M5-02 | Dialog — título editável no dialog | P1 | Pending |
| M5-03 | Dialog — seções de cor de fundo e cor de texto | P1 | Pending |
| M5-04 | Dialog — fechar via X, Escape ou overlay | P1 | Pending |
| M5-05 | Dialog — overlay escurece canvas | P1 | Pending |
| M5-06 | Swatches — grid de cores predefinidas | P1 | Pending |
| M5-07 | Swatches — click aplica bgColor (optimistic) | P1 | Pending |
| M5-08 | Swatches — click aplica textColor (optimistic) | P1 | Pending |
| M5-09 | Swatches — indicador visual de seleção | P1 | Pending |
| M5-10 | Swatches — opção "Padrão" (null) disponível | P1 | Pending |
| M5-11 | Canvas — nó renderiza bgColor via inline style | P1 | Pending |
| M5-12 | Canvas — nó renderiza textColor via inline style | P1 | Pending |
| M5-13 | Canvas — fallback para estilo do tema quando null | P1 | Pending |
| M5-14 | Canvas — update optimistic ao selecionar swatch | P1 | Pending |
| M5-15 | Canvas — rollback + toast em erro de API | P1 | Pending |
| M5-16 | API — PATCH aceita bgColor/textColor (parcial) | P1 | Pending |
| M5-17 | API — reset via null | P1 | Pending |
| M5-18 | Restauração — GET retorna cores, canvas renderiza | P1 | Pending |
| M5-19 | A11y — foco no título ao abrir | P2 | Pending |
| M5-20 | A11y — Tab order: título → swatches bg → swatches texto → fechar | P2 | Pending |
| M5-21 | A11y — Enter/Space seleciona swatch focado | P2 | Pending |
| M5-22 | A11y — Escape fecha dialog | P2 | Pending |

**Coverage:** 22 requisitos — 18 P1, 4 P2.

---

## Success Criteria

- [ ] Botão de edição visível em cada nó. Click abre dialog com título e paletas de cor.
- [ ] Selecionar swatch muda a cor do nó no canvas instantaneamente (optimistic). Cor persiste após F5.
- [ ] Selecionar "Padrão" remove a cor — nó volta ao estilo do tema.
- [ ] Editar título no dialog atualiza o nó no canvas e persiste.
- [ ] Forçar erro na API: cor reverte + toast de erro (padrão M4).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa.
- [ ] Specs e2e do milestone passam (AD-014).
- [ ] Dialog fecha via X, Escape ou overlay sem efeitos colaterais.

---

## Skills Aplicáveis (executor)

- **`react-flow`** — renderização de cores nos nós customizados, integração do dialog com estado do canvas.
- **`web-api-integration`** — mutation de update estendida (parcial), optimistic update para cores.
- **`web-component-creation`** — componente NodeEditDialog, componente ColorPalette/SwatchGrid.
- **`api-backend`** — extensão do `PATCH /nodes/:id` para aceitar campos parciais, validação Zod.
