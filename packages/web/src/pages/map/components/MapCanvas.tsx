import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Zoom } from '@visx/zoom';
import type { ProvidedZoom, ZoomState } from '@visx/zoom';
import { LinkHorizontal } from '@visx/shape';
import { useNodes, useCreateNode, useUpdateNode, useDeleteNode, useMoveNode } from '@/api/nodes.js';
import { useQueryClient, useIsMutating } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import type { NodeDto, UpdateNodeBody } from '@mindmap/shared';
import { NodeEditDialog } from './NodeEditDialog.js';
import { buildTree, visibleNodes } from '@/lib/tree.js';
import type { TreeNode } from '@/lib/tree.js';
import { useTreeLayout } from '@/lib/useTreeLayout.js';
import type { PositionedNode, LayoutLink, LayoutBounds } from '@/lib/useTreeLayout.js';
import { slotToMoveBody, type Slot } from '@/lib/slots.js';
import { MIN_NODE_WIDTH } from '@/lib/nodeSize.js';
import { MindNode } from './MindNode.js';
import type { MindNodeData } from './types.js';
import { useNodeDrag } from './useNodeDrag.js';
import { useMeasuredHeights } from './useMeasuredHeights.js';
import { clampWidth } from './clampWidth.js';
import { measureContentWidth } from './measureContentWidth.js';

const SCALE_MIN = 0.1;
const SCALE_MAX = 3;

const GHOST_BAR_HEIGHT = 6; // 6px cabe no GAP_Y=24 sem invadir cards

type ZoomApi = ProvidedZoom<HTMLDivElement> & ZoomState;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface ActiveResize {
  id: string;
  width: number;
}

interface CanvasLayersProps {
  zoom: ZoomApi;
  width: number;
  height: number;
  positioned: PositionedNode[];
  links: LayoutLink[];
  bounds: LayoutBounds;
  tree: TreeNode | null;
  nodeDataById: Map<string, MindNodeData>;
  isRoot: (id: string) => boolean;
  onPlace: (draggedId: string, slot: Slot) => void;
  onInvalidDrop: () => void;
  registerNode: (id: string) => (el: HTMLElement | null) => void;
  allMeasured: boolean;
  setActiveResize: React.Dispatch<React.SetStateAction<ActiveResize | null>>;
  onPersistWidth: (id: string, width: number) => void;
}

function CanvasLayers({
  zoom,
  width,
  height,
  positioned,
  links,
  bounds,
  tree,
  nodeDataById,
  isRoot,
  onPlace,
  onInvalidDrop,
  registerNode,
  allMeasured,
  setActiveResize,
  onPersistWidth,
}: CanvasLayersProps) {
  /* eslint-disable react-hooks/refs -- visx entrega containerRef no render-prop; react-hooks/refs (v7) trata como leitura de ref proibida */
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = zoom.containerRef.current?.getBoundingClientRect();
      return zoom.applyInverseToPoint({
        x: clientX - (rect?.left ?? 0),
        y: clientY - (rect?.top ?? 0),
      });
    },
    [zoom],
  );

  const {
    onNodePointerDown,
    onNodePointerMove,
    onNodePointerUp,
    draggingId,
    ghostOffset,
    targetSlot,
  } = useNodeDrag({ positioned, tree, clientToWorld, onPlace, onInvalidDrop, isRoot });

  const resizeRef = useRef<{
    id: string;
    startClientX: number;
    startWidth: number;
    ceiling: number;
    width: number;
  } | null>(null);

  const endResize = (r: { id: string; startWidth: number; width: number }) => {
    resizeRef.current = null;
    setActiveResize(null);
    if (r.width !== r.startWidth) onPersistWidth(r.id, r.width);
  };

  // aguarda allMeasured para enquadrar bounds reais, não a estimativa de 1º paint
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    if (!width || !height || bounds.width === 0 || bounds.height === 0) return;
    if (!allMeasured) return;
    const scale = clamp(
      Math.min(width / bounds.width, height / bounds.height) * 0.9,
      SCALE_MIN,
      SCALE_MAX,
    );
    const translateX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
    const translateY = (height - bounds.height * scale) / 2 - bounds.minY * scale;
    zoom.setTransformMatrix({
      scaleX: scale,
      scaleY: scale,
      translateX,
      translateY,
      skewX: 0,
      skewY: 0,
    });
    fittedRef.current = true;
  }, [width, height, bounds, zoom, allMeasured]);

  const scale = zoom.transformMatrix.scaleX || 1;
  const transform = zoom.toString();

  return (
    <div
      // visx tipa o ref como RefObject<T | null>; o ref de div do React 18 espera T não-nulo.
      ref={zoom.containerRef as React.Ref<HTMLDivElement>}
      className="relative h-full w-full touch-none overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Camada de arestas (SVG) */}
      <svg width={width} height={height} className="absolute inset-0">
        <g transform={transform}>
          {links.map((l) => (
            <LinkHorizontal
              key={`${l.source.x},${l.source.y}-${l.target.x},${l.target.y}`}
              data={l}
              // LinkHorizontal troca x↔y por padrão (d3-tree); sobrescreve para usar coordenadas reais
              x={(d: { x: number; y: number }) => d.x}
              y={(d: { x: number; y: number }) => d.y}
              className="stroke-edge fill-none"
              strokeWidth={1.5}
            />
          ))}
        </g>
      </svg>

      <div className="absolute left-0 top-0" style={{ transform, transformOrigin: '0 0' }}>
        {targetSlot && (
          <div
            className="absolute rounded-full bg-primary shadow-sm"
            data-testid="ghost-slot"
            style={{
              left: targetSlot.colX,
              top: targetSlot.anchorY - GHOST_BAR_HEIGHT / 2,
              width: targetSlot.colWidth,
              height: GHOST_BAR_HEIGHT,
              pointerEvents: 'none',
              zIndex: 20,
            }}
          />
        )}
        {positioned.map((p) => {
          const data = nodeDataById.get(p.id);
          if (!data) return null;
          const isDragging = draggingId === p.id;
          return (
            <div
              key={p.id}
              ref={registerNode(p.id)}
              className="absolute"
              data-testid="mind-node"
              data-node-id={p.id}
              data-node-title={data.node.title}
              style={{
                left: p.x,
                top: p.y,
                width: p.width,
                cursor: data.isRoot ? 'default' : 'grab',
                transform: isDragging
                  ? `translate(${ghostOffset.x / scale}px, ${ghostOffset.y / scale}px)`
                  : undefined,
                zIndex: isDragging ? 10 : undefined,
                opacity: isDragging ? 0.85 : undefined,
              }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('[data-testid="resize-handle"]')) {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const cardEl = e.currentTarget.firstElementChild as HTMLElement;
                  const startWidth = e.currentTarget.offsetWidth;
                  resizeRef.current = {
                    id: p.id,
                    startClientX: e.clientX,
                    startWidth,
                    ceiling: measureContentWidth(cardEl),
                    width: startWidth,
                  };
                } else {
                  onNodePointerDown(p.id, e);
                }
              }}
              onPointerMove={(e) => {
                if (resizeRef.current?.id === p.id) {
                  const { startClientX, startWidth, ceiling } = resizeRef.current;
                  const worldDx = (e.clientX - startClientX) / scale;
                  const width = Math.round(
                    clampWidth(startWidth, worldDx, MIN_NODE_WIDTH, ceiling),
                  );
                  resizeRef.current.width = width;
                  setActiveResize({ id: p.id, width });
                } else {
                  onNodePointerMove(e);
                }
              }}
              onPointerUp={(e) => {
                if (resizeRef.current?.id === p.id) {
                  endResize(resizeRef.current);
                } else {
                  onNodePointerUp(e);
                }
              }}
              onPointerCancel={() => {
                if (resizeRef.current?.id === p.id) endResize(resizeRef.current);
              }}
            >
              <MindNode data={data} />
            </div>
          );
        })}
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}

interface MapCanvasInnerProps {
  mapId: string;
}

function MapCanvasInner({ mapId }: MapCanvasInnerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useNodes(mapId);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NodeDto | null>(null);
  const [editDialogNodeId, setEditDialogNodeId] = useState<string | null>(null);
  const isMutating = useIsMutating();

  // callback ref porque o container só monta após carregamento; useEffect([]) não o observaria
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!el) {
      observerRef.current = null;
      return;
    }
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  const { mutate: createNode } = useCreateNode({
    onSuccess: (newNode) => setEditingId(newNode.id),
  });

  const { mutate: updateNode } = useUpdateNode();

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

  const { mutate: deleteNode } = useDeleteNode();

  const handleDelete = useCallback((node: NodeDto) => setDeleteTarget(node), []);

  const { mutate: moveNode } = useMoveNode();

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteNode({ id: deleteTarget.id, mapId });
    setDeleteTarget(null);
  }, [deleteNode, deleteTarget, mapId]);

  const handleAddChild = useCallback(
    (parentId: string) => {
      createNode({ mapId, parentId, title: 'Novo nó' });
    },
    [createNode, mapId],
  );

  const editDialogNode = useMemo(
    () => (editDialogNodeId ? (data?.nodes.find((n) => n.id === editDialogNodeId) ?? null) : null),
    [editDialogNodeId, data],
  );

  const handleDialogUpdate = useCallback(
    (fields: UpdateNodeBody) => {
      if (!editDialogNodeId) return;
      updateNode({ id: editDialogNodeId, mapId, body: fields });
    },
    [updateNode, editDialogNodeId, mapId],
  );

  const tree = useMemo(() => (data ? buildTree(data.nodes) : null), [data]);

  const { nodes: visNodes, edges: visEdges } = useMemo(
    () => visibleNodes(tree, collapsedIds),
    [tree, collapsedIds],
  );

  const hasChildrenMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!data) return map;
    for (const n of data.nodes) {
      if (n.parentId) map.set(n.parentId, true);
    }
    return map;
  }, [data]);

  const [activeResize, setActiveResize] = useState<ActiveResize | null>(null);
  const { heights, registerNode } = useMeasuredHeights();
  const { positioned, links, bounds } = useTreeLayout(visNodes, visEdges, heights, activeResize);
  const allMeasured = positioned.length > 0 && positioned.every((p) => heights.has(p.id));

  const handlePersistWidth = useCallback(
    (id: string, width: number) => {
      updateNode({ id, mapId, body: { width } });
    },
    [updateNode, mapId],
  );

  const visTree = useMemo(() => buildTree(visNodes), [visNodes]);

  const nodeById = useMemo(() => {
    const map = new Map<string, NodeDto>();
    for (const n of data?.nodes ?? []) map.set(n.id, n);
    return map;
  }, [data]);

  const nodeDataById = useMemo(() => {
    const map = new Map<string, MindNodeData>();
    for (const p of positioned) {
      const nodeDto = nodeById.get(p.id);
      if (!nodeDto) continue;
      const isRoot = nodeDto.parentId === null;
      map.set(p.id, {
        node: nodeDto,
        isRoot,
        hasChildren: hasChildrenMap.get(nodeDto.id) ?? false,
        isCollapsed: collapsedIds.has(nodeDto.id),
        isEditing: editingId === nodeDto.id,
        onSubmitEdit: (title) => handleSubmitEdit(nodeDto.id, title),
        onCancelEdit: handleCancelEdit,
        onStartEdit: () => handleStartEdit(nodeDto.id),
        onAddChild: () => handleAddChild(nodeDto.id),
        onDelete: () => handleDelete(nodeDto),
        onToggleCollapse: () => handleToggleCollapse(nodeDto.id),
        onOpenEditDialog: () => setEditDialogNodeId(nodeDto.id),
      });
    }
    return map;
  }, [
    positioned,
    nodeById,
    hasChildrenMap,
    collapsedIds,
    editingId,
    handleSubmitEdit,
    handleCancelEdit,
    handleStartEdit,
    handleAddChild,
    handleDelete,
    handleToggleCollapse,
  ]);

  const isRoot = useCallback((id: string) => nodeById.get(id)?.parentId === null, [nodeById]);

  const handlePlace = useCallback(
    (draggedId: string, slot: Slot) => {
      const rootChildren = (visTree?.children ?? []).map((c) => ({
        id: c.node.id,
        side: c.node.side,
      }));
      const body = slotToMoveBody(slot, rootChildren, draggedId);
      moveNode({ id: draggedId, mapId, body });
    },
    [moveNode, mapId, visTree],
  );

  const handleInvalidDrop = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['nodes', mapId] });
  }, [queryClient, mapId]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Carregando nós…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Erro ao carregar nós</p>
      </div>
    );
  }

  return (
    <>
      <NodeEditDialog
        node={editDialogNode}
        onUpdateNode={handleDialogUpdate}
        onClose={() => setEditDialogNodeId(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir nó"
        message={`"${deleteTarget?.title ?? ''}" e todos os seus descendentes serão removidos.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div ref={measureRef} className="relative h-full flex-1">
        {isMutating > 0 && (
          <div className="absolute right-3 top-3 z-10 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-opacity duration-200">
            Salvando…
          </div>
        )}
        <Zoom<HTMLDivElement>
          width={size.width}
          height={size.height}
          scaleXMin={SCALE_MIN}
          scaleXMax={SCALE_MAX}
          scaleYMin={SCALE_MIN}
          scaleYMax={SCALE_MAX}
        >
          {(zoom) => (
            <CanvasLayers
              zoom={zoom}
              width={size.width}
              height={size.height}
              positioned={positioned}
              links={links}
              bounds={bounds}
              tree={visTree}
              nodeDataById={nodeDataById}
              isRoot={isRoot}
              onPlace={handlePlace}
              onInvalidDrop={handleInvalidDrop}
              registerNode={registerNode}
              allMeasured={allMeasured}
              setActiveResize={setActiveResize}
              onPersistWidth={handlePersistWidth}
            />
          )}
        </Zoom>
      </div>
    </>
  );
}

interface MapCanvasProps {
  mapId: string;
}

export function MapCanvas({ mapId }: MapCanvasProps) {
  return <MapCanvasInner mapId={mapId} />;
}
