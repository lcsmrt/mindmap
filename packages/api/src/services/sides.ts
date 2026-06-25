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
