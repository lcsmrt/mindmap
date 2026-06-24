import { memo, useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, X, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { NodeTaskIndicators } from './NodeTaskIndicators.js';
import type { MindNodeData } from './types.js';

interface MindNodeProps {
  data: MindNodeData;
}

function MindNodeBase({ data }: MindNodeProps) {
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
    onOpenEditDialog,
  } = data;

  // Input inline controlado: o rascunho é reinicializado a cada início de edição
  // ajustando o estado durante o render (padrão React, sem efeito).
  const [draft, setDraft] = useState(node.title);
  const [wasEditing, setWasEditing] = useState(isEditing);
  if (isEditing !== wasEditing) {
    setWasEditing(isEditing);
    if (isEditing) setDraft(node.title);
  }

  const focusInput = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    el.select();
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.focus();
      el.select();
      setTimeout(() => {
        if (el.isConnected && el.ownerDocument.activeElement !== el) {
          el.focus();
          el.select();
        }
      }, 0);
    });
  }, []);

  function commit() {
    const value = draft.trim();
    if (value) {
      onSubmitEdit(value);
    } else {
      onCancelEdit();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  }

  return (
    <div
      className="relative flex w-full flex-col rounded-md border border-border bg-card px-3 py-2 text-foreground shadow-sm hover:border-primary/60"
      style={{
        backgroundColor: node.bgColor ?? undefined,
        color: node.textColor ?? undefined,
      }}
    >
      <div className="flex items-center gap-1">
        {hasChildren && (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground text-xs w-4 h-auto p-0"
            title={isCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        )}

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              ref={focusInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commit}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent border-none shadow-none text-sm text-foreground h-auto p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          ) : (
            <span
              className="text-sm truncate block cursor-text"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
            >
              {node.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild();
            }}
            className="text-muted-foreground hover:text-foreground text-sm w-5 h-5"
            title="Adicionar filho"
          >
            <Plus className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditDialog();
            }}
            className="text-muted-foreground hover:text-foreground text-sm w-5 h-5"
            title="Editar nó"
          >
            <Palette className="w-3 h-3" />
          </Button>

          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-muted-foreground/40 hover:text-destructive text-xs w-5 h-5"
              title="Excluir"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <NodeTaskIndicators node={node} />
    </div>
  );
}

export const MindNode = memo(MindNodeBase);
