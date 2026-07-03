import { useState, useRef, useCallback } from 'react';
import { Flag, Triangle, Check, CircleAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { ColorSwatchGrid } from './ColorSwatchGrid.js';
import { StatusSelector } from './StatusSelector.js';
import { BG_PALETTE, TEXT_PALETTE } from './color-palette.js';
import { statusMeta, getInitials } from './task-meta.js';
import { autoTextColor, contrastRatio, contrastVerdict, isDarkBg } from './contrast.js';
import type { ContrastLevel } from './contrast.js';
import type { NodeDto, UpdateNodeBody } from '@mindmap/shared';

interface NodeEditDialogProps {
  node: NodeDto | null;
  onUpdateNode: (fields: UpdateNodeBody) => void;
  onClose: () => void;
}

export function NodeEditDialog({ node, onUpdateNode, onClose }: NodeEditDialogProps) {
  return (
    <Dialog open={node !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar nó</DialogTitle>
        </DialogHeader>
        {node && (
          <NodeEditForm key={node.id} node={node} onUpdateNode={onUpdateNode} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NodeEditFormProps {
  node: NodeDto;
  onUpdateNode: (fields: UpdateNodeBody) => void;
}

function effectiveTextColor(bgColor: string | null, textColor: string | null): string {
  if (textColor !== null) return textColor;
  return autoTextColor(bgColor ?? '#ffffff');
}

const CONTRAST_TONE: Record<ContrastLevel, string> = {
  good: 'text-emerald-400',
  ok: 'text-amber-400',
  bad: 'text-rose-400',
};

const CONTRAST_ICON: Record<ContrastLevel, LucideIcon> = {
  good: Check,
  ok: CircleAlert,
  bad: TriangleAlert,
};

function NodeEditForm({ node, onUpdateNode }: NodeEditFormProps) {
  const [title, setTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [assignee, setAssignee] = useState(node.assignee ?? '');
  const assigneeRef = useRef<HTMLInputElement>(null);

  const [bgColor, setBgColor] = useState(node.bgColor);
  const [textColor, setTextColor] = useState(node.textColor);
  const [status, setStatus] = useState(node.status);
  const [isCritical, setIsCritical] = useState(node.isCritical);

  const handleTitleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === node.title) return;
    onUpdateNode({ title: trimmed });
  }, [title, node.title, onUpdateNode]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
      inputRef.current?.blur();
    }
  }

  const handleAssigneeSubmit = useCallback(() => {
    const v = assignee.trim();
    const next = v === '' ? null : v;
    if (next === node.assignee) return;
    onUpdateNode({ assignee: next });
  }, [assignee, node.assignee, onUpdateNode]);

  function handleAssigneeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAssigneeSubmit();
      assigneeRef.current?.blur();
    }
  }

  function selectBgColor(color: string | null) {
    setBgColor(color);
    onUpdateNode({ bgColor: color });
  }

  function selectTextColor(color: string | null) {
    setTextColor(color);
    onUpdateNode({ textColor: color });
  }

  function selectStatus(next: NodeDto['status']) {
    setStatus(next);
    onUpdateNode({ status: next });
  }

  function toggleCritical() {
    const next = !isCritical;
    setIsCritical(next);
    onUpdateNode({ isCritical: next });
  }

  const effectiveText = effectiveTextColor(bgColor, textColor);
  const previewBg = bgColor ?? '#19181c';
  const dark = isDarkBg(previewBg);
  const ratio = contrastRatio(previewBg, effectiveText);
  const verdict = contrastVerdict(ratio);

  const VerdictIcon = CONTRAST_ICON[verdict.level];
  const statusInfo = status != null ? statusMeta(status) : null;
  const trimmedAssignee = assignee.trim();
  const initials = trimmedAssignee.length > 0 ? getInitials(trimmedAssignee) : '';
  const criticalColor = dark ? 'var(--color-brand)' : '#b01818';
  const dividerColor = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.1)';

  return (
    <div className="min-w-0 space-y-4">
      {/* Pré-visualização ao vivo */}
      <div className="space-y-2">
        <div
          className="rounded-md border px-3.5 py-3"
          style={{
            backgroundColor: previewBg,
            borderColor: dark ? 'var(--color-node-root-border)' : 'rgba(0,0,0,.08)',
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {isCritical && (
              <span
                className="inline-flex shrink-0 leading-none"
                style={{ color: criticalColor }}
                title="Prioridade crítica"
              >
                <Triangle className="h-3 w-3" fill="currentColor" />
              </span>
            )}
            <span
              className="min-w-0 truncate text-sm font-semibold tracking-tight"
              style={{ color: effectiveText }}
            >
              {title || 'Sem título'}
            </span>
          </div>
          {(statusInfo || initials) && (
            <div
              className="mt-2.5 flex items-center gap-2.5 border-t pt-2.5"
              style={{ borderColor: dividerColor }}
            >
              {statusInfo && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold leading-none"
                  style={{ color: effectiveText }}
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: statusInfo.color }}
                  />
                  {statusInfo.label}
                </span>
              )}
              {initials && (
                <span className="ml-auto flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold leading-none text-primary-foreground/80">
                  {initials}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Medidor de contraste (WCAG) */}
        <div className="flex items-center gap-1.5 font-mono text-[11.5px] font-semibold">
          <VerdictIcon className={`h-3.5 w-3.5 ${CONTRAST_TONE[verdict.level]}`} />
          <span className={CONTRAST_TONE[verdict.level]}>{verdict.label}</span>
          <span className="font-normal text-muted-foreground">
            · contraste texto/fundo {ratio.toFixed(1)}:1
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="node-title" className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Título
        </label>
        <Input
          ref={inputRef}
          id="node-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleTitleSubmit}
          autoFocus
        />
      </div>

      <ColorSwatchGrid
        label="Cor de fundo"
        colors={BG_PALETTE}
        value={bgColor}
        onSelect={selectBgColor}
      />

      <div className="space-y-1.5">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Cor de texto{' '}
          <span className="font-normal normal-case text-muted-foreground/70">
            — prévia sobre o fundo atual
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {TEXT_PALETTE.map((swatch) => {
            const selected = textColor === swatch.hex;
            const aaColor = effectiveTextColor(bgColor, swatch.hex);
            return (
              <button
                key={swatch.hex ?? 'auto'}
                type="button"
                aria-label={swatch.name}
                aria-pressed={selected}
                onClick={() => selectTextColor(swatch.hex)}
                className={`flex h-7 w-[34px] items-center justify-center rounded-md border border-border text-[13px] font-bold transition-shadow ${
                  selected ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                style={{ backgroundColor: previewBg, color: aaColor }}
                title={swatch.name}
              >
                Aa
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        <StatusSelector value={status} onSelect={selectStatus} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="node-assignee" className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Responsável
        </label>
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-input px-2.5 py-1 focus-within:border-ring">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10.5px] font-bold leading-none text-primary-foreground/80">
            {initials || '—'}
          </span>
          <Input
            ref={assigneeRef}
            id="node-assignee"
            data-testid="assignee-input"
            value={assignee}
            placeholder="Atribuir a alguém"
            onChange={(e) => setAssignee(e.target.value)}
            onKeyDown={handleAssigneeKeyDown}
            onBlur={handleAssigneeSubmit}
            className="h-auto min-w-0 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Prioridade</span>
        <div>
          <button
            type="button"
            data-testid="critical-toggle"
            aria-pressed={isCritical}
            onClick={toggleCritical}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              isCritical
                ? 'border-transparent bg-destructive text-white'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
            Crítico
          </button>
        </div>
      </div>
    </div>
  );
}
