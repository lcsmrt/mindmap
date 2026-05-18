# Mindmap Tool — Specification

## 1. Visão do Produto

Ferramenta web pessoal de mindmaps com suporte a metadados por nó — prioridade, responsável e status — que o MindMeister não oferece. Qualquer nó pode ter propriedades de tarefa; a exibição é progressiva (campos aparecem apenas quando preenchidos). Sem limite prático de profundidade.

**Usuário único.** Sem autenticação, sem colaboração, sem multi-tenancy.

## 2. Escopo

### Dentro do escopo

- Gerenciamento de múltiplos mapas (criar, renomear, excluir, listar).
- Árvore hierárquica interativa com pan, zoom, drag e layout automático.
- Adicionar nó filho, renomear inline, excluir nó (e toda a subárvore), mover nó para outro pai via drag-and-drop.
- Expand/collapse de ramos.
- Dialog de edição ao clicar em um nó (estilo Trello) com os campos descritos nas user stories.
- Propriedades de tarefa (status, responsável, prioridade) disponíveis em qualquer nó, com exibição progressiva.
- Persistência dos dados em banco relacional.

### Fora do escopo

- Autenticação e controle de acesso.
- Colaboração em tempo real ou multi-usuário.
- Exportação (PNG, PDF, JSON, markdown).
- Aplicativos mobile ou desktop nativos.
- Histórico de alterações / undo persistente (undo in-session via React Flow é aceitável).

## 3. User Stories

### US-01 — Gerenciar mapas

**Como** usuário, **quero** criar, renomear, listar e excluir mapas **para** organizar diferentes contextos separadamente.

**Critérios de aceitação:**

- Existe uma tela inicial que lista todos os mapas existentes.
- O usuário pode criar um novo mapa informando apenas um título.
- O usuário pode renomear um mapa existente.
- O usuário pode excluir um mapa, com confirmação, o que remove permanentemente o mapa e todos os seus nós.
- Ao selecionar um mapa, o usuário é levado ao canvas de edição daquele mapa.

---

### US-02 — Editar árvore no canvas

**Como** usuário, **quero** manipular a árvore de nós diretamente no canvas **para** construir e reorganizar meu mapa visualmente.

**Critérios de aceitação:**

- O canvas suporta pan (arrastar fundo) e zoom (scroll/pinch).
- O usuário pode adicionar um nó filho a qualquer nó existente.
- O usuário pode renomear um nó inline (duplo-clique ou atalho).
- O usuário pode excluir um nó; se o nó possui filhos, toda a subárvore é excluída junto, com confirmação.
- O usuário pode mover um nó para outro pai via drag-and-drop; a subárvore inteira se move junto.
- O layout da árvore se recalcula automaticamente após qualquer operação estrutural (add, delete, move).
- O usuário pode expandir e colapsar qualquer ramo da árvore.

---

### US-03 — Editar propriedades visuais de qualquer nó

**Como** usuário, **quero** personalizar cor de fundo e cor de texto de qualquer nó **para** criar agrupamentos visuais e diferenciar contextos.

**Critérios de aceitação:**

- Ao clicar em um nó, abre um dialog de edição.
- O dialog permite alterar cor de fundo e cor de texto do nó.
- As alterações se refletem imediatamente no canvas.
- As cores são persistidas e restauradas ao reabrir o mapa.

---

### US-04 — Gerenciar propriedades de tarefa

**Como** usuário, **quero** poder atribuir status, responsável e prioridade a qualquer nó **para** controlar a execução das tarefas sem restrição de posição na árvore.

**Critérios de aceitação:**

- O dialog de edição de qualquer nó exibe os campos: status, responsável e prioridade.
- **Status** aceita os valores: Pendente, Em andamento, Concluído, Bloqueado. Valor padrão: nenhum (não selecionado).
- **Responsável** é um campo de texto livre. Valor padrão: vazio.
- **Prioridade** é booleano: crítico ou não-crítico. Valor padrão: não-crítico.
- Campos não preenchidos não geram indicação visual no canvas. Campos preenchidos geram alguma indicação visual concisa (a definição exata de UI será refinada durante o uso).
- O comportamento é o mesmo independentemente de o nó ser folha ou intermediário.

---

### US-05 — Persistência automática

**Como** usuário, **quero** que minhas alterações sejam salvas automaticamente **para** não perder trabalho.

**Critérios de aceitação:**

- Toda operação (add, delete, move, edição de propriedades) persiste no banco de dados sem ação explícita de "salvar".
- Ao reabrir um mapa, o estado completo é restaurado: estrutura, posições relativas, cores, dados de tarefa, estado de expand/collapse.

## 4. Requisitos Não-Funcionais

**RNF-01 — Performance:** O canvas deve permanecer responsivo (sem jank perceptível em pan/zoom/drag) com até 500 nós simultâneos em um único mapa.

**RNF-02 — Persistência:** Dados armazenados em PostgreSQL gerenciado (Supabase). O modelo de dados deve suportar profundidade de aninhamento ilimitada.

**RNF-03 — Latência de salvamento:** As operações de persistência não devem bloquear a interação do usuário. Salvamento assíncrono com feedback visual em caso de falha.

## 5. Decisões Técnicas

As seguintes decisões foram tomadas durante a exploração prévia e devem ser respeitadas como constraints pelo Design/Plan:

| Decisão                  | Escolha                    | Justificativa                                                |
| ------------------------ | -------------------------- | ------------------------------------------------------------ |
| Frontend framework       | React + Vite + TypeScript  | SPA interativa, sem necessidade de SSR                       |
| Canvas/graph library     | React Flow (@xyflow/react) | Nós customizáveis como componentes React; edição first-class |
| Layout engine            | elkjs                      | Layout automático de árvore hierárquica                      |
| Backend runtime          | Node.js + TypeScript       | Linguagem única com o frontend, tipos compartilhados         |
| Backend framework        | Fastify                    | Leve, performático, bom suporte a TypeScript                 |
| ORM                      | Prisma                     | Type-safe, migrations automáticas, boa DX                    |
| Banco de dados           | PostgreSQL (Supabase)      | Managed, tier gratuito, adjacency list com `WITH RECURSIVE`  |
| Estrutura do repositório | Monorepo (pnpm workspaces) | `packages/web`, `packages/api`, `packages/shared`            |
| Autenticação             | Nenhuma (por enquanto)     | Usuário único, sem requisito de segurança imediato           |

## 6. Modelo de Dados (esboço)

Esboço conceitual para informar o Design. Não é schema final.

**Map:** `id`, `title`, `created_at`, `updated_at`

**Node:** `id`, `map_id` (FK → Map), `parent_id` (FK → Node, nullable para root), `title`, `sort_order`, `bg_color`, `text_color`, `is_collapsed`, `status` (enum nullable: pendente, em_andamento, concluido, bloqueado), `assignee` (text nullable), `is_critical` (boolean, default false), `created_at`, `updated_at`

> Nota: Os campos de tarefa (status, assignee, is_critical) ficam no próprio Node. Quando null/default, o nó não exibe indicadores de tarefa no canvas.

## 7. Premissas

- Não existe distinção formal de "tipo" entre nós. Qualquer nó pode ter propriedades de tarefa. A exibição é progressiva: campos não preenchidos não aparecem no canvas.
- O layout é recalculado no frontend via elkjs; posições absolutas não são persistidas — apenas a estrutura hierárquica e `sort_order`.
- A UI exata dos indicadores visuais de tarefa no canvas será definida iterativamente durante o desenvolvimento.
