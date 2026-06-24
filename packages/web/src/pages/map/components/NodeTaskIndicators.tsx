import { Flag } from 'lucide-react';
import type { NodeDto } from '@mindmap/shared';
import { statusMeta, getInitials, hasTaskProps } from './task-meta.js';

interface NodeTaskIndicatorsProps {
  node: NodeDto;
}

export function NodeTaskIndicators({ node }: NodeTaskIndicatorsProps) {
  if (!hasTaskProps(node)) {
    return null;
  }

  const status = node.status != null ? statusMeta(node.status) : null;
  const assignee = node.assignee != null && node.assignee.length > 0 ? node.assignee : null;

  return (
    <div
      data-testid="node-task-indicators"
      className="flex items-center gap-1.5 text-xs text-current/80"
    >
      {status && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: status.color }}
          title={status.label}
          aria-label={status.label}
        />
      )}

      {assignee && (
        <span className="font-medium leading-none" title={assignee}>
          {getInitials(assignee)}
        </span>
      )}

      {node.isCritical && <Flag className="w-3 h-3 shrink-0" aria-label="Crítico" />}
    </div>
  );
}
