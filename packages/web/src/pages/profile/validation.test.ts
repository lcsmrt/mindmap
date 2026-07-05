import { describe, it, expect } from 'vitest';
import { validateName } from './validation.js';

describe('validateName', () => {
  it('nome válido — sem erro', () => {
    expect(validateName('Alice')).toBeUndefined();
  });

  it('nome vazio — erro', () => {
    expect(validateName('')).toBe('Informe seu nome');
  });

  it('nome só com espaços — erro (trim antes de validar)', () => {
    expect(validateName('   ')).toBe('Informe seu nome');
  });

  it('nome acima de 100 caracteres — erro', () => {
    expect(validateName('a'.repeat(101))).toMatch(/muito longo/);
  });

  it('nome com exatamente 100 caracteres — sem erro', () => {
    expect(validateName('a'.repeat(100))).toBeUndefined();
  });
});
