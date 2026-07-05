import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/api/auth.js';
import { AuthSplash } from './AuthSplash.js';
import { resolveReturnTo } from './returnTo.js';

type RedirectIfAuthedProps = {
  children: React.ReactNode;
};

export const RedirectIfAuthed = ({ children }: RedirectIfAuthedProps) => {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <AuthSplash />;

  if (user) return <Navigate to={resolveReturnTo(location)} replace />;

  return <>{children}</>;
};
