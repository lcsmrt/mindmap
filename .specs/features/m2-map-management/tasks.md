# M2 — Gerenciamento de Mapas: Tasks

**Spec:** [`spec.md`](./spec.md)
**Status:** Complete (T1–T9 done, 2026-05-18)

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro:

- `.specs/project/PROJECT.md` — stack, escopo de v1, constraints
- `.specs/project/STATE.md` — decisões arquiteturais (AD-001 a AD-007)
- `.specs/features/m2-map-management/spec.md` — requisitos com IDs `M2-NN`
- Este arquivo

**Princípios não-negociáveis:**

- TypeScript strict em todos os pacotes (`strict: true`, `noUncheckedIndexedAccess: true`)
- Sem `any` implícito; `any` explícito só com comentário justificando
- Commits atômicos: um por task, mensagem em **português** seguindo Conventional Commits — `feat(m2): T<N> <descrição>` (ou `chore(m2):` para scaffold/config)
- Idioma: identificadores e código em **inglês**; commits, comentários e docs em **português**

**Convenções herdadas de M1:**

- Estrutura: `packages/web`, `packages/api`, `packages/shared` (pnpm workspaces)
- Portas dev: api `3000`, web `5173`
- Web chama api via proxy do Vite (`/api/*` → `http://localhost:3000/*`)
- Prisma schema já inclui Map e Node completos — **sem novas migrations em M2**
- Postura de testes: Vitest unit em código com lógica (handlers com branching, funções puras); UI declarativa e configs sem testes; verificação manual de integração (AD-007)

---

## Execution Plan

```
Phase 1 (sequential — shared types):
  T1

Phase 2 (sequential — API):
  T1 → T2 → T3

Phase 3 (parallel — web foundation + API tests):
       ┌─→ T4 [P] (unit tests da API)
  T3 ──┤
       └─→ T5 [P] (router + layout web)

Phase 4 (sequential — UI):
  T5 → T6 → T7 → T8

Phase 5 (sequential — canvas placeholder):
  T5, T2 → T9
```

---

## Task Breakdown

### T1: Tipos compartilhados para Map API

**What:** Define os tipos do contrato de API de mapas em `@mindmap/shared`.
**Where:**

- `packages/shared/src/map.ts` (novo)
- `packages/shared/src/index.ts` (reexport)

**Depends on:** Nenhum (M1 completo)
**Reuses:** Padrão de `health.ts` em shared
**Requirement:** Suporte a M2-01 a M2-17 (contrato tipado)

**Conteúdo esperado:**

```ts
// packages/shared/src/map.ts

export interface MapSummary {
  id: string;
  title: string;
  updatedAt: string; // ISO 8601
}

export interface MapDetail {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface MapListResponse {
  maps: MapSummary[];
}

export interface CreateMapBody {
  title: string;
}

export interface UpdateMapBody {
  title: string;
}
```

Reexport em `index.ts`: `export * from './map.js';`

**Tools:** Built-in.

**Done when:**

- [x] Arquivos existem.
- [x] `pnpm --filter @mindmap/shared build` gera `dist/map.js` e `dist/map.d.ts`.
- [x] `import { MapSummary, CreateMapBody } from '@mindmap/shared'` compila sem erro nos pacotes api e web.

**Tests:** none (tipos)
**Gate:** `pnpm --filter @mindmap/shared build && pnpm typecheck` exit 0 ✅

**Commit:** pendente (agrupar com T2 ou commitar separado no próximo chat)

---

### T2: Endpoints CRUD de Map na API

**What:** Implementa os 5 endpoints REST para Map (list, get, create, update, delete) com validação.
**Where:**

- `packages/api/src/routes/maps.ts` (novo)
- `packages/api/src/app.ts` (modificar — registrar rotas)

**Depends on:** T1
**Reuses:** `prisma` singleton de `./prisma.ts`; tipos de `@mindmap/shared`
**Requirement:** M2-01, M2-05, M2-06, M2-09, M2-12, M2-17

**Comportamento detalhado:**

1. **GET `/maps`** — Retorna todos os mapas ordenados por `updatedAt` desc. Responde `MapListResponse`.
2. **GET `/maps/:id`** — Retorna um mapa por id. 404 se não encontrado.
3. **POST `/maps`** — Recebe `CreateMapBody`. Valida `title` não-vazio (trim). Cria Map + Node raiz ("Central") em transação. Retorna `MapDetail` com status 201.
4. **PATCH `/maps/:id`** — Recebe `UpdateMapBody`. Valida `title` não-vazio (trim). Atualiza título. 404 se não encontrado. Retorna `MapDetail`.
5. **DELETE `/maps/:id`** — Deleta mapa (cascade remove nós). 204 sem body. 404 se não encontrado.

**Validação:**
- Title: `body.title?.trim()` — se vazio ou undefined, retorna 400 com `{ error: "Title is required" }`.
- ID não encontrado: retorna 404 com `{ error: "Map not found" }`.

**Tools:** Built-in.

**Done when:**

- [ ] `packages/api/src/routes/maps.ts` exporta um plugin Fastify com as 5 rotas.
- [ ] `app.ts` registra o plugin com prefix `/maps`.
- [ ] Todos os handlers usam tipos de `@mindmap/shared`.
- [ ] `pnpm --filter @mindmap/api typecheck` passa.
- [ ] Smoke test manual:
  - `curl -X POST http://localhost:3000/maps -H 'Content-Type: application/json' -d '{"title":"Test"}' | jq` → 201 com id, title, timestamps.
  - `curl http://localhost:3000/maps | jq` → lista com o mapa criado.
  - `curl -X PATCH http://localhost:3000/maps/<id> -H 'Content-Type: application/json' -d '{"title":"Renamed"}' | jq` → 200.
  - `curl -X DELETE http://localhost:3000/maps/<id> -w '%{http_code}'` → 204.
  - `curl http://localhost:3000/maps/<id> -w '%{http_code}'` → 404.

**Tests:** unit (em T4)
**Gate:** typecheck + smoke manual dos 5 endpoints

**Commit:** `feat(m2): T2 endpoints CRUD de mapas`

---

### T3: Validação de edge cases na API

**What:** Garante robustez nos endpoints: double-delete retorna 404, título com XSS é armazenado como texto plano, título vazio/whitespace rejeita.
**Where:**

- `packages/api/src/routes/maps.ts` (ajuste se necessário; maior parte já coberta em T2)

**Depends on:** T2
**Reuses:** N/A
**Requirement:** M2-07, M2-10, edge cases do spec

**Comportamento:**

- POST/PATCH com `title: "   "` (só espaços) → 400.
- POST/PATCH com `title: "<script>alert(1)</script>"` → 201/200, título armazenado literalmente (sem sanitização — React escapa no render).
- DELETE de id inexistente → 404 (idempotente sem efeito colateral).
- DELETE chamado duas vezes para o mesmo id → primeiro 204, segundo 404.

**Nota:** Se T2 já cobre tudo isso corretamente, esta task verifica e adiciona qualquer ajuste residual. A task existe para garantir cobertura explícita dos edge cases.

**Tools:** Built-in.

**Done when:**

- [ ] Todos os edge cases acima passam em smoke test manual.
- [ ] Nenhum trim/sanitize além do `title.trim()` é feito (React cuida de XSS no render).
- [ ] `pnpm --filter @mindmap/api typecheck` passa.

**Tests:** cobertos em T4
**Gate:** smoke manual + typecheck

**Commit:** `feat(m2): T3 robustez de edge cases na API de mapas`

---

### T4 [P]: Unit tests dos endpoints de Map

**What:** Testes Vitest para os endpoints de Map cobrindo happy path e edge cases.
**Where:**

- `packages/api/src/routes/maps.test.ts` (novo)

**Depends on:** T3 (conteúdo pronto); pode rodar em paralelo com T5 na execução
**Reuses:** `buildApp()` de `app.ts`; Fastify `inject`
**Requirement:** M2-01 a M2-12 (verificação automatizada)

**Cenários:**

1. GET `/maps` — retorna lista vazia inicialmente.
2. POST `/maps` com título válido → 201, body correto, nó raiz criado.
3. POST `/maps` com título vazio → 400.
4. POST `/maps` com título whitespace-only → 400.
5. GET `/maps/:id` existente → 200.
6. GET `/maps/:id` inexistente → 404.
7. PATCH `/maps/:id` com título válido → 200, título atualizado.
8. PATCH `/maps/:id` com título vazio → 400.
9. PATCH `/maps/:id` inexistente → 404.
10. DELETE `/maps/:id` existente → 204.
11. DELETE `/maps/:id` inexistente → 404.
12. GET `/maps` após create → lista ordenada por updatedAt desc.

**Nota sobre DB em testes:** Os testes usam o banco real (`DATABASE_URL`). Cada suite limpa os dados de Map/Node em `beforeEach` ou usa IDs únicos. Decisão pragmática: unit tests com Fastify `inject` contra DB real são baratos e confiáveis para CRUD simples. Se futuramente ficar pesado, migrar para test DB dedicado.

**Tools:** Built-in.

**Done when:**

- [ ] Arquivo de teste existe com os 12 cenários.
- [ ] `pnpm --filter @mindmap/api test` roda e todos passam.
- [ ] Nenhum `.skip` ou `.todo`.

**Tests:** unit (é o próprio teste)
**Gate:** `pnpm --filter @mindmap/api test` exit 0 com 12+ passes

**Commit:** `test(m2): T4 testes unitários dos endpoints de mapas`

---

### T5 [P]: Router e layout base do web

**What:** Instala React Router, cria layout base com rotas `/` (home) e `/maps/:id` (canvas placeholder), e estrutura de pastas para páginas.
**Where:**

- `packages/web/package.json` (adicionar `react-router-dom`)
- `packages/web/src/main.tsx` (modificar — wrap com BrowserRouter)
- `packages/web/src/App.tsx` (modificar — vira router outlet)
- `packages/web/src/pages/HomePage.tsx` (novo — placeholder)
- `packages/web/src/pages/MapPage.tsx` (novo — placeholder)

**Depends on:** M1 completo (T5 do M1)
**Reuses:** N/A
**Requirement:** M2-14, M2-16

**Conteúdo esperado:**

- `App.tsx`: define `<Routes>` com `<Route path="/" element={<HomePage />} />` e `<Route path="/maps/:id" element={<MapPage />} />`.
- `HomePage.tsx`: renderiza `<h1>Meus Mapas</h1>` (placeholder — UI real em T6).
- `MapPage.tsx`: renderiza `<h1>Canvas</h1><p>Map ID: {id}</p><Link to="/">Voltar</Link>` (placeholder — UI real em T9).
- `main.tsx`: wraps `<App />` com `<BrowserRouter>`.

**Tools:** Built-in + Bash (pnpm add).

**Done when:**

- [ ] `react-router-dom` instalado.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.
- [ ] Navegar para `http://localhost:5173` mostra "Meus Mapas".
- [ ] Navegar para `http://localhost:5173/maps/abc` mostra "Canvas" com ID "abc" e link "Voltar".
- [ ] Clicar "Voltar" retorna a `/`.

**Tests:** none (UI declarativa)
**Gate:** typecheck + smoke manual de navegação

**Commit:** `feat(m2): T5 setup do react-router com placeholders de páginas`

---

### T6: Home page — lista de mapas

**What:** Implementa a HomePage real: fetch da lista de mapas, renderização, estados loading/empty/error.
**Where:**

- `packages/web/src/pages/HomePage.tsx` (substituir placeholder)
- `packages/web/src/api/maps.ts` (novo — funções fetch tipadas)

**Depends on:** T5, T2 (API precisa estar rodando para smoke test)
**Reuses:** Tipos de `@mindmap/shared`; proxy do Vite
**Requirement:** M2-01, M2-02, M2-03, M2-14

**Comportamento:**

- No mount, faz `GET /api/maps`.
- Loading: indicador simples (texto "Carregando…").
- Sucesso com mapas: renderiza lista com título e data formatada (ex: "17 mai 2026"). Cada item é clicável e navega para `/maps/:id`.
- Sucesso sem mapas: estado vazio com texto "Nenhum mapa encontrado" + botão "Criar primeiro mapa".
- Erro: mensagem "Erro ao carregar mapas".

**`api/maps.ts`** — módulo com funções tipadas:

```ts
export async function listMaps(): Promise<MapListResponse> { ... }
export async function createMap(body: CreateMapBody): Promise<MapDetail> { ... }
export async function updateMap(id: string, body: UpdateMapBody): Promise<MapDetail> { ... }
export async function deleteMap(id: string): Promise<void> { ... }
export async function getMap(id: string): Promise<MapDetail> { ... }
```

Todas fazem fetch para `/api/maps*`, checam `response.ok`, e fazem throw se não ok.

**Tools:** Built-in.

**Done when:**

- [ ] `HomePage.tsx` busca e renderiza lista de mapas.
- [ ] `api/maps.ts` exporta funções tipadas para todos os endpoints.
- [ ] Estado vazio exibe CTA.
- [ ] Erro de rede exibe mensagem.
- [ ] Clicar num mapa navega para `/maps/:id`.
- [ ] Data formatada em pt-BR (usar `Intl.DateTimeFormat`).
- [ ] `pnpm --filter @mindmap/web typecheck` passa.

**Tests:** none (UI declarativa com fetch — AD-007)
**Gate:** typecheck + smoke manual (com API rodando)

**Commit:** `feat(m2): T6 página inicial com lista de mapas`

---

### T7: Home page — criar e renomear mapa

**What:** Adiciona funcionalidade de criar novo mapa e renomear mapa existente na HomePage.
**Where:**

- `packages/web/src/pages/HomePage.tsx` (modificar)
- `packages/web/src/components/CreateMapForm.tsx` (novo — input + botão)
- `packages/web/src/components/RenameMapInput.tsx` (novo — inline edit)

**Depends on:** T6
**Reuses:** `createMap`, `updateMap` de `api/maps.ts`
**Requirement:** M2-04, M2-05, M2-07, M2-08, M2-09, M2-10

**Comportamento — Criar:**

- Botão "Novo mapa" no topo da página revela um input inline (ou sempre visível — decisão de implementação).
- Usuário digita título e pressiona Enter ou clica "Criar".
- Validação client-side: título não-vazio após trim. Se vazio, mostra indicação visual (ex: borda vermelha, texto helper).
- Sucesso: mapa aparece no topo da lista (refetch ou optimistic add).
- Erro API: toast/mensagem inline "Erro ao criar mapa".

**Comportamento — Renomear:**

- Botão/ícone de editar ao lado do título do mapa (ou duplo-clique — decisão de implementação).
- Título vira input editável com o valor atual.
- Enter ou blur confirma. Escape cancela.
- Validação: título não-vazio após trim.
- Sucesso: título atualizado na lista.
- Erro API: reverte para título anterior + mensagem de erro.

**Tools:** Built-in.

**Done when:**

- [ ] Criar mapa funciona end-to-end (UI → API → lista atualizada).
- [ ] Validação client-side impede título vazio.
- [ ] Renomear mapa funciona inline.
- [ ] Escape cancela rename sem chamada à API.
- [ ] Erro de API exibe feedback sem crash.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.

**Tests:** none (UI interativa, validação manual — AD-007)
**Gate:** typecheck + smoke manual criando e renomeando mapas

**Commit:** `feat(m2): T7 UI de criar e renomear mapa`

---

### T8: Home page — excluir mapa com confirmação

**What:** Adiciona funcionalidade de excluir mapa com dialog de confirmação.
**Where:**

- `packages/web/src/pages/HomePage.tsx` (modificar)
- `packages/web/src/components/ConfirmDialog.tsx` (novo — componente reutilizável)

**Depends on:** T7 (lista completa com ações)
**Reuses:** `deleteMap` de `api/maps.ts`
**Requirement:** M2-11, M2-12, M2-13

**Comportamento:**

- Botão/ícone de excluir ao lado de cada mapa.
- Ao clicar, abre `ConfirmDialog` com:
  - Título: "Excluir mapa"
  - Mensagem: "Tem certeza? O mapa «{título}» e todos os seus nós serão removidos permanentemente."
  - Botões: "Cancelar" (secundário) e "Excluir" (destaque destrutivo — vermelho).
- Confirmar: chama `deleteMap(id)`, remove da lista, fecha dialog.
- Cancelar: fecha dialog sem ação.
- Erro API: mensagem "Erro ao excluir mapa", mantém item na lista.

**`ConfirmDialog`** — componente genérico (será reutilizado em M3 para delete de nó):

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}
```

Implementar com `<dialog>` nativo (HTML) ou um portal simples. Sem dependência de UI library.

**Tools:** Built-in.

**Done when:**

- [ ] Botão de excluir aparece em cada mapa da lista.
- [ ] Dialog de confirmação abre com mensagem correta.
- [ ] Confirmar remove o mapa e atualiza a lista.
- [ ] Cancelar fecha sem ação.
- [ ] Erro de API exibe feedback.
- [ ] `ConfirmDialog` é genérico e exportado para reuso.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.

**Tests:** none (UI interativa — AD-007)
**Gate:** typecheck + smoke manual de exclusão com confirmação

**Commit:** `feat(m2): T8 exclusão de mapa com dialog de confirmação`

---

### T9: Página do mapa (placeholder de canvas)

**What:** Implementa a MapPage real: busca dados do mapa, exibe título, área placeholder para o canvas (M3), tratamento de mapa não encontrado.
**Where:**

- `packages/web/src/pages/MapPage.tsx` (substituir placeholder)

**Depends on:** T5 (router), T2 (API GET /maps/:id)
**Reuses:** `getMap` de `api/maps.ts`; tipos de `@mindmap/shared`
**Requirement:** M2-15, M2-16, M2-17

**Comportamento:**

- No mount, faz `GET /api/maps/:id` usando o param da rota.
- Loading: "Carregando…".
- Sucesso: exibe título do mapa como `<h1>`, área placeholder (div com borda/fundo e texto "Canvas — em breve"), e link/botão "← Voltar para mapas" que navega para `/`.
- 404: exibe "Mapa não encontrado" com link "← Voltar para mapas".
- Erro genérico: exibe "Erro ao carregar mapa" com link de volta.

**Tools:** Built-in.

**Done when:**

- [ ] MapPage busca e exibe dados do mapa.
- [ ] Mapa inexistente mostra "não encontrado" com link de volta.
- [ ] Área placeholder visível indicando onde o canvas ficará.
- [ ] Link "Voltar" funciona.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.

**Tests:** none (UI declarativa — AD-007)
**Gate:** typecheck + smoke manual (mapa existente, mapa inexistente)

**Commit:** `feat(m2): T9 página do mapa com placeholder de canvas`

---

## Validações Pré-Aprovação

### Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | 2 arquivos (tipo + reexport) | ✅ |
| T2 | 2 arquivos (routes + register) | ✅ |
| T3 | 1 arquivo (ajustes em routes) | ✅ (pode ser no-op se T2 já cobre) |
| T4 | 1 arquivo de teste | ✅ |
| T5 | 5 arquivos (router setup) | ✅ (scaffold coeso) |
| T6 | 2 arquivos (page + api client) | ✅ |
| T7 | 3 arquivos (page + 2 components) | ✅ |
| T8 | 2 arquivos (page + ConfirmDialog) | ✅ |
| T9 | 1 arquivo (page) | ✅ |

### Diagram-Definition Cross-Check

| Task | Depends on (body) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | Nenhum | Phase 1 início | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 [P] | ✅ |
| T5 | M1 completo | T3 → T5 [P] (independente de T4) | ✅ |
| T6 | T5, T2 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T5, T2 | T5, T2 → T9 | ✅ |

Parallelism: T4/T5 não dependem entre si ✅. T9 pode rodar em paralelo com T6-T8 ✅.

### Test Co-location (AD-007)

| Task | Camada | Postura | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Tipos compartilhados | none | none | ✅ |
| T2 | Handlers com lógica | unit (em T4) | unit em T4 | ✅ |
| T3 | Edge case refinement | unit (em T4) | cobertos em T4 | ✅ |
| T4 | O próprio teste | unit | unit | ✅ |
| T5 | Router scaffold | none | none | ✅ |
| T6 | UI + fetch | none (AD-007) | none | ✅ |
| T7 | UI interativa | none (AD-007) | none | ✅ |
| T8 | UI interativa | none (AD-007) | none | ✅ |
| T9 | UI + fetch | none (AD-007) | none | ✅ |

---

## Resumo Final

- **9 tasks** (todas codificáveis).
- **1 fase paralela:** Phase 3 (T4/T5).
- **T9** pode rodar em paralelo com T6-T8 se desejado (depende só de T5 e T2).
- **Caminho crítico:** T1 → T2 → T3 → T5 → T6 → T7 → T8 (7 tasks sequenciais).
- **Commits planejados:** 9.
- **Dependência externa:** Túnel SSH + API rodando para smoke tests (já resolvido desde M1).
- **Próximo passo:** abrir um chat novo, apontar para este arquivo e executar a partir de T1.
