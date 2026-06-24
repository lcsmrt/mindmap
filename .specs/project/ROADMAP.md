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

---

## Pós-v1 — em planejamento

### M9 — Drag-to-place unificado (AD-011/AD-017/AD-018) 📝 spec pronta (2026-06-24)

- Unifica o gesto de arraste num modelo **"soltar num slot"** `(pai, posição)`: reorder (mesmo pai), reparent **já posicionado** (outro pai) e troca de **lado** (slot de 1º nível) viram o mesmo gesto, com **card-fantasma** indicando o alvo. **Lado persistido** (modelo b): filhos de 1º nível ganham um campo de lado no schema; o usuário arrasta um ramo para o outro lado e ele fica (inclusive tudo de um lado). Balance do M8 **rebaixado a default de criação**. **Full-stack** (schema+migration+backend+frontend), revisa AD-016 e parcialmente AD-002 (persiste só 1 bit de lado, **sem x/y**). Spec em `.specs/features/m9-drag-to-place/spec.md`. **Design + tasks pendentes** (chat separado).

---

## Pós-v1 (deferred)

Itens que **não** entram em v1 mas podem virar features futuras. Veja `STATE.md` para registro de ideias adiadas que surjam durante a implementação.

- Exportação (PNG/PDF/JSON/markdown)
- Undo persistente entre sessões / histórico de alterações
- Apps mobile/desktop nativos
- Autenticação e colaboração multi-usuário
