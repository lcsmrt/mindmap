# M3 — Canvas e Edição Estrutural: Tasks

**Spec:** [`spec.md`](./spec.md)
**Status:** Draft — pronto para execução em chat novo

---

## Contexto para o Executor

Este arquivo é auto-suficiente para um agente sem memória da conversa de planejamento. Leia primeiro, na ordem:

- `CLAUDE.md` (raiz) — regras do projeto (idioma, stack fixada, formato de commits)
- `.specs/project/PROJECT.md` — visão, stack, escopo de v1, constraints
- `.specs/project/STATE.md` — decisões arquiteturais (AD-001 a AD-007 + os novos de M3 — ver final deste arquivo)
- `.specs/features/m3-canvas-editing/spec.md` — requisitos com IDs `M3-NN`
- Este arquivo

**Princípios não-negociáveis:**

- TypeScript strict em todos os pacotes (`strict: true`, `noUncheckedIndexedAccess: true`)
- Sem `any` implícito; `any` explícito só com comentário justificando
- Commits atômicos: um por task, mensagem em **português** seguindo Conventional Commits — `feat(m3): T<N> <descrição>` (ou `chore(m3):` para scaffold/config, `test(m3):` para testes)
- Idioma: identificadores e código em **inglês**; commits, comentários e docs em **português**
- Não propor mudanças de stack — React + React Flow + TanStack Query + Tailwind v4 + shadcn/ui no frontend; Fastify + Prisma no backend

**Convenções herdadas de M1/M2 (importante — não reinventar):**

- Estrutura: `packages/web`, `packages/api`, `packages/shared` (pnpm workspaces)
- Portas dev: api `3000`, web `5173`
- Web chama api via proxy do Vite (`/api/*` → `http://localhost:3000/*`)
- Path alias web: `@/...` aponta para `packages/web/src/...`
- **Backend Fastify usa Zod via `fastify-type-provider-zod`** — todo handler com body/params deve declarar `schema: { body: ZodSchema, params: ZodSchema }`. O type provider deriva os tipos de `req.body`/`req.params` automaticamente. Padrão em `packages/api/src/routes/maps.ts`.
- **Erros customizados:** classes em `packages/api/src/errors.ts` (`ApiError`, `NotFoundError`, `ConflictError`). O handler global em `app.ts` traduz para status code + body `{ error }`. Reutilizar; adicionar nova classe (`ValidationError` retornando 400) se faltar.
- **Mappers:** funções puras em `packages/api/src/mappers/` que convertem Prisma model → DTO de `@mindmap/shared`. Já existe `maps.ts`; criar `nodes.ts`.
- **Prisma singleton:** `prisma` importado de `../prisma.js`.
- **Frontend TanStack Query:** padrão em `packages/web/src/api/maps.ts` — funções `fetch*` privadas + hooks `useX`/`useCreateX`/`useUpdateX`/`useDeleteX` exportados. Types de options em `./types.ts`. Toda mutation invalida queries relacionadas no `onSuccess`. Helper `request<T>` para fetch com error handling. Replicar para nodes em `packages/web/src/api/nodes.ts`.
- **Componentes UI:** shadcn/ui via Radix + Tailwind v4. Tokens semânticos (`text-foreground`, `bg-card`, `text-muted-foreground`, `text-destructive`, `bg-muted`, etc.). Já há `ConfirmDialog`, `CreateMapForm`, `RenameMapInput` reutilizáveis.
- **Testes API:** Vitest com `app.inject({...})`. Há dois padrões na base:
  - `app.test.ts` mocka `prisma` (`vi.mock('./prisma.js', ...)`) — bom para handlers puros.
  - `routes/maps.test.ts` (após T4 do M2) deve usar DB real — verificar abordagem ao executar T7. Para M3 (lógica transacional não-trivial), **usar DB real é fortemente recomendado** — mocks de transações Prisma são frágeis e não cobrem renumeração.
- **Postura de testes (AD-007):** unit em código com lógica não-trivial (handlers de Node, tree builder); UI declarativa/interativa sem testes; verificação manual de integração.

**Estado pós-M2:**

- Schema completo já tem Node com todos os campos. **Sem novas migrations em M3.**
- Endpoints de Map: `GET /maps`, `GET /maps/:id`, `POST /maps` (cria root automaticamente), `PATCH /maps/:id`, `DELETE /maps/:id`.
- `MapPage` renderiza placeholder "Canvas — em breve" — será substituído em T13.
- React Flow e elkjs ainda **não estão instalados**. T11/T12 instalam.

---

## Execution Plan

```
Phase 1 (sequential — shared types):
  T1

Phase 2 (sequential — API routes):
  T1 → T2 → T3 → T4 → T5 → T6

Phase 3 (parallel — tests API + web foundation):
       ┌─→ T7 [P] (testes unit das 5 rotas)
  T6 ──┤
       └─→ T8 [P] (hooks TanStack Query)

Phase 4 (sequential — layout pipeline):
  T8 → T9 → T10

Phase 5 (sequential — canvas core):
  T10 → T11 → T12 → T13

Phase 6 (sequential — interações estruturais):
  T13 → T14 → T15 → T16 → T17 → T18
```

---

## Task Breakdown

### T1: Tipos compartilhados de Node em `@mindmap/shared`

**What:** Define os contratos de Node API em `@mindmap/shared`.
**Where:**

- `packages/shared/src/node.ts` (novo)
- `packages/shared/src/index.ts` (adicionar reexport)

**Depends on:** Nenhum (M2 completo)
**Reuses:** Padrão de `health.ts` e `map.ts` em shared
**Requirement:** Suporte tipado a M3-01 a M3-30

**Conteúdo (literal — copiar do spec):**

```ts
// packages/shared/src/node.ts
export interface NodeDto {
  id: string;
  mapId: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  bgColor: string | null;
  textColor: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | null;
  assignee: string | null;
  isCritical: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NodeListResponse {
  nodes: NodeDto[];
}

export interface CreateNodeBody {
  mapId: string;
  parentId: string;
  title: string;
}

export interface UpdateNodeBody {
  title: string;
}

export interface MoveNodeBody {
  parentId: string;
  index: number;
}
```

Em `index.ts`: `export * from './node.js';`

**Done when:**

- [ ] Arquivos existem com tipos do bloco acima.
- [ ] `pnpm --filter @mindmap/shared build` gera `dist/node.js` e `dist/node.d.ts`.
- [ ] `import { NodeDto, CreateNodeBody, MoveNodeBody } from '@mindmap/shared'` compila em api e web.

**Tests:** none (tipos)
**Gate:** `pnpm --filter @mindmap/shared build && pnpm typecheck` exit 0

**Commit:** `feat(m3): T1 tipos compartilhados de Node`

---

### T2: Mapper de Node + rota `GET /maps/:id/nodes`

**What:** Mapper Prisma→DTO para Node e endpoint que retorna a lista plana de nós de um mapa.
**Where:**

- `packages/api/src/mappers/nodes.ts` (novo)
- `packages/api/src/routes/nodes.ts` (novo — esqueleto do plugin com `GET '/'`)
- `packages/api/src/routes/maps.ts` (adicionar `GET '/:id/nodes'`)
- `packages/api/src/app.ts` (registrar `nodesPlugin` com prefixo `/nodes`)

**Depends on:** T1
**Reuses:** `prisma` singleton, `NotFoundError`, mapper pattern de `maps.ts`, FastifyPluginAsyncZod de `routes/maps.ts`
**Requirement:** M3-01, M3-06

**Detalhes:**

- `mappers/nodes.ts` exporta `toNodeDto(node: Node): NodeDto` — usa `toISOString()` para datas; `bgColor`/`textColor`/`status`/`assignee` mantém null se null no DB.
- Endpoint `GET /maps/:id/nodes` (registrado dentro de `mapsPlugin`):
  - Valida que o map existe (`findUnique`) — se não, `NotFoundError('Map not found')`.
  - Retorna `{ nodes: nodes.map(toNodeDto) }` ordenado por `(parentId NULLS FIRST, sortOrder asc)` — root primeiro, depois irmãos ordenados.
  - Use `prisma.node.findMany({ where: { mapId }, orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }] })`.
- `routes/nodes.ts` cria o plugin vazio (apenas o esqueleto e export default) — as rotas POST/PATCH/DELETE/move entram em T3-T6.
- Registrar `nodesPlugin` em `app.ts`: `app.register(nodesPlugin, { prefix: '/nodes' });`.

**Done when:**

- [ ] `toNodeDto` retorna shape exato de `NodeDto` (verificar com type-check do retorno).
- [ ] `GET /maps/:id/nodes` retorna lista ordenada.
- [ ] `GET /maps/<inexistente>/nodes` retorna 404.
- [ ] Smoke manual: criar mapa via API (M2 já cria root); `curl http://localhost:3000/maps/<id>/nodes | jq` retorna `{ nodes: [{...root}] }`.
- [ ] `pnpm --filter @mindmap/api typecheck` passa.

**Tests:** cobertos em T7
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T2 mapper de Node e listagem de nós do mapa`

---

### T3: `POST /nodes` — criar nó filho

**What:** Cria nó com `mapId`, `parentId`, `title`. `sortOrder` calculado server-side como `max(sortOrder dos irmãos) + 1`.
**Where:** `packages/api/src/routes/nodes.ts` (adicionar `app.post('/', ...)`)

**Depends on:** T2
**Reuses:** `prisma`, `NotFoundError`, `toNodeDto`, `ApiError` (para criar `ValidationError` se faltar)
**Requirement:** M3-07

**Comportamento:**

- Body Zod: `z.object({ mapId: z.string(), parentId: z.string(), title: z.string().trim().min(1) })`.
- Em transação:
  1. Verifica que `parentId` existe e tem `mapId` igual ao body.mapId. Se não: 400 `{ error: 'Parent and node must belong to the same map' }` (criar `ValidationError(400, msg)` se necessário, ou throw `ApiError(400, msg)` direto).
  2. Calcula `nextOrder = (max(sortOrder) entre filhos do parentId) + 1`. Use `prisma.node.aggregate({ _max: { sortOrder: true }, where: { parentId } })`; se null → 0.
  3. Cria o Node.
- Retorna 201 com `toNodeDto(created)`.
- 404 `Parent not found` se `parentId` inexistente.

**Done when:**

- [ ] POST cria nó com sortOrder correto.
- [ ] Title vazio/whitespace → 400 (Zod já retorna 400 via handler global).
- [ ] parentId inexistente → 404 `Parent not found`.
- [ ] parentId de outro mapa → 400 `Parent and node must belong to the same map`.
- [ ] Smoke manual: criar 3 filhos do root, ver sortOrder 1, 2, 3.
- [ ] typecheck passa.

**Tests:** cobertos em T7
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T3 criação de nó filho com sortOrder automático`

---

### T4: `PATCH /nodes/:id` — renomear (apenas title)

**What:** Atualiza apenas `title` do nó. Demais campos (cor, status, etc.) ficam para M5/M6.
**Where:** `packages/api/src/routes/nodes.ts` (adicionar `app.patch('/:id', ...)`)

**Depends on:** T3
**Reuses:** `prisma`, `NotFoundError`, `toNodeDto`, schema `IdParam` (definir local ou extrair de `maps.ts` — se extrair, mover para `packages/api/src/routes/_schemas.ts` ou similar; alternativa pragmática: redeclarar inline)
**Requirement:** M3-11

**Comportamento:**

- Body Zod: `z.object({ title: z.string().trim().min(1) })`.
- Verifica existência → 404 `Node not found` se ausente.
- `prisma.node.update({ where: { id }, data: { title } })`.
- Retorna 200 com `toNodeDto(updated)`.

**Done when:**

- [ ] PATCH atualiza title e retorna shape correto.
- [ ] Title vazio → 400 (via Zod).
- [ ] Id inexistente → 404.
- [ ] Smoke manual: renomear nó, GET /maps/:id/nodes reflete o novo título.
- [ ] typecheck passa.

**Tests:** cobertos em T7
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T4 rename de nó via PATCH`

---

### T5: `DELETE /nodes/:id` — delete com cascade

**What:** Deleta nó. Cascade do schema remove subárvore. Bloqueia delete do root.
**Where:** `packages/api/src/routes/nodes.ts` (adicionar `app.delete('/:id', ...)`)

**Depends on:** T4
**Reuses:** `prisma`, `NotFoundError`, `ApiError`
**Requirement:** M3-16, M3-18 (parcialmente — a regra de root também é UI; backend valida como segurança)

**Comportamento:**

- Verifica existência → 404 `Node not found`.
- Se `parentId === null` → 400 `Cannot delete root`.
- `prisma.node.delete({ where: { id } })` — cascade do schema cuida dos filhos.
- Renumerar irmãos do pai do nó deletado? **Não** — gaps no `sortOrder` são tolerados (a ordenação relativa permanece). Renumerar é overhead sem ganho funcional. Se a UI exigir, é trivial adicionar depois.
- Retorna 204 sem body.

**Done when:**

- [ ] DELETE remove nó e subárvore (verificar via GET /maps/:id/nodes).
- [ ] DELETE root → 400 `Cannot delete root`.
- [ ] DELETE id inexistente → 404.
- [ ] Smoke manual: criar root + filho + neto; deletar filho; root sobra sozinho.
- [ ] typecheck passa.

**Tests:** cobertos em T7
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T5 delete de nó com cascade da subárvore`

---

### T6: `PATCH /nodes/:id/move` — reparent com renumeração e validação de ciclo

**What:** Move nó para outro pai. Renumera irmãos. Valida que o novo pai não é descendente do nó.
**Where:** `packages/api/src/routes/nodes.ts` (adicionar `app.patch('/:id/move', ...)`)

**Depends on:** T5
**Reuses:** `prisma.$transaction`, `prisma.$queryRaw` (para ciclo), `NotFoundError`, `ApiError`
**Requirement:** M3-21, M3-24

**Body Zod:**

```ts
z.object({
  parentId: z.string(),
  index: z.number().int(),
});
```

**Algoritmo (dentro de `prisma.$transaction(async (tx) => { ... })`):**

1. `node = tx.node.findUnique({ where: { id } })` — 404 se null.
2. Se `node.parentId === null` → 400 `Cannot move root`.
3. `newParent = tx.node.findUnique({ where: { id: body.parentId } })` — 404 `Parent not found` se null.
4. Se `newParent.mapId !== node.mapId` → 400 `Parent and node must belong to the same map`.
5. **Anti-ciclo:** se `newParent.id === node.id` → 400. Senão, verificar via raw SQL recursivo se `newParent` está na subárvore de `node`:

   ```sql
   WITH RECURSIVE descendants AS (
     SELECT id FROM "Node" WHERE id = $1
     UNION ALL
     SELECT n.id FROM "Node" n
     JOIN descendants d ON n.parent_id = d.id
   )
   SELECT 1 FROM descendants WHERE id = $2 LIMIT 1
   ```

   Se retornar linha → 400 `Cannot move node into itself or its descendant`.

6. **Renumeração no novo pai:**
   - `siblings = tx.node.findMany({ where: { parentId: newParent.id, NOT: { id: node.id } }, orderBy: { sortOrder: 'asc' } })`.
   - `clampedIndex = Math.max(0, Math.min(body.index, siblings.length))`.
   - Construir array `ordered = [...siblings.slice(0, clampedIndex), node, ...siblings.slice(clampedIndex)]`.
   - Para cada item de `ordered`, atualizar `sortOrder` para o índice. Pode ser feito com `Promise.all(ordered.map((n, i) => tx.node.update({ where: { id: n.id }, data: { sortOrder: i, ...(n.id === node.id ? { parentId: newParent.id } : {}) } })))`.
7. **Pai antigo (se mudou):** se `node.parentId !== newParent.id`:
   - `oldSiblings = tx.node.findMany({ where: { parentId: node.parentId }, orderBy: { sortOrder: 'asc' } })` (sem o nó movido — ele já foi reatribuído acima ou nem precisa filtrar se for executado antes da update).
   - **Ordem importa:** execute a renumeração do pai antigo ANTES do `parentId` do nó mudar, ou recalcule após. Sugestão pragmática: faça a renumeração do pai antigo primeiro (filtrando `id !== node.id`), depois execute a renumeração do novo pai (que já inclui o nó com `parentId` novo).
8. Retorna `toNodeDto(updated node)` com 200.

**Done when:**

- [ ] Move muda parentId e renumera ambos os pais.
- [ ] Move para descendente → 400 `Cannot move node into itself or its descendant`.
- [ ] Move root → 400 `Cannot move root`.
- [ ] Move para nó de outro mapa → 400.
- [ ] Index negativo ou maior que siblings → clampa.
- [ ] Move para o mesmo pai com index diferente → renumera os irmãos.
- [ ] Smoke manual: criar A→B→C, mover C para A; depois tentar mover A para C (descendente) → 400.
- [ ] typecheck passa.

**Tests:** cobertos em T7
**Gate:** typecheck + smoke manual da matriz de cenários acima

**Commit:** `feat(m3): T6 move de nó com renumeração transacional e validação de ciclo`

---

### T7 [P]: Testes unit das rotas de Node

**What:** Cobertura Vitest dos endpoints de Node com Fastify `inject`.
**Where:** `packages/api/src/routes/nodes.test.ts` (novo)

**Depends on:** T6 (pode rodar em paralelo com T8 na execução)
**Reuses:** `buildApp()`; Fastify `inject`; padrão de `routes/maps.test.ts` (criado em T4 do M2)
**Requirement:** M3-01, M3-07, M3-11, M3-16, M3-18, M3-21, M3-24 (verificação automatizada)

**Setup recomendado:** DB real via `DATABASE_URL` (transações são frágeis sob mock). Cada `describe` cria um Map dedicado em `beforeEach` e deleta em `afterEach` (cascade limpa nós).

**Cenários mínimos (12+):**

1. `GET /maps/:id/nodes` — mapa novo retorna lista com 1 nó (root criado pelo POST /maps).
2. `GET /maps/<inexistente>/nodes` → 404.
3. `POST /nodes` com parent válido → 201; sortOrder = 0 para primeiro filho, 1 para segundo, 2 para terceiro.
4. `POST /nodes` com title vazio → 400.
5. `POST /nodes` com parentId inexistente → 404.
6. `POST /nodes` com parentId de outro mapa → 400.
7. `PATCH /nodes/:id` rename → 200, title atualizado.
8. `PATCH /nodes/:id` rename com title vazio → 400.
9. `PATCH /nodes/<inexistente>` → 404.
10. `DELETE /nodes/:id` intermediário → 204; subárvore some.
11. `DELETE` no root → 400 `Cannot delete root`.
12. `DELETE` inexistente → 404.
13. `PATCH /nodes/:id/move` para novo pai → 200; sortOrders renumerados em ambos os pais.
14. Move com index fora de range → clampa.
15. Move para si mesmo → 400.
16. Move para descendente → 400.
17. Move root → 400.

**Done when:**

- [ ] Arquivo de teste existe com ≥ 17 cenários.
- [ ] `pnpm --filter @mindmap/api test` roda e todos passam.
- [ ] Nenhum `.skip`/`.todo`.

**Tests:** unit (é o próprio teste)
**Gate:** `pnpm --filter @mindmap/api test` exit 0 com 17+ passes

**Commit:** `test(m3): T7 testes unit dos endpoints de Node`

---

### T8 [P]: Hooks TanStack Query para Node

**What:** Hooks tipados para todos os endpoints de Node, seguindo o padrão de `maps.ts`.
**Where:** `packages/web/src/api/nodes.ts` (novo)

**Depends on:** T6 (precisa dos endpoints) — pode rodar em paralelo com T7
**Reuses:** `request<T>` helper de `maps.ts` (extrair para `packages/web/src/api/_request.ts` se possível, ou redeclarar — decisão de implementação); tipos de `@mindmap/shared`; `QueryOptions`/`MutationOptions` de `./types.ts`
**Requirement:** Suporte a M3-01, M3-07, M3-11, M3-16, M3-21

**Hooks a exportar:**

```ts
export const useNodes = (mapId?: string, options?: QueryOptions<NodeListResponse>)
export const useCreateNode = (options?: MutationOptions<NodeDto, CreateNodeBody>)
export const useUpdateNode = (options?: MutationOptions<NodeDto, { id: string; body: UpdateNodeBody }>)
export const useDeleteNode = (options?: MutationOptions<void, string>)
export const useMoveNode = (options?: MutationOptions<NodeDto, { id: string; body: MoveNodeBody }>)
```

**Invalidação:**

- Toda mutation invalida `['nodes', mapId]`.
- `useCreateNode`/`useUpdateNode`/`useMoveNode`: pegar `mapId` do response (`data.mapId`) para invalidar a query certa. `useDeleteNode` precisa do mapId — opção: receber `{ id, mapId }` como variável; OU invalidar todas `['nodes']`. Recomendação: variável `{ id: string; mapId: string }` para `useDeleteNode` — mantém invalidação cirúrgica.

**Query key convention:** `['nodes', mapId]` (única query por mapa).

**Done when:**

- [ ] Hooks exportados com tipos corretos.
- [ ] Cada mutation invalida `['nodes', mapId]` no `onSuccess`.
- [ ] `pnpm --filter @mindmap/web typecheck` passa.
- [ ] Smoke manual em DevTools React Query: chamar hooks via componente temporário (ou aguardar T13 para validação real).

**Tests:** none (hooks são adapters de fetch — AD-007)
**Gate:** typecheck

**Commit:** `feat(m3): T8 hooks TanStack Query para Node`

---

### T9: Tree builder util

**What:** Função pura que converte lista plana de `NodeDto[]` em árvore (`TreeNode`), respeitando `parentId` e `sortOrder`, e aplicando filtro de `collapsedIds`.
**Where:**

- `packages/web/src/lib/tree.ts` (novo)
- `packages/web/src/lib/tree.test.ts` (novo)

**Depends on:** T8 (libera o sprint web; conceitualmente depende só de T1)
**Reuses:** `NodeDto` de `@mindmap/shared`
**Requirement:** M3-01, M3-26, M3-27

**API esperada:**

```ts
export interface TreeNode {
  node: NodeDto;
  children: TreeNode[];
}

// Constrói árvore completa (sem filtrar collapsed)
export function buildTree(nodes: NodeDto[]): TreeNode | null;

// Aplica colapso: retorna nodes/edges visíveis para layout.
// Nós com id em collapsedIds permanecem visíveis, mas seus descendentes são omitidos.
export function visibleNodes(
  root: TreeNode | null,
  collapsedIds: ReadonlySet<string>,
): { nodes: NodeDto[]; edges: Array<{ parentId: string; childId: string }> };
```

**Comportamento detalhado:**

- `buildTree`: se nenhum nó tem `parentId === null`, retorna null (mapa corrompido — não deve acontecer). Filhos ordenados por `sortOrder` asc.
- `visibleNodes`: walk recursivo; ao atingir nó colapsado, inclui o nó mas não desce.

**Done when:**

- [ ] Funções exportadas com assinatura acima.
- [ ] Tests cobrem: árvore vazia (1 nó), árvore com múltiplos níveis, ordenação por sortOrder, collapsedIds escondendo subárvore, collapsedIds em nó folha (no-op).
- [ ] `pnpm --filter @mindmap/web test` exit 0 com ≥ 5 testes.
- [ ] typecheck passa.

**Tests:** unit (lógica pura — caso clássico de AD-007)
**Gate:** `pnpm --filter @mindmap/web test` exit 0

**Commit:** `feat(m3): T9 utilitário de árvore com filtro de collapse`

---

### T10: Web worker elkjs + hook `useLayoutedTree`

**What:** Worker dedicado para cálculo de layout via elkjs, com hook React que envia o grafo e devolve nós/edges posicionados para React Flow.
**Where:**

- `packages/web/package.json` (adicionar `elkjs`)
- `packages/web/src/lib/layout.worker.ts` (novo — worker)
- `packages/web/src/lib/useLayoutedTree.ts` (novo — hook)

**Depends on:** T9
**Reuses:** `visibleNodes` de T9; React Flow types (`Node`, `Edge`) — serão instalados em T12, então neste task **definir tipos locais** (`PositionedNode`, `LayoutEdge`) sem depender de `@xyflow/react` ainda. T12 mapeia para os tipos do React Flow.
**Requirement:** M3-04, M3-05, M3-28

**Worker (`layout.worker.ts`):**

- Importa ELK do `elkjs/lib/elk-api` ou `elkjs/lib/elk.bundled.js` (consultar docs atuais via Context7 MCP se necessário).
- Recebe mensagem `{ nodes: NodeDto[]; edges: Array<{ parentId: string; childId: string }> }`.
- Monta input ELK: cada nó com largura/altura padrão (ex: 180×40); algoritmo `layered`, direção `RIGHT`.
- Responde `{ positioned: Array<{ id: string; x: number; y: number; width: number; height: number }> }`.
- Em erro, responde `{ error: string }`.

**Hook (`useLayoutedTree.ts`):**

- Recebe `nodes`, `edges` (de `visibleNodes`).
- Cria worker via `new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' })` (Vite suporta nativo).
- `useEffect` envia mensagem quando inputs mudam; cancela request anterior.
- Retorna `{ positioned: PositionedNode[]; isLayouting: boolean; error: string | null }`.
- Cleanup do worker no unmount.

**Done when:**

- [ ] `elkjs` instalado.
- [ ] Worker compila com Vite (`pnpm --filter @mindmap/web build` passa).
- [ ] Hook retorna posições para um input de teste (validação visual via console.log num componente temporário, ou em T12).
- [ ] typecheck passa.

**Tests:** none — worker + hook são integração com lib externa; validação manual em T12. (Worker isolado seria bom mas requer setup vitest non-trivial; postergar se aparecer dor.)
**Gate:** typecheck + build

**Commit:** `feat(m3): T10 layout via elkjs em web worker`

---

### T11: Componente `MindNode` (custom React Flow node)

**What:** Componente visual do nó no canvas com slots para ações (add filho, rename, delete, collapse) — handlers vazios; T14–T18 plugam comportamento real.
**Where:**

- `packages/web/package.json` (adicionar `@xyflow/react`)
- `packages/web/src/components/canvas/MindNode.tsx` (novo)
- `packages/web/src/components/canvas/types.ts` (novo — `MindNodeData` shape)

**Depends on:** T10 (foundation pronta)
**Reuses:** `NodeDto`; tokens semânticos do Tailwind v4 (`bg-card`, `text-foreground`, `border`)
**Requirement:** Suporte visual a M3-07, M3-10, M3-15, M3-20, M3-26

**Shape de dados (passado pelo React Flow):**

```ts
export interface MindNodeData {
  node: NodeDto;
  isRoot: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onSubmitEdit: (title: string) => void;
  onCancelEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
}
```

**Comportamento visual:**

- Card retangular com título centralizado.
- Quando `isEditing`: substitui título por `<input>` com auto-focus + Enter/Escape/Blur handlers.
- Botão "+" (add filho) à direita.
- Botão "Excluir" só quando `!isRoot`.
- Botão expand/collapse (▶/▼) só quando `hasChildren`.
- Estados de hover/selected via Tailwind.
- Handles do React Flow (source à direita, target à esquerda) — invisíveis ou estilizados discretamente.

**Skill `web-component-creation`:** invocar para gerar arquitetura padrão.

**Done when:**

- [ ] `@xyflow/react` instalado.
- [ ] Componente renderiza nó com todos os controles.
- [ ] Modo edição inline funcional (Enter submete via `onSubmitEdit`, Escape cancela via `onCancelEdit`, blur com valor vazio cancela).
- [ ] Visual coerente com paleta dark Obsidian-like já existente.
- [ ] typecheck passa.

**Tests:** none (UI declarativa — AD-007)
**Gate:** typecheck

**Commit:** `feat(m3): T11 componente MindNode para o canvas`

---

### T12: Componente `MapCanvas` — React Flow + layout + hooks

**What:** Container que une fetch dos nós, layout via worker, renderização React Flow e o `MindNode` custom. Estado local de `collapsedIds` e `editingId`. Handlers ainda chamam stubs (`console.warn('TODO em T14')` etc.) — interações reais entram em T14–T18.
**Where:**

- `packages/web/src/components/canvas/MapCanvas.tsx` (novo)
- `packages/web/src/components/canvas/MapCanvas.css` (se necessário para overrides do React Flow — checar primeiro se Tailwind cobre)

**Depends on:** T11
**Reuses:** `useNodes` (T8), `buildTree`/`visibleNodes` (T9), `useLayoutedTree` (T10), `MindNode` (T11), tokens Tailwind
**Requirement:** M3-01, M3-02, M3-03, M3-04, M3-06

**Comportamento:**

- Props: `mapId: string`.
- `useNodes(mapId)` → estado loading/error/data.
- Estado local: `collapsedIds: Set<string>`, `editingId: string | null`.
- Memoizar: `tree = buildTree(data.nodes)`; `{ nodes, edges } = visibleNodes(tree, collapsedIds)`; `{ positioned, isLayouting, error } = useLayoutedTree(nodes, edges)`.
- Construir `rfNodes` (React Flow Node[]) e `rfEdges` (Edge[]) a partir de `positioned` + `edges`:
  - `rfNodes`: cada um com `id`, `position: { x, y }`, `type: 'mind'`, `data: MindNodeData{...}` (passa handlers stub).
  - `rfEdges`: cada um com `id: '${parentId}-${childId}'`, `source: parentId`, `target: childId`, `type: 'default'` ou `smoothstep`.
- Render: `<ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={{ mind: MindNode }} fitView panOnDrag zoomOnScroll />`.
- Loading/error: mensagens equivalentes às de `MapPage`.

**Skill `react-flow`:** invocar — esta é a integração canônica.

**Done when:**

- [ ] Canvas renderiza árvore real do banco com pan/zoom funcionais.
- [ ] Layout via worker (verificar no DevTools que main thread não trava).
- [ ] Handlers passam stubs (TODO comments referenciando T14–T18).
- [ ] typecheck passa.
- [ ] `pnpm --filter @mindmap/web build` passa.

**Tests:** none (UI complexa — verificação manual em T13)
**Gate:** typecheck + build + smoke manual (criar mapa com filhos via API, ver renderização)

**Commit:** `feat(m3): T12 MapCanvas com React Flow e layout via worker`

---

### T13: Wire `MapPage` → `MapCanvas`

**What:** Substituir o placeholder "Canvas — em breve" pelo `MapCanvas` real.
**Where:** `packages/web/src/pages/MapPage.tsx` (modificar)

**Depends on:** T12
**Reuses:** `MapCanvas`, `useMap` já existente
**Requirement:** M3-01 a M3-06 (entrega real do canvas em produção)

**Comportamento:**

- Manter header com título e botão "← Mapas".
- Substituir `<p>Canvas — em breve</p>` por `<MapCanvas mapId={id!} />` (dentro do container `flex-1`).
- Garantir que React Flow ocupa altura disponível (provavelmente precisa `h-full` no container — React Flow exige altura definida).

**Done when:**

- [ ] Acessar `/maps/:id` mostra canvas funcional para um mapa existente.
- [ ] Acessar `/maps/<inexistente>` mantém comportamento de "Mapa não encontrado" de M2.
- [ ] Pan/zoom funcionam.
- [ ] typecheck passa.

**Tests:** none
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T13 wire MapCanvas em MapPage`

---

### T14: Add filho — handler real + entra em modo de edição

**What:** Pluga `onAddChild` real no `MapCanvas`. Após criar, ativa modo de edição inline no novo nó.
**Where:** `packages/web/src/components/canvas/MapCanvas.tsx` (modificar)

**Depends on:** T13
**Reuses:** `useCreateNode` (T8)
**Requirement:** M3-07, M3-08, M3-09

**Comportamento:**

- `handleAddChild(parentId)`: chama `createNode({ mapId, parentId, title: 'Novo nó' })`.
- `onSuccess(newNode)`: setEditingId(newNode.id). A invalidação do query refaz o fetch; ao re-render, `MindNode` com `isEditing=true` ativa o input.
- `onError`: alert/toast simples (`window.alert('Erro ao criar nó')` aceitável em v1 ou usar componente `<Toast>` se já existir; se não, usar `console.error` + state de erro inline na canvas — escolher o mais simples).

**Done when:**

- [ ] Clicar "+" cria nó visível e foca no input.
- [ ] Erro de API mostra feedback sem crash.
- [ ] typecheck passa.

**Tests:** none
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T14 add filho com edição inline automática`

---

### T15: Rename inline — handler real + revert em erro

**What:** Pluga `onSubmitEdit`/`onCancelEdit`/`onStartEdit`. Persiste via `useUpdateNode`. Reverte UI em erro.
**Where:** `packages/web/src/components/canvas/MapCanvas.tsx` (modificar)

**Depends on:** T14
**Reuses:** `useUpdateNode` (T8)
**Requirement:** M3-10 a M3-14

**Comportamento:**

- `handleStartEdit(id)`: setEditingId(id) (também acionado por duplo-clique no nó — T11 já dispara `onStartEdit`).
- `handleSubmitEdit(id, title)`: se title vazio após trim → cancel (não chama API). Caso contrário: `updateNode({ id, body: { title } })` + setEditingId(null). Optimistic update opcional (TanStack Query suporta — postergar se não for trivial).
- `handleCancelEdit()`: setEditingId(null) sem chamar API.
- `onError`: invalidar query (revert automático ao último estado do banco) + feedback.

**Done when:**

- [ ] Duplo-clique → input aparece com valor selecionado.
- [ ] Enter persiste, Escape cancela, blur com valor vazio cancela.
- [ ] Erro de rede reverte o título.
- [ ] typecheck passa.

**Tests:** none
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T15 rename inline de nó com persistência e revert`

---

### T16: Delete com confirmação

**What:** Pluga `onDelete` real com `ConfirmDialog` já existente.
**Where:** `packages/web/src/components/canvas/MapCanvas.tsx` (modificar)

**Depends on:** T15
**Reuses:** `useDeleteNode` (T8), `ConfirmDialog` (M2)
**Requirement:** M3-15 a M3-19

**Comportamento:**

- Estado local: `deleteTarget: NodeDto | null`.
- `handleDelete(node)`: setDeleteTarget(node) → abre `ConfirmDialog`.
- Confirm: `deleteNode({ id: node.id, mapId })` + close dialog.
- Cancel: close dialog.
- Erro: feedback inline; mantém nó.
- `MindNode` já omite o botão delete se `isRoot=true` (T11 — confirmar).

**Done when:**

- [ ] Clicar "Excluir" abre dialog com texto contextual ("nó «{title}» e descendentes").
- [ ] Confirm remove nó + subárvore do canvas.
- [ ] Root não tem ação visível.
- [ ] Erro mantém estado.
- [ ] typecheck passa.

**Tests:** none
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T16 delete de nó com dialog de confirmação`

---

### T17: Drag-and-drop reparent

**What:** Detecta drop de um nó sobre outro e chama `useMoveNode`. Cancela se drop fora de alvo válido.
**Where:**

- `packages/web/src/components/canvas/MapCanvas.tsx` (modificar)
- `packages/web/src/components/canvas/MindNode.tsx` (modificar — adicionar feedback visual de "drop target hover" se necessário)

**Depends on:** T16
**Reuses:** `useMoveNode` (T8); React Flow drag events (`onNodeDragStop`, `onNodeDrag`)
**Requirement:** M3-20 a M3-25

**Abordagem:**

- React Flow expõe `onNodeDragStop(event, node)` com posição final.
- Detectar nó alvo via bounding box: iterar `rfNodes` (excluindo o draggedId e seus descendentes), encontrar o que contém a posição do mouse no drop.
  - Alternativa mais robusta: usar `onNodeDrag` para manter estado `hoveredId` por overlap de centros, e em `onNodeDragStop` usar esse estado.
- Se há alvo válido: `moveNode({ id: draggedId, body: { parentId: targetId, index: <último> } })`. Index pode ser passado como `Number.MAX_SAFE_INTEGER` (backend clampa para `siblings.length`).
- Se nenhum alvo ou alvo inválido (próprio nó / descendente — front pode pré-validar via `visibleNodes`): cancelar; chamar `invalidateQueries(['nodes', mapId])` para forçar re-layout à posição original.
- Root: `draggable: false` no `rfNode` correspondente.

**Done when:**

- [ ] Drag um nó sobre outro chama API e reorganiza a árvore.
- [ ] Drop fora de alvo reverte ao layout original.
- [ ] Drag de root é impedido.
- [ ] Erro 400 (ciclo) mostra feedback e reverte.
- [ ] typecheck passa.

**Tests:** none
**Gate:** typecheck + smoke manual (cenários: reparent simples, drop em descendente, drop fora)

**Commit:** `feat(m3): T17 drag-and-drop para reparent de nó`

---

### T18: Expand/collapse

**What:** Pluga `onToggleCollapse` real. Atualiza `collapsedIds` (Set local). Tree builder já filtra (T9). Layout recalcula automaticamente.
**Where:** `packages/web/src/components/canvas/MapCanvas.tsx` (modificar)

**Depends on:** T17
**Reuses:** `collapsedIds` state (já criado em T12), `visibleNodes` (T9)
**Requirement:** M3-26 a M3-30

**Comportamento:**

- `handleToggleCollapse(id)`: `setCollapsedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })`.
- `MindNode` recebe `isCollapsed = collapsedIds.has(node.id)` e `hasChildren = (count children > 0)` — calcular `hasChildren` no momento de construir `MindNodeData` em T12 a partir da árvore completa (não da visível).
- Não persistir (AD-004).

**Done when:**

- [ ] Clicar collapse esconde subárvore + recalcula layout.
- [ ] Clicar expand revela filhos diretos (descendentes colapsados permanecem).
- [ ] Recarregar página → tudo expandido.
- [ ] Nós sem filhos não mostram controle.
- [ ] typecheck passa.

**Tests:** none
**Gate:** typecheck + smoke manual

**Commit:** `feat(m3): T18 expand/collapse de ramos no cliente`

---

## Validações Pré-Aprovação

### Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | 2 arquivos (tipo + reexport) | ✅ |
| T2 | 3 arquivos (mapper + plugin esqueleto + GET em maps) | ✅ |
| T3 | 1 arquivo (POST handler) | ✅ |
| T4 | 1 arquivo (PATCH handler) | ✅ |
| T5 | 1 arquivo (DELETE handler) | ✅ |
| T6 | 1 arquivo (move handler) — algoritmo complexo, mas atômico | ✅ |
| T7 | 1 arquivo (testes) | ✅ |
| T8 | 1 arquivo (hooks) | ✅ |
| T9 | 2 arquivos (util + test) | ✅ |
| T10 | 2 arquivos (worker + hook) + package.json | ✅ |
| T11 | 2 arquivos (MindNode + types) + package.json | ✅ |
| T12 | 1 arquivo (MapCanvas) | ✅ |
| T13 | 1 arquivo (MapPage) | ✅ |
| T14 | 1 arquivo (handler) | ✅ |
| T15 | 1 arquivo (handlers) | ✅ |
| T16 | 1 arquivo (handler + state) | ✅ |
| T17 | 2 arquivos (canvas + ajuste MindNode) | ✅ |
| T18 | 1 arquivo (handler) | ✅ |

### Diagram-Definition Cross-Check

| Task | Depends on (body) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | Nenhum | Phase 1 início | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 [P] | ✅ |
| T8 | T6 | T6 → T8 [P] | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | T9 | T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | T13 | T13 → T14 | ✅ |
| T15 | T14 | T14 → T15 | ✅ |
| T16 | T15 | T15 → T16 | ✅ |
| T17 | T16 | T16 → T17 | ✅ |
| T18 | T17 | T17 → T18 | ✅ |

Parallelism: T7/T8 só dependem de T6 e entre si não há acoplamento (T7 mexe em api/, T8 em web/) ✅.

### Test Co-location (AD-007)

| Task | Camada | Postura AD-007 | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Tipos shared | none | none | ✅ |
| T2 | Mapper + GET (fetch direto) | unit em T7 | cobertos em T7 | ✅ |
| T3 | Handler com lógica (sortOrder auto) | unit em T7 | cobertos em T7 | ✅ |
| T4 | Handler simples | unit em T7 | cobertos em T7 | ✅ |
| T5 | Handler com validação de root | unit em T7 | cobertos em T7 | ✅ |
| T6 | Handler com transação + ciclo | unit em T7 | cobertos em T7 | ✅ |
| T7 | O próprio teste | unit | unit | ✅ |
| T8 | Hooks (adapters de fetch) | none | none | ✅ |
| T9 | Função pura | unit | unit (co-located) | ✅ |
| T10 | Worker + hook | none + justificado | none | ✅ |
| T11 | UI declarativa | none | none | ✅ |
| T12 | UI complexa | none (verificação manual) | none | ✅ |
| T13 | UI declarativa | none | none | ✅ |
| T14-T18 | UI interativa | none (AD-007) | none | ✅ |

Padrão de testes agrupados em uma task (T7) segue convenção estabelecida em M2 (T4 cobriu todos os endpoints). Para função pura (T9) os testes são co-located.

---

## Resumo Final

- **18 tasks** (todas codificáveis).
- **1 fase paralela:** Phase 3 (T7/T8).
- **Caminho crítico:** T1 → T2 → T3 → T4 → T5 → T6 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18 (17 sequenciais).
- **Commits planejados:** 18.
- **Dependências externas:** Túnel SSH + DATABASE_URL configurada (já resolvido desde M1).
- **Pacotes novos:** `elkjs`, `@xyflow/react` (T10 e T11 fazem `pnpm add`).
- **Skills locais aplicáveis:**
  - `api-backend` → T2–T7
  - `web-api-integration` → T8
  - `react-flow` → T11, T12, T17
  - `web-component-creation` → T11
- **Próximo passo:** abrir um chat novo, apontar para `.specs/features/m3-canvas-editing/tasks.md` e executar a partir de T1.

---

## Atualizações a fazer em `STATE.md` (executor faz ao iniciar, ou planejamento já fez)

Os seguintes ADs surgiram do planejamento de M3 e devem ser registrados:

- **AD-008** — `sortOrder` em inteiros com renumeração transacional dos irmãos afetados em `move`. Justificativa: simplicidade vs. fractional indexing; mindmap pessoal tem poucos irmãos por nó.
- **AD-009** — elkjs roda em web worker dedicado. Justificativa: RNF-01 (500 nós sem jank); cálculo de layout não trava UI.
- **AD-010** — M3 já persiste cada mutação estrutural (não adia para M4). M4 formaliza contrato + edge cases de rede + restauração completa.
- **AD-011** — Move em M3 cobre apenas drag-to-reparent (mudar `parentId`). Reorder entre irmãos do mesmo pai vira deferred idea (não está em US-02).
- **AD-012** — `GET /maps/:id/nodes` retorna lista plana; cliente monta a árvore. Mantém `MapDetail` desacoplado de estrutura.

E em **Deferred Ideas**:

- Reorder entre irmãos do mesmo pai via drag (sem mudar parentId)
- Atalhos de teclado expandidos no canvas (Tab=add filho, Delete=excluir, etc.)
- Optimistic updates explícitos em mutations de Node (em vez de invalidate)
- Restauração de expand/collapse entre sessões (sob demanda real do usuário — AD-004 já marcou como possível deferred)
