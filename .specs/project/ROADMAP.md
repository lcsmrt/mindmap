# Roadmap

Milestones organizados por dependência técnica. Cada um agrupa uma ou mais user stories da [source-spec.md](./source-spec.md).

O **detalhe de execução** (commits, contagem de testes, gates, veredito de review) mora no git, nas ADs de `STATE.md` e nas feature folders `.specs/features/mN/`. Aqui fica só o *que* cada milestone entregou + ponteiro para a AD/pasta com o resto.

## v1 — Mindmap pessoal funcional

### M1 — Fundação do monorepo e infra de dados

- Monorepo `pnpm` (`packages/web`/`api`/`shared`), Postgres, Prisma (Map/Node) + Fastify com healthcheck, Vite+React consumindo a API via tipos compartilhados. Pré-requisito de tudo (sem user story).

### M2 — Gerenciamento de mapas (US-01)

- CRUD de Map; tela inicial (listar/criar/renomear/excluir com confirmação); navegação para o canvas.

### M3 — Canvas e edição estrutural (US-02)

- Canvas com pan/zoom + layout hierárquico; add filho, rename inline, delete (cascade + confirmação), move via drag; expand/collapse; endpoints de node. _(A stack de canvas original — React Flow + elkjs — foi substituída por visx no M7.)_

### M4 — Persistência automática (US-05)

- Toda mutação persiste assíncrona com feedback de erro (toast); restauração completa ao reabrir (estrutura, `sortOrder`, cores, props de tarefa). Expand/collapse fica só no cliente (AD-004).

### M5 — Dialog de edição e cores (US-03)

- Dialog ao clicar num nó; paleta fixa de swatches para `bgColor`/`textColor` (sem picker livre, AD-005); aplicação imediata + persistência.

### M6 — Propriedades de tarefa (US-04)

- Campos no dialog: status (enum nullable), responsável (texto), prioridade (booleano); indicação visual progressiva no canvas.

### Gate de qualidade v1 🔴 PENDENTE

- RNF-01: mapa sintético de 500 nós responsivo em pan/zoom/drag (**nunca validado** — risco: layout síncrono do d3-flextree no main thread, ver CONCERNS → Performance).
- Smoke manual cobrindo US-01..US-05 de ponta a ponta.
- **Adiado conscientemente** — rodar antes de declarar v1 concluído (ver Deferred Ideas em `STATE.md`).

---

## Pós-v1 — entregue

A maioria com review AD-013 aprovada; exceções anotadas. Ponteiro entre parênteses aponta a AD e/ou a feature folder.

- **M7 — Canvas migrado para visx** ✅ (AD-015, L-004 · `m7-canvas-visx/`) — troca `@xyflow/react` (logo Pro = dealbreaker ético) + `elkjs` pela stack `@visx/zoom` + `@visx/shape` + `d3-flextree`. Paridade funcional; a fonte única `positioned` eliminou a Fragile Area `rfNodes`↔`useNodesState`.
- **M8 — Layout bidirecional horizontal** ✅ (AD-016, L-005 · `m8-layout-bidirectional/`) — raiz ao centro, ramos de 1º nível balanceados esq/dir, direção fixa. Só frontend.
- **M9 — Drag-to-place unificado + lado persistido** ✅ (AD-018, L-007 · `m9-drag-to-place/`) — gesto único "soltar num slot (pai, posição)" cobre reorder + reparent posicionado + troca de lado, com card-fantasma. Adiciona `side` ao schema. Full-stack.
- **M10 — Redesign web** ✅ (AD-019 · `m10-redesign/`) — reskin home + canvas; `GET /maps` passa a agregar `nodeCount`/`criticalCount`/`createdAt` (sem schema/migration). Busca + ordenação, nó rico (status/responsável/crítico), dialog com preview ao vivo + medidor de contraste WCAG.
- **M11 — Polish de ícones, divisória e overflow** ✅ (L-007 · quick wins, sem spec) — caracteres-ícone → `lucide`, divisória título/rodapé no card, fix de overflow do dialog com texto longo. Só frontend.
- **M12 — Card responsivo (texto sempre visível + altura dinâmica)** ✅ (AD-020, L-007 · `m12-card-responsive/`) — remove `truncate`; altura por medição real (pipeline `ResizeObserver`→`d3-flextree`, convergência garantida por largura fixa). Só frontend.
- **M13 — Geometria da barra de inserção** ✅ (AD-021, L-006 · `m13-drop-bar-geometry/`) — seleção de slot por band vertical + desempate lexicográfico para grupos co-coluna. Só frontend.
- **M15 — Resize horizontal do card** ✅ (AD-023, L-008/L-009 · `m15-card-resize/`) — alça no hover, largura por nó persistida (`width Int?`, full-stack). A AD-024 (largura-por-conteúdo) foi tentada e **revertida** — largura padrão segue fixa. Bug de trepidação no arraste, aberto no fim do M15, foi resolvido depois (quick task pós-M17; CONCERNS).
- **M16 — Rebrand visual (design system)** ⚠️ executado; e2e pendente de run limpo com API (`m16-kaos-rebrand/`) — identidade própria: tokens `@theme`, reskin home + canvas. Só frontend.
- **M17 — Limpeza da base de código** ✅ (`m17-codebase-cleanup/`) — refactor puro (zero mudança de comportamento/contrato/schema/visual): tokeniza `--color-critical-strong`, política de comentários D2, colocation em `pages/map/lib/`, decompõe `MapCanvas`.

### Infra — Deploy na VPS ✅ (AD-022)

- App no ar em `http://72.60.1.97:8080` via stack Docker na VPS Hostinger (api `network_mode: host` + nginx servindo a SPA e fazendo proxy de `/api`). Redeploy no push pro `master` via GitHub Action + webhook do Portainer. Banco de prod `mindmap`. Sem spec (infra).

---

## Pós-v1 — Autenticação (multi-usuário, AD-025)

Retrofit multi-usuário sobre o app antes single-user. Decisões fixadas em **AD-025**: contas reais + `Map.ownerId` + signup aberto + todo endpoint escopado por dono; **roll-your-own** no Fastify/Prisma (`argon2` + sessão server-side em cookie httpOnly; `@fastify/oauth2` no Google); serviço externo descartado. Design em `designs/v3/Autenticação.dc.html`.

```
M18 ✅ ─ M19 ✅ ─┬─ M20 ✅  (menu/perfil)
                ├─ M21 ✅  (reset por e-mail)
                └─ M22     (Google OAuth)        pendente
```

- **M18 — Núcleo de auth backend (multi-tenancy)** ✅ (AD-025 · `m18-auth-core/`) — `User`/`Session`/`Map.ownerId`, sessão server-side opaca (argon2 + `sha256(token)` no banco), guarda + escopo por dono em todas as rotas maps/nodes, backfill (1º signup herda os mapas órfãos). Só backend.
- **M19 — Tela de auth + guarda no front** ✅ (AD-026 · `m19-auth-frontend/`) — 1ª fatia jogável email+senha. Sessão modelada como a query `['auth','me']`; `RequireAuth` + return-to; 401 global derruba a sessão. Só frontend. Acompanhado de uma limpeza de UI (lucide→phosphor, 7 primitivos shadcn, grade 4px) — ver Current Work em `STATE.md`.
- **M20 — Menu de conta e perfil** ✅ executado; review AD-013 pendente (AD-027/AD-028 · `m20-account-menu/`) — `AppHeader` compartilhado + `AccountMenu` (avatar + dropdown), página `/profile` (edita nome, e-mail read-only), `PATCH /auth/me`. Tema claro/escuro fatiado pra fora. Full-stack pequeno.

### M21 — Reset de senha por e-mail ✅ executado; review AD-013 pendente (AD-029/AD-030 · `m21-password-reset/`)

- Provedor de e-mail/SMTP + `PasswordResetToken` (uso único, expira); fluxo "Esqueci a senha" → "Link enviado" (mensagem neutra, não vaza existência de conta) → página de nova senha.
- **Entregue (AD-030):** `PasswordResetToken` espelha `Session` (sha256 + TTL 60 min, uso único); `services/email.ts` provider-agnóstico (nodemailer/SMTP por env; console sem SMTP); 3 rotas no `authPlugin` (`forgot` sempre 204 neutro / `validate` / `reset` em transação) + seam de teste; `/forgot-password` e `/reset-password` no front; sem auto-login; flag `logoutOtherDevices` (default on). 9 commits T1–T9; gates verdes (unit api 124 / web 162 / e2e 47). **Ops:** setar `APP_URL`+`SMTP_*` no Portainer pra envio real em prod.

### M22 — Google OAuth 🟡 pendente · depende de M18 · puxa app OAuth no Google Cloud

- `@fastify/oauth2` + "Continuar com Google"; criar conta nova ou **vincular** a conta existente com mesmo e-mail (política de account linking decidida no design).

---

## Pós-v1 — outros pendentes

### M14 — Hierarquia visual (estilo MindMeister) 🟡 pendente · muito design

Dar hierarquia aos nós por profundidade. Dependências já entregues (M12 = altura por nó; M15 = largura por nó). Sub-itens:

- **Central maior / 1º nível destacado / resto mais simples:** skin por profundidade (estender `cardSkin(depth)`). "Central maior **em largura**" usa a largura por nó do M15; sem isso, destaque por altura/estilo/fonte.
- **Cor da edge herdada do nó de 1º nível:** hoje toda edge é `stroke-border` fixo e `LayoutLink` não carrega cor; propagar a cor do nó para a aresta.
- Majoritariamente **design** — vale exploração visual antes de virar tarefa.

### Tema claro/escuro (fatiado do M20, 2026-07-05) 🟡 pendente

- Persistência de preferência + toggle. Saiu do M20 por ser ortogonal e maior do que aparenta.

---

## Pós-v1 (deferred)

Itens que **não** entram em v1 mas podem virar features futuras. Veja `STATE.md` → Deferred Ideas para ideias que surjam durante a implementação.

- Exportação (PNG/PDF/JSON/markdown)
- Undo persistente entre sessões / histórico de alterações
- Apps mobile/desktop nativos
- **Colaboração** multi-usuário (compartilhar mapa entre contas) — a **autenticação** multi-usuário saiu do deferred e virou o lote M18–M22 acima.
