import { describe, it, expect } from 'vitest';
import { sanitizeUsername, uniqueUsername, previewUsernames } from './backfill-username.js';

describe('sanitizeUsername', () => {
  it('minusculiza e mantém [a-z0-9] verbatim', () => {
    expect(sanitizeUsername('Lucas123')).toBe('lucas123');
  });

  it('troca separadores/símbolos por hífen, sem duplicar', () => {
    expect(sanitizeUsername('lucas.martins+dev')).toBe('lucas-martins-dev');
  });

  it('remove acentos', () => {
    expect(sanitizeUsername('joão')).toBe('joao');
  });

  it('remove hífen nas pontas', () => {
    expect(sanitizeUsername('.lucas.')).toBe('lucas');
  });

  it('trunca em 39 chars e não deixa hífen pendurado', () => {
    const long = 'a'.repeat(40) + '-b';
    const result = sanitizeUsername(long);
    expect(result.length).toBeLessThanOrEqual(39);
    expect(result.endsWith('-')).toBe(false);
  });

  it('cai em "user" quando não sobra nenhum char válido', () => {
    expect(sanitizeUsername('@@@')).toBe('user');
  });
});

describe('uniqueUsername', () => {
  it('retorna a base quando livre', () => {
    expect(uniqueUsername('lucas', () => false)).toBe('lucas');
  });

  it('anexa -2 na 1ª colisão, -3 na 2ª', () => {
    const taken = new Set(['lucas', 'lucas-2']);
    expect(uniqueUsername('lucas', (c) => taken.has(c))).toBe('lucas-3');
  });

  it('trunca a base pra caber o sufixo sem passar de 39 chars', () => {
    const base = 'a'.repeat(39);
    const taken = new Set([base]);
    const result = uniqueUsername(base, (c) => taken.has(c));
    expect(result.length).toBeLessThanOrEqual(39);
    expect(result.endsWith('-2')).toBe(true);
  });
});

describe('previewUsernames', () => {
  it('gera um username por usuário, derivado do local-part do e-mail', () => {
    const result = previewUsernames([
      { id: '1', email: 'lucas@mindmap.test' },
      { id: '2', email: 'ana@mindmap.test' },
    ]);
    expect(result).toEqual([
      { id: '1', email: 'lucas@mindmap.test', username: 'lucas' },
      { id: '2', email: 'ana@mindmap.test', username: 'ana' },
    ]);
  });

  it('resolve colisão entre usuários da própria lista, na ordem dada', () => {
    const result = previewUsernames([
      { id: '1', email: 'lucas@a.test' },
      { id: '2', email: 'lucas@b.test' },
    ]);
    expect(result.map((r) => r.username)).toEqual(['lucas', 'lucas-2']);
  });

  it('é determinístico (mesma entrada ⇒ mesma saída)', () => {
    const users = [
      { id: '1', email: 'ana@a.test' },
      { id: '2', email: 'ana@b.test' },
      { id: '3', email: 'bruno@c.test' },
    ];
    expect(previewUsernames(users)).toEqual(previewUsernames(users));
  });
});
