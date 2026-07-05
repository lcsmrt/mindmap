# State

**Last Updated:** 2026-07-05
**Current Work:** **M20 — Menu de conta e perfil — EXECUTADO (2026-07-05); review AD-013 pendente (chat separado, [[feedback-plan-execute-split]]).** 7/7 tasks em `master`. Full-stack pequeno: `PATCH /auth/me` (`packages/api`) + `UpdateProfileBody` (`packages/shared`) + `AppHeader`/`AccountMenu`/`getInitials`/`ProfilePage`/`useUpdateProfile` (`packages/web`). Decisões e escopo em **AD-027/AD-028**; resumo da entrega no **ROADMAP → M20**. Tema claro/escuro foi fatiado pra fora do M20 (vira quick task própria). Gates verdes: typecheck/lint, unit api 103 / web 154, e2e 45/45.

**Próximo passo:** review AD-013 do M20 (chat separado). Depois: M21 (reset por e-mail) ou M22 (Google OAuth) — ordem flexível; o portão email+senha já existe (ver ROADMAP).

> O histórico dos milestones anteriores (M6–M19) não é repetido aqui — vive nas ADs de "Recent Decisions" (abaixo), no ROADMAP e nas feature folders. Este campo guarda só o trabalho atual + próximo passo.

---

## Recent Decisions (Last 60 days)

### AD-028: M20 executado conforme planejado (AD-027); validação client-side segue sem zod por ora (2026-07-05)

**Decision:** M20 implementado full-stack em uma única sessão de execução, seguindo o planejamento da AD-027 sem desvios de escopo: `PATCH /auth/me` (backend) + `AppHeader`/`AccountMenu`/`getInitials`/`useUpdateProfile`/`ProfilePage` (frontend). Único ponto levantado durante a execução: o usuário notou que a validação client-side do nome (`pages/profile/validation.ts`) usa função pura manual em vez de zod, espelhando o padrão já existente em `pages/auth/validation.ts` (M19). Confirmado que **zod não é dependência do `packages/web` nem do `@mindmap/shared` hoje** — só do `packages/api`. Decisão do usuário: **manter o padrão atual no M20** (não introduzir zod no client agora); mover a padronização de validação de formulário via zod no frontend para uma iniciativa própria futura (ver Deferred Ideas).
**Reason:** Trocar o padrão de validação no meio de um milestone pequeno (M20) criaria escopo não planejado (nova dependência do `packages/web`, possível deslocamento de schemas para `@mindmap/shared`) sem necessidade imediata — o `validateName` atual já atende as ACs do M20. Padronizar via zod é uma decisão maior que vale seu próprio momento (tocaria `AuthPage`/M19 também, não só o Perfil).
**Trade-off:** Duas convenções de validação client-side (`AuthPage` e `ProfilePage`) continuam manuais, com potencial de divergência entre implementações "iguais" (ex. regra de nome) até a padronização acontecer.
**Impact:** Nenhuma mudança de código motivada por esta AD — documenta a decisão de **não** agir agora. Ver Deferred Ideas → "zod para validação de formulários no frontend".

### AD-027: M20 planejado — header compartilhado + menu de conta + `/profile`; `design.md` pulado; tema/Ajuda fora (planejamento, 2026-07-05)

**Decision:** Planejamento do **M20** (menu de conta e perfil) concluído em `.specs/features/m20-account-menu/` (spec 16 req. M20-NN, context, tasks 7). Full-stack pequeno. **Decisões de escopo (usuário):** (a) **tema claro/escuro fatiado p/ fora do M20** — vira milestone/quick task própria; (b) **consolidar o header** entra no M20 (hoje há dois `<header>` inline divergentes — Home com branding+"Sair" provisório, Map com voltar+título sem Sair); (c) **"Perfil" = página dedicada `/profile`** (não modal — o usuário quer que cresça); (d) Perfil edita **nome**, mostra **e-mail read-only**; (e) item **"Ajuda" adiado**. **Decisões arquiteturais (discuss + design pulado, inline no `tasks.md`):** endpoint **`PATCH /auth/me`** (reusa `authPlugin`/`requireAuth`, simétrico ao `GET /auth/me`, escopado por `req.user.id`); header compartilhado em `components/AppHeader.tsx` (regra `frontend-structure`) com slot à esquerda + `AccountMenu` fixo à direita; **reuso** de `components/ui/menu.tsx` (base-ui — a11y nativa) e `ui/avatar.tsx` (`AvatarFallback` iniciais) — zero primitivo novo; `useUpdateProfile` atualiza o cache `['auth','me']` (nome reflete no avatar sem reload).
**Reason:** Página dedicada em vez de modal porque o usuário sinalizou crescimento futuro do Perfil. `PATCH /auth/me` evita rota/plugin novo e herda a guarda. Reuso dos primitivos já criados na limpeza pós-M19 mantém o design system consistente e o milestone enxuto. Tema saiu porque é ortogonal e maior do que aparenta (persistência + toggle) — não travar o menu de conta por causa dele.
**Trade-off:** Levar o `AccountMenu` pra tela de mapas é **divergência intencional** do design "Estudo de Nós" (que não tem avatar) — pedido explícito do usuário por consistência. `design.md` pulado: se a execução listar >5 passos por task ou dependências inesperadas, promover a design formal (safety valve da skill).
**Impact:** Backend: `PATCH /auth/me` + DTO `UpdateProfileBody` em `@mindmap/shared` + testes (`packages/api`). Frontend: `AppHeader`/`AccountMenu` (novos, `components/`), `pages/profile/ProfilePage.tsx` + rota `/profile` sob `RequireAuth`, `useUpdateProfile`+`getInitials`, migração de Home/Map (remove headers inline + botão "Sair" provisório). Nada implementado — só planejamento. Próximo passo: **executar o M20 em chat separado** ([[feedback-plan-execute-split]]).

### AD-026: M19 planejado — sessão no front como query `['auth','me']`; guarda por rota-layout + return-to (planejamento, 2026-07-04)

**Decision:** Planejamento do **M19** (tela de auth + guarda no front, 1ª fatia jogável email+senha) concluído em `.specs/features/m19-auth-frontend/` (spec 20 req. M19-NN, context, design, 6 tasks). Só `packages/web`; consome o contrato pronto do M18 (tipos de auth já em `@mindmap/shared` — nada novo). **Arquitetura de sessão no cliente:** a sessão é modelada como a **query `['auth','me']`** (fonte única de verdade) — sem context/store dedicado, o cache do TanStack Query já compartilha; `useSignup`/`useLogin` mutam o cache, `useLogout` zera + `queryClient.clear()`. **Guarda:** rota-layout `RequireAuth` (`<Outlet/>`) protege `/` e `/maps/:id`; `RedirectIfAuthed` no `/login`; **return-to** via `location.state.from`. **`401` global:** `QueryCache.onError` zera `['auth','me']` quando qualquer request não-auth toma 401 (sessão expirada derruba a guarda). **Decisões de UX (discuss, ver context.md):** elementos de M20/M21/M22 (Google, "esqueci a senha", menu de conta, footer legal) **removidos** da tela agora; logout = **botão temporário no header da Home** até o M20; feedback de erro **híbrido** (validação client-side por campo + banner no card para 401/409 + botão em loading), toast descartado para erro de form; `credentials:'same-origin'` no `request()` (same-origin, cookie httpOnly).
**Reason:** Fonte única evita duplicar estado que o Query já mantém (menos superfície de bug). Híbrido de feedback segue heurísticas de localidade/proximidade (Nielsen #1/#9) e respeita o 401 genérico do M18. Return-to é padrão consolidado (react-router `from`). Esconder o que não é do M19 mantém a tela honesta com o que funciona.
**Trade-off:** Guarda 401 global depende de todo erro passar por `ApiError` (já é o caso). `queryClient.clear()` no logout exige navegar antes de limpar. Cookie same-origin: validar no e2e que dev/prod são estritamente same-origin (fallback `include` exige CORS credenciado — evitar).
**Impact:** Novos: `src/api/auth.ts`, `src/auth/{RequireAuth,RedirectIfAuthed,AuthSplash}.tsx`, `src/pages/auth/{AuthPage,validation}` + componentes. Modificados: `_request.ts` (credenciais), `main.tsx` (401 global), `App.tsx` (rotas), `HomePage.tsx` (botão Sair). Backend/schema/contrato **intocados**. Nada implementado — só planejamento. Próximo passo: **executar o M19 em chat separado** ([[feedback-plan-execute-split]]).

### AD-025: Autenticação multi-usuário roll-your-own; retrofit em 5 etapas (planejamento, 2026-07-04)

**Decision:** A próxima feature é **autenticação**, planejada em chat separado ([[feedback-plan-execute-split]]) a partir do design `designs/v3/Autenticação.dc.html`. Três decisões travadas pelo usuário: **(1) multi-usuário completo** — modelo `User`, `Map.ownerId`, signup aberto, todo endpoint de maps/nodes escopado por dono (não é só um portão single-user); **(2) roll-your-own** no Fastify+Prisma — `argon2` para hash + **sessão server-side** (cookie httpOnly + tabela `Session`, revogável), `@fastify/oauth2` na etapa do Google; **(3) serviço externo descartado** (Supabase Auth/Clerk/Auth0 fora — saímos do Supabase para Postgres na VPS na AD-022; re-introduzir contradiz o deploy). Biblioteca de auth (better-auth) foi considerada e preterida a favor de roll-your-own (controle/manutenibilidade/aprendizado; as partes difíceis — OAuth e reset — chegam em etapas posteriores e usam peças vetadas). Quebrada em **5 etapas executadas uma por vez** (spec/design/tasks próprios por etapa), ver ROADMAP → "Pós-v1 — Autenticação": **M18** núcleo backend (User/Session/ownerId + migration/backfill + guarda/escopo), **M19** tela + guarda no front (1ª fatia jogável, email+senha), **M20** menu de conta/perfil/tema, **M21** reset por e-mail, **M22** Google OAuth.
**Reason:** App é single-user/sem dono hoje; o usuário quer contas reais. Roll-your-own casa com o "stack fixado / own your stack" do projeto (mesmo espírito da rejeição do React Flow em AD-015) e com a prioridade de organização/manutenibilidade. Fatiar isola a fundação crítica (multi-tenancy no M18) e entrega o portão mínimo cedo (M18+M19).
**Trade-off:** Superfície de segurança fica com o time (mitigada com cuidado por etapa: entropia de token, timing, CSRF no cookie, expiração). **Revisa AD-002 de forma diferente das anteriores:** não é campo de apresentação — introduz **tenancy** (`ownerId` obrigatório) e reescreve toda leitura/escrita de maps/nodes para filtrar por dono. Backfill dos mapas globais → primeiro usuário é o ponto delicado da migração do M18. M21 puxa infra de e-mail (SMTP/provedor); M22 puxa app OAuth no Google Cloud.
**Impact:** Full-stack, primeira feature a tocar auth. Backend: novos modelos + guarda global + reescrita de escopo nas rotas `maps`/`nodes` existentes. Frontend: rotas protegidas (react-router v7), telas KAOS, menu de conta. Nada implementado ainda — só planejamento/roadmap. Próximo passo: abrir chat do **M18** e speccar.

### AD-024 (REVERTIDA): Largura default ajustável ao conteúdo — descartada; padrão segue fixo (pós-M15, 2026-06-27)

**Decision (revertida):** Tentou-se fazer o card sem `width` explícita ajustar à largura do conteúdo (medição via `ResizeObserver`/`max-content` alimentando o layout). **Revertido a pedido do usuário (2026-06-27):** o tamanho padrão deve ser **fixo** em `NODE_WIDTH` (180), como antes; só o resize manual define largura. `width=null` volta ao fallback fixo `nodeWidth(node) = node.width ?? NODE_WIDTH` (AD-023 intacta).
**Reason:** O relato original ("card nasce maior que o necessário") foi interpretado errado. O usuário **não** queria largura padrão dinâmica — queria que o **teto do resize** ("caber o conteúdo em uma linha") fosse respeitado, pois estava ficando **menor que o suficiente**. Ajustar o padrão ao conteúdo "bugou" todos os cards (todos viraram fit de uma linha).
**Impact:** Revertidas as mudanças em `useMeasuredHeights.ts` (volta a só `heights`, sem `widths`/`nextWidths`), `useTreeLayout.ts` (`widthFn` sem fallback medido), `MapCanvas.tsx` (wrapper volta a `width: p.width`). **Mantidos:** alça de resize visível (#3) e o `startWidth` do gesto vindo do `offsetWidth`. O bug real foi corrigido à parte: `measureContentWidth` subestimava o teto (cadeia flex `flex-1 min-w-0` + arredondamento sub-pixel) → agora força `nowrap` no título + `getBoundingClientRect`/`Math.ceil`+1px, então o resize cresce até o título caber em uma linha. Bug #1 (trepidação) segue aberto (CONCERNS.md).

### AD-023: Coluna `width Int?` no Node — revisa parcialmente AD-002 (M15, 2026-06-27)

**Decision:** Adicionar `width Int?` ao `Node` (migration `add_node_width`, nullable sem default). Largura por nó é um **dado estrutural** — não posição em pixel livre — e revisa AD-002 **parcialmente**, pelo mesmo precedente do `side`/AD-018: persiste mais 1 campo de apresentação sem x/y livre. API: `PATCH /nodes/:id` aceita `width` (int positivo ≤ 1000, teto real no front); `POST /` não seta (nó novo nasce `width=null`, cai no fallback `NODE_WIDTH=180`). Frontend: `nodeWidth(node) = node.width ?? NODE_WIDTH`; o layout lê `width` por nó; o render aplica `width` gravado verbatim (sem auto-clamp); `MIN_NODE_WIDTH=120` como piso de drag. Sem reset de largura ao default em M15 (ver Deferred Ideas).
**Reason:** Resize horizontal controlado pelo usuário + persistência são o requisito de M15. A largura é análoga ao `side` — 1 dado estrutural que o usuário controla conscientemente, não coordenada posicional livre. Mesma justificativa de AD-018.
**Trade-off:** Schema cresce mais 1 coluna. `width > teto de conteúdo atual` não é auto-clampado no render (o conteúdo muda ao longo do tempo); o card exibe o branco extra sem quebrar. Sem reset na v1 — candidato a Deferred Idea (duplo-clique na alça ou item no menu ⋯).
**Impact:** Migration `packages/api/prisma/migrations/20260627220813_add_node_width/`. Schema, DTO `NodeDto`, `UpdateNodeBody`, mapper `toNodeDto`, rota PATCH. Frontend: `nodeSize.ts` (`nodeWidth`/`MIN_NODE_WIDTH`), `useTreeLayout.ts` (`nodeWidthFn`, `activeResize`), `slots.ts` (`colWidth`, `nearestSlot` eixo X), `MapCanvas.tsx` (drag de resize, `activeResize` state, `handlePersistWidth`), `MindNode.tsx` (alça `data-testid="resize-handle"`), novos `clampWidth.ts`/`measureContentWidth.ts`. **Revisa AD-002** (addendum M15; segue sem x/y). E2e: `card-resize.spec.ts` (2 testes funcionais) + smoke visual M15 em `smoke-visual.spec.ts`.

### AD-022: Deploy via stack Docker na VPS com redeploy por webhook do Portainer (2026-06-27)

**Decision:** O app passa a ser servido na **VPS Hostinger** (a mesma do Postgres, AD-006) via stack Docker de dois serviços: `mindmap-api` (Fastify, **`network_mode: host`**) e `mindmap-web` (nginx servindo a SPA buildada + proxy de `/api/` para a api). A api compartilha o `localhost` do host para alcançar o Postgres, que só escuta em `localhost`; o nginx alcança a api por `host.docker.internal:3100` (via `extra_hosts: host-gateway`). Banco de **produção** é `mindmap` (sem prefixo), `sslmode=disable` (SSH/loopback), `DATABASE_URL` definida no Portainer (não no repo). Deploy é **contínuo**: push pro `master` dispara a GitHub Action `deploy.yml`, que faz `POST` num **webhook do Portainer** (`secrets.PORTAINER_WEBHOOK`) e o Portainer rebuilda/redeploya a stack. App exposto em `http://72.60.1.97:${WEB_PORT:-8080}`.
**Reason:** Fechar o loop "commitou → no ar" sem CI de build próprio nem registry: o Portainer já roda na VPS e sabe buildar a stack a partir do repo; o webhook é o gatilho mais barato. `network_mode: host` na api evita ter que expor/rotear o Postgres pra dentro de uma bridge Docker (ele é localhost-only por decisão de segurança da AD-006).
**Trade-off:** `network_mode: host` abre mão de isolamento de rede da api (compartilha portas do host). Sem registry/tag de imagem versionada (build no próprio host). Webhook sem assinatura/verificação — qualquer POST na URL secreta redeploya. IP fixo hardcoded na doc/URL. Aceitável para ferramenta single-user.
**Addendum (2026-06-27): redeploy automático não refletia — webhook trocado pela API `git/redeploy`.** Sintoma (relato do usuário): o push disparava o webhook e o container reiniciava, mas com **código velho**; só o botão "Pull and redeploy" do Portainer atualizava. Causa: o compose **builda** as imagens localmente (`build:` + `image: mindmap-api/web`, sem registry); o webhook simples de stack roda o equivalente a `docker compose up -d` **sem `--build`** → como a imagem nomeada já existe, o Docker reusa a antiga. GitOps re-pulla o repo, mas não rebuilda imagens buildadas (limitação conhecida do Portainer). Fix: `deploy.yml` passou a chamar `PUT /api/stacks/45/git/redeploy?endpointId=3` (exatamente o que o botão usa — re-pull + rebuild), autenticado com **Access Token** do Portainer no header `X-API-Key` (secret `PORTAINER_API_KEY`; o antigo `PORTAINER_WEBHOOK` fica obsoleto). A Action lê o `env` atual da stack via `GET /api/stacks/45` e o reenvia no corpo do redeploy, para **não** duplicar a `DATABASE_URL`/senha no GitHub (o endpoint sobrescreveria o env se omitido). IDs (stack 45, endpoint 3) e URL (`72.60.1.97:9000`) são não-sensíveis e ficam no workflow. **Nota de segurança:** durante o diagnóstico a senha do Postgres de produção vazou em texto no chat de planejamento → recomendado rotacioná-la.
**Impact:** Novos arquivos na raiz: `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`, `.env.production.example`, `.github/workflows/deploy.yml`. Dois fixes de produção vieram junto: (1) `lib/uid.ts` (`7e3792d`) — `crypto.randomUUID()` só existe em **secure context**; servido por HTTP puro ele é `undefined`, então ids optimistic de node/toast passam por um fallback; (2) `VersionBadge` (`1a06b9c`) — versão do `package.json` injetada via `vite.config.ts` (`global.d.ts`) e exibida em badge fixo pra conferir o que está no ar. Dev local segue com túnel SSH pro Postgres (AD-006) e banco separado.

### AD-021: Seleção de slot por band vertical (M13, 2026-06-26)

**Decision:** Trocar a métrica de `nearestSlot` de **distância euclidiana ao centro do slot** por **seleção por band vertical**: cada `Slot` passa a carregar `[bandTop, bandBottom)` com fronteiras exatamente no **centro vertical dos cards vizinhos**; score = `dx + dy` onde `dx = |cursor.x − colCenter|` e `dy = 0` dentro do band, senão distância à borda mais próxima. Menor score vence; empate → primeiro na ordem de enumeração; snap-back se o melhor `dx > SLOT_MAX_DISTANCE`. `PLACEHOLDER_H` **removido** (era vestigial — cancelava algebricamente em seleção e render). Shape do `Slot` troca `x/y/height` por `colX/anchorY/bandTop/bandBottom`; render usa `top = anchorY − GHOST_BAR_HEIGHT/2`. `slotToMoveBody`/`isOriginSlot` **inalterados** (operam sobre `parentId`/`index`/`side`, não geometria) → mesmas mutações `move`.
**Reason:** A métrica euclidiana gerava fronteiras assimétricas com cards de alturas variáveis (pós-M12): slots de ponta usavam `GAP_Y/2` de espaçamento enquanto slots do meio usavam centro-de-vão, então "qual vão vence" dependia da altura dos cards → flip com micro-movimentos. Band-based elimina a dependência: cada ponto Y cai em exatamente um band, a troca ocorre só ao cruzar o centro de um card (ponto mais intuitivo), sem flip.
**Trade-off:** Churn no shape do `Slot` (migração de fixtures de teste). Comportamento na fronteira exata (Y = centro do card) é empate → primeiro vence (determinístico, edge case nunca ocorre com cursor real). O eixo Y deixa de ter cap separado (todo ponto cai em algum band da coluna escolhida); só o cap horizontal `SLOT_MAX_DISTANCE` permanece.
**Impact:** `packages/web/src/lib/slots.ts` (Slot, computeSlots, nearestSlot); `packages/web/src/pages/map/components/MapCanvas.tsx` (render do ghost); `packages/web/src/lib/slots.test.ts` (fixtures migradas + 6 novos casos). `useNodeDrag.ts` intacto (trata Slot como opaco). Só frontend, AD-002 intacta.
**Addendum (review AD-013, 2026-06-26 — commit `94fbe68`):** a métrica aditiva `score = dx + dy` tinha um furo: o design assumiu "coluna = grupo", mas **pais de mesma profundidade/lado têm `colX` idêntico** (o flextree dá o mesmo eixo de depth a todos do nível). Como toda banda de grupo não-vazio cobre o Y inteiro, cada grupo co-coluna sempre tem um slot com `dy = 0` → `dx` empata, `dy` empata, e o desempate caía na **ordem de enumeração** (pai de cima sempre vencia) → soltar nos filhos do nó de baixo era roubado pelo de cima. **Fix:** seleção **lexicográfica** — (1) coluna por menor `dx`; (2) entre slots da mesma coluna, grupo por menor `groupDy` (dist. vertical ao span do grupo); (3) slot por banda. `Slot` ganhou `groupTop`/`groupBottom` (centro do 1º ao último card do grupo). O `dx` segue dominando a escolha de coluna ⇒ reparent, lados da raiz, snap-back e o "sem cap vertical" intra-grupo intactos; a única mudança é o desempate co-coluna (agora por Y, não por enumeração). Regressão coberta por 2 testes novos (sintético + layout real). Ver L-006.

### AD-020: M12 fatiado — "texto sempre visível + altura dinâmica" agora; resize horizontal vira M15 (2026-06-25)

**Decision:** O item de backlog "Card responsivo + resize horizontal" (ROADMAP M12) foi **dividido em dois milestones**. **M12** entrega só (a) texto do nó sempre 100% visível (remove `truncate`, quebra em linha + `break-words`) e (b) altura do card derivada de **medição real** do DOM (pipeline medir→layout), com a largura ainda **fixa** (`NODE_WIDTH=180`). O **resize horizontal** (largura arrastável por nó) vira **M15** — full-stack, com **largura persistida** (coluna `width Int?`) e **alça de resize revelada no hover**, decisões já fixadas nesta conversa.
**Reason:** O resize é a parte cara (revisa AD-002 com schema novo, threading de largura-por-nó em layout/slots/ghost/render, handle de UI). Fatiar entrega primeiro a dor principal ("não consigo ler o nó inteiro") com risco baixo (só frontend, sem schema) e isola a decisão arquitetural central (medir→layout) num milestone testável. Mesma disciplina de fatiamento já aplicada antes (M8→M9).
**Trade-off:** Duas idas ao canvas em vez de uma; a largura segue fixa até M15. Aceito: o pipeline medir→layout do M12 é justamente o pré-requisito do M15 (largura-por-nó já entra no layout), então não há retrabalho.
**Impact:** M12 só frontend (`nodeSize.ts` `nodeHeight`→`estimateNodeHeight`; `useTreeLayout` ganha 3º arg `heights?`; novo hook `useMeasuredHeights` com `ResizeObserver` compartilhado; `MapCanvas` fia medição + `fitView` pós-medida; `MindNode` remove `truncate` + `break-words`). **AD-002 intacta no M12** (sem x/y, sem coluna nova). **M15 revisará AD-002 parcialmente** (coluna `width`, espírito "sem posição livre", mesmo precedente do `side`/M9). `slots.ts`/geometria do drop fica para **M13** (que segue dependendo de M12). Convergência garantida pela invariância largura-fixa (ver `design.md`). Spec/design/tasks em `.specs/features/m12-card-responsive/` (19 req. M12-NN, 5 tasks).

### AD-019: `GET /maps` agrega `nodeCount`/`criticalCount`/`createdAt` na listagem; sem schema (2026-06-25)

**Decision:** A listagem de mapas (`GET /maps` + DTO `MapSummary`) passa a incluir três campos read-only para alimentar os cards da home redesenhada: `nodeCount` (total de nós do mapa), `criticalCount` (nós com `isCritical = true`) e `createdAt`. Implementado com **duas queries indexadas** por `mapId` e merge no handler: `prisma.map.findMany({ select: { …, _count: { select: { nodes: true } } } })` para o total + `prisma.node.groupBy({ by: ['mapId'], where: { isCritical: true }, _count: { _all: true } })` para os críticos (default 0 quando não há linha). **Única mudança de backend do M10.** Raw SQL com `COUNT(...) FILTER (WHERE is_critical)` numa query só fica como otimização **se a dor aparecer** (app single-user, poucos mapas).
**Reason:** Os cards do redesign são definidos por essas métricas + datas. Mantém type-safety do Prisma e testabilidade (vs. raw SQL). Reaproveita o índice `@@index([mapId])` já existente.
**Trade-off:** **`nodeCount` inclui a raiz** — um mapa recém-criado mostra "1 nó" (o POST cria o nó raiz). Alternativa rejeitada: `groupBy` com `parentId: { not: null }` para excluir a raiz. Escolhido incluir por simplicidade e por ser a contagem "honesta" de nós do mapa; documentado para não surpreender. Custo de 2 queries por listagem (aceitável; otimizável depois).
**Impact:** `packages/shared/src/map.ts` (`MapSummary` +3 campos; `MapDetail`/`MapListResponse` **intactos**); `packages/api/src/routes/maps.ts` (handler `GET /`) + `packages/api/src/mappers/maps.ts` (`toMapSummary` aceita `_count.nodes` + `criticalCount`). **Sem migration, sem campo novo no `Node`.** `GET /maps/:id/nodes` (AD-012) e demais endpoints intactos. Frontend consome via `useMaps` (tipo cresce, sem mudança de hook). Entregue em M10 (`.specs/features/m10-redesign/`), junto do reskin de home/canvas (reskin puro: AD-002/AD-003/AD-005 preservadas).

### AD-018: Lado (esq/dir) de ramo de 1º nível é estado persistido; balance vira heurística de criação (2026-06-25)

**Decision:** O lado de cada filho direto da raiz passa a ser **estado armazenado** (coluna `side Side?` no Node, `LEFT`/`RIGHT`, nullable — significativa só quando `parentId === root`; profundos e raiz ficam `null` e herdam o lado do ancestral de 1º nível) — **modelo (b)** da conversa de planejamento. O usuário controla o lado por drag e ele **persiste** após reload (inclusive deixar todos os ramos de um lado). A heurística de balance por peso de subárvore (M8/AD-016) é **rebaixada a default de criação**: ao criar um filho de 1º nível, o backend escolhe o lado mais leve (empate → `RIGHT`) e grava; ela **não re-equilibra** nós existentes. Entregue em M9 (`.specs/features/m9-drag-to-place/`), junto do **drag-to-place unificado** (todo drop é "soltar num slot" `(pai, posição[, lado])` → uma única mutação `move`) e do **card-fantasma** estilo MindMeister.
**Reason:** Sem lado persistido, qualquer troca de lado por drag seria desfeita no próximo layout (o split por peso recalculava tudo a cada render). O usuário quer controlar a organização (qual ramo vive de qual lado), o que exige persistir essa escolha. Escolhido o modelo (b) (estado no Node) sobre derivação por peso justamente para que a escolha do usuário sobreviva ao reflow.
**Trade-off:** Revisa **parcialmente AD-002** — passa a persistir **1 bit estrutural** de lado por filho de 1º nível. Mantém o espírito de AD-002: **nenhuma coordenada `x/y` livre** é persistida (o lado é "em que lado do centro este ramo vive", não posição em pixel). Custo: schema+migration+backend (antes M8 era só frontend); o `move` ganha tratamento de `side`; mapas legados precisam de backfill.
**Impact:** Schema: enum `Side` + coluna `side` (migration `20260625132913_add_node_side`). Backend: `create` grava lado default (heurística portada de `splitChildren` para `services/sides.ts`); `move` grava/limpa `side` mantendo a renumeração global e o anti-ciclo (AD-008) **intactos**; util `backfillSides(mapId)` (idempotente) + script one-off para mapas legados. Decisão-chave: `sortOrder` dos filhos da raiz é **global**; `side` é coluna **independente** — a conversão "slot visual de um lado → índice global" mora no frontend puro (`lib/slots.ts`). Frontend: `computeTreeLayout` lê `side` (não recalcula peso; fallback defensivo `null → RIGHT`); `lib/slots.ts` (computeSlots/nearestSlot/slotToMoveBody/isOriginSlot); `useNodeDrag` rastreia o slot-alvo e dispara `onPlace`; card-fantasma na camada de nós; optimistic de `useMoveNode` reflete índice+lado. **Revisa AD-016** (balance → criação) e **AD-002** (1 bit de lado). Ver L-006 (a registrar no review AD-013).

### AD-017: Canvas mantém auto-layout como fonte da verdade; "persistir posição" colapsa em reorder (2026-06-24)

**Decision:** Resolvida a Deferred Idea de "posicionamento dos nós" (AD-015): o canvas **mantém auto-layout** (AD-002 + M8) como fonte da verdade — **descartado** o posicionamento livre com `x/y` persistido. Consequência: sob auto-layout não há posição livre a persistir; o "posicionamento" que o usuário controla é só **ordem (`sortOrder`) + pai (`parentId`)**, ambos já persistidos. Logo a ideia original de "persistir posição" **vira reorder de irmãos via drag** (AD-011). Próxima feature **M9 — reorder**, puramente frontend.
**Reason:** O usuário escolheu auto-layout (conversa 2026-06-24). Posicionamento livre exigiria migration `x/y`, revisaria AD-002 e **competiria com o M8** recém-entregue (cada nó fixado é um nó que o layout balanceado deixa de arranjar), além de abrir as perguntas difíceis de modelo híbrido (descendentes de nó fixado, reflow, mistura auto+manual). Reorder fica dentro da AD-002, é compatível com M8, e o backend **já suporta** (`PATCH /nodes/:id/move` aceita `index` — AD-011/AD-008; a UI só sempre passa "último").
**Trade-off:** Usuário não pode fixar um nó numa coordenada arbitrária (segue valendo AD-002). Posicionamento livre fica como possível feature futura, separada, se a dor aparecer.
**Impact:** AD-002 mantida (sem `x/y`, sem schema). M9 é só frontend: detecção de zona de drop no `useNodeDrag` (miolo do nó = reparent; K+1 slots de inserção entre/around irmãos = reorder via `index`) + chamada do move com `index`. Fecha AD-011 e a Deferred Idea de posicionamento. Backend intacto.

### AD-016: Layout do canvas vira bidirecional horizontal, direção fixa (2026-06-24)

**Decision:** Trocar o layout do canvas de **vertical** (raiz no topo, escolhido em M7 pelo menor esforço) para **bidirecional horizontal** estilo MindMeister: raiz no centro, filhos de 1º nível repartidos e **balanceados por peso de subárvore** entre esquerda e direita, cada lado uma árvore horizontal crescendo para fora. Direção **fixa** — sem toggle na UI por enquanto. Primeira das "Deferred Ideas — direção do layout" de AD-015. Feature M8 em `.specs/features/m8-layout-bidirectional/`.
**Reason:** O vertical empilha tudo para baixo e desperdiça a largura da tela; o usuário trouxe um print do MindMeister como referência. Esclarecido na conversa que o print **não é radial 360°** (descartado: texto apertado/girado, maior esforço) e sim bidirecional — o "bem distribuído" do MindMeister é split balanceado, não metade/metade por ordem.
**Trade-off:** Reescreve `computeTreeLayout` (rodar `flextree` por lado + espelhar X do lado esquerdo + alinhar na raiz) — mais complexo que o flextree único vertical. Sem toggle significa que quem preferir vertical não tem opção (aceito; toggle vira feature futura se incomodar).
**Impact:** Só frontend — `lib/useTreeLayout.ts` (algoritmo + unit tests) e `pages/map/components/MapCanvas.tsx` (edges `LinkVertical`→horizontais ancoradas no centro da raiz). `fitView`, `useNodeDrag` (hit-test em `positioned`), `tree.ts`, `MindNode`, dialog, mutations e **todo o backend intactos**. AD-002 mantida (sem x/y persistido). **Design pulado** (feature pequena); o algoritmo de bidirecionalidade + critério de balanceamento estão fixados no `tasks.md` (T1). As outras 2 Deferred Ideas de direção (posicionamento livre, reorder de irmãos) seguem adiadas.
**Addendum (M9/AD-018, 2026-06-25):** o balance por peso é **rebaixado a heurística de criação** (escolhe o lado default de um novo filho de 1º nível) e **migra para o backend**; deixa de re-equilibrar nós existentes. O lado passa a ser **estado persistido** (coluna `side`), lido pelo `computeTreeLayout` no lugar do split por peso. Ver AD-018.

### AD-015: Canvas migra de React Flow para visx (d3-hierarchy + SVG + d3-zoom) (2026-06-23)

**Decision:** Substituir `@xyflow/react` pela stack visx — `d3-hierarchy` (layout), SVG + `d3-shape` (edges curvas), `d3-zoom` (pan/zoom). **Override consciente** do "stack fixado / não propor trocas" do CLAUDE.md, decidido pelo usuário após fase exploratória. É o primeiro upgrade pós-v1 (escopo `m7`). Os nós continuam sendo o componente HTML `MindNode` (M5/M6) posicionado **por cima** do SVG (abordagem híbrida) — não viram desenho SVG. Backend 100% intacto (adjacency list, `sortOrder`, endpoints). `elkjs` + web worker de layout saem (d3-hierarchy é síncrono, O(n)).
**Reason:** A atribuição/logo do React Flow só sai com licença Pro paga — dealbreaker ético para o usuário (que já havia removido `hideAttribution` em Q-005 justamente por isso). A migração também destrava controle total sobre curvas de edge e direção de layout (outras queixas do usuário), mas **essas melhorias são decisões adiadas** (ver Deferred Ideas) — esta migração é estritamente paridade.
**Trade-off:** Perde-se o que o React Flow dava de graça (pan/zoom, drag, background, fitView) — reimplementado com d3-zoom/SVG. Custo de reescrever a camada de canvas (`MapCanvas`, `MindNode`). Os 40 usos do seletor `.react-flow__node` nos e2e precisam migrar para uma nova classe/data-testid.
**Impact:** `MapCanvas.tsx` e `MindNode.tsx` reescritos; `layout.worker.ts` removido; `useLayoutedTree`/`treeLayout`/`nodeSize` adaptados ou substituídos por d3-hierarchy. Deps: remove `@xyflow/react` + `elkjs`, adiciona visx/d3. Substitui parcialmente **AD-009** (worker elkjs) e ataca o concern de performance do `simpleTreeLayout` síncrono. Feature em `.specs/features/m7-canvas-visx/`.
**Addendum (design, 2026-06-23):** pesquisa verificada (fontes primárias) ajustou 2 premissas: (1) `@visx/zoom` v4 **não embrulha mais d3-zoom** — usa `@use-gesture/react`; o pan/zoom vem do `<Zoom>` do visx (o `toString()` dá uma `matrix()` CSS aplicável ao SVG das edges **e** ao `<div>` dos nós HTML). (2) Alturas de nó variáveis (40/58px) exigem **`d3-flextree`** (o `<Tree>`/`d3.tree()` só fazem `nodeSize` uniforme). Drag-to-reparent via **pointer events manuais** + `zoom.applyInverseToPoint` (não `@visx/drag`). Direção do layout: **vertical** (menor esforço). Ver `design.md`.

### AD-014: Playwright para smoke de UI em milestones com interação nova (2026-05-18)

**Decision:** Milestones que entregam interação UI nova (drag, edit inline, dialogs, etc.) passam a ter pelo menos 1 spec Playwright por user story P1, cobrindo o "Independent Test" descrito na user story. Roda via `pnpm test:e2e` separado de `pnpm test` (Vitest). Começa enxuto — 1 happy path por story — e expande conforme dor aparecer.
**Reason:** Review de M3 revelou 3 bugs que só apareceriam em uso interativo: buttons invisíveis até hover, worker layout sem update, "root não edita". AD-007 ("UI declarativa = sem testes") cobre componentes estáticos, mas falha em milestones com canvas/edição/drag. A própria AD-007 deixa porta aberta: "quando dor aparecer, adicionar". Apareceu.
**Trade-off:** Setup inicial (Playwright + config + DB de teste isolado). Specs e2e são mais frágeis que unit (timing, seletores). Para ferramenta single-user o custo é não-trivial, mas a UI é o produto.
**Impact:** Novo script `pnpm test:e2e` em `packages/web`. Pasta `packages/web/e2e/`. Em M4+, parte do Definition of Done é "specs e2e do milestone passam". AD-007 segue válido para componentes/lógica pura; substituído **apenas** para interação UI nova. Setup do Playwright vira feature/quick task própria — não entra em M3.

### AD-013: Fase de Review obrigatória pós-Execute na TLC (2026-05-18)

**Decision:** Adiciona uma fase "Review" entre Execute e o update do STATE.md para "concluído". Roda num chat separado (alinhado a [[feedback-plan-execute-split]]), preferencialmente delegando a um sub-agent independente que não viu o execute. Output mínimo: relatório de bugs + gaps + lições, com referências `file:linha`. Findings vão pra `.specs/codebase/CONCERNS.md` (técnicos) e `STATE.md` (processo/blockers/decisões). Milestone só pode ser marcado "concluído" depois.
**Reason:** Review pós-M3 pegou: STATE.md mentindo sobre "18 commits" (eram 14, T3 vazio, T4-T6 nunca commitados), lint quebrando o próprio Success Criteria do spec, fragilidades de padrão React Flow não documentadas. Nada disso teria sido pego por hooks/regras/memórias dependentes de boa vontade do agente. Review independente é o cinto que pega o que automação não pega.
**Trade-off:** Adiciona ~1 chat por milestone. Solo dev acumula latência. Mitigado por: review é barata (só leitura/análise, sem código), e o custo de não fazer é dívida silenciosa herdada pelo próximo milestone.
**Impact:** Antes de atualizar `Current Work` no STATE.md para "X concluído", abrir chat de review apontando pro `tasks.md`/`spec.md` do milestone. Eventualmente formalizar como skill custom (extensão de `tlc-spec-driven`); por ora é convenção manual.

### AD-012: `GET /maps/:id/nodes` retorna lista plana (2026-05-17)

**Decision:** Endpoint dedicado `GET /maps/:id/nodes` retorna `{ nodes: NodeDto[] }` em lista plana ordenada por `(parentId, sortOrder)`. Cliente monta a árvore. `MapDetail` permanece sem campo `nodes`.
**Reason:** Desacopla leitura de metadata vs. estrutura. Tree-building em adjacency list é trivial no cliente. Evita server-side transform que viraria útil em outro lugar.
**Trade-off:** Cliente paga custo (negligível) de construir a árvore. Duas chamadas para abrir um mapa (metadata + nodes) — mas TanStack Query cuida disso paralelamente.
**Impact:** Hooks separados `useMap(id)` + `useNodes(mapId)` no frontend. Invalidação cirúrgica por query key.

### AD-011: Move em M3 cobre apenas drag-to-reparent (2026-05-17)

**Decision:** Em M3, drag-and-drop muda `parentId` (drop sobre outro nó) e coloca no final. Reorder entre irmãos do mesmo pai (drag vertical) não entra em M3.
**Reason:** US-02 menciona apenas "mover nó para outro pai via drag-and-drop". Reorder dentro do mesmo pai é refinamento de UX — vira deferred idea.
**Trade-off:** Usuário não consegue reordenar irmãos via drag em v1 (precisa de API direta ou da próxima iteração).
**Impact:** `MoveNodeBody.index` existe e funciona, mas a UI sempre passa "último". Adicionar reorder depois é só implementar o detect-of-vertical-drop no frontend.

### AD-010: M3 já persiste cada mutação estrutural (2026-05-17)

**Decision:** Cada add/rename/delete/move no canvas chama a API imediatamente via TanStack Query mutation. M4 não introduz persistência — formaliza contrato, cobre edge cases de rede e restauração completa.
**Reason:** Separar canvas funcional de canvas persistido criaria refactor amplo desnecessário; a infra de mutation/invalidate já está pronta (M2). Persistir desde o início também valida o contrato.
**Trade-off:** M3 herda alguma responsabilidade de M4 (feedback de erro de rede). M4 fica mais leve.
**Impact:** Tasks de M3 incluem `useMutation`+invalidate em cada interação. M4 pode focar em otimizações (optimistic, retries) e edge cases de offline/conflito.

### AD-009: elkjs roda em web worker dedicado (2026-05-17)

**Decision:** Layout via `elkjs` é executado em web worker (`layout.worker.ts`); main thread só envia/recebe mensagens.
**Reason:** RNF-01 exige canvas responsivo até 500 nós. elkjs em árvores grandes pode levar centenas de ms — bloquear main thread mata pan/zoom.
**Trade-off:** Setup ligeiramente mais complexo (Vite suporta `new Worker(new URL(...))` nativo). Worker isolado é mais difícil de testar — postergamos teste do worker em si.
**Impact:** Hook `useLayoutedTree` encapsula a comunicação. Cleanup necessário no unmount. Decidir tamanho default de nó (180×40 sugerido) na implementação.

### AD-008: `sortOrder` em inteiros com renumeração transacional (2026-05-17)

**Decision:** `sortOrder` é `int` sequencial (0, 1, 2, …). Em `move`, renumeramos todos os irmãos afetados (origem e destino) dentro de transação Prisma. `create` apenas appenda `max+1`.
**Reason:** Simplicidade > fractional indexing para o caso de uso (poucos irmãos por nó em mindmap pessoal). Previsível, sem precisão flutuante, sem degradação ao longo do tempo.
**Trade-off:** Move custa O(N) writes para N irmãos. Aceitável; pode otimizar se aparecer dor.
**Impact:** Endpoint `PATCH /nodes/:id/move` faz transação (anti-ciclo via `WITH RECURSIVE` + renumeração). `DELETE` não renumera (gaps são tolerados — ordenação relativa preserva).

### AD-001: Stack inteira definida no spec inicial (2026-05-17)

**Decision:** React + Vite + TS no frontend, Fastify + Prisma + Node no backend, Postgres via Supabase, monorepo pnpm com `web/api/shared`.
**Reason:** Spec do usuário já trouxe a stack como constraint, com justificativas por item (ver `source-spec.md` §5).
**Trade-off:** Sem flexibilidade para reavaliar SSR ou outro framework de canvas; React Flow + elkjs assumidos.
**Impact:** Design/Plan tratam essas escolhas como dadas; novos AD apenas refinam dentro delas.

### AD-002: Posições absolutas dos nós não são persistidas (2026-05-17)

**Decision:** Persistir apenas estrutura hierárquica + `sort_order`. Layout sempre recalculado no frontend via elkjs.
**Reason:** Mindmap é hierárquico e layout determinístico — armazenar posições gera deriva e custo sem ganho.
**Trade-off:** Usuário não pode "fixar" um nó numa coordenada específica; ordenação é por `sort_order` dentro do pai.
**Impact:** Schema do Node não tem campos `x/y`. Reorder por drag-and-drop deve mapear para mudança de `sort_order` e/ou `parent_id`.
**Addendum (M9/AD-018, 2026-06-25):** revisada **parcialmente** — passa a persistir **1 bit estrutural** de lado (`side` `LEFT`/`RIGHT`) por filho de 1º nível. Segue **sem `x/y`** (nenhuma coordenada livre): o lado é "em que lado do centro o ramo vive", não posição em pixel. Ver AD-018.
**Addendum (M15/AD-023, 2026-06-27):** revisada **parcialmente** de novo — passa a persistir **largura inteira** (`width Int?`) por nó. Segue **sem `x/y`** (nenhuma coordenada livre): a largura é dado de apresentação, não posição em pixel. Mesmo precedente do `side`. Ver AD-023.

### AD-003: Propriedades de tarefa moram no próprio Node (2026-05-17)

**Decision:** `status`, `assignee`, `is_critical` ficam no Node, não em uma tabela separada `Task`.
**Reason:** "Qualquer nó pode ser tarefa" — separar criaria join obrigatório sem benefício.
**Trade-off:** Schema do Node fica mais largo; nulls para nós sem propriedades de tarefa.
**Impact:** Exibição progressiva no canvas: front filtra por null/default e decide o que renderizar.

### AD-004: `is_collapsed` fica apenas no cliente em v1 (2026-05-17)

**Decision:** Estado de expand/collapse vive apenas em memória do cliente (estado do React/React Flow). Não persistido em banco.
**Reason:** Simplicidade — evita coluna extra, requests de update a cada toggle, e debate sobre sincronização entre sessões.
**Trade-off:** Reabrir um mapa sempre começa com todos os ramos expandidos. Desvio explícito do critério de US-05 ("estado de expand/collapse é restaurado").
**Impact:** Schema Node não tem `is_collapsed`. M4 não precisa cobrir restauração desse estado. Pode virar deferred idea se incomodar no uso.

### AD-007: Postura de testes em v1 — unit + smoke manual (2026-05-17)

**Decision:** Vitest com unit tests co-localizados (`*.test.ts` ao lado do source) apenas para código com lógica não-trivial (handlers, funções puras, parsers). Integração web↔api↔db verificada manualmente até doer. Sem e2e em v1.
**Reason:** Ferramenta single-user, custo de regressão baixo, ROI de integration/e2e tests não compensa setup em v1. Vitest é barato; entra onde tem ganho real.
**Trade-off:** Regressões em SQL/Prisma podem passar despercebidas até o uso. Refatorações em endpoints sem cobertura ficam mais arriscadas.
**Impact:** M1 configura Vitest mas não pede integration test. Tasks de UI puramente declarativa (React render sem lógica) ficam com `Tests: none`. Quando dor aparecer, adicionar integration tests com DB de teste.
**Addendum (2026-05-18):** A postura "UI sem testes" foi parcialmente substituída por **AD-014** para milestones que entregam interação UI nova (drag, edit inline, dialogs). AD-007 segue válido para componentes/lógica pura e para milestones sem interação nova.

### AD-006: Postgres self-hosted em VPS Hostinger em vez de Supabase (2026-05-17)

**Decision:** Banco de dados será um Postgres já existente em VPS Hostinger do usuário. Supabase descartado.
**Reason:** Usuário já tem infra rodando e prefere não criar dependência externa adicional. Custo zero adicional (VPS já paga).
**Trade-off:** Sem dashboard Supabase, sem backups gerenciados automáticos, sem Row Level Security pronto, sem Edge Functions. Usuário precisa cuidar de firewall, backups e SSL na VPS. Para ferramenta single-user é aceitável.
**Impact:** `DATABASE_URL` aponta para `localhost:5432` (lado local de um túnel SSH). Postgres na VPS só escuta em `localhost` — acesso via `ssh -L 5432:localhost:5432 root@<VPS_HOST> -N`. Database `mindmap` já existe; user único (admin) usado também pela aplicação em v1. SSL desabilitado (SSH já criptografa). Credenciais e IP da VPS vivem só em `packages/api/.env` (gitignored), nunca no repo. Adjacency list com `WITH RECURSIVE` funciona idêntico em qualquer Postgres.

### AD-005: Cor de nó via paleta fixa em vez de color picker livre (2026-05-17)

**Decision:** US-03 entrega seleção de `bg_color` e `text_color` via paleta predefinida (botões/swatches), não picker livre de hex/RGB.
**Reason:** Simplicidade — evita dependência ou implementação de color-picker. Paleta curada também produz mapas visualmente mais coerentes.
**Trade-off:** Usuário não escolhe cores arbitrárias. Se quiser uma cor específica fora da paleta, precisa de release futura.
**Impact:** Schema do Node ainda guarda cor como string (hex ou ID de swatch). Componente do dialog vira grid de swatches. Paleta concreta (quantidade e tons) é decisão de implementação durante M5.

---

## Active Blockers

*(nenhum blocker ativo)*

---

## Lessons Learned

### L-001: Validar gates antes de marcar milestone como concluído (2026-05-18)

**Context:** STATE.md afirmava "M3 concluído (18 tasks, 18 commits)" desde 2026-05-17. Review em 2026-05-18 mostrou: (a) só 14 commits `feat(m3)`/`test(m3)` existem — T3 é commit vazio e T4/T5/T6 nunca foram commitados (todo o backend de Node foi empacotado em T2, violando o princípio de atomicidade declarado em `tasks.md:22`); (b) `pnpm lint` falha contra o próprio Success Criteria do spec.
**Problem:** "Concluído" foi declarado sem rodar a tríade do Success Criteria (`pnpm typecheck && pnpm lint && pnpm test`) e sem conferir o histórico de commits contra a lista de tasks.
**Solution:** Antes de atualizar STATE.md/ROADMAP para "concluído": (1) rodar `pnpm typecheck && pnpm lint && pnpm test` localmente; (2) `git log --oneline | grep "feat(<scope>): T"` e cruzar com a lista de tasks em `tasks.md`; (3) reproduzir um caminho golden da feature no browser antes de fechar o milestone.
**Prevents:** Marcar trabalho como pronto enquanto gates estão abertos; herdar dívida silenciosa para o próximo milestone (M4 começaria sobre lint quebrado e atomicidade ilusória).

### L-002: Review independente M5 — processo saudável, bug pré-existente exposto (2026-05-20)

**Context:** Review AD-013 do M5. Gates: typecheck ✅, lint ✅, API tests 36/36 ✅, e2e 15/16 (8 M5 tests ✅). A falha `smoke.spec.ts:9` (foco no inline edit) é pré-existente — reproduz sem commits M5 (confirmado via `git stash`). Commits: 8 atômicos (T1–T7 + chore), todos no formato correto. Cobertura: 22/22 requisitos (M5-01 a M5-22) implementados. Nenhum bug funcional novo introduzido.
**Findings registrados em CONCERNS.md:** (1) `smoke.spec.ts:9` falha por race entre foco do MindNode e sync `rfNodes`/`useNodesState`; (2) cleanup do `useEffect` de foco não cancela `setTimeout`; (3) inline edit ignora `textColor` customizado (cosmético); (4) `persistence.spec.ts` tem teste de move não commitado (remanescente M4).
**Takeaway:** M5 é o primeiro milestone a passar review AD-013 sem findings bloqueantes. A disciplina de atomic commits e gates funcionou. O bug de foco pré-existente valida a decisão de documentar fragile areas — o padrão `rfNodes`/`useNodesState` continua sendo a raiz de problemas.

### L-003: Review independente M6 — aprovado; e2e pega o que a leitura não pega (2026-06-23)

**Context:** Review AD-013 do M6. Gates reexecutados no review: typecheck ✅, lint ✅, unit ✅ (api 42, web 36). e2e: **as 6 specs de M6 (`task-properties.spec.ts`) passam todas**; cobertura 22/22 requisitos (M6-01 a M6-22). Backend (PATCH estendido + Zod), helpers (`getInitials`/`hasTaskProps`), componentes (StatusSelector, NodeTaskIndicators, dialog) e integração de layout (`nodeHeight` no worker + fallback) conferem com o design. Optimistic + rollback + toast reusados sem mudança.
**Finding principal:** rodar o `test:e2e` (que eu inicialmente pulei, confiando na contagem da `tasks.md` — erro de processo apontado pelo usuário) revelou 1 falha **determinística** em `persistence.spec.ts:136` ("mover nó"). **Provado não ser regressão de M6:** revertendo `MindNode.tsx` + `layout.worker.ts` + `treeLayout.ts` para pré-M6 (`e7095ed`) a falha persiste idêntica. Causa: seletor frágil `.first()` + DB de e2e compartilhado/acumulativo. Registrado em `CONCERNS.md` (Known Bugs) + fechado o item de validação aberto em "Test Infrastructure".
**Findings menores (não bloqueantes):** contraste do estado ativo dos botões de status (white sobre verde/cinza — label visível cumpre M6-22, é polimento); input de responsável dessincroniza em rollback (padrão herdado do título M5).
**Takeaway:** reforça L-001 e a própria AD-013 — "review independente" exige **rodar os gates**, não reler o relatório do executor. A leitura aprovaria a M6; só o e2e expôs o teste frágil. Segundo milestone consecutivo a passar review sem findings bloqueantes novos.

### L-004: Review independente M7 — aprovado; migração visx em paridade, gates verdes (2026-06-24)

**Context:** Review AD-013 do M7 (migração React Flow → visx). Gates reexecutados: typecheck ✅, lint ✅, unit ✅ (web 41 — inclui `useTreeLayout` 6 + `useNodeDrag` 5 novos; api 42), e2e **22/22** ✅. Grep confirma zero resíduos de `@xyflow`/`elkjs`/`layout.worker`/`useLayoutedTree`/`treeLayout` em `src`/`e2e`/`package.json`. Fonte única `positioned` (M7-24), input inline controlado via setState em render-phase (M7-25), drag-to-reparent por pointer events com clamp de index no backend (AD-011). Backend/mutations/dialog intactos; AD-002 mantida (sem x/y). Commits T1–T6 atômicos e no formato.
**Finding notável:** `persistence.spec.ts:136` (mover nó), flaky histórico (`.first()` + DB compartilhado — L-003), passou verde nesta execução. Seletor migrado sem tentar consertar a fragilidade (escopo T5); verde é circunstancial, o concern do `.first()` segue em CONCERNS.md.
**Findings menores (não bloqueantes):** (1) spec tinha 2 linhas stale dizendo "direção horizontal" enquanto design/implementação fixaram **vertical** pela decisão "livre/menor esforço" — **corrigido** na spec neste review; (2) `fitView` roda 1× por mount (`fittedRef`) e `MapCanvasInner` não tem `key={mapId}` — latente sem impacto (navegação é sempre mapa→home→mapa, MapPage desmonta); (3) hit-test do drag usa o ponto do cursor, não o centro do nó (`design.md:172` dizia centro) — funcionalmente equivalente, coberto por e2e.
**Takeaway:** terceiro milestone consecutivo a passar review AD-013 sem findings bloqueantes. A disciplina de adicionar módulos novos ao lado dos antigos (T1–T3) antes da troca (T4) e só então remover o morto (T6) manteve cada commit compilável. A Fragile Area do `rfNodes`↔`useNodesState`, raiz recorrente em L-002/L-003, foi **eliminada por design** com a fonte única.

---

### L-005: Review independente M8 — aprovado; smoke visual continua sendo o gate que pega o que unit não pega (2026-06-24)

**Context:** Review AD-013 do M8 (layout bidirecional horizontal). Gates reexecutados: typecheck ✅, lint ✅, unit ✅ (web 48 — `useTreeLayout` 6→13; api 42), e2e **22/22** ✅ (incl. `persistence.spec.ts:136`, flaky histórico, verde nesta run). Matemática do layout (split balanceado guloso/determinístico, flextree por lado, espelhamento −x, alinhamento em breadth, ancoragem de edges com vão GAP_X exato, top-left) verificada por leitura + reviewer independente — **convergiram, sem bug de geometria**. Commits T1–T3 atômicos e no formato; 18/18 requisitos; diff só 3 arquivos de frontend; AD-002 intacta (sem x/y, sem schema).
**Findings (não-bloqueantes):** (1) `useTreeLayout.test.ts:165-189` ("alturas não se sobrepõem") é **vacuoso** — com 2 filhos o split manda 1 por lado, o loop de comparação nunca roda; o caso real (irmãos co-laterais de alturas distintas) fica descoberto (registrado em CONCERNS.md → Test Gaps). (2) CONCERNS.md ficou **stale pós-M7**: Fragile Areas/Perf/Known-Bug referenciam `rfNodes`/`useLayoutedTree`/`treeLayout`/`.react-flow__node` que o M7 removeu (anotado para reconciliação dedicada).
**Takeaway:** quarto milestone consecutivo a passar review AD-013 sem findings bloqueantes. Reforço da própria T3 do M8: o **smoke visual (screenshot Playwright)** já tinha pego, na execução, o bug do `LinkHorizontal` trocar x↔y que typecheck/lint/unit não pegavam — a tríade prova corretude de cálculo, não de render. A lacuna de teste encontrada no review (não-sobreposição vacuosa) é justamente uma asserção geométrica que passou verde sem testar nada — vigiar testes que "passam" mas cujo corpo não executa.

### L-006: Review independente M13 — finding bloqueante; teste de coluna única não cobre multi-grupo (2026-06-26)

**Context:** Review AD-013 do M13 (seleção de slot por band vertical). Gates reexecutados: typecheck ✅, lint ✅, unit web 102 ✅. e2e/smoke visual **não rodados** (túnel SSH do Postgres down, AD-006). O usuário avisou, antes do review, que "ainda tem uns casos que a barra se comporta de forma estranha" — pista que guiou a auditoria.
**Finding (bloqueante, corrigido):** o M13 resolveu o flip **intra-grupo**, mas deixou passar o caso **inter-grupo co-coluna**: dois pais de mesma profundidade/lado têm `colX` idêntico, e a métrica `dx + dy` empatava (cada grupo tem um slot `dy=0`) → desempate por ordem de enumeração roubava o drop pro nó de cima. Reproduzido com `computeTreeLayout` + `computeSlots` reais (não só unit sintético). **Causa do escape:** o smoke visual da T5 e os unit da T4 só exercitaram **coluna única / grupo único** — nenhum cobria duas subárvores partilhando coluna. Corrigido na mesma sessão (AD-021 addendum, commit `94fbe68`) + 2 testes de regressão.
**Takeaway:** reforça L-005 — a tríade prova corretude de cálculo, não de render nem de **configuração estrutural**. Quando um milestone mexe em geometria de seleção, o gate precisa de fixtures com a topologia que dispara o bug (múltiplos grupos, profundidades repetidas), não só o caso feliz de um grupo. O aviso do usuário ("ainda tá estranho") foi mais barato que qualquer gate — ouvir o relato de uso e **reproduzir antes de aprovar**.

### L-007: Reviews AD-013 de M9/M11/M12 — deploy escalou silenciosamente um concern de teste latente (2026-06-27)

**Context:** Os três reviews pendentes (M9, M11, M12) rodados juntos, cada um delegado a um sub-agent independente. Veredito unânime: **APROVADO COM RESSALVAS, zero bloqueantes**. Gates não-DB verdes (typecheck/lint/unit web 104). DB-dependentes (integração API 54, e2e, smoke visual) **dispensados** — túnel down (AD-006) + uso real do app deployado sem anomalias (smoke manual, L-005).
**Finding de processo principal — o deploy transformou "polui dev" em "polui prod":** o review descobriu que o `webServer` do Playwright (`playwright.config.ts:33`) sobe a API com `run dev` = `tsx watch src/server.ts`, que carrega `.env` (`src/env.ts:2`, `config()` sem path) → banco **`mindmap`**. Pós-AD-022, `mindmap` é o banco de **produção**. Logo `pnpm test:e2e` (e qualquer `pnpm dev` local) escreve nos mapas reais do usuário. O isolamento de "DB de teste" que se acreditava existir (Q-002/Q-003, AD-014) só valia para o **Vitest da API** (`.env.test` → `dev_mindmap`), **nunca para o Playwright** — concern já registrado em CONCERNS.md (Test Infrastructure) desde M6, agora escalado a HIGH. **Takeaway:** quando uma mudança de infra altera *para onde* uma connection string aponta (aqui, `.env`/`mindmap` virou prod no deploy), re-auditar **todos** os consumidores do env default, não só o serviço que mudou — um `.env` que era inócuo em dev pode virar uma arma apontada para produção sem nenhuma linha de código de teste mudar.
**Findings de processo secundários:** (1) **M11 — STATE.md mentia (L-001):** declarava "3 commits atômicos" e o overflow como resolvido em `4d1eefe`, mas o fix era **incompleto** (faltava `min-w-0` no grid item raiz do `DialogContent`) e só fechou em `e233492`, **posterior** ao docs `b193294` que já marcava "gates verdes". O repro Playwright que comprovaria o fix só veio no 2º commit. Reforça L-001: não declarar fix completo sem reproduzir o caso-alvo. (2) **M9 — `81d1028` foi bug visual que escapou do verify:** o card-fantasma da T9 renderizava cortado/atrás dos cards (placeholder do tamanho do card, sem `zIndex`); a tríade e até o e2e (`toBeVisible()` não testa oclusão) não pegariam — só smoke visual. O `design.md` ficou stale (placeholder→barra) até AD-021 reconciliar. Reforça L-005: rodar smoke visual **antes** de fechar commit com render novo.
**Prevents:** rodar a suíte e2e contra produção; herdar a falsa sensação de "DB de teste isolado"; declarar milestone/fix completo sem o gate que comprova o caso-alvo.

### L-008: Sobreposição no resize — premissa de `n.y` (d3-flextree) não verificada (pós-M15, 2026-06-27)

**Context:** Usuário relatou cards se sobrepondo após o resize (filho mais largo invadindo o pai). Só ocorria com larguras variáveis — invisível antes do resize (todos 180).
**Problem:** `computeTreeLayout` tratava `n.y` do d3-flextree como o **centro** do nó no eixo de profundidade (subtraía `w/2` do próprio nó). Na verdade `n.y` é a **borda-near** (cumulativa a partir da raiz; van der Ploeg). Com larguras uniformes o erro se cancela (deslocamento vira constante); com larguras distintas, o offset por-nó desalinha e a sobreposição = `(w_filho − w_pai)/2 − GAP_X` (no print: 180/420 → ~86px). O `design.md` do M15 **explicitamente pediu** "⚠️ Verificar a semântica de `n.y`" — a verificação não foi feita, e o teste de não-sobreposição existente usava filho mais **estreito** que o pai, que não dispara o bug.
**Solution:** Deslocamento p/ centrar a raiz passa a ser a constante `rootW/2` (não `w/2` por nó). Confirmado por **probe direto** do d3-flextree (root.y=0, child.y=rootDepthSize ⇒ borda-near) antes de mexer, + teste de regressão com filho mais largo que o pai (RIGHT e LEFT).
**Prevents:** Aceitar premissa de API de layout sem verificar; cobrir geometria só com o caso que **não** dispara o bug (reforça L-005/L-006 — fixtures precisam da topologia que quebra).

### L-009: Review independente M15 — aprovado; probe empírico fecha o risco geométrico da L-008 (2026-07-02)

**Context:** Review AD-013 do M15 (resize horizontal), 3 sub-agents independentes (backend, geometria, gesto). Gates reexecutados: typecheck ✅, lint ✅, unit web 118 / api 61, e2e 37/37 (banco dev — L-007 não se aplica mais, `.env` repontado). Veredito unânime: **APROVADO, zero bloqueantes**. Todos os findings Low → CONCERNS.md.
**Finding metodológico principal:** a área que a L-008 tinha acabado de queimar (semântica do `n.y` do d3-flextree) foi fechada **empiricamente** — o reviewer de geometria escreveu um probe que importou o `d3-flextree` real e imprimiu `.y` de raiz/filhos/netos com larguras mistas (180→180→420→100), confirmando `n.y = parent.y + parentW + GAP_X` (borda-near cumulativa) e que `depthShift = rootW/2` constante ⇒ gap pai→filho `= GAP_X` exato para qualquer largura, em LEFT e RIGHT. O teste de regressão de sobreposição foi verificado **não-vacuoso** (filho 420 > pai 180 dispara a topologia da L-008). Reforça L-005/L-006/L-008: quando um milestone mexe em geometria de layout, o gate mais barato e conclusivo é **provar a premissa da API contra a lib real** (probe), não só reler o cálculo.
**Finding de higiene de reversão:** a AD-024 (largura-por-conteúdo) foi revertida a pedido do usuário; o review confirmou por grep dirigido (`nextWidths|measuredWidth|useMeasuredSizes|max-content|widthFn`) que **não sobrou resíduo** — as únicas ocorrências restantes são o `widthFn` legítimo do override de resize e o `max-content` **dentro** de `measureContentWidth` (medição pontual do teto, que não realimenta a largura). Takeaway: toda reversão parcial merece um grep dirigido às superfícies que a tentativa tocou, não só "os testes passam".

## Quick Tasks Completed

| #   | Description | Date | Commit | Status |
| --- | ----------- | ---- | ------ | ------ |
| Q-001 | B-001: fix lint (useLayoutedTree, MapCanvas, tree.test) | 2026-05-19 | 632e58c | concluído |
| Q-002 | Setup Playwright (AD-014): config, `pnpm test:e2e`, pasta `e2e/`, `vitest.config.ts` | 2026-05-19 | 632e58c | concluído |
| Q-003 | Nó raiz usa título do mapa + clique-para-editar no texto + banco de testes isolado | 2026-05-19 | 018885f | concluído |
| Q-004 | Refactor(web): colocação de componentes por página + reuso do design system | 2026-05-19 | 8868233 | concluído |
| Q-005 | Cleanup pré-M4: shadcn/ui v2 (Base UI), remove hideAttribution, extrai request<T>, remove código morto | 2026-05-19 | — | concluído |
| Q-006 | Commitar teste de move em `persistence.spec.ts` (remanescente M4) | 2026-05-20 | ad520ec | concluído |
| Q-007 | Fix foco no inline edit do MindNode (`smoke.spec.ts:9`): forwardRef no Input + ref callback | 2026-05-20 | 46773e4 | concluído |
| Q-008 | Fix overflow do `ConfirmDialog` com palavra única gigante (`min-w-0` no header + `break-words`); achado em uso pós-M12, verificado por screenshot | 2026-06-25 | aee4a2b | concluído |
| Q-009 | Rename inline do card da home fecha ao confirmar (`onCancel`→`onClose`, `finally`); bug pré-existente da review AD-013 de M10 | 2026-07-02 | 4c0f2e4 | concluído |
| Q-010 | Poda `refCallbacks` no unregister do `useMeasuredHeights` (micro-leak da review AD-013 de M12) | 2026-07-02 | 4ceb8e6 | concluído |
| Q-011 | Endurece gesto de resize: `onPointerCancel` + persistência via `resizeRef` (não closure) + assert e2e `width>180` (findings da review AD-013 de M15) | 2026-07-02 | ba969ff | concluído |
| Q-012 | Cobre `width` não-inteiro (400) e nó-novo-`null` no PATCH/POST (gap da review AD-013 de M15); api 61→63 | 2026-07-02 | ed9c7ce | concluído |
| Q-013 | Torna e2e "mover nó" robusto: cria filhos via API + cleanup, elimina `.first()` frágil (Known Bug `persistence.spec.ts:136`, L-003) | 2026-07-02 | ec2800e | concluído |

---

## Deferred Ideas

Ideias adiadas que apareceram durante planejamento. Veja também a seção "Pós-v1" do ROADMAP.

**Zod para validação de formulários no frontend (levantado durante a execução do M20, 2026-07-05):** hoje a validação client-side (`pages/auth/validation.ts` do M19, `pages/profile/validation.ts` do M20) é feita com funções puras manuais (regex/checks); zod já é dependência do `packages/api` (schemas de rota) mas não do `packages/web` nem do `@mindmap/shared`. O usuário sinalizou que faz sentido padronizar os forms do frontend em cima de zod em vez de continuar criando validações manuais ad-hoc — mas decidiu adiar (ver AD-028), não bloquear o M20 por isso. Ao pegar essa ideia: decidir se os schemas migram para `@mindmap/shared` (reuso client+server, ex. `NameField`/`EmailField` do `packages/api/src/routes/auth.ts`) ou ficam duplicados por camada; tocaria `AuthPage` (M19) e `ProfilePage` (M20) na mesma leva.

**Refinamento de UX pós-M10 — backlog registrado no ROADMAP (M11–M14, 2026-06-25, conversa de planejamento):** 6 pontos levantados em uso real, já mapeados no código. Breadcrumbs para as specs/execução (chats separados, [[feedback-plan-execute-split]]):

- **(M11) Ícones de texto → lucide:** `▲` em `MindNode.tsx:172` + `NodeEditDialog.tsx:159`; `✓/!/⚠` (`CONTRAST_ICON`) em `NodeEditDialog.tsx:57-59` (render `:198`); `←` em `MapPage.tsx:22,32`. Padrão lucide já em `MindNode.tsx:2`. `—` placeholder (`NodeEditDialog.tsx:271`) fica.
- **(M11) Divisória título/footer no card:** existe no dialog (`NodeEditDialog.tsx:170`, `border-t` condicional + `dividerColor` dark/light) mas falta no `MindNode` — adicionar entre título e `NodeTaskIndicators`, condicional a `hasTaskProps`. `cardSkin` (`MindNode.tsx:44`) já adapta cor por luminância.
- **(M11) Overflow do dialog com texto longo:** `DialogContent` estreito (`sm:max-w-sm`); linha de responsável (`NodeEditDialog.tsx:269`) e preview sem `overflow`/`break-words`. Fix CSS.
- **(M12 — planejado, ver Current Work + AD-020) Card responsivo:** **fatiado** — M12 = texto sempre visível + altura dinâmica (só frontend, pipeline medir→layout via `ResizeObserver`+`d3-flextree`); resize horizontal → **M15** (full-stack, `width` persistida + alça no hover). Spec/design/tasks em `.specs/features/m12-card-responsive/`.
- **(M13, depende de M12) Drag indicator assimétrico:** `lib/slots.ts:62-69` usa média das bordas com `PLACEHOLDER_H=40` fixo; cards variam 40/58 → barra desloca pro card maior (daí "tende a subir" / cola no de baixo). Render em `MapCanvas.tsx:130-143` (`GHOST_BAR_HEIGHT=6`). Recalibrar quando as alturas virarem dinâmicas (M12).
- **(M14, muito design) Hierarquia visual:** skin por profundidade (`cardSkin(depth)`, `MindNode.tsx:44`); edge herdar cor do nó de 1º nível (hoje `stroke-border` fixo em `MapCanvas.tsx:115`, `LayoutLink` sem cor — `useTreeLayout.ts:15`); "central maior" em largura depende de **M15** (largura por nó); com só M12 (altura por nó) o destaque do central fica por altura/estilo/fonte.

**Pós-conversão visx — decisões de UX do canvas adiadas conscientemente (2026-06-23, ver AD-015):** a migração para visx é só paridade; estas três melhorias (que motivaram a abertura da discussão da troca de lib) ficam para depois da conversão:

- [x] ~~**Posicionamento dos nós:** manter auto-layout vs. arrastar-e-fixar com `x/y` persistido vs. híbrido por sessão~~ — **decidido (AD-017, 2026-06-24): mantém auto-layout (AD-002).** Posicionamento livre descartado. Sob auto-layout não há posição livre a persistir → a ideia colapsa em **reorder de irmãos** (ver abaixo). Feature M9 a planejar.
- [x] ~~**Direção do layout:** avaliar vertical, radial ou alternável~~ — **decidido (AD-016, 2026-06-24): bidirecional horizontal, direção fixa.** Radial 360° descartado. Toggle/alternância na UI segue adiado. Feature M8 **concluída e aprovada (review AD-013, 2026-06-24 — L-005).**
- [ ] **Reorder entre irmãos via drag (M9, AD-011/AD-017):** próxima feature — é o que "persistir posicionamento" virou sob auto-layout. Só frontend: zonas de drop no `useNodeDrag` (miolo = reparent; K+1 slots de inserção = reorder via `index`); backend já suporta. **Planejamento pendente (chat separado).**

- [ ] **Reset de largura ao default (M15, sem entrar na v1):** M15 não entrega reset (`width=null`) por decisão do usuário — o card exibe a largura gravada verbatim. Candidatos para implementar depois: duplo-clique na alça de resize (em `MapCanvas` `onDoubleClick` no mesmo wrapper) ou item "Restaurar largura" no menu de contexto do nó. Implementar em M16 ou como quick task quando a dor aparecer.
- [~] **Isolar dev/test do banco de produção (descoberto 2026-06-27, L-007):** **fix imediato aplicado (2026-06-27)** — `packages/api/.env` local repontado de `mindmap` → `dev_mindmap`, então `pnpm dev` **e** o e2e (que sobe a API via `run dev`) deixaram de tocar prod. **Falta a parte estrutural (adiada pelo usuário — "pipeline pra dev mais pra frente"):** Postgres **local** (Docker) para dev + banco de **teste dedicado** para vitest/e2e (hoje dev e teste partilham `dev_mindmap`, então `pnpm test` limpa os dados do `pnpm dev`), eliminando a dependência do túnel SSH no dia a dia. Mecanismo completo em CONCERNS.md → Test Infrastructure (addendum 2026-06-27).
- [ ] **Gate de qualidade v1 — pendente, adiado para depois dos upgrades** (`ROADMAP.md:49-52`): (a) RNF-01 — mapa sintético de 500 nós responsivo em pan/zoom/drag (nunca validado; risco apontado pelo concern de performance `simpleTreeLayout` síncrono no main thread); (b) smoke manual cobrindo US-01..US-05 de ponta a ponta. **Rodar antes de declarar v1 concluído.**
- [ ] Decisão pendente sobre US-05 / expand-collapse: AD-004 deixou a restauração entre sessões fora — único critério de user story de v1 deliberadamente não atendido. Confirmar se entra nos upgrades ou fica pós-v1.
- [ ] UI exata dos indicadores de tarefa no canvas — refinar iterativamente durante uso (§7 do spec)
- [ ] Reorder entre irmãos do mesmo pai via drag (AD-011) — só drag-to-reparent em M3
- [ ] Atalhos de teclado no canvas (Tab=add filho, Delete=excluir, etc.) — M3 só tem Enter/Escape no rename
- [x] ~~Optimistic updates explícitos em mutations de Node~~ — implementado em M4 (T3–T6)
- [ ] Restauração de expand/collapse entre sessões (AD-004 já marcou como candidato se incomodar)
- [ ] Renumeração de `sortOrder` no DELETE para fechar gaps (atualmente tolerados)
- [ ] Feedback visual de drop target durante drag (highlight do nó alvo) — hoje só há snap-back silencioso quando o drop é inválido
- [x] ~~Toast/notificação melhor para erros do canvas~~ — implementado em M4 (T1–T2, toast queue substitui banner)
- [x] ~~Migrar shadcn/ui de v1 (Radix) para v2/Base UI~~ — migrado em Q-005

---

## Todos

*(nenhum todo aberto)*

---

## Preferences

**Model Guidance Shown:** never
**Language:** pt-BR (usuário prefere comunicação, commits e docs em português; código e identificadores em inglês)
