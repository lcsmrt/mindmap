import { ProhibitIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/mergeClasses.js';
import type { ColorSwatch } from './color-palette.js';

interface ColorSwatchGridProps {
  label: string;
  colors: readonly ColorSwatch[];
  value: string | null;
  onSelect: (color: string | null) => void;
}

export function ColorSwatchGrid({ label, colors, value, onSelect }: ColorSwatchGridProps) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'h-7 w-7 rounded-full border border-border p-0 hover:bg-transparent',
            value === null && 'ring-2 ring-primary ring-offset-2',
          )}
          onClick={() => onSelect(null)}
          aria-label="Padrão"
        >
          <ProhibitIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        {colors.map((swatch) => (
          <Button
            key={swatch.hex}
            type="button"
            variant="ghost"
            className={cn(
              'h-7 w-7 rounded-full border border-border p-0',
              value === swatch.hex && 'ring-2 ring-primary ring-offset-2',
            )}
            style={{ backgroundColor: swatch.hex }}
            onClick={() => onSelect(swatch.hex)}
            aria-label={swatch.name}
          />
        ))}
      </div>
    </div>
  );
}
