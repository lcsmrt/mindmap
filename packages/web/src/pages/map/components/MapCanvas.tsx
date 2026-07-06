import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Zoom } from '@visx/zoom';
import type { ProvidedZoom, ZoomState, PinchDelta } from '@visx/zoom';
import { LinkHorizontal } from '@visx/shape';
import { useNodes, useCreateNode, useUpdateNode, useMoveNode } from '@/api/nodes.js';
import { useQueryClient, useIsMutating } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import type { NodeDto } from '@mindmap/shared';
import { NodeEditDialog } from './NodeEditDialog.js';
import { buildTree, visibleNodes } from '../lib/tree.js';
import type { TreeNode } from '../lib/tree.js';
import { useTreeLayout } from '../lib/useTreeLayout.js';
import type { PositionedNode, LayoutLink, LayoutBounds } from '../lib/useTreeLayout.js';
import { slotToMoveBody, type Slot } from '../lib/slots.js';
import { MindNode } from './MindNode.js';
import type { MindNodeData } from './types.js';
import { useNodeDrag } from './useNodeDrag.js';
import { useMeasuredHeights } from './useMeasuredHeights.js';
import { useContainerSize } from './useContainerSize.js';
import { useNodeEditing } from './useNodeEditing.js';
import { GhostBar } from './GhostBar.js';
import { draftWidth, settleWidth } from './resizeWidth.js';
import { measureContentWidth } from './measureContentWidth.js';

const SCALE_MIN = 0.1;
const SCALE_MAX = 3;

// visx detecta direção da pinça por offset acumulado, que trava em zoom out quando a pinça chega como ctrl+wheel (Linux); `direction` (sinal do delta do evento) é confiável.
const pinchZoomDelta: PinchDelta = ({ direction: [dir] }) => {
  const factor = dir > 0 ? 1.1 : dir < 0 ? 0.9 : 1;
  return { scaleX: factor, scaleY: factor };
};

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
  activeResize: ActiveResize | null;
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
  activeResize,
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

  const endResize = (r: { id: string; startWidth: number; width: number; ceiling: number }) => {
    const settled = settleWidth(r.width, r.ceiling);
    resizeRef.current = null;
    setActiveResize(null);
    if (settled !== r.startWidth) onPersistWidth(r.id, settled);
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
        <GhostBar targetSlot={targetSlot} />
        {positioned.map((p) => {
          const data = nodeDataById.get(p.id);
          if (!data) return null;
          const isDragging = draggingId === p.id;
          const isResizing = activeResize?.id === p.id;
          return (
            <div
              key={p.id}
              ref={registerNode(p.id)}
              className={`absolute${isResizing ? ' select-none' : ''}`}
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
              onPointerDownCapture={(e) => {
                if (!(e.target as HTMLElement).closest('[data-testid="resize-handle"]')) return;
                // captura para do use-gesture do <Zoom> (listener nativo no container, só vê o bubble)
                e.stopPropagation();
                // sem isso, o navegador entende o arraste como seleção de texto do card
                e.preventDefault();
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
              }}
              onPointerDown={(e) => {
                if (resizeRef.current?.id === p.id) return;
                onNodePointerDown(p.id, e);
              }}
              onPointerMove={(e) => {
                if (resizeRef.current?.id === p.id) {
                  const { startClientX, startWidth, ceiling } = resizeRef.current;
                  const worldDx = (e.clientX - startClientX) / scale;
                  const width = draftWidth(startWidth, worldDx, ceiling);
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
  const isMutating = useIsMutating();

  const { size, measureRef } = useContainerSize();

  const { mutate: updateNode } = useUpdateNode();
  const { mutate: moveNode } = useMoveNode();

  const {
    editingId,
    setEditingId,
    deleteTarget,
    setDeleteTarget,
    setEditDialogNodeId,
    handleStartEdit,
    handleSubmitEdit,
    handleCancelEdit,
    handleDelete,
    handleConfirmDelete,
    editDialogNode,
    handleDialogUpdate,
  } = useNodeEditing({ mapId, nodes: data?.nodes, updateNode });

  const { mutate: createNode } = useCreateNode({
    onSuccess: (newNode) => setEditingId(newNode.id),
  });

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

  const handleAddChild = useCallback(
    (parentId: string) => {
      createNode({ mapId, parentId, title: 'Novo nó' });
    },
    [createNode, mapId],
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

  // Pós-edição: se o título couber numa largura menor que a atual, encolhe o card pro
  // conteúdo (mesma medição do resize). Mede com o título submetido, não o do DOM: o update
  // otimista aterrissa depois (após o ciclo de rede), então o DOM ainda tem o texto antigo.
  // 1 rAF só garante que o input já virou o span do título (estrutura do card).
  const fitWidthToContent = useCallback(
    (id: string, title: string) => {
      requestAnimationFrame(() => {
        const wrapper = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
        const cardEl = wrapper?.firstElementChild as HTMLElement | null;
        if (!wrapper || !cardEl) return;
        const fitted = measureContentWidth(cardEl, title);
        if (fitted < wrapper.offsetWidth) handlePersistWidth(id, fitted);
      });
    },
    [handlePersistWidth],
  );

  const handleSubmitEditAndFit = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      handleSubmitEdit(id, trimmed);
      if (trimmed) fitWidthToContent(id, trimmed);
    },
    [handleSubmitEdit, fitWidthToContent],
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
        depth: p.depth,
        hasChildren: hasChildrenMap.get(nodeDto.id) ?? false,
        isCollapsed: collapsedIds.has(nodeDto.id),
        isEditing: editingId === nodeDto.id,
        onSubmitEdit: (title) => handleSubmitEditAndFit(nodeDto.id, title),
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
    handleSubmitEditAndFit,
    handleCancelEdit,
    handleStartEdit,
    handleAddChild,
    handleDelete,
    handleToggleCollapse,
    setEditDialogNodeId,
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
          pinchDelta={pinchZoomDelta}
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
              activeResize={activeResize}
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
