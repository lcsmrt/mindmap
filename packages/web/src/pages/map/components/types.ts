import type { NodeDto } from '@mindmap/shared';

export interface MindNodeData extends Record<string, unknown> {
  node: NodeDto;
  isRoot: boolean;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isEditing: boolean;
  onSubmitEdit: (title: string) => void;
  onCancelEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onToggleCollapse: () => void;
  onOpenEditDialog: () => void;
}
