# M14 — Hierarquia visual + espaçamento — Tasks

> Só frontend (`packages/web/src/pages/map/`). Cada task = 1 commit atômico `feat(m14)`/`test(m14)`.
> Rastreabilidade → `spec.md` (M14-NN). Gray areas → `context.md` (C1–C8). Arquitetura → `design.md`.
> Executar em chat separado ([[feedback-plan-execute-split]]).
>
> **Ganchos-chave (do design):** `depth` e `branchHeadId` computados no walk que **já existe** em
> `computeTreeLayout` (sem 2ª passada); cor do ramo **deriva** do `bgColor` da N2 (não é dado novo);
> fundo dos cards intocado; espaçamento = dois números + um fix de teste. Muito valor é **calibração ao
> vivo** (T6) — a natureza "muito design" do M14.

**Grafo de dependências:**

```
T1 (espaçamento) [P] ──→ T2 (layout: depth + branchHeadId) ──┬─→ T4 (tier tipografia) ──→ T5 (edges coloridas) ──┐
T3 (branchStroke) [P] ───────────────────────────────────────┘                        ┌──────────────────────────┴─→ T6 (calibração + gate)
                                                              T3 ───────────────────────┘
```

- **T1** e **T3** paralelos `[P]` (arquivos disjuntos: constantes/teste vs `contrast.ts`).
- **T2** depois de **T1** (mesmo arquivo `useTreeLayout.ts`). **T4** precisa do `depth` (T2).
- **T5** precisa de `branchHeadId` (T2) + `branchStroke` (T3); vem depois de **T4** (mesmo arquivo `MapCanvas.tsx`).
- **T6** fecha: calibra os números com o usuário e roda o gate.

---

## T1 — Espaçamento: subir `GAP_Y`/`GAP_X` + fix de teste `[P]`

- **What**: aliviar o aperto e destravar o drop-indicator.
- **Where**: `lib/useTreeLayout.ts` (constantes `GAP_Y`/`GAP_X`), `lib/slots.test.ts` (hardcode),
  `components/GhostBar.tsx` (comentário).
- **Depends on**: —
- **Reuses**: as constantes já exportadas e importadas pelos testes.
- **Done when**:
  - `GAP_Y` e `GAP_X`: `24 → 40` (valor inicial; final calibrado em T6, grade de 4px [[feedback-spacing-grid]]).
  - `slots.test.ts:332` troca `+ 24` literal por `+ GAP_X` (importado).
  - Comentário do `GHOST_BAR_HEIGHT` em `GhostBar.tsx` atualizado (não cita mais `GAP_Y=24`).
- **Tests**: rodar `useTreeLayout.test.ts` + `slots.test.ts`; ajustar qualquer expectativa de coordenada
  **absoluta** que dependa do gap antigo (as relativas usam a constante e sobrevivem).
- **Traces**: M14-09, M14-10.
- **Gate**: typecheck ✓, lint ✓, unit web (layout+slots) ✓.

## T2 — Layout: `depth` no nó + `branchHeadId` na edge

- **What**: plumbing de profundidade e identidade de ramo, computados no walk existente.
- **Where**: `lib/useTreeLayout.ts` (`PositionedNode`, `LayoutLink`, `computeTreeLayout`/`layoutSide`),
  `lib/useTreeLayout.test.ts`.
- **Depends on**: T1 (mesmo arquivo).
- **Reuses**: a hierarquia do `flextree` (já dá `n.depth`); o `each` que já emite os `LayoutLink`.
- **Done when**:
  - `PositionedNode` ganha `depth: number` (central `0`; N2 `1`; N3+ `≥2`) — central empilhado com `depth: 0`.
  - `LayoutLink` ganha `branchHeadId: string | null` = id da N2 ancestral do destino (edge central→N2 = o
    próprio N2; profundas = N2 no topo da subárvore), via `Map` local propagado no `each`.
- **Tests**: unit — `depth` por nó (raiz 0, filhos 1, netos 2); `branchHeadId` (central→N2 = o N2;
  edge de neto = a N2 ancestral, não o pai intermediário).
- **Traces**: M14-01, M14-02, M14-11 (parcial).
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T3 — `branchStroke()` em `contrast.ts` `[P]`

- **What**: derivar um traço de edge legível a partir do `bgColor` da N2.
- **Where**: `lib/contrast.ts`, `lib/contrast.test.ts` (se existir; senão criar no padrão dos utils).
- **Depends on**: —
- **Reuses**: `isDarkBg`/`autoTextColor` já em `contrast.ts`; `DEFAULT_BG`/paleta em `color-palette.ts`.
- **Done when**: `branchStroke(bgColor: string | null): string | null` — `null` quando `bgColor` é `null`
  (caller cai no `stroke-edge`); senão retorna cor legível sobre o canvas escuro, com **piso de
  luminância** para tons escuros (ex.: `#2f3e57`). Números iniciais razoáveis; finais calibram em T6.
- **Tests**: unit — `null → null`; pastel claro → cor utilizável; cor escura → luminância ajustada
  (≥ um limiar de contraste sobre o fundo do canvas).
- **Traces**: M14-07, M14-11 (parcial).
- **Gate**: typecheck ✓, lint ✓, unit web ✓.

## T4 — Ênfase por tier (tipografia/escala)

- **What**: N1/N2/N3+ com destaque tipográfico crescente; fundo intocado.
- **Where**: `components/types.ts` (`MindNodeData.depth`), `components/MapCanvas.tsx` (injeta `depth` no
  `nodeDataById`), `components/MindNode.tsx` (`cardSkin(depth, …)` + classes por tier).
- **Depends on**: T2 (`PositionedNode.depth`).
- **Reuses**: o `cardSkin` atual (mantém fundo/borda/sombra); o `depth` já em `PositionedNode`.
- **Done when**:
  - `MindNodeData` ganha `depth: number`; `nodeDataById` injeta `p.depth`.
  - `cardSkin` recebe `depth`; **fundo/borda/sombra inalterados** (C2). N1 (depth 0) título maior/peso
    maior + mais padding; N2 (depth 1) um degrau acima; N3+ (≥2) o neutro atual (`text-sm font-semibold`).
  - N1 segue ignorando cor do usuário (comportamento atual). Bump de largura *default* só do N1 é
    opcional (C1) — decidir em T6.
- **Tests**: none (UI declarativa; coberto por verificação visual em T6 — padrão AD-007/AD-014 do projeto).
- **Traces**: M14-03, M14-04.
- **Gate**: typecheck ✓, lint ✓.

## T5 — Edges coloridas por ramo (render)

- **What**: cada edge herda a cor derivada da N2 ancestral; default neutro.
- **Where**: `components/MapCanvas.tsx` (o `.map` dos `links` → `<LinkHorizontal>`).
- **Depends on**: T2 (`branchHeadId`), T3 (`branchStroke`); depois de T4 (mesmo arquivo).
- **Reuses**: `nodeById` (já existe no MapCanvas) pra resolver `branchHeadId → bgColor`; a classe
  `stroke-edge` atual como fallback.
- **Done when**: pra cada link, `headBg = nodeById.get(link.branchHeadId)?.bgColor ?? null`;
  `stroke = branchStroke(headBg)`; `null` → mantém `className="stroke-edge"` (M14-06); senão aplica a cor
  no traço (M14-05). Central não colore (não é `branchHeadId` de ninguém). **M14-08 (espessura por
  `depth`)**: só se decidido em T6.
- **Tests**: none (render; a lógica de cor/propagação está coberta por T2 (branchHeadId) + T3 (branchStroke)).
- **Traces**: M14-05, M14-06.
- **Gate**: typecheck ✓, lint ✓.

## T6 — Calibração ao vivo + gate final do milestone

- **What**: afinar os números com o usuário na tela e fechar o pacote.
- **Where**: valores em `useTreeLayout.ts` (gaps), `MindNode.tsx` (escala por tier), `contrast.ts`
  (branchStroke), e a espessura opcional por depth (`MapCanvas`).
- **Depends on**: T1, T2, T3, T4, T5.
- **Reuses**: o app rodando (o usuário calibra ao vivo, como fez com o `--color-success`).
- **Done when**:
  - Gaps finais definidos com o usuário (partiu de 40/40).
  - Escala tipográfica N1/N2/N3+ aprovada visualmente; branchStroke com cor/contraste aprovados;
    decisão sobre espessura por depth (M14-08) e bump de largura do N1 tomada.
  - Caso relatado verificado: dá pra soltar um nó como filho de um card sem o card vizinho interferir
    (a ghost bar não pula). Se **ainda** bugar em canto apertado → registrar como follow-up
    (`nearestSlot`, C8), **não** corrigir aqui.
  - Gate: `pnpm -r typecheck` ✓, `pnpm -r lint` ✓, unit web ✓, e smoke visual do canvas.
- **Tests**: verificação visual/manual (calibração); e2e do canvas se algum spec existente for afetado.
- **Traces**: M14-08 (decisão), fechamento de M14-03/05/09.
- **Gate**: tríade + verificação visual ✓.

---

## Definition of Done (milestone)

- Requisitos M14-01..M14-11 implementados; M14-12 conscientemente fora (Deferred/rejeitados).
- Commits atômicos `feat(m14)`/`test(m14)`, um por task.
- Gates verdes: typecheck, lint, unit web; verificação visual do canvas (hierarquia + espaçamento).
- Fundo dos cards **não** alterado (C2); cor do ramo deriva do `bgColor` existente (sem dado novo).
- Espaçamento resolve o caso de drop relatado; precedência do `nearestSlot` **não** tocada (C8).
- Review AD-013 em chat separado antes de marcar "concluído".
