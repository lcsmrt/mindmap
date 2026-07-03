import { useState, useCallback, useMemo } from 'react';
import type { NodeDto, UpdateNodeBody } from '@mindmap/shared';
import { useDeleteNode } from '@/api/nodes.js';

interface UseNodeEditingParams {
  mapId: string;
  nodes: NodeDto[] | undefined;
  updateNode: (args: { id: string; mapId: string; body: UpdateNodeBody }) => void;
}

export function useNodeEditing({ mapId, nodes, updateNode }: UseNodeEditingParams) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeDto | null>(null);
  const [editDialogNodeId, setEditDialogNodeId] = useState<string | null>(null);
  const { mutate: deleteNode } = useDeleteNode();

  const handleStartEdit = useCallback((id: string) => setEditingId(id), []);

  const handleSubmitEdit = useCallback(
    (id: string, title: string) => {
      setEditingId(null);
      const trimmed = title.trim();
      if (!trimmed) return;
      updateNode({ id, mapId, body: { title: trimmed } });
    },
    [updateNode, mapId],
  );

  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleDelete = useCallback((node: NodeDto) => setDeleteTarget(node), []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteNode({ id: deleteTarget.id, mapId });
    setDeleteTarget(null);
  }, [deleteNode, deleteTarget, mapId]);

  const editDialogNode = useMemo(
    () => (editDialogNodeId ? (nodes?.find((n) => n.id === editDialogNodeId) ?? null) : null),
    [editDialogNodeId, nodes],
  );

  const handleDialogUpdate = useCallback(
    (fields: UpdateNodeBody) => {
      if (!editDialogNodeId) return;
      updateNode({ id: editDialogNodeId, mapId, body: fields });
    },
    [updateNode, editDialogNodeId, mapId],
  );

  return {
    editingId,
    setEditingId,
    deleteTarget,
    setDeleteTarget,
    editDialogNodeId,
    setEditDialogNodeId,
    handleStartEdit,
    handleSubmitEdit,
    handleCancelEdit,
    handleDelete,
    handleConfirmDelete,
    editDialogNode,
    handleDialogUpdate,
  };
}
