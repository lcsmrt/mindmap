# M16 — Rebrand Kaos: Tasks

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Status:** Draft

---

## Contexto para o Executor

Auto-suficiente para um agente sem memória do planejamento. Ler primeiro, nesta ordem:

- `CLAUDE.md` (raiz) — idioma (pt-BR em conversa/commits/docs; código/identificadores em **inglês**),
  commits `tipo(escopo): descrição` (escopo = `m16`), **não escrever comentários** (exceto o *porquê*
  não-óbvio, ≤1 linha). **Estilo:** auto-explicativo, early return, reusar antes de criar.
- `.claude/rules/frontend-structure.md` — componentes de página em `pages/<pagina>/components/`;
  compartilhado (2+ páginas) em `components/`; reusar primitivos `ui/`.
- **[[feedback-no-inline-hex]] (regra central deste milestone):** proibido arbitrary value de cor em
  `.tsx` (`bg-[#…]`, `text-[#…]`, `border-[#…]`, `stroke-[#…]`, gradiente com `#…`). Sempre **token**
  (semântico shadcn ou token Kaos do `@theme`) ou utilitário padrão do Tailwind. Exceção: cor de
  **dados do usuário** (`bgColor`/`textColor` do nó via `style={{}}`) e módulos de **dados/lógica**
  (`color-palette.ts`, defaults do `contrast.ts`).
- `.specs/features/m16-kaos-rebrand/{spec,design}.md` — requisitos `M16-NN`, token set A+B, mapa
  arquivo-a-arquivo, guardas de não-regressão.
- Guia visual: `Mindmaps system interface(2)/` — `Meus Mapas.dc.html`, `Estudo de Nos.dc.html`,
  `kaos-sigil.svg`, `screenshots/`. É a **fonte da verdade** do visual.

**Escopo (o que este milestone NÃO é):** sem backend/contrato/schema; sem campo Notas; editor
continua modal (não painel); sem rename interno (`@mindmap`/dirs/DB/repo); sem thumbnail no card;
sem tocar `useTreeLayout.ts`/`slots.ts`/`useNodeDrag.ts`/resize/`nodeSize.ts`. **Preservar todos os
`data-testid`** e textos visíveis usados por seletores e2e (verificar `packages/web/e2e/` antes de
mudar qualquer label).

**Postura de testes (AD-007 + AD-014 — não há `TESTING.md`; reskin = camada visual):**

| Camada | Tipo requerido | Gate | Parallel-safe |
| --- | --- | --- | --- |
| Tokens/CSS/fontes/asset (`styles.css`, `index.html`, `package.json`, `public/`) | none (visual) → typecheck/build + smoke | quick web | — |
| Componente apresentacional novo (`BrandMark`) | none (sem lógica, AD-007) → smoke/e2e | quick web | Yes |
| Migração `className`→token nas telas | none (visual/CSS) → **e2e sem regressão + smoke** | quick web | Yes |
| Primitivo compartilhado (`ui/dialog` overlay) | none → e2e sem regressão + smoke | quick web | Yes |
| Verificação final (grep-guard + gates + smoke) | e2e + smoke visual | full | No |

> Nenhuma task adiciona unit novo: não há lógica pura nova (BrandMark é apresentacional; a troca é
> CSS/token). A matriz diz **none** para camadas visuais → `Tests: none` é válido (não é deferral).
> A rede de segurança é: (a) unit/e2e existentes **sem regressão**, (b) **grep-guard**, (c) **smoke
> visual obrigatório** (gate AD-014/L-005) contra os screenshots do guia.

**Comandos de gate:**

- **quick (web):** `cd packages/web && pnpm typecheck && pnpm test`
- **full:** `pnpm typecheck && pnpm lint && pnpm test` (root) + `cd packages/web && pnpm test:e2e`
- **grep-guard:** `grep -rnE '(bg|text|border|ring|stroke|fill|from|to|via|shadow|outline|decoration)-\[#' packages/web/src` → **vazio**
- **fontes locais:** DevTools Network sem requisição a `fonts.googleapis.com`/`gstatic`.
- ℹ️ **Ambiente:** há **uma só** `.env` → banco **dev** (prod só no servidor, AD-022). Playwright roda
  contra o dev; sem risco de prod. Rodar `test:e2e` à vontade.

**Baseline de testes (capturar no início; referência pós-M15 + quick-wins):** unit **web 118 / api 61**,
**e2e 37/37**. Reskin **não deve alterar** essas contagens (nenhum teste novo, nenhum removido). Se um
e2e virar vermelho, provável quebra de seletor por label/testid alterado → corrigir o reskin, não o teste.

**Skills aplicáveis:** `web-component-creation` (T2 BrandMark, T3/T4/T6 componentes), `mindmap-canvas`
(T5 — canvas/MindNode/edges/toolbar). **Sem MCPs.** Verificar Tailwind v4 `@theme`/`@fontsource` via
Context7/docs se houver dúvida (não assumir sintaxe de token/import).

---

## Execution Plan

```
Phase 1 (fundação, sequencial):
  T1 (tokens + fontes + asset + .canvas-grid + keyframes) ──→ T2 (BrandMark)

Phase 2 (primitivo):
  T1 ──→ T3 (ui/dialog overlay + varredura de primitivos)

Phase 3 (telas — [P], arquivos disjuntos):
        ┌─(T1,T2)─→ T4 [P]  (Home: HomePage/MapCard/MapCardMenu/CreateMapModal/RenameMapInput)
  T1 ───┼─(T1)────→ T5 [P]  (Canvas: MapCanvas + MindNode + NodeTaskIndicators)
        └─(T1,T3)─→ T6 [P]  (Modal editar: NodeEditDialog)

Phase 4 (verificação, sequencial):
  T4,T5,T6 ──→ T7 (grep-guard + gates full + smoke visual das 4 telas)
```

T4/T5/T6 tocam arquivos disjuntos, dependem de fundação já pronta (T1/T2/T3 em fases anteriores) e não
dependem entre si → `[P]`. Gate quick web é vitest (parallel-safe). T7 valida o conjunto.

---

## Task Breakdown

### T1: fundação do design system — tokens Kaos, fontes, asset, grid, motion

**What:** Reescrever a base visual. (a) `styles.css`: substituir os valores dos 19 tokens semânticos
(grupo A do design) e **adicionar** os tokens Kaos próprios (grupo B) no `@theme`; apontar
`--font-sans`→Space Grotesk, `--font-heading`→Chakra Petch, `--font-mono`→IBM Plex Mono; trocar
`@import "@fontsource-variable/geist"` pelos imports das 3 fontes; adicionar a classe utilitária
`.canvas-grid` (fundo `var(--color-canvas)` + dot-grid via `var(--color-canvas-dot)` 24×24) e as
keyframes `sprout`/`edgeIn` guardadas por `@media (prefers-reduced-motion: reduce)`. (b) `index.html`:
remover o `<link>` Google Fonts remoto; `<title>`→"Kaos". (c) `package.json`: `+@fontsource/chakra-petch`,
`+@fontsource-variable/space-grotesk`, `+@fontsource/ibm-plex-mono`, `−@fontsource-variable/geist`;
`pnpm install`. (d) `public/kaos-sigil.svg`: copiar o asset do guia.
**Where:** `packages/web/src/styles.css`, `packages/web/index.html`, `packages/web/package.json`,
`packages/web/public/kaos-sigil.svg` (novo)
**Depends on:** None
**Reuses:** estrutura atual do `@theme`/`@import` do `styles.css`; asset `Mindmaps system interface(2)/kaos-sigil.svg`.
**Requirement:** M16-02, M16-03, M16-09 (`.canvas-grid`), M16-13/M16-18 (keyframes)

**Tools:** MCP: NONE · Skill: `web-component-creation` (verificar `@theme`/`@fontsource` no Tailwind v4 via Context7 se preciso)

**Done when:**

- [ ] Tokens A (remapeados) + B (novos) presentes no `@theme`; `--font-*` apontando para as 3 fontes.
- [ ] Imports `@fontsource*` no `styles.css`; Geist removido do `styles.css` e do `package.json`; `pnpm install` ok.
- [ ] `index.html` sem `<link>` remoto; `<title>` = "Kaos". `public/kaos-sigil.svg` existe.
- [ ] `.canvas-grid`, keyframes `sprout`/`edgeIn` + guard `prefers-reduced-motion` no `styles.css`.
- [ ] App builda e sobe; nenhuma cor "sumiu" (primitivos `ui/` já herdam os tokens novos → botões vermelhos, superfícies quentes).
- [ ] Gate quick (web) passa: `cd packages/web && pnpm typecheck && pnpm test` (baseline web 118 mantido).

**Tests:** none (visual) · **Gate:** quick (web)

**Verify:** `cd packages/web && pnpm dev`; a home carrega com botão "Novo mapa" vermelho, fundo quente e
fontes locais (Network sem googleapis). `pnpm test` verde (contagem = baseline).

**Commit:** `feat(m16): T1 base do design system Kaos (tokens, fontes, sigilo, grid, motion)`

---

### T2: componente `BrandMark` (sigilo Kaos reutilizável)

**What:** Criar `BrandMark` apresentacional: renderiza o sigilo Kaos via CSS mask
(`mask-image: url(/kaos-sigil.svg)` + `background-color`), tingível e com glow opcional. Props:
`size?` (px), `color?` (default token de marca), `glow?`, `className?`. Sem lógica; sem estado.
**Where:** `packages/web/src/components/BrandMark.tsx` (novo)
**Depends on:** T1 (asset em `public/` + token de marca)
**Reuses:** `cn` (`lib/mergeClasses`); padrão de componente apresentacional do projeto.
**Requirement:** M16-01, M16-07

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**

- [ ] `BrandMark` exporta e renderiza o sigilo via mask; cor default = token de marca (sem hex cravado).
- [ ] Aceita `size`/`color`/`glow`/`className`; usa tokens/utilitários (sem arbitrary value de cor).
- [ ] Gate quick (web) passa: `cd packages/web && pnpm typecheck && pnpm test`.

**Tests:** none (apresentacional, AD-007) · **Gate:** quick (web)

**Verify:** importar em `App`/home temporariamente e ver o sigilo vermelho renderizar; `grep 'bg-\[#'`
no arquivo → vazio.

**Commit:** `feat(m16): T2 componente BrandMark (sigilo Kaos)`

---

### T3: reskin do primitivo `ui/dialog` + varredura de primitivos

**What:** Escurecer o overlay do `DialogOverlay` para o tom do guia (`bg-black/50`+blur, alinhado a
`rgba(6,4,4,.66)`) via utilitário padrão (sem hex cravado) — afeta todos os modais por consistência.
Varrer os demais primitivos `ui/` (`button`, `input`, `menu`, `toast`, `toaster`) e confirmar que só
usam tokens (herdam T1); ajustar qualquer arbitrary value remanescente.
**Where:** `packages/web/src/components/ui/dialog.tsx` (+ varredura de `ui/*`)
**Depends on:** T1
**Reuses:** primitivos base-ui/shadcn existentes; tokens de T1.
**Requirement:** M16-08, M16-14

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**

- [ ] Overlay do Dialog mais escuro + blur, via utilitário padrão (sem `#hex`).
- [ ] `grep '(bg|text|border|ring)-\[#' components/ui/` → vazio.
- [ ] ConfirmDialog / CreateMapModal / NodeEditDialog abrem com overlay novo (herdado).
- [ ] Gate quick (web) passa.

**Tests:** none (visual) · **Gate:** quick (web)

**Verify:** abrir o modal "Novo mapa" e o "Excluir" → overlay escuro Kaos; sem regressão de foco/close.

**Commit:** `refactor(m16): T3 overlay do Dialog no tom Kaos + tokens nos primitivos`

---

### T4: reskin da Home (Meus Mapas) → tokens [P]

**What:** Migrar todos os arbitrary values de cor da Home para tokens/utilitários e aplicar o visual
do guia. `HomePage.tsx`: shell com gradiente via tokens (`--color-background-glow`→`--color-background`);
header com `<BrandMark>` + "KAOS" (`font-heading`, tracking largo) + tag "mapas mentais" (`font-mono`,
divisória); título (`font-heading`) + contador (`font-mono text-fg-subtle`); botão "Novo mapa"
(`bg-primary hover:bg-primary-hover`); busca/sort com `border-border`/`bg-card` e sort ativo em
`primary`; `EmptyState` com watermark do sigilo (`<BrandMark>` grande, baixa opacidade). `MapCard.tsx`:
`bg-card border-border`, hover `border-border-hover`+translateY+sombra; métricas/rodapé
`font-mono text-muted-foreground`/`text-fg-subtle`, divisória `border-divider`; badge de críticos
`bg-primary/10 text-critical-foreground` + dot `bg-critical`. `MapCardMenu.tsx`: 5 arbitrary values →
tokens. `CreateMapModal.tsx`/`RenameMapInput.tsx`: confirmar tokens (herdam T3). Ajustar cópia do guia
(ex.: "Despejar o primeiro mapa") **sem** quebrar seletores e2e (checar `e2e/`).
**Where:** `pages/home/HomePage.tsx`, `pages/home/components/{MapCard,MapCardMenu,CreateMapModal,RenameMapInput}.tsx`
**Depends on:** T1, T2
**Reuses:** `BrandMark` (T2); `filterAndSortMaps`/estrutura da Home intacta; primitivos.
**Requirement:** M16-01, M16-04, M16-05, M16-06, M16-07, M16-08

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**

- [ ] Zero arbitrary value de cor em `pages/home/**` (grep vazio nesse escopo).
- [ ] Header com sigilo + "KAOS" + tag; grid/cards/rodapé no visual Kaos; empty state com watermark; modal Kaos.
- [ ] Todos os `data-testid` da Home preservados (`map-card`, `new-map-button`, `map-search`, `map-sort`); busca/sort/criar/renomear/excluir funcionando.
- [ ] Gate quick (web) passa; e2e da Home ainda verdes (rodar no T7, mas não quebrar seletores agora).

**Tests:** none (visual) · **Gate:** quick (web)

**Verify:** `pnpm dev` → home fiel ao screenshot `Meus Mapas`; `grep '(bg|text|border|ring)-\[#' pages/home` → vazio.

**Commit:** `refactor(m16): T4 reskin da Home em tokens Kaos`

---

### T5: reskin do Canvas + MindNode → tokens [P]

**What:** `MapCanvas.tsx`: container do canvas usa `className="canvas-grid"` (de T1); edges com
`stroke-edge`/`stroke-edge-muted` (tokens frios); trocar `bg-muted/30` remanescente; barra-fantasma
segue `bg-primary`. `MindNode.tsx`: migrar `cardSkin` (valores fixos da variante dark) e `DEFAULT_BG`
para `var(--color-node-*)`/tokens; raiz neutra (`node-root`/`node-root-border`); toolbar de hover
(`node-toolbar`/`node-toolbar-border`/`node-toolbar-hover`); cantos por papel via `rounded-md`/`rounded-sm`
(`isRoot`/`hasChildren`, **sem tocar layout**); animação `sprout` no mount do card (keyed por id, só no
mount). `NodeTaskIndicators.tsx`: trocar os 2 arbitrary values (avatar) por token/overlay. **Não tocar**
`useTreeLayout`/`slots.ts`/`useNodeDrag`/handlers de resize/`nodeSize`.
**Where:** `pages/map/components/{MapCanvas,MindNode,NodeTaskIndicators}.tsx`
**Depends on:** T1
**Reuses:** `.canvas-grid`/keyframes (T1); `cardSkin()`/toolbar/`isDarkBg`/`autoTextColor` existentes; `NodeTaskIndicators`/`task-meta` intactos na lógica.
**Requirement:** M16-09, M16-10, M16-11, M16-12, M16-13

**Tools:** MCP: NONE · Skill: `mindmap-canvas`

**Done when:**

- [ ] Zero arbitrary value de cor em `pages/map/components/{MapCanvas,MindNode,NodeTaskIndicators}.tsx` (className); hex de `style` do `cardSkin` → `var(--color-…)`.
- [ ] Canvas com grid pontilhado; raiz neutra; ramo/folha coloridos com cantos por papel; toolbar de hover no tom Kaos; status/avatar/▲ preservados; `sprout` no mount (respeitando `prefers-reduced-motion`).
- [ ] Drag-to-place, resize (alça), collapse e edição inline **inalterados** (nenhum handler tocado); `data-testid` (`mind-node`, `node-title`, `resize-handle`, `ghost-slot`) preservados.
- [ ] Gate quick (web) passa (baseline mantido).

**Tests:** none (visual; lógica de layout/gesto intocada) · **Gate:** quick (web)

**Verify:** `pnpm dev` num mapa → fiel ao screenshot `canvas`/`hover`; arrastar/redimensionar/colapsar
seguem funcionando; `grep '(bg|text|border|stroke)-\[#'` nos 3 arquivos → vazio.

**Commit:** `refactor(m16): T5 reskin do canvas e do nó em tokens Kaos`

---

### T6: reskin do modal "Editar nó" → tokens [P]

**What:** `NodeEditDialog.tsx`: migrar os 4 arbitrary values + os hex de `style` (preview default,
avatar `#3a3a72`/`#cdcdf0`) para tokens. Labels de seção → `font-mono uppercase text-muted-foreground`.
Preview ao vivo, medidor de contraste (manter lógica; tons `emerald/amber/rose` são utilitários padrão
TW → ok) e swatches (ring já `ring-primary`) no visual Kaos. Botões Cancelar/Salvar via primitivos
(Salvar = `bg-primary`). **Manter a estrutura de modal** (não virar painel).
**Where:** `pages/map/components/NodeEditDialog.tsx` (+ `ColorSwatchGrid.tsx`/`StatusSelector.tsx` se acusarem no grep)
**Depends on:** T1, T3
**Reuses:** `contrast.ts`/`color-palette.ts`/`task-meta.ts` (lógica intacta); primitivos Dialog/Input.
**Requirement:** M16-14, M16-15, M16-16, M16-17

**Tools:** MCP: NONE · Skill: `web-component-creation`

**Done when:**

- [ ] Zero arbitrary value de cor em `NodeEditDialog.tsx` (className e `style`); labels em `font-mono` maiúsculo.
- [ ] Preview ao vivo + contraste + swatches + botões no visual Kaos; estrutura de modal preservada.
- [ ] `data-testid` (`assignee-input`, `critical-toggle`) e comportamento de persistência inalterados.
- [ ] Gate quick (web) passa.

**Tests:** none (visual) · **Gate:** quick (web)

**Verify:** abrir o modal num nó, alterar cor/status/prioridade → preview e contraste atualizam no visual
Kaos; `grep` de arbitrary value no arquivo → vazio.

**Commit:** `refactor(m16): T6 reskin do modal Editar nó em tokens Kaos`

---

### T7: verificação — grep-guard, gates full e smoke visual

**What:** Validar o conjunto. (a) **grep-guard** global vazio (comando acima) em todo `packages/web/src`.
(b) **Sem fonte remota** (Network). (c) **Gates full** verdes sem regressão: `pnpm typecheck && pnpm lint
&& pnpm test` (root) + `cd packages/web && pnpm test:e2e`; contagens = baseline (web 118 / api 61, e2e
37/37). (d) **Smoke visual obrigatório** (AD-014/L-005) das 4 telas comparadas ao guia: home
(grid+empty+modal), canvas (grid+nós+toolbar+drag/resize), modal editar (preview+contraste), identidade
(logo/nome/fontes). Só há commit se algum gate exigir ajuste pontual.
**Where:** `packages/web/e2e/` só se um e2e exigir ajuste de seletor; caso contrário sem código novo.
**Depends on:** T4, T5, T6
**Reuses:** suíte e2e existente; screenshots do guia como referência.
**Requirement:** M16 — Success Criteria (todos)

**Tools:** MCP: NONE · Skill: NONE

**Done when:**

- [ ] `grep -rnE '(bg|text|border|ring|stroke|fill|from|to|via|shadow|outline|decoration)-\[#' packages/web/src` → **vazio**.
- [ ] Network sem `fonts.googleapis.com`/`gstatic` (fontes self-hosted).
- [ ] Gate full verde; unit web/api e e2e **iguais ao baseline** (sem regressão, sem deleção silenciosa).
- [ ] Smoke visual das 4 telas conferido contra os screenshots do guia (anexar/confirmar com o usuário).
- [ ] `git diff` confere: só apresentação (nenhuma mudança em backend/layout/gesto/testids).

**Tests:** e2e + smoke visual · **Gate:** full

**Verify:** rodar os 4 comandos de gate + o grep; abrir as 4 telas e comparar com `screenshots/` do guia.

**Commit:** sem commit se passar limpo; ajuste pontual → `fix(m16): T7 <descrição>`.

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | fundação coesa do design system (tokens+fontes+asset+grid+motion) | ✅ Granular |
| T2 | 1 componente apresentacional | ✅ Granular |
| T3 | 1 primitivo (overlay) + varredura | ✅ Granular |
| T4 | 1 tela (Home) + seus componentes | ✅ Granular |
| T5 | canvas + nó (arquivos coesos da mesma tela) | ✅ Granular |
| T6 | 1 modal | ✅ Granular |
| T7 | verificação (grep+gates+smoke) | ✅ Granular |

> T1 toca 4 arquivos, mas é **um** deliverable (a base visual que todos consomem); fatiar geraria estados
> intermediários sem visual coerente (tokens sem fontes, etc.). T4/T5 agrupam os arquivos coesos de uma
> mesma tela — mesma tela = mesmo deliverable visual.

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 (início) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1, T2 | (T1,T2) → T4 [P] | ✅ Match |
| T5 | T1 | (T1) → T5 [P] | ✅ Match |
| T6 | T1, T3 | (T1,T3) → T6 [P] | ✅ Match |
| T7 | T4, T5, T6 | T4,T5,T6 → T7 | ✅ Match |

T4/T5/T6 são `[P]`: não dependem entre si, tocam arquivos disjuntos, gate vitest parallel-safe. Suas
dependências (T1/T2/T3) já completaram em fases anteriores.

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Tokens/CSS/fontes/asset (visual) | none | none | ✅ OK |
| T2 | Componente apresentacional | none | none | ✅ OK |
| T3 | Primitivo visual (overlay) | none | none | ✅ OK |
| T4 | Migração className→token (visual) | none | none | ✅ OK |
| T5 | Migração className→token (visual) | none | none | ✅ OK |
| T6 | Migração className→token (visual) | none | none | ✅ OK |
| T7 | Verificação (roda e2e + smoke) | e2e + smoke | e2e + smoke | ✅ OK |

> Todas as camadas do reskin são **visuais** → a matriz exige `none` (unit) e a rede é e2e-sem-regressão +
> **grep-guard** + **smoke visual obrigatório**, concentrados em T7. Não é deferral: não há lógica pura
> nova em T1–T6 para testar por unit (BrandMark é apresentacional; o resto é CSS/token). Mesmo precedente
> de milestones visuais anteriores (M10/M12 — CSS/fiação → smoke).

---

## Notas pós-execução (fora do diff de código, para o chat de execução/review)

- Atualizar `ROADMAP.md` (novo **M16 — Rebrand Kaos** concluído) e `STATE.md` (Current Work). Registrar
  que o M16 **reverte a decisão do M10** de "header neutro, sem rebranding" (agora identidade Kaos).
- Adicionar **Deferred Idea**: thumbnail **real** do mapa no card (precisa da árvore por mapa em
  `GET /maps`; decisão do usuário: glifo decorativo não vale, só thumbnail real) → candidato a feature futura.
- **Review AD-013** em chat separado antes de marcar "concluído" ([[feedback-plan-execute-split]]); smoke
  visual das 4 telas confirmado pelo usuário (AD-014).
- Se sobrar arbitrary value de cor legado fora do escopo do guia (decisão do usuário: **migrar tudo agora**),
  incluir na T4/T5/T6 o arquivo correspondente até o grep-guard zerar.
</content>
