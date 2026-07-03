import { BrandMark } from '@/components/BrandMark.js';
import { Button } from '@/components/ui/button.js';

type EmptyStateProps = {
  title: string;
  subtitle: string;
  onCreate?: () => void;
  onClear?: () => void;
};

export const EmptyState = ({ title, subtitle, onCreate, onClear }: EmptyStateProps) => (
  <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card px-5 py-[72px] text-center">
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <BrandMark size={220} className="opacity-[0.04]" />
    </div>
    <div className="relative">
      <h3 className="mb-1.5 font-heading text-base font-semibold">{title}</h3>
      <p className="mb-[18px] text-[13.5px] text-muted-foreground">{subtitle}</p>
      {onCreate && (
        <Button
          type="button"
          onClick={onCreate}
          className="h-auto rounded-md px-[18px] py-2.5 text-[13.5px] font-semibold hover:bg-primary-hover"
        >
          + Despejar o primeiro mapa
        </Button>
      )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          className="h-auto rounded-md px-[18px] py-2.5 text-[13.5px] font-semibold text-foreground hover:bg-accent"
        >
          Limpar busca
        </Button>
      )}
    </div>
  </div>
);

export const SearchIcon = () => (
  <div className="relative h-[14px] w-[14px] shrink-0 rounded-full border-[1.6px] border-muted-foreground">
    <div className="absolute -right-1 -bottom-0.5 h-[1.6px] w-[6px] rotate-45 rounded-[2px] bg-muted-foreground" />
  </div>
);
