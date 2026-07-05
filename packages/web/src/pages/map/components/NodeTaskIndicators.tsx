import type { NodeDto } from '@mindmap/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.js';
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
      className="flex items-center gap-2.5 text-current"
    >
      {status && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold leading-none">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          {status.label}
        </span>
      )}

      {assignee && (
        <Avatar size="sm" className="ml-auto size-5" title={assignee} aria-label={assignee}>
          <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary-foreground/80">
            {getInitials(assignee)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
