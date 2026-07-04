# M17 — Limpeza da base de código: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Draft

---

## Contexto para o Executor

Auto-suficiente para um agente sem memória do planejamento. Ler primeiro, nesta ordem:

- `CLAUDE.md` (raiz) — pt-BR em conversa/commits/docs; código/identificadores em **inglês**;
  commits `tipo(escopo): descrição` (escopo = `m17`); **não escrever comentários** (exceto o
  *porquê* não-óbvio, ≤1 linha); auto-explicativo, early return, reusar antes de criar; racional
  de decisão vai pras **ADs** (`STATE.md`), não pro código.
- `.claude/rules/frontend-structure.md` — componente/módulo de página em `pages/<pagina>/`;
  só o compartilhado por 2+ páginas em `components/`/`lib/`; **nunca** modificar `components/ui/`
  (shadcn/base-ui, código de terceiros).
- **[[feedback-no-inline-hex]]** — proibido hex de cor em `.tsx` (className e `style`); usar token
  ou utilitário. Exceção: cor de **dados do usuário** e módulos de dados/lógica
  (`color-palette.ts`, `contrast.ts`, `task-meta.ts`).
- **[[feedback-scope-discipline]]** — este milestone é **refactor puro**: zero mudança de
  comportamento/contrato/schema/visual. Mudança cirúrgica: não "melhorar" o que não está no
  escopo; casar o estilo existente.
- `.specs/features/m17-codebase-cleanup/{spec,design}.md` — requisitos `M17-NN`, decisão do token
  crítico (D1), política de comentários (D2), plano de decomposição do `MapCanvas` (D3 + **restrição
  de risco do bug aberto de trepidação**).
- `.specs/codebase/CONCERNS.md` — para onde vai o racional removido de comentários (T2) e o
  **Known Bug de trepidação no resize** (T5 não pode perturbá-lo).

**Escopo (o que este milestone NÃO é):** sem mudança de comportamento, contrato, schema,
migration, cor, tipografia, layout ou raio (a calibração de cor e o raio uniforme **já foram
feitos** na sessão de origem — ver T0). Sem tocar primitivos `ui/`. **Não** resolver o bug de
trepidação (só **não** perturbá-lo em T5). **Preservar todos os `data-testid`** e textos usados
por seletores e2e (checar `packages/web/e2e/` antes de qualquer relocação/extração).

**T0 — baseline desta sessão (já feito, comitar antes de iniciar):** migração das tags puras
(`<button>`/`<input>` → `Button`/`Input`) na Home e no canvas
(`HomePage`/`StatusSelector`/`ColorSwatchGrid`/`NodeEditDialog`), calibração de cores para
neutro no `styles.css`, e raio uniforme (`rounded-md`) no `MindNode`. typecheck+lint verdes.
Comitar como ponto de partida do M17 (ex.: `refactor(m17): T0 migra tags puras, calibra cores e uniformiza raio`)
ou confirmar que já está no HEAD. **A categoria "tags HTML puras" da auditoria está zerada por T0.**

**Baseline de testes (capturar no início):** unit **web 118 / api 61**, **e2e 37/37**. Refactor
**não deve alterar** essas contagens (nenhum teste novo, nenhum removido; os unit de
`tree`/`slots`/`useTreeLayout` **movem de pasta** em T3 mas continuam verdes).

**Postura de testes:** refactor sem lógica nova → `Tests: none` nas tasks de código, rede =
unit/e2e **sem regressão** + grep-guard + **smoke visual** (concentrados em T6). Ver `design.md` §
Test/Gate posture. Não é deferral.

**Comandos de gate:**

- **quick (web):** `cd packages/web && pnpm typecheck && pnpm test`
- **full:** `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`
- **grep-guard (hex nas telas):**
  `grep -rnE '#[0-9a-fA-F]{3,6}' packages/web/src/pages packages/web/src/components --include=*.tsx | grep -vE 'color-palette|contrast|task-meta'` → só deve sobrar cor de **dados do usuário** via `style` (nenhum literal de tema).
- ℹ️ **Ambiente:** uma só `.env` → banco **dev** (prod só no servidor, AD-022). Playwright roda
  contra o dev; rodar `test:e2e` à vontade.

**Skills aplicáveis:** `web-component-creation` (T4/T5), `mindmap-canvas` (T5 — canvas). Sem MCPs.

---

## Execution Plan

```
Phase 1 (cores + comentários — arquivos compartilhados, sequencial):
  T1 (tokens de cor) ──→ T2 (limpeza de comentários)

Phase 2 (colocação — [P] com a Phase 1; arquivos majoritariamente disjuntos):
  T3 (mover libs do canvas + EmptyState)

Phase 3 (dedup + decomposição):
  T2 ──→ T4 (dedup: reusar NodeTaskIndicators)     [toca NodeEditDialog, tocado em T1/T2]
  T3 ──→ T5 (decompor MapCanvas)                    [precisa dos imports já recolocados]

Phase 4 (verificação, sequencial):
  T1,T2,T3,T4,T5 ──→ T6 (gates full + grep-guard + smoke visual)
```

T1→T2 sequencial (ambos tocam `MindNode.tsx`/`NodeEditDialog.tsx`). T3 é `[P]` com a Phase 1
(mexe em `lib/` + imports + `HomePage`/`EmptyState`, disjunto de T1/T2). T4 depende de T2
(NodeEditDialog estabilizado); T5 depende de T3 (imports de `pages/map` já corretos). T6 fecha.

---

## Task Breakdown

### T1: tokenizar o hex crítico (+ opcional: sombras rgba)

**What:** (a) Adicionar `--color-critical-strong: #b01818` ao bloco Kaos do `@theme`
(`styles.css`) — ver D1. (b) Trocar `#b01818` por `var(--color-critical-strong)` em
`MindNode.tsx` (`cardSkin` light) e `NodeEditDialog.tsx` (`criticalColor`). (c) **Opcional/baixa
(M17-03):** tokenizar sombras `rgba()` de `MindNode`/`MapCard` como `--shadow-*` se ficar
natural; overlays de divisória podem permanecer. Nenhuma mudança de valor visual — só a fonte.
**Where:** `packages/web/src/styles.css`, `pages/map/components/{MindNode,NodeEditDialog}.tsx`
(+ `pages/home/components/MapCard.tsx` se fizer o opcional)
**Depends on:** None
**Reuses:** `@theme` existente; `var(--color-brand)` (modo escuro já tokenizado).
**Requirement:** M17-02, M17-03

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] `--color-critical-strong` no `@theme`; `#b01818` some de `MindNode`/`NodeEditDialog`.
- [ ] Marcador crítico idêntico ao atual em fundo claro e escuro (sem diferença visual).
- [ ] Gate quick (web) passa (baseline 118 mantido).

**Tests:** none (visual/CSS) · **Gate:** quick (web)

**Verify:** abrir um nó crítico com fundo claro e outro escuro → triângulo com a mesma cor de
antes; `grep '#b01818' packages/web/src` → vazio.

**Commit:** `refactor(m17): T1 tokeniza cor do marcador crítico do nó`

---

### T2: limpeza de comentários (regra ≤1 linha; racional → AD)

**What:** Aplicar a política D2 (apagar / encurtar ≤1 linha / mover pra AD). Alvos priorizados:
`useMeasuredHeights.ts` (blocos de design → CONCERNS/AD); campos do `Slot` em `slots.ts`
(auto-explicativos, sem comentar campo a campo); JSDoc "o quê" de `MapCard.tsx`/
`measureContentWidth.ts`; blocos de racional em `MapCanvas.tsx`/`useTreeLayout.ts`/`api/nodes.ts`;
divisórias (`maps.ts:39`) e rótulos JSX (apagar/extrair). **Preservar** os já-na-regra (`uid.ts`,
inline 1-linha de `useNodeDrag.ts`) e os arquivos de dados/lógica excetuados. Onde um racional
arquitetural for removido, **registrar** em `STATE.md` (AD) ou `CONCERNS.md`.
**Where:** vários `.ts/.tsx` de `packages/*/src` (lista no `design.md` D2); `STATE.md`/`CONCERNS.md`
para o racional realocado.
**Depends on:** None (mas rodar **depois** de T1 por tocar `MindNode`/`NodeEditDialog`)
**Reuses:** —
**Requirement:** M17-01

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] Nenhum comentário "o quê" ou bloco multi-linha de racional nos arquivos-alvo.
- [ ] Comentários remanescentes são *porquê* ≤1 linha (ou hot-path denso declarado).
- [ ] Racional arquitetural removido foi para AD/CONCERNS (não descartado).
- [ ] Gate quick (web) + `pnpm lint` (root) passam; nenhuma mudança de comportamento.

**Tests:** none · **Gate:** quick (web) + lint

**Verify:** revisar `git diff` — só remoção/encurtamento de comentário e renome/extração pontual;
zero mudança de lógica. Gates verdes.

**Commit:** `refactor(m17): T2 remove comentários fora da regra; racional pra AD`

---

### T3: recolocação — módulos do canvas + EmptyState [P]

**What:** (a) Mover `lib/{tree,useTreeLayout,slots,nodeSize}.ts` **e** os testes co-localizados
`lib/{tree,slots,useTreeLayout}.test.ts` para a página do mapa (sugestão: `pages/map/lib/` para
manter os `*.test.ts` juntos do fonte). Atualizar os imports em `MapCanvas.tsx`,
`useNodeDrag.ts`, `measureContentWidth.ts` e os cruzados entre os quatro. `lib/` fica só com
`mergeClasses.ts` + `uid.ts` (compartilhados reais — **não** mover). (b) Extrair `EmptyState`
(e, se quiser, `SearchIcon`) de `HomePage.tsx` para `pages/home/components/EmptyState.tsx`.
**Movimento mecânico**, sem mudar lógica.
**Where:** `packages/web/src/lib/` → `packages/web/src/pages/map/lib/`; `pages/home/HomePage.tsx`
→ `pages/home/components/EmptyState.tsx`; imports nos consumidores.
**Depends on:** None (disjunto de T1/T2/T4; **antes** de T5)
**Reuses:** os próprios módulos e testes (só mudam de caminho).
**Requirement:** M17-04

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] `packages/web/src/lib/` contém só `mergeClasses.ts` e `uid.ts`.
- [ ] `tree/useTreeLayout/slots/nodeSize` + seus testes em `pages/map/lib/`; imports atualizados.
- [ ] `EmptyState` em `pages/home/components/`; `HomePage` importa de lá.
- [ ] Gate quick (web) passa; **mesmas contagens** de unit (só mudou o caminho dos testes).

**Tests:** testes existentes acompanham o arquivo (mesma contagem, novo caminho) · **Gate:** quick (web)

**Verify:** `pnpm test` verde com a mesma contagem; `grep -rn "@/lib/\(tree\|slots\|useTreeLayout\|nodeSize\)" packages/web/src` → vazio.

**Commit:** `refactor(m17): T3 recoloca módulos do canvas e EmptyState nas páginas`

---

### T4: dedup — preview do NodeEditDialog reusa NodeTaskIndicators

**What:** Trocar o markup duplicado de "pill de status + avatar de responsável" no preview ao
vivo do `NodeEditDialog.tsx` pela reutilização de `NodeTaskIndicators`. Se as variações de
tamanho do chip de iniciais atrapalharem, extrair um `AssigneeBadge` pequeno reusado nos dois
lugares (opcional). Sem mudança visual do preview.
**Where:** `pages/map/components/NodeEditDialog.tsx` (+ `NodeTaskIndicators.tsx` se precisar de
prop de tamanho; eventual `AssigneeBadge.tsx`)
**Depends on:** T2 (NodeEditDialog já estabilizado)
**Reuses:** `NodeTaskIndicators` existente; `task-meta`/lógica intactos.
**Requirement:** M17-05

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**

- [ ] Preview do `NodeEditDialog` renderiza status/responsável via `NodeTaskIndicators` (sem markup duplicado).
- [ ] Preview visualmente idêntico ao atual; `data-testid` preservados.
- [ ] Gate quick (web) passa.

**Tests:** none (UI, AD-007) · **Gate:** quick (web)

**Verify:** abrir o modal num nó com status+responsável → preview igual ao de antes;
`grep` do markup de avatar duplicado some.

**Commit:** `refactor(m17): T4 reusa NodeTaskIndicators no preview do editor`

---

### T5: decompor MapCanvas.tsx (ghost bar + hooks) — cuidado com o bug aberto

**What:** Extrair de `MapCanvas.tsx`, conforme D3: (1) `GhostBar.tsx` (barra-fantasma
apresentacional); (2) `useNodeEditing.ts` (estado de edição/diálogo + handlers); (3)
`useContainerSize.ts` (ResizeObserver do container). `MapCanvasInner` vira orquestrador
(<~300 linhas). **RESTRIÇÃO CRÍTICA (D3):** **não tocar** `useNodeDrag`/`useMeasuredHeights`/
`useTreeLayout`/`slots`/`nodeSize` nem o caminho do gesto de resize/drag/`activeResize` — há um
**bug aberto de trepidação** (CONCERNS → Known Bugs) sensível a esse caminho. Extração é recorte
mecânico + fiação de props, sem "melhorar" a lógica movida. Se uma fronteira exigir mexer no
gesto, **entregar só as extrações seguras** e registrar o resto como dívida.
**Where:** `pages/map/components/MapCanvas.tsx` (+ novos `GhostBar.tsx`, `useNodeEditing.ts`,
`useContainerSize.ts` em `pages/map/components/`)
**Depends on:** T3 (imports de `pages/map/lib` já corretos)
**Reuses:** o próprio código recortado; `useTreeLayout`/`useNodeDrag`/`useMeasuredHeights` **como estão** (só consumidos).
**Requirement:** M17-06

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] `GhostBar`, `useNodeEditing`, `useContainerSize` extraídos; `MapCanvas.tsx` < ~300 linhas.
- [ ] Caminho do gesto de resize/drag/`activeResize` **inalterado** (git diff não toca esses handlers/hooks).
- [ ] `data-testid` (`mind-node`, `node-title`, `resize-handle`, `ghost-slot`) preservados;
      drag-to-place, resize, collapse e edição inline funcionando como antes.
- [ ] Gate quick (web) passa; e2e do canvas verdes (rodar em T6).

**Tests:** none (UI, AD-007) · **Gate:** quick (web) + e2e do canvas antes de fechar

**Verify:** `pnpm dev` num mapa → arrastar/redimensionar/colapsar/editar idênticos; a trepidação
do resize **não deve piorar nem melhorar** (comportamento do bug aberto igual ao de antes de T5).

**Commit:** `refactor(m17): T5 decompõe MapCanvas (ghost bar + hooks de edição/medição)`

---

### T6: verificação — gates full, grep-guard e smoke

**What:** Validar o conjunto. (a) **grep-guard de hex** (comando acima) sem literal de tema.
(b) **Gates full** verdes sem regressão: `pnpm typecheck && pnpm lint && pnpm test` (root) +
`cd packages/web && pnpm test:e2e`; contagens = baseline (web 118 / api 61 / e2e 37/37).
(c) **`git diff` de sanidade**: só refactor — nenhuma mudança de comportamento/contrato/schema/
visual; caminho do gesto de resize intocado (D3). (d) **Smoke visual** das telas afetadas
(home/empty state, canvas/nó/toolbar, modal editar) confirmando **zero** diferença visual.
Commit só se um gate exigir ajuste pontual.
**Where:** `packages/web/e2e/` só se um seletor exigir ajuste; caso contrário sem código novo.
**Depends on:** T1, T2, T3, T4, T5
**Reuses:** suíte existente.
**Requirement:** M17-07

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] grep-guard de hex → só cor de dados do usuário via `style` (nenhum literal de tema).
- [ ] Gate full verde; unit web/api e e2e **iguais ao baseline** (sem deleção/skip silencioso).
- [ ] `git diff` confere refactor puro (sem comportamento/visual); gesto de resize intocado.
- [ ] Smoke visual das telas afetadas sem diferença perceptível.

**Tests:** e2e + smoke · **Gate:** full

**Verify:** rodar os gates + grep; abrir as telas e comparar com o estado pré-M17.

**Commit:** sem commit se passar limpo; ajuste pontual → `fix(m17): T6 <descrição>`.

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | tokenizar 1 cor (+ opcional sombras) | ✅ Granular |
| T2 | limpeza de comentários (1 categoria) | ✅ Granular |
| T3 | recolocação de arquivos (1 categoria) | ✅ Granular |
| T4 | 1 dedup (reuso de componente) | ✅ Granular |
| T5 | decompor 1 arquivo (extrações ortogonais) | ✅ Granular |
| T6 | verificação (grep+gates+smoke) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 (início) | ✅ Match |
| T2 | None (após T1) | T1 → T2 | ✅ Match |
| T3 | None | Phase 2 [P] | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T3 | T3 → T5 | ✅ Match |
| T6 | T1,T2,T3,T4,T5 | → T6 | ✅ Match |

---

## Notas pós-execução (para o chat de execução/review)

- Atualizar `ROADMAP.md` (novo **M17 — Limpeza da base de código**) e `STATE.md` (Current Work +
  qualquer AD nova de racional migrado de comentário em T2).
- **Review AD-013** em chat separado antes de marcar "concluído" ([[feedback-plan-execute-split]]);
  smoke visual confirmado pelo usuário (AD-014).
- Marcar no `CONCERNS.md` os itens de organização endereçados (arquivos grandes/coesão,
  colocação, duplicação) como resolvidos, referenciando os commits do M17.
- O **bug de trepidação no resize** segue **aberto** (não é escopo do M17); confirmar que T5 não
  o alterou.
</content>
