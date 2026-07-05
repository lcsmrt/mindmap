import { PlusIcon } from '@phosphor-icons/react';
import { BrandMark } from '@/components/BrandMark.js';
import { Button } from '@/components/ui/button.js';

type EmptyStateProps = {
  title: string;
  subtitle: string;
  onCreate?: () => void;
  onClear?: () => void;
};

export const EmptyState = ({ title, subtitle, onCreate, onClear }: EmptyStateProps) => (
  <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card px-5 py-18 text-center">
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <BrandMark size={220} className="opacity-[0.04]" />
    </div>
    <div className="relative">
      <h3 className="mb-1.5 font-heading text-base font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>
      {onCreate && (
        <Button
          type="button"
          onClick={onCreate}
          className="h-auto gap-2 rounded-md px-4 py-2.5 text-sm font-semibold hover:bg-primary-hover"
        >
          <PlusIcon className="size-4" />
          Criar primeiro mapa
        </Button>
      )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          className="h-auto rounded-md px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent"
        >
          Limpar busca
        </Button>
      )}
    </div>
  </div>
);
