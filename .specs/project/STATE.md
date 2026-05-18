# State

**Last Updated:** 2026-05-17
**Current Work:** M3 concluído (18 tasks, 18 commits). Canvas interativo funcional com add/rename/delete/move/collapse e persistência via API. Próximo: M4 (persistência formal — edge cases de rede, optimistic updates).

---

## Recent Decisions (Last 60 days)

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
- [ ] Reorder entre irmãos do mesmo pai via drag (AD-011) — só drag-to-reparent em M3
- [ ] Atalhos de teclado no canvas (Tab=add filho, Delete=excluir, etc.) — M3 só tem Enter/Escape no rename
- [ ] Optimistic updates explícitos em mutations de Node (em vez de invalidate+refetch)
- [ ] Restauração de expand/collapse entre sessões (AD-004 já marcou como candidato se incomodar)
- [ ] Renumeração de `sortOrder` no DELETE para fechar gaps (atualmente tolerados)

---

## Todos

_Sem pendências no momento._

---

## Preferences

**Model Guidance Shown:** never
**Language:** pt-BR (usuário prefere comunicação, commits e docs em português; código e identificadores em inglês)
