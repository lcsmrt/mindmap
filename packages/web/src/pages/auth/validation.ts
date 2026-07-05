import { ApiError } from '@/api/_request.js';

export type AuthMode = 'entrar' | 'cadastro';

export interface AuthFormValues {
  name: string;
  email: string;
  password: string;
}

export interface AuthFieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function validateAuth(mode: AuthMode, values: AuthFormValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (mode === 'cadastro' && values.name.trim().length === 0) {
    errors.name = 'Informe seu nome';
  }

  if (!isValidEmail(values.email)) {
    errors.email = 'E-mail inválido';
  }

  if (values.password.length < 8) {
    errors.password = 'A senha precisa ter no mínimo 8 caracteres';
  }

  return errors;
}

export function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'E-mail ou senha incorretos';
    if (error.status === 409) return 'Este e-mail já está em uso';
  }
  return 'Não foi possível concluir. Tente novamente.';
}
