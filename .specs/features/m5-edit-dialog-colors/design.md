# M5 — Dialog de Edição e Cores: Design

**Spec**: `.specs/features/m5-edit-dialog-colors/spec.md`
**Status**: Draft

---

## Architecture Overview

Fluxo principal: usuário clica no botão de edição (ícone Palette) no `MindNode` → `MapCanvas` abre o `NodeEditDialog` → usuário edita título e/ou seleciona swatches → cada ação dispara `useUpdateNode` com update parcial → optimistic update no cache → canvas renderiza cores via inline style.

```
┌──────────────────────────────────────────────────────────┐
│ MapCanvas (state owner)                                  │
│                                                          │
│  editDialogNodeId: string | null                         │
│                                                          │
│  ┌─────────────┐         ┌──────────────────────────┐    │
│  │  MindNode    │─click──▶│  NodeEditDialog           │   │
│  │  (Palette    │  icon   │                           │   │
│  │   button)    │         │  ┌─────────────────────┐  │   │
│  │              │         │  │ Title Input          │  │   │
│  │  renders     │         │  └─────────────────────┘  │   │
│  │  bgColor +   │         │  ┌─────────────────────┐  │   │
│  │  textColor   │         │  │ ColorSwatchGrid (bg) │  │   │
│  │  via inline  │         │  └─────────────────────┘  │   │
│  │  style       │         │  ┌─────────────────────┐  │   │
│  │              │         │  │ ColorSwatchGrid (txt)│  │   │
│  └──────────────┘         │  └─────────────────────┘  │   │
│                           └────────────┬──────────────┘   │
│                                        │                  │
│                              useUpdateNode (parcial)      │
│                              optimistic update no cache   │
└──────────────────────────────────────────────────────────┘
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | Como usar |
|---|---|---|
| `Dialog` + primitivos | `components/ui/dialog.tsx` | Base do `NodeEditDialog` |
| `ConfirmDialog` | `components/ConfirmDialog.tsx` | Pattern de referência (open/onCancel via prop) |
| `Button` | `components/ui/button.tsx` | Botão do swatch, botão "Padrão", trigger no MindNode |
| `Input` | `components/ui/input.tsx` | Campo de título no dialog |
| `useUpdateNode` | `api/nodes.ts:114-144` | Mutation existente — expandir para campos parciais |
| `useToast` | `components/ui/toast.tsx` | Erro no optimistic rollback (já integrado na mutation) |

### Integration Points

| Sistema | Integração |
|---|---|
| `PATCH /nodes/:id` | Expandir Zod schema para aceitar `{ title?, bgColor?, textColor? }` com pelo menos 1 campo |
| `UpdateNodeBody` (shared) | Todos os campos viram opcionais |
| `toNodeDto` mapper | Já mapeia `bgColor`/`textColor` — nenhuma mudança |
| Prisma schema | `bgColor`/`textColor` já existem como `String?` — nenhuma migração |

---

## Components

### 1. `NodeEditDialog`

- **Purpose**: Dialog modal para editar propriedades do nó (título + cores). Extensível para task props em M6.
- **Location**: `packages/web/src/pages/map/components/NodeEditDialog.tsx`
- **Props**:
  ```typescript
  interface NodeEditDialogProps {
    node: NodeDto | null;       // null = dialog fechado
    onUpdateNode: (fields: UpdateNodeBody) => void;
    onClose: () => void;
  }
  ```
- **Comportamento**:
  - `open` derivado de `node !== null`.
  - Título editável em `Input` controlado. Submit em Enter ou blur (mesmo UX do inline, sem surpresas). Título vazio é rejeitado (mantém anterior).
  - Duas seções: "Cor de fundo" e "Cor de texto", cada uma com um `ColorSwatchGrid`.
  - Cada swatch click chama `onUpdateNode({ bgColor: "#hex" })` imediatamente — sem botão "Salvar". Consistente com o spec: "aplicação imediata".
  - Título também submita via `onUpdateNode({ title: "..." })` em blur/Enter.
  - Fechar via X, Escape ou overlay. Sem efeitos colaterais (mudanças já foram aplicadas).
  - Foco inicial no campo de título (M5-19).
- **Reuses**: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Input`, `Button`.

### 2. `ColorSwatchGrid`

- **Purpose**: Grid de swatches coloridos com seleção e opção "Padrão" (null).
- **Location**: `packages/web/src/pages/map/components/ColorSwatchGrid.tsx`
- **Props**:
  ```typescript
  interface ColorSwatchGridProps {
    label: string;                   // "Cor de fundo" / "Cor de texto"
    colors: readonly ColorSwatch[];  // paleta importada de COLOR_PALETTE
    value: string | null;            // hex selecionado ou null
    onSelect: (color: string | null) => void;
  }
  ```
- **Comportamento**:
  - Primeiro item: botão "Padrão" (ícone Ban ou similar) — seleciona `null`.
  - Grid de botões circulares com `backgroundColor` do swatch. Tamanho: `w-7 h-7`.
  - Swatch selecionado tem ring/borda `ring-2 ring-primary ring-offset-2` (M5-09).
  - Acessível: cada swatch é `<button>` com `aria-label="<nome da cor>"`, focável via Tab, ativável via Enter/Space (M5-20, M5-21).
- **Reuses**: `Button` (variant ghost, tamanho custom) ou `<button>` nativo com classes Tailwind.

### 3. Paleta de Cores (constantes)

- **Purpose**: Definição da paleta fixa de swatches (AD-005).
- **Location**: `packages/web/src/pages/map/components/color-palette.ts`
- **Interface**:
  ```typescript
  interface ColorSwatch {
    hex: string;
    name: string;   // usado em aria-label
  }

  const BG_PALETTE: readonly ColorSwatch[];
  const TEXT_PALETTE: readonly ColorSwatch[];
  ```
- **Paleta concreta**:

  **BG_PALETTE** — 10 cores, equilibradas entre claras e escuras para cobrir temas claro/escuro:

  | Swatch | Hex | Nome |
  |---|---|---|
  | 🔴 | `#fecaca` | Vermelho claro |
  | 🟠 | `#fed7aa` | Laranja claro |
  | 🟡 | `#fef08a` | Amarelo claro |
  | 🟢 | `#bbf7d0` | Verde claro |
  | 🔵 | `#bfdbfe` | Azul claro |
  | 🟣 | `#ddd6fe` | Violeta claro |
  | 🩷 | `#fbcfe8` | Rosa claro |
  | ⬜ | `#f5f5f4` | Cinza claro |
  | 🌑 | `#334155` | Cinza escuro |
  | ⬛ | `#1e293b` | Ardósia |

  **TEXT_PALETTE** — 8 cores, foco em legibilidade:

  | Swatch | Hex | Nome |
  |---|---|---|
  | ⬛ | `#1e293b` | Ardósia |
  | ⬜ | `#f8fafc` | Branco |
  | 🔴 | `#dc2626` | Vermelho |
  | 🟢 | `#16a34a` | Verde |
  | 🔵 | `#2563eb` | Azul |
  | 🟣 | `#7c3aed` | Violeta |
  | 🟠 | `#ea580c` | Laranja |
  | 🩷 | `#db2777` | Rosa |

  Nota: a paleta é decisão de implementação (spec diz "a paleta concreta é decisão de implementação"). Pode ajustar tons depois sem impacto estrutural.

### 4. Mudanças em `MindNode`

- **Onde**: `packages/web/src/pages/map/components/MindNode.tsx`
- **O que muda**:
  1. **Inline style para cores**: o `<div>` wrapper recebe `style={{ backgroundColor: node.bgColor ?? undefined, color: node.textColor ?? undefined }}`. Quando `null`, omite a prop — Tailwind `bg-card text-foreground` prevalece (M5-13).
  2. **Botão de edição**: novo botão `Palette` (lucide) na barra de ações, entre o `+` e o `X`. Click chama `onOpenEditDialog()`.

### 5. Mudanças em `MindNodeData` (types)

- **Onde**: `packages/web/src/pages/map/components/types.ts`
- **Adiciona**: `onOpenEditDialog: () => void`

### 6. Mudanças em `MapCanvas`

- **Onde**: `packages/web/src/pages/map/components/MapCanvas.tsx`
- **O que muda**:
  1. **Estado do dialog**: `const [editDialogNodeId, setEditDialogNodeId] = useState<string | null>(null)`.
  2. **Derivar nó para o dialog**: `const editDialogNode = editDialogNodeId ? data?.nodes.find(n => n.id === editDialogNodeId) ?? null : null`.
  3. **Handler de update do dialog**: reutiliza `updateNode` existente, passando fields parciais. Callback:
     ```typescript
     const handleDialogUpdate = useCallback(
       (fields: UpdateNodeBody) => {
         if (!editDialogNodeId) return;
         updateNode({ id: editDialogNodeId, mapId, body: fields });
       },
       [updateNode, editDialogNodeId, mapId],
     );
     ```
  4. **Passa `onOpenEditDialog`** no `MindNodeData` de cada nó.
  5. **Renderiza `<NodeEditDialog>`** ao lado do `<ConfirmDialog>`.

---

## Data Models

### `UpdateNodeBody` (shared) — de → para

```typescript
// DE (atual)
interface UpdateNodeBody {
  title: string;
}

// PARA
interface UpdateNodeBody {
  title?: string;
  bgColor?: string | null;
  textColor?: string | null;
}
```

Pelo menos um campo deve estar presente. Validação no backend via Zod `.refine()`.

### Zod Schema no Backend — `PATCH /nodes/:id`

```typescript
const UpdateNodeSchema = z.object({
  title: z.string().trim().min(1).optional(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
}).refine(
  (data) => data.title !== undefined || data.bgColor !== undefined || data.textColor !== undefined,
  { message: 'At least one field must be provided' },
);
```

Cores validadas como hex 6 dígitos. `null` reseta a cor. `undefined` (campo omitido) não altera.

### Handler — `PATCH /nodes/:id`

```typescript
const { title, bgColor, textColor } = req.body;
const data: Record<string, unknown> = {};
if (title !== undefined) data.title = title;
if (bgColor !== undefined) data.bgColor = bgColor;
if (textColor !== undefined) data.textColor = textColor;

const updated = await prisma.node.update({
  where: { id: req.params.id },
  data,
});
```

### Optimistic Update — `useUpdateNode`

O `onMutate` hoje faz spread fixo de `{ title: body.title }`. Expandir para spread genérico:

```typescript
onMutate: async ({ id, mapId, body }) => {
  await queryClient.cancelQueries({ queryKey: ['nodes', mapId] });
  const snapshot = queryClient.getQueryData<NodeListResponse>(['nodes', mapId]);
  if (snapshot) {
    queryClient.setQueryData<NodeListResponse>(['nodes', mapId], {
      nodes: snapshot.nodes.map((n) =>
        n.id === id ? { ...n, ...body } : n,
      ),
    });
  }
  return { snapshot };
},
```

O spread `{ ...n, ...body }` aplica apenas os campos presentes no body (title, bgColor, textColor). Campos `undefined` não sobrescrevem. Campos `null` limpam corretamente.

---

## Error Handling Strategy

| Cenário | Handling | UX |
|---|---|---|
| PATCH falha (rede/500) | Rollback via snapshot (já implementado) | Toast de erro (padrão M4) |
| PATCH retorna 400 (hex inválido) | Rollback + toast | Cor reverte no canvas |
| Título vazio no dialog | Reject client-side (não envia PATCH) | Input mantém valor anterior |
| Cliques rápidos em swatches | Cada clique = 1 PATCH independente. Last-write-wins. | Canvas mostra cada cor momentaneamente |

---

## Mitigação de CONCERNS.md

**Sincronização rfNodes / useNodesState**: o dialog NÃO adiciona nós nem edges — apenas modifica propriedades de nós existentes via cache TanStack Query. O `rfNodes` memoizado recalcula, e o `useEffect` já existente sincroniza com React Flow. Risco baixo: o dialog não interfere com drag (está sobre overlay).

**Input uncontrolled no MindNode**: o campo de título no dialog é um Input separado (controlado via `useState`). Não herda a fragilidade do inline edit.

---

## Tech Decisions

| Decisão | Escolha | Justificativa |
|---|---|---|
| Sem botão "Salvar" no dialog | Cada ação (swatch click, título blur) é atômica | Spec: "aplicação imediata". UX consistente com inline edit. Dialog fecha clean. |
| Paleta em arquivo separado | `color-palette.ts` | Isolado, fácil de ajustar tons sem tocar em componente |
| Hex 6 dígitos sem alpha | Regex `/^#[0-9a-fA-F]{6}$/` | Simplicidade; alpha não tem caso de uso em v1 |
| Botão Palette no MindNode | Ícone `Palette` do lucide-react | Spec: "botão dedicado no nó" (decisão 3 da spec). Não usa menu/dropdown — direto. |
| `bgColor`/`textColor` como `undefined` no body quando omitidos | Prisma ignora campos `undefined` no `data` | Permite update parcial real sem spread explícito |
| Dialog é page-level component | `pages/map/components/NodeEditDialog.tsx` | Específico da página de mapa (regra frontend-structure) |
| ColorSwatchGrid é page-level | `pages/map/components/ColorSwatchGrid.tsx` | Específico da página de mapa; só promoveria para `components/` se M6+ reutilizasse |

---

## Requirement Traceability (Coverage por Componente)

| Componente | Requisitos cobertos |
|---|---|
| MindNode (botão + inline style) | M5-01, M5-11, M5-12, M5-13 |
| NodeEditDialog | M5-01, M5-02, M5-03, M5-04, M5-05, M5-19, M5-22 |
| ColorSwatchGrid | M5-06, M5-07, M5-08, M5-09, M5-10, M5-20, M5-21 |
| useUpdateNode (optimistic) | M5-14, M5-15 |
| PATCH /nodes/:id (backend) | M5-16, M5-17 |
| UpdateNodeBody (shared) | M5-16 |
| GET /maps/:id/nodes (já funciona) | M5-18 |
