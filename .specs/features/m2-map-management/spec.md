# M2 — Gerenciamento de Mapas (US-01)

## Problem Statement

O usuário precisa gerenciar múltiplos mindmaps — criar novos, renomear existentes, excluir com confirmação e navegar para o canvas de edição de cada um. M1 entregou a fundação (schema, API skeleton, web skeleton); M2 entrega a primeira funcionalidade visível ao usuário.

## Goals

- [ ] CRUD completo de Map via API REST (list, create, rename, delete).
- [ ] Tela inicial que lista todos os mapas com ações de criar, renomear e excluir.
- [ ] Confirmação antes de exclusão (operação destrutiva — remove mapa e todos os nós).
- [ ] Navegação para o canvas de um mapa selecionado (canvas será placeholder até M3).
- [ ] Tipos compartilhados em `@mindmap/shared` para os contratos API↔web.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Edição de nós no canvas | M3 |
| Persistência automática de edições | M4 |
| Cores e dialog de edição | M5 |
| Propriedades de tarefa | M6 |
| Busca/filtro de mapas | Não está em US-01; pode virar deferred idea |
| Ordenação customizada da lista | Ordenação fixa por `updatedAt desc` é suficiente para v1 |
| Paginação | Não esperamos centenas de mapas de um único usuário em v1 |

---

## User Stories

### P1: Listar mapas ⭐ MVP

**User Story:** Como usuário, quero ver todos os meus mapas na tela inicial para escolher qual editar.

**Why P1:** Sem lista, não há como acessar mapas existentes.

**Acceptance Criteria:**

1. WHEN a tela inicial carrega THEN o sistema SHALL exibir uma lista de todos os mapas existentes, ordenados por `updatedAt` desc (mais recente primeiro).
2. WHEN não existem mapas THEN o sistema SHALL exibir um estado vazio com call-to-action para criar o primeiro mapa.
3. WHEN cada item da lista é exibido THEN o sistema SHALL mostrar o título do mapa e a data de última atualização formatada.

**Independent Test:** Inserir 3 mapas via API, abrir a tela inicial, ver os 3 listados em ordem de atualização.

---

### P1: Criar mapa ⭐ MVP

**User Story:** Como usuário, quero criar um novo mapa informando apenas um título para começar a trabalhar nele.

**Why P1:** Pré-requisito para qualquer uso do app.

**Acceptance Criteria:**

1. WHEN o usuário clica no botão de criar mapa THEN o sistema SHALL exibir um input para digitar o título.
2. WHEN o usuário submete o título (não-vazio) THEN o sistema SHALL criar o mapa no backend e adicioná-lo à lista imediatamente.
3. WHEN o mapa é criado THEN o sistema SHALL criar automaticamente um nó raiz com título "Central" vinculado ao mapa.
4. WHEN o título é vazio ou whitespace-only THEN o sistema SHALL impedir a criação e indicar que o campo é obrigatório.

**Independent Test:** Criar mapa "Teste", ver aparecer na lista; verificar via API que o mapa existe com 1 nó raiz.

---

### P1: Renomear mapa ⭐ MVP

**User Story:** Como usuário, quero renomear um mapa existente para mantê-lo organizado.

**Why P1:** Operação básica de gerenciamento.

**Acceptance Criteria:**

1. WHEN o usuário aciona renomear num mapa THEN o sistema SHALL exibir o título atual editável (inline ou modal).
2. WHEN o usuário confirma um novo título (não-vazio) THEN o sistema SHALL atualizar o título no backend e refletir na lista.
3. WHEN o novo título é vazio THEN o sistema SHALL impedir a atualização e manter o título anterior.

**Independent Test:** Renomear mapa "Teste" para "Projeto X", ver o novo título na lista.

---

### P1: Excluir mapa ⭐ MVP

**User Story:** Como usuário, quero excluir um mapa com confirmação para que dados não sejam perdidos por engano.

**Why P1:** Operação destrutiva precisa estar disponível desde o início.

**Acceptance Criteria:**

1. WHEN o usuário aciona excluir num mapa THEN o sistema SHALL exibir um dialog de confirmação informando que o mapa e todos os seus nós serão removidos permanentemente.
2. WHEN o usuário confirma a exclusão THEN o sistema SHALL remover o mapa e todos os nós associados (cascade) e atualizar a lista.
3. WHEN o usuário cancela THEN o sistema SHALL fechar o dialog sem alterações.

**Independent Test:** Excluir mapa, confirmar que sumiu da lista; verificar via DB que nós associados foram removidos.

---

### P1: Navegar para o canvas ⭐ MVP

**User Story:** Como usuário, quero clicar num mapa da lista para abrir seu canvas de edição.

**Why P1:** Sem navegação, o app não tem fluxo.

**Acceptance Criteria:**

1. WHEN o usuário clica no título/card de um mapa THEN o sistema SHALL navegar para a rota `/maps/:id`.
2. WHEN a rota `/maps/:id` carrega THEN o sistema SHALL exibir o título do mapa e uma área placeholder para o canvas (canvas real vem em M3).
3. WHEN o usuário clica em "Voltar" ou navega para `/` THEN o sistema SHALL retornar à lista de mapas.
4. WHEN o id não corresponde a nenhum mapa THEN o sistema SHALL exibir mensagem "Mapa não encontrado" com link para voltar à lista.

**Independent Test:** Criar mapa, clicar nele, ver a rota mudar e o placeholder aparecer; clicar voltar, ver a lista.

---

## Edge Cases

- WHEN a API retorna erro 500 em qualquer operação THEN o frontend SHALL exibir feedback de erro genérico (toast ou inline) sem crash.
- WHEN o usuário tenta criar mapa mas a API está offline THEN o frontend SHALL exibir "Não foi possível criar o mapa" sem tela branca.
- WHEN dois deletes são disparados rapidamente no mesmo mapa (double-click) THEN a API SHALL retornar 404 no segundo sem efeito colateral.
- WHEN o título contém caracteres especiais (emojis, acentos, <script>) THEN o sistema SHALL armazenar e exibir corretamente sem XSS.

---

## API Contract

Base path: `/maps`

| Method | Path | Body | Response | Status |
| --- | --- | --- | --- | --- |
| GET | `/maps` | — | `MapListResponse` | 200 |
| POST | `/maps` | `{ title: string }` | `MapDetail` | 201 |
| PATCH | `/maps/:id` | `{ title: string }` | `MapDetail` | 200 |
| DELETE | `/maps/:id` | — | — | 204 |
| GET | `/maps/:id` | — | `MapDetail` | 200 |

**Tipos (definidos em `@mindmap/shared`):**

```ts
interface MapSummary {
  id: string;
  title: string;
  updatedAt: string; // ISO 8601
}

interface MapDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface MapListResponse {
  maps: MapSummary[];
}

interface CreateMapBody {
  title: string;
}

interface UpdateMapBody {
  title: string;
}
```

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| M2-01 | Listar mapas — exibe lista ordenada por updatedAt desc | Pending | Pending |
| M2-02 | Listar mapas — estado vazio com CTA | Pending | Pending |
| M2-03 | Listar mapas — mostra título e data formatada | Pending | Pending |
| M2-04 | Criar mapa — input de título | Pending | Pending |
| M2-05 | Criar mapa — cria no backend e atualiza lista | Pending | Pending |
| M2-06 | Criar mapa — cria nó raiz automático | Pending | Pending |
| M2-07 | Criar mapa — validação de título não-vazio | Pending | Pending |
| M2-08 | Renomear mapa — exibe título editável | Pending | Pending |
| M2-09 | Renomear mapa — atualiza no backend e reflete na lista | Pending | Pending |
| M2-10 | Renomear mapa — validação de título não-vazio | Pending | Pending |
| M2-11 | Excluir mapa — dialog de confirmação | Pending | Pending |
| M2-12 | Excluir mapa — remove mapa + nós (cascade) e atualiza lista | Pending | Pending |
| M2-13 | Excluir mapa — cancelar não faz nada | Pending | Pending |
| M2-14 | Navegar — clique leva para /maps/:id | Pending | Pending |
| M2-15 | Navegar — rota exibe título + placeholder | Pending | Pending |
| M2-16 | Navegar — voltar retorna à lista | Pending | Pending |
| M2-17 | Navegar — id inexistente mostra "não encontrado" | Pending | Pending |

**Coverage:** 17 requisitos derivados de US-01.

---

## Success Criteria

- [ ] `GET /maps` retorna lista de mapas ordenada corretamente.
- [ ] Criar mapa via UI resulta em mapa + nó raiz no DB.
- [ ] Renomear mapa via UI reflete imediatamente na lista.
- [ ] Excluir mapa com confirmação remove do DB (cascade) e da lista.
- [ ] Clicar num mapa navega para `/maps/:id` com placeholder.
- [ ] Voltar retorna à lista sem recarregamento.
- [ ] Estado vazio mostra CTA quando não há mapas.
- [ ] Erros de API são tratados sem crash.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa.
