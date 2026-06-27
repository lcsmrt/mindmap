# M15 — Resize horizontal do card: Design

**Spec:** [`spec.md`](./spec.md)
**Status:** Draft

> Diagramas inline (mermaid). A skill `mermaid-studio` não está instalada — para renderização SVG/validação, considere instalá-la (recomendação única).

---

## Architecture Overview

A largura deixa de ser a constante `NODE_WIDTH` e passa a ser **largura por nó**, derivada de `node.width ?? NODE_WIDTH`. Diferente da **altura** (que é *medida* do DOM no M12), a largura é um **input do usuário**: vem do dado persistido ou, durante um arraste, de um **estado de rascunho** local (espelhando o `ghostOffset`/`draggingId` do `useNodeDrag` — feedback ao vivo, persiste no `pointerup`).

O fluxo é o mesmo do M12, com a largura entrando ao lado da altura no `computeTreeLayout`:

```mermaid
graph TD
    Handle[Alça de resize no MindNode<br/>pointerdown→move→up] -->|delta tela→mundo via zoom matrix| Draft[activeResize {id,width}<br/>estado em MapCanvasInner]
    Draft -->|widthFn n => draft? : node.width ?? NODE_WIDTH| Layout[computeTreeLayout<br/>nodeSizeFn + nodeWidthFn]
    DB[(node.width persistida)] -->|node.width| Layout
    Layout -->|PositionedNode.width por nó| Render[wrapper width=p.width<br/>texto reflui]
    Render -->|ResizeObserver mede altura M12| Heights[heights map]
    Heights --> Layout
    Layout --> Slots[computeSlots<br/>colX/colWidth por largura real]
    Handle -->|pointerup| Persist[useUpdateNode width<br/>optimistic + PATCH /nodes/:id]
    Persist --> DB
```

**Invariante de convergência (estendido do M12).** A **largura** é sempre um *input* (persistência, ou o rascunho do arraste guiado pelo ponteiro), **nunca** um output do layout. O layout produz x/y/altura — nenhum deles realimenta a largura. Logo:

- Reposicionar (mudar x/y) não muda a largura ⇒ não dispara nova medição de largura/altura ⇒ sem loop.
- Mudar a largura (só via arraste do usuário) → texto reflui → altura re-medida (M12) → 1 relayout → estabiliza. É um evento pontual, dirigido pelo ponteiro, que termina quando o usuário solta.
- O **teto de conteúdo** é medido a partir do texto (intrínseco), independente da largura aplicada ⇒ medir o teto não realimenta a largura.

**Decisão de colunas (usuário, 2026-06-27): por nó.** Mantém o comportamento natural do `d3-flextree` — cada nó espaça seus filhos pela **própria** largura; colunas ficam escalonadas entre ramos de larguras distintas. Sem alinhar por profundidade (sem `max(width)` por nível). Preserva a simplicidade e o invariante.

**Addendum (pós-M15, 2026-06-27 — AD-024):** o invariante "largura é sempre *input*, nunca medida" foi **revisado para o caso `width=null`**. Em uso, cards nunca redimensionados nasciam na constante fixa `NODE_WIDTH` (180), maiores que o conteúdo. Agora a largura default deriva da **medição de conteúdo** do DOM (`width: max-content` no wrapper, limitado a `[MIN_NODE_WIDTH, NODE_WIDTH]`), realimentada no layout pelo mesmo `ResizeObserver` do M12 (que passou a expor `widths`). O invariante de convergência **continua válido**: a largura de conteúdo é intrínseca ao texto (`max-content`), independente da largura aplicada → sem loop. Largura **explícita** (após resize) segue input puro. Ver AD-024 no STATE. (Bug aberto não relacionado: trepidação durante o arraste — CONCERNS.md.)

---

## Code Reuse Analysis

### Existing Components to Leverage

| Componente | Local | Como usar |
| --- | --- | --- |
| `computeTreeLayout(tree, nodeSizeFn)` | `web/src/lib/useTreeLayout.ts:84` | **Estender** com 2º param `nodeWidthFn` (espelha exatamente o ponto de injeção `nodeSizeFn` do M12). |
| `nodeSizeFromHeights` (padrão de fallback) | `web/src/lib/useTreeLayout.ts:12` | **Espelhar** num `nodeWidthFromNode`/`nodeWidth(node) = node.width ?? NODE_WIDTH` (puro, testável). |
| `useTreeLayout(nodes, edges, heights?)` | `web/src/lib/useTreeLayout.ts:199` | Já monta o `sizeFn`; **monta também o `widthFn`** (com override do rascunho de resize). |
| `Slot`/`computeSlots`/`nearestSlot` | `web/src/lib/slots.ts` | **Estender** `Slot` com `colWidth`; `colX` de pai vazio usa `parentPos.width`; `nearestSlot`/ghost usam `colWidth` no eixo X. **Não tocar** a seleção por band vertical do M13. |
| `useNodeDrag` (rascunho local + persiste no drop) | `web/src/pages/map/components/useNodeDrag.ts` | **Padrão de referência** para o gesto de resize (estado local durante o arraste, persiste no `pointerup`; `setPointerCapture`; `clientToWorld`). |
| Toolbar revelada no hover (`group`/opacity) | `MindNode.tsx:217` | **Mesmo padrão CSS** para revelar a alça de resize (`opacity-0 group-hover:opacity-100`, `pointer-events` no hover). |
| `clientToWorld` + `scale` (zoom matrix) | `MapCanvas.tsx:69`, `:102` | Converter o delta de tela do ponteiro em delta de mundo (dividir por `scale`). |
| `useUpdateNode()` (optimistic + rollback) | `web/src/api/nodes.ts:116` | Persistir a largura no `pointerup`: `updateNode({ id, mapId, body: { width } })`. O optimistic já faz `{ ...n, ...body }` → `width` flui sem mudança no hook. |
| `useMeasuredHeights` (observer compartilhado) | `web/src/pages/map/components/useMeasuredHeights.ts` | **Padrão de referência** para medir o teto de conteúdo, se for por observer; ou medição pontual no `pointerdown` (ver Tech Decisions). |
| Migration `add_node_side` (precedente) | `api/prisma/migrations/20260625132913_add_node_side/` | **Espelhar** a forma da migration aditiva nullable (`ALTER TABLE "Node" ADD COLUMN`). |
| `toNodeDto` / `PATCH /:id` Zod+data-build | `api/src/mappers/nodes.ts:4`, `api/src/routes/nodes.ts:58` | **Estender** com `width` (mapper + schema + `data` condicional), mesmo molde dos campos existentes. |

### Integration Points

| Sistema | Integração |
| --- | --- |
| Prisma `Node` | Coluna nova `width Int?` (nullable, sem default no banco). Migration aditiva. |
| `packages/shared` | `NodeDto.width: number \| null`; `UpdateNodeBody.width?: number`. Contrato único front/back. |
| `PATCH /nodes/:id` | Aceita `width` (Zod `int().positive()` + teto de sanidade); persiste como os demais campos opcionais. `/:id/move` e `POST /` **intactos** (nó novo nasce `width = null`). |
| TanStack Query | `useUpdateNode` (optimistic) persiste no drop. Durante o arraste, **não** persiste (estado de rascunho local). |

### CONCERNS.md

`CONCERNS.md` registra (M13/AD-021) que `slots.ts` é área sensível (seleção de slot co-coluna). **Mitigação:** M15 toca **só o eixo X** de `slots.ts` (`colX`/`colWidth`/`SLOT_MAX_DISTANCE`), preservando a seleção lexicográfica por band vertical (`bandTop/bandBottom`/`groupTop/groupBottom`) intacta; os testes de band do M13 (slots 23) seguem verdes como gate de não-regressão. Também registrado o `refCallbacks` micro-leak do `useMeasuredHeights` — se a medição do teto reusar esse hook, **não** agravar o leak.

---

## Components

### 1. `nodeWidth` (helper puro) — largura por nó

- **Purpose:** Resolver a largura de layout de um nó: largura persistida/rascunho vence; ausente → default.
- **Location:** `web/src/lib/nodeSize.ts` (junto de `NODE_WIDTH`/`estimateNodeHeight`).
- **Interfaces:**
  - `export const NODE_WIDTH = 180` — permanece como **default** de `width = null` (não é mais a verdade única).
  - `export const MIN_NODE_WIDTH = 120` — piso (a confirmar no smoke; ~3 botões da toolbar + chevron/▲ cabem).
  - `export function nodeWidth(node: NodeDto): number` → `node.width ?? NODE_WIDTH`.
- **Dependencies:** `NodeDto` (com `width` de T1).
- **Reuses:** mesmo arquivo/estilo de `estimateNodeHeight`.

### 2. `computeTreeLayout` — largura por nó no flextree

- **Purpose:** Posicionar a árvore usando largura **por nó** no eixo de profundidade.
- **Location:** `web/src/lib/useTreeLayout.ts:84` (modificar).
- **Interfaces:**
  - `computeTreeLayout(tree, nodeSizeFn = estimateNodeHeight, nodeWidthFn: (node: NodeDto) => number = () => NODE_WIDTH): LayoutResult` — novo 3º param, default = constante (mantém os testes atuais verdes sem mudança).
  - `flextree.nodeSize = (n) => [nodeSizeFn(n.data.node) + GAP_Y, nodeWidthFn(n.data.node) + GAP_X]` — profundidade agora por nó.
  - Cada uso de `NODE_WIDTH/2` no posicionamento passa a usar a largura **daquele** nó: raiz (`x: -w/2`), `worldX = dir*n.y - w/2`, `nearX = dir*(n.y - w/2)`, `parentFarX = dir*(p.y + wParent/2)`; `PositionedNode.width = nodeWidthFn(node)`.
- **Dependencies:** `d3-flextree`, `nodeWidth`.
- **Reuses:** estrutura/percurso atuais; espelha o ponto de injeção `nodeSizeFn`.
- ⚠️ **Verificar (Knowledge Verification Chain):** a semântica de `n.y` no `d3-flextree` quando o tamanho de profundidade **varia por nó** — confirmar se `n.y` continua sendo a borda-near do nó com a **própria** extensão, e se irmãos (mesmo pai, mesma profundidade) compartilham `n.y` enquanto seus filhos divergem (efeito escalonado esperado). Cobrir com unit test de não-sobreposição com larguras mistas antes de fixar. Não assumir.

### 3. `useTreeLayout` — monta o `widthFn` com override de rascunho

- **Purpose:** Alimentar o layout com a largura por nó, incluindo o rascunho do resize em curso.
- **Location:** `web/src/lib/useTreeLayout.ts:199` (modificar).
- **Interfaces:**
  - `useTreeLayout(nodes, edges, heights?, activeResize?: { id: string; width: number } | null): LayoutResult`.
  - `widthFn = (n) => activeResize?.id === n.id ? activeResize.width : nodeWidth(n)`; passado como 3º arg de `computeTreeLayout`.
  - `useMemo` deps += `activeResize`.
- **Dependencies:** `nodeWidth`, `computeTreeLayout`.
- **Reuses:** assinatura/padrão do `heights` (M12).

### 4. `Slot` + `computeSlots`/`nearestSlot` — geometria do drop por largura real

- **Purpose:** Os slots de drop e a barra-fantasma acompanham as larguras reais.
- **Location:** `web/src/lib/slots.ts` (modificar).
- **Interfaces:**
  - `Slot` ganha `colWidth: number` (largura da coluna onde a barra desenha).
  - Pai/lado **vazio**: `colX = parentPos.x + dir * (parentPos.width + GAP_X)` (largura **do pai**, não constante); `colWidth = parentPos.width` (proxy — a coluna do 1º filho herda a largura do pai) **ou** a largura do nó arrastado (decidir; ver Tech Decisions).
  - Grupo **populado**: `colX = children[0].x`; `colWidth = children[0].width` (já per-node em `PositionedNode`).
  - `nearestSlot`: `colCenter = slot.colX + slot.colWidth / 2` (substitui `NODE_WIDTH / 2`). **Band vertical do M13 inalterada.**
  - `SLOT_MAX_DISTANCE`: pode seguir `NODE_WIDTH * 1.5` (limiar fixo de snap-back; é folga, não precisa ser exato por nó).
- **Dependencies:** `PositionedNode.width` (de #2).
- **Reuses:** toda a lógica de band/lado/índice do M9+M13 — **só o eixo X muda**.

### 5. Alça de resize (`MindNode`) + estado de arraste (`MapCanvasInner`/`CanvasLayers`)

- **Purpose:** Gesto de resize na borda direita, com feedback ao vivo e persistência no soltar.
- **Location:** `web/src/pages/map/components/MindNode.tsx` (alça), `MapCanvas.tsx` (estado `activeResize` + handlers + fio para o layout).
- **Interfaces (MindNode):**
  - Nova `<div>` `absolute right-0 top-0 h-full w-1.5 cursor-ew-resize`, revelada no hover (`opacity-0 group-hover:opacity-100`, `pointer-events-none` → `auto` no hover), `data-testid="resize-handle"`.
  - `onPointerDown(e)`: `e.stopPropagation()` (não inicia o drag-to-place do wrapper) + `e.currentTarget.setPointerCapture(e.pointerId)` + dispara `data.onResizeStart(node.id, e)`.
  - Novos callbacks em `MindNodeData`: `onResizeStart(id, e)`, e o componente encaminha `onResizeMove`/`onResizeEnd` (ou o handler central lida via pointer capture — ver Tech Decisions sobre onde os listeners vivem).
- **Interfaces (MapCanvasInner):**
  - Estado `const [activeResize, setActiveResize] = useState<{ id: string; width: number } | null>(null)`.
  - No `pointerdown` da alça: mede o **teto de conteúdo** do nó (ver #6), guarda `startWidth = nodeWidth(node)`, `startClientX`, `ceiling`.
  - No `pointermove`: `worldDx = (clientX - startClientX) / scale`; `width = clamp(startWidth + worldDx, MIN_NODE_WIDTH, ceiling)`; `setActiveResize({ id, width })`.
  - No `pointerup`: persiste `updateNode({ id, mapId, body: { width: Math.round(width) } })`; `setActiveResize(null)`.
  - `activeResize` entra em `useTreeLayout(...)` (#3) → card e filhos reflowam ao vivo.
- **Dependencies:** `clientToWorld`/`scale`, `useUpdateNode`, `nodeWidth`, medição do teto (#6), `clampWidth` (#7).
- **Reuses:** padrão `useNodeDrag` (pointer capture + rascunho + persiste no drop); toolbar hover.
- ⚠️ **Isolamento:** a alça **deve** `stopPropagation` no `pointerdown` para o `onNodePointerDown` do wrapper (`MapCanvas.tsx:175`) não iniciar drag-to-place. Clique simples (sem mover) → no-op (sem reset; decisão 2026-06-27).

### 6. Medição do teto de conteúdo (largura numa linha)

- **Purpose:** Calcular a largura máxima = "todo o texto cabe em uma linha", para o arraste parar ali (sem espaço em branco).
- **Location:** `web/src/pages/map/components/` (helper de medição; ver Tech Decisions para mecanismo).
- **Interfaces (candidata):** `measureContentWidth(cardEl: HTMLElement): number` → largura intrínseca de uma linha (título + rodapé), incluindo o padding horizontal do card.
- ⚠️ **Verificar (Knowledge Verification Chain — não assumir):** mecanismo robusto para "largura de uma linha". Candidato líder: **probe oculto** por nó/compartilhado, clone do conteúdo com `white-space: nowrap; width: max-content`, ler `offsetWidth` no `pointerdown` (1× por arraste, sem flash). Alternativas: `range.getBoundingClientRect()` sobre o texto; `canvas.measureText` com a fonte computada (fallback). Confirmar via MDN/Context7 antes de fixar. O teto = `max(larguraTítuloNumaLinha, larguraRodapé) + paddingX`.

### 7. `clampWidth` (helper puro)

- **Purpose:** Lógica pura do clamp do arraste — testável sem DOM.
- **Location:** `web/src/pages/map/components/` (junto do resize) ou `lib/`.
- **Interfaces:** `clampWidth(startWidth: number, worldDx: number, floor: number, ceiling: number): number` → `Math.max(floor, Math.min(startWidth + worldDx, Math.max(floor, ceiling)))`.
- **Reuses:** —. Coberto por unit test (piso, teto, teto < piso degenera p/ piso).

### 8. Backend — coluna, contrato, endpoint

- **Schema (`api/prisma/schema.prisma`):** `width Int? @map("width")` no `Node` (nullable, sem default). Migration `add_node_width` (aditiva, `ALTER TABLE "Node" ADD COLUMN "width" INTEGER`).
- **Shared (`packages/shared/src/node.ts`):** `NodeDto.width: number | null`; `UpdateNodeBody.width?: number`.
- **Mapper (`api/src/mappers/nodes.ts`):** `width: node.width`.
- **Route (`api/src/routes/nodes.ts:58` PATCH `/:id`):** body Zod += `width: z.number().int().positive().max(WIDTH_MAX).optional()` (`WIDTH_MAX` de sanidade, ex.: 1000 — o teto real é do front, dinâmico/conteúdo); `data.width` no build condicional; `.refine` "ao menos um campo" já cobre `width`. `POST /` e `/:id/move` **intactos**.

---

## Data Models

### `Node` (Prisma) — campo novo

```prisma
model Node {
  // ... campos atuais ...
  side       Side?       @map("side")
  width      Int?        @map("width")   // M15: largura por nó; null = NODE_WIDTH (180)
  // ...
}
```

**Relationships:** nenhuma nova; é atributo escalar do nó. Espelha o precedente de `side` (1 dado estrutural a mais, **sem x/y livre** — AD-002 revisada parcialmente → **AD-023**).

### DTO/Contrato

```typescript
interface NodeDto { /* ... */ side: 'LEFT' | 'RIGHT' | null; width: number | null; /* ... */ }
interface UpdateNodeBody { /* ... */ isCritical?: boolean; width?: number; }
```

---

## Error Handling Strategy

| Cenário | Tratamento | Impacto no usuário |
| --- | --- | --- |
| Falha do `PATCH width` (rede) | Optimistic com rollback do `useUpdateNode` (snapshot → restore `onError`) + invalidate `onSettled` | Largura volta ao valor anterior; banner "Salvando…"/erro como hoje |
| `width` inválida no PATCH (≤0, não-int, > max) | Zod 400 (`fastify-type-provider-zod`) | Requisição rejeitada; front nunca envia inválido (clamp local) — defesa em profundidade |
| `width` persistida > teto de conteúdo atual (texto encolheu) | **Render aplica a largura gravada verbatim** (card com folga à direita); o teto só limita **novos** arrastes. Sem auto-clamp no render (não mutar dado silenciosamente nem brigar com o usuário) | Card mais largo que o texto até o próximo resize; sem quebra de layout |
| Teto de conteúdo < piso (texto curtíssimo) | `clampWidth` usa `Math.max(floor, ceiling)` → faixa colapsa no piso; alça praticamente não alarga | Nó curto quase não redimensiona (esperado) |
| `width` corrompida vinda do back (defensivo) | `nodeWidth` aplica o valor; se necessário, clamp defensivo no render a `[MIN, max sanidade]` | Sem crash |
| Medição do teto falha/indisponível (sem DOM) | Fallback: teto = um múltiplo do default (ex.: `NODE_WIDTH * 4`) para não travar o arraste | Resize funciona com teto grosseiro |

---

## Tech Decisions (não-óbvias)

| Decisão | Escolha | Racional |
| --- | --- | --- |
| Fonte da largura ao vivo durante o arraste | **Estado de rascunho `activeResize` em `MapCanvasInner`** (não cache do Query a cada move) | Espelha `useNodeDrag` (rascunho local, persiste no drop); evita re-layout via cache+invalidate a cada pixel. Persiste 1× no `pointerup`. |
| Onde o layout lê a largura | `widthFn` em `useTreeLayout` com override do rascunho; senão `node.width ?? NODE_WIDTH` | Reusa o ponto de injeção do M12 (`nodeSizeFn`); card e filhos reflowam ao vivo de graça. |
| Alinhamento de colunas | **Por nó (natural flextree)** | Decisão do usuário (2026-06-27). Simplicidade + invariante; ragged aceito. |
| Mecanismo do teto de conteúdo | **Probe `max-content`/`nowrap` medido no `pointerdown`** (1× por arraste) — *a verificar* | Determinístico e fiel à fonte; sem flash; barato (só ao arrastar). Verificar API antes de fixar; fallback `canvas.measureText`. |
| `colWidth` de slot de pai vazio | Largura **do pai** (proxy) | O 1º filho de um pai vazio ainda não existe; a coluna nasce alinhada à largura do pai. Ajustar p/ largura do arrastado se o smoke mostrar desalinho. |
| `WIDTH_MAX` no backend | `int().positive().max(~1000)` | O teto real é do front (dinâmico, por conteúdo); o back só barra lixo. Número de sanidade, não regra de produto. |
| Reset ao default | **Não implementar** | Decisão do usuário (2026-06-27). Vira Deferred Idea. |
| Render com `width` > teto | **Verbatim, sem auto-clamp** | Não mutar dado silenciosamente; teto é constraint de gesto, não de armazenamento. |
| Default de `width` | `NODE_WIDTH = 180` permanece como fallback de `null` | Zero regressão p/ nós nunca redimensionados; `NODE_WIDTH` deixa de ser verdade única, vira default. |

---

## Riscos & Mitigações

- **Semântica do `d3-flextree` com profundidade variável** (componente #2): maior risco geométrico. Mitigar com unit tests de não-sobreposição/escalonamento de larguras mistas e verificação da API antes de fixar offsets.
- **Loop medir↔layout** ao casar largura-input com altura-medida: mitigado pelo invariante (largura nunca é output) — documentar e cobrir com o smoke (arrastar não entra em loop de relayout).
- **Regressão na seleção de slot do M13** (`slots.ts`): mitigar tocando só o eixo X; rodar os 23 testes de `slots` (band vertical) como gate de não-regressão.
- **Medição do teto** (#6): API a verificar; isolar num helper com fallback para não travar o gesto.
- **Isolamento do gesto vs. drag-to-place**: `stopPropagation` + `setPointerCapture`; cobrir no e2e/smoke (arrastar a alça não move o nó de pai).
- **Ambiente de teste (correção do usuário, 2026-06-27):** há uma só `.env` apontando pro banco **dev** (`.env.test` removida); local (vitest + Playwright) roda contra o dev, nunca em prod. O e2e de resize pode rodar à vontade; o **L-007** (Playwright × prod) não se aplica mais.

---

## Mapa de Arquivos (diff esperado)

**Backend:**
- `api/prisma/schema.prisma` — coluna `width Int?`.
- `api/prisma/migrations/<ts>_add_node_width/migration.sql` — `ALTER TABLE`.
- `api/src/mappers/nodes.ts` — `width`.
- `api/src/routes/nodes.ts` — Zod + `data.width` no PATCH `/:id`.
- `api/test/...` — integração do PATCH `width`.

**Shared:**
- `packages/shared/src/node.ts` — `NodeDto.width`, `UpdateNodeBody.width`.

**Frontend:**
- `web/src/lib/nodeSize.ts` — `nodeWidth`, `MIN_NODE_WIDTH`.
- `web/src/lib/useTreeLayout.ts` (+ `.test.ts`) — `nodeWidthFn` + override de rascunho.
- `web/src/lib/slots.ts` (+ `.test.ts`) — `colWidth`/colX por largura real.
- `web/src/pages/map/components/MindNode.tsx` — alça de resize.
- `web/src/pages/map/components/MapCanvas.tsx` — `activeResize`, handlers, fio p/ layout, ghost por `colWidth`.
- `web/src/pages/map/components/types.ts` — callbacks de resize em `MindNodeData`.
- helper de medição do teto + `clampWidth` (+ teste do clamp).
- `web/e2e/...` — smoke de resize + persistência.

AD-002 revisada parcialmente (1 dado estrutural, sem x/y) → registrar **AD-023** na execução.
