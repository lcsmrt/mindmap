import type { NodeDto } from '@mindmap/shared';
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
          <button
            key={option.value}
            type="button"
            data-testid={`status-btn-${option.value}`}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : option.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              isActive
                ? 'border-transparent text-white'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
            style={isActive ? { backgroundColor: option.color } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
