import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapSummary } from '@mindmap/shared';

import { useMaps, useCreateMap, useUpdateMap, useDeleteMap } from '@/api/maps.js';
import { AppHeader } from '@/components/AppHeader.js';
import { BrandMark } from '@/components/BrandMark.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button.js';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group.js';
import { cn } from '@/lib/mergeClasses.js';
import { MapCard } from './components/MapCard.js';
import { CreateMapModal } from './components/CreateMapModal.js';
import { RenameMapInput } from './components/RenameMapInput.js';
import { filterAndSortMaps, type MapSort } from './components/map-sort.js';
import { EmptyState } from './components/EmptyState.js';

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        left={
          <>
            <BrandMark size={28} glow />
            <div className="flex items-center gap-2">
              <span className="font-heading text-base font-bold tracking-[0.12em] uppercase">
                KAOS
              </span>
              <span className="h-4 w-px bg-border" />
              <span className="font-mono text-xs text-fg-subtle">mapas mentais</span>
            </div>
          </>
        }
      />

      <main className="mx-auto w-full max-w-270 flex-1 px-8 pt-10 pb-16">
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-[-0.02em]">Meus Mapas</h1>
            <p className="mt-1 font-mono text-xs text-fg-subtle">{countLabel}</p>
          </div>
          <Button
            type="button"
            data-testid="new-map-button"
            onClick={() => setCreating(true)}
            className="h-auto gap-2 rounded-md px-4 py-3 text-sm font-semibold shadow-sm hover:bg-primary-hover"
          >
            <PlusIcon className="size-4" /> Novo mapa
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <InputGroup className="h-auto min-w-55 max-w-85 flex-1 rounded-md border-border bg-card">
            <InputGroupAddon align="inline-start">
              <MagnifyingGlassIcon className="size-3.5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              data-testid="map-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mapas"
              className="py-2 text-sm text-foreground placeholder:text-fg-faint"
            />
          </InputGroup>
          <div className="flex items-center gap-2" data-testid="map-sort">
            <span className="mr-0.5 font-mono text-xs text-fg-faint">Ordenar:</span>
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  aria-pressed={active}
                  onClick={() => setSort(option.value)}
                  className={cn(
                    'h-auto rounded-lg border px-3 py-2 text-xs font-medium',
                    active
                      ? 'border-primary/50 bg-primary/5 text-primary hover:bg-primary/5 hover:text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-card hover:text-foreground',
                  )}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        {noMapsAtAll ? (
          <EmptyState
            title="Nenhum mapa por aqui"
            subtitle="Crie seu primeiro mapa e comece a dar estrutura às ideias."
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
                <div key={map.id} className="rounded-md border border-border bg-card px-4 py-4">
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
