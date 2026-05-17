import { useEffect, useState } from 'react';
import type { HealthResponse } from '@mindmap/shared';

type State = { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error' };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setState({ kind: 'ok', data }))
      .catch(() => setState({ kind: 'error' }));
  }, []);

  if (state.kind === 'loading') return <p>Checking…</p>;
  if (state.kind === 'error') return <p>API unreachable</p>;
  return <p>API: {state.data.status} / DB: {state.data.db}</p>;
}
