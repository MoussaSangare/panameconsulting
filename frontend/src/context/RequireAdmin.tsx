import { useState, useEffect, ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Définition de l'interface RequireAdminProps
interface RequireAdminProps {
  children: ReactNode;
  fallbackPath?: string;
  requiredRole?: 'admin';
}

const RequireAdmin = ({ children, fallbackPath = '/' }: RequireAdminProps) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // Éviter le rendu côté serveur
  const [isClientSide, setIsClientSide] = useState(false);
  useEffect(() => {
    setIsClientSide(true);
  }, []);

  if (!isClientSide || isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600'></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to='/connexion'
        replace
        state={{
          from: location.pathname,
          message: 'Authentification requise pour accéder à cette page',
          isAdminRoute: true,
        }}
      />
    );
  }

  // Validation UNIQUE et robuste du rôle admin
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin === true);

  if (!isAdmin) {
    // Utilisation de console.warn uniquement en développement
    if (import.meta.env.DEV) {
      console.warn(
        `Tentative d'accès non autorisé à ${location.pathname} par l'utilisateur ${user?.email}`
      );
    }

    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{
          error: 'Accès réservé aux administrateurs',
          from: location.pathname,
        }}
      />
    );
  }

  return <>{children}</>;
};

export default RequireAdmin;
