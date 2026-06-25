/**
 * Contrast / luminance utilities ported from the M10 study export
 * ("Estudo de Nos.dc.html"). Uses the standard WCAG relative-luminance and
 * contrast-ratio formulas.
 */

/** Light text tone used over dark backgrounds (from the study export). */
const AUTO_TEXT_LIGHT = '#ededf2';
/** Dark text tone used over light backgrounds (from the study export). */
const AUTO_TEXT_DARK = '#23232a';

/** Parse a `#rgb` or `#rrggbb` hex string into `[r, g, b]` (0-255). */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

/** Linearize an sRGB channel (0-255) to its WCAG linear component. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a color. Accepts `#rgb` or `#rrggbb`. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  );
}

/** WCAG contrast ratio between two colors (>= 1). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** True when the background color is dark (relative luminance < 0.4). */
export function isDarkBg(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

/** Pick a readable text color (light on dark bg, dark on light bg). */
export function autoTextColor(bgHex: string): string {
  return isDarkBg(bgHex) ? AUTO_TEXT_LIGHT : AUTO_TEXT_DARK;
}

export type ContrastLevel = 'good' | 'ok' | 'bad';

export interface ContrastVerdict {
  label: string;
  level: ContrastLevel;
}

/** Map a contrast ratio to a human-readable verdict. */
export function contrastVerdict(ratio: number): ContrastVerdict {
  if (ratio >= 4.5) return { label: 'Boa leitura', level: 'good' };
  if (ratio >= 3) return { label: 'Razoável', level: 'ok' };
  return { label: 'Contraste baixo', level: 'bad' };
}
