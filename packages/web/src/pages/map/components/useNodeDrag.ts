import { useCallback, useRef, useState } from 'react';
import type { PositionedNode } from '../lib/useTreeLayout.js';
import type { TreeNode } from '../lib/tree.js';
import { computeSlots, nearestSlot, isOriginSlot, type Slot } from '../lib/slots.js';

// Deslocamento mínimo (em px de tela) para tratar o gesto como drag, não clique.
const DRAG_THRESHOLD = 5;

type SideRef = { id: string; side: 'LEFT' | 'RIGHT' | null };

/**
 * Contexto fixado no início de um arraste (a árvore/layout não mudam durante o gesto):
 * os slots disponíveis, a subárvore a excluir (não soltar dentro de si) e o estado
 * atual do nó arrastado para detectar no-op (drop na origem).
 */
export interface DragContext {
  slots: Slot[];
  excludeSubtree: Set<string>;
  draggedInfo: { id: string; parentId: string | null; side: 'LEFT' | 'RIGHT' | null };
  currentSiblingsOrdered: SideRef[];
}

function collectSubtree(t: TreeNode, into: Set<string>): void {
  into.add(t.node.id);
  for (const c of t.children) collectSubtree(c, into);
}

/**
 * Monta o `DragContext` para um nó arrastado, a partir da árvore visível e do layout.
 * Função pura: enumera slots, coleta a subárvore (para exclusão) e captura os irmãos
 * atuais ordenados (para o no-op). `null` se o nó não está na árvore (ex.: a raiz, que
 * não tem pai).
 */
export function buildDragContext(
  tree: TreeNode,
  positioned: PositionedNode[],
  draggedId: string,
): DragContext | null {
  let draggedInfo: DragContext['draggedInfo'] | null = null;
  let currentSiblingsOrdered: SideRef[] = [];
  const excludeSubtree = new Set<string>();

  function walk(t: TreeNode): void {
    for (const c of t.children) {
      if (c.node.id === draggedId) {
        draggedInfo = { id: draggedId, parentId: c.node.parentId, side: c.node.side };
        currentSiblingsOrdered = t.children.map((s) => ({ id: s.node.id, side: s.node.side }));
        collectSubtree(c, excludeSubtree);
      }
      walk(c);
    }
  }
  walk(tree);

  if (!draggedInfo) return null;
  const slots = computeSlots(tree, positioned, { draggedId });
  return { slots, excludeSubtree, draggedInfo, currentSiblingsOrdered };
}

export type DropResolution =
  | { kind: 'place'; slot: Slot }
  | { kind: 'noop' }
  | { kind: 'invalid' };

/**
 * Decide o destino do drop a partir do ponto (em coordenadas de mundo) e do contexto:
 * `place` no slot mais próximo válido, `noop` se for a origem, `invalid` se não há slot
 * (cursor longe de tudo → snap-back). Pura e determinística.
 */
export function resolveDrop(point: { x: number; y: number }, ctx: DragContext): DropResolution {
  const nearest = nearestSlot(point, ctx.slots, { excludeSubtree: ctx.excludeSubtree });
  if (!nearest) return { kind: 'invalid' };
  if (isOriginSlot(nearest, ctx.draggedInfo, ctx.currentSiblingsOrdered)) return { kind: 'noop' };
  return { kind: 'place', slot: nearest };
}

interface UseNodeDragArgs {
  positioned: PositionedNode[];
  /** Árvore visível, fonte dos slots e do contexto de drag. */
  tree: TreeNode | null;
  /** Converte coordenadas de tela (clientX/clientY) para coordenadas de mundo do layout. */
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  /** Drop num slot válido ≠ origem: coloca o nó em (pai, posição, lado). */
  onPlace: (draggedId: string, slot: Slot) => void;
  /** Drop fora de qualquer slot válido: snap-back (refetch). */
  onInvalidDrop: () => void;
  isRoot: (id: string) => boolean;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export interface UseNodeDragResult {
  onNodePointerDown: (id: string, e: React.PointerEvent) => void;
  onNodePointerMove: (e: React.PointerEvent) => void;
  onNodePointerUp: (e: React.PointerEvent) => void;
  draggingId: string | null;
  /** Deslocamento do cursor em px de tela desde o pointerdown (para o nó-fantasma). */
  ghostOffset: { x: number; y: number };
  /** Slot-alvo atual durante o arraste (onde o card-fantasma aparece); `null` se nenhum. */
  targetSlot: Slot | null;
}

export function useNodeDrag({
  positioned,
  tree,
  clientToWorld,
  onPlace,
  onInvalidDrop,
  isRoot,
}: UseNodeDragArgs): UseNodeDragResult {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghostOffset, setGhostOffset] = useState({ x: 0, y: 0 });
  const [targetSlot, setTargetSlot] = useState<Slot | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const ctxRef = useRef<DragContext | null>(null);

  const onNodePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (isRoot(id)) return; // raiz não é arrastável
      e.stopPropagation(); // não inicia o pan do <Zoom>
      stateRef.current = {
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    },
    [isRoot],
  );

  const onNodePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const st = stateRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      if (!st.moved) {
        const dist = Math.hypot(e.clientX - st.startX, e.clientY - st.startY);
        if (dist < DRAG_THRESHOLD) return; // abaixo do limiar = clique, não drag
        st.moved = true;
        // Captura só ao virar drag, para um clique simples ainda atingir botões/título.
        try {
          e.currentTarget.setPointerCapture(st.pointerId);
        } catch {
          // captura indisponível — ignorar
        }
        // Fixa o contexto do gesto (slots/subárvore/irmãos) uma vez.
        ctxRef.current = tree ? buildDragContext(tree, positioned, st.id) : null;
        setDraggingId(st.id);
      }
      setGhostOffset({ x: e.clientX - st.startX, y: e.clientY - st.startY });

      const ctx = ctxRef.current;
      if (ctx) {
        const world = clientToWorld(e.clientX, e.clientY);
        const res = resolveDrop(world, ctx);
        setTargetSlot(res.kind === 'place' ? res.slot : null);
      }
    },
    [tree, positioned, clientToWorld],
  );

  const onNodePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const st = stateRef.current;
      if (st && e.pointerId !== st.pointerId) return;
      stateRef.current = null;
      const ctx = ctxRef.current;
      ctxRef.current = null;
      setDraggingId(null);
      setGhostOffset({ x: 0, y: 0 });
      setTargetSlot(null);
      if (!st || !st.moved) return; // foi clique: deixa os handlers de clique rodarem
      try {
        e.currentTarget.releasePointerCapture(st.pointerId);
      } catch {
        // ponteiro já liberado — ignorar
      }

      if (!ctx) {
        onInvalidDrop();
        return;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      const res = resolveDrop(world, ctx);
      if (res.kind === 'place') onPlace(st.id, res.slot);
      else if (res.kind === 'invalid') onInvalidDrop();
      // 'noop': nada a fazer — o nó volta à posição do layout ao limpar o ghostOffset.
    },
    [clientToWorld, onPlace, onInvalidDrop],
  );

  return { onNodePointerDown, onNodePointerMove, onNodePointerUp, draggingId, ghostOffset, targetSlot };
}
