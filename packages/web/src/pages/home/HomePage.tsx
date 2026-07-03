import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapSummary } from '@mindmap/shared';

import { useMaps, useCreateMap, useUpdateMap, useDeleteMap } from '@/api/maps.js';
import { BrandMark } from '@/components/BrandMark.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { cn } from '@/lib/mergeClasses.js';
import { MapCard } from './components/MapCard.js';
import { CreateMapModal } from './components/CreateMapModal.js';
import { RenameMapInput } from './components/RenameMapInput.js';
import { filterAndSortMaps, type MapSort } from './components/map-sort.js';

const SORT_OPTIONS: { value: MapSort; label: string }[] = [
  { value: 'recent', label: 'Recentes' },
  { value: 'alpha', label: 'A–Z' },
  { value: 'nodes', label: 'Mais nós' },
];

export const HomePage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MapSort>('recent');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MapSummary | null>(null);

  const { data, isLoading, isError } = useMaps();
  const { mutateAsync: createMap, isPending: isCreating } = useCreateMap({
    onSuccess: () => setCreating(false),
  });
  const { mutateAsync: updateMap } = useUpdateMap();
  const { mutate: deleteMap } = useDeleteMap({
    onSuccess: () => setDeleteTarget(null),
  });

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Carregando…</p>;
  }
  if (isError) {
    return <p className="p-6 text-destructive">Erro ao carregar mapas</p>;
  }

  const maps = data?.maps ?? [];
  const total = maps.length;
  const visibleMaps = filterAndSortMaps(maps, query, sort);

  const countLabel = `${total} ${total === 1 ? 'mapa' : 'mapas'}`;
  const noMapsAtAll = total === 0;
  const noResults = total > 0 && visibleMaps.length === 0;

  return (
    <div
      className="flex min-h-screen flex-col text-foreground"
      style={{
        background: `radial-gradient(120% 80% at 50% -10%, var(--color-background-glow) 0%, var(--color-background) 55%)`,
      }}
    >
      <header className="flex items-center justify-between border-b border-border px-8 py-[18px]">
        <div className="flex items-center gap-3">
          <BrandMark size={28} glow />
          <div className="flex items-center gap-2">
            <span className="font-heading text-base font-bold tracking-[0.12em] uppercase">
              KAOS
            </span>
            <span className="h-4 w-px bg-border" />
            <span className="font-mono text-xs text-fg-subtle">mapas mentais</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-8 pt-10 pb-16">
        <div className="mb-[26px] flex items-end justify-between gap-5">
          <div>
            <h1 className="font-heading text-[26px] font-bold tracking-[-0.02em]">Meus Mapas</h1>
            <p className="mt-[5px] font-mono text-[13px] text-fg-subtle">{countLabel}</p>
          </div>
          <button
            type="button"
            data-testid="new-map-button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-[17px] py-[11px] text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span className="-mt-px text-[17px] leading-none">+</span> Novo mapa
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] max-w-[340px] flex-1 items-center gap-[9px] rounded-md border border-border bg-card px-[13px] py-[9px]">
            <SearchIcon />
            <input
              data-testid="map-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mapas"
              className="w-full border-none bg-transparent text-[13.5px] text-foreground placeholder:text-fg-faint focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-[7px]" data-testid="map-sort">
            <span className="mr-0.5 font-mono text-xs text-fg-faint">Ordenar:</span>
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSort(option.value)}
                  className={cn(
                    'rounded-[8px] border px-[13px] py-2 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {noMapsAtAll ? (
          <EmptyState
            title="Nenhum mapa ainda"
            subtitle="Despejar o primeiro mapa para começar."
            onCreate={() => setCreating(true)}
          />
        ) : noResults ? (
          <EmptyState
            title="Nada encontrado"
            subtitle="Tente outro termo de busca."
            onClear={() => setQuery('')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMaps.map((map) =>
              renamingId === map.id ? (
                <div
                  key={map.id}
                  className="rounded-md border border-border bg-card px-4 py-4"
                >
                  <RenameMapInput
                    initialTitle={map.title}
                    onConfirm={(title) => updateMap({ id: map.id, body: { title } })}
                    onClose={() => setRenamingId(null)}
                  />
                </div>
              ) : (
                <MapCard
                  key={map.id}
                  map={map}
                  onOpen={() => navigate(`/maps/${map.id}`)}
                  onRename={() => setRenamingId(map.id)}
                  onDelete={() => setDeleteTarget(map)}
                />
              ),
            )}
          </div>
        )}
      </main>

      <CreateMapModal
        open={creating}
        isPending={isCreating}
        onCreate={(title) => createMap({ title })}
        onClose={() => setCreating(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir mapa"
        message={`Tem certeza? O mapa «${deleteTarget?.title ?? ''}» e todos os seus nós serão removidos permanentemente.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => deleteTarget && deleteMap(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const SearchIcon = () => (
  <div className="relative h-[14px] w-[14px] shrink-0 rounded-full border-[1.6px] border-muted-foreground">
    <div className="absolute -right-1 -bottom-0.5 h-[1.6px] w-[6px] rotate-45 rounded-[2px] bg-muted-foreground" />
  </div>
);

type EmptyStateProps = {
  title: string;
  subtitle: string;
  onCreate?: () => void;
  onClear?: () => void;
};

const EmptyState = ({ title, subtitle, onCreate, onClear }: EmptyStateProps) => (
  <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card px-5 py-[72px] text-center">
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <BrandMark size={220} className="opacity-[0.04]" />
    </div>
    <div className="relative">
      <h3 className="mb-1.5 font-heading text-base font-semibold">{title}</h3>
      <p className="mb-[18px] text-[13.5px] text-muted-foreground">{subtitle}</p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-primary px-[18px] py-2.5 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          + Despejar o primeiro mapa
        </button>
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-border px-[18px] py-2.5 text-[13.5px] font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Limpar busca
        </button>
      )}
    </div>
  </div>
);
