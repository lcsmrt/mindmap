import type { NodeDto } from '@mindmap/shared';

export interface MindNodeData extends Record<string, unknown> {
  node: NodeDto;
  isRoot: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onSubmitEdit: (title: string) => void;
  onCancelEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
}
