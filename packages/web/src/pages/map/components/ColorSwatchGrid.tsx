import { Ban } from 'lucide-react';
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
        <button
          type="button"
          className={`flex h-7 w-7 items-center justify-center rounded-full border border-border transition-shadow ${
            value === null ? 'ring-2 ring-primary ring-offset-2' : ''
          }`}
          onClick={() => onSelect(null)}
          aria-label="Padrão"
        >
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {colors.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            className={`h-7 w-7 rounded-full border border-border transition-shadow ${
              value === swatch.hex ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            style={{ backgroundColor: swatch.hex }}
            onClick={() => onSelect(swatch.hex)}
            aria-label={swatch.name}
          />
        ))}
      </div>
    </div>
  );
}
