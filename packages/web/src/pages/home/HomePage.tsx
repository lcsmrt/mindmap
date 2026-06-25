import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapSummary } from '@mindmap/shared';

import { useMaps, useCreateMap, useUpdateMap, useDeleteMap } from '@/api/maps.js';
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
    return <p className="p-6 text-[#7a7a83]">Carregando…</p>;
  }
  if (isError) {
    return <p className="p-6 text-[#ef7b7b]">Erro ao carregar mapas</p>;
  }

  const maps = data?.maps ?? [];
  const total = maps.length;
  const visibleMaps = filterAndSortMaps(maps, query, sort);

  const countLabel = `${total} ${total === 1 ? 'mapa' : 'mapas'}`;
  const noMapsAtAll = total === 0;
  const noResults = total > 0 && visibleMaps.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(120%_80%_at_50%_-10%,#18181d_0%,#111114_55%)] text-[#e7e7ea]">
      <header className="flex items-center justify-between border-b border-[#232329] px-8 py-[18px]">
        <div className="flex items-center gap-[11px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(140deg,#7c7cf0,#5b5be0)] shadow-[0_2px_10px_rgba(99,99,230,0.35)]">
            <div className="h-[7px] w-[7px] rounded-full bg-white" />
          </div>
          <span className="text-base font-bold tracking-[-0.01em]">Mapas mentais</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-8 pt-10 pb-16">
        <div className="mb-[26px] flex items-end justify-between gap-5">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.02em]">Meus Mapas</h1>
            <p className="mt-[5px] text-[13.5px] text-[#7a7a83]">{countLabel}</p>
          </div>
          <button
            type="button"
            data-testid="new-map-button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-[10px] bg-[#5b5be0] px-[17px] py-[11px] text-sm font-semibold text-white shadow-[0_4px_14px_rgba(91,91,224,0.32)] transition-colors hover:bg-[#6a6aeb]"
          >
            <span className="-mt-px text-[17px] leading-none">+</span> Novo mapa
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] max-w-[340px] flex-1 items-center gap-[9px] rounded-[10px] border border-[#2a2a31] bg-[#1a1a1f] px-[13px] py-[9px]">
            <SearchIcon />
            <input
              data-testid="map-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mapas"
              className="w-full border-none bg-transparent text-[13.5px] text-[#e7e7ea] placeholder:text-[#5a5a63] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-[7px]" data-testid="map-sort">
            <span className="mr-0.5 text-xs text-[#62626b]">Ordenar:</span>
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
                      ? 'border-[#42426e] bg-[#26264a] text-[#b9b9f4]'
                      : 'border-[#2a2a31] bg-[#1a1a1f] text-[#9a9aa3] hover:text-[#cfcfd6]',
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
            subtitle="Crie seu primeiro mapa mental para organizar suas ideias."
            onCreate={() => setCreating(true)}
          />
        ) : noResults ? (
          <EmptyState
            title="Nada encontrado"
            subtitle="Tente outro termo de busca."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMaps.map((map) =>
              renamingId === map.id ? (
                <div
                  key={map.id}
                  className="rounded-[14px] border border-[#3a3a55] bg-[#17171c] px-4 py-4"
                >
                  <RenameMapInput
                    initialTitle={map.title}
                    onConfirm={(title) => updateMap({ id: map.id, body: { title } })}
                    onCancel={() => setRenamingId(null)}
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
  <div className="relative h-[14px] w-[14px] shrink-0 rounded-full border-[1.6px] border-[#6b6b74]">
    <div className="absolute -right-1 -bottom-0.5 h-[1.6px] w-[6px] rotate-45 rounded-[2px] bg-[#6b6b74]" />
  </div>
);

type EmptyStateProps = {
  title: string;
  subtitle: string;
  onCreate?: () => void;
};

const EmptyState = ({ title, subtitle, onCreate }: EmptyStateProps) => (
  <div className="rounded-[16px] border border-dashed border-[#2c2c33] bg-[#15151a] px-5 py-[72px] text-center">
    <div className="mx-auto mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-[13px] border border-[#2e2e36] bg-[#1f1f26]">
      <div className="h-2 w-2 rounded-full bg-[#5b5be0]" />
    </div>
    <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
    <p className="mb-[18px] text-[13.5px] text-[#7a7a83]">{subtitle}</p>
    {onCreate && (
      <button
        type="button"
        onClick={onCreate}
        className="rounded-[10px] bg-[#5b5be0] px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#6a6aeb]"
      >
        + Criar primeiro mapa
      </button>
    )}
  </div>
);
