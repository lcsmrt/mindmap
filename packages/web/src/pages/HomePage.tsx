import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapSummary } from '@mindmap/shared';
import { listMaps, createMap, updateMap } from '../api/maps.js';
import CreateMapForm from '../components/CreateMapForm.js';
import RenameMapInput from '../components/RenameMapInput.js';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; maps: MapSummary[] }
  | { kind: 'error' };

const fmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export default function HomePage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const navigate = useNavigate();

  function load() {
    listMaps()
      .then((res) => setState({ kind: 'ok', maps: res.maps }))
      .catch(() => setState({ kind: 'error' }));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(title: string) {
    await createMap({ title });
    load();
  }

  async function handleRename(id: string, title: string) {
    await updateMap(id, { title });
    load();
  }

  if (state.kind === 'loading') return <p>Carregando…</p>;
  if (state.kind === 'error') return <p>Erro ao carregar mapas</p>;

  const { maps } = state;

  return (
    <main>
      <h1>Meus Mapas</h1>
      <CreateMapForm onSubmit={handleCreate} />
      {maps.length === 0 ? (
        <p>Nenhum mapa encontrado.</p>
      ) : (
        <ul>
          {maps.map((m) => (
            <li key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {renamingId === m.id ? (
                <RenameMapInput
                  initialTitle={m.title}
                  onConfirm={(t) => handleRename(m.id, t)}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <span
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() => navigate(`/maps/${m.id}`)}
                >
                  {m.title} — {fmt.format(new Date(m.updatedAt))}
                </span>
              )}
              <button type="button" onClick={() => setRenamingId(m.id)}>
                Renomear
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
