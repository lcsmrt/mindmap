import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import {
  CaretDownIcon,
  CaretRightIcon,
  PencilSimpleIcon,
  PlusIcon,
  TriangleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { memo, useCallback, useState } from 'react';
import { autoTextColor, isDarkBg } from './contrast.js';
import { DEFAULT_BG } from './color-palette.js';
import { NodeTaskIndicators } from './NodeTaskIndicators.js';
import { hasTaskProps } from './task-meta.js';
import type { MindNodeData } from './types.js';

interface MindNodeProps {
  data: MindNodeData;
}

/** Chrome fixo da toolbar do nó. Fica sobre o canvas escuro (posição `top:-24px`,
 * acima do card), então não varia com a cor do card. */
const TOOLBAR = {
  bg: 'var(--color-node-toolbar)',
  border: 'var(--color-node-toolbar-border)',
  fg: 'var(--color-muted-foreground)',
  hoverBg: 'var(--color-node-toolbar-hover)',
  hoverText: 'var(--color-primary-foreground)',
  delHoverBg: 'rgba(160,17,27,.25)',
  delHoverText: 'var(--color-brand)',
} as const;

interface CardSkin {
  background: string;
  text: string;
  border: string;
  boxShadow: string;
  critical: string;
  divider: string;
  titleClassName: string;
  padding: string;
}

/** Ênfase tipográfica por tier (N1 central / N2 cabeça de ramo / N3+ neutro) — fundo/borda/
 * sombra não mudam com o tier (C2, [[feedback-no-inline-hex]] preservado). */
const TIER_TITLE: Record<'n1' | 'n2' | 'n3', string> = {
  n1: 'text-lg font-bold tracking-[-0.01em]',
  n2: 'text-base font-bold tracking-[-0.01em]',
  n3: 'text-sm font-semibold tracking-[-0.01em]',
};

const TIER_PADDING: Record<'n1' | 'n2' | 'n3', string> = {
  n1: 'px-4 py-4',
  n2: 'px-3 py-3',
  n3: 'px-3 py-3',
};

function tierOf(depth: number): 'n1' | 'n2' | 'n3' {
  if (depth === 0) return 'n1';
  if (depth === 1) return 'n2';
  return 'n3';
}

function cardSkin(depth: number, bgColor: string | null, textColor: string | null): CardSkin {
  const background = bgColor ?? DEFAULT_BG;
  const text = textColor ?? autoTextColor(bgColor ?? DEFAULT_BG);
  const dark = isDarkBg(bgColor ?? DEFAULT_BG);
  const tier = tierOf(depth);
  const base = dark
    ? {
        border: 'var(--color-node-root-border)',
        boxShadow: '0 4px 18px rgba(0,0,0,.35)',
        critical: 'var(--color-brand)',
        divider: 'rgba(255,255,255,.14)',
      }
    : {
        border: 'rgba(0,0,0,.08)',
        boxShadow: '0 3px 14px rgba(0,0,0,.25)',
        critical: 'var(--color-critical-strong)',
        divider: 'rgba(0,0,0,.1)',
      };
  return {
    ...base,
    background,
    text,
    titleClassName: TIER_TITLE[tier],
    padding: TIER_PADDING[tier],
  };
}

function MindNodeBase({ data }: MindNodeProps) {
  const {
    node,
    isRoot,
    depth,
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

  const skin = cardSkin(depth, isRoot ? null : node.bgColor, isRoot ? null : node.textColor);

  return (
    <div
      className={`group relative flex w-full flex-col rounded-md ${skin.padding}`}
      style={{
        backgroundColor: skin.background,
        color: skin.text,
        border: `1px solid ${skin.border}`,
        boxShadow: skin.boxShadow,
      }}
    >
      <div className="flex items-start gap-2 pr-4">
        {hasChildren ? (
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
              <CaretRightIcon className="w-3 h-3" />
            ) : (
              <CaretDownIcon className="w-3 h-3" />
            )}
          </Button>
        ) : (
          // reserva o espaço do chevron mesmo sem filhos — senão o título reflui/quebra
          // quando o nó ganha o 1º filho e o botão aparece (relato do usuário).
          <span className="shrink-0 w-4" aria-hidden="true" />
        )}

        {node.isCritical && !isRoot && (
          <span
            className="inline-flex shrink-0 leading-none"
            style={{ color: skin.critical }}
            title="Prioridade crítica"
            aria-label="Prioridade crítica"
          >
            <TriangleIcon className="h-3 w-3" weight="fill" />
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
              className={`w-full bg-transparent border-none shadow-none ${skin.titleClassName} text-current h-auto p-0 focus-visible:ring-0 focus-visible:ring-offset-0`}
            />
          ) : (
            <span
              data-testid="node-title"
              className={`block w-fit max-w-full break-words cursor-text ${skin.titleClassName}`}
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
        className="group/toolbar absolute -top-6 right-0.5 flex gap-px rounded-sm p-0.5 opacity-0 transition-opacity duration-100 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
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
          className="size-6 rounded-sm text-(--tool-fg) hover:bg-(--tool-bg-h) hover:text-(--tool-fg-h)"
          title="Adicionar filho"
        >
          <PlusIcon className="w-3 h-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEditDialog();
          }}
          className="size-6 rounded-sm text-(--tool-fg) hover:bg-(--tool-bg-h) hover:text-(--tool-fg-h)"
          title="Editar nó"
        >
          <PencilSimpleIcon className="w-3 h-3" />
        </Button>

        {!isRoot && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="size-6 rounded-sm text-(--del-fg) hover:bg-(--del-bg-h) hover:text-(--del-fg-h)"
            title="Excluir"
          >
            <XIcon className="w-3 h-3" />
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
