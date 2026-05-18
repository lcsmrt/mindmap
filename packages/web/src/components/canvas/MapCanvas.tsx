import '@xyflow/react/dist/style.css';
import { useState, useMemo, useCallback } from 'react';
import { ReactFlow, ReactFlowProvider, Background, useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { useNodes, useCreateNode, useUpdateNode } from '@/api/nodes.js';
import { buildTree, visibleNodes } from '@/lib/tree.js';
import { useLayoutedTree } from '@/lib/useLayoutedTree.js';
import { MindNode } from './MindNode.js';
import type { MindNodeData } from './types.js';

const nodeTypes = { mind: MindNode } as const;

interface MapCanvasInnerProps {
  mapId: string;
}

function MapCanvasInner({ mapId }: MapCanvasInnerProps) {
  const { data, isLoading, isError } = useNodes(mapId);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);

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
          onDelete: () => console.warn('TODO T16: onDelete', nodeDto.id),
          onToggleCollapse: () => console.warn('TODO T18: onToggleCollapse', nodeDto.id),
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

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!allNodeIds.has(node.id)) return;
      console.warn('TODO T17: drag-and-drop reparent', node.id);
    },
    [allNodeIds],
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
        fitView
        panOnDrag
        zoomOnScroll
        minZoom={0.1}
        maxZoom={3}
      >
        <Background />
      </ReactFlow>
    </div>
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
