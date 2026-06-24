import type { NodeDto } from '@mindmap/shared';
import { hasTaskProps } from '../pages/map/components/task-meta.js';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT_BASE = 40;
export const NODE_HEIGHT_WITH_FOOTER = 58;

export function nodeHeight(node: NodeDto): number {
  return hasTaskProps(node) ? NODE_HEIGHT_WITH_FOOTER : NODE_HEIGHT_BASE;
}
