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
      className="flex items-center gap-2.5 text-current"
    >
      {status && (
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold leading-none">
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          {status.label}
        </span>
      )}

      {assignee && (
        <span
          className="ml-auto flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#3a3a72] text-[10px] font-bold leading-none text-[#cdcdf0]"
          title={assignee}
          aria-label={assignee}
        >
          {getInitials(assignee)}
        </span>
      )}
    </div>
  );
}
