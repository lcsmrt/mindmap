export interface ColorSwatch {
  hex: string;
  name: string;
}

export const BG_PALETTE: readonly ColorSwatch[] = [
  { hex: '#fecaca', name: 'Vermelho claro' },
  { hex: '#fed7aa', name: 'Laranja claro' },
  { hex: '#fef08a', name: 'Amarelo claro' },
  { hex: '#bbf7d0', name: 'Verde claro' },
  { hex: '#bfdbfe', name: 'Azul claro' },
  { hex: '#ddd6fe', name: 'Violeta claro' },
  { hex: '#fbcfe8', name: 'Rosa claro' },
  { hex: '#f5f5f4', name: 'Cinza claro' },
  { hex: '#334155', name: 'Cinza escuro' },
  { hex: '#1e293b', name: 'Ardósia' },
] as const;

export const TEXT_PALETTE: readonly ColorSwatch[] = [
  { hex: '#1e293b', name: 'Ardósia' },
  { hex: '#f8fafc', name: 'Branco' },
  { hex: '#dc2626', name: 'Vermelho' },
  { hex: '#16a34a', name: 'Verde' },
  { hex: '#2563eb', name: 'Azul' },
  { hex: '#7c3aed', name: 'Violeta' },
  { hex: '#ea580c', name: 'Laranja' },
  { hex: '#db2777', name: 'Rosa' },
] as const;
