# Codebase Concerns

**Analysis Date:** 2026-05-19

Catalogado a partir da review pós-M3. Atualizar à medida que itens forem resolvidos ou novos forem descobertos.

## Known Bugs

~~**Root ("Central") não é renomeável via UI (relato do usuário):**~~ — resolvido em Q-003: clique no texto do nó dispara edição via `onStartEdit`, sem depender de `onNodeDoubleClick`.

~~**Lint quebra Success Criteria de M3:**~~ — resolvido em Q-001.

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

## Tech Debt

~~**Helper `request<T>` duplicado entre módulos de API web:**~~ — resolvido: extraído para `packages/web/src/api/_request.ts`.

~~**Verificação anti-ciclo redundante no `move`:**~~ — resolvido: guard `if (newParentId === id)` removido; CTE recursivo já cobre.

~~**Código morto `allNodeIds`:**~~ — resolvido em Q-004.

## Dependencies at Risk

~~**`@xyflow/react` com `hideAttribution: true` exige licença paga:**~~ — resolvido: `proOptions` removido, atribuição visível.

---

_Concerns audit: 2026-05-19_
