import { describe, it, expect } from 'vitest';
import { nextHeights } from './useMeasuredHeights.js';

describe('nextHeights', () => {
  it('altura nova ⇒ novo Map com o valor arredondado', () => {
    const prev: ReadonlyMap<string, number> = new Map();
    const next = nextHeights(prev, 'a', 40.4);
    expect(next).not.toBe(prev);
    expect(next.get('a')).toBe(40);
  });

  it('mesma altura (após arredondar) ⇒ mesma referência de Map', () => {
    const prev: ReadonlyMap<string, number> = new Map([['a', 40]]);
    // 40.3 → round 40 == valor atual → identidade preservada (segura o useMemo do layout)
    expect(nextHeights(prev, 'a', 40.3)).toBe(prev);
  });

  it('altura diferente ⇒ novo Map preservando as demais entradas', () => {
    const prev: ReadonlyMap<string, number> = new Map([
      ['a', 40],
      ['b', 79],
    ]);
    const next = nextHeights(prev, 'a', 52);
    expect(next).not.toBe(prev);
    expect(next.get('a')).toBe(52);
    expect(next.get('b')).toBe(79);
  });

  it('arredonda para o inteiro mais próximo (jitter sub-pixel não cria novo Map à toa)', () => {
    const prev: ReadonlyMap<string, number> = new Map([['a', 40]]);
    // 39.5 → Math.round 40 == valor atual ⇒ mesma referência (sem relayout espúrio)
    expect(nextHeights(prev, 'a', 39.5)).toBe(prev);
    // 40.6 → 41 ≠ 40 ⇒ novo Map com a altura atualizada
    expect(nextHeights(prev, 'a', 40.6).get('a')).toBe(41);
  });
});
