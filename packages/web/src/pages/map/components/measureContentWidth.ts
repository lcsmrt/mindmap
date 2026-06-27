import { NODE_WIDTH } from '@/lib/nodeSize.js';

const FALLBACK = NODE_WIDTH * 4;

/**
 * Mede a largura mínima para que **todo o texto do card caiba em uma linha**
 * (sem espaço em branco à direita). Usa um clone oculto com `width: max-content`
 * para obter a largura intrínseca do conteúdo. Executado 1× no início de cada
 * arraste — não realimenta a largura do card (invariante de convergência).
 */
export function measureContentWidth(cardEl: HTMLElement): number {
  try {
    const clone = cardEl.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: 'fixed',
      visibility: 'hidden',
      width: 'max-content',
      pointerEvents: 'none',
      top: '-9999px',
      left: '-9999px',
    });
    document.body.appendChild(clone);
    const w = clone.offsetWidth;
    document.body.removeChild(clone);
    return w > 0 ? w : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
