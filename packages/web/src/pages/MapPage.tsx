import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MapDetail } from '@mindmap/shared';
import { getMap } from '../api/maps.js';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; map: MapDetail }
  | { kind: 'not_found' }
  | { kind: 'error' };

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!id) return;
    getMap(id)
      .then((map) => setState({ kind: 'ok', map }))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '';
        setState({ kind: msg.includes('404') || msg.includes('Map not found') ? 'not_found' : 'error' });
      });
  }, [id]);

  if (state.kind === 'loading') return <p>Carregando…</p>;

  if (state.kind === 'not_found') {
    return (
      <>
        <p>Mapa não encontrado.</p>
        <Link to="/">← Voltar para mapas</Link>
      </>
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        <p>Erro ao carregar mapa.</p>
        <Link to="/">← Voltar para mapas</Link>
      </>
    );
  }

  return (
    <>
      <h1>{state.map.title}</h1>
      <div
        style={{
          border: '2px dashed #ccc',
          background: '#f9f9f9',
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          margin: '16px 0',
        }}
      >
        Canvas — em breve
      </div>
      <Link to="/">← Voltar para mapas</Link>
    </>
  );
}
