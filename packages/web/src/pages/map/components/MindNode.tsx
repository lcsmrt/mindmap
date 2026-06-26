import { memo, useCallback, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, X, Palette, Triangle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { NodeTaskIndicators } from './NodeTaskIndicators.js';
import { hasTaskProps } from './task-meta.js';
import { autoTextColor, isDarkBg } from './contrast.js';
import type { MindNodeData } from './types.js';

interface MindNodeProps {
  data: MindNodeData;
}

/**
 * Default card background when the node has no custom color (dark study tone).
 */
const DEFAULT_BG = '#1c1c22';

interface CardSkin {
  background: string;
  /** Text color applied to the card (and inherited footer via `text-current`). */
  text: string;
  /** Subtle border adapted to the background, or `undefined` for none. */
  border: string;
  boxShadow: string;
  /** Critical marker color, adapted to the background (mirrors the export). */
  critical: string;
  /** Divider between title and task footer, adapted to the background. */
  divider: string;
  /** Toolbar pill background, tuned for light vs. dark cards. */
  toolbarBg: string;
  /** Idle/hover colors for the add + edit toolbar buttons. */
  toolBtn: string;
  toolBtnHoverBg: string;
  toolBtnHoverText: string;
  /** Idle/hover colors for the delete toolbar button. */
  delBtn: string;
  delBtnHoverBg: string;
  delBtnHoverText: string;
}

/**
 * Derive the card presentation from the node colors, mirroring the M10 study
 * export ("Estudo de Nos.dc.html"): borders/divisors and the hover toolbar
 * adapt to whether the background reads as dark or light.
 */
function cardSkin(bgColor: string | null, textColor: string | null): CardSkin {
  const background = bgColor ?? DEFAULT_BG;
  const text = textColor ?? autoTextColor(background);
  const dark = isDarkBg(background);
  return dark
    ? {
        background,
        text,
        border: '#34343e',
        boxShadow: '0 4px 18px rgba(0,0,0,.35)',
        critical: '#ef7b7b',
        divider: 'rgba(255,255,255,.14)',
        toolbarBg: 'rgba(20,20,24,.7)',
        toolBtn: '#9a9aa3',
        toolBtnHoverBg: '#2e2e36',
        toolBtnHoverText: '#ffffff',
        delBtn: '#9a9aa3',
        delBtnHoverBg: '#3a2626',
        delBtnHoverText: '#ef7b7b',
      }
    : {
        background,
        text,
        border: 'rgba(0,0,0,.08)',
        boxShadow: '0 3px 14px rgba(0,0,0,.25)',
        critical: '#b01818',
        divider: 'rgba(0,0,0,.1)',
        toolbarBg: 'rgba(0,0,0,.1)',
        toolBtn: 'rgba(0,0,0,.5)',
        toolBtnHoverBg: 'rgba(0,0,0,.1)',
        toolBtnHoverText: '#000000',
        delBtn: 'rgba(0,0,0,.5)',
        delBtnHoverBg: 'rgba(198,40,40,.18)',
        delBtnHoverText: '#a01919',
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

  const skin = cardSkin(node.bgColor, node.textColor);

  return (
    <div
      className="group relative flex w-full flex-col rounded-[11px] px-[13px] py-[11px]"
      style={{
        backgroundColor: skin.background,
        color: skin.text,
        border: `1px solid ${skin.border}`,
        boxShadow: skin.boxShadow,
      }}
    >
      <div className="flex items-center gap-[7px] pr-4">
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
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        )}

        {node.isCritical && (
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
              className="block truncate cursor-text text-sm font-semibold tracking-[-0.01em]"
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

      {/* Toolbar revelada no hover (CSS apenas). Os botões mantêm
          `stopPropagation` no clique, então o drag do card permanece intacto.
          `pointer-events-none` enquanto oculta deixa o pointerdown chegar ao
          wrapper de arraste em MapCanvas. */}
      <div
        className="absolute top-2 right-2 flex gap-px rounded-[7px] p-0.5 opacity-0 transition-opacity duration-100 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        style={{
          backgroundColor: skin.toolbarBg,
          ['--tool-fg' as string]: skin.toolBtn,
          ['--tool-bg-h' as string]: skin.toolBtnHoverBg,
          ['--tool-fg-h' as string]: skin.toolBtnHoverText,
          ['--del-fg' as string]: skin.delBtn,
          ['--del-bg-h' as string]: skin.delBtnHoverBg,
          ['--del-fg-h' as string]: skin.delBtnHoverText,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className="h-[23px] w-[23px] rounded-[5px] text-[color:var(--tool-fg)] hover:bg-[var(--tool-bg-h)] hover:text-[color:var(--tool-fg-h)]"
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
          className="h-[23px] w-[23px] rounded-[5px] text-[color:var(--tool-fg)] hover:bg-[var(--tool-bg-h)] hover:text-[color:var(--tool-fg-h)]"
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
            className="h-[23px] w-[23px] rounded-[5px] text-[color:var(--del-fg)] hover:bg-[var(--del-bg-h)] hover:text-[color:var(--del-fg-h)]"
            title="Excluir"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {hasTaskProps(node) && (
        <div
          className="mt-2.5 border-t pt-2.5"
          style={{ borderColor: skin.divider }}
        >
          <NodeTaskIndicators node={node} />
        </div>
      )}
    </div>
  );
}

export const MindNode = memo(MindNodeBase);
