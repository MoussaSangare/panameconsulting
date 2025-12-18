import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiCalendar,
  FiClock,
  FiMapPin,
  FiBook,
  FiAward,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiInfo,
  FiStar,
  FiFilter,
  FiX,
  FiAlertTriangle,
} from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import { UserHeader } from '../../../components/user/UserHeader';
import { 
  UserRendezvousService, 
  Rendezvous, 
  PaginationState,
  AuthFunctions 
} from '../../../api/user/Rendezvous/UserRendezvousService';

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

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'En attente', label: 'En attente' },
  { value: 'Confirmé', label: 'Confirmé' },
  { value: 'Terminé', label: 'Terminé' },
  { value: 'Annulé', label: 'Annulé' },
];

const statusColors: Record<string, string> = {
  'En attente': 'bg-amber-100 text-amber-800 border-amber-300',
  'Confirmé': 'bg-sky-100 text-sky-800 border-sky-300',
  'Terminé': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Annulé': 'bg-red-100 text-red-800 border-red-300',
};

const avisColors: Record<string, string> = {
  'Favorable': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Défavorable': 'bg-red-100 text-red-800 border-red-300',
};

const MesRendezvous = () => {
  const { 
    user,
    fetchWithAuth,
    isLoading: authLoading,
    updateProfile,
    isAuthenticated
  } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [headerHeight, setHeaderHeight] = useState(0);

  const [rendezvous, setRendezvous] = useState<Rendezvous[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // État pour le popover d'annulation
  const [showCancelPopover, setShowCancelPopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fermer le popover en cliquant en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowCancelPopover(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fonction pour obtenir la configuration de page
  const getCurrentPageConfig = () => {
    const currentPath = location.pathname;
    if (pageConfigs[currentPath as keyof typeof pageConfigs]) {
      return pageConfigs[currentPath as keyof typeof pageConfigs];
    }
    
    for (const [path, config] of Object.entries(pageConfigs)) {
      if (currentPath.startsWith(path)) {
        return config;
      }
    }
    
    return pageConfigs['/mes-rendez-vous'];
  };

  const currentPage = getCurrentPageConfig();

  // Vérification d'authentification
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <div className="text-center">
          <div className="animate-pulse rounded-full h-16 w-16 bg-gradient-to-r from-sky-400 to-blue-500 mx-auto mb-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 animate-pulse">Chargement de l'authentification...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    navigate('/connexion');
    return null;
  }

  const authFunctions: AuthFunctions = useMemo(() => ({
    fetchWithAuth,
    getAccessToken: () => null,
    refreshToken: async () => true,
    logout: () => {}
  }), [fetchWithAuth]);

  const rendezvousService = useMemo(() => {
    return new UserRendezvousService(authFunctions);
  }, [authFunctions]);

  // Fonction pour charger les rendez-vous
  const fetchRendezvous = useCallback(async () => {
    setLoading(true);
    
    try {
      const data = await rendezvousService.fetchUserRendezvous({
        page: pagination.page,
        limit: pagination.limit,
        status: selectedStatus || undefined,
      });
      
      setRendezvous(data.data);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      });
      
    } catch (error: any) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
      
      if (error.message !== 'SESSION_EXPIRED' && 
          error.message !== 'SESSION_CHECK_IN_PROGRESS') {
        toast.error("Impossible de charger les rendez-vous");
      }
    } finally {
      setLoading(false);
    }
  }, [rendezvousService, selectedStatus, pagination.page, pagination.limit]);

  // Charger les rendez-vous au montage et quand les filtres changent
  useEffect(() => {
    if (location.pathname === '/mes-rendez-vous') {
      fetchRendezvous();
    }
  }, [location.pathname, selectedStatus, pagination.page, fetchRendezvous]);

  // Annuler un rendez-vous
  const handleCancelRendezvous = async (rdvId: string) => {
    setShowCancelPopover(null);
    setCancelling(rdvId);
    
    try {
      const updatedRdv = await rendezvousService.cancelRendezvous(rdvId);
      
      setRendezvous(prev => 
        prev.map(rdv => 
          rdv._id === rdvId ? { ...rdv, ...updatedRdv } : rdv
        )
      );
      
      toast.success('Rendez-vous annulé avec succès');
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation:', error);
      
      if (error.message !== 'SESSION_EXPIRED' && 
          error.message !== 'SESSION_CHECK_IN_PROGRESS') {
        toast.error("Impossible d'annuler le rendez-vous");
      }
    } finally {
      setCancelling(null);
    }
  };

  // Ouvrir le popover d'annulation
  const openCancelPopover = (rdvId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowCancelPopover(rdvId);
  };

  // Composant Popover d'annulation
  const CancelConfirmationPopover = ({ rdvId, rdv }: { rdvId: string, rdv: Rendezvous }) => (
    <div 
      ref={popoverRef}
      className="absolute z-50 w-72 bg-white rounded-lg shadow-xl border border-red-200 animate-fadeIn"
      style={{ 
        top: '100%', 
        right: 0,
        marginTop: '8px'
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-50 rounded-lg">
              <FiAlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Annuler le rendez-vous</h3>
          </div>
          <button
            onClick={() => setShowCancelPopover(null)}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FiAlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-amber-800 font-medium">Cette action est irréversible</p>
                <p className="text-xs text-amber-700 mt-1">
                  • Le rendez-vous sera marqué comme "Annulé"
                  <br />
                  • Vous ne pourrez pas le réactiver
                  <br />
                  • La raison sera enregistrée
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-700">
              <span className="font-medium">Rendez-vous du :</span> {UserRendezvousService.formatDate(rdv.date)} à {UserRendezvousService.formatTime(rdv.time)}
              <br />
              <span className="font-medium">Destination :</span> {UserRendezvousService.getEffectiveDestination(rdv)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowCancelPopover(null)}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all duration-150"
          >
            Annuler
          </button>
          <button
            onClick={() => handleCancelRendezvous(rdvId)}
            disabled={cancelling === rdvId}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cancelling === rdvId ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Annulation...
              </>
            ) : (
              <>
                <FiTrash2 className="h-3 w-3" />
                Confirmer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const handleRefresh = () => {
    if (location.pathname === '/mes-rendez-vous') {
      fetchRendezvous();
    } else {
      updateProfile();
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev: any) => ({ ...prev, page: newPage }));
    }
  };

  const renderStatusBadge = (status: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
      {status === 'En attente' && <FiAlertCircle className="mr-1 h-3 w-3" />}
      {status === 'Confirmé' && <FiCheckCircle className="mr-1 h-3 w-3" />}
      {status === 'Terminé' && <FiCheckCircle className="mr-1 h-3 w-3" />}
      {status === 'Annulé' && <FiXCircle className="mr-1 h-3 w-3" />}
      {status}
    </span>
  );

  const renderAvisBadge = (avis: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${avisColors[avis] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
      <FiStar className="mr-1 h-3 w-3" />
      {avis}
    </span>
  );

  const renderRendezvousItem = (rdv: Rendezvous) => (
    <div 
      key={rdv._id} 
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-300 relative"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {renderStatusBadge(rdv.status)}
            {rdv.status === 'Terminé' && rdv.avisAdmin && renderAvisBadge(rdv.avisAdmin)}
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-700">
              <FiCalendar className="mr-2 h-4 w-4 text-sky-500" />
              <span className="font-medium">{UserRendezvousService.formatDate(rdv.date)}</span>
              <FiClock className="ml-4 mr-2 h-4 w-4 text-sky-500" />
              <span className="font-medium">{UserRendezvousService.formatTime(rdv.time)}</span>
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <FiMapPin className="mr-2 h-4 w-4 text-sky-500" />
              <span>{UserRendezvousService.getEffectiveDestination(rdv)}</span>
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <FiBook className="mr-2 h-4 w-4 text-sky-500" />
              <span>{UserRendezvousService.getEffectiveFiliere(rdv)}</span>
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <FiAward className="mr-2 h-4 w-4 text-sky-500" />
              <span>{rdv.niveauEtude}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          {UserRendezvousService.canCancelRendezvous(rdv) && (
            <div className="relative">
              <button
                onClick={(e) => openCancelPopover(rdv._id, e)}
                disabled={cancelling === rdv._id}
                className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative"
              >
                {cancelling === rdv._id ? (
                  <>
                    <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                    Annulation...
                  </>
                ) : (
                  <>
                    <FiTrash2 className="mr-2 h-3 w-3" />
                    Annuler
                  </>
                )}
              </button>
              
              {showCancelPopover === rdv._id && (
                <CancelConfirmationPopover rdvId={rdv._id} rdv={rdv} />
              )}
            </div>
          )}

          {rdv.status === 'Terminé' && rdv.avisAdmin && (
            <div className="text-xs text-gray-500">
              <div className="flex items-center">
                <FiInfo className="mr-1 h-3 w-3" />
                Avis administrateur reçu
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400">
            Créé le {new Date(rdv.createdAt).toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>

      {rdv.status === 'Annulé' && rdv.cancellationReason && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Raison d'annulation :</span>{' '}
            {rdv.cancellationReason}
          </div>
          {rdv.cancelledAt && (
            <div className="text-xs text-gray-500 mt-1">
              Annulé le {new Date(rdv.cancelledAt).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Mise à jour de la hauteur du header après le rendu
  useEffect(() => {
    const header = document.querySelector('header');
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>{currentPage.pageTitle}</title>
        <meta name="description" content={currentPage.description} />
      </Helmet>

      <UserHeader
        title={currentPage.title}
        subtitle={currentPage.subtitle}
        pageTitle={currentPage.pageTitle}
        description={currentPage.description}
        isLoading={loading}
        onRefresh={handleRefresh}
      >
        {/* Indicateur de statut */}
        <div className='mt-2 pt-2 border-t border-gray-100'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5'>
              <div className='w-1.5 h-1.5 bg-emerald-500 rounded-full'></div>
              <span className='text-xs text-gray-600'>
                Connecté: {user?.email}
              </span>
            </div>
            <span className='text-xs text-gray-500'>
              {new Date().toLocaleTimeString('fr-FR', { 
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </UserHeader>

      {/* Contenu principal */}
      <div 
        className="min-h-screen bg-gradient-to-b from-sky-50 to-white"
        style={{ paddingTop: `${headerHeight}px` }}
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Contrôles */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white transition-all duration-200 hover:border-sky-400"
                  disabled={loading}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchRendezvous}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>

            <button
              onClick={() => navigate('/rendez-vous')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              <FiCalendar className="h-4 w-4" />
              Nouveau rendez-vous
            </button>
          </div>

          {/* État de chargement */}
          {loading && (
            <div className="mb-6 text-center py-12">
              <div className="inline-block">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
                <p className="mt-3 text-sm text-gray-600">Chargement de vos rendez-vous...</p>
              </div>
            </div>
          )}

          {/* Liste des rendez-vous */}
          {!loading && rendezvous.length > 0 && (
            <div className="space-y-4 mb-8">
              {rendezvous.map(rdv => renderRendezvousItem(rdv))}
            </div>
          )}

          {/* Aucun rendez-vous */}
          {!loading && rendezvous.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <FiCalendar className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                Aucun rendez-vous trouvé
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {selectedStatus 
                  ? `Vous n'avez pas de rendez-vous avec le statut "${selectedStatus}"`
                  : "Vous n'avez pas encore pris de rendez-vous"}
              </p>
              <button
                onClick={() => navigate('/rendez-vous')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                <FiCalendar className="h-4 w-4" />
                Prendre un rendez-vous
              </button>
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {pagination.page} sur {pagination.totalPages} • 
                Total : {pagination.total} rendez-vous{pagination.total > 1 ? 's' : ''}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft className="h-4 w-4" />
                  Précédent
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          pagination.page === pageNum
                            ? 'bg-sky-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Informations */}
          <div className="mt-8 bg-sky-50 border border-sky-200 rounded-lg p-4">
            <h3 className="font-medium text-sky-800 mb-2 flex items-center">
              <FiInfo className="mr-2 h-4 w-4" />
              Informations importantes
            </h3>
            <ul className="text-sm text-sky-700 space-y-1">
              <li>• Les rendez-vous annulés apparaissent avec la raison d'annulation</li>
              <li>• Vous ne pouvez annuler qu'un rendez-vous <strong>Confirmé</strong></li>
              <li>• L'annulation n'est plus possible à moins de 2 heures du rendez-vous</li>
              <li>• Pour les rendez-vous <strong>Terminés</strong>, l'avis administrateur est affiché</li>
              <li>• Un rendez-vous <strong>Terminé</strong> avec avis <strong>Favorable</strong> peut déclencher une procédure</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Styles CSS pour l'animation du popover */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }
      `}</style>
    </>
  );
};

export default MesRendezvous;