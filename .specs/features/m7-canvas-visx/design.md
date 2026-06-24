# M7 — Migração do Canvas para visx: Design

**Spec**: `.specs/features/m7-canvas-visx/spec.md`
**Status**: Draft

---

## Research (verificado — fontes primárias)

Context7 estava indisponível no ambiente; os fatos abaixo vêm do **npm registry** (versões/peerDeps) e do **source do visx no GitHub** + **README do d3-flextree** (a doc renderizada do visx é client-side e não responde a fetch — fui ao source, que é autoritativo).

1. **Pacotes visx**: monorepo na **v4.0.0**, todos com peer `react@^18 || ^19` (React 18 ok). Relevantes: `@visx/zoom`, `@visx/shape`, `@visx/group`, (`@visx/hierarchy` e `@visx/drag` avaliados e **descartados** — ver abaixo).
2. **⚠️ Correção de premissa**: na v4, **`@visx/zoom` NÃO embrulha mais `d3-zoom`** — é construído sobre `@use-gesture/react`. Ou seja, o pan/zoom vem do `<Zoom>` do visx; não puxamos `d3-zoom` direto. (A AD-015 fala "d3-zoom" como conceito; na prática o motor é o `<Zoom>`.)
3. **Alturas variáveis de nó (40/58px) → `d3-flextree`**. Tanto `d3.tree()` quanto o `<Tree>` do visx só fazem `nodeSize` **uniforme**. `d3-flextree@2.1.2` (tipos em `@types/d3-flextree@2.1.4`) é o algoritmo O(n) (van der Ploeg 2013) para tamanhos variáveis. API: `flextree().nodeSize(n => [w, h]).spacing(...)`; `const tree = layout.hierarchy(data); layout(tree); tree.each(n => n.x, n.y)`. É classe derivada de d3-hierarchy → lê-se `node.x/node.y` direto. **Por isso descartamos o `<Tree>` do visx** (uniforme).
4. **Edges curvas**: `@visx/shape` (`LinkVertical`/`LinkHorizontal`) delega a `d3-shape.linkVertical/linkHorizontal`, gerando o `d` (cubic bezier) a partir de `source/target {x,y}`. `@visx/shape` já traz d3-shape via `@visx/vendor` (não precisa de `d3-shape` avulso).
5. **Pan/zoom híbrido (o ponto-chave)**: `<Zoom>` expõe `zoom.toString()` que retorna **exatamente** `matrix(scaleX, skewY, skewX, scaleY, translateX, translateY)` — um valor **CSS `transform` válido**. Então aplica-se a **mesma** string ao `<g>` do SVG (edges) e ao `<div>` container dos nós HTML. Gotcha único: `transform-origin: 0 0` no div HTML (CSS default é center; SVG é origem 0,0). `<Zoom>` props: `width`, `height`, `scaleXMin/Max`, `constrain`, `initialTransformMatrix`, render-prop `(zoom) => ...`, e `zoom.containerRef` que fia os gestos (`passive:false` p/ wheel). Métodos: `setTransformMatrix`, `applyInverseToPoint`, `center`, `reset`, etc.
6. **Drag de nó p/ reparent**: usar **pointer events manuais** (`onPointerDown/Move/Up` + `setPointerCapture`), não `@visx/drag`. Motivo: precisamos de coordenadas **de mundo** para hit-test contra os bounds dos nós, e `zoom.applyInverseToPoint({x,y})` converte tela→mundo numa chamada (o `@visx/drag` opera em pixels de tela e ainda exigiria dividir `dx/dy` pela escala — conflito conhecido, visx#1684). Pointer manual também evita o gesto de drag "vazar" para o pan do `<Zoom>` (basta `stopPropagation` + capture no nó).
7. **Remover elkjs**: confirmado — flextree/d3-hierarchy são **síncronos** e O(n); para algumas centenas de nós roda em <1ms no main thread. **Sem worker.** Bônus: layout pronto no 1º render ⇒ acaba o "salto" e o fallback duplicado (M7-05 vira trivial).

**Decisão de direção (livre / menor esforço, ver spec)**: layout **vertical (raiz no topo)**, orientação natural do flextree — `nodeSize = [larguraNó, alturaNó]`, profundidade para baixo. Sem custo extra de troca de eixos.

---

## Architecture Overview

O canvas deixa de ser um pacote pronto e passa a ser **3 camadas empilhadas dentro de um `<Zoom>`**, todas compartilhando a mesma matriz de transform:

```
┌─ MapCanvas (state owner: collapsedIds, editingId, deleteTarget, editDialogNodeId) ─┐
│                                                                                     │
│   data.nodes ─▶ buildTree ─▶ visibleNodes(collapsed) ─▶ useTreeLayout (flextree)    │
│                                          │                                          │
│                                          ▼  PositionedNode[] {id,x,y,w,h} + links   │
│   <Zoom width h scaleXMin/Max constrain>  (gesto: @use-gesture via containerRef)    │
│     (zoom) =>                                                                        │
│       <div ref={zoom.containerRef} class="relative">     ◀── wheel/drag = pan/zoom   │
│         ── camada SVG (edges) ──                                                     │
│         <svg><g transform={zoom.toString()}>                                         │
│             {links.map(LinkVertical source→target)}                                 │
│         </g></svg>                                                                   │
│         ── camada HTML (nós) ── transform={zoom.toString()}; origin 0 0             │
│         <div>                                                                        │
│            {positioned.map(p => <MindNode .. style={left:p.x, top:p.y} />)}          │
│         </div>                                                                       │
│       </div>                                                                          │
│                                                                                     │
│   Drag de nó: pointerdown no MindNode → capture → pointermove (zoom.applyInverse    │
│   ToPoint p/ mundo) → hit-test bounds → pointerup → moveNode({parentId}) | snap-back │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Diferença estrutural vs. hoje: **uma única fonte de verdade** (o array `positioned` derivado de `data` + `collapsedIds` + `editingId`). Some o par `useNodesState`/`useEdgesState` e o `useEffect` que forçava `setNodes(rfNodes)` — eliminando a Fragile Area do CONCERNS.md (M7-24).

---

## Code Reuse Analysis

### Componentes/módulos que ficam (inalterados ou quase)

| Item | Local | Como usar |
|---|---|---|
| `buildTree` / `visibleNodes` | `packages/web/src/lib/tree.ts` | **Sem mudança** — pipeline de árvore + filtro de colapsados continua igual |
| `nodeSize.ts` (`NODE_WIDTH`, `NODE_HEIGHT_BASE/_WITH_FOOTER`, `nodeHeight`) | `packages/web/src/lib/` | **Sem mudança** — vira a fonte do `nodeSize` do flextree |
| `MindNode` (visual M5/M6) | `pages/map/components/MindNode.tsx` | Reusar inteiro; **remover só** `Handle`/`Position` e ajustar o posicionamento externo |
| `NodeTaskIndicators`, `StatusSelector`, `task-meta.ts` | `pages/map/components/` | **Sem mudança** |
| `NodeEditDialog` / `NodeEditForm` | `pages/map/components/` | **Sem mudança** (independe do React Flow) |
| `useCreateNode/useUpdateNode/useDeleteNode/useMoveNode` | `packages/web/src/api/nodes.ts` | **Sem mudança** — optimistic/rollback/toast intactos |
| Backend inteiro | `packages/api` | **Sem mudança** |

### O que sai

| Item | Ação |
|---|---|
| `@xyflow/react` | Remover do `package.json` + imports (`MapCanvas`, `MindNode`, CSS) |
| `elkjs` | Remover do `package.json` |
| `layout.worker.ts` | **Deletar** |
| `useLayoutedTree.ts` + `treeLayout.ts` | Substituir por `useTreeLayout.ts` (flextree). `treeLayout.ts` pode ser deletado ou absorvido |
| Sync `rfNodes`↔`useNodesState` em `MapCanvas` | Remover (fonte única) |

### O que entra (deps)

| Pacote | Versão | Tipo |
|---|---|---|
| `@visx/zoom` | `^4.0.0` | dep (pan/zoom; traz `@use-gesture/react`) |
| `@visx/shape` | `^4.0.0` | dep (LinkVertical; traz d3-shape via vendor) |
| `@visx/group` | `^4.0.0` | dep (opcional; `<g transform>`) |
| `d3-flextree` | `^2.1.2` | dep (layout de tamanho variável) |
| `@types/d3-flextree` | `^2.1.4` | devDep |

### Concerns relevantes (`CONCERNS.md`)

- **Fragile: sync `rfNodes`↔`useNodesState`** → **eliminada por design** (fonte única). M7-24.
- **Fragile: input inline uncontrolled (`defaultValue`)** → durante a migração, subir o valor para `useState` controlado no MindNode (M7-25). Como o relayout agora é síncrono e a árvore de componentes muda, é o momento certo de fechar isso.
- **Perf: `simpleTreeLayout` síncrono no caminho crítico** → resolvido: passa a existir **um** layout síncrono (flextree), sem worker + fallback duplicado correndo a cada render.
- **Test infra: e2e contra DB de dev / bug `persistence.spec.ts:136`** → fora de escopo; apenas renomear seletor (não consertar o `.first()`).

---

## Components

### 1. `package.json` (packages/web)

- Remover `@xyflow/react`, `elkjs`. Adicionar os 5 pacotes acima.
- Remover o import de CSS `@xyflow/react/dist/style.css` em `MapCanvas`.

### 2. `useTreeLayout` (novo — substitui `useLayoutedTree` + `treeLayout` + worker)

- **Purpose**: computar posições síncronas de tamanho variável com flextree.
- **Local**: `packages/web/src/lib/useTreeLayout.ts`
- **Interface**:
  ```typescript
  interface PositionedNode { id: string; x: number; y: number; width: number; height: number; }
  interface LayoutResult { positioned: PositionedNode[]; links: LayoutLink[]; bounds: { width: number; height: number; minX: number; minY: number }; }
  function useTreeLayout(nodes: NodeDto[], edges: { parentId: string; childId: string }[]): LayoutResult;
  ```
- **Implementação** (esboço, API verificada):
  ```typescript
  import { flextree } from 'd3-flextree';
  // montar a árvore (reusar buildTree do app, ou hierarchy a partir das edges visíveis)
  const layout = flextree<NodeDto>()
    .nodeSize((n) => [NODE_WIDTH + GAP_X, nodeHeight(n.data) + GAP_Y]) // [breadth, depth] — vertical
    .spacing(() => 0);
  const root = layout.hierarchy(tree);
  layout(root);
  // root.each(n => ...) → PositionedNode { x: n.x, y: n.y, width: NODE_WIDTH, height: nodeHeight(n.data) }
  // links: root.links() → { source:{x,y}, target:{x,y} }
  ```
  - `useMemo` por `[nodes, edges]`. Sem worker, sem estado assíncrono, sem `isLayouting`.
  - `bounds` calculado dos extents (para o fitView).
- **Reuses**: `buildTree`/`visibleNodes` (já dão a árvore visível), `nodeHeight`/`NODE_WIDTH`.
- **Atende**: M7-17, M7-18, M7-05.

### 3. `MapCanvas` (reescrever a camada de render)

- **Local**: `pages/map/components/MapCanvas.tsx`
- **Estrutura nova**:
  - Remove `<ReactFlow>`, `ReactFlowProvider`, `Background`, `useNodesState`, `useEdgesState`, `onNodesChange/onEdgesChange`, `nodeTypes`.
  - Mede `width/height` do container (ex.: `ResizeObserver` ou `@visx/responsive` — avaliar; pode ser um `useRef` + `clientWidth/Height`).
  - Renderiza `<Zoom width height scaleXMin={0.1} scaleXMax={3} constrain={...}>`; dentro, o `div ref={zoom.containerRef}` com as duas camadas (SVG edges + div nós), ambas `transform={zoom.toString()}` (div com `transformOrigin:'0 0'`).
  - **fitView inicial**: `useEffect` (1x quando `bounds` muda de vazio→preenchido) calcula `scale = clamp(min(w/bounds.width, h/bounds.height), 0.1, 3)` e translate centralizador → `zoom.setTransformMatrix(...)`.
  - **Background**: cor lisa do tema (decisão "livre/menor esforço") — uma classe Tailwind no container. Sem `<pattern>`.
  - Mantém o resto do estado e handlers já existentes (`collapsedIds`, `editingId`, `deleteTarget`, `editDialogNodeId`, `handleStartEdit/SubmitEdit/ToggleCollapse/AddChild/Delete/OpenEditDialog`) e os hooks de mutation **sem mudança**.
- **Atende**: M7-01, M7-02, M7-03, M7-04, M7-07, M7-09, M7-10, M7-12, M7-13.

### 4. `MindNode` (ajuste mínimo)

- **Local**: `pages/map/components/MindNode.tsx`
- **Mudanças**:
  - **Remover** `import { Handle, Position }` e os dois `<Handle>` (target left / source right). Sem handles — as edges são desenhadas pela camada SVG a partir das posições.
  - O componente deixa de receber `data` no formato `NodeProps` do React Flow; passa a receber props diretas (ou um objeto `MindNodeData` montado pelo MapCanvas). Manter o shape de callbacks de `types.ts`.
  - Posicionamento: o MapCanvas envolve cada `MindNode` num wrapper `position:absolute; left:p.x; top:p.y; width:NODE_WIDTH`. O MindNode em si mantém o visual (coluna header+rodapé do M6).
  - **Input inline controlado** (fecha Fragile Area): `defaultValue` → `useState` + `value/onChange` (M7-25).
- **Atende**: M7-08, M7-11, M7-19, M7-25.

### 5. `useNodeDrag` (novo — drag-to-reparent por pointer events)

- **Purpose**: arrastar um nó e, no drop, reparentar se cair sobre outro nó.
- **Local**: `pages/map/components/useNodeDrag.ts` (hook) ou inline no MapCanvas.
- **Interface**:
  ```typescript
  function useNodeDrag(args: {
    positioned: PositionedNode[];
    applyInverseToPoint: (p: { x: number; y: number }) => { x: number; y: number }; // do zoom
    onReparent: (childId: string, newParentId: string) => void;
    onInvalidDrop: () => void; // refetch/snap-back
    isRoot: (id: string) => boolean;
  }): { onNodePointerDown: (id: string, e: React.PointerEvent) => void; draggingId: string | null; ghostPos: {x:number;y:number} | null };
  ```
- **Comportamento**:
  - `pointerdown` num nó não-raiz: `setPointerCapture`, `stopPropagation` (não vaza p/ o pan do Zoom), guarda offset.
  - `pointermove`: converte cliente→mundo com `applyInverseToPoint`; atualiza posição "fantasma" do nó arrastado (feedback visual = o próprio nó seguindo o cursor; sem highlight do alvo — fora de escopo).
  - `pointerup`: pega o centro do nó arrastado em coords de mundo, faz hit-test contra os bounds `[x, y, width, height]` dos demais nós; se acha alvo → `onReparent`; senão → `onInvalidDrop`.
  - Distinguir clique de drag por limiar de deslocamento (evita disparar move em clique simples — edge case do spec).
- **Reuses**: `zoom.applyInverseToPoint` (verificado), bounds vindos de `positioned`.
- **Atende**: M7-14, M7-15, M7-16 (anti-ciclo continua no backend).

### 6. Edges (camada SVG)

- Dentro do `<svg><g transform={zoom.toString()}>`: `links.map((l) => <LinkVertical key data={l} />)` do `@visx/shape`, com `stroke` do tema. `LinkVertical` gera o path bezier a partir de `source/target {x,y}` já em coords de layout.
- **Atende**: M7-06.

### 7. Migração de seletores e2e

- Cada wrapper de nó recebe `data-testid="mind-node"` (e, onde útil, `data-node-id={id}` e `data-node-title`).
- Trocar os **40 usos** de `.react-flow__node` em `smoke.spec.ts`, `persistence.spec.ts`, `edit-dialog.spec.ts`, `task-properties.spec.ts` por `[data-testid="mind-node"]`, **preservando a semântica** das asserções (count, visibilidade, `.truncate`, `input`, `getByTitle`).
- `persistence.spec.ts:136` (bug conhecido `.first()`): só renomear o seletor; **não** consertar a fragilidade aqui. Registrar no relatório se o status do teste mudar.
- **Atende**: M7-20, M7-22.

---

## Data Models

Sem novos modelos. Tipos internos de layout:

```typescript
interface PositionedNode { id: string; x: number; y: number; width: number; height: number; }
interface LayoutLink { source: { x: number; y: number }; target: { x: number; y: number }; }
```

`NodeDto` e o schema Prisma: **inalterados** (AD-002 mantida — sem `x/y` persistidos).

---

## Error Handling Strategy

| Cenário | Tratamento | Impacto p/ usuário |
|---|---|---|
| Drop inválido (fora de alvo) | `onInvalidDrop` → refetch/relayout | Nó volta à posição (snap-back), igual a hoje |
| Move criaria ciclo | Backend rejeita (`WITH RECURSIVE`); mutation faz rollback | Nó volta + toast de erro (padrão M4) |
| Falha de mutation (create/update/delete/move) | hooks já fazem rollback + toast (inalterado) | Estado reverte; toast |
| Container com width/height 0 (mount inicial) | Guard: não rodar fitView até ter dimensões | Sem crash; enquadra quando medir |
| Árvore vazia (só raiz) | flextree retorna 1 nó, 0 links; bounds = caixa do nó | Renderiza 1 nó enquadrado |
| `d3-flextree` sem tipos nativos | usar `@types/d3-flextree` | (dev) sem erro de typecheck |

---

## Tech Decisions (não-óbvias)

| Decisão | Escolha | Racional |
|---|---|---|
| Motor de pan/zoom | `@visx/zoom` `<Zoom>` (v4 = `@use-gesture/react`) | React-friendly; `toString()` dá `matrix()` CSS aplicável a SVG **e** HTML. Não precisamos de `d3-zoom` avulso |
| Layout de tamanho variável | `d3-flextree` (não `<Tree>`/`d3.tree()`) | `nodeSize` uniforme não cobre 40 vs 58px; flextree é O(n) e dá `node.x/y` direto |
| Híbrido SVG+HTML | edges em SVG, nós em `<div>` por cima, mesma matriz | Reusa 100% do visual M5/M6; gotcha único é `transform-origin:0 0` no div |
| Drag por pointer events | manual + `applyInverseToPoint`, não `@visx/drag` | Precisamos de coords de mundo p/ hit-test; `@visx/drag` é pixel de tela e conflita com o zoom (visx#1684) |
| Direção vertical | raiz no topo | Orientação natural do flextree; "menor esforço" (spec) |
| Remover worker | layout síncrono | flextree O(n) <1ms p/ centenas de nós; mata o "salto" e o fallback duplicado |
| Fonte única de estado | sem `useNodesState`; render derivado de `positioned` | Elimina a Fragile Area do sync `rfNodes`↔`setNodes` |
| Background liso | classe Tailwind, sem `<pattern>` | "Livre/menor esforço" (spec) |

---

## Rastreio Requisito → Componente

| Req | Onde |
|---|---|
| M7-01,02,03,04,07 | comp. 3 (MapCanvas + Zoom + fitView + bg liso; remove RF) |
| M7-05,17,18 | comp. 2 (useTreeLayout flextree síncrono) |
| M7-06 | comp. 6 (LinkVertical) |
| M7-08,11,19,25 | comp. 4 (MindNode: remove Handle, input controlado) |
| M7-09,10,12,13 | comp. 3 (estado/handlers/mutations preservados) |
| M7-14,15,16 | comp. 5 (useNodeDrag + backend anti-ciclo) |
| M7-20,22 | comp. 7 (seletores e2e) |
| M7-21,23 | comp. 1 (deps) + gates |
| M7-24 | comp. 3 (fonte única) |

---

## Verificações pendentes p/ a fase de Tasks/Execute

- Confirmar import ESM de `d3-flextree` no Vite (named `flextree`) e que `@types/d3-flextree` casa com a versão.
- Medir `width/height` do container: decidir entre `ResizeObserver` manual vs `@visx/responsive` (`ParentSize`). Preferir o que já existir/for mais simples.
- Conferir `constrain` do `<Zoom>` para limitar pan (opcional) sem travar a navegação.
- Validar feel do wheel-zoom do `@use-gesture` (sensibilidade) vs. o que o usuário estava acostumado no React Flow — ajuste fino, não bloqueante.

---

## Skills por área (executor)

- **`mindmap-canvas`** → skill de canvas do projeto (visx+d3): comp. 2, 3, 4, 5, 6 (motor de render, layout, drag, edges).
- **`web-component-creation`** → ajustes em MindNode e wrappers.
- **`web-api-integration`** → confirmar que as mutations seguem ligadas sem mudança de contrato.
