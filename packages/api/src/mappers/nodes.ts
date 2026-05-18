import type { Node } from '@prisma/client';
import type { NodeDto } from '@mindmap/shared';

export function toNodeDto(node: Node): NodeDto {
  return {
    id: node.id,
    mapId: node.mapId,
    parentId: node.parentId,
    title: node.title,
    sortOrder: node.sortOrder,
    bgColor: node.bgColor,
    textColor: node.textColor,
    status: node.status as NodeDto['status'],
    assignee: node.assignee,
    isCritical: node.isCritical,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}
