import { useState, useRef, useEffect } from 'react';
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
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [node]);

  function handleTitleSubmit() {
    const trimmed = title.trim();
    if (!trimmed || !node || trimmed === node.title) return;
    onUpdateNode({ title: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
      inputRef.current?.blur();
    }
  }

  return (
    <Dialog open={node !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar nó</DialogTitle>
        </DialogHeader>

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
            />
          </div>

          <ColorSwatchGrid
            label="Cor de fundo"
            colors={BG_PALETTE}
            value={node?.bgColor ?? null}
            onSelect={(color) => onUpdateNode({ bgColor: color })}
          />

          <ColorSwatchGrid
            label="Cor de texto"
            colors={TEXT_PALETTE}
            value={node?.textColor ?? null}
            onSelect={(color) => onUpdateNode({ textColor: color })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
