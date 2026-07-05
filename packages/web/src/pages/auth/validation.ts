import { ApiError } from '@/api/_request.js';

export type AuthMode = 'entrar' | 'cadastro';

export interface AuthFormValues {
  name: string;
  identifier: string;
  username: string;
  password: string;
}

export interface AuthFieldErrors {
  name?: string;
  identifier?: string;
  username?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const USERNAME_MAX_LENGTH = 39;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function validateUsername(username: string): string | undefined {
  const normalized = username.trim().toLowerCase();
  if (normalized.length === 0) return 'Informe um nome de usuário';
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `Nome de usuário muito longo (máx. ${USERNAME_MAX_LENGTH} caracteres)`;
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Use letras minúsculas, números e hífen (não pode começar/terminar com hífen)';
  }
  return undefined;
}

export function validateAuth(mode: AuthMode, values: AuthFormValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (mode === 'cadastro') {
    if (values.name.trim().length === 0) {
      errors.name = 'Informe seu nome';
    }

    const usernameError = validateUsername(values.username);
    if (usernameError) errors.username = usernameError;

    if (!isValidEmail(values.identifier)) {
      errors.identifier = 'E-mail inválido';
    }
  } else if (values.identifier.trim().length === 0) {
    errors.identifier = 'Informe seu usuário ou e-mail';
  }

  if (values.password.length < 8) {
    errors.password = 'A senha precisa ter no mínimo 8 caracteres';
  }

  return errors;
}

export interface ResetPasswordValues {
  password: string;
  confirm: string;
}

export interface ResetPasswordFieldErrors {
  password?: string;
  confirm?: string;
}

export function validateResetPassword(values: ResetPasswordValues): ResetPasswordFieldErrors {
  const errors: ResetPasswordFieldErrors = {};

  if (values.password.length < 8) {
    errors.password = 'A senha precisa ter no mínimo 8 caracteres';
  }

  if (values.confirm !== values.password) {
    errors.confirm = 'As senhas não conferem';
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
