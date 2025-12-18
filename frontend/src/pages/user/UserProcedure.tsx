import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  useUserProcedures,
  useProcedureDetails,
  useCancelProcedure,
  type UserProcedure,
  type UserProcedureStep,
  ProcedureStatus,
  StepStatus,
  getStepDisplayName,
  getStepDisplayStatus,
  getProcedureDisplayStatus,
  getProcedureStatusColor,
  getStepStatusColor,
  canCancelProcedure,
  getProgressStatus,
  formatProcedureDate,
} from '../../api/user/procedures/ProcedureService';
import {
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  FileText,
  User,
  Calendar,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { UserHeader } from '../../components/user/UserHeader';

// Composant de chargement
const LoadingScreen = ({ message = "Chargement..." }: { message?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

const UserProcedureComponent = (): React.JSX.Element => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [headerHeight, setHeaderHeight] = useState(0);

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
    
    return pageConfigs['/ma-procedure'];
  };

  const currentPage = getCurrentPageConfig();

  // === CHARGEMENT SIMPLE ===
  if (authLoading) {
    return <LoadingScreen message="Chargement de l'authentification..." />;
  }

  if (!user) {
    return <LoadingScreen message="Récupération des informations..." />;
  }

  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [selectedProcedure, setSelectedProcedure] =
    useState<UserProcedure | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [procedureToCancel, setProcedureToCancel] =
    useState<UserProcedure | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ProcedureStatus | 'ALL'>(
    'ALL'
  );
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);

  const limit = 8;

  const {
    procedures: paginatedProcedures,
    loading: proceduresLoading,
    error: proceduresError,
    refetch: refetchProcedures,
  } = useUserProcedures(currentPageNum, limit);

  const { procedure: detailedProcedure } =
    useProcedureDetails(selectedProcedure?._id || null);

  const { cancelProcedure, loading: cancelLoading } = useCancelProcedure();

  const getStepStatusIcon = (statut: StepStatus): React.JSX.Element => {
    switch (statut) {
      case StepStatus.COMPLETED:
        return <CheckCircle className='w-4 h-4 text-green-600' />;
      case StepStatus.IN_PROGRESS:
        return <Clock className='w-4 h-4 text-blue-600' />;
      case StepStatus.REJECTED:
        return <XCircle className='w-4 h-4 text-orange-600' />;
      case StepStatus.CANCELLED:
        return <XCircle className='w-4 h-4 text-red-600' />;
      default:
        return <Clock className='w-4 h-4 text-yellow-600' />;
    }
  };

  // === GESTION DES ERREURS DE SESSION ===
  useEffect(() => {
    if (proceduresError === 'SESSION_EXPIRED') {
      navigate('/connexion');
    }
  }, [proceduresError, navigate]);

  useEffect(() => {
    if (
      selectedProcedure &&
      detailedProcedure &&
      selectedProcedure._id === detailedProcedure._id
    ) {
      setSelectedProcedure(detailedProcedure);
    }
  }, [detailedProcedure, selectedProcedure]);

  // === GESTION DE LA SÉLECTION ===
  const handleSelectProcedure = (procedure: UserProcedure): void => {
    setSelectedProcedure(procedure);
    setShowMobileDetails(true);
  };

  // === ANNULATION DE PROCÉDURE ===
  const handleCancelProcedure = async (): Promise<void> => {
    if (!procedureToCancel) return;

    try {
      const result = await cancelProcedure(procedureToCancel._id, cancelReason);

      if (result) {
        await refetchProcedures();
        if (selectedProcedure?._id === procedureToCancel._id) {
          setSelectedProcedure(result);
        }
        setShowCancelModal(false);
        setProcedureToCancel(null);
        setCancelReason('');
      }
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
    }
  };

  // === FILTRES ET RECHERCHE ===
  const filteredProcedures = (paginatedProcedures?.data || []).filter(
    (procedure: UserProcedure) => {
      const matchesSearch =
        procedure.destination
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        procedure.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        procedure.prenom.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' || procedure.statut === statusFilter;
      return matchesSearch && matchesStatus;
    }
  );

  // === FONCTION DE RECHARGEMENT ===
  const refreshUserData = async () => {
    try {
      await refetchProcedures();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  };

  const totalPages = paginatedProcedures?.totalPages || 1;

  // Mise à jour de la hauteur du header
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
        isLoading={proceduresLoading}
        onRefresh={refreshUserData}
      >
        {/* Barre de recherche et filtres */}
        <div className='mt-3 space-y-3'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              placeholder='Rechercher une procédure...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm'
            />
          </div>

          <div className='flex items-center justify-between'>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm'
            >
              <Filter className='w-4 h-4' />
              <span className='font-medium'>Filtrer</span>
            </button>

            <span className='text-sm text-gray-500'>
              {filteredProcedures.length} résultat
              {filteredProcedures.length > 1 ? 's' : ''}
            </span>
          </div>

          {showFilters && (
            <div className='grid grid-cols-2 gap-2'>
              {['ALL', ...Object.values(ProcedureStatus)].map(status => (
                <button
                  key={status}
                  onClick={() =>
                    setStatusFilter(status as ProcedureStatus | 'ALL')
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-300 hover:border-sky-300'
                  }`}
                >
                  {status === 'ALL'
                    ? 'Toutes'
                    : getProcedureDisplayStatus(status as ProcedureStatus)}
                </button>
              ))}
            </div>
          )}
        </div>
      </UserHeader>

      {/* Contenu principal avec padding pour compenser le header fixe */}
      <div 
        className="min-h-screen bg-gradient-to-b from-sky-50 to-white"
        style={{ paddingTop: `${headerHeight}px` }}
      >
        <main className='p-4 max-w-6xl mx-auto'>
          {proceduresLoading ? (
            <div className='bg-white rounded-2xl shadow-sm p-8 text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4'></div>
              <p className='text-gray-600'>Chargement de vos procédures...</p>
            </div>
          ) : proceduresError && proceduresError !== 'SESSION_EXPIRED' ? (
            <div className='bg-white rounded-2xl shadow-sm p-6 text-center'>
              <div className='w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                <AlertCircle className='w-8 h-8 text-red-500' />
              </div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>
                Erreur de chargement
              </h3>
              <p className='text-gray-600 mb-4'>
                Impossible de charger vos procédures. Veuillez réessayer.
              </p>
              <button
                onClick={() => refetchProcedures()}
                className='px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors font-medium'
              >
                Réessayer
              </button>
            </div>
          ) : filteredProcedures.length > 0 ? (
            <div className='lg:grid lg:grid-cols-3 lg:gap-6'>
              <div
                className={`lg:col-span-2 space-y-4 ${showMobileDetails ? 'hidden lg:block' : 'block'}`}
              >
                {filteredProcedures.map((procedure: UserProcedure) => {
                  const progress = getProgressStatus(procedure);
                  const canCancel = canCancelProcedure(procedure);

                  return (
                    <div
                      key={procedure._id}
                      className='bg-white rounded-2xl shadow-sm border border-gray-200 p-4 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]'
                      onClick={() => handleSelectProcedure(procedure)}
                    >
                      <div className='flex items-start justify-between mb-3'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-2'>
                            <h3 className='font-semibold text-gray-800 text-base truncate'>
                              {procedure.destination}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getProcedureStatusColor(procedure.statut)}`}
                            >
                              {getProcedureDisplayStatus(procedure.statut)}
                            </span>
                          </div>

                          <div className='text-gray-600 text-sm space-y-1'>
                            <p className='truncate'>
                              {procedure.prenom} {procedure.nom}
                            </p>
                            <p className='text-xs'>
                              Créée le{' '}
                              {formatProcedureDate(procedure.createdAt)}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className='w-5 h-5 text-gray-400 flex-shrink-0 ml-2' />
                      </div>

                      <div className='mb-3'>
                        <div className='flex justify-between text-xs text-gray-600 mb-1'>
                          <span>Avancement</span>
                          <span>
                            {progress.completed}/{progress.total} étapes
                          </span>
                        </div>
                        <div className='w-full bg-gray-200 rounded-full h-2'>
                          <div
                            className='bg-sky-500 h-2 rounded-full transition-all duration-300'
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        {procedure.steps
                          .slice(0, 3)
                          .map((step: UserProcedureStep) => (
                            <div
                              key={step.nom}
                              className='flex items-center gap-2 text-xs'
                            >
                              {getStepStatusIcon(step.statut)}
                              <span className='text-gray-700 flex-1 truncate'>
                                {getStepDisplayName(step.nom)}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getStepStatusColor(step.statut)}`}
                              >
                                {getStepDisplayStatus(step.statut)}
                              </span>
                            </div>
                          ))}
                        {procedure.steps.length > 3 && (
                          <div className='text-center text-xs text-gray-500 pt-1'>
                            + {procedure.steps.length - 3} autre(s) étape(s)
                          </div>
                        )}
                      </div>

                      {procedure.raisonRejet && (
                        <div className='mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg'>
                          <p className='text-orange-700 text-xs'>
                            <strong>Raison du rejet :</strong>{' '}
                            {procedure.raisonRejet}
                          </p>
                        </div>
                      )}

                      {canCancel && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setProcedureToCancel(procedure);
                            setShowCancelModal(true);
                          }}
                          className='w-full mt-3 px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors duration-200 flex items-center justify-center gap-2'
                        >
                          <XCircle className='w-4 h-4' />
                          Annuler la procédure
                        </button>
                      )}
                    </div>
                  );
                })}

                {totalPages > 1 && (
                  <div className='flex justify-center items-center gap-3 mt-6'>
                    <button
                      onClick={() =>
                        setCurrentPageNum(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPageNum === 1}
                      className='p-2 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors'
                    >
                      <ChevronRight className='w-4 h-4 rotate-180' />
                    </button>

                    <span className='text-sm text-gray-600 font-medium'>
                      {currentPageNum} / {totalPages}
                    </span>

                    <button
                      onClick={() =>
                        setCurrentPageNum(prev => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPageNum === totalPages}
                      className='p-2 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors'
                    >
                      <ChevronRight className='w-4 h-4' />
                    </button>
                  </div>
                )}
              </div>

              <div
                className={`hidden lg:block lg:col-span-1 ${!selectedProcedure && 'lg:hidden'}`}
              >
                {selectedProcedure && (
                  <div className='bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6'>
                    <div className='space-y-6'>
                      <div className='flex items-start justify-between'>
                        <h3 className='text-lg font-semibold text-gray-800'>
                          Détails de la procédure
                        </h3>
                        <button
                          onClick={() => setSelectedProcedure(null)}
                          className='text-gray-400 hover:text-gray-600 transition-colors p-1'
                        >
                          <XCircle className='w-5 h-5' />
                        </button>
                      </div>

                      <div className='space-y-6'>
                        <div className='flex items-start justify-between'>
                          <div>
                            <h3 className='text-xl font-semibold text-gray-800 mb-2'>
                              {selectedProcedure.destination}
                            </h3>
                            <div className='flex items-center gap-3'>
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium border ${getProcedureStatusColor(selectedProcedure.statut)}`}
                              >
                                {getProcedureDisplayStatus(
                                  selectedProcedure.statut
                                )}
                              </span>
                              <span className='text-gray-500 text-sm'>
                                Créée le{' '}
                                {formatProcedureDate(
                                  selectedProcedure.createdAt
                                )}
                              </span>
                            </div>
                          </div>
                          {canCancelProcedure(selectedProcedure) && (
                            <button
                              onClick={() => {
                                setProcedureToCancel(selectedProcedure);
                                setShowCancelModal(true);
                              }}
                              className='px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors duration-200 font-medium flex items-center gap-2'
                            >
                              <XCircle className='w-4 h-4' />
                              Annuler
                            </button>
                          )}
                        </div>

                        <div className='bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-5 border border-sky-100'>
                          <div className='flex justify-between items-center mb-3'>
                            <span className='text-sm font-medium text-gray-700'>
                              Progression globale
                            </span>
                            <span className='text-sm text-gray-600 font-medium'>
                              {getProgressStatus(selectedProcedure).completed}/
                              {getProgressStatus(selectedProcedure).total}{' '}
                              étapes
                            </span>
                          </div>
                          <div className='w-full bg-sky-200 rounded-full h-2.5 mb-2'>
                            <div
                              className='bg-gradient-to-r from-sky-500 to-blue-500 h-2.5 rounded-full transition-all duration-700'
                              style={{
                                width: `${getProgressStatus(selectedProcedure).percentage}%`,
                              }}
                            ></div>
                          </div>
                          <p className='text-xs text-gray-500 text-center'>
                            {getProgressStatus(selectedProcedure).percentage ===
                            100
                              ? 'Procédure terminée !'
                              : 'Votre procédure avance...'}
                          </p>
                        </div>

                        <div>
                          <h4 className='text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide'>
                            ÉTAPES DE LA PROCÉDURE
                          </h4>
                          <div className='space-y-2'>
                            {selectedProcedure.steps.map(
                              (step: UserProcedureStep) => (
                                <div
                                  key={step.nom}
                                  className='flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group'
                                >
                                  <div className='flex-shrink-0'>
                                    {getStepStatusIcon(step.statut)}
                                  </div>
                                  <div className='flex-1 min-w-0'>
                                    <div className='flex items-center justify-between'>
                                      <h5 className='font-medium text-gray-800 text-sm group-hover:text-gray-900'>
                                        {getStepDisplayName(step.nom)}
                                      </h5>
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${getStepStatusColor(step.statut)}`}
                                      >
                                        {getStepDisplayStatus(step.statut)}
                                      </span>
                                    </div>
                                    <div className='text-xs text-gray-500 mt-1'>
                                      <span>
                                        Démarrée le{' '}
                                        {formatProcedureDate(step.dateCreation)}
                                      </span>
                                      {step.dateMaj &&
                                        step.statut !== StepStatus.PENDING && (
                                          <span>
                                            {' '}
                                            • Mise à jour le{' '}
                                            {formatProcedureDate(step.dateMaj)}
                                          </span>
                                        )}
                                    </div>
                                    {step.raisonRefus && (
                                      <div className='mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg'>
                                        <p className='text-orange-700 text-xs'>
                                          <strong>Raison du rejet :</strong>{' '}
                                          {step.raisonRefus}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <div className='grid grid-cols-1 gap-4'>
                          <div className='bg-gray-50 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
                              <User className='w-4 h-4 text-gray-500' />
                              INFORMATIONS PERSONNELLES
                            </h4>
                            <div className='grid grid-cols-1 gap-2 text-sm'>
                              <div className='flex justify-between py-1'>
                                <span className='text-gray-500'>
                                  Nom complet
                                </span>
                                <span className='text-gray-800 font-medium'>
                                  {selectedProcedure.prenom}{' '}
                                  {selectedProcedure.nom}
                                </span>
                              </div>
                              <div className='flex justify-between py-1'>
                                <span className='text-gray-500'>Email</span>
                                <span className='text-gray-800 font-medium'>
                                  {selectedProcedure.email}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className='bg-gray-50 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
                              <FileText className='w-4 h-4 text-gray-500' />
                              INFORMATIONS ACADÉMIQUES
                            </h4>
                            <div className='grid grid-cols-1 gap-2 text-sm'>
                              <div className='flex justify-between py-1'>
                                <span className='text-gray-500'>
                                  Destination
                                </span>
                                <span className='text-gray-800 font-medium'>
                                  {selectedProcedure.destination}
                                </span>
                              </div>
                              {selectedProcedure.niveauEtude && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>
                                    Niveau d&apos;étude
                                  </span>
                                  <span className='text-gray-800 font-medium'>
                                    {selectedProcedure.niveauEtude}
                                  </span>
                                </div>
                              )}
                              {selectedProcedure.filiere && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>
                                    Filière
                                  </span>
                                  <span className='text-gray-800 font-medium'>
                                    {selectedProcedure.filiere}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className='bg-gray-50 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
                              <Calendar className='w-4 h-4 text-gray-500' />
                              DATES IMPORTANTES
                            </h4>
                            <div className='space-y-2 text-sm'>
                              <div className='flex justify-between py-1'>
                                <span className='text-gray-500'>Création</span>
                                <span className='text-gray-800 font-medium'>
                                  {formatProcedureDate(
                                    selectedProcedure.createdAt
                                  )}
                                </span>
                              </div>
                              {selectedProcedure.dateCompletion && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>
                                    Terminaison
                                  </span>
                                  <span className='text-gray-800 font-medium'>
                                    {formatProcedureDate(
                                      selectedProcedure.dateCompletion
                                    )}
                                  </span>
                                </div>
                              )}
                              {selectedProcedure.dateDerniereModification && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>
                                    Dernière mise à jour
                                  </span>
                                  <span className='text-gray-800 font-medium'>
                                    {formatProcedureDate(
                                      selectedProcedure.dateDerniereModification
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {selectedProcedure.rendezVousId &&
                          typeof selectedProcedure.rendezVousId !==
                            'string' && (
                            <div className='bg-sky-50 rounded-xl p-4 border border-sky-200'>
                              <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2'>
                                <Calendar className='w-4 h-4 text-sky-500' />
                                RENDEZ-VOUS ASSOCIÉ
                              </h4>
                              <div className='space-y-2 text-sm'>
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>
                                    Consultant
                                  </span>
                                  <span className='text-gray-800 font-medium'>
                                    {selectedProcedure.rendezVousId.firstName}{' '}
                                    {selectedProcedure.rendezVousId.lastName}
                                  </span>
                                </div>
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>Date</span>
                                  <span className='text-gray-800 font-medium'>
                                    {formatProcedureDate(
                                      selectedProcedure.rendezVousId.date
                                    )}
                                  </span>
                                </div>
                                <div className='flex justify-between py-1'>
                                  <span className='text-gray-500'>Statut</span>
                                  <span className='text-gray-800 font-medium capitalize'>
                                    {selectedProcedure.rendezVousId.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                        {selectedProcedure.raisonRejet && (
                          <div className='bg-orange-50 border border-orange-200 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2'>
                              <AlertCircle className='w-4 h-4' />
                              RAISON DU REJET
                            </h4>
                            <p className='text-orange-700 text-sm'>
                              {selectedProcedure.raisonRejet}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className='bg-white rounded-2xl shadow-sm p-8 text-center'>
              <div className='w-20 h-20 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-6'>
                <FileText className='w-10 h-10 text-sky-500' />
              </div>
              <h3 className='text-xl font-semibold text-gray-800 mb-3'>
                Aucune procédure trouvée
              </h3>
              <p className='text-gray-600 mb-6'>
                {searchTerm || statusFilter !== 'ALL'
                  ? 'Aucune procédure ne correspond à vos critères.'
                  : 'Vous n&apos;avez aucune procédure en cours.'}
              </p>
              <div className='flex flex-col sm:flex-row gap-3 justify-center'>
                <button
                  onClick={() => navigate('/rendez-vous')}
                  className='px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors font-medium shadow-lg'
                >
                  Prendre un rendez-vous
                </button>
                {(searchTerm || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('ALL');
                    }}
                    className='px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium'
                  >
                    Voir toutes les procédures
                </button>
                )}
              </div>
            </div>
          )}
        </main>

        {showMobileDetails && selectedProcedure && (
          <div className='lg:hidden fixed inset-0 bg-white z-50 overflow-y-auto'>
            <div className='sticky top-0 bg-white border-b border-gray-200 p-4'>
              <div className='flex items-center justify-between'>
                <button
                  onClick={() => setShowMobileDetails(false)}
                  className='p-2 hover:bg-gray-100 rounded-xl transition-colors'
                >
                  <ChevronRight className='w-5 h-5 rotate-180' />
                </button>
                <h2 className='text-lg font-semibold text-gray-800'>
                  Détails
                </h2>
                <div className='w-10'></div>
              </div>
            </div>

            <div className='p-4'>
              <div className='p-4'>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h1 className='text-2xl font-bold text-gray-800 mb-1'>
                      {selectedProcedure.destination}
                    </h1>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${getProcedureStatusColor(selectedProcedure.statut)}`}
                      >
                        {getProcedureDisplayStatus(selectedProcedure.statut)}
                      </span>
                      <span className='text-gray-500 text-sm'>
                        {formatProcedureDate(selectedProcedure.createdAt)}
                      </span>
                    </div>
                  </div>
                  {canCancelProcedure(selectedProcedure) && (
                    <button
                      onClick={() => {
                        setProcedureToCancel(selectedProcedure);
                        setShowCancelModal(true);
                      }}
                      className='p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors'
                    >
                      <XCircle className='w-6 h-6' />
                    </button>
                  )}
                </div>

                <div className='bg-sky-50 rounded-2xl p-4 mb-6'>
                  <div className='flex justify-between items-center mb-3'>
                    <span className='text-sm font-medium text-gray-700'>
                      Progression globale
                    </span>
                    <span className='text-sm text-gray-600'>
                      {getProgressStatus(selectedProcedure).completed}/
                      {getProgressStatus(selectedProcedure).total} étapes
                    </span>
                  </div>
                  <div className='w-full bg-sky-200 rounded-full h-3'>
                    <div
                      className='bg-sky-500 h-3 rounded-full transition-all duration-500'
                      style={{
                        width: `${getProgressStatus(selectedProcedure).percentage}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <section className='mb-8'>
                  <h2 className='text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2'>
                    <FileText className='w-5 h-5 text-sky-500' />
                    Étapes de la procédure
                  </h2>
                  <div className='space-y-3'>
                    {selectedProcedure.steps.map((step: UserProcedureStep) => (
                      <div
                        key={step.nom}
                        className='bg-white border border-gray-200 rounded-2xl p-4 transition-all hover:shadow-sm'
                      >
                        <div className='flex items-start gap-3'>
                          <div className='flex-shrink-0 mt-1'>
                            {getStepStatusIcon(step.statut)}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center justify-between mb-2'>
                              <h3 className='font-medium text-gray-800 text-sm'>
                                {getStepDisplayName(step.nom)}
                              </h3>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getStepStatusColor(step.statut)}`}
                              >
                                {getStepDisplayStatus(step.statut)}
                              </span>
                            </div>

                            <div className='text-xs text-gray-500 space-y-1'>
                              <p>
                                Démarrée le{' '}
                                {formatProcedureDate(step.dateCreation)}
                              </p>
                              {step.dateMaj &&
                                step.statut !== StepStatus.PENDING && (
                                  <p>
                                    Mise à jour le{' '}
                                    {formatProcedureDate(step.dateMaj)}
                                  </p>
                                )}
                            </div>

                            {step.raisonRefus && (
                              <div className='mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg'>
                                <p className='text-orange-700 text-xs'>
                                  <strong>Raison :</strong> {step.raisonRefus}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {canCancelProcedure(selectedProcedure) && (
                  <div className='sticky bottom-6 bg-white border border-gray-200 rounded-2xl p-4 shadow-lg'>
                    <button
                      onClick={() => {
                        setProcedureToCancel(selectedProcedure);
                        setShowCancelModal(true);
                      }}
                      className='w-full px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-medium flex items-center justify-center gap-2 active:scale-95'
                    >
                      <XCircle className='w-5 h-5' />
                      Annuler cette procédure
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showCancelModal && procedureToCancel && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-4 z-50 sm:items-center sm:p-6'>
            <div className='bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto'>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>
                Confirmer l'annulation
              </h3>
              <p className='text-gray-600 mb-4'>
                Êtes-vous sûr de vouloir annuler votre procédure pour{' '}
                {procedureToCancel.destination} ?
              </p>

              <div className='mb-4'>
                <label
                  htmlFor='cancelReason'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Raison de l'annulation
                </label>
                <textarea
                  id='cancelReason'
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder='Veuillez nous dire pourquoi vous souhaitez annuler cette procédure ?'
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none resize-none text-sm'
                  rows={3}
                />
              </div>

              <div className='flex gap-3'>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setProcedureToCancel(null);
                    setCancelReason('');
                  }}
                  disabled={cancelLoading}
                  className='flex-1 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium rounded-xl border border-gray-300 hover:border-gray-400'
                >
                  Retour
                </button>
                <button
                  onClick={handleCancelProcedure}
                  disabled={cancelLoading}
                  className='flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50'
                >
                  {cancelLoading ? (
                    <>
                      <RefreshCw className='w-4 h-4 animate-spin' />
                      Annulation...
                    </>
                  ) : (
                    <>
                      <XCircle className='w-4 h-4' />
                      Confirmer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className='lg:hidden fixed bottom-6 right-6'>
          <button
            onClick={() => refetchProcedures()}
            disabled={proceduresLoading}
            className='w-14 h-14 bg-sky-500 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center hover:bg-sky-600 active:scale-95 disabled:opacity-50'
          >
            <RefreshCw
              className={`w-6 h-6 ${proceduresLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>
    </>
  );
};

export default UserProcedureComponent;