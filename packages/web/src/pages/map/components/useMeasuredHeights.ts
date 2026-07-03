import { useCallback, useEffect, useRef, useState } from 'react';

// arredonda e preserva identidade do Map — segura o useMemo de useTreeLayout sem loop
export function nextHeights(
  prev: ReadonlyMap<string, number>,
  id: string,
  height: number,
): ReadonlyMap<string, number> {
  const rounded = Math.round(height);
  if (prev.get(id) === rounded) return prev;
  const next = new Map(prev);
  next.set(id, rounded);
  return next;
}

export interface MeasuredHeights {
  heights: ReadonlyMap<string, number>;
  registerNode: (id: string) => (el: HTMLElement | null) => void;
}

export function useMeasuredHeights(): MeasuredHeights {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());

  const elements = useRef(new Map<string, HTMLElement>());
  // referência estável por id evita observe/unobserve espúrio
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const observerRef = useRef<ResizeObserver | null>(null);

  const handleEntries = useCallback((entries: ResizeObserverEntry[]) => {
    setHeights((prev) => {
      let acc = prev;
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.nodeId;
        if (!id) continue;
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        acc = nextHeights(acc, id, h);
      }
      return acc;
    });
  }, []);

  const registerNode = useCallback(
    (id: string) => {
      const existing = refCallbacks.current.get(id);
      if (existing) return existing;

      const cb = (el: HTMLElement | null) => {
        const prevEl = elements.current.get(id);
        if (prevEl) observerRef.current?.unobserve(prevEl);

        if (el) {
          elements.current.set(id, el);
          // observerRef pode ser null no commit; o effect abaixo re-observa no setup
          observerRef.current?.observe(el);
        } else {
          elements.current.delete(id);
          refCallbacks.current.delete(id);
          setHeights((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }
      };
      refCallbacks.current.set(id, cb);
      return cb;
    },
    [],
  );

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(handleEntries);
    observerRef.current = observer;
    for (const el of elements.current.values()) observer.observe(el);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [handleEntries]);

  return { heights, registerNode };
}
