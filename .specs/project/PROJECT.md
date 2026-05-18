# Mindmap Tool

**Visão:** Ferramenta web pessoal de mindmaps em que qualquer nó pode carregar metadados de tarefa (status, responsável, prioridade) com exibição progressiva no canvas.
**Para:** Usuário único — o próprio dono. Sem autenticação, sem colaboração.
**Resolve:** A lacuna do MindMeister (e similares): permitir tratar nós como tarefas executáveis sem deixar de ser um mindmap livre de estrutura.

## Goals

- v1 funcional cobrindo as cinco user stories (US-01 a US-05) com canvas responsivo em mapas de até 500 nós.
- Persistência automática confiável: nenhuma operação de edição exige clique em "salvar"; reabrir o mapa restaura estrutura, cores, estado de expand/collapse e propriedades de tarefa.
- Modelo de dados que suporte profundidade ilimitada via adjacency list em PostgreSQL.

## Tech Stack

**Core:**

- Frontend: React 18 + Vite + TypeScript (SPA)
- Canvas: React Flow (`@xyflow/react`)
- Layout: elkjs (layout hierárquico automático)
- Backend: Node.js + TypeScript + Fastify
- ORM: Prisma
- Database: PostgreSQL self-hosted em VPS Hostinger (substituiu Supabase — ver AD-006)

**Estrutura do repositório:** Monorepo `pnpm` workspaces — `packages/web`, `packages/api`, `packages/shared`.

**Sem autenticação** — usuário único, sem requisito de segurança imediato.

## Scope

**v1 inclui:**

- Gerenciamento de múltiplos mapas (CRUD + listagem) — US-01
- Edição interativa da árvore no canvas (pan/zoom/add/rename/delete/move/collapse) — US-02
- Edição de cor de fundo e texto por nó via dialog — US-03
- Propriedades de tarefa (status, responsável, prioridade crítica) em qualquer nó com indicação visual progressiva — US-04
- Persistência automática de toda operação — US-05

**Explicitamente fora de escopo (v1):**

- Autenticação e controle de acesso
- Colaboração em tempo real / multi-usuário
- Exportação (PNG, PDF, JSON, markdown)
- Apps mobile ou desktop nativos
- Undo persistente entre sessões (undo in-session via React Flow é aceitável)

## Constraints

- **Performance:** canvas sem jank perceptível em pan/zoom/drag com até 500 nós num mapa (RNF-01).
- **Persistência:** salvamento assíncrono e não-bloqueante com feedback visual em caso de falha (RNF-03).
- **Layout:** posições absolutas NÃO são persistidas — apenas estrutura hierárquica + `sort_order`; layout recalculado no frontend via elkjs.

## Referências

- Spec original completa: [source-spec.md](./source-spec.md)
- Roadmap por milestone: [ROADMAP.md](./ROADMAP.md)
- Estado vivo (decisões, blockers, lições): [STATE.md](./STATE.md)
