import { useState, useRef, useCallback } from 'react';
import { Flag } from 'lucide-react';
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

function NodeEditForm({ node, onUpdateNode }: NodeEditFormProps) {
  const [title, setTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [assignee, setAssignee] = useState(node.assignee ?? '');
  const assigneeRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="node-title" className="text-xs font-medium text-muted-foreground">
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
        value={node.bgColor}
        onSelect={(color) => onUpdateNode({ bgColor: color })}
      />

      <ColorSwatchGrid
        label="Cor de texto"
        colors={TEXT_PALETTE}
        value={node.textColor}
        onSelect={(color) => onUpdateNode({ textColor: color })}
      />

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <StatusSelector value={node.status} onSelect={(s) => onUpdateNode({ status: s })} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="node-assignee" className="text-xs font-medium text-muted-foreground">
          Responsável
        </label>
        <Input
          ref={assigneeRef}
          id="node-assignee"
          data-testid="assignee-input"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          onKeyDown={handleAssigneeKeyDown}
          onBlur={handleAssigneeSubmit}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Prioridade</span>
        <div>
          <button
            type="button"
            data-testid="critical-toggle"
            aria-pressed={node.isCritical}
            onClick={() => onUpdateNode({ isCritical: !node.isCritical })}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              node.isCritical
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
