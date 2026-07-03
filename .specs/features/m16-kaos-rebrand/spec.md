# M16 — Rebrand Kaos + reskin do design system — Specification

## Problem Statement

O produto hoje tem identidade genérica ("Mapas mentais", header neutro, acento azul, fonte
Geist) — resultado do M10, que **deliberadamente** portou o redesign anterior sem branding.
O guia novo `Mindmaps system interface(2)/` define uma identidade própria — **Kaos**: logo
sigilo, paleta quente marrom-carvão + acento vermelho, tipografia com Chakra Petch / Space
Grotesk / IBM Plex Mono, e microdetalhes visuais (grid pontilhado no canvas, formatos de card
mais afiados, watermark do sigilo no empty state). Queremos vestir o produto com essa identidade.

Isto é **puramente um reskin visual**: toda a funcionalidade já existe (M6/M10/M15 — status,
prioridade/crítico, responsável, paleta de cor de fundo/texto, contraste WCAG, canvas
raiz→ramo→folha, métricas nos cards). Nenhuma mudança de contrato, schema ou comportamento.

## Goals

- [ ] Identidade **Kaos** aplicada de ponta a ponta na UI: logo sigilo, nome, tagline, paleta
      quente e acento vermelho substituindo o azul.
- [ ] Tipografia do guia adotada e self-hosted: Chakra Petch (títulos/logo), Space Grotesk
      (corpo), IBM Plex Mono (labels/metadados).
- [ ] Fidelidade visual às telas do guia ("Meus Mapas", "Estudo de Nós", "Editar nó") sem
      regredir nenhum comportamento existente (drag, resize, edição, persistência).
- [ ] Zero mudança de backend/contrato/schema. Zero regressão de testes existentes.

## Out of Scope

Explicitamente excluído — documentado para evitar scope creep.

| Item                                        | Motivo                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Campo **Notas** no editor (guia mostra)     | Decisão do usuário: mantém redesign puramente visual (sem migration/API) |
| Migrar editor de nó para **painel lateral** | Decisão do usuário: mantém o modal atual, só reskin                |
| Rename interno (`@mindmap`, dirs, DB, repo) | Decisão do usuário: só a interface visível vira "Kaos"            |
| Botão **"Ajuda"** e avatar "EU" no header   | Decorativos no guia; sem funcionalidade definida                   |
| **Preview no card** (glifo decorativo do guia)   | Decisão do usuário: glifo decorativo não vale a pena; só thumbnail **real** valeria, e isso é feature de backend+render (fora de reskin) → **adiado** |
| Mudança em layout/geometria do canvas       | M7/M8/M9/M13/M15 intactos; reskin não toca `useTreeLayout`/`slots.ts` |
| Mudança no modelo de `assignee`             | Segue string livre (AD-003); avatar é só iniciais                  |

---

## User Stories

### P1: Identidade Kaos no app shell ⭐ MVP

**User Story**: Como usuário, quero que o app tenha a identidade visual "Kaos" (logo, nome,
tipografia, paleta) para que o produto tenha carácter próprio em vez de um tema genérico.

**Why P1**: É o núcleo do rebrand; tudo mais herda os tokens (cores/fontes) definidos aqui.

**Acceptance Criteria**:

1. WHEN o app carrega THEN o sistema SHALL exibir no header o **sigilo Kaos** (asset
   `kaos-sigil.svg`) em vermelho com glow, o nome **"KAOS"** em Chakra Petch com tracking largo,
   e a tagline **"mapas mentais"** em IBM Plex Mono separada por divisória.
2. WHEN qualquer tela renderiza THEN o sistema SHALL usar a paleta quente do guia (fundo base
   `#0d0a09`, superfícies `#15110f`/`#19181c`, bordas `#241c19`, acento vermelho `#a0111b`/`#c4151f`)
   no lugar da paleta cinza-neutra + azul atual.
3. WHEN texto é renderizado THEN o sistema SHALL aplicar Chakra Petch a títulos/logo, Space
   Grotesk ao corpo, e IBM Plex Mono a labels, contadores e datas — todas **self-hosted**
   (sem requisição a fonts.googleapis.com em runtime).
4. WHEN o usuário passa o mouse em botões de ação primária THEN o sistema SHALL usar o hover
   vermelho do guia (halo `rgba(255,90,48,.45)`) em vez do azul atual.

**Independent Test**: Abrir qualquer tela; ver logo sigilo + "KAOS" + tagline, fundo quente,
acento vermelho, fontes do guia carregando localmente (Network sem googleapis).

---

### P1: Home "Meus Mapas" reskinada ⭐ MVP

**User Story**: Como usuário, quero a tela de mapas com o visual Kaos para navegar meus mapas
numa interface coesa com a nova identidade.

**Why P1**: Primeira tela do produto; vitrine do rebrand.

**Acceptance Criteria**:

1. WHEN a home renderiza THEN o sistema SHALL exibir "Meus Mapas" (Chakra Petch), contador de
   mapas em IBM Plex Mono, botão "Novo mapa" vermelho, busca e ordenação (Recentes/A–Z/Mais nós)
   com o visual do guia — **preservando** o comportamento atual de busca/sort/criar/renomear/excluir.
2. WHEN um card de mapa renderiza THEN o sistema SHALL exibir título, menu ⋯, o contador de nós
   e o badge de críticos (quando houver) em IBM Plex Mono, e o rodapé "Criado …"/"Editado …"
   sobre divisória — usando `nodeCount`/`criticalCount`/`createdAt`/`updatedAt` já existentes.
3. WHEN o hover ocorre num card THEN o sistema SHALL aplicar elevação (translateY + sombra +
   borda quente) conforme o guia.
4. WHEN não há mapas THEN o sistema SHALL exibir o empty state com **watermark do sigilo Kaos**
   ao fundo, título em Chakra Petch e CTA vermelho ("Despejar o primeiro mapa").
5. WHEN a busca não retorna resultados THEN o sistema SHALL exibir o empty state "Nada
   encontrado" com CTA "Limpar busca".
6. WHEN o usuário abre "Novo mapa" THEN o sistema SHALL exibir o modal reskinado (fundo quente,
   overlay com blur, título Chakra Petch, input com foco vermelho, botões Cancelar/Criar mapa).

**Independent Test**: Abrir a home; ver grid de cards no visual Kaos, criar/buscar/ordenar/
renomear/excluir funcionando, empty state com watermark do sigilo.

---

### P1: Canvas "Estudo de Nós" reskinado ⭐ MVP

**User Story**: Como usuário, quero o canvas com o visual Kaos (grid pontilhado, cards afiados,
toolbar em hover) para editar o mapa na nova identidade sem perder nenhuma interação.

**Why P1**: Tela principal de trabalho; onde o rebrand mais aparece em uso.

**Acceptance Criteria**:

1. WHEN o canvas renderiza THEN o sistema SHALL exibir fundo `#101012` com **grid pontilhado**
   (radial-dots 24×24) e edges nas cores frias do guia (`#3a363d`/`#33303a`; edge tracejada de
   reparent em `#4a4550`).
2. WHEN um nó **raiz** renderiza THEN o sistema SHALL usá-lo como âncora neutra (fundo escuro
   `#19181c`, borda `#38353f`, cantos arredondados) — **sem** cor de usuário.
3. WHEN um nó **ramo/folha** renderiza THEN o sistema SHALL aplicar a cor de fundo do usuário,
   texto conforme contraste, dot+label de status, avatar de responsável (iniciais) e o marcador
   **▲ crítico** na linha do título quando `isCritical` — cantos progressivamente mais afiados
   (ramo ~5px, folha ~3px) conforme o guia.
4. WHEN o hover ocorre num nó THEN o sistema SHALL revelar a toolbar flutuante do guia (fundo
   `#26242b`, borda `#3a3742`) com ações existentes (adicionar/editar/excluir) — **preservando**
   a lógica de toolbar atual (M10) e o gesto de resize/drag (M15/M9).
5. WHEN um nó é criado/aparece THEN o sistema SHALL animar com "sprout" (scale-in) e as edges
   com "edgeIn" (fade), conforme o guia — sem prejudicar performance de pan/zoom.

**Independent Test**: Abrir um mapa; ver grid pontilhado, raiz neutra, cards coloridos afiados
com status/avatar/▲, toolbar no hover, e drag/resize/edição funcionando como antes.

---

### P1: Modal "Editar nó" reskinado ⭐ MVP

**User Story**: Como usuário, quero o modal de edição no visual Kaos com preview ao vivo para
editar cor/status/prioridade/responsável de forma coesa.

**Why P1**: Completa o loop de edição visual; usa o medidor de contraste já existente.

**Acceptance Criteria**:

1. WHEN o modal abre THEN o sistema SHALL exibi-lo com a paleta quente do guia (fundo `#15110f`,
   borda `#2c2420`), título "Editar nó" em Chakra Petch, e labels de seção em IBM Plex Mono
   maiúsculo — **mantendo a estrutura de modal atual** (não vira painel lateral).
2. WHEN o usuário altera título/cor/status/prioridade/responsável THEN o sistema SHALL atualizar
   a **prévia ao vivo** do card (fundo, texto, ▲ crítico, dot+label de status, avatar) conforme
   o guia.
3. WHEN a combinação fundo/texto muda THEN o sistema SHALL exibir o **medidor de contraste WCAG**
   (Boa leitura / Razoável / Contraste baixo + razão X:1) já existente (M10), com o visual do guia.
4. WHEN os swatches de cor de fundo/texto renderizam THEN o sistema SHALL usar o ring de seleção
   vermelho do guia (`0 0 0 2px bg, 0 0 0 4px #a0111b`).
5. WHEN os botões Cancelar/Salvar renderizam THEN o sistema SHALL usar o estilo do guia (Salvar
   vermelho com halo no hover).

**Independent Test**: Abrir o modal num nó; alterar campos e ver a prévia + contraste
atualizarem no visual Kaos; salvar persiste como antes.

---

### P2: Microinterações e motion

**User Story**: Como usuário, quero as microanimações do guia (sprout dos nós, fade das edges,
entrada do modal) para uma sensação mais polida.

**Why P2**: Polish; não bloqueia o uso.

**Acceptance Criteria**:

1. WHEN o modal/overlay abre THEN o sistema SHALL animar com fade + translateY/scale (`ovIn`/`mdIn`).
2. WHEN respeitar `prefers-reduced-motion` THEN o sistema SHALL reduzir/suprimir as animações.

---

## Edge Cases

- WHEN uma cor de fundo escura de usuário encontra um card afiado THEN o texto SHALL seguir a
  regra de contraste automático já existente (não regredir M10).
- WHEN a fonte self-hosted ainda não carregou THEN o sistema SHALL exibir fallback de sistema
  sem quebra de layout (font-display swap).
- WHEN `criticalCount === 0` THEN o card SHALL ocultar o badge de críticos (comportamento M10).
- WHEN o título do mapa/nó é muito longo THEN o sistema SHALL truncar/refluir como hoje
  (M12/ellipsis) — o reskin não altera medição.
- WHEN `prefers-reduced-motion: reduce` THEN o sistema SHALL não animar sprout/edgeIn.

---

## Requirement Traceability

| Requirement ID | Story                         | Phase  | Status  |
| -------------- | ----------------------------- | ------ | ------- |
| M16-01         | P1: Identidade (logo+nome+tag) | Design | Pending |
| M16-02         | P1: Identidade (paleta tokens) | Design | Pending |
| M16-03         | P1: Identidade (tipografia)    | Design | Pending |
| M16-04         | P1: Identidade (acento hover)  | Design | Pending |
| M16-05         | P1: Home reskin (grid/busca/sort) | Design | Pending |
| M16-06         | P1: Home card (métricas/rodapé) | Design | Pending |
| M16-07         | P1: Home empty state + watermark | Design | Pending |
| M16-08         | P1: Home modal criar          | Design | Pending |
| M16-09         | P1: Canvas grid + edges       | Design | Pending |
| M16-10         | P1: Canvas raiz neutra        | Design | Pending |
| M16-11         | P1: Canvas ramo/folha (skin)  | Design | Pending |
| M16-12         | P1: Canvas toolbar hover      | Design | Pending |
| M16-13         | P1: Canvas motion (sprout/edge) | Design | Pending |
| M16-14         | P1: Modal editar (paleta/tipo) | Design | Pending |
| M16-15         | P1: Modal preview ao vivo     | Design | Pending |
| M16-16         | P1: Modal contraste (reskin)  | Design | Pending |
| M16-17         | P1: Modal swatches ring       | Design | Pending |
| M16-18         | P2: Motion + reduced-motion   | -      | Pending |

**ID format:** `M16-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 18 total, 0 mapped to tasks (design pendente)

**Deferred:** thumbnail **real** do mapa no card (feature de backend+render; `GET /maps` hoje
só devolve métricas, não a árvore) → candidato a feature futura.

---

## Success Criteria

- [ ] Todas as telas exibem a identidade Kaos (logo/nome/paleta/fontes) fiel ao guia.
- [ ] Zero requisição a fontes remotas em runtime (fontes self-hosted).
- [ ] Nenhum teste existente regride: typecheck/lint verdes, unit web/api verdes, e2e verdes.
- [ ] Nenhuma mudança em backend/contrato/schema/`useTreeLayout`/`slots.ts`.
- [ ] Smoke visual conferido pelo usuário nas 4 telas (home, card, canvas, modal).
</content>
</invoke>
