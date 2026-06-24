import { useCallback, useRef, useState } from 'react';
import type { PositionedNode } from '@/lib/useTreeLayout.js';

// Deslocamento mínimo (em px de tela) para tratar o gesto como drag, não clique.
const DRAG_THRESHOLD = 5;

/**
 * Hit-test puro: retorna o id do primeiro candidato cujo bounds (top-left + width/height,
 * em coordenadas de mundo) contém o ponto. Exclui o nó arrastado. `null` se nada bate.
 */
export function findDropTarget(
  point: { x: number; y: number },
  candidates: PositionedNode[],
  opts: { excludeId: string },
): string | null {
  for (const c of candidates) {
    if (c.id === opts.excludeId) continue;
    if (
      point.x >= c.x &&
      point.x <= c.x + c.width &&
      point.y >= c.y &&
      point.y <= c.y + c.height
    ) {
      return c.id;
    }
  }
  return null;
}

interface UseNodeDragArgs {
  positioned: PositionedNode[];
  /** Converte coordenadas de tela (clientX/clientY) para coordenadas de mundo do layout. */
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onReparent: (childId: string, newParentId: string) => void;
  /** Drop fora de qualquer nó: snap-back (refetch). */
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
}

export function useNodeDrag({
  positioned,
  clientToWorld,
  onReparent,
  onInvalidDrop,
  isRoot,
}: UseNodeDragArgs): UseNodeDragResult {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghostOffset, setGhostOffset] = useState({ x: 0, y: 0 });
  const stateRef = useRef<DragState | null>(null);

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

  const onNodePointerMove = useCallback((e: React.PointerEvent) => {
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
      setDraggingId(st.id);
    }
    setGhostOffset({ x: e.clientX - st.startX, y: e.clientY - st.startY });
  }, []);

  const onNodePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const st = stateRef.current;
      if (st && e.pointerId !== st.pointerId) return;
      stateRef.current = null;
      setDraggingId(null);
      setGhostOffset({ x: 0, y: 0 });
      if (!st || !st.moved) return; // foi clique: deixa os handlers de clique rodarem
      try {
        e.currentTarget.releasePointerCapture(st.pointerId);
      } catch {
        // ponteiro já liberado — ignorar
      }

      const world = clientToWorld(e.clientX, e.clientY);
      const targetId = findDropTarget(world, positioned, { excludeId: st.id });
      if (targetId) {
        onReparent(st.id, targetId);
      } else {
        onInvalidDrop();
      }
    },
    [clientToWorld, positioned, onReparent, onInvalidDrop],
  );

  return { onNodePointerDown, onNodePointerMove, onNodePointerUp, draggingId, ghostOffset };
}
