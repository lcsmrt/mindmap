import { NODE_WIDTH } from '@/lib/nodeSize.js';

const FALLBACK = NODE_WIDTH * 4;

/**
 * Mede a largura mínima para que **todo o texto do card caiba em uma linha**
 * (sem espaço em branco à direita). Clona o card oculto, força o título a **não
 * quebrar** (`nowrap` — evita que a cadeia flex `flex-1 min-w-0` subestime a
 * largura intrínseca) e mede com `width: max-content`. `getBoundingClientRect` +
 * `Math.ceil` + 1px evitam que arredondamento sub-pixel deixe a última palavra
 * quebrar. Executado 1× no início de cada arraste — não realimenta a largura do
 * card (invariante de convergência).
 */
export function measureContentWidth(cardEl: HTMLElement): number {
  try {
    const clone = cardEl.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: 'fixed',
      visibility: 'hidden',
      width: 'max-content',
      maxWidth: 'none',
      pointerEvents: 'none',
      top: '-9999px',
      left: '-9999px',
    });
    clone.querySelectorAll<HTMLElement>('[data-testid="node-title"]').forEach((el) => {
      el.style.whiteSpace = 'nowrap';
    });
    document.body.appendChild(clone);
    const w = clone.getBoundingClientRect().width;
    document.body.removeChild(clone);
    return w > 0 ? Math.ceil(w) + 1 : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
