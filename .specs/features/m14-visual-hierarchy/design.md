# M14 — Hierarquia visual + espaçamento — Design

> Só frontend, dentro de `packages/web/src/pages/map/`. Nenhum contrato/DTO novo, nenhum backend.
> A cor do ramo **não** é dado novo — deriva do `bgColor` do nó (que já persiste). Referências de
> arquivo: `lib/useTreeLayout.ts`, `lib/slots.ts`, `components/MindNode.tsx`, `components/MapCanvas.tsx`,
> `components/GhostBar.tsx`, `lib/contrast.ts`, `components/color-palette.ts`.

## Visão geral dos seams

```
computeTreeLayout (useTreeLayout.ts)
  ├─ PositionedNode ganha `depth: number`      (0 = central; N2 = 1; N3+ ≥ 2)
  └─ LayoutLink ganha `branchHeadId: string|null` (N2 ancestral do destino)
        │
        ▼
MapCanvas.tsx
  ├─ nodeDataById: injeta `depth` no MindNodeData
  └─ render de edges: branchHeadId → bgColor da N2 (nodeById) → branchStroke() → stroke inline
        │                                                         (null ⇒ classe stroke-edge atual)
        ▼
MindNode.tsx / cardSkin(depth, …)
  └─ ênfase por tier em tipografia/escala (fundo intocado)

contrast.ts
  └─ branchStroke(bgColor): string|null   (deriva traço legível; null quando bgColor null)

useTreeLayout.ts (constantes)
  └─ GAP_Y / GAP_X: 24 → 40 (calibrar)     + fix do hardcode em slots.test.ts
```

## Profundidade e identidade de ramo (M14-01/02)

Computados **durante o walk que já existe** em `computeTreeLayout`, sem segunda passada:

- O central é empilhado com `depth: 0` (bloco da raiz, antes do `layoutSide`).
- Em `layoutSide`, o `flextree` já dá a profundidade de cada nó via a hierarquia
  (`sideRoot.depth === 0` é o central; seus filhos são N2 com `depth === 1`; etc.). Empilhar
  `depth: n.depth` em cada `PositionedNode`.
- **`branchHeadId`** por nó, propagado no `each`: se `n.parent === sideRoot` (é N2), `branchHeadId = n.data.node.id`
  (ele próprio); senão herda o `branchHeadId` do pai. Guardar num `Map<id, branchHeadId>` local ao
  `layoutSide` e usar ao criar cada `LayoutLink`:
  - edge central→N2 (`n.parent === sideRoot`): `branchHeadId = n.data.node.id` (o próprio N2).
  - edge profunda (pai→filho): `branchHeadId` = o da subárvore (a N2 no topo).

O central não tem edge de entrada → nenhum ramo precisa de cor pra ele. `depth` também alimenta o
`MindNodeData` (via `PositionedNode`), evitando recomputar por nó no render.

## Cor da edge (M14-05/06/07)

No `MapCanvas`, ao mapear cada `LayoutLink` para `<LinkHorizontal>`:

```
const headBg = link.branchHeadId ? nodeById.get(link.branchHeadId)?.bgColor ?? null : null;
const stroke = branchStroke(headBg);          // null quando a N2 não tem cor custom
stroke === null
  ? className="stroke-edge …"                 // default neutro (comportamento atual, M14-06)
  : style/stroke={stroke}                      // ramo colorido (M14-05)
```

`branchStroke(bgColor: string | null): string | null` em `contrast.ts` (perto de `autoTextColor`/
`isDarkBg`, que já existem):
- `bgColor === null` → `null` (caller usa o `stroke-edge`).
- senão → deriva um traço legível sobre o canvas escuro. **MVP tweakável:** usar o próprio hex quando
  o contraste sobre o fundo do canvas for suficiente; aplicar um piso de luminância para os tons
  escuros (ex.: `#2f3e57`). Os números finais calibram ao vivo (C3) — a **assinatura e o ponto de
  chamada** é que estão fixados aqui.

Propagação (regra do C3) cai naturalmente: como a cor depende **só** de `branchHeadId` (a N2), pintar um
nó intermediário não afeta a cor das edges do ramo; e o central nunca é `branchHeadId` de ninguém.

**M14-08 (opcional):** `strokeWidth` por `depth` (ex.: N2 mais grossa) — decidir na calibração; se
entrar, o `depth` do destino já está no `PositionedNode`.

## Ênfase por tier nos nós (M14-03/04)

`cardSkin` (em `MindNode.tsx`) passa a receber `depth`. O fundo/borda/sombra seguem como hoje
(fundo é do usuário — C2). Muda só **tipografia/escala** por tier — via classes calculadas a partir de
`depth`, não hex:
- **N1 (depth 0):** título maior/peso maior + mais respiro (padding). Continua ignorando cor do usuário.
- **N2 (depth 1):** intermediário (um degrau acima do atual).
- **N3+ (depth ≥2):** o estilo neutro atual (`text-sm font-semibold`).

Valores exatos = calibração ao vivo. Um leve bump de largura *default* só no N1 é aceitável (C1) — mas
largura de N2+ segue sendo do usuário (M15).

## Espaçamento (M14-09/10)

- `GAP_Y` e `GAP_X` em `useTreeLayout.ts`: `24 → 40` (grade de 4px), depois calibra. O `GAP_Y` maior é o
  que separa as faixas de drop de ramos vizinhos e mata o empate do `nearestSlot` (o caso relatado);
  o `GAP_X` maior torna as colunas mais distintas (o desempate primário do `nearestSlot` é por `dx` à
  coluna — colunas mais separadas = escolha menos ambígua).
- `GHOST_BAR_HEIGHT = 6` continua cabendo folgado no `GAP_Y = 40` (o comentário no `GhostBar.tsx` cita
  `GAP_Y=24` — atualizar o número no comentário).
- **Testes:** `useTreeLayout.test.ts` e `slots.test.ts` importam as constantes → assertivas relativas
  sobrevivem. Único ajuste: `slots.test.ts:332` usa `+ 24` literal → trocar por `GAP_X`. Rodar as duas
  suítes e ajustar qualquer expectativa de coordenada absoluta que dependa do gap antigo.

## O que **não** muda

- Nenhum DTO/rota/persistência. A "cor do ramo" é leitura derivada do `bgColor` que já existe.
- `slots.ts`/`useNodeDrag.ts` **não** mudam de lógica — só se beneficiam do espaçamento maior
  (a reescrita de precedência do `nearestSlot` é C8, fora daqui).
- O split left/right, o balanceamento e a geometria de edges do M8 seguem intactos.
