import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reducer puro do mapa de alturas medidas. Arredonda para inteiro (mata jitter
 * sub-pixel) e **preserva a identidade do Map quando a altura não muda** — é essa
 * estabilidade de referência que segura o `useMemo` do `useTreeLayout` e garante a
 * convergência do pipeline medir→layout (≤1 relayout por mudança de conteúdo, sem
 * loop: largura fixa ⇒ reposicionar não muda a altura ⇒ observer não re-dispara).
 */
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

/** Mesmo reducer de `nextHeights`, aplicado à largura medida (id → largura). */
export function nextWidths(
  prev: ReadonlyMap<string, number>,
  id: string,
  width: number,
): ReadonlyMap<string, number> {
  const rounded = Math.round(width);
  if (prev.get(id) === rounded) return prev;
  const next = new Map(prev);
  next.set(id, rounded);
  return next;
}

export interface MeasuredSizes {
  heights: ReadonlyMap<string, number>;
  /** Largura medida do DOM por nó; alimenta a largura de cards sem `width` explícita. */
  widths: ReadonlyMap<string, number>;
  registerNode: (id: string) => (el: HTMLElement | null) => void;
}

/**
 * Possui o estado `heights` (id → altura medida no DOM) e **um único**
 * `ResizeObserver` compartilhado por todos os cards. `registerNode(id)` devolve um
 * ref callback **estável por id** (memoizado): elemento presente → `observe`;
 * `null` (nó desmontado/colapsado) → `unobserve` + remove a entrada de `heights`.
 *
 * Espelha o padrão do observer do container em `MapCanvas.tsx`, mas compartilhado
 * entre os nós (um observer, não N — custo baixo p/ mapas grandes).
 */
export function useMeasuredHeights(): MeasuredSizes {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [widths, setWidths] = useState<ReadonlyMap<string, number>>(() => new Map());

  // Elemento atualmente observado por id (para `unobserve` no null / troca de el).
  const elements = useRef(new Map<string, HTMLElement>());
  // Ref callbacks memoizados por id — referência estável entre renders evita
  // observe/unobserve espúrio a cada render do mesmo nó.
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const observerRef = useRef<ResizeObserver | null>(null);

  const getObserver = useCallback((): ResizeObserver | null => {
    if (!observerRef.current && typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver((entries) => {
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
        setWidths((prev) => {
          let acc = prev;
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.nodeId;
            if (!id) continue;
            const w = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            acc = nextWidths(acc, id, w);
          }
          return acc;
        });
      });
    }
    return observerRef.current;
  }, []);

  const registerNode = useCallback(
    (id: string) => {
      const existing = refCallbacks.current.get(id);
      if (existing) return existing;

      const cb = (el: HTMLElement | null) => {
        const observer = getObserver();
        const prevEl = elements.current.get(id);
        if (prevEl) observer?.unobserve(prevEl);

        if (el) {
          elements.current.set(id, el);
          observer?.observe(el);
        } else {
          elements.current.delete(id);
          setHeights((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
          setWidths((prev) => {
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
    [getObserver],
  );

  // Desconecta no unmount. Zera o ref para que um remount (StrictMode) recrie o
  // observer de forma lazy quando os refs dos nós reanexarem.
  useEffect(() => {
    const els = elements.current;
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      els.clear();
    };
  }, []);

  return { heights, widths, registerNode };
}
