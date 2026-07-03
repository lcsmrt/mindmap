import { cn } from '@/lib/mergeClasses.js';

interface BrandMarkProps {
  size?: number;
  color?: string;
  glow?: boolean;
  className?: string;
}

export function BrandMark({ size = 32, color, glow = false, className }: BrandMarkProps) {
  return (
    <div
      className={cn('shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color ?? 'var(--color-brand)',
        maskImage: 'url(/kaos-sigil.svg)',
        WebkitMaskImage: 'url(/kaos-sigil.svg)',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        filter: glow ? 'drop-shadow(0 0 8px var(--color-brand))' : undefined,
      }}
      aria-hidden="true"
    />
  );
}
