import { describe, it, expect } from 'vitest';
import { clampWidth } from './clampWidth.js';

describe('clampWidth', () => {
  it('dentro do range retorna startWidth + worldDx', () => {
    expect(clampWidth(180, 60, 120, 500)).toBe(240);
  });

  it('respeita o piso mínimo', () => {
    expect(clampWidth(180, -100, 120, 500)).toBe(120);
  });

  it('respeita o teto máximo', () => {
    expect(clampWidth(180, 400, 120, 500)).toBe(500);
  });

  it('faixa degenerada (teto < piso) colapsa no piso', () => {
    expect(clampWidth(180, 100, 120, 80)).toBe(120);
  });

  it('worldDx negativo pequeno permanece dentro do range', () => {
    expect(clampWidth(200, -30, 120, 500)).toBe(170);
  });
});
