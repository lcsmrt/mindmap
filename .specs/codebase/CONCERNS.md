# Codebase Concerns

**Analysis Date:** 2026-05-19

Catalogado a partir da review pós-M3. Atualizar à medida que itens forem resolvidos ou novos forem descobertos.

## Known Bugs

**`persistence.spec.ts:136` — teste e2e "mover nó para outro pai" falha consistentemente (descoberto no review AD-013 de M6):**

- Files: `packages/web/e2e/persistence.spec.ts:136-176`
- Symptom: O teste espera ≥2 filhos da raiz (`expect(children.length).toBeGreaterThanOrEqual(2)`) após clicar 2x em "Adicionar filho", mas encontra 1 → falha determinística (não flaky: reproduzido isolado, 2x).
- **Não é regressão de M6:** provado revertendo `MindNode.tsx` + `layout.worker.ts` + `treeLayout.ts` para a versão pré-M6 (`e7095ed`) e rodando o mesmo teste — falha idêntica. As 6 specs de `task-properties.spec.ts` (M6) passam todas.
- Causa raiz: seletor frágil `.react-flow__node').first().getByTitle('Adicionar filho')` assume que o primeiro nó no DOM é sempre a raiz. Depois do 1º filho criado + re-layout, `.first()` deixa de apontar para a raiz, então o 2º clique adiciona filho ao nó errado e a raiz fica com 1 filho. Agravado pelo DB de e2e compartilhado/acumulativo (ver "Test Infrastructure" abaixo) — o teste nem deleta os nós que cria.
- Fix: trocar o `.first()` por criação via API com título único + localização por título + cleanup no `afterEach` — exatamente o padrão robusto que `task-properties.spec.ts` (M6) já adota. Candidato a quick task.
- Test coverage: o próprio teste (frágil); a correção do DB isolado (infra) destrava a robustez.

~~**Root ("Central") não é renomeável via UI (relato do usuário):**~~ — resolvido em Q-003: clique no texto do nó dispara edição via `onStartEdit`, sem depender de `onNodeDoubleClick`.

~~**Lint quebra Success Criteria de M3:**~~ — resolvido em Q-001.

~~**`smoke.spec.ts:9` — teste de foco no inline edit falha consistentemente (pré-M5):**~~ — resolvido em Q-007: causa raiz era o componente `Input` (shadcn/ui Base UI) sem `forwardRef` — em React 18, o ref nunca chegava ao `<input>` nativo. Fix: `forwardRef` no Input + ref callback no MindNode com foco imediato + rAF + setTimeout(0) como fallback + `onMouseDown.stopPropagation` no span do título.

## Test Gaps

**`useTreeLayout.test.ts:165-189` — teste "alturas variáveis não se sobrepõem" é vacuoso (review AD-013 de M8):**

- Files: `packages/web/src/lib/useTreeLayout.test.ts:165-189`
- Symptom: o teste cria a raiz com **2 filhos**; `splitChildren` manda exatamente 1 para cada lado, então cada grupo `sameSide` tem 1 nó e o loop de comparação de sobreposição (linha 183) **nunca executa** — não assere nada. O próprio comentário (linhas 171-172) admite que forçar 2 nós no mesmo lado "não é trivial via API pública".
- Cobertura faltante: o caso real que importa — irmãos de **alturas diferentes no mesmo lado** sem sobreposição vertical (o que o flextree deve garantir, M8-03) — fica descoberto.
- Severity: Low — a matemática está correta (verificada manualmente + por reviewer independente); é lacuna de teste, não bug.
- Fix: usar 3+ filhos para garantir ≥2 do mesmo lado, ou expor `computeTreeLayout` com split injetável. Candidato a quick task.

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

## Tech Debt

~~**Helper `request<T>` duplicado entre módulos de API web:**~~ — resolvido: extraído para `packages/web/src/api/_request.ts`.

~~**Verificação anti-ciclo redundante no `move`:**~~ — resolvido: guard `if (newParentId === id)` removido; CTE recursivo já cobre.

~~**Código morto `allNodeIds`:**~~ — resolvido em Q-004.

~~**`persistence.spec.ts` tem mudanças não commitadas (teste de move node):**~~ — resolvido em Q-006 (commit `ad520ec`).

## Dependencies at Risk

~~**`@xyflow/react` com `hideAttribution: true` exige licença paga:**~~ — resolvido: `proOptions` removido, atribuição visível.

---

_Concerns audit: 2026-05-20 (M5 review)_
