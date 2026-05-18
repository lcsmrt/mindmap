import { useState } from 'react';

interface CreateMapFormProps {
  onSubmit: (title: string) => Promise<void>;
}

export default function CreateMapForm({ onSubmit }: CreateMapFormProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Título não pode ser vazio');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(title.trim());
      setTitle('');
    } catch {
      setError('Erro ao criar mapa');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nome do novo mapa"
        style={{ borderColor: error ? 'red' : undefined }}
      />
      <button type="submit" disabled={submitting}>
        Criar
      </button>
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
    </form>
  );
}
