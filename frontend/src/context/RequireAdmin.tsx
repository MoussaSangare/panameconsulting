import { ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface RequireAdminProps {
  children: ReactNode;
  fallbackPath?: string;
}

const RequireAdmin = ({ children, fallbackPath = '/' }: RequireAdminProps) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to='/connexion' replace state={{ from: location.pathname }} />;
  }

  if (!user?.isAdmin && user?.role !== 'admin') {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;