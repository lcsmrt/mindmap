# Codebase Concerns

**Analysis Date:** 2026-05-19 · **Última limpeza:** 2026-07-05

Só concerns **abertos**. Itens resolvidos foram removidos — o histórico de como cada um foi corrigido está no git e nas ADs/Lessons de `STATE.md`.

## Known Bugs

**Rename com Enter sob falha de API pode disparar o `PATCH` duas vezes (2 toasts) — flaky (descoberto no e2e do M19, 2026-07-04):** `persistence.spec.ts` ("toast de erro aparece e estado reverte quando API falha") falha intermitentemente com `strict mode violation: locator('[role="alert"]') resolved to 2 elements`. Causa provável (`MindNode.tsx`/`useNodeEditing.ts`): `handleKeyDown` no Enter chama `commit()`→`onSubmitEdit(value)`→`setEditingId(null)`, que desmonta o `<input>`; se o desmonte disparar o `blur` nativo antes de sumir da árvore, `onBlur={commit}` roda de novo → 2ª mutação `PATCH` → 2 toasts quando a API falha. Não é causado pelo M19 (confirmado por diff byte-a-byte contra `aa15970`). Severity: Low/Medium (só com API falhando). Candidato a guard (`isSubmittedRef` / desabilitar `onBlur` após o Enter).

**Zoom por pinça no trackpad sempre dá zoom out (Linux, 2026-07-04):** abrindo ou fechando a pinça, o canvas sempre afasta. Provável: no Linux a pinça chega como `wheel + ctrlKey`, sintetizada pelo `@use-gesture` como pinça; o `defaultPinchDelta` do visx decide a direção por `offset − lastOffset`, que nesse caminho sintético não acompanha → trava em `0.9`. **Tentativa 1 (não resolveu):** `pinchDelta` custom por `direction` — usuário confirmou que continuou zoom out. **Próximo passo:** ignorar o caminho de pinça e tratar `ctrl+wheel` pelo `wheelDelta` (scroll de dois dedos zooma certo). Workaround atual: usar scroll de dois dedos. Sem cobertura de teste.

## Test Gaps

**Card-fantasma (M9): o e2e usa `toBeVisible()`, que não valida tamanho nem oclusão** (`packages/web/e2e/drag-to-place.spec.ts`) — o bug do placeholder cortado/atrás dos cards (sem `zIndex`) passou pelo e2e; só smoke visual o pega. A cobertura visual do fantasma depende de smoke manual. Severity: Low.

**Smoke M12: `lineCount` assume `line-height` em px** (`packages/web/e2e/smoke-visual.spec.ts`) — `parseFloat(getComputedStyle(el).lineHeight)` vira `NaN` (asserção quebra em silêncio) se a tipografia virar `line-height: normal`. Robusto hoje (`text-sm` = 20px). Severity: Low.

**Slot co-coluna (M13): smoke visual no app ainda não confirmado** — o fix lexicográfico (AD-021 addendum / L-006) tem cobertura unit (sintético + layout real), mas o caso inter-grupo co-coluna nunca foi confirmado por smoke visual no app rodando (dependia do túnel Postgres). Severity: Low.

## Performance Bottlenecks

**Layout síncrono no main thread — RNF-01 (500 nós) nunca validado:** `computeTreeLayout` (d3-flextree) roda síncrono em `useMemo` a cada mudança de `nodes`. Para mindmap pessoal (≤ ~30 nós) imperceptível; a 500 nós (RNF-01) pode travar pan/zoom/drag — **nunca medido**. O worker de layout (elkjs) que a AD-009 previa foi removido no M7. Files: `packages/web/src/pages/map/lib/useTreeLayout.ts`. Rodar o Gate de qualidade v1 antes de declarar v1. Severity: latente.

## UX Inconsistencies

**`NodeEditDialog` persiste cada campo no clique; a AC M10-21 ("cancelar/fechar descarta") não é literalmente cumprida (review AD-013 de M10):**

- Files: `packages/web/src/pages/map/components/NodeEditDialog.tsx`
- Cor/status/criticidade chamam `onUpdateNode` no clique (optimistic); título/responsável no blur/Enter. Não há Confirmar/Descartar — fechar o dialog **não** desfaz nada. A spec (M10-21) diz "cancela/fecha → descartar", mas a traceability marca "Verified".
- **Por design, não é regressão** (o dialog pré-M10 já persistia por campo; o estado-espelho local serve só ao preview). Severity: Low — discrepância spec vs. implementação.
- Fix: alinhar a spec à realidade **ou** bufferizar edições e só persistir no Confirmar (decisão de produto).

**Inline edit ignora `textColor` customizado:**

- Files: `packages/web/src/pages/map/components/MindNode.tsx`
- Quando um nó tem `textColor` customizado e o usuário inicia edição inline, o `<Input>` tem `text-foreground`, que sobrescreve a cor herdada → o texto aparece na cor do tema, não na customizada.
- Severity: Low/Cosmetic (edição é transiente; spec cobre render no canvas, não estado de edição). Fix: remover `text-foreground` do Input de edição ou aplicar `style={{ color: node.textColor ?? undefined }}`.

## Test Infrastructure

**E2E/dev compartilham banco; isolamento estrutural pendente (histórico: M6 → L-007 → M19):**

- **Estado atual:** `packages/api/.env` local (gitignored) aponta para **`dev_mindmap`** (não mais `mindmap`/prod). Tanto `pnpm dev` quanto o `webServer` do Playwright leem esse `.env` → **nenhum toca produção** (prod `mindmap` fica só com o app deployado, via env do Portainer). O vitest da API força `.env.test` → também `dev_mindmap`.
- **⚠️ Armadilha latente:** o isolamento é por **convenção do `.env`, não estrutural**. Se alguém repontar `.env` para `mindmap` e rodar `pnpm dev`/`pnpm test:e2e`, escreve direto em **produção** (mesmo Postgres da VPS via túnel SSH).
- **Residuais abertos:** (a) dev e teste partilham `dev_mindmap`, então `pnpm test` (`deleteMany`) limpa os dados do `pnpm dev`; (b) dev/e2e ainda dependem do **túnel SSH** (`dev_mindmap` mora na VPS). **Estrutural adiado pelo usuário** ("pipeline pra dev mais pra frente"): Postgres local (Docker) para dev + banco de teste dedicado. Ver Deferred Ideas em `STATE.md`.
- **Fixture e2e acumulativo (M19):** a guarda de auth (M18) fez cada sessão ver só os próprios mapas; `e2e/auth.setup.ts` (globalSetup) autentica um usuário fixo (`e2e-m19@mindmap.test`) + salva `storageState` (gitignored) e semeia um mapa + 2º nó fixo na 1ª vez (specs pré-existentes assumem `nth(1)`). Fica acumulativo até o banco de teste dedicado existir.

## Tech Debt

**401 global só cobre `useQuery`, não `useMutation` (M20, 2026-07-05):**

- Files: `packages/web/src/main.tsx` (`QueryCache.onError`)
- O handler que zera `['auth','me']` em qualquer 401 (derrubando `RequireAuth`) está no `QueryCache`, que só observa queries. Mutations (`useUpdateProfile`, `api/nodes.ts`) não passam por ali. Se a sessão expira **durante** uma mutation, a guarda só reage na próxima query. Pré-existente desde o M19.
- **Recomendação:** configurar um `MutationCache` global espelhando a lógica do `QueryCache.onError`. Severity: Low (janela estreita).

**Cookie de sessão sem `Secure` em prod HTTP (M18, 2026-07-04):**

- Files: `packages/api/src/env.ts` (`COOKIE_SECURE`), `packages/api/src/plugins/auth-guard.ts`
- Prod é `http://72.60.1.97:8080` (AD-022, sem TLS). `Secure` é gated por env (default `false`) porque um cookie `Secure` não trafega sobre HTTP puro → o token de sessão trafega **em claro**.
- **Recomendação:** provisionar TLS (domínio + certificado) e setar `COOKIE_SECURE=true` em prod. CSRF já coberto por `SameSite=Lax`. Severity: Medium (segredo em trânsito sem TLS).

**`<Zoom>` render-prop do visx exige `eslint-disable react-hooks/refs` em `CanvasLayers` (M17, 2026-07-03):**

- Files: `packages/web/src/pages/map/components/MapCanvas.tsx` (`CanvasLayers`)
- O visx guarda o estado de zoom em refs e entrega via render-prop; ler `zoom.transformMatrix`/`toString()`/`containerRef` no render viola `react-hooks/refs` v7 (5 erros sem o disable).
- Alternativa: migrar de `<Zoom>` (render-prop) para `useZoom()` (hook), subindo o estado de zoom para `MapCanvasInner`. Severity: Low. Candidato a refactor isolado.

**`move` para a raiz sem `side` assume `RIGHT` (review AD-013 de M9, 2026-06-27):**

- Files: `packages/api/src/routes/nodes.ts`
- Salvaguarda que pode flipar silenciosamente um nó `LEFT` se um cliente futuro omitir `side` num `move` cujo destino é a raiz. Hoje **inalcançável** (o frontend sempre envia `side`). Severity: Low (latente). Considerar exigir `side` quando `newParentId` é a raiz.

**Doc drift: `design.md` do M15 descreve a alça via callbacks que não existem (review AD-013 de M15, 2026-07-02):**

- Files: `.specs/features/m15-card-resize/design.md` vs `MapCanvas.tsx`/`MindNode.tsx`/`types.ts`
- O design especifica a alça com `onResizeStart` + callbacks em `MindNodeData`; a implementação real detecta o resize no wrapper via `closest('[data-testid="resize-handle"]')` — a alça é um `<div>` puro e `types.ts` não tem esses callbacks (é a abordagem escolhida, não resíduo). Satisfaz M15-03 mas diverge do doc. Severity: cosmético — alinhar o design ao código.

## Design Notes

**`useMeasuredHeights` — por que o effect re-observa todos os elementos no setup (resiliência ao StrictMode):**

- Files: `packages/web/src/pages/map/components/useMeasuredHeights.ts` (`useEffect`)
- A cada (re)mount, o effect cria um novo `ResizeObserver` **e re-observa todos os elementos já registrados** (iterando `elements.current`). Sem isso, o observer criado no commit inicial seria desconectado pelo cleanup do double-invoke do StrictMode, e os ref callbacks (que rodam só uma vez no commit) nunca recriariam o observer → alturas sem medição ao reabrir um mapa cacheado. O pattern "effect é dono do observer + re-observa no setup" é a invariante que garante a convergência do pipeline medir→layout no StrictMode.

## Dependencies at Risk

*(nenhuma no momento)*
