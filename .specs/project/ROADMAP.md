# Roadmap

Milestones de v1 organizados por dependência técnica. Cada milestone agrupa uma ou mais user stories da [source-spec.md](./source-spec.md).

## v1 — Mindmap pessoal funcional

### M1 — Fundação do monorepo e infra de dados

- Setup do monorepo `pnpm` workspaces: `packages/web`, `packages/api`, `packages/shared`.
- Projeto Supabase provisionado; `DATABASE_URL` configurada.
- Prisma schema inicial (Map, Node) com migration aplicada.
- Servidor Fastify rodando com healthcheck.
- Vite + React rodando localmente, consumindo a API via tipos compartilhados em `packages/shared`.
- **Sem user story diretamente associada** — pré-requisito para todas.

### M2 — Gerenciamento de mapas (US-01)

- Endpoints CRUD de Map.
- Tela inicial: listar, criar, renomear, excluir (com confirmação).
- Navegação para o canvas de um mapa selecionado.

### M3 — Canvas e edição estrutural (US-02)

- Canvas com React Flow integrado: pan, zoom.
- Renderização da árvore via elkjs (layout hierárquico).
- Add filho, rename inline, delete (com cascade + confirmação), move via drag-and-drop.
- Expand/collapse de ramos.
- Endpoints de node: create, update, delete, move.

### M4 — Persistência automática (US-05)

- Toda mutação no canvas dispara persistência assíncrona.
- Feedback visual de erro (toast/banner) quando salvamento falha.
- Restauração completa do estado ao reabrir o mapa (estrutura, `sort_order`, cores, propriedades de tarefa). Expand/collapse fica só no cliente — ver AD-004 em STATE.md.
- **Nota:** parcialmente coberto por M2/M3; este milestone formaliza o contrato e cobre os edge cases (falhas de rede, conflitos de ordem).

### M5 — Dialog de edição e cores (US-03)

- Dialog estilo Trello ao clicar num nó.
- Paleta fixa de swatches para `bg_color` e `text_color` (sem color picker livre) — ver AD-005 em STATE.md.
- Aplicação imediata no canvas + persistência.

### M6 — Propriedades de tarefa (US-04)

- Campos no dialog: status (enum nullable), responsável (texto), prioridade (booleano).
- Indicação visual progressiva no canvas: nada quando vazio; indicador conciso quando preenchido (UI exata definida durante uso).
- Migration adicionando colunas no Node (se não foi feita em M1).

### Gate de qualidade v1

- RNF-01: mapa sintético de 500 nós permanece responsivo em pan/zoom/drag.
- Reabrir qualquer mapa restaura o estado completo (smoke test manual cobrindo todas as user stories).

---

## Pós-v1 — entregue

### M7 — Migração do canvas para visx (AD-015) ✅ concluído (2026-06-24)

- Substitui `@xyflow/react` (logo Pro = dealbreaker ético) pela stack visx: `@visx/zoom` + `@visx/shape` + `d3-flextree`. `elkjs`/worker de layout removidos. Paridade funcional + remoção da logo; queixas de UX do canvas seguem adiadas (Deferred Ideas). Feature em `.specs/features/m7-canvas-visx/`.

### M8 — Layout bidirecional horizontal (AD-016) ✅ concluído (2026-06-24)

- Primeira das "Deferred Ideas — direção do layout" (AD-015). Troca o layout vertical (raiz no topo) por **bidirecional horizontal** estilo MindMeister: raiz no centro, ramos de 1º nível repartidos e **balanceados** entre esquerda/direita, cada lado uma árvore horizontal. Direção **fixa** (sem toggle). Só frontend (`useTreeLayout.ts` + edges no `MapCanvas.tsx`); backend e AD-002 intactos. Design pulado (feature pequena). Feature em `.specs/features/m8-layout-bidirectional/`. **Review AD-013 aprovado (L-005); gates verdes (e2e 22/22).**

### M10 — Redesign (web) (AD-019) ✅ concluído e aprovado (review AD-013, 2026-06-25)

- Porta o redesign do Claude Design (pasta `Mindmaps system interface/`: telas "Meus Mapas" e "Estudo de Nós" + dialog) para o produto. **Reskin** de duas telas + **uma** extensão de contrato: `GET /maps`/`MapSummary` ganham `nodeCount`/`criticalCount`/`createdAt` (única mudança de backend; sem schema/migration — AD-019; `nodeCount` inclui a raiz). Home: header neutro (**sem rebranding "Nodum"**), grid de cards com métricas/datas, criar via modal, menu ⋯ (Renomear/Excluir), e **(P2)** busca + ordenação. Canvas: nó rico (cor/status+label/avatar de responsável/▲ crítico) + toolbar no hover; dialog com preview ao vivo + **(P2)** medidor de contraste WCAG. Decisões do usuário: sem mini-preview nos cards; `assignee` segue string livre (AD-003). AD-002/AD-005 preservadas; M7/M8/M9 (layout/interação do canvas) **intactos**. Spec/design/tasks em `.specs/features/m10-redesign/` (27 req. M10-NN, 13 tasks). **Concluído e aprovado (review AD-013, 2026-06-25). Commits `1476aba`…`18f17d0` + `87bd9de` (fix do review). Gates verdes: typecheck/lint, unit api 56/web 88, e2e 32/32, smoke visual. Review: 1 finding corrigido (▲ crítico movido para a linha do título, fiel ao export); 2 não-bloqueantes anotados em CONCERNS (rename inline pré-existente; AC M10-21 optimistic por design).**

---

## Infra — entregue

### Deploy na VPS (AD-022) ✅ concluído (2026-06-27)

- App no ar na VPS Hostinger (mesma do Postgres, AD-006) via stack Docker: `mindmap-api` (Fastify, `network_mode: host` p/ alcançar o Postgres localhost-only) + `mindmap-web` (nginx servindo a SPA + proxy `/api` → `host.docker.internal:3100`). Banco de prod `mindmap`, `DATABASE_URL` no Portainer. **Redeploy contínuo:** push no `master` → GitHub Action `deploy.yml` → webhook do Portainer rebuilda/redeploya. Exposto em `http://72.60.1.97:8080`. Acompanham dois fixes de prod: ids sem `crypto.randomUUID` em contexto HTTP (`uid.ts`) e badge de versão (`VersionBadge`). Ver AD-022 em `STATE.md`. Sem spec (infra).

---

## Pós-v1 — executado e revisado

### M9 — Drag-to-place unificado (AD-011/AD-017/AD-018) ✅ concluído e aprovado (review AD-013, 2026-06-27 — APROVADO COM RESSALVAS, 0 bloqueantes; L-007)

- Unifica o gesto de arraste num modelo **"soltar num slot"** `(pai, posição)`: reorder (mesmo pai), reparent **já posicionado** (outro pai) e troca de **lado** (slot de 1º nível) viram o mesmo gesto, com **card-fantasma** indicando o alvo. **Lado persistido** (modelo b): filhos de 1º nível ganham um campo de lado no schema; o usuário arrasta um ramo para o outro lado e ele fica (inclusive tudo de um lado). Balance do M8 **rebaixado a default de criação**. **Full-stack** (schema+migration+backend+frontend), revisa AD-016 e parcialmente AD-002 (persiste só 1 bit de lado, **sem x/y**). Spec em `.specs/features/m9-drag-to-place/spec.md`. **Design + tasks pendentes** (chat separado).

---

## Pós-v1 — refinamento de UX (planejado, 2026-06-25)

Lote de refinamento levantado em uso real (fase de polish). Organizado por complexidade e dependência; **não** será speccado/executado tudo de uma vez (cada item em chat separado, [[feedback-plan-execute-split]]). Sequência proposta: **M11** (quick wins) → **M12** (texto sempre visível + altura dinâmica, spec própria) → **M13** (geometria do drag, depende de M12) → **M14** (hierarquia, design). O **resize horizontal foi fatiado de M12 para M15** (decisão 2026-06-25, AD-020) — full-stack, depende de M12. Breadcrumbs técnicos (arquivos/linhas) em `STATE.md` → Deferred Ideas.

**Grafo de dependências do lote** (numeração ≠ ordem obrigatória; cada item em chat separado):

```
M11 (independente, já executado)
M12 ─┬─→ M13   (geometria vertical do drop; M15 toca a mesma slots.ts no eixo da largura, sem ser dependência)
     ├─→ M14   (skin/altura por M12; "central maior em largura" também depende de M15)
     └─→ M15   (resize horizontal, full-stack)  ──→ M14 (parte "central maior em largura")
```

- **M12** não depende de nada novo (base do lote). **M13**, **M14** e **M15** dependem de **M12**.
- **M14** também depende de **M15** apenas para o sub-item "central maior **em largura**" (o resto do M14 — skin por profundidade, cor de edge — só precisa de M12).
- **M13** depende **só de M12**; M15 compartilha arquivo (`slots.ts`/ghost) no eixo da largura, mas é ortogonal ao fix vertical do M13 → coordenar, não bloquear.

### M11 — Polish de ícones, divisória e overflow ✅ concluído e aprovado (review AD-013, 2026-06-27 — APROVADO COM RESSALVAS; L-007)

Três ajustes independentes e de baixo risco, agrupados. **Executado** sem spec (quick wins): 4 commits de código + 1 docs — `fc102b6` ícones, `c37ffd4` divisória, `4d1eefe` overflow (1ª tentativa, **incompleta**), `b193294` docs, `e233492` overflow (fix-do-fix: faltava `min-w-0` no grid item raiz do `DialogContent`). Gates verdes: typecheck/lint, unit web 88, e2e 32/32, smoke visual conferido (ícones lucide + divisória + sem overlap). **Review AD-013 aprovado com ressalvas (2026-06-27, L-007):** overflow de fato resolvido no estado atual; ressalva de processo (STATE.md dizia "3 commits"; fix incompleto declarado completo, espírito L-001).

- **Ícones de texto → lucide:** trocar caracteres usados como ícone por componentes `lucide-react` (padrão já no projeto). Ocorrências: `▲` crítico (`MindNode.tsx`, `NodeEditDialog.tsx`), `✓/!/⚠` do medidor de contraste (`NodeEditDialog.tsx`), `←` voltar (`MapPage.tsx`). O `—` placeholder de responsável fica (é travessão de UI). Caso algum cenário não tenha ícone lucide equivalente → trazer para discussão.
- **Divisória título/footer no card:** replicar no `MindNode` a linha (`border-t` condicional) que já existe no `NodeEditDialog`, exibida só quando há status e/ou responsável (`hasTaskProps`).
- **Overflow do dialog com texto longo:** título/responsável muito longos estouram o `NodeEditDialog`. Fix de CSS (`min-w-0`/`overflow`/`break-words` nos containers do preview e da linha de responsável).

### M12 — Card responsivo: texto sempre visível + altura dinâmica 🔴 alta (spec própria) ✅ concluído e aprovado (review AD-013, 2026-06-27 — APROVADO COM RESSALVAS; L-007)

Metade arquitetural do "Card responsivo + resize" original — **fatiada** (decisão do usuário, 2026-06-25, AD-020): M12 entrega só **texto sempre 100% visível + altura derivada de medição real**; o **resize horizontal** virou **M15**.

- **Texto sempre visível:** remove `truncate`, deixa quebrar linha (incl. palavra única longa via `break-words`); altura do card cresce/encolhe para caber.
- **Altura por medição real:** a altura deixa de ser fórmula (40/79 de `nodeSize.ts`) e passa a vir de medição no DOM → pipeline **medir→layout** (`ResizeObserver` compartilhado → estado `heights` → `useTreeLayout` realimenta o `d3-flextree`, que já trata altura por nó). `nodeHeight`→`estimateNodeHeight` vira estimativa de 1º paint. **Invariante de convergência:** largura fixa ⇒ reposicionar não muda a altura medida ⇒ observer não re-dispara ⇒ ≤1 relayout, sem loop.
- **Só frontend.** Sem schema, sem migration, **sem coluna `width`**, sem x/y. AD-002 intacta. `slots.ts` (geometria do drop) fica para M13.
- Spec/design/tasks em `.specs/features/m12-card-responsive/` (19 req. M12-NN, 5 tasks; T1/T2 paralelos). **Executado** em 6 commits atômicos (`c5797b7` refactor de polish do `MindNode` separado do milestone + T1–T5 `3e7eaf4`…`6958fbc`). Gates verdes: typecheck/lint, unit **web 88→96** + api 56, **e2e 32→33/33**, smoke visual conferido (cards multi-linha + palavra gigante sem truncar/vazar, sem sobreposição, `fitView` enquadra). Só frontend, AD-002 intacta. **Review AD-013 aprovado com ressalvas (2026-06-27, L-007):** convergência medir→layout verificada no código (sem loop), testes não-vacuosos; ressalvas não-bloqueantes (micro-leak de `refCallbacks`, `lineCount` frágil).

### M13 — Geometria da barra de inserção (drag) 🟡 média ✅ concluído e aprovado (review AD-013, 2026-06-26; 1 finding corrigido; smoke visual confirmado pelo usuário, 2026-06-27)

Corrige a assimetria da linha de drop entre dois cards (tende a subir / cola no card de baixo). Causa confirmada: `nearestSlot` usava distância euclidiana ao `anchorY`, gerando fronteiras assimétricas com cards de alturas variáveis (pós-M12). **Fix:** seleção por **band vertical** — cada `Slot` carrega `[bandTop, bandBottom)` com fronteiras no **centro vertical dos cards vizinhos**; `score = dx + dy` (dy=0 dentro do band, senão dist. à borda). `PLACEHOLDER_H` removido (era vestigial). Shape do `Slot`: `{ colX, anchorY, bandTop, bandBottom }` substitui `{ x, y, height }`. `slotToMoveBody`/`isOriginSlot` **inalterados** → mesmas mutações `move` → e2e drag-to-place intacto. **Só frontend, AD-002 intacta** (sem schema, sem migration). Spec/design/tasks em `.specs/features/m13-drop-bar-geometry/`. **Executado** em 4 commits atômicos (`12a7cb5` T1+T2, `8badcfd` T3, `9799c01` T4, `f18af64` T5). Gates verdes: typecheck/lint ✓, unit **web 102** (slots 21 + 6 novos casos de band) + api 56 ✓, **e2e 34/34** ✓ (33→34 com smoke M13), **smoke visual conferido** (ghost-slot aparece no vão durante drag entre cards de alturas diferentes). **Revisado (AD-013, 2026-06-26):** o review reproduziu um bug remanescente — grupos co-coluna (pais de mesma profundidade compartilham `colX`) empatavam em `dx + dy` e o drop era roubado pela ordem de enumeração; **corrigido** com seleção lexicográfica (commit `94fbe68`, `nearestSlot` + `groupTop/groupBottom`; unit web 102→104). Ver AD-021 addendum + L-006 em STATE.md. **Smoke visual do caso co-coluna confirmado pelo usuário em uso real (2026-06-27) — milestone fechado.**

### M14 — Hierarquia visual (estilo MindMeister) 🟡 média (muito design)

Dar hierarquia aos nós por profundidade. Sub-itens de esforço distinto:

- **Central maior / 1º nível destacado / resto mais simples:** skin por profundidade (estender `cardSkin(depth)`). M12 entrega **altura** por nó (texto longo → card mais alto); um "central maior" de fato **maior em largura** depende do **M15** (largura por nó). Sem M15, o destaque do central fica por estilo/altura/fonte.
- **Cor da edge herdada do nó de 1º nível:** hoje toda edge é `stroke-border` fixo e `LayoutLink` não carrega cor; propagar a cor do nó para sua aresta.
- Majoritariamente **design** — vale exploração visual antes de virar tarefa.

### M15 — Resize horizontal do card 🔴 alta (depende de M12) ✅ concluído e aprovado (review AD-013, 2026-07-02 — L-009)

Segunda metade do "Card responsivo + resize" original, **fatiada de M12** (decisão do usuário, 2026-06-25, AD-020). Largura controlada pelo usuário por arraste; texto reflui; altura derivada (M12 já entrega o pipeline de medição).

- **Resize horizontal por nó:** alça na borda direita do card, **revelada no hover** (consistente com a toolbar M10). `NODE_WIDTH` deixa de ser constante → vira largura por nó em `useTreeLayout.ts`, `lib/slots.ts`, barra-fantasma e render.
- **Largura persistida:** coluna nova `width Int?` no `Node` (full-stack). Revisa AD-002 parcialmente (mais 1 dado estrutural por nó, mantendo "sem x/y livre" — largura não é posição em pixel; mesmo precedente do M9/`side`). **AD-023 registrada.**
- **Sem reset de largura** em M15 (por decisão do usuário) — candidato a quick task futura (ver Deferred Ideas).
- Spec/design/tasks em `.specs/features/m15-card-resize/`. **Executado** em 6 commits (T1: schema+DTO+mapper; T2: PATCH width; T3: layout por nó; T4: slots.ts eixo X; T5: `3c0c429` alça+drag+persist; T6: `16439e0` e2e+smoke). **Review AD-013 concluída (2026-07-02): APROVADO por 3 sub-agents independentes, zero bloqueantes** (L-009). Gates verdes: typecheck/lint ✅, unit **web 118/api 61** ✅, **e2e 37/37** ✅ (2 testes funcionais de resize + smoke visual M15). Probe empírico do d3-flextree fechou o risco geométrico da L-008; reversão da AD-024 confirmada limpa. Findings Low → CONCERNS.md. **Bug aberto não-bloqueante:** trepidação no arraste (CONCERNS.md → Known Bugs).

### M16 — Rebrand visual (design system) ✅ executado (e2e pendente de run limpo com API, 2026-07-02)

Identidade visual própria: paleta de cores nova, tokens de design system, tipografia e reskin das telas home + canvas. Só frontend; sem schema/migration/contrato.

- Novos tokens CSS no `@theme` (`styles.css`): paleta de brand, surface, edge, toolbar e variáveis de nó.
- `MindNode` reskinado: raiz neutra, toolbar com `pointer-events` corretos.
- Correção de centralização do canvas ao reabrir um mapa.
- Spec/design/tasks em `.specs/features/m16-kaos-rebrand/`. Commits: `bdd09a9`, `b603cdf`, `3aa8feb`, `8fedd23`. Gates verdes: typecheck/lint ✅, unit web 118/api 61 ✅; **e2e 37/37 pendente** de run limpo com API (DB dev necessário). Bug de trepidação do resize segue aberto (CONCERNS.md → Known Bugs).

### M17 — Limpeza da base de código ✅ executado · review AD-013 APROVADA (2026-07-05, zero bloqueantes)

Refactor puro — zero mudança de comportamento, contrato, schema, visual. Seis tasks atômicas:

- **T1:** token `--color-critical-strong` no `@theme`; remove `#b01818` hardcoded de `MindNode`/`NodeEditDialog`.
- **T2:** política de comentários D2 aplicada em 9 arquivos; racional arquitetural migrado para `CONCERNS.md` Design Notes.
- **T3:** move `lib/{tree,slots,useTreeLayout,nodeSize}` + testes para `pages/map/lib/` (colocation); extrai `EmptyState` de `HomePage` para `pages/home/components/`.
- **T4:** `NodeEditDialog` preview reusa `NodeTaskIndicators` (elimina markup duplicado).
- **T5:** decompõe `MapCanvas.tsx` em `GhostBar`, `useContainerSize`, `useNodeEditing`; gesto de resize intocado (bug de trepidação preservado).
- **T6:** grep-guard hex + lint limpo + 118/118 unit verdes.
- Spec/design/tasks em `.specs/features/m17-codebase-cleanup/`. Commits T1–T5 em `master`. Gates verdes: typecheck ✅, lint ✅, unit **web 118/api 61** ✅. E2e e smoke visual pendentes de review (chat separado, [[feedback-plan-execute-split]]).

---

## Pós-v1 — Autenticação (planejado, 2026-07-04)

Retrofit de autenticação **multi-usuário** sobre o app hoje single-user/sem dono. Decisões de arquitetura fixadas em chat de planejamento ([[feedback-plan-execute-split]]) — ver **AD-025** em `STATE.md`: **multi-usuário completo** (contas reais, `Map.ownerId`, signup aberto, todo endpoint escopado por dono); **roll-your-own** no Fastify/Prisma (`argon2` + sessão server-side em cookie httpOnly + tabela `Session`; `@fastify/oauth2` na etapa do Google); **serviço externo descartado** (saímos do Supabase para Postgres na VPS na AD-022). Design em `designs/v3/Autenticação.dc.html`. Quebra em 5 etapas, **executadas uma por vez em chats separados** (spec/design/tasks próprios por etapa).

**Grafo de dependências:**

```
M18 (núcleo backend)
 └─ M19 (tela + guarda)  ← portão fechado, email+senha (1ª fatia jogável)
     ├─ M20 (menu/perfil)           independentes entre si —
     ├─ M21 (reset por e-mail)      ordem flexível depois
     └─ M22 (Google OAuth)          que o portão existe
```

### M18 — Núcleo de auth backend (multi-tenancy) 🔴 alta · só backend · ✅ EXECUTADO (2026-07-04) · review AD-013 APROVADA (2026-07-05, zero bloqueantes)

Fundação de que todo o resto depende; parte mais crítica de segurança. Planejamento concluído em `.specs/features/m18-auth-core/` (21 req. M18-NN, 12 tasks; ver AD-025 + Current Work em STATE.md). Decisões: backfill = 1º cadastro herda; sessão 7d/30d; senha mín. 8; sessão opaca com `sha256(token)` no banco.

- Schema: modelo `User` (email único, `passwordHash`, nome), `Session` (token, `userId`, expiração), `Map.ownerId` (FK → `User`).
- Migration + **backfill**: mapas globais de hoje passam a pertencer ao primeiro usuário (você); `ownerId` vira **obrigatório** após o backfill. Parte delicada da migração.
- `argon2` para hash; sessão em cookie httpOnly + tabela `Session` (revogável).
- Endpoints: `signup`, `login`, `logout`, `me`.
- **Guarda global + escopo por dono**: toda query de maps/nodes filtra por `ownerId`; toda mutação checa posse (um usuário não toca no mapa/nó de outro).

### M19 — Tela de auth + guarda no front 🔴 alta · **1ª fatia jogável ponta-a-ponta (email+senha)** · depende de M18 · ✅ EXECUTADO (2026-07-04) · review AD-013 APROVADA (2026-07-05, zero bloqueantes)

Planejado e executado em `.specs/features/m19-auth-frontend/` (spec 20 req. M19-NN, context, design, 6/6 tasks; ver AD-026 + Current Work em STATE.md). Só `packages/web`; backend/schema/contrato do M18 intocados.

- Tela KAOS: modos **Entrar** / **Criar conta** (nome só no cadastro), toggle de olho na senha, "manter conectado" só no Entrar. Google/reset/menu/footer escondidos (voltam em M20–M22).
- Sessão modelada como a query `['auth','me']` (fonte única, sem context/store); `signup`/`login`/`logout`/`me` em `src/api/auth.ts`.
- react-router: `RequireAuth` (rota-layout) protege `/` e `/maps/:id` com redirect + return-to; `RedirectIfAuthed` no `/login`; `AuthSplash` no bootstrap; `401` global derruba a sessão.
- Feedback híbrido: validação client-side por campo + banner do servidor (401/409); botão em loading. Logout = botão temporário no header da Home.
- Gates verdes: typecheck, lint, unit web 140/api 97 (idêntico), e2e 41/41 (`auth.spec.ts` novo + suíte pré-existente reconciliada via `storageState` fixo).

**Limpeza de UI pós-M19 (2026-07-05, quick task junto da review AD-013 — não é milestone):** só `packages/web`, sem schema/contrato. Troca `lucide-react`→`@phosphor-icons/react` (`IconContext` global bold), 7 primitivos shadcn/base-ui novos em `components/ui/` (`avatar`/`checkbox`/`field`/`input-group`/`label`/`separator`/`textarea`), reskin de auth/home/map, alinhamento à grade de 4px (dezenas de arbitrários fora da grade corrigidos) e CSS anti-flash de `:-webkit-autofill`. As 7 correções da review AD-013 (a11y dos campos, timing do login, `satisfies z.ZodType`, ordem do logout, util de return-to, checkbox labelable, paths da skill `mindmap-canvas`) foram junto. Ver Current Work em STATE.md.

### M20 — Menu de conta e perfil 🟡 média · depende de M19 · ✅ EXECUTADO (2026-07-05)

Planejado e executado em `.specs/features/m20-account-menu/` (spec 16 req. M20-NN, context, 7/7 tasks; `design.md` pulado — decisões inline no `tasks.md`; ver AD-027 + Current Work em STATE.md). Full-stack pequeno: `packages/api` (`PATCH /auth/me`) + `packages/shared` (`UpdateProfileBody`) + `packages/web`.

- `AppHeader` compartilhado (`components/`) com slot à esquerda + `AccountMenu` fixo à direita; substitui os dois `<header>` inline divergentes de Home/Map (Home mantém branding KAOS; Map mantém voltar+título). Botão "Sair" provisório da Home removido.
- `AccountMenu`: avatar de iniciais (`getInitials`, reuso de `ui/avatar.tsx`) + dropdown (`ui/menu.tsx`) com nome/e-mail e itens Perfil/Sair; a11y (teclado/Esc/click-fora) nativa do base-ui.
- Página `/profile` (sob `RequireAuth`): nome editável (pré-preenchido) + e-mail read-only; salvar via `useUpdateProfile`, reflete no avatar sem reload (mesma query `['auth','me']`); toast de sucesso (nova variante `success` no `ui/toast`/`ui/toaster`, antes só `error`).
- Backend: `PATCH /auth/me` reusa `authPlugin`/`requireAuth`, escopado por `req.user.id`; `NameField` (trim, min 1, max 100) compartilhada com o `signup`.
- **Tema claro/escuro fatiado para fora do M20** (decisão do usuário, 2026-07-05) — não implementado; vira milestone/quick task própria depois.
- Gates verdes: typecheck/lint, unit **api 97→103** (+6 `PATCH /auth/me`) / **web 140→154** (+7 `getInitials`, +2 `useUpdateProfile`, +5 `validateName`), **e2e 41→45/45** (`account-menu.spec.ts` novo + `auth.spec.ts` reconciliado — "Sair" agora mora no dropdown, não mais um botão direto).

### M21 — Reset de senha por e-mail 🟡 média · depende de M18/M19 · puxa infra de e-mail

- Provedor de e-mail/SMTP + `PasswordResetToken` (uso único, expira); fluxo "Esqueci a senha" → "Link enviado" (mensagem neutra, não vaza existência de conta) → página de nova senha.

### M22 — Google OAuth 🟡 média · depende de M18 · puxa app OAuth no Google Cloud

- `@fastify/oauth2` + "Continuar com Google"; criar conta nova ou **vincular** a conta existente com mesmo e-mail (política de account linking decidida no design).

---

## Pós-v1 (deferred)

Itens que **não** entram em v1 mas podem virar features futuras. Veja `STATE.md` para registro de ideias adiadas que surjam durante a implementação.

- Exportação (PNG/PDF/JSON/markdown)
- Undo persistente entre sessões / histórico de alterações
- Apps mobile/desktop nativos
- **Colaboração** multi-usuário (compartilhar mapa entre contas) — a **autenticação** multi-usuário saiu do deferred e virou o lote M18–M22 acima.
