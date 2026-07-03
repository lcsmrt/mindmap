import type { NodeDto } from '@mindmap/shared';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/mergeClasses.js';
import { STATUS_OPTIONS } from './task-meta.js';

interface StatusSelectorProps {
  value: NodeDto['status'];
  onSelect: (status: NodeDto['status']) => void;
}

export function StatusSelector({ value, onSelect }: StatusSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            data-testid={`status-btn-${option.value}`}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : option.value)}
            className={cn(
              'h-auto rounded-md border px-2.5 py-1 text-xs font-medium',
              isActive
                ? 'border-transparent text-white hover:text-white'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
            style={isActive ? { backgroundColor: option.color } : undefined}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
