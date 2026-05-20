import { describe, it, expect } from 'vitest';
import { ApiError } from './_request.js';

describe('ApiError', () => {
  it('expõe status numérico', () => {
    const err = new ApiError('not found', 404);
    expect(err.status).toBe(404);
    expect(err.message).toBe('not found');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('shouldRetry (lógica inline nos hooks)', () => {
  function shouldRetry(failureCount: number, error: Error): boolean {
    if (failureCount >= 3) return false;
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
    return true;
  }

  it('retenta em erro 5xx até 3 vezes', () => {
    const err = new ApiError('server error', 500);
    expect(shouldRetry(0, err)).toBe(true);
    expect(shouldRetry(1, err)).toBe(true);
    expect(shouldRetry(2, err)).toBe(true);
    expect(shouldRetry(3, err)).toBe(false);
  });

  it('não retenta em erro 4xx', () => {
    const err = new ApiError('bad request', 400);
    expect(shouldRetry(0, err)).toBe(false);
  });

  it('retenta em erro de rede (Error genérico, sem status)', () => {
    const err = new Error('Failed to fetch');
    expect(shouldRetry(0, err)).toBe(true);
    expect(shouldRetry(2, err)).toBe(true);
    expect(shouldRetry(3, err)).toBe(false);
  });
});
