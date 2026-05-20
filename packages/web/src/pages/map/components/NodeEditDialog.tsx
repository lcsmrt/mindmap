import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { ColorSwatchGrid } from './ColorSwatchGrid.js';
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
    </div>
  );
}
