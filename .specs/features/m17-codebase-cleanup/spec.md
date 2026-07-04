# M17 — Limpeza da base de código — Specification

## Problem Statement

Uma revisão de organização (2026-07-03) confirmou que a base está **bem estruturada**
(camadas api/web aderentes, dívida rastreada em `CONCERNS.md`/`STATE.md`, spec-driven),
mas acumulou **desvios de forma** contra as próprias regras do projeto (`CLAUDE.md`,
`.claude/rules/frontend-structure.md`, skills). São itens localizados, sem impacto
funcional, mas que corroem a manutenibilidade e a consistência que o projeto preza:

- **Tags HTML puras** onde há primitivo pronto — **já resolvido nesta sessão** (Home +
  canvas migrados para `Button`/`Input`); serve de baseline (ver T0).
- **Comentários violando a regra** (prosa/multi-linha ou descrevendo "o quê"): ~86
  line-comments + 29 blocos JSDoc, sendo o pior `useMeasuredHeights.ts` (parágrafos de
  design no meio do código). A regra permite só o *porquê* não-óbvio em **≤1 linha**;
  racional de decisão vai para AD, não para o código.
- **Hex de cor cravado nas telas** (`#b01818` em `MindNode.tsx`/`NodeEditDialog.tsx`) —
  o padrão que a [[feedback-no-inline-hex]] proíbe; o modo escuro já usa `var(--color-brand)`.
- **Colocação inconsistente**: `tree.ts`/`useTreeLayout.ts`/`slots.ts`/`nodeSize.ts` moram
  em `lib/` mas só são usados por `pages/map/`; `EmptyState` está inline no `HomePage.tsx`.
- **Duplicação**: o preview ao vivo do `NodeEditDialog` reconstrói o markup de
  `NodeTaskIndicators` em vez de reusá-lo.
- **Baixa coesão**: `MapCanvas.tsx` (526 linhas) concentra Zoom + arestas + nós + barra-fantasma
  + 4 mutations + medição de container + estado de edição num só arquivo.

Isto é **puramente refactor/higiene**: zero mudança de comportamento, contrato, schema ou
visual. Cada mudança preserva a saída observável (render, gestos, persistência, testes).

## Goals

- [ ] Zero comentário fora da regra em `packages/*/src` (só *porquê* ≤1 linha; racional → AD/CONCERNS).
- [ ] Zero hex de cor cravado nas telas; grep-guard de hex zera (respeitadas as exceções de dados/lógica).
- [ ] Colocação correta: módulos de canvas na página do mapa; `lib/` só com compartilhado real.
- [ ] Sem duplicação de markup de indicadores de tarefa.
- [ ] `MapCanvas.tsx` decomposto em unidades de responsabilidade única.
- [ ] **Zero regressão**: typecheck/lint verdes, unit web/api e e2e = baseline; comportamento idêntico.

## Out of Scope

Explicitamente excluído — documentado para evitar scope creep.

| Item | Motivo |
| --- | --- |
| Qualquer mudança de comportamento, contrato, schema, migration | É refactor puro; AD-002 e contratos intactos |
| Mudança visual (cores, tipografia, layout, raio) | A calibração de cor e o raio uniforme já foram feitos nesta sessão (T0); M17 não mexe em aparência |
| Resolver o bug aberto de **trepidação no resize** (CONCERNS → Known Bugs) | Bug de comportamento, não de organização; T5 deve tomar cuidado para **não** perturbá-lo, não resolvê-lo |
| Reescrever primitivos `ui/` (shadcn/base-ui — código de terceiros) | Regra: nunca modificar `ui/` |
| Tokenizar **todos** os `rgba()` de sombra/overlay | Baixa severidade; incluído só como parte opcional de T1 (não bloqueia) |
| Fragile Areas obsoletas pós-M7 (`rfNodes`↔`useNodesState`) no CONCERNS | Já eliminadas por design; reconciliação de doc fica fora |

---

## User Stories

### P1: Código sem comentários fora da regra ⭐

**User Story**: Como mantenedor, quero que os comentários sigam a regra (só *porquê*
não-óbvio em ≤1 linha) para que o código seja lido pela sua própria estrutura e o racional
de decisão viva nas ADs.

**Why P1**: Foi a dor levantada pelo usuário ("comentários em prosa soltos no meio").

**Acceptance Criteria**:

1. WHEN um arquivo `.ts/.tsx` de produção é lido THEN não SHALL haver comentário que
   descreva "o quê" o código faz, nem bloco de prosa multi-linha de racional.
2. WHEN um comentário permanece THEN ele SHALL ser um *porquê* não-óbvio (workaround/decisão
   contra-intuitiva) em **até 1 linha**, OU marcação de hot path denso proposital.
3. WHEN um racional relevante é removido do código THEN ele SHALL ser preservado numa AD
   (`STATE.md`) ou em `CONCERNS.md`, não descartado.

**Independent Test**: Ler os arquivos apontados no design; nenhum comentário "o quê" ou
multi-linha remanescente; gates verdes.

### P1: Zero cor cravada nas telas ⭐

**User Story**: Como mantenedor, quero as cores só em tokens para recalibrar tudo num lugar.

**Acceptance Criteria**:

1. WHEN um `.tsx` de tela é lido THEN não SHALL haver hex de cor em `className` nem em `style`
   (exceto cor de **dados do usuário** e módulos de dados/lógica: `color-palette.ts`,
   `contrast.ts`, `task-meta.ts`).
2. WHEN o marcador crítico do nó renderiza sobre fundo claro THEN o sistema SHALL usar um
   **token** (não `#b01818`), coerente com o `var(--color-brand)` já usado no modo escuro.

**Independent Test**: grep-guard de hex nos arquivos de tela → vazio (fora das exceções).

### P1: Colocação e coesão corretas ⭐

**User Story**: Como mantenedor, quero cada arquivo no lugar certo e com uma responsabilidade,
para achar e evoluir o código sem surpresa.

**Acceptance Criteria**:

1. WHEN um módulo só é usado por uma página THEN ele SHALL morar em `pages/<pagina>/`
   (canvas: `tree`/`useTreeLayout`/`slots`/`nodeSize` + testes); `lib/` SHALL conter só o
   compartilhado real (`mergeClasses`, `uid`).
2. WHEN um componente é específico de uma página THEN ele SHALL morar em
   `pages/<pagina>/components/` (`EmptyState` sai do `HomePage.tsx`).
3. WHEN o preview do `NodeEditDialog` exibe status/responsável THEN ele SHALL **reusar**
   `NodeTaskIndicators`, sem duplicar o markup.
4. WHEN `MapCanvas.tsx` é lido THEN ele SHALL delegar barra-fantasma, medição de container e
   estado de edição a unidades próprias (componente/hook), com o arquivo raiz enxuto.

**Independent Test**: `lib/` só com `mergeClasses`/`uid`; grep de duplicação de avatar/status
some; `MapCanvas.tsx` < ~300 linhas; gates verdes.

---

## Requirement Traceability

| Requirement ID | Story | Task | Status |
| --- | --- | --- | --- |
| M17-01 | Comentários na regra | T2 | Pending |
| M17-02 | Hex crítico → token | T1 | Pending |
| M17-03 | (opcional) sombras/overlay rgba → tokens | T1 | Pending |
| M17-04 | Colocação: libs do canvas + EmptyState | T3 | Pending |
| M17-05 | Dedup: reusar NodeTaskIndicators | T4 | Pending |
| M17-06 | Decompor MapCanvas.tsx | T5 | Pending |
| M17-07 | Zero regressão (gates full = baseline) | T6 | Pending |

**ID format:** `M17-NN` · **Status:** Pending → In Tasks → Implementing → Verified

---

## Success Criteria

- [ ] Nenhum comentário fora da regra em `packages/*/src`; racional relevante em AD/CONCERNS.
- [ ] grep-guard de hex nas telas → vazio (fora das exceções de dados/lógica).
- [ ] `lib/` só com compartilhado real; módulos de canvas e `EmptyState` recolocados.
- [ ] `NodeTaskIndicators` reusado no preview; sem markup duplicado.
- [ ] `MapCanvas.tsx` decomposto (ghost bar + hooks), cada unidade com 1 responsabilidade.
- [ ] Gates full verdes, contagens = baseline (web 118 / api 61 / e2e 37/37); zero mudança
      de comportamento/visual (confirmado por `git diff` + smoke).
</content>
</invoke>
