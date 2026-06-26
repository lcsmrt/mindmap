# Roadmap

Milestones de v1 organizados por dependência técnica. Cada milestone agrupa uma ou mais user stories da [source-spec.md](./source-spec.md).

## v1 — Mindmap pessoal funcional

### M1 — Fundação do monorepo e infra de dados

- Setup do monorepo `pnpm` workspaces: `packages/web`, `packages/api`, `packages/shared`.
- Projeto Supabase provisionado; `DATABASE_URL` configurada.
- Prisma schema inicial (Map, Node) com migration aplicada.
- Servidor Fastify rodando com healthcheck.
- Vite + React rodando localmente, consumindo a API via tipos compartilhados em `packages/shared`.
- **Sem user story diretamente associada** — pré-requisito para todas.

### M2 — Gerenciamento de mapas (US-01)

- Endpoints CRUD de Map.
- Tela inicial: listar, criar, renomear, excluir (com confirmação).
- Navegação para o canvas de um mapa selecionado.

### M3 — Canvas e edição estrutural (US-02)

- Canvas com React Flow integrado: pan, zoom.
- Renderização da árvore via elkjs (layout hierárquico).
- Add filho, rename inline, delete (com cascade + confirmação), move via drag-and-drop.
- Expand/collapse de ramos.
- Endpoints de node: create, update, delete, move.

### M4 — Persistência automática (US-05)

- Toda mutação no canvas dispara persistência assíncrona.
- Feedback visual de erro (toast/banner) quando salvamento falha.
- Restauração completa do estado ao reabrir o mapa (estrutura, `sort_order`, cores, propriedades de tarefa). Expand/collapse fica só no cliente — ver AD-004 em STATE.md.
- **Nota:** parcialmente coberto por M2/M3; este milestone formaliza o contrato e cobre os edge cases (falhas de rede, conflitos de ordem).

### M5 — Dialog de edição e cores (US-03)

- Dialog estilo Trello ao clicar num nó.
- Paleta fixa de swatches para `bg_color` e `text_color` (sem color picker livre) — ver AD-005 em STATE.md.
- Aplicação imediata no canvas + persistência.

### M6 — Propriedades de tarefa (US-04)

- Campos no dialog: status (enum nullable), responsável (texto), prioridade (booleano).
- Indicação visual progressiva no canvas: nada quando vazio; indicador conciso quando preenchido (UI exata definida durante uso).
- Migration adicionando colunas no Node (se não foi feita em M1).

### Gate de qualidade v1

- RNF-01: mapa sintético de 500 nós permanece responsivo em pan/zoom/drag.
- Reabrir qualquer mapa restaura o estado completo (smoke test manual cobrindo todas as user stories).

---

## Pós-v1 — entregue

### M7 — Migração do canvas para visx (AD-015) ✅ concluído (2026-06-24)

- Substitui `@xyflow/react` (logo Pro = dealbreaker ético) pela stack visx: `@visx/zoom` + `@visx/shape` + `d3-flextree`. `elkjs`/worker de layout removidos. Paridade funcional + remoção da logo; queixas de UX do canvas seguem adiadas (Deferred Ideas). Feature em `.specs/features/m7-canvas-visx/`.

### M8 — Layout bidirecional horizontal (AD-016) ✅ concluído (2026-06-24)

- Primeira das "Deferred Ideas — direção do layout" (AD-015). Troca o layout vertical (raiz no topo) por **bidirecional horizontal** estilo MindMeister: raiz no centro, ramos de 1º nível repartidos e **balanceados** entre esquerda/direita, cada lado uma árvore horizontal. Direção **fixa** (sem toggle). Só frontend (`useTreeLayout.ts` + edges no `MapCanvas.tsx`); backend e AD-002 intactos. Design pulado (feature pequena). Feature em `.specs/features/m8-layout-bidirectional/`. **Review AD-013 aprovado (L-005); gates verdes (e2e 22/22).**

### M10 — Redesign (web) (AD-019) ✅ concluído e aprovado (review AD-013, 2026-06-25)

- Porta o redesign do Claude Design (pasta `Mindmaps system interface/`: telas "Meus Mapas" e "Estudo de Nós" + dialog) para o produto. **Reskin** de duas telas + **uma** extensão de contrato: `GET /maps`/`MapSummary` ganham `nodeCount`/`criticalCount`/`createdAt` (única mudança de backend; sem schema/migration — AD-019; `nodeCount` inclui a raiz). Home: header neutro (**sem rebranding "Nodum"**), grid de cards com métricas/datas, criar via modal, menu ⋯ (Renomear/Excluir), e **(P2)** busca + ordenação. Canvas: nó rico (cor/status+label/avatar de responsável/▲ crítico) + toolbar no hover; dialog com preview ao vivo + **(P2)** medidor de contraste WCAG. Decisões do usuário: sem mini-preview nos cards; `assignee` segue string livre (AD-003). AD-002/AD-005 preservadas; M7/M8/M9 (layout/interação do canvas) **intactos**. Spec/design/tasks em `.specs/features/m10-redesign/` (27 req. M10-NN, 13 tasks). **Concluído e aprovado (review AD-013, 2026-06-25). Commits `1476aba`…`18f17d0` + `87bd9de` (fix do review). Gates verdes: typecheck/lint, unit api 56/web 88, e2e 32/32, smoke visual. Review: 1 finding corrigido (▲ crítico movido para a linha do título, fiel ao export); 2 não-bloqueantes anotados em CONCERNS (rename inline pré-existente; AC M10-21 optimistic por design).**

---

## Pós-v1 — executado (pendente review AD-013)

### M9 — Drag-to-place unificado (AD-011/AD-017/AD-018) 📝 spec pronta (2026-06-24)

- Unifica o gesto de arraste num modelo **"soltar num slot"** `(pai, posição)`: reorder (mesmo pai), reparent **já posicionado** (outro pai) e troca de **lado** (slot de 1º nível) viram o mesmo gesto, com **card-fantasma** indicando o alvo. **Lado persistido** (modelo b): filhos de 1º nível ganham um campo de lado no schema; o usuário arrasta um ramo para o outro lado e ele fica (inclusive tudo de um lado). Balance do M8 **rebaixado a default de criação**. **Full-stack** (schema+migration+backend+frontend), revisa AD-016 e parcialmente AD-002 (persiste só 1 bit de lado, **sem x/y**). Spec em `.specs/features/m9-drag-to-place/spec.md`. **Design + tasks pendentes** (chat separado).

---

## Pós-v1 — refinamento de UX (planejado, 2026-06-25)

Lote de refinamento levantado em uso real (fase de polish). Organizado por complexidade e dependência; **não** será speccado/executado tudo de uma vez (cada item em chat separado, [[feedback-plan-execute-split]]). Sequência proposta: **M11** (quick wins) → **M12** (texto sempre visível + altura dinâmica, spec própria) → **M13** (geometria do drag, depende de M12) → **M14** (hierarquia, design). O **resize horizontal foi fatiado de M12 para M15** (decisão 2026-06-25, AD-020) — full-stack, depende de M12. Breadcrumbs técnicos (arquivos/linhas) em `STATE.md` → Deferred Ideas.

**Grafo de dependências do lote** (numeração ≠ ordem obrigatória; cada item em chat separado):

```
M11 (independente, já executado)
M12 ─┬─→ M13   (geometria vertical do drop; M15 toca a mesma slots.ts no eixo da largura, sem ser dependência)
     ├─→ M14   (skin/altura por M12; "central maior em largura" também depende de M15)
     └─→ M15   (resize horizontal, full-stack)  ──→ M14 (parte "central maior em largura")
```

- **M12** não depende de nada novo (base do lote). **M13**, **M14** e **M15** dependem de **M12**.
- **M14** também depende de **M15** apenas para o sub-item "central maior **em largura**" (o resto do M14 — skin por profundidade, cor de edge — só precisa de M12).
- **M13** depende **só de M12**; M15 compartilha arquivo (`slots.ts`/ghost) no eixo da largura, mas é ortogonal ao fix vertical do M13 → coordenar, não bloquear.

### M11 — Polish de ícones, divisória e overflow 🛠️ executado (gates verdes; pendente review AD-013, 2026-06-25)

Três ajustes independentes e de baixo risco, agrupados. **Executado** sem spec (quick wins): 3 commits atômicos (`fc102b6` ícones, `c37ffd4` divisória, `4d1eefe` overflow). Gates verdes: typecheck/lint, unit web 88, e2e 32/32, smoke visual conferido (ícones lucide + divisória + sem overlap). **Pendente review AD-013** (chat separado).

- **Ícones de texto → lucide:** trocar caracteres usados como ícone por componentes `lucide-react` (padrão já no projeto). Ocorrências: `▲` crítico (`MindNode.tsx`, `NodeEditDialog.tsx`), `✓/!/⚠` do medidor de contraste (`NodeEditDialog.tsx`), `←` voltar (`MapPage.tsx`). O `—` placeholder de responsável fica (é travessão de UI). Caso algum cenário não tenha ícone lucide equivalente → trazer para discussão.
- **Divisória título/footer no card:** replicar no `MindNode` a linha (`border-t` condicional) que já existe no `NodeEditDialog`, exibida só quando há status e/ou responsável (`hasTaskProps`).
- **Overflow do dialog com texto longo:** título/responsável muito longos estouram o `NodeEditDialog`. Fix de CSS (`min-w-0`/`overflow`/`break-words` nos containers do preview e da linha de responsável).

### M12 — Card responsivo: texto sempre visível + altura dinâmica 🔴 alta (spec própria) 🛠️ executado (gates verdes; pendente review AD-013, 2026-06-25)

Metade arquitetural do "Card responsivo + resize" original — **fatiada** (decisão do usuário, 2026-06-25, AD-020): M12 entrega só **texto sempre 100% visível + altura derivada de medição real**; o **resize horizontal** virou **M15**.

- **Texto sempre visível:** remove `truncate`, deixa quebrar linha (incl. palavra única longa via `break-words`); altura do card cresce/encolhe para caber.
- **Altura por medição real:** a altura deixa de ser fórmula (40/79 de `nodeSize.ts`) e passa a vir de medição no DOM → pipeline **medir→layout** (`ResizeObserver` compartilhado → estado `heights` → `useTreeLayout` realimenta o `d3-flextree`, que já trata altura por nó). `nodeHeight`→`estimateNodeHeight` vira estimativa de 1º paint. **Invariante de convergência:** largura fixa ⇒ reposicionar não muda a altura medida ⇒ observer não re-dispara ⇒ ≤1 relayout, sem loop.
- **Só frontend.** Sem schema, sem migration, **sem coluna `width`**, sem x/y. AD-002 intacta. `slots.ts` (geometria do drop) fica para M13.
- Spec/design/tasks em `.specs/features/m12-card-responsive/` (19 req. M12-NN, 5 tasks; T1/T2 paralelos). **Executado** em 6 commits atômicos (`c5797b7` refactor de polish do `MindNode` separado do milestone + T1–T5 `3e7eaf4`…`6958fbc`). Gates verdes: typecheck/lint, unit **web 88→96** + api 56, **e2e 32→33/33**, smoke visual conferido (cards multi-linha + palavra gigante sem truncar/vazar, sem sobreposição, `fitView` enquadra). Só frontend, AD-002 intacta. **Pendente review AD-013** (chat separado).

### M13 — Geometria da barra de inserção (drag) 🟡 média

Corrige a assimetria da linha de drop entre dois cards (tende a subir / cola no card de baixo). Causa: `lib/slots.ts` usa média das bordas com `PLACEHOLDER_H` fixo (40) enquanto cards reais variam (40/58). **Depende de M12** (eixo vertical/altura) — com alturas dinâmicas a geometria vertical muda de novo; fazer junto/depois para não calibrar duas vezes. **Não depende de M15**, mas o M15/resize revisita a mesma `lib/slots.ts`/ghost no eixo da **largura** (ortogonal ao fix vertical do M13) — quem vier depois assenta sem conflito. (Se incomodar antes, cabe um fix barato standalone, ciente de que será revisitado.)

### M14 — Hierarquia visual (estilo MindMeister) 🟡 média (muito design)

Dar hierarquia aos nós por profundidade. Sub-itens de esforço distinto:

- **Central maior / 1º nível destacado / resto mais simples:** skin por profundidade (estender `cardSkin(depth)`). M12 entrega **altura** por nó (texto longo → card mais alto); um "central maior" de fato **maior em largura** depende do **M15** (largura por nó). Sem M15, o destaque do central fica por estilo/altura/fonte.
- **Cor da edge herdada do nó de 1º nível:** hoje toda edge é `stroke-border` fixo e `LayoutLink` não carrega cor; propagar a cor do nó para sua aresta.
- Majoritariamente **design** — vale exploração visual antes de virar tarefa.

### M15 — Resize horizontal do card 🔴 alta (depende de M12)

Segunda metade do "Card responsivo + resize" original, **fatiada de M12** (decisão do usuário, 2026-06-25, AD-020). Largura controlada pelo usuário por arraste; texto reflui; altura derivada (M12 já entrega o pipeline de medição).

- **Resize horizontal por nó:** alça na borda direita do card, **revelada no hover** (consistente com a toolbar M10). `NODE_WIDTH` deixa de ser constante → vira largura por nó em `useTreeLayout.ts`, `lib/slots.ts`, barra-fantasma e render.
- **Largura persistida:** coluna nova `width Int?` no `Node` (full-stack). Revisa AD-002 parcialmente (mais 1 dado estrutural por nó, mantendo "sem x/y livre" — largura não é posição em pixel; mesmo precedente do M9/`side`).
- **Depende de M12** (pipeline medir→layout + largura-por-nó já no layout). Decisões de UI/persistência **já fixadas** (conversa 2026-06-25); spec própria quando for a vez.

---

## Pós-v1 (deferred)

Itens que **não** entram em v1 mas podem virar features futuras. Veja `STATE.md` para registro de ideias adiadas que surjam durante a implementação.

- Exportação (PNG/PDF/JSON/markdown)
- Undo persistente entre sessões / histórico de alterações
- Apps mobile/desktop nativos
- Autenticação e colaboração multi-usuário
