import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { canAccessView, pathToView, type UserRole } from '@/lib/rbac';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const view = pathToView(location.pathname);
  const role = user.role as UserRole;

  if (!view || !canAccessView(role, view)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
