# Codebase Concerns

**Analysis Date:** 2026-05-18

Catalogado a partir da review pós-M3. Atualizar à medida que itens forem resolvidos ou novos forem descobertos.

## Known Bugs

**Root ("Central") não é renomeável via UI (relato do usuário):**

- Symptoms: Usuário não consegue renomear o nó central pela UI.
- Trigger: Não confirmado. Único trigger de rename é duplo-clique no nó, sem affordance visível (diferente de "+" e "×", que viraram botões fixos no commit `92a4c0e`).
- Files: `packages/web/src/components/canvas/MindNode.tsx:58` (handler de dblclick), `packages/web/src/components/canvas/MindNode.tsx:83` (input com `defaultValue`), `packages/web/src/components/canvas/MapCanvas.tsx:158-162` (sync de estado, ver Fragile Areas).
- Workaround: `PATCH /api/nodes/:id` direto via API funciona — código não bloqueia rename do root.
- Root cause: Duas hipóteses, precisam repro em browser:
  1. **Affordance:** usuário não sabe que duplo-clique edita.
  2. **Re-mount silencioso:** o sync `setNodes(rfNodes)` (ver Fragile Areas) re-monta o MindNode durante a edição, recriando o input com `defaultValue=node.title` e perdendo o que foi digitado.
- Blocked by: Reprodução em browser com DevTools (verificar se o dblclick dispara `setEditingId`, se o input aparece, se mantém foco/valor durante digitação).

**Lint quebra Success Criteria de M3:**

- Symptoms: `pnpm lint` retorna exit 1.
- Trigger: `pnpm lint` ou `pnpm -r run lint`.
- Files:
  - `packages/web/src/lib/useLayoutedTree.ts:52` — erro `react-hooks/set-state-in-effect` (`setWorkerPositioned(null)` síncrono em effect body).
  - `packages/web/src/components/canvas/MapCanvas.tsx:102` — warning `allNodeIds` não usado.
  - `packages/web/src/components/canvas/MapCanvas.tsx:144` — warning `useMemo` omite handlers das deps (`handleAddChild`, `handleCancelEdit`, `handleDelete`, `handleStartEdit`, `handleSubmitEdit`, `handleToggleCollapse`).
  - `packages/web/src/lib/tree.test.ts:74` — warning `edges` não usado.
- Workaround: Nenhum.
- Root cause: Implementação aceita pelo executor sem rodar `pnpm lint` antes de marcar tasks como done.
- Blocked by: Decidir entre derivar o reset do worker via `useMemo`/key, mover para handler vs aceitar regra com `// eslint-disable-next-line` justificado. Detalhes técnicos: o reset existe para invalidar resultado obsoleto do worker quando inputs mudam.

## Fragile Areas

**Sincronização entre `rfNodes` derivado e `useNodesState` do React Flow:**

- Files: `packages/web/src/components/canvas/MapCanvas.tsx:158-162`
- Why fragile: Há dois "donos" do mesmo estado — o estado interno de `useNodesState` e o `rfNodes` memoizado. Um `useEffect` força `setNodes(rfNodes)` toda vez que `rfNodes` muda (que é toda vez que `editingId`, `collapsedIds`, `data` ou `positioned` mudam). Cada sync pode interferir com o que o React Flow está fazendo internamente (drag em andamento, foco no input do MindNode, seleção).
- Common failures: Os 4 commits `fix(web): ...` recentes (`b0f1c85`, `92a4c0e`, `8df0e6a`, `6967671`) giram em torno desse padrão. Antes do `8df0e6a` o canvas nem refletia o resultado do worker. Forte candidato à co-causa do "root não edita".
- Safe modification: Trocar por modo controlado — passar `nodes={rfNodes}` direto sem `useNodesState`, capturando drag intermediário num `useRef`. Ou usar `useNodesState` como única fonte de verdade e aplicar mudanças derivadas (`editingId`, `collapsedIds`) via `setNodes(prev => ...)` em vez de reatribuição.
- Test coverage: Nenhum — UI interativa não tem testes (AD-007). Regressões só aparecem em uso manual.

**Input de rename inline usa `defaultValue` (uncontrolled):**

- Files: `packages/web/src/components/canvas/MindNode.tsx:83`
- Why fragile: Se o MindNode re-monta durante a edição (provável durante o sync acima), o input recria com `defaultValue=node.title` e o que o usuário digitou é perdido silenciosamente.
- Common failures: Provável co-causa de "root não edita".
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

**Helper `request<T>` duplicado entre módulos de API web:**

- Issue: Função `request<T>` aparece em `packages/web/src/api/nodes.ts:11-19` e em `packages/web/src/api/maps.ts` com a mesma implementação.
- Why: `tasks.md` de M3 deu a opção "extrair para `_request.ts` ou redeclarar"; foi escolhido redeclarar para reduzir blast radius da task T8.
- Impact: Próximas mutations (de Node ou outra entidade) tendem a duplicar de novo. Mudança no contrato de erro força edição em N lugares.
- Fix approach: Extrair para `packages/web/src/api/_request.ts` e reimportar em ambos os módulos.

**Verificação anti-ciclo redundante no `move`:**

- Issue: `if (newParentId === id) throw new ApiError(400, '...')` é coberto pelo CTE recursivo logo abaixo (o id é seu próprio descendente no anchor do CTE).
- Files: `packages/api/src/routes/nodes.ts:95-97`
- Impact: Código morto, confunde leitura.
- Fix approach: Remover o `if` e deixar só o CTE.

**Código morto `allNodeIds`:**

- Issue: `allNodeIds` é calculado num `useMemo` e nunca lido.
- Files: `packages/web/src/components/canvas/MapCanvas.tsx:102-105`
- Why: Sobra de plano de pré-validar drop client-side (que ficou para o backend).
- Impact: Warning de ESLint; ruído de leitura.
- Fix approach: Remover.

## Dependencies at Risk

**`@xyflow/react` com `hideAttribution: true` exige licença paga:**

- Risk: Os termos de uso do React Flow (versão MIT) exigem assinatura React Flow Pro para esconder a atribuição. `proOptions={{ hideAttribution: true }}` em `packages/web/src/components/canvas/MapCanvas.tsx:238` viola os termos se houver deploy comercial/público.
- Impact: Para ferramenta single-user privada provavelmente irrelevante. Qualquer publicação online é problema de licença.
- Migration plan: (a) manter atribuição visível, (b) assinar React Flow Pro, ou (c) trocar de lib. Decisão registrada como Todo no STATE.md.

---

_Concerns audit: 2026-05-18_
