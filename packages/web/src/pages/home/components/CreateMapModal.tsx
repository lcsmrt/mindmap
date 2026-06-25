import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';

type CreateMapModalProps = {
  open: boolean;
  isPending: boolean;
  onCreate: (title: string) => void;
  onClose: () => void;
};

export const CreateMapModal = ({ open, isPending, onCreate, onClose }: CreateMapModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo mapa</DialogTitle>
          <DialogDescription>Dê um nome para começar a mapear.</DialogDescription>
        </DialogHeader>
        {open && <CreateMapModalForm isPending={isPending} onCreate={onCreate} />}
      </DialogContent>
    </Dialog>
  );
};

type CreateMapModalFormProps = {
  isPending: boolean;
  onCreate: (title: string) => void;
};

const CreateMapModalForm = ({ isPending, onCreate }: CreateMapModalFormProps) => {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ex.: Arquitetura do produto"
        autoFocus
      />
      <DialogFooter>
        <DialogClose
          render={<Button type="button" variant="outline" disabled={isPending} />}
        >
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={isPending || !title.trim()}>
          {isPending ? 'Criando…' : 'Criar mapa'}
        </Button>
      </DialogFooter>
    </form>
  );
};
