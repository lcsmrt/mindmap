import { describe, it, expect } from 'vitest';
import { ApiError } from '@/api/_request.js';
import {
  validateAuth,
  validateUsername,
  validateResetPassword,
  messageForError,
} from './validation.js';

describe('validateAuth', () => {
  it('não retorna erros para cadastro válido', () => {
    const errors = validateAuth('cadastro', {
      name: 'Ana',
      identifier: 'ana@example.com',
      username: 'ana',
      password: 'senhaboa123',
    });
    expect(errors).toEqual({});
  });

  it('não retorna erros para login válido (por e-mail)', () => {
    const errors = validateAuth('entrar', {
      name: '',
      identifier: 'ana@example.com',
      username: '',
      password: 'senhaboa123',
    });
    expect(errors).toEqual({});
  });

  it('não retorna erros para login válido (por username)', () => {
    const errors = validateAuth('entrar', {
      name: '',
      identifier: 'ana',
      username: '',
      password: 'senhaboa123',
    });
    expect(errors).toEqual({});
  });

  it('barra nome vazio só no cadastro', () => {
    const cadastro = validateAuth('cadastro', {
      name: '  ',
      identifier: 'ana@example.com',
      username: 'ana',
      password: 'senhaboa123',
    });
    expect(cadastro.name).toBeDefined();

    const entrar = validateAuth('entrar', {
      name: '',
      identifier: 'ana@example.com',
      username: '',
      password: 'senhaboa123',
    });
    expect(entrar.name).toBeUndefined();
  });

  it('barra username inválido só no cadastro', () => {
    const cadastro = validateAuth('cadastro', {
      name: 'Ana',
      identifier: 'ana@example.com',
      username: '-ana-',
      password: 'senhaboa123',
    });
    expect(cadastro.username).toBeDefined();

    const entrar = validateAuth('entrar', {
      name: '',
      identifier: 'ana',
      username: '-ana-',
      password: 'senhaboa123',
    });
    expect(entrar.username).toBeUndefined();
  });

  it('barra e-mail malformado no cadastro', () => {
    const errors = validateAuth('cadastro', {
      name: 'Ana',
      identifier: 'nao-e-email',
      username: 'ana',
      password: 'senhaboa123',
    });
    expect(errors.identifier).toBeDefined();
  });

  it('login aceita identifier não-email sem checar formato', () => {
    const errors = validateAuth('entrar', {
      name: '',
      identifier: 'nao-e-email',
      username: '',
      password: 'senhaboa123',
    });
    expect(errors.identifier).toBeUndefined();
  });

  it('barra identifier vazio no login', () => {
    const errors = validateAuth('entrar', {
      name: '',
      identifier: '   ',
      username: '',
      password: 'senhaboa123',
    });
    expect(errors.identifier).toBeDefined();
  });

  it('barra senha com menos de 8 caracteres', () => {
    const errors = validateAuth('entrar', {
      name: '',
      identifier: 'ana@example.com',
      username: '',
      password: '1234567',
    });
    expect(errors.password).toBeDefined();
  });

  it('aceita senha com exatamente 8 caracteres', () => {
    const errors = validateAuth('entrar', {
      name: '',
      identifier: 'ana@example.com',
      username: '',
      password: '12345678',
    });
    expect(errors.password).toBeUndefined();
  });
});

describe('validateUsername', () => {
  it.each(['ab', 'a-b-c', 'a'.repeat(39), 'Lucas'])('aceita "%s"', (value) => {
    expect(validateUsername(value)).toBeUndefined();
  });

  it('normaliza maiúsculas antes de validar', () => {
    expect(validateUsername('Lucas')).toBeUndefined();
  });

  it.each(['', '   ', '-x', 'x-', 'a--b', 'x_y', 'a'.repeat(40)])('rejeita "%s"', (value) => {
    expect(validateUsername(value)).toBeDefined();
  });
});

describe('validateResetPassword', () => {
  it('sem erros quando a senha tem 8+ e a confirmação bate', () => {
    expect(validateResetPassword({ password: 'novasenha123', confirm: 'novasenha123' })).toEqual({});
  });

  it('barra senha com menos de 8 caracteres', () => {
    const errors = validateResetPassword({ password: '1234567', confirm: '1234567' });
    expect(errors.password).toBeDefined();
  });

  it('barra confirmação diferente da senha', () => {
    const errors = validateResetPassword({ password: 'novasenha123', confirm: 'outrasenha123' });
    expect(errors.confirm).toBeDefined();
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
