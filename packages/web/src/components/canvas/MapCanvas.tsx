import '@xyflow/react/dist/style.css';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Background, useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { useNodes, useCreateNode, useUpdateNode, useDeleteNode, useMoveNode } from '@/api/nodes.js';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import type { NodeDto } from '@mindmap/shared';
import { buildTree, visibleNodes } from '@/lib/tree.js';
import { useLayoutedTree } from '@/lib/useLayoutedTree.js';
import { MindNode } from './MindNode.js';
import type { MindNodeData } from './types.js';

const nodeTypes = { mind: MindNode } as const;

interface MapCanvasInnerProps {
  mapId: string;
}

function MapCanvasInner({ mapId }: MapCanvasInnerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useNodes(mapId);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeDto | null>(null);

  const { mutate: createNode } = useCreateNode({
    onSuccess: (newNode) => setEditingId(newNode.id),
    onError: (err) => setCanvasError(err.message),
  });

  const { mutate: updateNode } = useUpdateNode({
    onError: (err) => setCanvasError(err.message),
  });

  const handleStartEdit = useCallback((id: string) => setEditingId(id), []);

  const handleSubmitEdit = useCallback(
    (id: string, title: string) => {
      setEditingId(null);
      const trimmed = title.trim();
      if (!trimmed) return;
      setCanvasError(null);
      updateNode({ id, body: { title: trimmed } });
    },
    [updateNode],
  );

  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const { mutate: deleteNode } = useDeleteNode({
    onError: (err) => setCanvasError(err.message),
  });

  const handleDelete = useCallback((node: NodeDto) => setDeleteTarget(node), []);

  const { mutate: moveNode } = useMoveNode({
    onError: (err) => {
      setCanvasError(err.message);
      queryClient.invalidateQueries({ queryKey: ['nodes', mapId] });
    },
  });

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setCanvasError(null);
    deleteNode({ id: deleteTarget.id, mapId });
    setDeleteTarget(null);
  }, [deleteNode, deleteTarget, mapId]);

  const handleAddChild = useCallback(
    (parentId: string) => {
      setCanvasError(null);
      createNode({ mapId, parentId, title: 'Novo nó' });
    },
    [createNode, mapId],
  );

  const tree = useMemo(
    () => (data ? buildTree(data.nodes) : null),
    [data],
  );

  const { nodes: visNodes, edges: visEdges } = useMemo(
    () => visibleNodes(tree, collapsedIds),
    [tree, collapsedIds],
  );

  const allNodeIds = useMemo(
    () => new Set(data?.nodes.map((n) => n.id) ?? []),
    [data],
  );

  const hasChildrenMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!data) return map;
    for (const n of data.nodes) {
      if (n.parentId) map.set(n.parentId, true);
    }
    return map;
  }, [data]);

  const { positioned } = useLayoutedTree(visNodes, visEdges);

  const rfNodes: Node[] = useMemo(
    () =>
      positioned.map((p) => {
        const nodeDto = data!.nodes.find((n) => n.id === p.id)!;
        const isRoot = nodeDto.parentId === null;
        const nodeData: MindNodeData = {
          node: nodeDto,
          isRoot,
          hasChildren: hasChildrenMap.get(nodeDto.id) ?? false,
          isCollapsed: collapsedIds.has(nodeDto.id),
          isEditing: editingId === nodeDto.id,
          onStartEdit: () => handleStartEdit(nodeDto.id),
          onSubmitEdit: (title) => handleSubmitEdit(nodeDto.id, title),
          onCancelEdit: handleCancelEdit,
          onAddChild: () => handleAddChild(nodeDto.id),
          onDelete: () => handleDelete(nodeDto),
          onToggleCollapse: () => handleToggleCollapse(nodeDto.id),
        };
        return {
          id: p.id,
          position: { x: p.x, y: p.y },
          type: 'mind',
          data: nodeData,
          draggable: !isRoot,
        };
      }),
    [positioned, data, collapsedIds, editingId, hasChildrenMap],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      visEdges.map((e) => ({
        id: `${e.parentId}-${e.childId}`,
        source: e.parentId,
        target: e.childId,
        type: 'smoothstep',
      })),
    [visEdges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => { setNodes(rfNodes); }, [rfNodes, setNodes]);
  useEffect(() => { setEdges(rfEdges); }, [rfEdges, setEdges]);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      if (!data) return;
      const draggedDto = data.nodes.find((n) => n.id === draggedNode.id);
      if (!draggedDto || draggedDto.parentId === null) return;

      const dx = draggedNode.position.x;
      const dy = draggedNode.position.y;

      // Detecta alvo por overlap do centro do nó arrastado com a bounding box de outro nó
      const target = nodes.find((n) => {
        if (n.id === draggedNode.id) return false;
        const tw = n.measured?.width ?? 180;
        const th = n.measured?.height ?? 40;
        return (
          dx + 90 >= n.position.x &&
          dx + 90 <= n.position.x + tw &&
          dy + 20 >= n.position.y &&
          dy + 20 <= n.position.y + th
        );
      });

      if (!target) {
        queryClient.invalidateQueries({ queryKey: ['nodes', mapId] });
        return;
      }

      setCanvasError(null);
      moveNode({ id: draggedNode.id, body: { parentId: target.id, index: Number.MAX_SAFE_INTEGER } });
    },
    [data, nodes, moveNode, queryClient, mapId],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted">
        <p className="text-muted-foreground">Carregando nós…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted">
        <p className="text-muted-foreground">Erro ao carregar nós</p>
      </div>
    );
  }

  return (
    <>
    <ConfirmDialog
      open={!!deleteTarget}
      title="Excluir nó"
      message={`"${deleteTarget?.title ?? ''}" e todos os seus descendentes serão removidos.`}
      confirmLabel="Excluir"
      destructive
      onConfirm={handleConfirmDelete}
      onCancel={() => setDeleteTarget(null)}
    />
    <div className="flex-1 h-full relative">
      {canvasError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-md bg-destructive/90 px-4 py-2 text-sm text-white shadow">
          {canvasError}
          <button className="ml-3 underline" onClick={() => setCanvasError(null)}>×</button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        proOptions={{ hideAttribution: true }}
        fitView
        panOnDrag
        zoomOnScroll
        minZoom={0.1}
        maxZoom={3}
      >
        <Background />
      </ReactFlow>
    </div>
    </>
  );
}

interface MapCanvasProps {
  mapId: string;
}

export function MapCanvas({ mapId }: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MapCanvasInner mapId={mapId} />
    </ReactFlowProvider>
  );
}
