# M13 — Tasks

Execução em chat separado ([[feedback-plan-execute-split]]). Commits atômicos
`tipo(m13): …`. Só frontend; AD-002 intacta. Gate ao fim: typecheck, lint, unit (web+api),
e2e, **smoke visual obrigatório** (L-004/L-005).

---

## T1 — `Slot` ganha bands + anchor; `computeSlots` emite as faixas

- **O quê:** Trocar o shape do `Slot` para `{ parentId, index, side, colX, anchorY,
  bandTop, bandBottom }` (remove `x`, `y`, `height`). Em `computeSlots`/`pushGroup`,
  preencher `anchorY` (= o `anchorY` atual, sem `- PLACEHOLDER_H/2`) e os limites de band a
  partir dos centros dos cards. Remover `PLACEHOLDER_H`.
- **Onde:** `packages/web/src/lib/slots.ts`.
- **Reusa:** `GAP_Y`, `NODE_WIDTH`, lógica de `anchorY` já existente em `pushGroup`.
- **Regras de band** (ver `design.md §4`):
  - grupo vazio: `anchorY = parentPos.y + parentPos.height/2`, band `(-Infinity, +Infinity)`.
  - grupo `m` filhos, `j=0..m`: `bandTop = j===0 ? -Infinity : center(children[j-1])`;
    `bandBottom = j===m ? +Infinity : center(children[j])`; `center(c)=c.y+c.height/2`.
- **Done when:** typecheck passa; `computeSlots` retorna o novo shape; nenhum uso restante
  de `PLACEHOLDER_H`.
- **Depende de:** —

## T2 — `nearestSlot` seleciona por band vertical + coluna horizontal

- **O quê:** Reescrever a métrica: `dy = 0` se `point.y ∈ [bandTop, bandBottom)`, senão
  distância à borda mais próxima; `dx = |point.x - (colX + NODE_WIDTH/2)|`;
  `score = dx + dy`; menor vence; empate → primeiro na ordem. Snap-back: `null` se o melhor
  `dx > SLOT_MAX_DISTANCE`. `excludeSubtree` inalterado.
- **Onde:** `packages/web/src/lib/slots.ts`.
- **Done when:** seleção estável dentro do band; troca só ao cruzar centro de card; cap
  horizontal preservado.
- **Depende de:** T1.

## T3 — Render do ghost usa `anchorY`/`colX`

- **O quê:** `top = anchorY - GHOST_BAR_HEIGHT/2`, `left = colX`, `width = NODE_WIDTH`,
  `height = GHOST_BAR_HEIGHT`. Remover referências a `slot.y`/`slot.height`/`PLACEHOLDER_H`.
- **Onde:** `packages/web/src/pages/map/components/MapCanvas.tsx`.
- **Verificar:** `useNodeDrag.ts` trata o `Slot` como opaco (esperado: zero mudança);
  ajustar só se referenciar campos removidos.
- **Done when:** typecheck/lint passam; barra renderiza no centro do vão.
- **Depende de:** T1.

## T4 — Testes unitários da seleção por band + migração de fixtures

- **O quê:** Migrar as fixtures de `Slot` em `slots.test.ts` para o novo shape. Adicionar
  casos cobrindo M13-01/02/03/05/07/08:
  - fronteira **no centro do card** (ponto logo acima vs. logo abaixo do centro → slots
    vizinhos diferentes);
  - **anti-flip**: vários pontos dentro de um mesmo band → mesmo slot;
  - **alturas variáveis** (cards 40 vs. ~79): simetria — pontos espelhados em torno do
    centro escolhem coerentemente; barra não "cola" no card maior;
  - **snap-back** por afastamento horizontal;
  - **empate** determinístico (primeiro vence);
  - bordas: lado vazio (band = coluna), folha, exclusão de subárvore.
- **Onde:** `packages/web/src/lib/slots.test.ts`.
- **Done when:** unit web verde; casos novos refletem as ACs.
- **Depende de:** T1, T2.

## T5 — Gate + smoke visual

- **O quê:** Rodar typecheck, lint, unit (web+api), e2e. **Smoke visual obrigatório**:
  screenshot arrastando um card entre irmãos de **alturas diferentes** (1 linha vs.
  multi-linha pós-M12), confirmando a barra simétrica no centro do vão e estável ao mover
  o cursor dentro do band. Reconciliar `e2e/drag-to-place.spec.ts` **só** se quebrar (não
  deve — semântica de `move` inalterada, `ghost-slot` mantido).
- **Onde:** workspace (gates) + evidência de screenshot.
- **Done when:** todos os gates verdes; smoke visual conferido e descrito.
- **Depende de:** T3, T4.

---

### Notas de execução

- **Paralelizável:** T1 destrava T2/T3 (que são independentes entre si). T4 depende de
  T1+T2; T5 fecha.
- **Sem schema/migration.** Confirmar `git diff` vazio em `packages/api`/`shared`/schema ao
  final (M13-09).
- Ao concluir: atualizar `ROADMAP.md` (M13 → executado), `STATE.md` (Current Work +
  registrar **AD-021**), e abrir review AD-013 em chat separado.
