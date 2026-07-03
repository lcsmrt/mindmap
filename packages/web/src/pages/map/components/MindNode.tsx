import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { ChevronDown, ChevronRight, Pencil, Plus, Triangle, X } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { autoTextColor, isDarkBg } from './contrast.js';
import { DEFAULT_BG } from './color-palette.js';
import { NodeTaskIndicators } from './NodeTaskIndicators.js';
import { hasTaskProps } from './task-meta.js';
import type { MindNodeData } from './types.js';

interface MindNodeProps {
  data: MindNodeData;
}

/** Chrome fixo da toolbar do nó, alinhado ao guia. Fica sobre o canvas escuro
 * (posição `top:-23px`, acima do card), então não varia com a cor do card. */
const TOOLBAR = {
  bg: '#26242b',
  border: '#3a3742',
  fg: '#8a807b',
  hoverBg: '#2a2830',
  hoverText: '#ffffff',
  delHoverBg: 'rgba(160,17,27,.25)',
  delHoverText: '#c4151f',
} as const;

interface CardSkin {
  background: string;
  text: string;
  border: string;
  boxShadow: string;
  critical: string;
  divider: string;
}

function cardSkin(bgColor: string | null, textColor: string | null): CardSkin {
  const background = bgColor ?? DEFAULT_BG;
  const text = textColor ?? autoTextColor(bgColor ?? DEFAULT_BG);
  const dark = isDarkBg(bgColor ?? DEFAULT_BG);
  return dark
    ? {
        background,
        text,
        border: '#38353f',
        boxShadow: '0 4px 18px rgba(0,0,0,.35)',
        critical: '#c4151f',
        divider: 'rgba(255,255,255,.14)',
      }
    : {
        background,
        text,
        border: 'rgba(0,0,0,.08)',
        boxShadow: '0 3px 14px rgba(0,0,0,.25)',
        critical: '#b01818',
        divider: 'rgba(0,0,0,.1)',
      };
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

  const skin = cardSkin(isRoot ? null : node.bgColor, isRoot ? null : node.textColor);
  const borderRadius = isRoot ? '0.5rem' : hasChildren ? '0.3125rem' : '0.1875rem';

  return (
    <div
      className="group relative flex w-full flex-col px-3.25 py-2.75"
      style={{
        backgroundColor: skin.background,
        color: skin.text,
        border: `1px solid ${skin.border}`,
        boxShadow: skin.boxShadow,
        borderRadius,
      }}
    >
      <div className="flex items-start gap-1.75 pr-4">
        {hasChildren && (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="shrink-0 h-auto w-4 p-0 text-current opacity-60 hover:bg-transparent hover:opacity-100"
            title={isCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
        )}

        {node.isCritical && !isRoot && (
          <span
            className="inline-flex shrink-0 leading-none"
            style={{ color: skin.critical }}
            title="Prioridade crítica"
            aria-label="Prioridade crítica"
          >
            <Triangle className="h-3 w-3" fill="currentColor" />
          </span>
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
              className="w-full bg-transparent border-none shadow-none text-sm font-semibold tracking-[-0.01em] text-current h-auto p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          ) : (
            <span
              data-testid="node-title"
              className="block w-fit max-w-full break-words cursor-text text-sm font-semibold tracking-[-0.01em]"
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
      </div>

      <div
        className="group/toolbar absolute -top-[23px] right-0.5 flex gap-px rounded-[5px] p-0.5 opacity-0 transition-opacity duration-100 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        style={{
          backgroundColor: TOOLBAR.bg,
          border: `1px solid ${TOOLBAR.border}`,
          boxShadow: '0 8px 20px rgba(0,0,0,.6)',
          ['--tool-fg' as string]: TOOLBAR.fg,
          ['--tool-bg-h' as string]: TOOLBAR.hoverBg,
          ['--tool-fg-h' as string]: TOOLBAR.hoverText,
          ['--del-fg' as string]: TOOLBAR.fg,
          ['--del-bg-h' as string]: TOOLBAR.delHoverBg,
          ['--del-fg-h' as string]: TOOLBAR.delHoverText,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className="h-5.75 w-5.75 rounded-[5px] text-(--tool-fg) hover:bg-(--tool-bg-h) hover:text-(--tool-fg-h)"
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
          className="h-5.75 w-5.75 rounded-[5px] text-(--tool-fg) hover:bg-(--tool-bg-h) hover:text-(--tool-fg-h)"
          title="Editar nó"
        >
          <Pencil className="w-3 h-3" />
        </Button>

        {!isRoot && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-5.75 w-5.75 rounded-[5px] text-(--del-fg) hover:bg-(--del-bg-h) hover:text-(--del-fg-h)"
            title="Excluir"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {hasTaskProps(node) && (
        <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: skin.divider }}>
          <NodeTaskIndicators node={node} />
        </div>
      )}

      <div
        data-testid="resize-handle"
        className="absolute right-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-end opacity-0 transition-opacity duration-100 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
      >
        <div className="mr-0.5 h-8 w-1 rounded-full bg-current opacity-60" />
      </div>
    </div>
  );
}

export const MindNode = memo(MindNodeBase);
