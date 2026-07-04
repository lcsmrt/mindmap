import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/api/auth.js';
import { AuthSplash } from './AuthSplash.js';

export const RequireAuth = () => {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <AuthSplash />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
};
