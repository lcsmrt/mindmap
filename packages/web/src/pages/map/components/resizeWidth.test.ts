import { describe, it, expect } from 'vitest';
import { draftWidth, settleWidth } from './resizeWidth.js';

describe('draftWidth', () => {
  it('além do teto aplica resistência elástica (rubber-band), não parede', () => {
    // raw = 580; overshoot 280 * 0.35 = 98 → 398
    expect(draftWidth(180, 400, 300)).toBe(398);
  });

  it('até o teto o movimento é 1:1', () => {
    expect(draftWidth(180, 100, 300)).toBe(280);
  });

  it('respeita o piso mínimo padrão', () => {
    expect(draftWidth(180, -100, 500)).toBe(120);
  });

  it('conteúdo abaixo do mínimo: piso acompanha o teto', () => {
    expect(draftWidth(120, -60, 80)).toBe(80);
  });

  it('arraste dentro do range retorna startWidth + worldDx', () => {
    expect(draftWidth(180, 60, 500)).toBe(240);
  });
});

describe('settleWidth', () => {
  it('passou do fit de uma linha: assenta no teto', () => {
    expect(settleWidth(580, 300)).toBe(300);
  });

  it('aquém do teto: mantém a largura escolhida', () => {
    expect(settleWidth(200, 300)).toBe(200);
  });

  it('conteúdo curto: assenta no teto mesmo abaixo do mínimo', () => {
    expect(settleWidth(120, 80)).toBe(80);
  });
});
