import { MIN_NODE_WIDTH } from '../lib/nodeSize.js';

const OVERSHOOT_RESISTANCE = 0.35;

// Durante o arraste a largura segue o cursor. Até o fit de uma linha (ceiling) o movimento é
// 1:1; passando dele, aplica resistência elástica (rubber-band) em vez de parede dura — o
// release assenta de volta no ceiling. Só um piso de segurança impede colapsar o layout;
// quando o conteúdo cabe abaixo do mínimo, o piso acompanha o teto para o nó poder encolher
// até o próprio conteúdo.
export function draftWidth(startWidth: number, worldDx: number, ceiling: number): number {
  const floor = Math.min(MIN_NODE_WIDTH, ceiling);
  const raw = Math.max(floor, startWidth + worldDx);
  if (raw <= ceiling) return Math.round(raw);
  return Math.round(ceiling + (raw - ceiling) * OVERSHOOT_RESISTANCE);
}

// No release, assenta ("elástico"): se passou do fit de uma linha (ceiling), volta pro fit.
export function settleWidth(width: number, ceiling: number): number {
  return width > ceiling ? ceiling : width;
}
