# M14 — Hierarquia visual + espaçamento — Spec

> Feature de canvas, **só frontend** (`packages/web/src/pages/map/`). Dá hierarquia visual
> por profundidade (estilo MindMeister) **e** embute o alívio de espaçamento entre nós no mesmo
> pacote (pedido do usuário — ver [context.md](./context.md) C6). Sem backend, sem infra.
> Planejamento apenas; execução em chat separado ([[feedback-plan-execute-split]]).
>
> Gray areas resolvidas em [context.md](./context.md); arquitetura em [design.md](./design.md);
> quebra em [tasks.md](./tasks.md). Dependências já entregues: **M8** (layout bidirecional),
> **M12** (altura por nó), **M15** (largura por nó). Toca a mesma área geométrica do **M13**
> (drop bar / slots, AD-021).

## Objetivo

Duas dores no mesmo lugar (o canvas):

1. **Sem hierarquia visual** — todo nó parece igual; central, ramos e folhas não se distinguem.
   Falta a leitura "de relance" que o MindMeister dá (ramos coloridos, centro em destaque).
2. **Nós espremidos** — `GAP_Y`/`GAP_X` fixos em 24px deixam subárvores vizinhas encostando; além
   de apertado visualmente, **quebra o drop-indicator**: as faixas de drop de ramos vizinhos se
   sobrepõem, o `nearestSlot` empata entre coluna certa/errada e a ghost bar "pula" (caso relatado:
   não dá pra soltar um nó como filho de um card porque o card de um irmão interfere na faixa).

## Terminologia de tiers (numeração do usuário)

| Tier | `depth` (0-based, código) | Papel | Ênfase |
|---|---|---|---|
| **N1** | 0 | nó central (raiz) | máxima |
| **N2** | 1 | cabeça de ramo (filho direto do central) | intermediária |
| **N3+** | ≥2 | resto (netos em diante) | neutra/uniforme |

Máximo **3 tiers** (C5). N3+ é uniforme — não há degradê por profundidade além disso.

## Requisitos

### Plumbing de profundidade e ramo

- **M14-01** — Computar `depth` por nó (0 = central) no walk da árvore e propagá-lo até o
  `MindNodeData` (hoje só existe `isRoot`; não há `depth`). Fonte única — sem recomputar por nó no render.
- **M14-02** — `LayoutLink` passa a carregar a **identidade do ramo**: `branchHeadId: string | null`
  = o id da **N2 ancestral** do destino da edge. Para a edge central→N2, é o próprio N2 (o destino);
  para edges profundas, é a N2 no topo daquela subárvore. Hoje `LayoutLink` só tem `source`/`target`.

### Ênfase por tier (nós)

- **M14-03** — Ênfase por **tipografia/escala**, não por largura (largura é do usuário — M15/AD-020, C1):
  N1 com maior destaque (fonte/peso/tamanho), N2 intermediário, N3+ neutro uniforme. `cardSkin`
  (em `MindNode.tsx`) passa a receber `depth`. Valores exatos = calibração ao vivo na execução.
- **M14-04** — **Fundo dos cards intocado** (o usuário é dono da cor de fundo — paleta M10/M15, C2).
  A ênfase vive só em tipografia/escala/peso (e, no máximo, um leve bump de largura *default* só do N1).
  O N1 mantém o comportamento atual de **ignorar** a cor do usuário (sempre `DEFAULT_BG`).

### Edges coloridas por ramo (modelo MindMeister)

- **M14-05** — Cor da edge = cor **derivada da cabeça de ramo (N2)** ancestral do destino, aplicada a
  **toda** a subárvore abaixo daquela N2 (C3). Regras: a cor do **central (N1) não propaga**; nós
  **intermediários** pintados **não** mudam a cor do ramo (mudam só o próprio fundo). A cor vem do
  `bgColor` da N2.
- **M14-06** — **Default**: N2 **sem** cor custom (`bgColor === null`) → edge **neutra** (o `stroke-edge`
  atual) até o usuário pintar. **Sem auto-atribuição** de paleta (o arco-íris emerge conforme o usuário
  pinta as N2 — C4).
- **M14-07** — Helper `branchStroke()` em `contrast.ts` deriva um traço **legível** do `bgColor` da N2,
  ajustando luminância nos casos de baixo contraste sobre o canvas escuro (ex.: azul-marinho `#2f3e57`).
  Valores exatos = tweak de design (C3 — usuário pediu pra não travar cor agora).
- **M14-08** — *(Opcional / calibração)* leve afinamento de espessura da edge por profundidade
  (N2 mais grossa, N3+ mais fina). Entra só se ajudar a leitura; decidido ao vivo.

### Espaçamento

- **M14-09** — Subir `GAP_Y` e `GAP_X` (proposta **24 → 40**, na grade de 4px [[feedback-spacing-grid]]),
  calibrados ao vivo. Alivia o aperto visual **e** separa as faixas de drop de ramos vizinhos,
  removendo o empate do `nearestSlot` no caso relatado.
- **M14-10** — Corrigir o único hardcode de gap nos testes: `slots.test.ts` usa `+ 24` literal
  (trocar por `GAP_X` importado). Os demais testes já importam as constantes e sobrevivem à troca.

### Testes

- **M14-11** — Unit: `depth` correto por nó; `branchHeadId` propaga certo nas edges (central→N2 = o
  próprio N2; profundas = N2 ancestral); `branchStroke()` (null → neutro; pastel claro → verbatim/ok;
  cor escura → luminância ajustada). Verificar que os testes de layout/slots seguem verdes com o gap novo.

## Fora de escopo

- **M14-12** — **Fundo de card transparente** — Deferred (registrado no STATE); difícil por resize
  handle/hover/ancoragem de layout. **Auto-arco-íris** (atribuir cor às N2 automaticamente) — rejeitado
  (C4, default é neutro). **Reescrever a precedência do `nearestSlot`** — só se o espaçamento não bastar
  em cantos apertados; é outra tarefa, não fazer preventivamente (C8). **4º tier** ou degradê contínuo
  por profundidade — fora (C5). Nada de backend/persistência (a cor já persiste como `bgColor` do nó).
