import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapSummary } from '@mindmap/shared';
import { listMaps } from '../api/maps.js';

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
  const navigate = useNavigate();

  useEffect(() => {
    listMaps()
      .then((res) => setState({ kind: 'ok', maps: res.maps }))
      .catch(() => setState({ kind: 'error' }));
  }, []);

  if (state.kind === 'loading') return <p>Carregando…</p>;
  if (state.kind === 'error') return <p>Erro ao carregar mapas</p>;

  const { maps } = state;

  return (
    <main>
      <h1>Meus Mapas</h1>
      {maps.length === 0 ? (
        <p>
          Nenhum mapa encontrado.{' '}
          <button type="button">Criar primeiro mapa</button>
        </p>
      ) : (
        <ul>
          {maps.map((m) => (
            <li
              key={m.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/maps/${m.id}`)}
            >
              {m.title} — {fmt.format(new Date(m.updatedAt))}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
