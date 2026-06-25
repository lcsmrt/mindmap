import type { MapSummary } from '@mindmap/shared';

import { cn } from '@/lib/mergeClasses.js';
import { MapCardMenu } from './MapCardMenu.js';

type MapCardProps = {
  map: MapSummary;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  className?: string;
};

// Absolute date, consistent with HomePage's formatter (locale pt-BR).
const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const relativeFmt = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
];

/**
 * Relative label for "Editado" (e.g. "há 2 horas", "ontem").
 * Falls back to the absolute date for spans of 30 days or more.
 */
const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.abs(diffMs) / 86_400_000;
  if (diffDays >= 30) return dateFmt.format(date);

  let duration = diffMs / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeFmt.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return dateFmt.format(date);
};

export const MapCard = ({ map, onOpen, onRename, onDelete, className }: MapCardProps) => {
  const nodesLabel = `${map.nodeCount} ${map.nodeCount === 1 ? 'nó' : 'nós'}`;
  const criticalLabel = `${map.criticalCount} ${
    map.criticalCount === 1 ? 'crítico' : 'críticos'
  }`;

  return (
    <div
      data-testid="map-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'relative cursor-pointer rounded-[14px] border border-[#26262d] bg-[#17171c] px-4 pt-4 pb-[14px] outline-none transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#3a3a55] focus-visible:border-[#3a3a55]',
        className,
      )}
    >
      <div className="mb-[13px] flex items-start justify-between gap-2">
        <h3 className="flex-1 overflow-hidden text-[15.5px] font-semibold tracking-[-0.01em] overflow-ellipsis whitespace-nowrap">
          {map.title}
        </h3>
        <div
          className="-mt-[3px] -mr-1"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MapCardMenu onRename={onRename} onDelete={onDelete} />
        </div>
      </div>

      <div className="mb-[11px] flex items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] text-[#8a8a93]">{nodesLabel}</span>
        {map.criticalCount > 0 && (
          <span
            title="Nós com prioridade alta"
            className="inline-flex items-center gap-[5px] rounded-full bg-[rgba(224,91,91,0.13)] px-2 py-[3px] text-[11px] font-semibold text-[#ef7b7b]"
          >
            <span className="h-[5px] w-[5px] rounded-full bg-[#ef7b7b]" />
            {criticalLabel}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#222228] pt-[11px] text-[11.5px] text-[#62626b]">
        <span>Criado {dateFmt.format(new Date(map.createdAt))}</span>
        <span>Editado {formatRelative(map.updatedAt)}</span>
      </div>
    </div>
  );
};
