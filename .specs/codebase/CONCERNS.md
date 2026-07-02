# Codebase Concerns

**Analysis Date:** 2026-05-19

Catalogado a partir da review pós-M3. Atualizar à medida que itens forem resolvidos ou novos forem descobertos.

## Known Bugs

**Trepidação da árvore durante o resize horizontal do card (relato do usuário, pós-M15, 2026-06-27):**

- Files: `packages/web/src/pages/map/components/MapCanvas.tsx` (gesto de resize: `onPointerMove`→`setActiveResize` por frame), `packages/web/src/lib/useTreeLayout.ts` (relayout por frame), `packages/web/src/pages/map/components/useMeasuredHeights.ts`.
- Symptom: ao arrastar a alça de resize, a árvore "treme" visivelmente a cada frame do arraste.
- Investigação até agora: hipótese inicial era o pipeline medir→layout — cada `pointermove` muda a largura → o texto reflui → o `ResizeObserver` remede a **altura** → relayout vertical por frame, com a altura oscilando quando o texto troca de nº de linhas. **Hipótese descartada:** congelar a medição de altura durante o arraste (pausar o RO + re-observar no `pointerup`) **não** eliminou a trepidação. Logo a causa não é (só) a remedição de altura. Suspeitos restantes a investigar: movimento horizontal do próprio nó/descendentes por frame, sub-pixel sob o `transform` de zoom do visx, re-render do `<Zoom>`, recentralização de breadth. O mecanismo de pausa foi **revertido** (não ajudava e alterava o timing da medição, atrapalhando o diagnóstico).
- Fix: pendente — usuário vai trazer mais pistas (qual nó treme: o redimensionado, os filhos, a árvore toda? em que zoom? com/sem filhos?).
- Test coverage: nenhum (comportamento de render/animação; o e2e funcional `card-resize.spec.ts` passa — não testa trepidação).

**`persistence.spec.ts:136` — teste e2e "mover nó para outro pai" falha consistentemente (descoberto no review AD-013 de M6):**

- Files: `packages/web/e2e/persistence.spec.ts:136-176`
- Symptom: O teste espera ≥2 filhos da raiz (`expect(children.length).toBeGreaterThanOrEqual(2)`) após clicar 2x em "Adicionar filho", mas encontra 1 → falha determinística (não flaky: reproduzido isolado, 2x).
- **Não é regressão de M6:** provado revertendo `MindNode.tsx` + `layout.worker.ts` + `treeLayout.ts` para a versão pré-M6 (`e7095ed`) e rodando o mesmo teste — falha idêntica. As 6 specs de `task-properties.spec.ts` (M6) passam todas.
- Causa raiz: seletor frágil `.react-flow__node').first().getByTitle('Adicionar filho')` assume que o primeiro nó no DOM é sempre a raiz. Depois do 1º filho criado + re-layout, `.first()` deixa de apontar para a raiz, então o 2º clique adiciona filho ao nó errado e a raiz fica com 1 filho. Agravado pelo DB de e2e compartilhado/acumulativo (ver "Test Infrastructure" abaixo) — o teste nem deleta os nós que cria.
- Fix: trocar o `.first()` por criação via API com título único + localização por título + cleanup no `afterEach` — exatamente o padrão robusto que `task-properties.spec.ts` (M6) já adota. Candidato a quick task.
- Test coverage: o próprio teste (frágil); a correção do DB isolado (infra) destrava a robustez.

~~**Rename inline do card da home não fecha ao confirmar com sucesso (descoberto no review AD-013 de M10):**~~ — **resolvido (2026-07-02):** o prop `onCancel` de `RenameMapInput` virou `onClose` (semântica real: "fechar o editor", disparado em cancelar/vazio/inalterado/erro **e** no sucesso) e o `handleBlur` troca o `catch { onClose }` por `finally { onClose }` → toda tentativa de confirmar fecha a edição (sucesso volta ao `MapCard`; erro fecha com rollback+toast do hook). `RenameMapInput.tsx` + `HomePage.tsx`.

~~**Root ("Central") não é renomeável via UI (relato do usuário):**~~ — resolvido em Q-003: clique no texto do nó dispara edição via `onStartEdit`, sem depender de `onNodeDoubleClick`.

~~**Lint quebra Success Criteria de M3:**~~ — resolvido em Q-001.

~~**`smoke.spec.ts:9` — teste de foco no inline edit falha consistentemente (pré-M5):**~~ — resolvido em Q-007: causa raiz era o componente `Input` (shadcn/ui Base UI) sem `forwardRef` — em React 18, o ref nunca chegava ao `<input>` nativo. Fix: `forwardRef` no Input + ref callback no MindNode com foco imediato + rAF + setTimeout(0) como fallback + `onMouseDown.stopPropagation` no span do título.

## Test Gaps

~~**`useTreeLayout.test.ts:165-189` — teste "alturas variáveis não se sobrepõem" é vacuoso (review AD-013 de M8):**~~ — **resolvido no M9** (confirmado 2026-07-02): o teste agora força **3 filhos co-laterais** (mesmo `side: 'RIGHT'`) com alturas distintas (com/sem props de tarefa), assere `length === 3`, que as alturas realmente variam (`Set(heights).size > 1` — guarda anti-vacuidade) e a não-sobreposição vertical real (`curr.y >= prev.y + prev.height`). Ver `useTreeLayout.test.ts:195-220`.

**Seleção de slot (`slots.ts`) — testes do M13 cobriam só coluna única (review AD-013 de M13, 2026-06-26 — corrigido):**

- Files: `packages/web/src/lib/slots.test.ts`, `packages/web/src/lib/slots.ts`
- Symptom: a T4/T5 do M13 só exercitaram um grupo/coluna; o caso **inter-grupo co-coluna** (dois pais de mesma profundidade/lado com `colX` idêntico) passou verde apesar de a barra mirar o grupo errado (roubo pela ordem de enumeração no empate `dx + dy`).
- **Resolvido** no próprio review: `nearestSlot` virou lexicográfico (coluna → grupo por `groupDy` → banda; `Slot` ganhou `groupTop`/`groupBottom`), commit `94fbe68`. Cobertura adicionada (2 testes de regressão: sintético + layout real). Ver AD-021 addendum / L-006 em STATE.md.
- Severity: era Medium (bug funcional visível em uso); agora fechado. Pendente só o **smoke visual no app** (túnel Postgres) confirmando o caso co-coluna.

**Reviews AD-013 de M9/M11/M12 (2026-06-27) — lacunas de teste não-bloqueantes:**

- **Card-fantasma (M9): o e2e usa `toBeVisible()`, que não valida tamanho nem oclusão** (`packages/web/e2e/drag-to-place.spec.ts`). O bug do `81d1028` (placeholder do tamanho do card, sem `zIndex`, cortado e atrás dos cards) passou pelo e2e — só smoke visual o pegaria. A cobertura visual do fantasma depende exclusivamente de smoke manual. Severity: Low.
- **Smoke M12: `lineCount` assume `line-height` em px** (`packages/web/e2e/smoke-visual.spec.ts`, `parseFloat(getComputedStyle(el).lineHeight)`). Se a tipografia virar `line-height: normal`, `parseFloat` → `NaN` e a asserção quebra silenciosamente. Robusto hoje (`text-sm` = 20px). Severity: Low.

**Review AD-013 de M15 (2026-07-02) — lacunas de teste não-bloqueantes:**

- **`card-resize.spec.ts:99` — asserção fraca de persistência:** o teste "arrastar alça para a direita persiste a largura" só assere `expect(persisted?.width).not.toBeNull()` — qualquer `width` não-nulo passa, sem validar que a largura **aumentou** nem a magnitude do arraste. Um resize que persistisse um valor errado (mas não-nulo) passaria verde. Fix: `expect(persisted.width).toBeGreaterThan(180)`. Severity: Low.
- **Backend: `width` não-inteiro e nó-novo-null sem asserção direta** (`packages/api/src/routes/nodes.test.ts`): o Zod `.int()` rejeita `1.5` com 400, mas nenhum teste cobre o ramo não-inteiro (cobrem-se 0, negativo, > max, limite 1000). M15-10 (nó novo nasce `width=null`) é coberto só indiretamente (nenhum assert direto do `POST /`). Severity: Low.

**CONCERNS.md desatualizado pós-M7 (descoberto no review AD-013 de M8):**

- As entradas abaixo referenciam arquivos/símbolos que o M7 (migração React Flow → visx, AD-015) **removeu** e portanto estão obsoletas: a Fragile Area `rfNodes`↔`useNodesState` (eliminada por design — ver L-004), os Performance Bottlenecks de `useLayoutedTree.ts`/`treeLayout.ts`/`simpleTreeLayout` (arquivos removidos), e o seletor `.react-flow__node` citado no Known Bug `persistence.spec.ts:136` (migrado para `data-testid` em M7-T5 — o bug em si pode ter mudado de natureza).
- Severity: Medium (documentação enganosa) — candidato a reconciliação dedicada (não feito aqui para não extrapolar o escopo do review de M8).

## Fragile Areas

> ⚠️ Seção parcialmente obsoleta pós-M7 — ver "CONCERNS.md desatualizado pós-M7" acima.

**Sincronização entre `rfNodes` derivado e `useNodesState` do React Flow:**

- Files: `packages/web/src/pages/map/components/MapCanvas.tsx:155-159`
- Why fragile: Há dois "donos" do mesmo estado — o estado interno de `useNodesState` e o `rfNodes` memoizado. Um `useEffect` força `setNodes(rfNodes)` toda vez que `rfNodes` muda (que é toda vez que `editingId`, `collapsedIds`, `data` ou `positioned` mudam). Cada sync pode interferir com o que o React Flow está fazendo internamente (drag em andamento, foco no input do MindNode, seleção).
- Common failures: Os 4 commits `fix(web): ...` recentes (`b0f1c85`, `92a4c0e`, `8df0e6a`, `6967671`) giram em torno desse padrão.
- Safe modification: Trocar por modo controlado — passar `nodes={rfNodes}` direto sem `useNodesState`, capturando drag intermediário num `useRef`. Ou usar `useNodesState` como única fonte de verdade e aplicar mudanças derivadas (`editingId`, `collapsedIds`) via `setNodes(prev => ...)` em vez de reatribuição.
- Test coverage: Nenhum — UI interativa não tem testes (AD-007). Regressões só aparecem em uso manual.

**Input de rename inline usa `defaultValue` (uncontrolled):**

- Files: `packages/web/src/pages/map/components/MindNode.tsx:92`
- Why fragile: Se o MindNode re-monta durante a edição (provável durante o sync acima), o input recria com `defaultValue=node.title` e o que o usuário digitou é perdido silenciosamente.
- Safe modification: Subir o valor para state local (`useState` no MindNode) com handler `onChange`, e usar controlled input.
- Test coverage: Nenhum.

## Performance Bottlenecks

**`simpleTreeLayout` síncrono no main thread em todo update:**

- Problem: O fallback de layout corre síncrono em `useMemo` toda vez que `nodes` ou `edges` mudam, mesmo quando o worker do elkjs ainda vai sobrescrever. Para mapas grandes (RNF-01: 500 nós), bloqueia o main thread por instantes — exatamente o que AD-009 quis evitar.
- Files: `packages/web/src/lib/useLayoutedTree.ts:24`, `packages/web/src/lib/treeLayout.ts:9-57`
- Measurement: Sem medição. Para mindmap pessoal pequeno (≤ ~30 nós) imperceptível.
- Cause: O fallback foi introduzido (commit `6967671`) para evitar tela vazia enquanto o worker calcula, mas ficou no caminho crítico de todo render, não só do primeiro.
- Improvement path: Rodar o fallback só quando ainda não há resultado do worker para o input atual (gate por `workerPositioned == null`). Ou rodá-lo dentro do próprio worker como degradado em caso de erro.

## UX Inconsistencies

**`NodeEditDialog` persiste cada campo no clique; a AC M10-21 ("cancelar/fechar descarta") não é literalmente cumprida (descoberto no review AD-013 de M10):**

- Files: `packages/web/src/pages/map/components/NodeEditDialog.tsx:108-127`
- Symptom: cor de fundo/texto, status e criticidade chamam `onUpdateNode` imediatamente no clique (optimistic); título/responsável persistem no blur/Enter. Não há botão Confirmar/Descartar — fechar o dialog **não** desfaz nada. A spec (M10-21 / AC P1-Dialog-4) diz "WHEN cancela/fecha THEN descartar sem persistir", mas a traceability marca M10-21 como "Verified".
- **Por design, não é regressão:** o `design.md` decidiu "optimistic atual intacta" e o dialog pré-M10 (`81d1028`) já persistia cada campo no clique. O estado-espelho local adicionado em M10 serve só ao preview ao vivo, não a um modelo confirm/discard.
- Severity: Low — discrepância de rastreabilidade (spec vs. implementação), sem impacto funcional; condiz com o "espírito do export" (escolha livre).
- Fix: alinhar a spec à realidade (anotar que o dialog é optimistic, sem confirm/discard) **ou**, se confirm/discard for desejado, bufferizar as edições e só persistir no Confirmar. Decisão de produto.

**Inline edit ignora `textColor` customizado:**

- Files: `packages/web/src/pages/map/components/MindNode.tsx:101`
- Symptom: Quando um nó tem `textColor` customizado e o usuário inicia edição inline (clique no texto), o `<Input>` tem classe `text-foreground` que sobrescreve a cor herdada do inline style do wrapper. O texto do input aparece na cor do tema, não na cor customizada.
- Severity: Low/Cosmetic — não viola spec (spec cobre renderização no canvas, não estado de edição). A edição é transiente.
- Fix: Remover `text-foreground` da className do Input de edição, ou aplicar `style={{ color: node.textColor ?? undefined }}` diretamente no Input.

## Test Infrastructure

**E2E (Playwright) roda contra o DB de dev, não um banco isolado (descoberto na execução de M6/T9):**

- Files: `packages/web/playwright.config.ts`, `packages/web/e2e/*.spec.ts`
- Symptom: A suíte e2e compartilha o mesmo mapa/DB entre testes sem reset automático. Durante T9, runs intermediários poluíram o DB de dev com nós órfãos (limpos manualmente ao final). Indexar `.react-flow__node` por posição é não-confiável porque acumula nós de execuções anteriores.
- Workaround adotado em M6: cada spec de `task-properties.spec.ts` cria seu próprio nó com título único via `POST /api/nodes`, localiza por título e remove num `afterEach` via `DELETE`. Mantém o mapa estável, mas é boilerplate por teste.
- Severity: Medium — não quebra os testes (verdes), mas é frágil e suja dados reais de dev. Contradiz a intenção de "banco de testes isolado" de Q-002/Q-003 (validar se o isolamento existe só p/ Vitest API e não p/ Playwright).
- Improvement path: apontar o `webServer` do Playwright para um DATABASE_URL de teste dedicado com reset por run (truncate/migrate), espelhando o setup dos testes de API. Candidato a quick task pós-M6.
- **Validado no review AD-013 de M6:** confirmado — o DB compartilhado/acumulativo já está quebrando um teste preexistente (`persistence.spec.ts:136`, ver "Known Bugs"). As specs de M6 não foram afetadas (usam o workaround de título único + cleanup). Reforça a prioridade do DB de teste isolado.
- **Addendum (2026-06-27, reviews AD-013 de M9/M11/M12 + deploy AD-022) — mecanismo confirmado e severidade escalada para HIGH:** o `webServer` do Playwright (`playwright.config.ts:33`) sobe a API com `pnpm --filter @mindmap/api run dev` = `tsx watch src/server.ts`, que carrega `.env` via `src/env.ts:2` (`config()` sem path). O `.env` local aponta para o banco **`mindmap`** — que, **pós-deploy (AD-022)**, é o banco de **PRODUÇÃO** servido pelo app na VPS (mesmo Postgres, via túnel SSH). Logo **rodar `pnpm test:e2e` cria/altera mapas no banco de produção do usuário** — não mais só "dados de dev". `pnpm dev` local idem (todo desenvolvimento local mexe em prod). Os testes de integração da API (vitest) **estão isolados** (`vitest.config.ts:4` força `dotenv.config({ path: '.env.test', override: true })` → `dev_mindmap`), confirmando a suspeita registrada acima de que o isolamento só valia para o Vitest, não para o Playwright. Fixes: **(a) aplicado (2026-06-27)** — o `packages/api/.env` local (gitignored) foi repontado de `mindmap` para **`dev_mindmap`**; como o `pnpm dev` e o `webServer` do e2e leem esse `.env`, **ambos deixaram de tocar produção** (prod `mindmap` fica só com o app deployado, que usa o env do Portainer). **Residual:** dev/e2e **ainda precisam do túnel** (`dev_mindmap` mora na VPS) e agora **compartilham** o `dev_mindmap` com o `vitest` da API (`.env.test`), então `pnpm test` (que faz `deleteMany`) limpa os dados do `pnpm dev` — aceito por ora. Reabre risco só se alguém repontar `.env` para prod manualmente e rodar e2e na sequência. **(b) estrutural (adiado pelo usuário — "pipeline pra dev mais pra frente")** — Postgres **local** (Docker) para dev, banco de **teste dedicado** (separado do dev) para vitest+e2e, eliminando a dependência do túnel e a partilha dev↔teste.

## Tech Debt

**`useMeasuredHeights`: `refCallbacks` não é podado no unregister (review AD-013 de M12, 2026-06-27):**

- Files: `packages/web/src/pages/map/components/useMeasuredHeights.ts:62-77`
- Quando um nó é deletado, o ref é chamado com `null` (limpa `elements`/`heights`), mas a closure memoizada em `refCallbacks.current` persiste pela vida do componente → crescimento lento e ilimitado de closures numa sessão longa com muitos create/delete. Sem impacto em corretude (ids únicos).
- Fix: podar `refCallbacks.current[id]` no ramo `el == null`. Severity: Low.

**`move` para a raiz sem `side` assume `RIGHT` (review AD-013 de M9, 2026-06-27):**

- Files: `packages/api/src/routes/nodes.ts:159`
- Salvaguarda que pode flipar silenciosamente um nó `LEFT` se um cliente futuro omitir `side` num `move` cujo destino é a raiz. Hoje **inalcançável** (o frontend sempre envia `side` via `slotToMoveBody`). Considerar exigir `side` quando `newParentId` é a raiz. Severity: Low (latente).

**Gesto de resize sem handler de `pointercancel` (review AD-013 de M15, 2026-07-02):**

- Files: `packages/web/src/pages/map/components/MapCanvas.tsx:195-228`
- O ciclo do gesto de resize trata `pointerdown`/`pointermove`/`pointerup`, mas não `pointercancel`. Se o SO cancelar o ponteiro no meio do arraste (gesto do sistema, menu de contexto), `resizeRef.current` e `activeResize` ficam setados → estado de resize "preso" e a largura não persiste. O `pointerup` normal limpa corretamente; só o caminho de cancelamento fica descoberto. Fora dos ACs do M15. Severity: Low (latente).
- Fix: adicionar handler de `pointercancel` que limpa `resizeRef`/`activeResize` (com ou sem persistir).

**Resize persiste a largura do closure de estado, não de um ref (review AD-013 de M15, 2026-07-02):**

- Files: `packages/web/src/pages/map/components/MapCanvas.tsx:220-224`
- O `pointerup` persiste `activeResize?.width` lido do estado React (closure), dependendo de o React já ter re-renderizado com o último `pointermove` antes do `pointerup`. Na prática os eventos de ponteiro discretos são flushados entre si e funciona (e2e verde); guardar o width final no `resizeRef` (como já se faz com `startWidth`/`ceiling`) seria determinístico. Severity: Low.

**Doc drift: `design.md` do M15 descreve a alça via callbacks que não existem (review AD-013 de M15, 2026-07-02):**

- Files: `.specs/features/m15-card-resize/design.md` (componente 5) vs `MapCanvas.tsx:195-207`, `MindNode.tsx:280-285`, `types.ts`
- O design especifica a alça com `onPointerDown`→`stopPropagation`+`setPointerCapture`+`onResizeStart` e callbacks de resize em `MindNodeData`. A implementação real detecta o resize no wrapper do `MapCanvas` via `closest('[data-testid="resize-handle"]')` (if/else que isola resize de drag-to-place), então `types.ts` **não** tem callbacks de resize (não é resíduo — é a abordagem escolhida) e a alça é um `<div>` puro. Satisfaz M15-03, mas diverge do doc. Severity: cosmético — alinhar o design ao código.

**Comentário datado em `nodeSize.ts` pós-M12 (review AD-013 de M11, 2026-06-27):**

- Files: `packages/web/src/lib/nodeSize.ts:6-7`
- O comentário descreve a reserva de altura da divisória (`NODE_HEIGHT_WITH_FOOTER`) como se governasse o `GAP_Y` final, mas pós-M12 a altura final vem da medição real (`nodeSizeFromHeights`); a constante é só estimativa de 1º paint (`estimateNodeHeight`). Alinhar o comentário. Severity: cosmético.

~~**Helper `request<T>` duplicado entre módulos de API web:**~~ — resolvido: extraído para `packages/web/src/api/_request.ts`.

~~**Verificação anti-ciclo redundante no `move`:**~~ — resolvido: guard `if (newParentId === id)` removido; CTE recursivo já cobre.

~~**Código morto `allNodeIds`:**~~ — resolvido em Q-004.

~~**`persistence.spec.ts` tem mudanças não commitadas (teste de move node):**~~ — resolvido em Q-006 (commit `ad520ec`).

## Dependencies at Risk

~~**`@xyflow/react` com `hideAttribution: true` exige licença paga:**~~ — resolvido: `proOptions` removido, atribuição visível.

---

_Concerns audit: 2026-05-20 (M5 review)_
