// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RequireAuth } from './RequireAuth.js';

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock('@/api/auth.js', () => ({ useSession: useSessionMock }));

function LoginStub() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return <div>Login page (from: {from?.pathname ?? 'none'})</div>;
}

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginStub />} />
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('renderiza o Outlet quando há sessão', () => {
    useSessionMock.mockReturnValue({ user: { id: 'u1', email: 'a@a.com', name: 'A' }, isLoading: false, isAuthenticated: true });

    renderAt('/protected');

    expect(screen.getByText('Protected content')).toBeTruthy();
  });

  it('redireciona para /login guardando o destino quando não há sessão', () => {
    useSessionMock.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });

    renderAt('/protected');

    expect(screen.getByText('Login page (from: /protected)')).toBeTruthy();
  });
});
