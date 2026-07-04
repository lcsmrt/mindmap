# M17 — Limpeza da base de código — Design

Decisões de projeto para as tarefas com mais de uma saída possível (T1 token, T2 política de
comentários, T5 decomposição do `MapCanvas`). T3/T4 são mecânicas e dispensam design.

---

## D1 — Token para o marcador crítico do nó (M17-02)

**Contexto:** hoje o triângulo crítico do nó usa `var(--color-brand)` (`#c4151f`) no modo
escuro e o hex cravado `#b01818` no modo claro (fundo de usuário claro) — em `MindNode.tsx:54`
(`cardSkin` light) e `NodeEditDialog.tsx:135` (`criticalColor`). Já existe `--color-critical`
(`#b0635a`, salmão) mas com **outra semântica** (badge de críticos da home / `MapCard`), então
**não** dá para reusá-lo sem misturar significados.

**Decisão:** adicionar um token dedicado ao vermelho forte do marcador crítico sobre fundo
claro. Nome proposto: **`--color-critical-strong: #b01818`** no bloco Kaos do `@theme`
(`styles.css`). `cardSkin` light e `NodeEditDialog` passam a referenciar
`var(--color-critical-strong)`; o modo escuro segue com `var(--color-brand)`.

**Alternativa rejeitada:** usar `var(--color-brand)` nos dois modos (dropar o `#b01818`). O
`#b01818` é um vermelho mais escuro escolhido para contraste em fundos **claros** de usuário;
unificar regrediria a leitura nesses nós. Mantemos os dois tons, ambos tokenizados.

**Opcional (M17-03, baixa prioridade):** as sombras/divisórias `rgba(...)` inline
(`MindNode` boxShadow/divider/toolbar shadow; `MapCard` `hover:shadow-[…rgba…]`) podem virar
tokens `--shadow-node`/`--shadow-toolbar`/`--shadow-card-hover` (Tailwind v4 gera `shadow-*`).
As divisórias `rgba(255,255,255,.14)`/`rgba(0,0,0,.1)` são **overlays funcionais** sobre a cor
do usuário (branco-no-escuro / preto-no-claro) — podem permanecer como overlay se a
tokenização ficar artificial. Não bloqueia o milestone.

---

## D2 — Política de limpeza de comentários (M17-01)

Para cada comentário, aplicar **uma** das três ações (nesta ordem de preferência):

1. **Apagar** — se descreve o "o quê" óbvio, é divisória de seção (`// --- Hooks ---`), ou
   comentário JSX de rótulo (`{/* Camada de arestas */}`). Se um rótulo JSX marca um bloco,
   preferir **extrair um componente/variável nomeada** a comentar.
2. **Encurtar para ≤1 linha** — se carrega um *porquê* não-óbvio legítimo (workaround,
   decisão contra-intuitiva) diluído em prosa. Manter só a frase do porquê.
3. **Mover para AD/CONCERNS** — se é racional de decisão arquitetural (ex.: por que o observer
   resiste a StrictMode em `useMeasuredHeights`). Vira uma nota em `STATE.md` (AD) ou
   `CONCERNS.md`; o código fica sem o bloco.

**Nunca** transformar comentário em nome ruim só para "cumprir a regra"; se precisar de
contexto, o certo é renomear/extrair (auto-explicação) — cuidar da "ilusão de fluência"
(`learning-opportunities/PRINCIPLES.md`).

**Alvos priorizados (do relatório de auditoria):**

- **Alto valor:** `useMeasuredHeights.ts:39-95` (blocos de design → AD/CONCERNS + código
  auto-explicativo); campos do `Slot` em `slots.ts:6-24,60-64` (`colX // X (top-left)…` →
  nomes/tipos auto-explicativos, sem comentar cada campo).
- **Médio:** JSDoc "o quê" em `MapCard.tsx:32-35` e `measureContentWidth.ts:5-13`; blocos
  de racional 2-3 linhas em `MapCanvas.tsx` e `useTreeLayout.ts` (encurtar/mover); bloco de
  4 linhas em `api/nodes.ts:207-210`.
- **Baixo:** divisórias `// --- Hooks ---` (`maps.ts:39`) e rótulos JSX (apagar/extrair).
- **Não tocar (já na regra):** `uid.ts:1` (workaround 1 linha); inline curtos de `useNodeDrag.ts`
  ("raiz não é arrastável" etc., 1 linha/porquê); arquivos de dados/lógica excetuados.

---

## D3 — Decomposição do `MapCanvas.tsx` (M17-06)

**Estado atual (526 linhas, 2 componentes):**

- `CanvasLayers` (render-prop do `<Zoom>`): camada de arestas SVG + camada de nós HTML +
  **barra-fantasma** de drop.
- `MapCanvasInner`: `useNodes`, 4 estados locais (collapsed/editing/deleteTarget/editDialog),
  `useIsMutating`, **ResizeObserver do container**, 4 mutations, medição de alturas,
  `buildTree`/`visibleNodes`, `useTreeLayout`, `useNodeDrag`, ~6 handlers.

**Extrações (cada uma um arquivo em `pages/map/components/`, responsabilidade única):**

1. **`GhostBar.tsx`** — componente apresentacional da barra-fantasma de drop. Props: o slot-alvo
   já resolvido (`colX`/`anchorY`/`colWidth`) + flag de visibilidade. Sem estado. Move o markup
   de dentro de `CanvasLayers`.
2. **`useNodeEditing.ts`** — hook que encapsula o estado de edição/diálogo (`editingId`,
   `deleteTarget`, `editDialogNode`) e os handlers que hoje vivem soltos no `MapCanvasInner`
   (`onStartEdit`/`onSubmitEdit`/`onCancelEdit`/`onOpenEditDialog`/…). Retorna estado + handlers.
3. **`useContainerSize.ts`** — hook do `ResizeObserver` do container (dimensões usadas por
   `fitView`/centragem). Isola a medição do container da lógica de árvore.

Após as extrações, `MapCanvasInner` fica como **orquestrador**: compõe os hooks
(`useNodes`/`useMeasuredHeights`/`useContainerSize`/`useTreeLayout`/`useNodeDrag`/`useNodeEditing`),
as 4 mutations e renderiza `CanvasLayers` + `GhostBar` + diálogos. Meta: `MapCanvas.tsx` < ~300 linhas.

**⚠️ Restrição crítica de risco:** existe um **bug aberto de trepidação da árvore durante o
resize** (CONCERNS → Known Bugs), cuja causa ainda é desconhecida e que envolve o caminho
`onPointerMove`→layout→render. **A decomposição NÃO pode alterar o timing/ordem desse caminho**
(gesto de resize/drag, `activeResize`, medição de altura, `useNodeDrag`). Regras para T5:

- **Não tocar** `useNodeDrag.ts`, `useMeasuredHeights.ts`, `useTreeLayout.ts`, `slots.ts`,
  `nodeSize.ts` nem os handlers de resize/`activeResize`. A extração é só de
  edição/diálogo/medição-de-container/ghost — partes **ortogonais** ao gesto.
- Extração é **movimento mecânico** (recortar/colar + fiar props), sem "melhorar" a lógica
  movida (coding-principles: mudança cirúrgica).
- Se qualquer extração exigir mexer no caminho do gesto, **parar e adiar** essa parte —
  decompor o resto e deixar o gesto intocado. Melhor um `MapCanvas` um pouco maior do que
  arriscar o bug aberto.

**Alternativa considerada:** adiar T5 inteiro até o bug de trepidação fechar. Rejeitada
porque as extrações escolhidas (edição/ghost/container) são ortogonais ao gesto e reduzem o
arquivo com risco baixo; mas a restrição acima é inegociável. **Decisão de execução:** se na
prática as fronteiras não forem tão limpas quanto o esperado, o executor pode entregar só as
extrações seguras e registrar o resto como dívida.

---

## Test / Gate posture

Refactor puro, sem lógica nova → segue a matriz de milestones anteriores (AD-007/AD-014):

| Camada | Tipo | Observação |
| --- | --- | --- |
| Remoção de comentário (T2) | none | não muda comportamento; gate = typecheck/lint/build |
| Token de cor (T1) | none (visual/CSS) | grep-guard de hex + smoke |
| Mover módulo puro + testes (T3) | **testes existentes acompanham o arquivo** | unit tem de continuar verde no novo caminho |
| Dedup / extração de componente (T4/T5) | none (UI, AD-007) | rede = e2e sem regressão + smoke |
| Verificação (T6) | e2e + smoke | contagens = baseline |

Não é deferral de teste: não há **lógica pura nova** (só relocação e recorte). Os unit de
`tree`/`slots`/`useTreeLayout` movidos em T3 devem rodar verdes no novo local (mesma
contagem). A rede de segurança é: unit/e2e **sem regressão** + grep-guard + **smoke visual**.
</content>
