import type { Side } from '@prisma/client';

/**
 * Lógica de "lado" (LEFT/RIGHT) dos filhos de 1º nível, portada da heurística de
 * peso que vivia no frontend (`splitChildren` em `useTreeLayout.ts`). Funções puras,
 * reusadas pelo `create` (default de lado de um novo nó) e pelo `backfillSides`
 * (popula o lado de mapas legados replicando o split por peso atual).
 *
 * Peso = contagem de nós da subárvore (cada nó pesa 1).
 */

interface NodeLike {
  id: string;
  parentId: string | null;
}

/** Tamanho da subárvore (nº de nós) de cada nó do mapa, indexado por id. */
export function subtreeSizes(nodes: NodeLike[]): Map<string, number> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    const list = childrenOf.get(n.parentId);
    if (list) list.push(n.id);
    else childrenOf.set(n.parentId, [n.id]);
  }

  const memo = new Map<string, number>();
  function size(id: string): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let total = 1;
    for (const childId of childrenOf.get(id) ?? []) total += size(childId);
    memo.set(id, total);
    return total;
  }
  for (const n of nodes) size(n.id);
  return memo;
}

/**
 * Escolhe o lado de um **novo** filho de 1º nível: o de menor peso entre os filhos
 * atuais da raiz, respeitando os `side` já gravados. Empate (inclusive sem filhos) →
 * `RIGHT`, de forma determinística. Filhos com `side` nulo (legado) contam como RIGHT.
 */
export function chooseSideForNewChild(
  rootChildren: Array<{ id: string; side: Side | null }>,
  sizes: Map<string, number>,
): Side {
  let weightLeft = 0;
  let weightRight = 0;
  for (const child of rootChildren) {
    const weight = sizes.get(child.id) ?? 1;
    if (child.side === 'LEFT') weightLeft += weight;
    else weightRight += weight;
  }
  return weightLeft < weightRight ? 'LEFT' : 'RIGHT';
}

/**
 * Reparte todos os filhos de 1º nível entre os dois lados balanceando o peso de
 * subárvore — réplica exata do `splitChildren` do frontend (M8): ordena por peso
 * desc (desempate por `sortOrder`, depois índice) e atribui cada filho ao lado
 * atualmente mais leve; empate → `RIGHT`. Usado pelo backfill de mapas legados.
 */
export function computeBalancedSides(
  rootChildren: Array<{ id: string; sortOrder: number }>,
  sizes: Map<string, number>,
): Map<string, Side> {
  const weighted = rootChildren.map((child, idx) => ({
    id: child.id,
    weight: sizes.get(child.id) ?? 1,
    sortOrder: child.sortOrder,
    idx,
  }));
  weighted.sort((a, b) => b.weight - a.weight || a.sortOrder - b.sortOrder || a.idx - b.idx);

  const result = new Map<string, Side>();
  let weightRight = 0;
  let weightLeft = 0;
  for (const w of weighted) {
    if (weightRight <= weightLeft) {
      result.set(w.id, 'RIGHT');
      weightRight += w.weight;
    } else {
      result.set(w.id, 'LEFT');
      weightLeft += w.weight;
    }
  }
  return result;
}
