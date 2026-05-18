import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMaps, useCreateMap, useUpdateMap, useDeleteMap } from '@/api/maps.js';
import { CreateMapForm } from '@/components/CreateMapForm.js';
import { RenameMapInput } from '@/components/RenameMapInput.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import type { MapSummary } from '@mindmap/shared';

const fmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const HomePage = () => {
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MapSummary | null>(null);

  const { data, isLoading, isError } = useMaps();
  const { mutateAsync: createMap, isPending: isCreating } = useCreateMap();
  const { mutateAsync: updateMap } = useUpdateMap();
  const { mutate: deleteMap } = useDeleteMap({
    onSuccess: () => setDeleteTarget(null),
  });

  if (isLoading) return <p className="p-4 text-slate-500">Carregando…</p>;
  if (isError) return <p className="p-4 text-red-500">Erro ao carregar mapas</p>;

  const maps = data?.maps ?? [];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Meus Mapas</h1>

      <div className="mb-6">
        <CreateMapForm
          onSubmit={(title) => createMap({ title })}
          isPending={isCreating}
        />
      </div>

      {maps.length === 0 ? (
        <p className="text-slate-500">Nenhum mapa encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {maps.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xs"
            >
              {renamingId === m.id ? (
                <RenameMapInput
                  initialTitle={m.title}
                  onConfirm={(title) => updateMap({ id: m.id, body: { title } })}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <button
                  type="button"
                  className="flex-1 text-left text-sm font-medium text-slate-800 hover:text-slate-600"
                  onClick={() => navigate(`/maps/${m.id}`)}
                >
                  {m.title}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {fmt.format(new Date(m.updatedAt))}
                  </span>
                </button>
              )}
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-600"
                onClick={() => setRenamingId(m.id)}
              >
                Renomear
              </button>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-600"
                onClick={() => setDeleteTarget(m)}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir mapa"
        message={`Tem certeza? O mapa «${deleteTarget?.title ?? ''}» e todos os seus nós serão removidos permanentemente.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => deleteTarget && deleteMap(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
};
