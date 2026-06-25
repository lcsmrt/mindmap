import { describe, expect, it } from 'vitest';
import {
  autoTextColor,
  contrastRatio,
  contrastVerdict,
  isDarkBg,
  relativeLuminance,
} from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('accepts #rgb shorthand equivalently to #rrggbb', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 10);
    expect(relativeLuminance('#000')).toBe(relativeLuminance('#000000'));
  });
});

describe('contrastRatio', () => {
  it('white on white is ~1 (no contrast)', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });

  it('black on white is the maximum 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#001f3f', '#b6e6c1')).toBeCloseTo(
      contrastRatio('#b6e6c1', '#001f3f'),
      10,
    );
  });

  it('navy text on light green is high contrast (>= 4.5)', () => {
    // navy #001f3f over light green #b6e6c1 (green tone from the export)
    expect(contrastRatio('#001f3f', '#b6e6c1')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrastVerdict', () => {
  it('white on white -> bad (ratio ~1)', () => {
    expect(contrastVerdict(contrastRatio('#ffffff', '#ffffff'))).toEqual({
      label: 'Contraste baixo',
      level: 'bad',
    });
  });

  it('high-contrast real pair -> good', () => {
    expect(contrastVerdict(contrastRatio('#001f3f', '#b6e6c1'))).toEqual({
      label: 'Boa leitura',
      level: 'good',
    });
  });

  it('good/ok boundary at exactly 4.5', () => {
    expect(contrastVerdict(4.5)).toEqual({ label: 'Boa leitura', level: 'good' });
    expect(contrastVerdict(4.49)).toEqual({ label: 'Razoável', level: 'ok' });
  });

  it('ok/bad boundary at exactly 3', () => {
    expect(contrastVerdict(3)).toEqual({ label: 'Razoável', level: 'ok' });
    expect(contrastVerdict(2.99)).toEqual({ label: 'Contraste baixo', level: 'bad' });
  });
});

describe('isDarkBg', () => {
  it('returns true for a dark background', () => {
    expect(isDarkBg('#1a1a20')).toBe(true);
  });

  it('returns false for a light background', () => {
    expect(isDarkBg('#ececec')).toBe(false);
  });
});

describe('autoTextColor', () => {
  it('returns the light tone over a dark background', () => {
    expect(autoTextColor('#1a1a20')).toBe('#ededf2');
  });

  it('returns the dark tone over a light background', () => {
    expect(autoTextColor('#ececec')).toBe('#23232a');
  });
});
