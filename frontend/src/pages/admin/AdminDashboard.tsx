/* eslint-disable no-undef */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  Mail,
  Globe,
  RefreshCw,
  AlertTriangle,
  Shield,
  BarChart3,
  TrendingUp,
  UserCheck,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react';
import { useDashboardData } from '../../api/admin/AdminDashboardService';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

// Types
interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  regularUsers: number;
  totalProcedures: number;
  proceduresByStatus: { _id: string; count: number }[];
  proceduresByDestination: { _id: string; count: number }[];
  totalRendezvous: number;
  rendezvousStats: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    expired: number;
  };
  totalContacts?: number;
  unreadContacts?: number;
}

interface RecentActivity {
  _id: string;
  type: 'procedure' | 'rendezvous' | 'user' | 'contact';
  action: string;
  description: string;
  timestamp: Date;
  userEmail?: string;
}

// Composant d'icône pour les activités
const ActivityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'procedure':
      return <FileText className='w-5 h-5 text-blue-500' />;
    case 'rendezvous':
      return <Calendar className='w-5 h-5 text-emerald-500' />;
    case 'user':
      return <Users className='w-5 h-5 text-violet-500' />;
    case 'contact':
      return <Mail className='w-5 h-5 text-amber-500' />;
    default:
      return <Clock className='w-5 h-5 text-slate-400' />;
  }
};

const AdminDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const { stats, activities, error, refresh, loading } = useDashboardData();

  // États locaux
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);

  // Références
  const isMountedRef = useRef(true);
  const activitiesContainerRef = useRef<HTMLDivElement>(null);

  // Détection du mode mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Initialisation
  useEffect(() => {
    isMountedRef.current = true;

    const initializeDashboard = async () => {
      if (!isMountedRef.current) return;

      // Vérification des permissions
      if (!isAuthenticated) {
        toast.error('Veuillez vous connecter pour accéder au tableau de bord');
        return;
      }

      if (user?.role !== 'admin') {
        toast.error('Accès refusé. Réservé aux administrateurs.');
        return;
      }

      // Chargement initial des données
      try {
        await refresh();
        setLastRefreshTime(
          new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } catch (err) {
        // Gestion d'erreur silencieuse pour l'initialisation
        if (import.meta.env.DEV) {
          console.error('Erreur lors du chargement initial:', err);
        }
      }
    };

    const initTimer = window.setTimeout(() => {
      initializeDashboard();
    }, 500);

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(initTimer);
    };
  }, [isAuthenticated, user?.role, refresh]);

  // Gestion du rafraîchissement
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      await refresh();

      setLastRefreshTime(
        new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );

      toast.success('Données actualisées avec succès', {
        position: 'top-right',
        autoClose: 2000,
      });
    } catch (err: any) {
      // Gestion d'erreur silencieuse pour le rafraîchissement
      if (import.meta.env.DEV) {
        console.error('Erreur lors du rafraîchissement:', err);
      }
      // Les erreurs sont gérées par le service
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refresh]);

  // Fonction utilitaire pour les données
  const safeFind = (array: any[] | undefined, value: string): number => {
    if (!array || !Array.isArray(array)) return 0;
    const item = array.find(item => item._id === value);
    return item ? item.count : 0;
  };

  // Calculer les pourcentages des rendez-vous
  const getRendezvousPercentage = (value: number): number => {
    const total = stats?.totalRendezvous || 0;
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  // Calculer les pourcentages des procédures
  const getProcedurePercentage = (value: number): number => {
    const total = stats?.totalProcedures || 0;
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  // Formater les dates pour l'affichage
  const formatActivityDate = (timestamp: Date): string => {
    const now = new Date();
    const activityDate = new Date(timestamp);
    const diffInHours = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      // Aujourd'hui
      return `Aujourd'hui ${activityDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else if (diffInHours < 48) {
      // Hier
      return `Hier ${activityDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      // Date complète
      return activityDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Masquer l'email pour la confidentialité
  const maskEmail = (email?: string): string => {
    if (!email) return 'Système';
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    
    if (localPart.length <= 3) {
      return `${localPart}***@${domain}`;
    }
    return `${localPart.substring(0, 3)}...@${domain}`;
  };

  // Vérification des permissions
  if (!isAuthenticated) {
    return null;
  }

  if (user?.role !== 'admin') {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <div className='text-center max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-200'>
          <div className='inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4'>
            <AlertTriangle className='w-8 h-8 text-red-600' />
          </div>
          <div className='text-gray-900 text-xl font-semibold mb-2'>
            Accès restreint
          </div>
          <div className='text-gray-600 mb-6'>
            Cette interface est réservée aux administrateurs du système.
          </div>
          <div className='text-xs text-gray-500 bg-gray-100 rounded-lg p-3'>
            <Shield className='w-3 h-3 inline mr-1' />
            Sécurité renforcée • Audit des accès
          </div>
        </div>
      </div>
    );
  }

  // Gestion des erreurs
  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <div className='text-center max-w-md p-8 bg-white rounded-2xl shadow-lg border border-gray-200'>
          <div className='inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4'>
            <AlertTriangle className='w-8 h-8 text-red-600' />
          </div>
          <div className='text-gray-900 text-xl font-semibold mb-2'>
            Erreur de chargement
          </div>
          <div className='text-gray-600 mb-6'>{error}</div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className='bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 mx-auto'
          >
            <RefreshCw
              size={18}
              className={isRefreshing ? 'animate-spin' : ''}
            />
            {isRefreshing ? 'Rechargement...' : 'Réessayer'}
          </button>
        </div>
      </div>
    );
  }

  // Configuration des cartes de statistiques
  const statCards = [
    {
      title: 'Utilisateurs',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      description: `${stats?.activeUsers || 0} actifs`,
      trend: (stats?.activeUsers || 0) > 0 ? 'positive' : 'neutral',
      detail: `${stats?.inactiveUsers || 0} inactifs`,
    },
    {
      title: 'Rendez-vous',
      value: stats?.totalRendezvous || 0,
      icon: Calendar,
      color: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      description: `${stats?.rendezvousStats?.confirmed || 0} confirmés`,
      trend: 'neutral',
      detail: `${stats?.rendezvousStats?.pending || 0} en attente, ${stats?.rendezvousStats?.expired || 0} expirés`,
    },
    {
      title: 'Procédures',
      value: stats?.totalProcedures || 0,
      icon: FileText,
      color: 'from-violet-500 to-violet-600',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      description: 'En cours et terminées',
      trend: 'neutral',
      detail: `${stats?.proceduresByStatus?.length || 0} statuts distincts`,
    },
    {
      title: 'Administrateurs',
      value: stats?.adminUsers || 0,
      icon: Shield,
      color: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      description: 'Accès sécurisé',
      trend: 'neutral',
      detail: `${stats?.regularUsers || 0} utilisateurs réguliers`,
      isAdmin: true,
    },
    {
      title: 'Messages',
      value: stats?.totalContacts || 0,
      icon: MessageSquare,
      color: 'from-indigo-500 to-indigo-600',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      description: `${stats?.unreadContacts || 0} non lus`,
      trend: (stats?.unreadContacts || 0) > 0 ? 'attention' : 'positive',
      detail: 'Dernières 24h',
    },
    {
      title: 'Système',
      value: 'ACTIF',
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      description: 'Normal',
      trend: 'positive',
      isSystem: true,
    },
  ];

  // Statistiques des procédures - avec compatibilité de casse
  const procedureStatusStats = [
    {
      status: 'En cours',
      value: 
        safeFind(stats?.proceduresByStatus, 'En cours') ||
        safeFind(stats?.proceduresByStatus, 'en cours') ||
        safeFind(stats?.proceduresByStatus, 'En Cours') ||
        0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
    },
    {
      status: 'Terminées',
      value: 
        safeFind(stats?.proceduresByStatus, 'Terminée') ||
        safeFind(stats?.proceduresByStatus, 'terminée') ||
        safeFind(stats?.proceduresByStatus, 'Terminee') ||
        0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      status: 'Refusées',
      value: 
        safeFind(stats?.proceduresByStatus, 'Refusée') ||
        safeFind(stats?.proceduresByStatus, 'refusée') ||
        safeFind(stats?.proceduresByStatus, 'Refusee') ||
        safeFind(stats?.proceduresByStatus, 'Rejetée') ||
        safeFind(stats?.proceduresByStatus, 'rejetée') ||
        0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    {
      status: 'Annulées',
      value: 
        safeFind(stats?.proceduresByStatus, 'Annulée') ||
        safeFind(stats?.proceduresByStatus, 'annulée') ||
        safeFind(stats?.proceduresByStatus, 'Annulee') ||
        safeFind(stats?.proceduresByStatus, 'Canceled') ||
        0,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
  ];

  // Destinations populaires
  const popularDestinations = (stats?.proceduresByDestination || [])
    .slice(0, 5)
    .map(dest => ({
      name: dest._id,
      count: dest.count,
      percentage: getProcedurePercentage(dest.count),
    }));

  // Statut des rendez-vous
  const rendezvousStatuses = [
    {
      status: 'En attente',
      value: stats?.rendezvousStats?.pending || 0,
      color: 'yellow',
    },
    {
      status: 'Confirmés',
      value: stats?.rendezvousStats?.confirmed || 0,
      color: 'blue',
    },
    {
      status: 'Terminés',
      value: stats?.rendezvousStats?.completed || 0,
      color: 'emerald',
    },
    {
      status: 'Annulés',
      value: stats?.rendezvousStats?.cancelled || 0,
      color: 'red',
    },
    {
      status: 'Expirés',
      value: stats?.rendezvousStats?.expired || 0,
      color: 'gray',
    },
  ];

  // Fonction pour faire défiler les activités horizontalement
  const scrollActivities = (direction: 'left' | 'right') => {
    if (activitiesContainerRef.current) {
      const scrollAmount = isMobile ? 250 : 350;
      activitiesContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Tableau de Bord Administrateur - Paname Consulting</title>
        <meta
          name='description'
          content='Interface sécurisée de gestion administrative avec statistiques et contrôles systèmes'
        />
        <meta name='robots' content='noindex, nofollow' />
        <meta name='googlebot' content='noindex, nofollow' />
        <meta name='bingbot' content='noindex, nofollow' />
        <meta name='yandexbot' content='noindex, nofollow' />
        <meta name='duckduckbot' content='noindex, nofollow' />
        <meta name='baidu' content='noindex, nofollow' />
        <meta name='naver' content='noindex, nofollow' />
        <meta name='seznam' content='noindex, nofollow' />
      </Helmet>

      {/* Interface principale */}
      <div className='min-h-screen bg-gray-50'>
        <div className='p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto'>
          {/* En-tête amélioré */}
          <div className='bg-white rounded-2xl shadow-lg p-4 md:p-6 lg:p-8 border border-gray-200'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6'>
              <div className='space-y-3'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md'>
                    <Shield className='w-5 h-5 md:w-6 md:h-6 text-white' />
                  </div>
                  <div>
                    <h1 className='text-xl md:text-2xl lg:text-3xl font-bold text-gray-900'>
                      Tableau de Bord
                    </h1>
                    <div className='flex flex-wrap items-center gap-2 mt-1'>
                      <div className='flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium'>
                        <Shield size={12} />
                        <span>Admin</span>
                      </div>
                      <div className='h-1 w-1 bg-gray-300 rounded-full hidden sm:block'></div>
                      <div className='text-xs text-gray-500 truncate'>
                        ID: {user?.id?.substring(0, 8)}...
                      </div>
                    </div>
                  </div>
                </div>

                <div className='space-y-1'>
                  <p className='text-gray-700 text-sm md:text-base'>
                    Bonjour{' '}
                    <span className='font-semibold text-gray-900'>
                      {user?.firstName}
                    </span>
                    <span className='text-gray-500 mx-1 hidden sm:inline'>•</span>
                    <span className='text-gray-600 block sm:inline'>Rôle: Administrateur</span>
                  </p>
                  {lastRefreshTime && (
                    <div className='flex items-center gap-2 text-sm text-gray-500'>
                      <Clock size={14} />
                      <span>Dernière mise à jour: {lastRefreshTime}</span>
                    </div>
                  )}
                  {loading && (
                    <div className='flex items-center gap-2 text-sm text-blue-600'>
                      <RefreshCw size={14} className='animate-spin' />
                      <span>Chargement des données...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-3'>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || loading}
                  className='flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm hover:shadow-md w-full md:w-auto justify-center'
                >
                  <RefreshCw
                    size={18}
                    className={isRefreshing ? 'animate-spin' : ''}
                  />
                  <span className='font-medium'>
                    {isRefreshing ? 'Actualisation...' : 'Actualiser'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Cartes de statistiques - Mobile first */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4'>
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className={`bg-white rounded-2xl shadow-sm border p-4 md:p-5 hover:shadow-md transition-all duration-200 group border-gray-200 hover:border-gray-300`}
                >
                  <div className='flex items-start justify-between mb-3'>
                    <div className={`p-2 md:p-2.5 rounded-xl ${card.iconBg}`}>
                      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${card.iconColor}`} />
                    </div>
                    {card.trend === 'positive' && (
                      <div className='flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full'>
                        <TrendingUp size={12} />
                        <span className='ml-1 hidden sm:inline'>+</span>
                      </div>
                    )}
                    {card.trend === 'attention' && (
                      <div className='flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full'>
                        <AlertTriangle size={12} />
                      </div>
                    )}
                  </div>

                  <div className='space-y-1'>
                    <p className='text-xs md:text-sm font-medium text-gray-600 truncate'>
                      {card.title}
                    </p>
                    <div
                      className={`text-xl md:text-2xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}
                    >
                      {typeof card.value === 'string'
                        ? card.value
                        : card.value.toLocaleString('fr-FR')}
                    </div>
                    <p className='text-xs text-gray-500 truncate'>
                      {card.description}
                    </p>
                    {card.detail && (
                      <p className='text-xs text-gray-400 truncate'>{card.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deuxième ligne : Statistiques détaillées */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6'>
            {/* Procédures */}
            <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6'>
              <div className='flex items-center justify-between mb-4 md:mb-6'>
                <div className='flex items-center space-x-2'>
                  <div className='p-2 bg-blue-50 rounded-lg'>
                    <FileText className='w-4 h-4 md:w-5 md:h-5 text-blue-600' />
                  </div>
                  <h2 className='text-base md:text-lg font-semibold text-gray-900'>
                    Statut des Procédures
                  </h2>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-xs md:text-sm text-gray-500'>
                    Total: {(stats?.totalProcedures || 0).toLocaleString('fr-FR')}
                  </span>
                  <BarChart3 size={14} className='text-gray-400 hidden sm:block' />
                </div>
              </div>
              <div className='space-y-3'>
                {procedureStatusStats.map((stat, index) => {
                  if (stat.value === 0) return null;
                  
                  const Icon = stat.icon;
                  const percentage = getProcedurePercentage(stat.value);

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-xl border ${stat.borderColor} ${stat.bgColor}`}
                    >
                      <div className='flex items-center space-x-3'>
                        <div className='p-1.5 rounded-lg bg-white shadow-sm'>
                          <Icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <div>
                          <span className='text-sm font-medium text-gray-800'>
                            {stat.status}
                          </span>
                          <div className='h-1 w-12 md:w-16 bg-gray-200 rounded-full overflow-hidden mt-1'>
                            <div
                              className={`h-full ${stat.color.replace('text-', 'bg-')}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center space-x-2 md:space-x-4'>
                        <span className='text-xs md:text-sm text-gray-500'>
                          {percentage}%
                        </span>
                        <span className='text-base md:text-lg font-bold text-gray-900 min-w-10 md:min-w-15 text-right'>
                          {stat.value.toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {procedureStatusStats.every(stat => stat.value === 0) && (
                  <div className='text-center py-4 text-gray-500'>
                    Aucune donnée de procédure disponible
                  </div>
                )}
              </div>
            </div>

            {/* Rendez-vous */}
            <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6'>
              <div className='flex items-center justify-between mb-4 md:mb-6'>
                <div className='flex items-center space-x-2'>
                  <div className='p-2 bg-emerald-50 rounded-lg'>
                    <Calendar className='w-4 h-4 md:w-5 md:h-5 text-emerald-600' />
                  </div>
                  <h2 className='text-base md:text-lg font-semibold text-gray-900'>
                    Rendez-vous
                  </h2>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-xs md:text-sm text-gray-500'>
                    Total: {(stats?.totalRendezvous || 0).toLocaleString('fr-FR')}
                  </span>
                  <UserCheck size={14} className='text-gray-400 hidden sm:block' />
                </div>
              </div>
              <div className='space-y-3'>
                {rendezvousStatuses.map((stat, index) => {
                  const percentage = getRendezvousPercentage(stat.value);

                  return (
                    <div key={index} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <span className='text-sm font-medium text-gray-700 truncate'>
                          {stat.status}
                        </span>
                        <div className='flex items-center space-x-2 md:space-x-3'>
                          <span className='text-xs md:text-sm text-gray-500'>
                            {percentage}%
                          </span>
                          <span
                            className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                              stat.color === 'yellow'
                                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                : stat.color === 'blue'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : stat.color === 'emerald'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : stat.color === 'red'
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : 'bg-gray-50 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {stat.value.toLocaleString('fr-FR')}
                          </span>
                        </div>
                      </div>
                      <div className='h-2 bg-gray-200 rounded-full overflow-hidden'>
                        <div
                          className={`h-full rounded-full ${
                            stat.color === 'yellow'
                              ? 'bg-yellow-500'
                              : stat.color === 'blue'
                                ? 'bg-blue-500'
                                : stat.color === 'emerald'
                                  ? 'bg-emerald-500'
                                  : stat.color === 'red'
                                    ? 'bg-red-500'
                                    : 'bg-gray-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Troisième ligne - Adaptée pour mobile-first */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6'>
            {/* Destinations */}
            <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6'>
              <div className='flex items-center justify-between mb-4 md:mb-6'>
                <div className='flex items-center space-x-2'>
                  <div className='p-2 bg-violet-50 rounded-lg'>
                    <Globe className='w-4 h-4 md:w-5 md:h-5 text-violet-600' />
                  </div>
                  <h2 className='text-base md:text-lg font-semibold text-gray-900'>
                    Destinations
                  </h2>
                </div>
                <span className='text-xs md:text-sm text-gray-500'>
                  Top 5
                </span>
              </div>
              <div className='space-y-4'>
                {popularDestinations.length > 0 ? (
                  popularDestinations.map((destination, index) => (
                    <div key={index} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2 flex-1 min-w-0'>
                          <div className='w-2 h-2 bg-violet-500 rounded-full shrink-0'></div>
                          <span className='text-sm font-medium text-gray-800 truncate'>
                            {destination.name}
                          </span>
                        </div>
                        <div className='flex items-center gap-2 md:gap-3 shrink-0'>
                          <span className='text-xs md:text-sm text-gray-500'>
                            {destination.percentage}%
                          </span>
                          <span className='text-sm font-semibold text-gray-900'>
                            {destination.count.toLocaleString('fr-FR')}
                          </span>
                        </div>
                      </div>
                      <div className='h-2 bg-gray-200 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-lineart-to-r from-violet-500 to-violet-600 rounded-full'
                          style={{ width: `${destination.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='text-center py-6 md:py-8'>
                    <Globe className='w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3' />
                    <p className='text-gray-500 text-sm md:text-base'>
                      Aucune donnée de destination
                    </p>
                    <p className='text-xs md:text-sm text-gray-400 mt-1'>
                      Les procédures apparaîtront ici
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Activités - DISPOSITION HORIZONTALE POUR MOBILE */}
            <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6'>
              <div className='flex items-center justify-between mb-4 md:mb-6'>
                <div className='flex items-center space-x-2'>
                  <div className='p-2 bg-amber-50 rounded-lg'>
                    <Clock className='w-4 h-4 md:w-5 md:h-5 text-amber-600' />
                  </div>
                  <h2 className='text-base md:text-lg font-semibold text-gray-900'>
                    Activités récentes
                  </h2>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-xs md:text-sm text-gray-500'>
                    {activities.length} activité{activities.length !== 1 ? 's' : ''}
                  </span>
                  {activities.length > 0 && (
                    <div className='flex items-center gap-1'>
                      <button
                        onClick={() => scrollActivities('left')}
                        className='p-1.5 rounded-lg hover:bg-gray-100 transition-colors'
                        aria-label='Faire défiler vers la gauche'
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => scrollActivities('right')}
                        className='p-1.5 rounded-lg hover:bg-gray-100 transition-colors'
                        aria-label='Faire défiler vers la droite'
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Conteneur d'activités avec défilement horizontal sur mobile */}
              <div 
                ref={activitiesContainerRef}
                className={`${
                  isMobile 
                    ? 'flex overflow-x-auto gap-4 pb-4 -mx-1 px-1 snap-x snap-mandatory' 
                    : 'space-y-4 max-h-75 overflow-y-auto pr-2'
                }`}
                style={{
                  scrollbarWidth: 'thin',
                  msOverflowStyle: 'none',
                }}
              >
                {activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <div
                      key={index}
                      className={`
                        ${isMobile 
                          ? 'min-w-70 max-w-70 bg-gray-50 rounded-xl p-4 border border-gray-200 snap-start shrink-0' 
                          : 'flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0 group'
                        }
                      `}
                    >
                      <div className={`${isMobile ? 'mb-3' : 'shrink-0 mt-0.5'}`}>
                        <div className={`${isMobile ? 'p-2 rounded-lg bg-white shadow-sm' : 'p-1.5 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-colors'}`}>
                          <ActivityIcon type={activity.type} />
                        </div>
                      </div>
                      <div className={`${isMobile ? 'space-y-2' : 'flex-1 min-w-0 space-y-1'}`}>
                        <p className={`text-sm font-medium text-gray-900 ${isMobile ? 'line-clamp-2' : 'line-clamp-2'}`}>
                          {activity.description}
                        </p>
                        <div className={`${isMobile ? 'space-y-2' : 'flex items-center justify-between'}`}>
                          <div className={`flex items-center ${isMobile ? 'gap-2 flex-wrap' : 'gap-2'}`}>
                            <div className={`text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded ${isMobile ? 'mb-1' : ''}`}>
                              {activity.type}
                            </div>
                            <span className='text-xs text-gray-500 truncate'>
                              {maskEmail(activity.userEmail)}
                            </span>
                          </div>
                          <span className={`text-xs text-gray-500 ${isMobile ? 'block mt-2' : 'shrink-0'}`}>
                            {formatActivityDate(activity.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`${isMobile ? 'min-w-full text-center py-8' : 'text-center py-8'}`}>
                    <Clock className='w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3' />
                    <p className='text-gray-500 text-sm md:text-base'>
                      Aucune activité récente
                    </p>
                    <p className='text-xs md:text-sm text-gray-400 mt-1'>
                      Les actions apparaîtront ici
                    </p>
                  </div>
                )}
              </div>

              {/* Indicateur de défilement pour mobile */}
              {isMobile && activities.length > 0 && (
                <div className='flex justify-center items-center gap-1 mt-4 pt-4 border-t border-gray-100'>
                  <div className='w-2 h-2 bg-gray-300 rounded-full'></div>
                  <div className='w-2 h-2 bg-gray-400 rounded-full'></div>
                  <div className='w-2 h-2 bg-gray-300 rounded-full'></div>
                  <MoreHorizontal className='w-4 h-4 text-gray-400 ml-1' />
                </div>
              )}
            </div>
          </div>

          {/* Pied de page sécurisé */}
          <div className='pt-4 md:pt-6 border-t border-gray-200'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 text-xs md:text-sm text-gray-500'>
              <div className='flex flex-wrap items-center gap-3 md:gap-4'>
                <div className='flex items-center gap-2'>
                  <Shield size={12} className='text-gray-400' />
                  <span>Session sécurisée</span>
                </div>
                <div className='h-4 w-px bg-gray-300 hidden md:block'></div>
                <div className='flex items-center gap-2'>
                  <Clock size={12} className='text-gray-400' />
                  <span>Activité: maintenant</span>
                </div>
              </div>
              <div className='flex items-center gap-2 mt-2 md:mt-0'>
                <div className='w-2 h-2 bg-emerald-500 rounded-full'></div>
                <span>Système opérationnel</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;