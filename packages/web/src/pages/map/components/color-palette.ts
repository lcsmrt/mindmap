export interface ColorSwatch {
  hex: string;
  name: string;
}

/**
 * Background palette aligned to the M10 study export ("Estudo de Nos.dc.html",
 * the `BG` map). The export's `default` tone is represented here by the `null`
 * ("Padrão") swatch rendered by `ColorSwatchGrid`, so it is not listed.
 * Legacy hexes persisted before this alignment still render (the swatch simply
 * won't show as selected); AD-005 preserved (fixed palette, no free picker).
 */
export const BG_PALETTE: readonly ColorSwatch[] = [
  { hex: '#f4b8b8', name: 'Vermelho claro' },
  { hex: '#f3c592', name: 'Laranja claro' },
  { hex: '#f1e29a', name: 'Amarelo claro' },
  { hex: '#b6e6c1', name: 'Verde claro' },
  { hex: '#bcd0f2', name: 'Azul claro' },
  { hex: '#dcc8f6', name: 'Lilás claro' },
  { hex: '#f4c2da', name: 'Rosa claro' },
  { hex: '#ececec', name: 'Branco' },
  { hex: '#7c93b3', name: 'Aço' },
  { hex: '#2f3e57', name: 'Azul-marinho' },
] as const;

/**
 * Text palette aligned to the study export (the `TEXT` map). The leading
 * "auto" option is represented by `hex: null` and persists `textColor = null`;
 * at render time the effective color is derived from the background via
 * `autoTextColor` (see `contrast.ts`). AD-005 preserved.
 */
export interface TextColorSwatch {
  /** `null` means "auto" — derive from the background luminance at render. */
  hex: string | null;
  name: string;
}

export const TEXT_PALETTE: readonly TextColorSwatch[] = [
  { hex: null, name: 'Automático' },
  { hex: '#2f3e57', name: 'Azul-marinho' },
  { hex: '#ffffff', name: 'Branco' },
  { hex: '#e23b3b', name: 'Vermelho' },
  { hex: '#1f9a44', name: 'Verde' },
  { hex: '#2f6df0', name: 'Azul' },
  { hex: '#8a3fd6', name: 'Violeta' },
  { hex: '#df6f1e', name: 'Laranja' },
  { hex: '#df3b86', name: 'Rosa' },
] as const;
