# M3 — Canvas e Edição Estrutural (US-02)

## Problem Statement

Após M2, o usuário consegue gerenciar mapas mas não editá-los: `MapPage` mostra apenas um placeholder "Canvas — em breve". M3 entrega o coração do produto — o canvas interativo onde a árvore de nós é construída, reorganizada e visualizada. Sem M3 o app não cumpre sua função primária.

## Goals

- [ ] Canvas React Flow integrado a `MapPage` com pan, zoom e renderização hierárquica via elkjs.
- [ ] Todas as operações estruturais de US-02 funcionais e persistidas: add filho, rename inline, delete (cascade + confirmação), move (drag-and-drop reparent), expand/collapse.
- [ ] Endpoints REST de Node implementados (list, create, update title, delete, move) com renumeração transacional de `sortOrder` e validação de ciclos.
- [ ] Layout recalculado automaticamente após qualquer mutação estrutural, sem jank perceptível em mapas pequenos/médios (alvo RNF-01: 500 nós — verificado em M3, formalizado no gate de v1).

## Out of Scope

| Item | Motivo |
| --- | --- |
| Cores (`bgColor`, `textColor`) | M5 — US-03 |
| Dialog de edição estilo Trello | M5 |
| Propriedades de tarefa (status, assignee, isCritical) no dialog | M6 — US-04 |
| Indicadores visuais de tarefa no canvas | M6 |
| Persistência completa formal (contrato, edge cases de rede, restauração) | M4 formaliza — M3 já persiste cada mutação otimisticamente |
| Restauração de expand/collapse entre sessões | AD-004 — estado só no cliente |
| Persistência de posições absolutas | AD-002 — layout sempre recalculado |
| Reorder entre irmãos do mesmo pai via drag | M3 cobre só drag-to-reparent (mudar `parentId`). Reorder dentro do mesmo pai vira deferred idea — não está nos critérios de US-02 |
| Undo/redo persistente | Fora de v1; React Flow já oferece undo in-session se desejado |
| Atalhos de teclado completos | Apenas Enter/Escape no rename inline; outros atalhos viram deferred idea |
| Editar título de nó raiz | Permitido — root é Node como qualquer outro; só não pode ser movido/deletado |
| Deletar o nó raiz | Bloqueado — root é criado junto com o Map e é parte da identidade do mapa |

---

## Decisões Tomadas Durante Planejamento

Registrar como AD no `STATE.md` após aprovação do spec. Resumidas aqui para que o executor entenda os porquês sem precisar ler atas:

1. **Persistência durante M3 (não adiada para M4):** cada mutação estrutural chama a API imediatamente via TanStack Query mutation. M4 formaliza contrato, cobre edge cases de rede e restauração completa.
2. **Endpoints só de US-02:** `create`, `update title`, `delete`, `move`. Cores e propriedades de tarefa têm seus próprios PATCHs em M5/M6, mesmo que o schema já tenha os campos.
3. **`sortOrder` em inteiros com renumeração transacional:** ao mover/criar, renumeramos os irmãos afetados (0, 1, 2, …) dentro de uma transação Prisma. Simples, previsível, sem custo perceptível em mapas com poucos irmãos por nó (caso real de mindmap pessoal).
4. **elkjs roda em web worker dedicado:** evita travar main thread em árvores grandes (alinha com RNF-01 — 500 nós).
5. **Move é drag-to-reparent apenas:** drop em cima de outro nó muda `parentId`. Reorder dentro do mesmo pai não está em US-02 e fica como deferred.
6. **Endpoint de leitura dos nós é dedicado:** `GET /maps/:id/nodes` retorna lista plana (não árvore). Cliente monta a árvore via `parentId`. Mantém `MapDetail` enxuto e desacopla leitura de metadata vs. estrutura.

---

## User Stories

### P1: Visualizar a árvore do mapa ⭐ MVP

**User Story:** Como usuário, quero ver a árvore de nós do mapa renderizada no canvas com pan e zoom, para navegar visualmente pelo conteúdo.

**Why P1:** Sem renderização, nenhuma outra interação é possível.

**Acceptance Criteria:**

1. WHEN `MapPage` carrega para um mapa existente THEN o sistema SHALL buscar todos os nós do mapa via `GET /api/maps/:id/nodes` e renderizar a árvore no canvas React Flow.
2. WHEN o usuário arrasta o fundo do canvas THEN o sistema SHALL pan a viewport.
3. WHEN o usuário scrolla (ou pinch) sobre o canvas THEN o sistema SHALL aplicar zoom centrado no cursor.
4. WHEN o layout é calculado THEN o sistema SHALL posicionar os nós em árvore hierárquica horizontal (raiz à esquerda, filhos à direita) usando elkjs em web worker.
5. WHEN o cálculo de layout está em andamento THEN o sistema SHALL evitar travar o main thread (worker dedicado).
6. WHEN o fetch dos nós falha THEN o sistema SHALL exibir mensagem "Erro ao carregar nós" sem crash.

**Independent Test:** Criar manualmente (via API) um Map com root + 3 filhos + 2 netos; abrir `/maps/:id`; ver a árvore renderizada; pan/zoom funcionam.

---

### P1: Adicionar nó filho ⭐ MVP

**User Story:** Como usuário, quero adicionar um nó filho a qualquer nó existente para expandir o mindmap.

**Why P1:** Operação primária de construção do mapa.

**Acceptance Criteria:**

1. WHEN o usuário aciona "adicionar filho" em um nó THEN o sistema SHALL criar um novo Node com `parentId` = nó alvo, `title` = "Novo nó" (placeholder editável), e `sortOrder` = último entre os irmãos.
2. WHEN a criação tem sucesso THEN o canvas SHALL re-renderizar com o novo nó visível, layout recalculado, e o novo nó em modo de edição inline para o usuário renomear imediatamente.
3. WHEN a criação falha THEN o sistema SHALL exibir feedback de erro (toast inline simples) sem alterar o canvas.

**Independent Test:** Abrir mapa, clicar "+" no root, ver novo nó "Novo nó" aparecer ligado ao root, com input ativo; digitar título; persistir.

---

### P1: Renomear nó inline ⭐ MVP

**User Story:** Como usuário, quero renomear qualquer nó via duplo-clique para editar o título sem abrir dialog.

**Why P1:** Edição rápida é essencial para o fluxo de mindmap.

**Acceptance Criteria:**

1. WHEN o usuário dá duplo-clique em um nó THEN o sistema SHALL substituir o título por um `<input>` com o valor atual selecionado.
2. WHEN o usuário pressiona Enter ou tira foco (blur) com valor não-vazio THEN o sistema SHALL persistir o novo título via `PATCH /api/nodes/:id` e refletir no canvas.
3. WHEN o usuário pressiona Escape THEN o sistema SHALL cancelar a edição sem chamar a API.
4. WHEN o valor é vazio ou whitespace-only no commit THEN o sistema SHALL cancelar a edição (revert ao título anterior) — não chamar API.
5. WHEN a persistência falha THEN o sistema SHALL reverter o título no canvas e exibir feedback de erro.

**Independent Test:** Duplo-clique num nó, mudar texto, pressionar Enter — título atualiza e persiste (verificar via GET /api/maps/:id/nodes).

---

### P1: Excluir nó com confirmação ⭐ MVP

**User Story:** Como usuário, quero excluir um nó (e sua subárvore) com confirmação, porque a operação é destrutiva.

**Why P1:** Operação destrutiva precisa estar disponível desde o início.

**Acceptance Criteria:**

1. WHEN o usuário aciona "excluir" em um nó não-root THEN o sistema SHALL abrir `ConfirmDialog` com mensagem informando que o nó e toda a subárvore serão removidos.
2. WHEN o usuário confirma THEN o sistema SHALL chamar `DELETE /api/nodes/:id`; cascade no banco remove a subárvore; canvas re-renderiza sem os nós removidos.
3. WHEN o usuário cancela THEN o dialog SHALL fechar sem mudanças.
4. WHEN o usuário tenta excluir o nó raiz THEN o sistema SHALL ocultar a ação de excluir (ou desabilitá-la) — root não pode ser deletado.
5. WHEN a API falha THEN o sistema SHALL exibir feedback de erro e manter o nó no canvas.

**Independent Test:** Excluir um nó intermediário com 2 filhos, confirmar, ver o nó e os 2 filhos sumirem do canvas; verificar via API que sumiram do banco.

---

### P1: Mover nó para outro pai (drag-and-drop) ⭐ MVP

**User Story:** Como usuário, quero arrastar um nó para outro pai para reorganizar a estrutura.

**Why P1:** Reorganização visual é diferencial do canvas vs. lista.

**Acceptance Criteria:**

1. WHEN o usuário inicia drag em um nó não-root THEN o sistema SHALL acompanhar visualmente a posição do nó durante o drag.
2. WHEN o usuário solta o nó sobre outro nó (alvo) THEN o sistema SHALL chamar `PATCH /api/nodes/:id/move` com `parentId` = id do alvo e `index` = última posição entre os filhos do alvo.
3. WHEN o move tem sucesso THEN o canvas SHALL re-renderizar com a subárvore movida, layout recalculado.
4. WHEN o usuário solta o nó fora de qualquer alvo válido THEN o sistema SHALL cancelar o move (sem chamada à API) e o canvas SHALL voltar à árvore original (layout recalculado para a posição correta).
5. WHEN o usuário tenta mover um nó para si mesmo ou para um descendente seu THEN a API SHALL retornar 400; o canvas SHALL exibir feedback de erro e reverter.
6. WHEN o usuário tenta arrastar o nó raiz THEN o sistema SHALL desabilitar drag para esse nó (root não pode ser movido).

**Independent Test:** Arrastar um nó intermediário sobre outro pai, soltar, ver a subárvore migrar; tentar arrastar nó sobre seu próprio descendente, ver erro e reversão.

---

### P1: Expand/collapse de ramos ⭐ MVP

**User Story:** Como usuário, quero colapsar e expandir ramos para focar em partes específicas do mapa.

**Why P1:** Mindmaps grandes ficam ilegíveis sem isso.

**Acceptance Criteria:**

1. WHEN o usuário clica no controle de collapse de um nó com filhos THEN o sistema SHALL ocultar a subárvore (filhos e descendentes) e indicar visualmente o estado colapsado.
2. WHEN o usuário clica no controle de expand de um nó colapsado THEN o sistema SHALL revelar os filhos diretos novamente (descendentes que estavam colapsados permanecem colapsados).
3. WHEN o estado de expand/collapse muda THEN o layout SHALL recalcular para refletir os nós visíveis.
4. WHEN o mapa é reaberto (recarga ou nova sessão) THEN todos os nós SHALL começar expandidos — estado não persiste (AD-004).
5. WHEN um nó sem filhos é renderizado THEN o controle de collapse SHALL estar oculto/desabilitado.

**Independent Test:** Colapsar um nó com 3 filhos, ver os 3 sumirem; expandir, ver os 3 voltarem; recarregar a página, ver tudo expandido novamente.

---

## Edge Cases

- WHEN dois usuários (ou duas abas) editam o mesmo mapa simultaneamente THEN o sistema SHALL aplicar last-write-wins via TanStack Query — refetch periódico não é requisito em v1 (usuário único). Conflitos são improváveis no caso de uso.
- WHEN a API retorna 500 em qualquer mutação THEN o frontend SHALL reverter o estado otimista, exibir mensagem de erro inline ou toast curto, e manter a árvore no estado pré-mutação.
- WHEN o usuário arrasta um nó muito rapidamente em sequência (múltiplos drops) THEN apenas a última requisição SHALL ser considerada — usar mutation com `mutationKey` ou invalidação garante consistência.
- WHEN o título contém XSS (`<script>...`) THEN o sistema SHALL armazenar literalmente; React escapa no render (mesmo padrão de M2-edge-cases).
- WHEN um nó é criado mas o fetch dos nós atualizado falha THEN o cache TanStack SHALL ser invalidado e o erro de fetch tratado pelo componente — não silenciar.
- WHEN o cálculo do layout no worker falha (input inválido, exception) THEN o canvas SHALL exibir os nós com fallback de posições simples (ex: empilhar) e logar o erro no console; não bloquear interação.
- WHEN o `index` no move ultrapassa o número de irmãos do novo pai THEN o backend SHALL clampar para o final (`siblingsCount`). Negativo é clampado para 0.

---

## API Contract

Novos endpoints sob `/nodes` (e um sob `/maps/:id`). Convenção REST igual à de M2.

| Method | Path | Body | Response | Status |
| --- | --- | --- | --- | --- |
| GET | `/maps/:id/nodes` | — | `NodeListResponse` | 200 |
| POST | `/nodes` | `CreateNodeBody` | `NodeDto` | 201 |
| PATCH | `/nodes/:id` | `UpdateNodeBody` | `NodeDto` | 200 |
| DELETE | `/nodes/:id` | — | — | 204 |
| PATCH | `/nodes/:id/move` | `MoveNodeBody` | `NodeDto` | 200 |

**Códigos de erro adicionais:**

- 400 `{ error: "Title is required" }` — title vazio no POST/PATCH.
- 400 `{ error: "Cannot move root" }` — tentativa de mover nó sem parent.
- 400 `{ error: "Cannot move node into itself or its descendant" }` — move criaria ciclo.
- 400 `{ error: "Cannot delete root" }` — tentativa de deletar nó sem parent.
- 400 `{ error: "Parent and node must belong to the same map" }` — `parentId` aponta para nó de outro mapa.
- 404 `{ error: "Node not found" }` ou `{ error: "Parent not found" }` — id inexistente.

**Tipos (definidos em `@mindmap/shared`):**

```ts
// packages/shared/src/node.ts

export interface NodeDto {
  id: string;
  mapId: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  // campos de M5/M6 — incluídos no contrato desde já para evitar deriva;
  // backend retorna o que estiver no banco (null/default) e frontend ignora em M3.
  bgColor: string | null;
  textColor: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | null;
  assignee: string | null;
  isCritical: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface NodeListResponse {
  nodes: NodeDto[];
}

export interface CreateNodeBody {
  mapId: string;
  parentId: string; // não-nullable: root é criado junto com o Map em M2
  title: string;    // 1+ char após trim
}

export interface UpdateNodeBody {
  title: string;    // M3 só edita title; M5/M6 estendem
}

export interface MoveNodeBody {
  parentId: string; // novo pai (não-nullable — root não se move)
  index: number;    // posição entre os filhos do novo pai; clampado a [0, siblingsCount]
}
```

**Renumeração de `sortOrder` em `move`:**

A transação faz:

1. Lê o nó alvo e valida que não é root, que o `parentId` novo existe no mesmo `mapId`, e que o novo pai não é descendente do alvo (anti-ciclo via `WITH RECURSIVE`).
2. Lê os irmãos do novo pai (excluindo o próprio nó se for o mesmo pai), ordenados por `sortOrder`.
3. Insere o nó na posição `index` (clampada) e renumera todos os irmãos para `0..N`.
4. Atualiza o nó: `parentId` e `sortOrder` finais.
5. Se o pai antigo for diferente do novo, renumera também os irmãos do pai antigo (eliminando o gap).

Tudo em `prisma.$transaction([...])` ou `prisma.$transaction(async tx => ...)`.

**`sortOrder` em `create`:**

`POST /nodes` calcula `sortOrder = (MAX(sortOrder) entre irmãos do parentId) + 1` — sempre adiciona ao final. Sem renumeração nessa operação.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| M3-01 | Visualizar — fetch e renderiza árvore | Pending | Pending |
| M3-02 | Visualizar — pan | Pending | Pending |
| M3-03 | Visualizar — zoom | Pending | Pending |
| M3-04 | Visualizar — layout hierárquico via elkjs | Pending | Pending |
| M3-05 | Visualizar — layout não bloqueia main thread (worker) | Pending | Pending |
| M3-06 | Visualizar — erro de fetch tratado | Pending | Pending |
| M3-07 | Add filho — cria com parentId + sortOrder auto + título placeholder | Pending | Pending |
| M3-08 | Add filho — re-render + entra em modo de edição inline | Pending | Pending |
| M3-09 | Add filho — falha exibe erro sem mudar canvas | Pending | Pending |
| M3-10 | Rename — duplo-clique ativa input | Pending | Pending |
| M3-11 | Rename — Enter/blur persiste | Pending | Pending |
| M3-12 | Rename — Escape cancela | Pending | Pending |
| M3-13 | Rename — valor vazio cancela | Pending | Pending |
| M3-14 | Rename — falha reverte | Pending | Pending |
| M3-15 | Delete — confirmação | Pending | Pending |
| M3-16 | Delete — confirm chama API e cascade | Pending | Pending |
| M3-17 | Delete — cancelar fecha sem ação | Pending | Pending |
| M3-18 | Delete — root não tem ação | Pending | Pending |
| M3-19 | Delete — falha mantém nó | Pending | Pending |
| M3-20 | Move — drag visual | Pending | Pending |
| M3-21 | Move — drop em alvo chama API | Pending | Pending |
| M3-22 | Move — re-render após sucesso | Pending | Pending |
| M3-23 | Move — drop inválido reverte | Pending | Pending |
| M3-24 | Move — ciclo rejeitado pela API | Pending | Pending |
| M3-25 | Move — root não pode ser arrastado | Pending | Pending |
| M3-26 | Collapse — oculta subárvore | Pending | Pending |
| M3-27 | Collapse — expand revela filhos diretos | Pending | Pending |
| M3-28 | Collapse — layout recalcula | Pending | Pending |
| M3-29 | Collapse — não persiste entre sessões | Pending | Pending |
| M3-30 | Collapse — nó sem filhos esconde controle | Pending | Pending |

**Coverage:** 30 requisitos derivados de US-02.

---

## Success Criteria

- [ ] Abrir um mapa com 50+ nós renderiza a árvore em < 500 ms (smoke manual).
- [ ] Pan/zoom permanecem fluidos durante interação.
- [ ] Add/rename/delete/move/collapse funcionam end-to-end com persistência verificável via API.
- [ ] Tentativa de mover nó para descendente retorna 400 e canvas reverte.
- [ ] Reabrir mapa restaura estrutura completa (mas todos os ramos voltam expandidos — AD-004).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa.
- [ ] Performance com 500 nós sintéticos é "responsiva" subjetivamente — gate formal de v1, mas validado já em M3.

---

## Skills Aplicáveis (executor)

O ambiente tem skills locais que cobrem cada área deste milestone. O executor deve invocá-las quando relevante:

- **`react-flow`** — qualquer trabalho com canvas, nós customizados, edges, viewport, sincronização com backend.
- **`api-backend`** — rotas Fastify, schemas Zod, mappers, error handling, testes Vitest com `inject`.
- **`web-api-integration`** — hooks TanStack Query (queries, mutations, invalidação).
- **`web-component-creation`** — componentes React reutilizáveis (MindNode, ações inline).

CLAUDE.md confirma stack: React + React Flow + TanStack Query + Tailwind v4 + shadcn/ui no frontend; Fastify + Prisma no backend. **Sem propor trocas.**
