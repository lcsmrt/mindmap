import { useState, useRef, useCallback } from 'react';

export interface ContainerSize {
  width: number;
  height: number;
}

export function useContainerSize() {
  // callback ref porque o container só monta após carregamento; useEffect([]) não o observaria
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!el) {
      observerRef.current = null;
      return;
    }
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  return { size, measureRef };
}
