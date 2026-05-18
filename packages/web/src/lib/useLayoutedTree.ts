import { useState, useEffect, useRef, useMemo } from 'react';
import type { NodeDto } from '@mindmap/shared';
import { simpleTreeLayout } from './treeLayout.js';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  positioned: PositionedNode[];
  isLayouting: boolean;
  error: string | null;
}

export function useLayoutedTree(
  nodes: NodeDto[],
  edges: Array<{ parentId: string; childId: string }>,
): LayoutResult {
  // Fallback síncrono: nós aparecem imediatamente enquanto o worker calcula
  const fallback = useMemo(() => simpleTreeLayout(nodes, edges), [nodes, edges]);

  const [workerPositioned, setWorkerPositioned] = useState<PositionedNode[] | null>(null);
  const [isLayouting, setIsLayouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.addEventListener('error', (e) => {
      console.error('[layout worker] falha ao inicializar:', e.message);
      setError(e.message);
      setIsLayouting(false);
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    // Resetar resultado do worker quando os inputs mudam
    setWorkerPositioned(null);

    if (!worker || nodes.length === 0) return;

    setIsLayouting(true);
    setError(null);

    const handleMessage = (
      event: MessageEvent<{ positioned?: PositionedNode[]; error?: string }>,
    ) => {
      setIsLayouting(false);
      if (event.data.error) {
        console.error('[layout worker]', event.data.error);
        setError(event.data.error);
      } else {
        setWorkerPositioned(event.data.positioned ?? null);
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ nodes, edges });

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [nodes, edges]);

  // Usa o resultado do worker quando disponível, caso contrário usa o fallback síncrono
  const positioned = workerPositioned ?? fallback;

  return { positioned, isLayouting, error };
}
