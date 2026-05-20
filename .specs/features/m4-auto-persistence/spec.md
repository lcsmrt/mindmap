# M4 — Persistência Automática (US-05)

## Problem Statement

M3 implementou persistência funcional — cada mutação chama a API imediatamente via TanStack Query. Porém o contrato está implícito e vários edge cases ficaram descobertos: (1) erros de rede não são retentados, mutações falham silenciosamente se o usuário fecha o banner antes de perceber; (2) o banner de erro é singular e sobrescrito por erros subsequentes, perdendo informação; (3) não há feedback de que uma mutação está em andamento (o canvas atualiza só após refetch, causando flash de estado antigo); (4) a restauração completa do estado ao reabrir um mapa não foi formalizada como contrato testável.

M4 transforma a persistência de "funciona no happy path" para "confiável e transparente": o usuário nunca se preocupa com salvamento, é informado quando algo falha, e reencontra o mapa exatamente como deixou.

## Goals

- [ ] Toda mutação no canvas persiste de forma assíncrona e não-bloqueante, com retry automático em falhas transientes (RNF-03).
- [ ] Feedback visual claro: indicador de salvamento em andamento; toast/notificação quando uma mutação falha após retries, sem perder erros anteriores.
- [ ] Optimistic updates nas mutações de node para que o canvas reflita a ação do usuário imediatamente, sem aguardar round-trip.
- [ ] Restauração verificável: reabrir qualquer mapa restaura estrutura, `sortOrder`, cores e propriedades de tarefa. (Expand/collapse não persiste — AD-004.)
- [ ] Formalizar o contrato de persistência com testes automatizados (unit nos hooks de mutation; e2e de restauração).

## Out of Scope

| Item | Motivo |
| --- | --- |
| Debounce de rename (agrupar keystrokes) | Rename já é commit-on-enter/blur; não faz chamadas intermediárias |
| Sync entre múltiplas abas | Single-user, edge case raro; last-write-wins suficiente em v1 |
| Modo offline completo (queue persistente, sync na reconexão) | Overengineering para ferramenta pessoal; retry cobre blips de rede |
| Conflict resolution formal (CRDT, OT) | Single-user, sem colaboração |
| Cores e propriedades de tarefa — edição UI | M5/M6; M4 apenas garante que campos existentes são restaurados |
| Undo/redo persistente | Fora de v1 |
| Indicador de "salvo" permanente (tipo Google Docs) | Excesso para single-user; silêncio = salvo, barulho = erro |

---

## Decisões Incorporadas

1. **Optimistic updates em todas as mutações de node** (create, rename, delete, move): canvas reflete a ação imediatamente; reverte em caso de falha da API. Origem: deferred idea do STATE.md + AD-010.
2. **Toast queue substitui o banner singular**: múltiplos erros podem aparecer sem se sobrescrever. Toast auto-dismiss após ~5 s, com ação de dismiss manual. Origem: CONCERNS.md deferred ideas.
3. **Retry via TanStack Query**: 3 tentativas com exponential backoff (`1s → 2s → 4s`) para erros de rede (status 0 / TypeError / 5xx). Erros 4xx não são retriados (client error, não transiente).
4. **`saving` indicator**: mostrado enquanto qualquer mutation está `isPending`. Indicador discreto (ponto ou texto "Salvando…" no canto), desaparece quando idle.
5. **Restauração testa todos os campos do NodeDto**: mesmo que cores/tarefa sejam `null` agora, o teste verifica que o round-trip preserva os valores quando presentes no banco.

---

## User Stories

### P1: Retry automático em falha transiente ⭐ MVP

**User Story:** Como usuário, quero que falhas momentâneas de rede não causem perda de dados, para não me preocupar com a estabilidade da conexão.

**Why P1:** Sem retry, qualquer blip de rede perde a mutação silenciosamente (o usuário pode nem ver o banner antes que outra ação o sobrescreva).

**Acceptance Criteria:**

1. WHEN uma mutação de node falha com erro de rede (fetch TypeError, HTTP 5xx, ou timeout) THEN o sistema SHALL retentar até 3 vezes com backoff exponencial (1s, 2s, 4s).
2. WHEN o retry tem sucesso THEN a mutação SHALL ser tratada como sucesso normal (cache invalidado, UI atualizada).
3. WHEN todas as tentativas falham THEN o sistema SHALL exibir um toast de erro com a mensagem da falha e reverter o estado otimista.
4. WHEN a mutação falha com erro de cliente (HTTP 4xx) THEN o sistema SHALL NOT retentar — exibir toast imediatamente e reverter.

**Independent Test:** Interceptar chamada de rede (via devtools throttle ou mock), forçar 2 falhas seguidas de rede, ver que a terceira tentativa funciona sem intervenção do usuário.

---

### P1: Optimistic updates ⭐ MVP

**User Story:** Como usuário, quero que o canvas reflita minhas ações imediatamente (sem flash ou delay), para que a edição pareça instantânea.

**Why P1:** Atualmente o canvas só atualiza após o refetch pós-invalidate, causando um flash visível (nó some e reaparece, ou posição pula). Optimistic UI elimina isso.

**Acceptance Criteria:**

1. WHEN o usuário adiciona um nó filho THEN o canvas SHALL exibir o novo nó imediatamente (com ID temporário se necessário), antes da resposta da API.
2. WHEN o usuário renomeia um nó THEN o texto no canvas SHALL atualizar imediatamente ao confirmar, antes da resposta da API.
3. WHEN o usuário exclui um nó THEN o nó e sua subárvore SHALL desaparecer do canvas imediatamente, antes da resposta da API.
4. WHEN o usuário move um nó (drag-drop) THEN a subárvore SHALL aparecer sob o novo pai imediatamente, layout recalculado, antes da resposta da API.
5. WHEN a API retorna sucesso THEN o estado otimista SHALL ser substituído pelo estado real (com ID definitivo no caso de create) sem flash perceptível.
6. WHEN a API retorna erro (após retries) THEN o estado otimista SHALL ser revertido ao estado pré-mutação, canvas re-renderiza na posição original, e um toast de erro aparece.

**Independent Test:** Adicionar throttle de 2s na rede; adicionar filho; ver o nó aparecer instantaneamente; após 2s, confirmar que o ID temporário foi substituído pelo definitivo (inspecionar via devtools). Repetir com rename/delete/move.

---

### P1: Toast de erro não-destrutivo ⭐ MVP

**User Story:** Como usuário, quero ser notificado de cada falha de persistência de forma clara e sem perder notificações anteriores, para poder agir se necessário.

**Why P1:** O banner atual é sobrescrito por erros subsequentes. Se duas mutações falham em sequência, o usuário só vê a última.

**Acceptance Criteria:**

1. WHEN uma mutação falha (após retries esgotados) THEN o sistema SHALL exibir um toast com: ícone de erro, descrição curta da operação que falhou, e a mensagem do erro.
2. WHEN múltiplas mutações falham THEN os toasts SHALL empilhar (stack), cada um visível independentemente.
3. WHEN 5 segundos passam sem interação do usuário com o toast THEN o toast SHALL fazer auto-dismiss com animação de saída.
4. WHEN o usuário clica no botão de fechar do toast THEN o toast SHALL fazer dismiss imediato.
5. WHEN não há erros pendentes THEN nenhum toast SHALL ser visível — silêncio significa sucesso.

**Independent Test:** Forçar 3 erros de API em sequência rápida; ver 3 toasts empilhados visíveis simultaneamente; esperar 5s; ver os toasts desaparecerem automaticamente.

---

### P2: Indicador de salvamento em andamento

**User Story:** Como usuário, quero ver uma indicação sutil quando o sistema está salvando, para ter confiança de que minha ação foi registrada.

**Why P2:** Sem indicador, em conexões lentas o usuário pode achar que a ação não teve efeito (antes do resultado chegar).

**Acceptance Criteria:**

1. WHEN qualquer mutation de node está com status `isPending` THEN o sistema SHALL exibir um indicador discreto (ex: "Salvando…" ou spinner) posicionado no canto do canvas, sem bloquear interação.
2. WHEN todas as mutations voltam a `idle`/`success` THEN o indicador SHALL desaparecer.
3. WHEN o indicador está visível THEN o usuário SHALL poder continuar interagindo normalmente (pan, zoom, add, edit, etc.) — persistência é não-bloqueante (RNF-03).

**Independent Test:** Adicionar throttle de 2s; realizar ação no canvas; ver "Salvando…" aparecer; após 2s, ver desaparecer.

---

### P1: Restauração completa ao reabrir ⭐ MVP

**User Story:** Como usuário, quero que ao reabrir um mapa tudo esteja exatamente como deixei (estrutura, ordem, cores, dados de tarefa), para nunca perder trabalho.

**Why P1:** É o critério central de US-05. Sem isso, a persistência automática não tem valor.

**Acceptance Criteria:**

1. WHEN o usuário reabre um mapa (navega para `/maps/:id`) THEN o sistema SHALL buscar todos os nodes via `GET /api/maps/:id/nodes` e renderizar a árvore com: hierarquia correta (`parentId`), ordem correta (`sortOrder`), cores aplicadas (`bgColor`, `textColor`), e propriedades de tarefa preservadas (`status`, `assignee`, `isCritical`).
2. WHEN o mapa é reaberto THEN expand/collapse SHALL iniciar tudo expandido — estado não persiste (AD-004).
3. WHEN o mapa é reaberto THEN o layout SHALL ser recalculado via elkjs worker — posições absolutas não são persistidas (AD-002).
4. WHEN um nó teve `sortOrder` alterado por move THEN ao reabrir, os irmãos SHALL aparecer na ordem correta definida pelo `sortOrder` persistido.

**Independent Test:** Criar nós, mover um nó para outro pai, recarregar a página (F5); verificar que a estrutura, ordem dos irmãos e títulos estão exatamente como antes. (Cores e task props: setar via API direta, verificar que voltam ao reabrir.)

---

## Edge Cases

- WHEN o usuário realiza múltiplas mutações em sequência rápida (ex: add + rename + add) THEN cada mutação SHALL rodar independentemente via TanStack Query mutation queue. O estado otimista acumula — nenhuma mutação "engole" a anterior.
- WHEN o create otimista gera um ID temporário e outra mutação referencia esse ID antes da resposta THEN o sistema SHALL aguardar a resolução do create antes de enviar a mutação dependente, OU usar o ID real retornado pela API para substituir. (Na prática: create é a única operação que gera ID; rename/delete/move usam IDs existentes. A dependência real é: "add filho" seguido de "renomear o filho recém-criado" — o rename deve usar o ID definitivo retornado pelo create.)
- WHEN uma mutação otimista de delete é revertida THEN o nó e toda a subárvore SHALL reaparecer no canvas na posição original; o layout SHALL recalcular.
- WHEN uma mutação otimista de move é revertida THEN a subárvore SHALL voltar ao pai original com `sortOrder` original; layout recalcula.
- WHEN a conexão está completamente fora (offline prolongado) THEN mutações falham após retries e toasts aparecem. Não há queue offline — o usuário vê o erro e pode retentar manualmente. (Escopo mínimo para v1.)
- WHEN o backend retorna dados divergentes do estado otimista (ex: title foi truncado, sortOrder recalculado) THEN o refetch pós-success SHALL sobrescrever o estado otimista com a verdade do servidor — sem conflito, servidor é authoritative.

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
| --- | --- | --- | --- |
| M4-01 | Retry — retentar em erro de rede/5xx (até 3x, backoff) | P1 | Pending |
| M4-02 | Retry — sucesso após retry trata como sucesso normal | P1 | Pending |
| M4-03 | Retry — falha após retries exibe toast e reverte otimismo | P1 | Pending |
| M4-04 | Retry — 4xx não retenta, toast imediato | P1 | Pending |
| M4-05 | Optimistic — create exibe nó imediatamente | P1 | Pending |
| M4-06 | Optimistic — rename reflete imediatamente | P1 | Pending |
| M4-07 | Optimistic — delete remove imediatamente | P1 | Pending |
| M4-08 | Optimistic — move reposiciona imediatamente | P1 | Pending |
| M4-09 | Optimistic — sucesso da API substitui estado otimista sem flash | P1 | Pending |
| M4-10 | Optimistic — falha reverte ao estado pré-mutação + toast | P1 | Pending |
| M4-11 | Toast — exibe erro com descrição da operação + mensagem | P1 | Pending |
| M4-12 | Toast — múltiplos toasts empilham sem sobrescrever | P1 | Pending |
| M4-13 | Toast — auto-dismiss em 5s | P1 | Pending |
| M4-14 | Toast — dismiss manual por botão | P1 | Pending |
| M4-15 | Toast — silêncio quando sem erros | P1 | Pending |
| M4-16 | Saving indicator — visível enquanto mutation isPending | P2 | Pending |
| M4-17 | Saving indicator — desaparece quando idle | P2 | Pending |
| M4-18 | Saving indicator — não bloqueia interação | P2 | Pending |
| M4-19 | Restauração — hierarquia correta (parentId) | P1 | Pending |
| M4-20 | Restauração — ordem correta (sortOrder) | P1 | Pending |
| M4-21 | Restauração — cores preservadas (bgColor, textColor) | P1 | Pending |
| M4-22 | Restauração — propriedades de tarefa preservadas | P1 | Pending |
| M4-23 | Restauração — expand/collapse inicia expandido (AD-004) | P1 | Pending |
| M4-24 | Restauração — layout recalculado (AD-002) | P1 | Pending |

**Coverage:** 24 requisitos — 21 P1, 3 P2.

---

## Success Criteria

- [ ] Toda mutação (add, rename, delete, move) reflete no canvas imediatamente (optimistic) e persiste sem ação de "salvar".
- [ ] Forçar falha de rede: retry automático 3x; se todas falham, toast aparece e estado reverte. Múltiplos toasts empilham.
- [ ] Erro 4xx (ex: move para descendente): toast imediato sem retry, canvas reverte.
- [ ] Reabrir um mapa restaura estrutura, ordem, cores e task props (round-trip verificado via teste e2e ou smoke).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passa.
- [ ] Specs e2e do milestone passam (AD-014).
- [ ] Canvas permanece interativo durante salvamento (mutações não bloqueiam UI).

---

## Skills Aplicáveis (executor)

- **`react-flow`** — sincronização de estado otimista com o canvas React Flow, controle de nodes/edges durante rollback.
- **`web-api-integration`** — TanStack Query: `onMutate`/`onError`/`onSettled` para optimistic updates, `retry`/`retryDelay` config, `useIsMutating`.
- **`web-component-creation`** — componente Toast (ou integrar com shadcn/ui toast se disponível no Base UI migration).
- **`api-backend`** — nenhum endpoint novo; apenas verificar que a API retorna todos os campos para restauração.
