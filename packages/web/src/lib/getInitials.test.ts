import { describe, it, expect } from 'vitest';
import { getInitials } from './getInitials.js';

describe('getInitials', () => {
  it('1 palavra — 2 primeiras letras maiúsculas', () => {
    expect(getInitials('Alice')).toBe('AL');
  });

  it('2 palavras — 1ª letra de cada, maiúscula', () => {
    expect(getInitials('Alice Silva')).toBe('AS');
  });

  it('3+ palavras — 1ª e última, ignora as do meio', () => {
    expect(getInitials('Alice Maria Silva Santos')).toBe('AS');
  });

  it('espaços extras (início/fim/entre palavras) não afetam o resultado', () => {
    expect(getInitials('  Alice   Silva  ')).toBe('AS');
  });

  it('string vazia ou só espaços — fallback vazio', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });

  it('nomes com acentos preservam a letra acentuada', () => {
    expect(getInitials('Álvaro Ítalo')).toBe('ÁÍ');
  });

  it('palavra única curta (1 caractere) não quebra', () => {
    expect(getInitials('A')).toBe('A');
  });
});
