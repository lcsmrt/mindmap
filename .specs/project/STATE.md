# State

**Last Updated:** 2026-05-18
**Current Work:** M2 concluído (T1–T9). Próximo milestone: M3 — Canvas e edição estrutural (US-02).

---

## Recent Decisions (Last 60 days)

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

_Nenhum no momento._

---

## Lessons Learned

_Nenhuma registrada ainda._

---

## Quick Tasks Completed

| #   | Description | Date | Commit | Status |
| --- | ----------- | ---- | ------ | ------ |

---

## Deferred Ideas

Ideias adiadas que apareceram durante planejamento. Veja também a seção "Pós-v1" do ROADMAP.

- [ ] UI exata dos indicadores de tarefa no canvas — refinar iterativamente durante uso (§7 do spec)

---

## Todos

_Sem pendências no momento._

---

## Preferences

**Model Guidance Shown:** never
**Language:** pt-BR (usuário prefere comunicação, commits e docs em português; código e identificadores em inglês)
