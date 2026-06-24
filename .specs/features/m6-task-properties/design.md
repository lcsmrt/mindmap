# M6 — Propriedades de Tarefa: Design

**Spec**: `.specs/features/m6-task-properties/spec.md`
**Status**: Draft

---

## Architecture Overview

M6 reaproveita inteiramente a infra de M5. O caminho de escrita já existe (dialog → `useUpdateNode` → optimistic → `PATCH`), e a mutation aplica `{ ...n, ...body }` genericamente — então **basta estender o tipo e o validador** para os campos novos fluírem. O trabalho real é UI: 3 controles no dialog + 1 linha de indicadores no canvas, e um ajuste no layout para a altura do nó com rodapé.

```
┌───────────────────────────────────────────────────────────────┐
│ MapCanvas (state owner — editDialogNodeId)                     │
│                                                                │
│  ┌──────────────┐          ┌─────────────────────────────┐    │
│  │  MindNode     │──ícone──▶│  NodeEditDialog / EditForm   │   │
│  │              │  editar  │  ┌────────────────────────┐  │   │
│  │  título       │          │  │ Título (Input)          │  │   │
│  │  ───────────  │          │  ├────────────────────────┤  │   │
│  │  rodapé:      │          │  │ ColorSwatchGrid bg/txt  │  │   │
│  │  ● LM 🚩      │◀─render──│  ├────────────────────────┤  │   │
│  │  (progressivo)│ optimist │  │ StatusSelector (M6)     │  │   │
│  └──────┬───────┘          │  │ Responsável Input (M6)  │  │   │
│         │                  │  │ Crítico Toggle (M6)     │  │   │
│         │ nodeHeight()     │  └───────────┬────────────┘  │   │
│         ▼                  └──────────────│───────────────┘   │
│  layout.worker / treeLayout              ▼                    │
│  (altura maior p/ nó com rodapé)   useUpdateNode (parcial)    │
│                                     {...n, ...body} optimistic │
└───────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                              PATCH /nodes/:id  (Zod estendido)
                              status | assignee | isCritical
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Componente | Local | Como usar |
|---|---|---|
| `useUpdateNode` | `packages/web/src/api/nodes.ts` | **Sem mudança de lógica** — `onMutate` já faz `{ ...n, ...body }`. Cobre os 3 campos novos automaticamente |
| `NodeEditForm` | `pages/map/components/NodeEditDialog.tsx` | Adicionar 3 seções abaixo das cores. Padrão de submit (Enter/blur) do título reusado p/ responsável |
| `ColorSwatchGrid` | `pages/map/components/ColorSwatchGrid.tsx` | Referência de padrão para `StatusSelector` (grid de botões com seleção/aria) |
| `Input` | `components/ui/input.tsx` | Campo "Responsável" |
| `Button` | `components/ui/button.tsx` | Botões de status e toggle "Crítico" (variant + aria-pressed) |
| `MindNode` | `pages/map/components/MindNode.tsx` | Reestruturar de 1 linha p/ coluna (header + rodapé condicional) |
| `layout.worker.ts` + `treeLayout.ts` | `packages/web/src/lib/` | Já aceitam `height` por nó — passar altura computada |
| `PATCH /nodes/:id` | `packages/api/src/routes/nodes.ts:43` | Estender Zod body + montagem do `data` |
| `toNodeDto` | `packages/api/src/mappers/nodes.ts` | **Sem mudança** — já mapeia status/assignee/isCritical |

### Integration Points

| Sistema | Integração |
|---|---|
| `UpdateNodeBody` (shared) | Adicionar `status?`, `assignee?`, `isCritical?` |
| `PATCH /nodes/:id` | Estender Zod (enum + string nullable + boolean) e o refine "≥1 campo"; montar `data` com os novos campos |
| Prisma schema | **Nenhuma mudança** — `status`/`assignee`/`isCritical` já existem (M1, AD-003) |
| Layout (elk + fallback) | Altura do nó passa a depender de ter task props (rodapé) |

### Concerns relevantes (`CONCERNS.md`)

- **Fragile: sync `rfNodes` ↔ `useNodesState`** — M6 não muda esse mecanismo; só consome `node` via `data`. Risco baixo. Não tocar no fluxo de sync.
- **Fragile: fallback de layout no caminho crítico** — `nodeHeight()` entra no worker E no fallback `simpleTreeLayout`; manter os dois consistentes via **um único helper compartilhado** (evita deriva).
- **UX cosmético: inline edit ignora `textColor`** — fora do escopo de M6; não regredir.

---

## Components

### A. Backend

#### 1. `PATCH /nodes/:id` (estender)

- **Local**: `packages/api/src/routes/nodes.ts:43-71`
- **Mudança no Zod body**:
  ```typescript
  body: z.object({
    title: z.string().trim().min(1).optional(),
    bgColor: z.string().regex(HEX).nullable().optional(),
    textColor: z.string().regex(HEX).nullable().optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']).nullable().optional(),
    assignee: z.string().trim().min(1).nullable().optional(),  // string vazia → tratada como null no handler
    isCritical: z.boolean().optional(),
  }).refine(
    (d) => Object.values(d).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  )
  ```
  - `status` inválido (fora do enum) ⇒ Zod retorna 400 automaticamente (M6-11).
  - `assignee`: aceitar `null` reseta; string passa por `trim().min(1)`. O cliente envia `null` quando o campo fica vazio (decisão: normalização da string vazia → null acontece no **cliente**, mantendo o validador estrito).
- **Mudança no handler**: adicionar ao `data` os campos presentes:
  ```typescript
  if (status !== undefined) data.status = status;
  if (assignee !== undefined) data.assignee = assignee;
  if (isCritical !== undefined) data.isCritical = isCritical;
  ```
- **Reuses**: estrutura de update parcial já existente (M5).

#### 2. `UpdateNodeBody` (estender)

- **Local**: `packages/shared/src/node.ts:26`
  ```typescript
  export interface UpdateNodeBody {
    title?: string;
    bgColor?: string | null;
    textColor?: string | null;
    status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | null;
    assignee?: string | null;
    isCritical?: boolean;
  }
  ```

### B. Frontend — constantes e helpers

#### 3. `task-meta.ts` (novo)

- **Purpose**: Fonte única de verdade dos metadados de tarefa (status options, cores, helpers de exibição).
- **Local**: `packages/web/src/pages/map/components/task-meta.ts`
- **Interface**:
  ```typescript
  import type { NodeDto } from '@mindmap/shared';

  type NodeStatus = NonNullable<NodeDto['status']>;

  interface StatusMeta {
    value: NodeStatus;
    label: string;   // "Pendente" | "Em andamento" | "Concluído" | "Bloqueado"
    color: string;   // hex semântico (cinza/azul/verde/vermelho) — ponto e botão ativo
  }

  export const STATUS_OPTIONS: readonly StatusMeta[];
  export function statusMeta(value: NodeStatus): StatusMeta;       // lookup
  export function getInitials(assignee: string): string;          // determinístico, máx 2 chars
  export function hasTaskProps(node: NodeDto): boolean;            // status || assignee || isCritical
  ```
- **`getInitials`** (regra determinística, M6 edge case):
  - 2+ palavras ⇒ 1ª letra das 2 primeiras palavras (ex.: "Lucas Martins" → "LM").
  - 1 palavra ⇒ 2 primeiras letras (ex.: "Lucas" → "LU").
  - sempre `.toUpperCase()`, truncado em 2; usar `Array.from(str)` para não quebrar com emoji/acentos.
- **Cores semânticas**: Pendente=`#6b7280` (cinza), Em andamento=`#3b82f6` (azul), Concluído=`#22c55e` (verde), Bloqueado=`#ef4444` (vermelho). Tons finais ajustáveis na implementação.

#### 4. `nodeHeight()` helper de layout (novo, compartilhado)

- **Purpose**: Única função que decide a altura do nó para o layout, usada por worker E fallback.
- **Local**: `packages/web/src/lib/nodeSize.ts` (novo) — exporta `NODE_WIDTH`, `NODE_HEIGHT_BASE`, `NODE_HEIGHT_WITH_FOOTER`, `nodeHeight(node)`.
- **Regra**: `nodeHeight(node) = hasTaskProps(node) ? NODE_HEIGHT_WITH_FOOTER (~58) : NODE_HEIGHT_BASE (40)`.
- **Integração**:
  - `layout.worker.ts`: substituir `NODE_HEIGHT` fixo por `nodeHeight(node)` ao montar root e filhos (linhas 44-45, 60-61). Worker recebe `NodeDto` completo → tem os campos de tarefa.
  - `treeLayout.ts`: idem no fallback (`NODE_H` vira `nodeHeight(n)` por nó; `nextY += nodeHeight + GAP_Y`).
  - ⚠️ `hasTaskProps` é importado de `task-meta.ts`; garantir que o import funcione dentro do worker (sem deps de DOM). Manter `nodeSize.ts`/`task-meta.ts` puros (só tipos + lógica), sem React.

> Nota: o worker e o fallback hoje usam constantes locais duplicadas (`NODE_WIDTH`/`NODE_HEIGHT` no worker; `NODE_W`/`NODE_H` em treeLayout). M6 centraliza em `nodeSize.ts` para evitar deriva (melhoria oportunista, escopo mínimo).

### C. Frontend — componentes de UI

#### 5. `StatusSelector` (novo)

- **Purpose**: Botões segmentados coloridos para escolher/limpar status.
- **Local**: `packages/web/src/pages/map/components/StatusSelector.tsx`
- **Props**:
  ```typescript
  interface StatusSelectorProps {
    value: NodeDto['status'];                 // status atual ou null
    onSelect: (status: NodeDto['status']) => void;  // null quando clica no ativo
  }
  ```
- **Comportamento**:
  - Renderiza `STATUS_OPTIONS.map(...)` como 4 botões lado a lado (label visível — M6-22).
  - Botão ativo: `backgroundColor` = cor do status + texto contrastante; inativos: outline neutro.
  - Click no ativo ⇒ `onSelect(null)` (M6-03). Click em inativo ⇒ `onSelect(value)`.
  - Cada botão é `<button type="button">` com `aria-pressed`, focável, ativável por Enter/Space (M6-21).
- **Reuses**: padrão visual/aria do `ColorSwatchGrid`; `Button` ou `<button>` nativo com classes.

#### 6. `NodeEditForm` (estender)

- **Local**: `pages/map/components/NodeEditDialog.tsx:39`
- **Adições** (abaixo dos `ColorSwatchGrid`):
  - **Status**: `<StatusSelector value={node.status} onSelect={(s) => onUpdateNode({ status: s })} />`
  - **Responsável**: `<Input>` controlado (estado local `assignee`, init `node.assignee ?? ''`). Submit em Enter/blur: `const v = assignee.trim(); onUpdateNode({ assignee: v === '' ? null : v })` — só dispara se mudou (espelha o guard do título). (M6-04, M6-05)
  - **Prioridade**: toggle "🚩 Crítico" — `<button aria-pressed={node.isCritical} onClick={() => onUpdateNode({ isCritical: !node.isCritical })}>`. Estilo ativo/inativo. Aplica na hora (M6-06).
  - Cada seção com `<label>` (`text-xs font-medium text-muted-foreground`), mesmo padrão das cores.
- **Reuses**: estrutura `space-y-4`, padrão de submit do título.

#### 7. `NodeTaskIndicators` (novo)

- **Purpose**: Linha de rodapé compacta com indicadores progressivos.
- **Local**: `packages/web/src/pages/map/components/NodeTaskIndicators.tsx`
- **Props**: `{ node: NodeDto }`
- **Comportamento**:
  - Se `!hasTaskProps(node)` ⇒ retorna `null` (sem rodapé, sem mudança de layout — M6-18).
  - Caso contrário, `<div className="flex items-center gap-1.5 ...">` com, **em ordem e só se presentes**:
    - status: `<span>` ponto `w-2 h-2 rounded-full` com `backgroundColor: statusMeta(node.status).color`, `title`/`aria-label` = label (M6-14).
    - assignee: `<span>` com `getInitials(node.assignee)`, `title={node.assignee}` (M6-15).
    - isCritical: ícone `Flag` (lucide) ou 🚩, `aria-label="Crítico"` (M6-16).
  - Contraste sobre `bgColor` escuro: o rodapé usa um leve fundo/contorno neutro (ex.: texto `text-xs` com opacidade do `currentColor`), herdando `textColor` do nó quando definido. Tons exatos na implementação.
- **Reuses**: ícones lucide-react (já usados no MindNode); tipografia Tailwind.

#### 8. `MindNode` (reestruturar)

- **Local**: `pages/map/components/MindNode.tsx`
- **Mudança**: o container externo vira **coluna**:
  - de `className="relative flex items-center gap-1 ..."`
  - para `className="relative flex flex-col ..."`, com a linha atual (collapse + título + ações + handles) embrulhada num `<div className="flex items-center gap-1">` e, abaixo, `<NodeTaskIndicators node={node} />`.
  - Os `<Handle>` permanecem filhos diretos do container externo (posicionados por `Position.Left/Right`, independem do flow do flex).
  - `minWidth: 160` mantido; altura cresce naturalmente com o rodapé (e o layout reserva o espaço via `nodeHeight`).
- **Reuses**: todo o header atual intacto; só adiciona o rodapé e troca o eixo do flex.

---

## Data Models

Sem novos modelos. Campos já existentes no `Node` (AD-003):

```typescript
status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | null;
assignee: string | null;
isCritical: boolean;  // default false
```

`NodeStatus` (Prisma enum) ↔ labels pt-BR vivem em `task-meta.ts` (`STATUS_OPTIONS`), nunca hardcoded espalhados.

---

## Error Handling Strategy

| Cenário | Tratamento | Impacto p/ usuário |
|---|---|---|
| API falha no update de tarefa | `useUpdateNode.onError` faz rollback do snapshot + toast (já existe) | Indicador reverte; toast "Erro ao atualizar nó" |
| `status` inválido | Zod 400 antes do handler | Não ocorre via UI (valores vêm do enum); protege contra payload manual |
| `assignee` só com espaços | Cliente faz `trim()` → `null`; servidor reseta | Responsável volta a vazio |
| Cliques rápidos de status | Cada clique = 1 PATCH; last-write-wins; `onSettled` invalida e reconcilia | Estado final consistente com o último clique |
| Nó com `bgColor` escuro + rodapé | Indicadores herdam `textColor`/contorno neutro | Indicadores legíveis (refinável durante uso) |

---

## Tech Decisions (não-óbvias)

| Decisão | Escolha | Racional |
|---|---|---|
| Onde normalizar `assignee` vazio | No **cliente** (`'' → null`); validador do servidor estrito (`min(1).nullable()`) | Mantém o contrato do PATCH limpo e testável; evita ramo de "string vazia significa reset" no servidor |
| Altura do nó com rodapé | `nodeHeight(node)` computado no worker + fallback (não bump global) | Exibição progressiva: só nós com task props ocupam mais espaço; evita sprawl vertical em mapas sem tarefas |
| Centralizar dimensões em `nodeSize.ts` | Helper compartilhado worker/fallback | Evita deriva entre as duas cópias de `NODE_HEIGHT` (uma fragile area de layout já registrada) |
| `getInitials` determinístico | Regra fixa (2 palavras→iniciais, 1 palavra→2 letras), `Array.from` | Edge case do spec; previsível e seguro p/ emoji/acentos |
| Toggle de prioridade sem novo primitivo | `<button aria-pressed>` estilizado | Não existe `Switch`/`Checkbox` em `ui/`; criar primitivo global p/ 1 uso é over-engineering (regra "reusar antes de criar") |
| Mutation inalterada | Reusar `{ ...n, ...body }` | `onMutate` já é genérico; só o tipo muda |

---

## Verificação dos Success Criteria (rastreio)

- Dialog com 3 controles → componentes 5, 6.
- Optimistic + persistência → reuso de `useUpdateNode` (sem mudança) + PATCH estendido (comp. 1, 2).
- Exibição progressiva no canvas → componentes 7, 8 + `hasTaskProps`.
- Sem mudança de layout quando vazio → `NodeTaskIndicators` retorna null + `nodeHeight` = base.
- status inválido 400 / update parcial → comp. 1 (Zod + handler).
- Testes: API (`nodes.test.ts`) cobre M6-08…M6-12; e2e cobre dialog + indicadores (AD-014).

---

## Skills por área (executor)

- **`api-backend`** → comp. 1, 2 e testes de rota.
- **`web-component-creation`** → comp. 5, 6, 7 (StatusSelector, form, indicadores).
- **`react-flow`** → comp. 7, 8 e `nodeHeight` (integração canvas/layout).
- **`web-api-integration`** → confirmar fluxo da mutation (sem nova lógica).
