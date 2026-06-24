# Codebase Concerns

**Analysis Date:** 2026-05-19

Catalogado a partir da review pós-M3. Atualizar à medida que itens forem resolvidos ou novos forem descobertos.

## Known Bugs

~~**Root ("Central") não é renomeável via UI (relato do usuário):**~~ — resolvido em Q-003: clique no texto do nó dispara edição via `onStartEdit`, sem depender de `onNodeDoubleClick`.

~~**Lint quebra Success Criteria de M3:**~~ — resolvido em Q-001.

~~**`smoke.spec.ts:9` — teste de foco no inline edit falha consistentemente (pré-M5):**~~ — resolvido em Q-007: causa raiz era o componente `Input` (shadcn/ui Base UI) sem `forwardRef` — em React 18, o ref nunca chegava ao `<input>` nativo. Fix: `forwardRef` no Input + ref callback no MindNode com foco imediato + rAF + setTimeout(0) como fallback + `onMouseDown.stopPropagation` no span do título.

## Fragile Areas

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
- **Para o review AD-013 de M6:** validar este ponto e confirmar que nenhum dado de dev ficou inconsistente.

## Tech Debt

~~**Helper `request<T>` duplicado entre módulos de API web:**~~ — resolvido: extraído para `packages/web/src/api/_request.ts`.

~~**Verificação anti-ciclo redundante no `move`:**~~ — resolvido: guard `if (newParentId === id)` removido; CTE recursivo já cobre.

~~**Código morto `allNodeIds`:**~~ — resolvido em Q-004.

~~**`persistence.spec.ts` tem mudanças não commitadas (teste de move node):**~~ — resolvido em Q-006 (commit `ad520ec`).

## Dependencies at Risk

~~**`@xyflow/react` com `hideAttribution: true` exige licença paga:**~~ — resolvido: `proOptions` removido, atribuição visível.

---

_Concerns audit: 2026-05-20 (M5 review)_
