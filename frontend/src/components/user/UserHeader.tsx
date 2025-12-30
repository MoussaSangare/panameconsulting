// UserHeader.tsx
import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, RefreshCw, User, Calendar, FileText } from 'lucide-react';

interface UserHeaderProps {
  title: string;
  subtitle: string;
  pageTitle: string;
  description: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  children?: ReactNode;
}

const pageConfigs = {
  '/mon-profil': {
    title: 'Mon Profil',
    subtitle: 'Gérez vos informations personnelles',
    pageTitle: 'Mon Profil - Paname Consulting',
    description: 'Gérez vos informations personnelles avec Paname Consulting'
  },
  '/mes-rendez-vous': {
    title: 'Mes Rendez-vous',
    subtitle: 'Consultez et gérez vos rendez-vous',
    pageTitle: 'Mes Rendez-vous - Paname Consulting',
    description: 'Consultez et gérez vos rendez-vous avec Paname Consulting'
  },
  '/ma-procedure': {
    title: 'Ma Procédure',
    subtitle: 'Suivez l\'avancement de votre dossier',
    pageTitle: 'Ma Procédure - Paname Consulting',
    description: 'Suivez l\'avancement de votre dossier avec Paname Consulting'
  },
};

const navTabs = [
  {
    id: 'profile',
    label: 'Profil',
    to: '/mon-profil',
    icon: User,
  },
  {
    id: 'rendezvous',
    label: 'RDV',
    to: '/mes-rendez-vous',
    icon: Calendar,
  },
  {
    id: 'procedures',
    label: 'Procédure',
    to: '/ma-procedure',
    icon: FileText,
  },
];

export const UserHeader = ({ 
  title, 
  subtitle, 
  pageTitle, 
  description, 
  isLoading = false, 
  onRefresh,
  children 
}: UserHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const activeTabId = navTabs.find(tab => location.pathname.startsWith(tab.to))?.id || 'rendezvous';

  return (
    <header className='bg-white shadow-lg border-b border-gray-100 fixed top-0 left-0 right-0 z-50'>
      <div className='px-4 py-3'>
        {/* Barre supérieure */}
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <button
              onClick={() => navigate('/')}
              className='p-2 bg-sky-50 rounded-xl hover:bg-sky-100 active:scale-95 transition-all duration-200'
              title="Retour à l'accueil"
              aria-label="Retour à l'accueil"
            >
              <Home className='w-4 h-4 text-sky-600' />
            </button>
            <div className='flex flex-col'>
              <h1 className='text-base font-bold text-gray-900 leading-tight'>
                {title}
              </h1>
              <p className='text-xs text-gray-500'>
                {subtitle}
              </p>
            </div>
          </div>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className='p-2 bg-sky-50 rounded-xl hover:bg-sky-100 active:scale-95 transition-all duration-200 disabled:opacity-50'
              title="Actualiser"
              aria-label="Actualiser"
            >
              <RefreshCw className={`w-4 h-4 text-sky-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className='overflow-x-auto pb-1 no-scrollbar'>
          <nav className='flex gap-1.5 min-w-max'>
            {navTabs.map(tab => {
              const isActive = activeTabId === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 shrink-0 relative ${
                    isActive
                      ? 'bg-linear-to-r from-sky-500 to-sky-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-sky-300 hover:bg-sky-50 active:scale-95'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <tab.icon className={`w-3.5 h-3.5 ${
                    isActive ? 'text-white' : 'text-gray-500'
                  }`} />
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    isActive ? 'text-white' : 'text-gray-700'
                  }`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-0.5 bg-sky-400 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Contenu additionnel */}
        {children && (
          <div className='mt-3'>
            {children}
          </div>
        )}
      </div>

      {/* Effet de séparation */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-sky-100 to-transparent"></div>
    </header>
  );
};

// Hook pour récupérer la configuration de page
export const usePageConfig = () => {
  const location = useLocation();
  
  const getCurrentPageConfig = () => {
    const currentPath = location.pathname;
    
    // Vérifier l'égalité exacte
    if (currentPath in pageConfigs) {
      return pageConfigs[currentPath as keyof typeof pageConfigs];
    }
    
    // Vérifier les chemins qui commencent par
    for (const [path, config] of Object.entries(pageConfigs)) {
      if (currentPath.startsWith(path)) {
        return config;
      }
    }
    
    // Fallback par défaut
    return pageConfigs['/mes-rendez-vous'];
  };

  return getCurrentPageConfig();
};

// Fonction utilitaire pour obtenir la configuration sans hook
export const getPageConfig = (pathname: string) => {
  if (pathname in pageConfigs) {
    return pageConfigs[pathname as keyof typeof pageConfigs];
  }
  
  for (const [path, config] of Object.entries(pageConfigs)) {
    if (pathname.startsWith(path)) {
      return config;
    }
  }
  
  return pageConfigs['/mes-rendez-vous'];
};