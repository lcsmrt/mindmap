# M7 — Migração do Canvas para visx

## Problem Statement

O canvas do mindmap é renderizado hoje com `@xyflow/react` (React Flow). A biblioteca exibe uma atribuição/logo que só pode ser removida com licença Pro paga — **dealbreaker ético** para o usuário, que já removeu `proOptions.hideAttribution` em Q-005 justamente para manter a atribuição visível em vez de burlá-la.

M7 substitui o React Flow pela stack **visx** (`d3-hierarchy` para layout, SVG + `d3-shape` para edges, `d3-zoom` para pan/zoom), sob abordagem **híbrida**: as conexões são SVG, mas os nós continuam sendo o componente HTML `MindNode` (M5/M6) posicionado por cima. Ver **AD-015**.

**Esta migração é de paridade _funcional_.** Toda funcionalidade (edição, drag, collapse, dialog, indicadores, optimistic) deve se comportar como hoje, só que sem React Flow e sem logo. **Detalhes cosméticos não precisam ser idênticos** — direção do layout, estilo das edges e background ficam livres para o caminho de menor esforço (decisão do usuário, 2026-06-23). As queixas de UX (curvas mais naturais, *escolher* a direção do layout, reorganização livre) são **decisões adiadas conscientemente para depois da conversão** (ver Deferred Ideas no STATE.md) e **não fazem parte deste escopo** — "livre pelo menor esforço" aqui ≠ "resolver a queixa".

## Goals

- [ ] Canvas funciona com paridade total de comportamento usando visx no lugar do React Flow.
- [ ] Logo/atribuição do React Flow desaparece (remoção da dependência `@xyflow/react`).
- [ ] `elkjs` + web worker de layout são removidos; layout passa a usar `d3-hierarchy` (síncrono, O(n)).
- [ ] `MindNode` (M5/M6), `NodeEditDialog`, hooks de mutation (create/update/delete/move) e todo o backend permanecem **inalterados em comportamento** (MindNode perde apenas os imports de `Handle`/`Position`).
- [ ] Suíte e2e (Playwright) continua verde, com seletores migrados de `.react-flow__node` para uma classe/`data-testid` próprios.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa. Specs e2e do milestone passam (AD-014).

## Out of Scope

Explicitamente excluído para manter a migração focada em paridade.

| Item | Motivo |
| --- | --- |
| **Posicionamento livre / persistir x,y** | Decisão adiada pós-conversão (Deferred Ideas). AD-002 segue valendo: posições não são persistidas. |
| **Mudar a direção do layout** (vertical/radial/alternável) | Decisão adiada. Migração mantém **horizontal (esq→dir)** por paridade com hoje. |
| **Reorder entre irmãos via drag** (AD-011) | Já era deferred; revisitar junto com os pontos acima depois da conversão. M7 mantém só drag-to-reparent. |
| **Curvas de edge "mais naturais"** além da paridade | A migração replica o visual atual (curva equivalente ao `smoothstep`). Refino estético é decisão adiada. |
| **Highlight de drop target no drag** | Já era deferred (STATE.md). Comportamento atual = snap-back silencioso, preservado. |
| **DB de teste isolado para Playwright** | Concern conhecido (CONCERNS.md, Test Infrastructure); quick task separada. |
| **Fix do bug `persistence.spec.ts:136`** | Bug pré-existente (CONCERNS.md, Known Bugs). A migração apenas renomeia o seletor; **não** se compromete a consertar a fragilidade `.first()`. |
| **Backend / schema / endpoints** | Nada muda. M7 é só camada de canvas do frontend. |
| **Mudanças no `NodeEditDialog`** | Dialog é independente do React Flow; permanece como está. |

---

## Decisões Incorporadas

1. **Abordagem híbrida** (AD-015): SVG desenha as edges; os nós continuam sendo `MindNode` (HTML/React) posicionados absolutamente por cima da camada SVG, dentro do mesmo container transformado por pan/zoom. `MindNode` **não** vira SVG — todo o visual de M5/M6 (título, cores, rodapé de tarefa, botões, edição inline) é reusado.
2. **`d3-hierarchy` substitui elkjs** (AD-015): o layout passa a ser síncrono. `layout.worker.ts` é removido; `useLayoutedTree`/`treeLayout` são adaptados ou substituídos. O algoritmo concreto (ex.: `tree` com `nodeSize`, `flextree` para alturas variáveis, ou layout custom) é **decisão de design.md** — o spec só exige paridade visual e suporte às alturas variáveis de nó (40px sem rodapé / 58px com rodapé, ver `nodeSize.ts`).
3. **Direção do layout: livre, caminho de menor esforço** (decisão do usuário, 2026-06-23): não há exigência de manter a horizontal. O design escolhe a direção que sair mais barata com d3-hierarchy (provavelmente a default da lib). A decisão "qual direção ideal / alternável" segue adiada — aqui é só "o que der menos trabalho".
4. **Pan/zoom via `d3-zoom`** (ou `@visx/zoom`, que o embrulha): replica `panOnDrag`, `zoomOnScroll`, `minZoom=0.1`, `maxZoom=3` e o `fitView` inicial.
5. **Edges curvas via `d3-shape`** (`linkHorizontal` ou equivalente do `@visx/shape`): visual equivalente ao `smoothstep` atual. Parent→child.
6. **Background: livre** (decisão do usuário, 2026-06-23): não precisa replicar o grid pontilhado do React Flow. Qualquer fundo razoável (liso, grid simples, ou nenhum) — o que for mais fácil.
7. **Drag-to-reparent preservado**: arrastar um nó e, no drop, detectar sobreposição com outro nó (bounds) → `moveNode({ parentId })`. Raiz não arrasta. Drop inválido → refetch (snap-back). Mesma lógica de `handleNodeDragStop` atual, reimplementada sem React Flow.
8. **Estado de UI preservado**: `collapsedIds`, `editingId`, `deleteTarget`, `editDialogNodeId` e o pipeline `buildTree → visibleNodes → layout` permanecem. Sai apenas o par `useNodesState`/`useEdgesState` do React Flow e o padrão frágil de sync `rfNodes`↔`setNodes` (oportunidade de eliminar a Fragile Area documentada em CONCERNS.md).
9. **Seletor de teste estável**: cada nó renderizado ganha uma classe/`data-testid` próprio (ex.: `data-testid="mind-node"`), substituindo `.react-flow__node` nos 4 specs e2e. A migração de seletores deve manter a semântica dos testes atuais (paridade), não reescrever as asserções.
10. **Remoção de dependências**: `@xyflow/react` e `elkjs` saem do `package.json`. Entram os pacotes visx/d3 necessários (definidos em design.md após verificação via Context7/docs).

---

## User Stories

### P1: Canvas renderiza e navega com visx, sem logo ⭐ MVP

**User Story:** Como usuário, quero abrir um mapa e ver/navegar minha árvore exatamente como antes, mas sem a logo do React Flow, para usar a ferramenta sem a atribuição que me incomoda.

**Why P1:** É o motivo da migração (remover a logo) e a base de tudo — sem render + navegação não há canvas.

**Acceptance Criteria:**

1. WHEN o usuário abre um mapa THEN o canvas SHALL renderizar todos os nós visíveis e suas conexões via visx/SVG, na mesma disposição hierárquica horizontal de hoje.
2. WHEN o canvas é renderizado THEN NÃO SHALL existir nenhuma atribuição/logo do React Flow na tela nem `@xyflow/react` no bundle.
3. WHEN o usuário arrasta o fundo do canvas THEN a tela SHALL deslocar (pan); WHEN usa o scroll THEN SHALL dar zoom, respeitando `minZoom=0.1` e `maxZoom=3`.
4. WHEN o mapa abre THEN o canvas SHALL enquadrar a árvore (`fitView` equivalente) automaticamente.
5. WHEN não há resultado de layout ainda THEN o canvas SHALL evitar "salto" visível (paridade com o comportamento de fallback atual, agora síncrono).
6. WHEN o mapa tem os nós de exemplo THEN as conexões SHALL ser curvas (equivalentes ao `smoothstep`), saindo do pai e chegando no filho.

**Independent Test:** Abrir um mapa existente; a árvore aparece igual a antes, enquadrada; pan e zoom funcionam; nenhuma logo na tela.

---

### P1: Interações de nó preservadas ⭐ MVP

**User Story:** Como usuário, quero que todas as ações no nó (editar inline, colapsar, adicionar filho, excluir, abrir dialog, ver indicadores de tarefa) funcionem como antes, para não perder nenhuma funcionalidade na troca.

**Why P1:** Migração sem paridade de interação é regressão. Todo o trabalho de M3–M6 precisa continuar funcionando.

**Acceptance Criteria:**

1. WHEN o usuário clica no texto de um nó THEN a edição inline SHALL iniciar (input focado), e Enter/blur SHALL salvar, Escape SHALL cancelar — igual a hoje.
2. WHEN o usuário clica no chevron de um nó com filhos THEN o ramo SHALL colapsar/expandir (estado em `collapsedIds`, mantido no cliente — AD-004).
3. WHEN o usuário clica em "+" THEN um nó filho SHALL ser criado (optimistic) e entrar em edição; WHEN clica em "✕" THEN o fluxo de exclusão (confirm + delete) SHALL ocorrer; WHEN clica no botão de paleta THEN o `NodeEditDialog` SHALL abrir.
4. WHEN um nó tem propriedades de tarefa THEN o rodapé de indicadores (M6) SHALL renderizar exatamente como antes (exibição progressiva).
5. WHEN qualquer mutation é disparada THEN o comportamento optimistic + rollback + toast (M4/M5/M6) SHALL permanecer inalterado.
6. WHEN o nó é a raiz THEN as restrições atuais SHALL valer (sem botão de excluir, não arrastável).

**Independent Test:** Em um nó: editar título inline, colapsar/expandir, adicionar filho, abrir o dialog, marcar uma propriedade de tarefa e ver o indicador, excluir. Tudo funciona como antes.

---

### P1: Drag-to-reparent preservado ⭐ MVP

**User Story:** Como usuário, quero continuar arrastando um nó para cima de outro para mudar seu pai, para reorganizar a hierarquia como já fazia.

**Why P1:** É a US-02 (mover nó via drag), funcionalidade central já entregue em M3. Não pode regredir.

**Acceptance Criteria:**

1. WHEN o usuário arrasta um nó (não-raiz) e solta sobre outro nó THEN o sistema SHALL chamar `moveNode({ parentId: alvo })` e o nó SHALL passar a ser filho do alvo (no final, conforme AD-011).
2. WHEN o usuário solta o nó fora de qualquer alvo válido THEN o sistema SHALL reverter a posição (refetch/relayout), sem mudança de hierarquia (snap-back silencioso, paridade).
3. WHEN o usuário tenta arrastar a raiz THEN nada SHALL acontecer (raiz não-arrastável).
4. WHEN o drag termina em um movimento que criaria ciclo THEN o backend SHALL rejeitar (comportamento atual via `WITH RECURSIVE`), e a UI SHALL reverter.

**Independent Test:** Arrastar um nó folha sobre outro nó → vira filho dele. Arrastar para o vazio → volta ao lugar. Raiz não arrasta.

---

### P1: Suíte de testes verde com seletores migrados ⭐ MVP

**User Story:** Como mantenedor, quero que os testes continuem passando após a troca de lib, para confiar que a migração preservou o comportamento.

**Why P1:** A paridade só é demonstrável com os gates verdes (L-001, AD-013).

**Acceptance Criteria:**

1. WHEN os specs e2e rodam THEN os seletores `.react-flow__node` SHALL ter sido substituídos por classe/`data-testid` próprios, mantendo a semântica das asserções.
2. WHEN `pnpm typecheck && pnpm lint && pnpm test` roda THEN SHALL passar sem erros.
3. WHEN `pnpm test:e2e` roda THEN os specs que estavam verdes antes da migração SHALL continuar verdes.
4. WHEN o bug pré-existente `persistence.spec.ts:136` é considerado THEN a migração NÃO SHALL ser responsabilizada por ele — apenas adapta o seletor; o fix da fragilidade `.first()` permanece quick task separada (registrar no relatório se o status mudar).

**Independent Test:** Rodar a tríade + e2e; comparar o conjunto de testes verdes com o estado pré-migração — nenhum verde vira vermelho por causa da troca.

---

### P2: Eliminar a Fragile Area de sync `rfNodes`↔`setNodes`

**User Story:** Como mantenedor, quero que a nova implementação não recrie o padrão de duplo-dono de estado do React Flow, para fechar uma fonte recorrente de bugs.

**Why P2:** Melhora real e barata habilitada pela migração (CONCERNS.md, Fragile Areas), mas não bloqueia a paridade. Se o redesenho não permitir de forma limpa, pode ficar para depois.

**Acceptance Criteria:**

1. WHEN o estado derivado (`editingId`, `collapsedIds`, `data`, posições) muda THEN o canvas SHALL renderizar a partir de uma única fonte de verdade, sem o `useEffect` que força `setNodes(rfNodes)`.
2. WHEN a edição inline está ativa durante um relayout THEN o texto digitado NÃO SHALL ser perdido (a Fragile Area do input uncontrolled deve ser evitada ou mantida segura).

**Independent Test:** Editar o título de um nó enquanto outro update dispara relayout — o texto não some.

---

## Edge Cases

- WHEN o mapa tem só a raiz THEN o canvas SHALL renderizar 1 nó, enquadrado, sem edges.
- WHEN um nó tem rodapé de tarefa (58px) e outro não (40px) THEN o layout SHALL respeitar as alturas distintas sem sobreposição (paridade com `nodeHeight`).
- WHEN há um ramo colapsado THEN os nós e edges ocultos NÃO SHALL ser renderizados nem ocupar espaço no layout (paridade com `visibleNodes`).
- WHEN o mapa é grande (centenas de nós) THEN o layout síncrono d3-hierarchy SHALL completar sem travar perceptível em uso pessoal típico. (RNF-01/500 nós é parte do Gate v1 adiado — M7 não precisa validar 500 nós, mas não deve regredir vs. hoje.)
- WHEN o usuário dá zoom muito próximo/distante THEN o conteúdo SHALL respeitar os limites `minZoom`/`maxZoom`.
- WHEN o navegador não suporta algo do d3-zoom esperado THEN o comportamento SHALL degradar de forma equivalente ao atual (sem crash).
- WHEN um drag é iniciado mas o ponteiro não move (clique simples) THEN NÃO SHALL disparar `moveNode` (distinguir clique de drag, paridade com `onNodeDragStop`).

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M7-01 | Render da árvore via visx/SVG (direção/disposição livre) | P1 | Pending |
| M7-02 | Logo do React Flow ausente; `@xyflow/react` fora do bundle | P1 | Pending |
| M7-03 | Pan + zoom (d3-zoom) com min/max iguais aos atuais | P1 | Pending |
| M7-04 | `fitView` inicial equivalente | P1 | Pending |
| M7-05 | Sem "salto" visual (fallback síncrono) | P1 | Pending |
| M7-06 | Edges conectam parent→child de forma legível (estilo livre) | P1 | Pending |
| M7-07 | Background livre (liso/grid/nenhum — o mais fácil) | P1 | Pending |
| M7-08 | Edição inline (clique/Enter/blur/Escape) preservada | P1 | Pending |
| M7-09 | Collapse/expand preservado (`collapsedIds`) | P1 | Pending |
| M7-10 | Add child / delete / abrir dialog preservados | P1 | Pending |
| M7-11 | Rodapé de indicadores de tarefa (M6) preservado | P1 | Pending |
| M7-12 | Optimistic + rollback + toast preservados | P1 | Pending |
| M7-13 | Restrições da raiz (sem delete, não-arrastável) | P1 | Pending |
| M7-14 | Drag-to-reparent: drop sobre nó → moveNode | P1 | Pending |
| M7-15 | Drop inválido → snap-back (refetch) | P1 | Pending |
| M7-16 | Anti-ciclo no move continua barrando (backend) | P1 | Pending |
| M7-17 | `d3-hierarchy` substitui elkjs; worker removido | P1 | Pending |
| M7-18 | Alturas de nó variáveis (40/58) respeitadas no layout | P1 | Pending |
| M7-19 | `MindNode` perde `Handle`/`Position`, resto intacto | P1 | Pending |
| M7-20 | Seletores e2e migrados de `.react-flow__node` | P1 | Pending |
| M7-21 | `typecheck && lint && test` verde | P1 | Pending |
| M7-22 | e2e verdes preservados (sem novo vermelho pela troca) | P1 | Pending |
| M7-23 | Deps: remove `@xyflow/react` + `elkjs`; add visx/d3 | P1 | Pending |
| M7-24 | Eliminar sync `rfNodes`↔`setNodes` (fonte única) | P2 | Pending |
| M7-25 | Edição inline não perde texto em relayout | P2 | Pending |

**Coverage:** 25 requisitos — 23 P1, 2 P2.

---

## Success Criteria

- [ ] Abrir um mapa mostra a árvore igual a antes, enquadrada, **sem logo** do React Flow.
- [ ] Pan, zoom e `fitView` funcionam com os mesmos limites de hoje.
- [ ] Edição inline, collapse, add/delete, dialog, indicadores de tarefa e drag-to-reparent funcionam idênticos a antes.
- [ ] `@xyflow/react` e `elkjs` removidos do `package.json`; `layout.worker.ts` deletado.
- [ ] Nenhum teste que estava verde fica vermelho por causa da migração; seletores e2e migrados.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa; specs e2e do milestone passam (AD-014).
- [ ] Os 3 pontos de UX adiados continuam **fora** do diff (verificável: sem colunas x/y, direção segue horizontal, sem reorder de irmãos).

---

## Skills Aplicáveis (executor)

- **`mindmap-canvas`** — skill de canvas do projeto (visx+d3); cobre a camada de visualização (motor de render, custom nodes, edges, viewport/pan/zoom, drag, sync canvas↔backend). Aplicar ao reescrever `MapCanvas`/`MindNode` com visx.
- **`web-component-creation`** — ajustes nos componentes de canvas reusando primitivos existentes.
- **`web-api-integration`** — garantir que as mutations (move/create/update/delete) continuam ligadas igual (sem mudança de contrato).

---

## Notas para Design (próxima fase)

- Verificar via **Context7/docs oficiais** os pacotes visx exatos e suas APIs antes de fixar (`@visx/hierarchy`, `@visx/shape`, `@visx/zoom`, `@visx/group` ou d3 direto) — **não assumir** assinatura de API (Knowledge Verification Chain).
- Decidir o algoritmo de layout para **alturas variáveis** de nó (d3 `tree` com `nodeSize` uniforme não basta; avaliar `flextree` ou layout custom espelhando o `treeLayout.ts` atual).
- Decidir o container de transform (um `<g transform>` SVG para edges + um `<div>` transformado para os nós HTML, sincronizados pelo mesmo estado de zoom).
- Definir a estratégia de detecção de drop (bounds dos nós) sem o `node.measured` que o React Flow fornecia.
