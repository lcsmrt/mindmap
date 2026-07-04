import { Navigate, useLocation, type Location } from 'react-router-dom';
import { useSession } from '@/api/auth.js';
import { AuthSplash } from './AuthSplash.js';

type RedirectIfAuthedProps = {
  children: React.ReactNode;
};

type AuthLocationState = { from?: Location };

export const RedirectIfAuthed = ({ children }: RedirectIfAuthedProps) => {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <AuthSplash />;

  if (user) {
    const state = location.state as AuthLocationState | null;
    const from = state?.from;
    const to = from ? `${from.pathname}${from.search}` : '/';
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
};
