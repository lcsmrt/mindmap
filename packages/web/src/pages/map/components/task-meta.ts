import type { NodeDto } from '@mindmap/shared';

type NodeStatus = NonNullable<NodeDto['status']>;

interface StatusMeta {
  value: NodeStatus;
  label: string;
  color: string;
}

export const STATUS_OPTIONS: readonly StatusMeta[] = [
  { value: 'PENDING', label: 'Pendente', color: '#6b7280' },
  { value: 'IN_PROGRESS', label: 'Em andamento', color: '#3b82f6' },
  { value: 'DONE', label: 'Concluído', color: '#22c55e' },
  { value: 'BLOCKED', label: 'Bloqueado', color: '#ef4444' },
];

const STATUS_FALLBACK: StatusMeta = {
  value: 'PENDING',
  label: 'Pendente',
  color: '#6b7280',
};

export function statusMeta(value: NodeStatus): StatusMeta {
  return STATUS_OPTIONS.find((opt) => opt.value === value) ?? STATUS_FALLBACK;
}

export function getInitials(assignee: string): string {
  const words = assignee.trim().split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return '';
  }

  if (words.length >= 2) {
    const first = Array.from(words[0] ?? '');
    const second = Array.from(words[1] ?? '');
    return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
  }

  const chars = Array.from(words[0] ?? '');
  return chars.slice(0, 2).join('').toUpperCase();
}

export function hasTaskProps(node: NodeDto): boolean {
  return (
    node.status != null ||
    (node.assignee != null && node.assignee.length > 0) ||
    node.isCritical
  );
}
