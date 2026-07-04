import { describe, it, expect } from 'vitest';
import { ApiError } from '@/api/_request.js';
import { validateAuth, messageForError } from './validation.js';

describe('validateAuth', () => {
  it('não retorna erros para cadastro válido', () => {
    const errors = validateAuth('cadastro', {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'senhaboa123',
    });
    expect(errors).toEqual({});
  });

  it('não retorna erros para login válido', () => {
    const errors = validateAuth('entrar', {
      name: '',
      email: 'ana@example.com',
      password: 'senhaboa123',
    });
    expect(errors).toEqual({});
  });

  it('barra nome vazio só no cadastro', () => {
    const cadastro = validateAuth('cadastro', {
      name: '  ',
      email: 'ana@example.com',
      password: 'senhaboa123',
    });
    expect(cadastro.name).toBeDefined();

    const entrar = validateAuth('entrar', {
      name: '',
      email: 'ana@example.com',
      password: 'senhaboa123',
    });
    expect(entrar.name).toBeUndefined();
  });

  it('barra e-mail malformado', () => {
    const errors = validateAuth('entrar', {
      name: '',
      email: 'nao-e-email',
      password: 'senhaboa123',
    });
    expect(errors.email).toBeDefined();
  });

  it('barra senha com menos de 8 caracteres', () => {
    const errors = validateAuth('entrar', {
      name: '',
      email: 'ana@example.com',
      password: '1234567',
    });
    expect(errors.password).toBeDefined();
  });

  it('aceita senha com exatamente 8 caracteres', () => {
    const errors = validateAuth('entrar', {
      name: '',
      email: 'ana@example.com',
      password: '12345678',
    });
    expect(errors.password).toBeUndefined();
  });
});

describe('messageForError', () => {
  it('mapeia 401 para mensagem única de credenciais incorretas', () => {
    expect(messageForError(new ApiError('Invalid credentials', 401))).toBe(
      'E-mail ou senha incorretos',
    );
  });

  it('mapeia 409 para e-mail já em uso', () => {
    expect(messageForError(new ApiError('Email already exists', 409))).toBe(
      'Este e-mail já está em uso',
    );
  });

  it('não ecoa a string crua do backend', () => {
    const msg401 = messageForError(new ApiError('some raw backend string', 401));
    const msg409 = messageForError(new ApiError('some raw backend string', 409));
    expect(msg401).not.toContain('some raw backend string');
    expect(msg409).not.toContain('some raw backend string');
  });

  it('status desconhecido cai no fallback genérico', () => {
    expect(messageForError(new ApiError('boom', 500))).toBe(
      'Não foi possível concluir. Tente novamente.',
    );
  });

  it('erro não-ApiError cai no fallback genérico', () => {
    expect(messageForError(new Error('network down'))).toBe(
      'Não foi possível concluir. Tente novamente.',
    );
  });
});
