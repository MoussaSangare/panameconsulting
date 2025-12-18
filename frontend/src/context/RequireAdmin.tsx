import { useState, useEffect, ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface RequireAdminProps {
  children: ReactNode;
  fallbackPath?: string;
}

const RequireAdmin = ({ children, fallbackPath = '/' }: RequireAdminProps) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();
  const [isClientSide, setIsClientSide] = useState(false);

  useEffect(() => {
    setIsClientSide(true);
  }, []);

  // Pendant le chargement
  if (!isClientSide || isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600'></div>
        <span className='ml-3 text-gray-600'>Vérification des permissions...</span>
      </div>
    );
  }

  // Redirection si non authentifié
  if (!isAuthenticated) {
    return (
      <Navigate
        to='/connexion'
        replace
        state={{
          from: location.pathname,
          message: 'Authentification requise pour accéder à cette page',
          isAdminRoute: true,
          redirectAfterLogin: location.pathname,
        }}
      />
    );
  }

  // Validation robuste du rôle admin
  const isAdmin = Boolean(
    user?.role === 'admin' || 
    user?.isAdmin === true
  );

  if (!isAdmin) {
    // Log en développement
    if (import.meta.env.DEV) {
      console.warn(
        `Tentative d'accès non autorisé à ${location.pathname} par l'utilisateur ${user?.email} (rôle: ${user?.role})`
      );
    }

    // Redirection avec message d'erreur
    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{
          error: 'Accès réservé aux administrateurs',
          from: location.pathname,
          severity: 'warning',
        }}
      />
    );
  }

  return <>{children}</>;
};

export default RequireAdmin;