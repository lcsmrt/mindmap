import type { NodeDto } from '@mindmap/shared';
import { hasTaskProps } from '../pages/map/components/task-meta.js';

export const NODE_WIDTH = 180;
export const MIN_NODE_WIDTH = 120;

export function nodeWidth(node: NodeDto): number {
  return node.width ?? NODE_WIDTH;
}
export const NODE_HEIGHT_BASE = 40;
// Inclui a divisória título/rodapé (border-t + mt-2.5/pt-2.5 ≈ 21px) reservada
// no card quando há props de tarefa, para o layout não comer o GAP_Y entre nós.
export const NODE_HEIGHT_WITH_FOOTER = 79;

/**
 * Estimativa de altura para o **primeiro paint**, antes da medição real do DOM (M12):
 * o layout usa este valor enquanto o `ResizeObserver` ainda não reportou a altura
 * medida do card. Não é a verdade final — apenas evita bounds zerado / sobreposição
 * grosseira antes da medição. A altura definitiva vem de `useMeasuredHeights`.
 */
export function estimateNodeHeight(node: NodeDto): number {
  return hasTaskProps(node) ? NODE_HEIGHT_WITH_FOOTER : NODE_HEIGHT_BASE;
}
