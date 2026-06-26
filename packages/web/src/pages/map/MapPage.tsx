import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useMap } from '@/api/maps.js';
import { MapCanvas } from './components/MapCanvas.js';

export const MapPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: map, isLoading, isError, error } = useMap(id);

  if (isLoading) return <p className="p-4 text-muted-foreground">Carregando…</p>;

  if (isError) {
    const isNotFound = error instanceof Error && error.message.includes('Map not found');
    return (
      <div className="p-6">
        <p className="mb-4 text-foreground">
          {isNotFound ? 'Mapa não encontrado.' : 'Erro ao carregar mapa.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para mapas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mapas
        </Link>
        <h1 className="text-lg font-semibold text-foreground">{map?.title}</h1>
      </header>

      <div className="flex flex-1 h-0">
        <MapCanvas mapId={id!} />
      </div>
    </div>
  );
};
