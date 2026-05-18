import { useState } from 'react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';

type CreateMapFormProps = {
  onSubmit: (title: string) => Promise<unknown>;
  isPending?: boolean;
};

export const CreateMapForm = ({ onSubmit, isPending }: CreateMapFormProps) => {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Título não pode ser vazio');
      return;
    }
    setError('');
    try {
      await onSubmit(title.trim());
      setTitle('');
    } catch {
      setError('Erro ao criar mapa');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <div className="flex flex-col gap-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome do novo mapa"
          className={error ? 'border-red-500' : ''}
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
      <Button type="submit" disabled={isPending}>
        Criar
      </Button>
    </form>
  );
};
