/* global console */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useRendezvousApi } from '../../../api/user/Rendezvous/MesRendezVous';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarDays,
  Clock,
  MapPin,
  Filter,
  Search,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building,
  GraduationCap,
  Info,
} from 'lucide-react';
import {
  UserRendezvousParams,
  RendezvousStatus,
} from '../../../api/user/types/rendezvous.types';
import { Helmet } from 'react-helmet-async';

// ==================== COMPOSANT POPOVER CONFIRMATION ====================

interface ConfirmPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmPopover: React.FC<ConfirmPopoverProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
}) => {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in duration-200'>
        <div className='p-6'>
          <div className='flex items-start gap-3 mb-4'>
            <div className='bg-sky-100 p-2 rounded-full'>
              <Info className='w-6 h-6 text-sky-600' />
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
              <p className='text-gray-600 mt-1'>{message}</p>
            </div>
          </div>

          <div className='flex gap-3 mt-6'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-2.5 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className='flex-1 px-4 py-2.5 text-white font-medium bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 rounded-lg transition-all'
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== COMPOSANT CARTE RENDEZ-VOUS ====================

interface RendezvousCardProps {
  rendezvous: any;
  onCancel: (id: string) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
}

const RendezvousCard: React.FC<RendezvousCardProps> = ({
  rendezvous,
  onCancel,
  onConfirm,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmConfirm, setShowConfirmConfirm] = useState(false);
  const [actionType, setActionType] = useState<'cancel' | 'confirm'>('cancel');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'En attente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Confirmé':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Terminé':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Annulé':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'En attente':
        return <AlertCircle className='w-4 h-4' />;
      case 'Confirmé':
        return <CheckCircle className='w-4 h-4' />;
      case 'Terminé':
        return <CheckCircle className='w-4 h-4' />;
      case 'Annulé':
        return <XCircle className='w-4 h-4' />;
      default:
        return null;
    }
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    try {
      const date = parseISO(dateStr);
      return {
        date: format(date, 'EEEE d MMMM yyyy', { locale: fr }),
        time: timeStr.replace(':', 'h'),
      };
    } catch {
      return { date: dateStr, time: timeStr };
    }
  };

  const { date, time } = formatDateTime(rendezvous.date, rendezvous.time);

  const isUpcoming = useMemo(() => {
    if (rendezvous.status === 'Terminé' || rendezvous.status === 'Annulé') {
      return false;
    }

    try {
      const rdvDateTime = new Date(`${rendezvous.date}T${rendezvous.time}:00`);
      const now = new Date();
      return rdvDateTime > now;
    } catch {
      return false;
    }
  }, [rendezvous]);

  const { canCancelRendezvous, getTimeRemainingMessage } = useRendezvousApi();
  const canCancel = canCancelRendezvous(rendezvous);
  const timeRemaining = getTimeRemainingMessage(rendezvous);

  const handleCancelClick = () => {
    setActionType('cancel');
    setShowConfirmCancel(true);
  };

  const handleConfirmClick = () => {
    setActionType('confirm');
    setShowConfirmConfirm(true);
  };

  const executeAction = async () => {
    if (!rendezvous._id) {
      setError("Impossible d'identifier ce rendez-vous");
      return;
    }

    // Vérification supplémentaire basée sur le backend
    if (actionType === 'cancel' && !canCancel) {
      setError(
        'Vous ne pouvez plus annuler ce rendez-vous (moins de 2h avant)'
      );
      return;
    }

    if (actionType === 'confirm' && rendezvous.status !== 'En attente') {
      setError('Seuls les rendez-vous en attente peuvent être confirmés');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (actionType === 'cancel') {
        await onCancel(rendezvous._id);
      } else {
        await onConfirm(rendezvous._id);
      }
      setShowConfirmCancel(false);
      setShowConfirmConfirm(false);
    } catch (err: any) {
      setError(
        err.message ||
          `Erreur lors de l'${actionType === 'cancel' ? 'annulation' : 'confirmation'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ConfirmPopover
        isOpen={showConfirmCancel}
        onClose={() => setShowConfirmCancel(false)}
        onConfirm={executeAction}
        title='Annuler le rendez-vous'
        message='Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action est irréversible.'
        confirmText={isLoading ? 'Annulation...' : 'Oui, annuler'}
        cancelText='Non, garder'
      />

      <ConfirmPopover
        isOpen={showConfirmConfirm}
        onClose={() => setShowConfirmConfirm(false)}
        onConfirm={executeAction}
        title='Confirmer le rendez-vous'
        message='Voulez-vous confirmer votre participation à ce rendez-vous ?'
        confirmText={isLoading ? 'Confirmation...' : 'Oui, confirmer'}
        cancelText='Non, plus tard'
      />

      <div className='bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-4'>
        <div
          className='p-4 cursor-pointer'
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className='flex items-center justify-between'>
            <div className='flex-1'>
              <div className='flex items-center gap-2 mb-2'>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(rendezvous.status)}`}
                >
                  {getStatusIcon(rendezvous.status)}
                  {rendezvous.status}
                </span>
                {timeRemaining && isUpcoming && (
                  <span className='text-xs text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full'>
                    {timeRemaining}
                  </span>
                )}
              </div>

              <h3 className='font-semibold text-gray-900 mb-1'>
                {rendezvous.destination}
              </h3>

              <div className='flex items-center gap-3 text-sm text-gray-600'>
                <div className='flex items-center gap-1'>
                  <CalendarDays className='w-4 h-4 text-sky-500' />
                  <span>{date}</span>
                </div>
                <div className='flex items-center gap-1'>
                  <Clock className='w-4 h-4 text-sky-500' />
                  <span>{time}</span>
                </div>
              </div>
            </div>

            <ChevronRight
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>

        {isExpanded && (
          <div className='px-4 pb-4 border-t border-gray-100 pt-4'>
            {error && (
              <div className='mb-4 bg-red-50 border border-red-200 rounded-lg p-3'>
                <div className='flex items-center gap-2 text-sm text-red-600'>
                  <AlertCircle className='w-4 h-4 flex-shrink-0' />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className='space-y-3'>
              <div className='flex items-start gap-3'>
                <MapPin className='w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium text-gray-900'>
                    Destination
                  </p>
                  <p className='text-sm text-gray-600'>
                    {rendezvous.destination}
                  </p>
                </div>
              </div>

              <div className='flex items-start gap-3'>
                <Building className='w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium text-gray-900'>Filière</p>
                  <p className='text-sm text-gray-600'>{rendezvous.filiere}</p>
                </div>
              </div>

              <div className='flex items-start gap-3'>
                <GraduationCap className='w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0' />
                <div>
                  <p className='text-sm font-medium text-gray-900'>
                    Niveau d'études
                  </p>
                  <p className='text-sm text-gray-600'>
                    {rendezvous.niveauEtude}
                  </p>
                </div>
              </div>

              {rendezvous.avisAdmin && (
                <div className='bg-sky-50 rounded-lg p-3'>
                  <p className='text-sm font-medium text-sky-900 mb-1'>
                    Avis administratif
                  </p>
                  <p className='text-sm text-sky-700'>{rendezvous.avisAdmin}</p>
                </div>
              )}
            </div>

            <div className='flex gap-2 mt-4 pt-4 border-t border-gray-100'>
              {rendezvous.status === 'En attente' && isUpcoming && (
                <button
                  onClick={handleConfirmClick}
                  disabled={isLoading}
                  className='flex-1 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25'
                >
                  <CheckCircle className='w-4 h-4' />
                  {isLoading ? 'Confirmation...' : 'Confirmer'}
                </button>
              )}

              {(rendezvous.status === 'En attente' ||
                rendezvous.status === 'Confirmé') &&
                canCancel &&
                isUpcoming && (
                  <button
                    onClick={handleCancelClick}
                    disabled={isLoading}
                    className='flex-1 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                  >
                    <XCircle className='w-4 h-4' />
                    {isLoading ? 'Annulation...' : 'Annuler'}
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ==================== COMPOSANT PRINCIPAL ====================

interface FilterOptions {
  status: string;
  date: string;
  search: string;
}

const MesRendezVous: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  const {
    getUserRendezvous,
    cancelRendezvous,
    confirmRendezvous,
    isUpcoming,
    RENDEZVOUS_STATUS,
  } = useRendezvousApi();

  const [rendezvousList, setRendezvousList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    pending: 0,
  });

  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    date: 'all',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const loadRendezvous = useCallback(
    async (reset = false) => {
      if (!isAuthenticated) {
        setError('Vous devez être connecté pour voir vos rendez-vous');
        setLoading(false);
        return;
      }

      if (!user?.email) {
        setError('Informations utilisateur incomplètes');
        setLoading(false);
        return;
      }

      try {
        const currentPage = reset ? 1 : page;
        const params: UserRendezvousParams = {
          email: user.email.trim().toLowerCase(),
          page: currentPage,
          limit: 10,
          status:
            filters.status !== 'all'
              ? (filters.status as RendezvousStatus)
              : undefined,
        };

        const response = await getUserRendezvous(params);

        if (reset) {
          setRendezvousList(response.data);
        } else {
          setRendezvousList(prev => [...prev, ...response.data]);
        }

        // CORRECTION ICI : Vérification de totalPages
        setHasMore(currentPage < (response.totalPages || 1));

        const upcomingCount = response.data.filter((rdv: any) => {
          const isActiveStatus =
            rdv.status === RENDEZVOUS_STATUS.PENDING ||
            rdv.status === RENDEZVOUS_STATUS.CONFIRMED;
          return isActiveStatus && isUpcoming(rdv);
        }).length;

        const pendingCount = response.data.filter(
          (rdv: any) => rdv.status === RENDEZVOUS_STATUS.PENDING
        ).length;

        setStats({
          total: response.total || 0,
          upcoming: upcomingCount,
          pending: pendingCount,
        });

        setGlobalError(null);
        setError(null);
      } catch (err: any) {
        if (
          err.message.includes('session') ||
          err.message.includes('expirée')
        ) {
          setError('Votre session a expiré. Veuillez vous reconnecter.');
          logout();
        } else {
          console.error('Erreur détaillée:', err);
          setError(`Impossible de charger vos rendez-vous: ${err.message}`);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      isAuthenticated,
      user?.email,
      page,
      filters.status,
      getUserRendezvous,
      logout,
      isUpcoming,
      RENDEZVOUS_STATUS,
    ]
  );

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      loadRendezvous(true);
    }
  }, [isAuthenticated, user?.email]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setGlobalError(null);
    await loadRendezvous(true);
  };

  const handleCancelRendezvous = async (id: string) => {
    if (!id || id.trim() === '') {
      setGlobalError('Identifiant du rendez-vous manquant');
      return;
    }

    try {
      await cancelRendezvous(id);
      await loadRendezvous(true);
    } catch (err: any) {
      setGlobalError(err.message || "Erreur lors de l'annulation");
    }
  };

  const handleConfirmRendezvous = async (id: string) => {
    if (!id || id.trim() === '') {
      setGlobalError('Identifiant du rendez-vous manquant');
      return;
    }

    try {
      await confirmRendezvous(id);
      await loadRendezvous(true);
    } catch (err: any) {
      setGlobalError(err.message || 'Erreur lors de la confirmation');
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      loadRendezvous();
    }
  };

  const filteredRendezvous = useMemo(() => {
    let filtered = rendezvousList;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        rdv =>
          rdv.destination?.toLowerCase().includes(searchLower) ||
          rdv.filiere?.toLowerCase().includes(searchLower) ||
          rdv.niveauEtude?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.date === 'upcoming') {
      filtered = filtered.filter(
        rdv =>
          (rdv.status === RENDEZVOUS_STATUS.PENDING ||
            rdv.status === RENDEZVOUS_STATUS.CONFIRMED) &&
          isUpcoming(rdv)
      );
    } else if (filters.date === 'past') {
      filtered = filtered.filter(
        rdv =>
          rdv.status === RENDEZVOUS_STATUS.COMPLETED ||
          rdv.status === RENDEZVOUS_STATUS.CANCELLED ||
          !isUpcoming(rdv)
      );
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(rdv => rdv.status === filters.status);
    }

    return filtered;
  }, [rendezvousList, filters, isUpcoming, RENDEZVOUS_STATUS]);

  const renderStats = () => (
    <div className='grid grid-cols-3 gap-3 mb-6'>
      <div className='bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-xl p-3 text-center'>
        <div className='text-2xl font-bold text-sky-600'>{stats.total}</div>
        <div className='text-xs text-sky-800 font-medium'>Total</div>
      </div>
      <div className='bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-xl p-3 text-center'>
        <div className='text-2xl font-bold text-sky-600'>{stats.upcoming}</div>
        <div className='text-xs text-sky-800 font-medium'>À venir</div>
      </div>
      <div className='bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-xl p-3 text-center'>
        <div className='text-2xl font-bold text-sky-600'>{stats.pending}</div>
        <div className='text-xs text-sky-800 font-medium'>En attente</div>
      </div>
    </div>
  );

  const renderFilters = () => (
    <div className='bg-white rounded-2xl shadow-lg border border-gray-200 p-4 mb-4'>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Statut
          </label>
          <select
            value={filters.status}
            onChange={e =>
              setFilters(prev => ({ ...prev, status: e.target.value }))
            }
            className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20'
          >
            <option value='all'>Tous les statuts</option>
            <option value={RENDEZVOUS_STATUS.PENDING}>
              {RENDEZVOUS_STATUS.PENDING}
            </option>
            <option value={RENDEZVOUS_STATUS.CONFIRMED}>
              {RENDEZVOUS_STATUS.CONFIRMED}
            </option>
            <option value={RENDEZVOUS_STATUS.COMPLETED}>
              {RENDEZVOUS_STATUS.COMPLETED}
            </option>
            <option value={RENDEZVOUS_STATUS.CANCELLED}>
              {RENDEZVOUS_STATUS.CANCELLED}
            </option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Période
          </label>
          <select
            value={filters.date}
            onChange={e =>
              setFilters(prev => ({ ...prev, date: e.target.value }))
            }
            className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20'
          >
            <option value='all'>Toutes les dates</option>
            <option value='upcoming'>À venir</option>
            <option value='past'>Passés</option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Rechercher
          </label>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              value={filters.search}
              onChange={e =>
                setFilters(prev => ({ ...prev, search: e.target.value }))
              }
              placeholder='Destination, filière...'
              className='w-full pl-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20'
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>
            Veuillez vous connecter
          </h1>
          <p className='text-gray-600 mb-6'>
            Vous devez être connecté pour voir vos rendez-vous
          </p>
          <a
            href='/connexion'
            className='inline-block bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-6 py-3 rounded-lg font-medium'
          >
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-sky-50 to-white'>
      <Helmet>
        <title>Mes rendez-vous</title>
      </Helmet>

      <div className='bg-gradient-to-r from-sky-500 to-sky-600 text-white px-4 pt-12 pb-8'>
        <div className='max-w-3xl mx-auto'>
          <div className='flex items-center justify-between mb-6'>
            <div>
              <h1 className='text-2xl font-bold mb-1'>Mes rendez-vous</h1>
              <p className='text-sky-100'>
                Gérez vos rendez-vous de consultation
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className='bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors disabled:opacity-50'
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <div className='relative mb-4'>
            <Search className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sky-400' />
            <input
              type='text'
              placeholder='Rechercher un rendez-vous...'
              value={filters.search}
              onChange={e =>
                setFilters(prev => ({ ...prev, search: e.target.value }))
              }
              className='w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 text-white placeholder-sky-200 focus:outline-none focus:ring-2 focus:ring-white/50'
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className='inline-flex items-center gap-2 text-sm font-medium text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors'
          >
            <Filter className='w-4 h-4' />
            Filtres
            {showFilters ? (
              <ChevronRight className='w-4 h-4 rotate-90' />
            ) : (
              <ChevronRight className='w-4 h-4' />
            )}
          </button>
        </div>
      </div>

      <div className='px-4 pb-8 -mt-6'>
        <div className='max-w-3xl mx-auto'>
          {showFilters && renderFilters()}

          {globalError && (
            <div className='mb-4 bg-red-50 border border-red-200 rounded-xl p-4'>
              <div className='flex items-start gap-3'>
                <AlertCircle className='w-5 h-5 text-red-500 mt-0.5 flex-shrink-0' />
                <div className='text-sm text-red-700'>{globalError}</div>
              </div>
            </div>
          )}

          {renderStats()}

          {error && (
            <div className='mb-6 bg-red-50 border border-red-200 rounded-xl p-4'>
              <div className='flex items-start gap-3'>
                <AlertCircle className='w-5 h-5 text-red-500 mt-0.5 flex-shrink-0' />
                <div className='text-sm text-red-700'>{error}</div>
              </div>
            </div>
          )}

          <div className='mb-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Vos rendez-vous
              </h2>
              <span className='text-sm text-gray-500'>
                {filteredRendezvous.length} résultat
                {filteredRendezvous.length > 1 ? 's' : ''}
              </span>
            </div>

            {loading && page === 1 ? (
              <div className='text-center py-12'>
                <div className='inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500'></div>
                <p className='mt-4 text-gray-600'>
                  Chargement de vos rendez-vous...
                </p>
              </div>
            ) : filteredRendezvous.length === 0 ? (
              <div className='text-center py-12'>
                <div className='w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-sky-50 to-sky-100 flex items-center justify-center'>
                  <CalendarDays className='w-10 h-10 text-sky-500' />
                </div>
                <h3 className='text-lg font-semibold text-gray-900 mb-2'>
                  Aucun rendez-vous trouvé
                </h3>
                <p className='text-gray-600 mb-6'>
                  {filters.status !== 'all' ||
                  filters.date !== 'all' ||
                  filters.search !== ''
                    ? 'Aucun rendez-vous ne correspond à vos critères de recherche'
                    : "Vous n'avez pas encore de rendez-vous programmé"}
                </p>
                <a
                  href='/rendez-vous'
                  className='inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-medium py-2.5 px-6 rounded-full transition-all shadow-lg shadow-sky-500/25'
                >
                  <CalendarDays className='w-4 h-4' />
                  Prendre un rendez-vous
                </a>
              </div>
            ) : (
              <>
                <div className='space-y-3'>
                  {filteredRendezvous.map((rendezvous, index) => {
                    const uniqueKey = rendezvous._id
                      ? `rdv-${rendezvous._id}`
                      : `rdv-fallback-${index}`;

                    return (
                      <RendezvousCard
                        key={uniqueKey}
                        rendezvous={rendezvous}
                        onCancel={handleCancelRendezvous}
                        onConfirm={handleConfirmRendezvous}
                      />
                    );
                  })}
                </div>

                {hasMore && (
                  <div className='text-center mt-6'>
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className='inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 font-medium disabled:opacity-50'
                    >
                      {loading ? (
                        <>
                          <RefreshCw className='w-4 h-4 animate-spin' />
                          Chargement...
                        </>
                      ) : (
                        'Charger plus de rendez-vous'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MesRendezVous;
