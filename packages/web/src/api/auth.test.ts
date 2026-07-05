// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { AuthUser } from '@mindmap/shared';
import { ApiError } from './_request.js';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('./_request.js', async () => {
  const actual = await vi.importActual<typeof import('./_request.js')>('./_request.js');
  return { ...actual, request: requestMock };
});

const {
  useSession,
  useSignup,
  useLogin,
  useLogout,
  useUpdateProfile,
  useForgotPassword,
  useResetPassword,
  useValidateResetToken,
} = await import('./auth.js');

const USER: AuthUser = { id: 'u1', email: 'user@example.com', username: 'user', name: 'User' };

function wrapper(queryClient: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

beforeEach(() => {
  requestMock.mockReset();
});

describe('fetchMe (via useSession)', () => {
  it('mapeia 401 para usuário null sem propagar erro', async () => {
    requestMock.mockRejectedValueOnce(new ApiError('Unauthorized', 401));
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSession(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('propaga erros que não são 401', async () => {
    requestMock.mockRejectedValueOnce(new ApiError('Server error', 500));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSession(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    const query = queryClient.getQueryState(['auth', 'me']);
    expect(query?.status).toBe('error');
  });

  it('expõe o usuário autenticado em 200', async () => {
    requestMock.mockResolvedValueOnce(USER);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSession(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toEqual(USER);
  });
});

describe('mutações de auth atualizam o cache', () => {
  it('useSignup envia username e grava o usuário em [auth, me] no sucesso', async () => {
    requestMock.mockResolvedValueOnce(USER);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSignup(), { wrapper: wrapper(queryClient) });
    result.current.mutate({
      email: USER.email,
      username: USER.username,
      password: 'password123',
      name: USER.name,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(USER);
    expect(requestMock).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        body: JSON.stringify({
          email: USER.email,
          username: USER.username,
          password: 'password123',
          name: USER.name,
        }),
      }),
    );
  });

  it('useLogin envia identifier e grava o usuário em [auth, me] no sucesso', async () => {
    requestMock.mockResolvedValueOnce(USER);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useLogin(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ identifier: USER.username, password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(USER);
    expect(requestMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        body: JSON.stringify({ identifier: USER.username, password: 'password123' }),
      }),
    );
  });

  it('useLogout zera [auth, me] e limpa o cache no sucesso', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['auth', 'me'], USER);
    queryClient.setQueryData(['maps'], { maps: [] });

    const { result } = renderHook(() => useLogout(), { wrapper: wrapper(queryClient) });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toBeNull();
    expect(queryClient.getQueryData(['maps'])).toBeUndefined();
  });

  it('useUpdateProfile grava o usuário atualizado em [auth, me] no sucesso', async () => {
    const updated = { ...USER, name: 'Novo Nome' };
    requestMock.mockResolvedValueOnce(updated);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['auth', 'me'], USER);

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ name: 'Novo Nome' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(updated);
  });

  it('useUpdateProfile repassa username quando presente', async () => {
    const updated = { ...USER, username: 'novo-nome' };
    requestMock.mockResolvedValueOnce(updated);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['auth', 'me'], USER);

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ name: USER.name, username: 'novo-nome' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(updated);
    expect(requestMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        body: JSON.stringify({ name: USER.name, username: 'novo-nome' }),
      }),
    );
  });

  it('useUpdateProfile propaga erro sem tocar o cache', async () => {
    requestMock.mockRejectedValueOnce(new ApiError('Server error', 500));
    const queryClient = new QueryClient();
    queryClient.setQueryData(['auth', 'me'], USER);

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ name: 'Novo Nome' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(USER);
  });
});

describe('reset de senha (M21)', () => {
  it('useForgotPassword chama POST /api/auth/forgot-password', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useForgotPassword(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ email: 'user@example.com' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestMock).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('useResetPassword chama POST /api/auth/reset-password', async () => {
    requestMock.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useResetPassword(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ token: 't', password: 'novasenha123', logoutOtherDevices: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestMock).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('useValidateResetToken consulta o endpoint e expõe { valid: true }', async () => {
    requestMock.mockResolvedValueOnce({ valid: true });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useValidateResetToken('abc'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ valid: true });
    expect(requestMock).toHaveBeenCalledWith('/api/auth/reset-password/validate?token=abc');
  });

  it('useValidateResetToken expõe { valid: false } para token inválido (verdict, não erro)', async () => {
    requestMock.mockResolvedValueOnce({ valid: false });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useValidateResetToken('bad'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ valid: false });
  });

  it('useValidateResetToken propaga falha real de rede (500)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError('Server error', 500));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useValidateResetToken('boom'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useValidateResetToken fica desabilitado sem token', async () => {
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useValidateResetToken(''), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(requestMock).not.toHaveBeenCalled();
  });
});
