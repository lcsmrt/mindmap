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

export interface MeasuredHeights {
  heights: ReadonlyMap<string, number>;
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
export function useMeasuredHeights(): MeasuredHeights {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());

  // Elemento atualmente observado por id (para `unobserve` no null / troca de el).
  const elements = useRef(new Map<string, HTMLElement>());
  // Ref callbacks memoizados por id — referência estável entre renders evita
  // observe/unobserve espúrio a cada render do mesmo nó.
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
          // observerRef pode ser null no commit (o effect que o cria roda depois) —
          // nesse caso o effect abaixo observa este elemento no setup.
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

  // O effect é o dono do observer: a cada (re)mount cria um novo e RE-OBSERVA todos
  // os elementos já registrados pelos ref callbacks. Isso torna o hook resiliente ao
  // double-invoke do StrictMode (mount→cleanup→mount dos effects): sem a re-observação
  // aqui, o observer criado no commit inicial seria desconectado pelo cleanup e os
  // ref callbacks — que rodam só uma vez no commit — nunca o recriariam, deixando as
  // alturas sem serem medidas ao reabrir um mapa com dados já cacheados.
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
