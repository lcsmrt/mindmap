import { useState, useRef, useCallback } from 'react';
import {
  FlagIcon,
  TriangleIcon,
  CheckIcon,
  WarningCircleIcon,
  WarningIcon,
  CircleHalfIcon,
  type Icon,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import { Field, FieldLabel } from '@/components/ui/field.js';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group.js';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.js';
import { cn } from '@/lib/mergeClasses.js';
import { ColorSwatchGrid } from './ColorSwatchGrid.js';
import { StatusSelector } from './StatusSelector.js';
import { NodeTaskIndicators } from './NodeTaskIndicators.js';
import { BG_PALETTE, TEXT_PALETTE, DEFAULT_BG } from './color-palette.js';
import { getInitials } from './task-meta.js';
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
  return autoTextColor(bgColor ?? DEFAULT_BG);
}

const CONTRAST_TONE: Record<ContrastLevel, string> = {
  good: 'text-emerald-400',
  ok: 'text-amber-400',
  bad: 'text-rose-400',
};

const CONTRAST_ICON: Record<ContrastLevel, Icon> = {
  good: CheckIcon,
  ok: WarningCircleIcon,
  bad: WarningIcon,
};

function NodeEditForm({ node, onUpdateNode }: NodeEditFormProps) {
  const [title, setTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [assignee, setAssignee] = useState(node.assignee ?? '');

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
      e.currentTarget.blur();
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
  const previewBg = bgColor ?? DEFAULT_BG;
  const dark = isDarkBg(previewBg);
  const ratio = contrastRatio(previewBg, effectiveText);
  const verdict = contrastVerdict(ratio);

  const VerdictIcon = CONTRAST_ICON[verdict.level];
  const trimmedAssignee = assignee.trim();
  const initials = trimmedAssignee.length > 0 ? getInitials(trimmedAssignee) : '';
  const criticalColor = dark ? 'var(--color-brand)' : 'var(--color-critical-strong)';
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
                <TriangleIcon className="h-3 w-3" weight="fill" />
              </span>
            )}
            <span
              className="min-w-0 truncate text-sm font-semibold tracking-tight"
              style={{ color: effectiveText }}
            >
              {title || 'Sem título'}
            </span>
          </div>
          {(status != null || trimmedAssignee.length > 0) && (
            <div
              className="mt-2.5 border-t pt-2.5"
              style={{ borderColor: dividerColor, color: effectiveText }}
            >
              <NodeTaskIndicators node={{ ...node, status, assignee: trimmedAssignee || null }} />
            </div>
          )}
        </div>

        {/* Medidor de contraste (WCAG) */}
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
          <VerdictIcon className={`h-3.5 w-3.5 ${CONTRAST_TONE[verdict.level]}`} />
          <span className={CONTRAST_TONE[verdict.level]}>{verdict.label}</span>
          <span className="font-normal text-muted-foreground">
            · contraste texto/fundo {ratio.toFixed(1)}:1
          </span>
        </div>
      </div>

      <Field className="gap-1.5">
        <FieldLabel htmlFor="node-title" className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Título
        </FieldLabel>
        <Input
          ref={inputRef}
          id="node-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleTitleSubmit}
          autoFocus
        />
      </Field>

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
              <Button
                key={swatch.hex ?? 'auto'}
                type="button"
                variant="ghost"
                aria-label={swatch.name}
                aria-pressed={selected}
                onClick={() => selectTextColor(swatch.hex)}
                className={cn(
                  'h-7 w-8 rounded-md border border-border p-0 text-xs font-bold',
                  selected && 'ring-2 ring-primary ring-offset-2',
                )}
                style={{ backgroundColor: previewBg, color: aaColor }}
                title={swatch.name}
              >
                {swatch.hex === null ? <CircleHalfIcon className="h-4 w-4" /> : 'Aa'}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        <StatusSelector value={status} onSelect={selectStatus} />
      </div>

      <Field className="gap-1.5">
        <FieldLabel htmlFor="node-assignee" className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Responsável
        </FieldLabel>
        <InputGroup className="h-auto py-1">
          <InputGroupAddon align="inline-start">
            <Avatar className="size-6">
              <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary-foreground/80">
                {initials || '—'}
              </AvatarFallback>
            </Avatar>
          </InputGroupAddon>
          <InputGroupInput
            id="node-assignee"
            data-testid="assignee-input"
            value={assignee}
            placeholder="Atribuir a alguém"
            onChange={(e) => setAssignee(e.target.value)}
            onKeyDown={handleAssigneeKeyDown}
            onBlur={handleAssigneeSubmit}
          />
        </InputGroup>
      </Field>

      <div className="space-y-1.5">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Prioridade</span>
        <div>
          <Button
            type="button"
            variant="ghost"
            data-testid="critical-toggle"
            aria-pressed={isCritical}
            onClick={toggleCritical}
            className={cn(
              'h-auto gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
              isCritical
                ? 'border-transparent bg-destructive text-white hover:bg-destructive hover:text-white'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
          >
            <FlagIcon className="h-3.5 w-3.5" />
            Crítico
          </Button>
        </div>
      </div>
    </div>
  );
}
