import { NODE_WIDTH } from '../lib/nodeSize.js';

const FALLBACK = NODE_WIDTH * 4;

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
    // nowrap evita que a cadeia flex subestime a largura intrínseca do título
    clone.querySelectorAll<HTMLElement>('[data-testid="node-title"]').forEach((el) => {
      el.style.whiteSpace = 'nowrap';
    });
    document.body.appendChild(clone);
    const w = clone.getBoundingClientRect().width;
    document.body.removeChild(clone);
    return w > 0 ? Math.ceil(w) + 1 : FALLBACK; // +1px guarda contra arredondamento sub-pixel
  } catch {
    return FALLBACK;
  }
}
