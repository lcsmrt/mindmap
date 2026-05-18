import { useState, useEffect, useRef } from 'react';
import type { NodeDto } from '@mindmap/shared';

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
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (nodes.length === 0) {
      setPositioned([]);
      return;
    }

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
        setPositioned(event.data.positioned ?? []);
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ nodes, edges });

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [nodes, edges]);

  return { positioned, isLayouting, error };
}
