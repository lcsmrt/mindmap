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

const { useSession, useSignup, useLogin, useLogout } = await import('./auth.js');

const USER: AuthUser = { id: 'u1', email: 'user@example.com', name: 'User' };

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
  it('useSignup grava o usuário em [auth, me] no sucesso', async () => {
    requestMock.mockResolvedValueOnce(USER);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSignup(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ email: USER.email, password: 'password123', name: USER.name });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(USER);
  });

  it('useLogin grava o usuário em [auth, me] no sucesso', async () => {
    requestMock.mockResolvedValueOnce(USER);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useLogin(), { wrapper: wrapper(queryClient) });
    result.current.mutate({ email: USER.email, password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['auth', 'me'])).toEqual(USER);
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
});
