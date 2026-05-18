import { Link, useParams } from 'react-router-dom';
import { useMap } from '@/api/maps.js';

export const MapPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading, isError, error } = useMap(id);

  if (isLoading) return <p className="p-4 text-slate-500">Carregando…</p>;

  if (isError) {
    const isNotFound = error instanceof Error && error.message.includes('Map not found');
    return (
      <div className="p-6">
        <p className="mb-4 text-slate-700">
          {isNotFound ? 'Mapa não encontrado.' : 'Erro ao carregar mapa.'}
        </p>
        <Link to="/" className="text-sm text-slate-500 underline hover:text-slate-700">
          ← Voltar para mapas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 px-6 py-3">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← Mapas
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">{map?.title}</h1>
      </header>

      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <p className="text-slate-400">Canvas — em breve</p>
      </div>
    </div>
  );
};
