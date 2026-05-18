import { useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { MindNodeData } from './types.js';

interface MindNodeProps {
  data: MindNodeData;
}

export function MindNode({ data }: MindNodeProps) {
  const {
    node,
    isRoot,
    hasChildren,
    isCollapsed,
    isEditing,
    onStartEdit,
    onSubmitEdit,
    onCancelEdit,
    onAddChild,
    onDelete,
    onToggleCollapse,
  } = data;

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select();
    }
  }, [isEditing]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (value) {
        onSubmitEdit(value);
      } else {
        onCancelEdit();
      }
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.currentTarget.value.trim();
    if (value) {
      onSubmitEdit(value);
    } else {
      onCancelEdit();
    }
  }

  return (
    <div
      className="relative flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-foreground shadow-sm hover:border-primary/60"
      style={{ minWidth: 160 }}
      onDoubleClick={!isEditing ? onStartEdit : undefined}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-muted-foreground/40 !border-none"
      />

      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="shrink-0 text-muted-foreground hover:text-foreground text-xs w-4"
          title={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      )}

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            defaultValue={node.title}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent outline-none text-sm text-foreground"
            autoFocus
          />
        ) : (
          <span className="text-sm truncate block">{node.title}</span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className="text-muted-foreground hover:text-foreground text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-muted"
          title="Adicionar filho"
        >
          +
        </button>

        {!isRoot && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-muted-foreground/40 hover:text-destructive text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-muted"
            title="Excluir"
          >
            ×
          </button>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-muted-foreground/40 !border-none"
      />
    </div>
  );
}
