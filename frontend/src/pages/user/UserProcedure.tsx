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
  Home,
  User,
  Calendar,
  FileText,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Search,
  Filter,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// Note: UserProcedure est déjà importé depuis ProcedureService
// Créons un alias pour le composant principal
const UserProcedureComponent = (): React.JSX.Element => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState<number>(1);
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
  const [hasAccess, setHasAccess] = useState<boolean>(true);

  const limit = 8;

  const {
    procedures: paginatedProcedures,
    loading: proceduresLoading,
    error: proceduresError,
    refetch: refetchProcedures,
  } = useUserProcedures(currentPage, limit);

  const { procedure: detailedProcedure, error: detailsError } =
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

  // === EFFETS DE GESTION D'AUTHENTIFICATION SIMPLIFIÉE ===

  useEffect(() => {
    // Vérification basique d'authentification
    if (!isAuthenticated) {
      console.log('🚫 Non authentifié, redirection vers login');
      navigate('/connexion');
      return;
    }

    // Vérification si l'utilisateur est actif
    if (user && !user.isActive) {
      console.log('🚫 Compte inactif, déconnexion');
      logout();
      setHasAccess(false);
      return;
    }

    setHasAccess(true);
  }, [isAuthenticated, user, navigate, logout]);

  // === GESTION DES ERREURS DE SESSION ===
  useEffect(() => {
    // Vérifier si l'erreur est une erreur de session (détectée par le service)
    if (
      proceduresError === 'SESSION_EXPIRED' ||
      detailsError === 'SESSION_EXPIRED'
    ) {
      console.log('🔒 Session expirée détectée par le service');
      logout();
      return;
    }
  }, [proceduresError, detailsError, logout]);

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
      // L'erreur est déjà gérée par le service (toast affiché)
      // Si c'est une erreur de session, le service a déjà appelé logout()
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

  // === RENDU ===

  // Écran d'accès refusé
  if (!hasAccess) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4'>
        <div className='text-center max-w-sm'>
          <div className='w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6'>
            <AlertCircle className='w-10 h-10 text-red-500' />
          </div>
          <h2 className='text-2xl font-bold text-slate-800 mb-3'>
            Accès révoqué
          </h2>
          <p className='text-slate-600 mb-6'>
            Votre compte est temporairement désactivé. Contactez
            l'administrateur.
          </p>
          <button
            onClick={() => logout()}
            className='inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl'
          >
            Se reconnecter
          </button>
        </div>
      </div>
    );
  }

  // Écran de session expirée
  if (!isAuthenticated || !user) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4'>
        <div className='text-center max-w-sm'>
          <div className='w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6'>
            <AlertCircle className='w-10 h-10 text-orange-500' />
          </div>
          <h2 className='text-2xl font-bold text-slate-800 mb-3'>
            Session expirée
          </h2>
          <p className='text-slate-600 mb-6'>
            Votre session a expiré. Veuillez vous reconnecter.
          </p>
          <button
            onClick={() => navigate('/connexion')}
            className='inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl'
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const totalPages = paginatedProcedures?.totalPages || 1;

  return (
    <>
      <Helmet>
        <title>Procédures Utilisateurs - Paname Consulting</title>
        <meta
          name='description'
          content="Prenez rendez-vous avec un conseiller Paname Consulting pour discuter de votre projet d'études à l'étranger."
        />
        <meta
          name='keywords'
          content="rendez-vous, études à l'étranger, conseiller, orientation"
        />
        <link
          rel='canonical'
          href='https://panameconsulting.vercel.app/user-procedure'
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

      <div className='min-h-screen bg-slate-50'>
        <header className='bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50'>
          <div className='px-4 py-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <button
                  onClick={() => navigate('/')}
                  className='p-2 hover:bg-slate-100 rounded-xl transition-colors'
                >
                  <Home className='w-5 h-5 text-slate-600' />
                </button>
                <div>
                  <h1 className='text-lg font-semibold text-slate-800'>
                    Mes Procédures
                  </h1>
                  <p className='text-xs text-slate-500'>
                    Connecté en tant que {user?.firstName} {user?.lastName}
                  </p>
                </div>
              </div>

              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => refetchProcedures()}
                  disabled={proceduresLoading}
                  className='p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50'
                >
                  <RefreshCw
                    className={`w-5 h-5 text-slate-600 ${proceduresLoading ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  onClick={() => navigate('/rendez-vous')}
                  className='p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg'
                >
                  <Plus className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='mt-3 space-y-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400' />
                <input
                  type='text'
                  placeholder='Rechercher une procédure...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-none focus:outline-none hover:border-blue-500 focus:border-blue-500 outline-none transition-all'
                />
              </div>

              <div className='flex items-center justify-between'>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className='flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-800 transition-colors'
                >
                  <Filter className='w-4 h-4' />
                  <span className='text-sm font-medium'>Filtrer</span>
                </button>

                <span className='text-sm text-slate-500'>
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
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-500'
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
          </div>
        </header>

        <nav className='bg-white border-b border-slate-200 sticky top-[136px] z-40'>
          <div className='flex overflow-x-auto px-4 py-2 space-x-1 hide-scrollbar'>
            {[
              { to: '/user-profile', icon: User, label: 'Profil' },
              { to: '/user-rendez-vous', icon: Calendar, label: 'Rendez-vous' },
              {
                to: '/user-procedure',
                icon: FileText,
                label: 'Procédures',
                active: true,
              },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  item.active
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon className='w-4 h-4 mr-2' />
                <span className='text-sm font-medium'>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <main className='p-4 max-w-6xl mx-auto'>
          {proceduresLoading ? (
            <div className='bg-white rounded-2xl shadow-sm p-8 text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4'></div>
              <p className='text-slate-600'>Chargement de vos procédures...</p>
            </div>
          ) : proceduresError && proceduresError !== 'SESSION_EXPIRED' ? (
            <div className='bg-white rounded-2xl shadow-sm p-6 text-center'>
              <div className='w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                <AlertCircle className='w-8 h-8 text-red-500' />
              </div>
              <h3 className='text-lg font-semibold text-slate-800 mb-2'>
                Erreur de chargement
              </h3>
              <p className='text-slate-600 mb-4'>
                Impossible de charger vos procédures. Veuillez réessayer.
              </p>
              <button
                onClick={() => refetchProcedures()}
                className='px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium'
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
                      className='bg-white rounded-2xl shadow-sm border border-slate-200 p-4 cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]'
                      onClick={() => handleSelectProcedure(procedure)}
                    >
                      <div className='flex items-start justify-between mb-3'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-2'>
                            <h3 className='font-semibold text-slate-800 text-base truncate'>
                              {procedure.destination}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getProcedureStatusColor(procedure.statut)}`}
                            >
                              {getProcedureDisplayStatus(procedure.statut)}
                            </span>
                          </div>

                          <div className='text-slate-600 text-sm space-y-1'>
                            <p className='truncate'>
                              {procedure.prenom} {procedure.nom}
                            </p>
                            <p className='text-xs'>
                              Créée le{' '}
                              {formatProcedureDate(procedure.createdAt)}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className='w-5 h-5 text-slate-400 flex-shrink-0 ml-2' />
                      </div>

                      <div className='mb-3'>
                        <div className='flex justify-between text-xs text-slate-600 mb-1'>
                          <span>Avancement</span>
                          <span>
                            {progress.completed}/{progress.total} étapes
                          </span>
                        </div>
                        <div className='w-full bg-slate-200 rounded-full h-2'>
                          <div
                            className='bg-blue-500 h-2 rounded-full transition-all duration-300'
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
                              <span className='text-slate-700 flex-1 truncate'>
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
                          <div className='text-center text-xs text-slate-500 pt-1'>
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
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className='p-2 bg-white border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors'
                    >
                      <ChevronRight className='w-4 h-4 rotate-180' />
                    </button>

                    <span className='text-sm text-slate-600 font-medium'>
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={() =>
                        setCurrentPage(prev => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                      className='p-2 bg-white border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors'
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
                  <div className='bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6'>
                    <div className='space-y-6'>
                      <div className='flex items-start justify-between'>
                        <h3 className='text-lg font-semibold text-slate-800'>
                          Détails de la procédure
                        </h3>
                        <button
                          onClick={() => setSelectedProcedure(null)}
                          className='text-slate-400 hover:text-slate-600 transition-colors p-1'
                        >
                          <XCircle className='w-5 h-5' />
                        </button>
                      </div>

                      <div className='space-y-6'>
                        <div className='flex items-start justify-between'>
                          <div>
                            <h3 className='text-xl font-semibold text-slate-800 mb-2'>
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
                              <span className='text-slate-500 text-sm'>
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

                        <div className='bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100'>
                          <div className='flex justify-between items-center mb-3'>
                            <span className='text-sm font-medium text-slate-700'>
                              Progression globale
                            </span>
                            <span className='text-sm text-slate-600 font-medium'>
                              {getProgressStatus(selectedProcedure).completed}/
                              {getProgressStatus(selectedProcedure).total}{' '}
                              étapes
                            </span>
                          </div>
                          <div className='w-full bg-blue-200 rounded-full h-2.5 mb-2'>
                            <div
                              className='bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-700'
                              style={{
                                width: `${getProgressStatus(selectedProcedure).percentage}%`,
                              }}
                            ></div>
                          </div>
                          <p className='text-xs text-slate-500 text-center'>
                            {getProgressStatus(selectedProcedure).percentage ===
                            100
                              ? 'Procédure terminée !'
                              : 'Votre procédure avance...'}
                          </p>
                        </div>

                        <div>
                          <h4 className='text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide'>
                            ÉTAPES DE LA PROCÉDURE
                          </h4>
                          <div className='space-y-2'>
                            {selectedProcedure.steps.map(
                              (step: UserProcedureStep) => (
                                <div
                                  key={step.nom}
                                  className='flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group'
                                >
                                  <div className='flex-shrink-0'>
                                    {getStepStatusIcon(step.statut)}
                                  </div>
                                  <div className='flex-1 min-w-0'>
                                    <div className='flex items-center justify-between'>
                                      <h5 className='font-medium text-slate-800 text-sm group-hover:text-slate-900'>
                                        {getStepDisplayName(step.nom)}
                                      </h5>
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${getStepStatusColor(step.statut)}`}
                                      >
                                        {getStepDisplayStatus(step.statut)}
                                      </span>
                                    </div>
                                    <div className='text-xs text-slate-500 mt-1'>
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
                          <div className='bg-slate-50 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2'>
                              <User className='w-4 h-4 text-slate-500' />
                              INFORMATIONS PERSONNELLES
                            </h4>
                            <div className='grid grid-cols-1 gap-2 text-sm'>
                              <div className='flex justify-between py-1'>
                                <span className='text-slate-500'>
                                  Nom complet
                                </span>
                                <span className='text-slate-800 font-medium'>
                                  {selectedProcedure.prenom}{' '}
                                  {selectedProcedure.nom}
                                </span>
                              </div>
                              <div className='flex justify-between py-1'>
                                <span className='text-slate-500'>Email</span>
                                <span className='text-slate-800 font-medium'>
                                  {selectedProcedure.email}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className='bg-slate-50 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2'>
                              <FileText className='w-4 h-4 text-slate-500' />
                              INFORMATIONS ACADÉMIQUES
                            </h4>
                            <div className='grid grid-cols-1 gap-2 text-sm'>
                              <div className='flex justify-between py-1'>
                                <span className='text-slate-500'>
                                  Destination
                                </span>
                                <span className='text-slate-800 font-medium'>
                                  {selectedProcedure.destination}
                                </span>
                              </div>
                              {selectedProcedure.niveauEtude && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>
                                    Niveau d&apos;étude
                                  </span>
                                  <span className='text-slate-800 font-medium'>
                                    {selectedProcedure.niveauEtude}
                                  </span>
                                </div>
                              )}
                              {selectedProcedure.filiere && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>
                                    Filière
                                  </span>
                                  <span className='text-slate-800 font-medium'>
                                    {selectedProcedure.filiere}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className='bg-slate-50 rounded-xl p-4'>
                            <h4 className='text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2'>
                              <Calendar className='w-4 h-4 text-slate-500' />
                              DATES IMPORTANTES
                            </h4>
                            <div className='space-y-2 text-sm'>
                              <div className='flex justify-between py-1'>
                                <span className='text-slate-500'>Création</span>
                                <span className='text-slate-800 font-medium'>
                                  {formatProcedureDate(
                                    selectedProcedure.createdAt
                                  )}
                                </span>
                              </div>
                              {selectedProcedure.dateCompletion && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>
                                    Terminaison
                                  </span>
                                  <span className='text-slate-800 font-medium'>
                                    {formatProcedureDate(
                                      selectedProcedure.dateCompletion
                                    )}
                                  </span>
                                </div>
                              )}
                              {selectedProcedure.dateDerniereModification && (
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>
                                    Dernière mise à jour
                                  </span>
                                  <span className='text-slate-800 font-medium'>
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
                            <div className='bg-blue-50 rounded-xl p-4 border border-blue-200'>
                              <h4 className='text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2'>
                                <Calendar className='w-4 h-4 text-blue-500' />
                                RENDEZ-VOUS ASSOCIÉ
                              </h4>
                              <div className='space-y-2 text-sm'>
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>
                                    Consultant
                                  </span>
                                  <span className='text-slate-800 font-medium'>
                                    {selectedProcedure.rendezVousId.firstName}{' '}
                                    {selectedProcedure.rendezVousId.lastName}
                                  </span>
                                </div>
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>Date</span>
                                  <span className='text-slate-800 font-medium'>
                                    {formatProcedureDate(
                                      selectedProcedure.rendezVousId.date
                                    )}
                                  </span>
                                </div>
                                <div className='flex justify-between py-1'>
                                  <span className='text-slate-500'>Statut</span>
                                  <span className='text-slate-800 font-medium capitalize'>
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
              <div className='w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6'>
                <FileText className='w-10 h-10 text-blue-500' />
              </div>
              <h3 className='text-xl font-semibold text-slate-800 mb-3'>
                Aucune procédure trouvée
              </h3>
              <p className='text-slate-600 mb-6'>
                {searchTerm || statusFilter !== 'ALL'
                  ? 'Aucune procédure ne correspond à vos critères.'
                  : 'Vous n&apos;avez aucune procédure en cours.'}
              </p>
              <div className='flex flex-col sm:flex-row gap-3 justify-center'>
                <button
                  onClick={() => navigate('/rendez-vous')}
                  className='px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium shadow-lg'
                >
                  Prendre un rendez-vous
                </button>
                {(searchTerm || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('ALL');
                    }}
                    className='px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium'
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
            <div className='sticky top-0 bg-white border-b border-slate-200 p-4'>
              <div className='flex items-center justify-between'>
                <button
                  onClick={() => setShowMobileDetails(false)}
                  className='p-2 hover:bg-slate-100 rounded-xl transition-colors'
                >
                  <ChevronRight className='w-5 h-5 rotate-180' />
                </button>
                <h2 className='text-lg font-semibold text-slate-800'>
                  Détails
                </h2>
                <div className='w-10'></div>
              </div>
            </div>

            <div className='p-4'>
              <div className='p-4'>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h1 className='text-2xl font-bold text-slate-800 mb-1'>
                      {selectedProcedure.destination}
                    </h1>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${getProcedureStatusColor(selectedProcedure.statut)}`}
                      >
                        {getProcedureDisplayStatus(selectedProcedure.statut)}
                      </span>
                      <span className='text-slate-500 text-sm'>
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

                <div className='bg-blue-50 rounded-2xl p-4 mb-6'>
                  <div className='flex justify-between items-center mb-3'>
                    <span className='text-sm font-medium text-slate-700'>
                      Progression globale
                    </span>
                    <span className='text-sm text-slate-600'>
                      {getProgressStatus(selectedProcedure).completed}/
                      {getProgressStatus(selectedProcedure).total} étapes
                    </span>
                  </div>
                  <div className='w-full bg-blue-200 rounded-full h-3'>
                    <div
                      className='bg-blue-500 h-3 rounded-full transition-all duration-500'
                      style={{
                        width: `${getProgressStatus(selectedProcedure).percentage}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <section className='mb-8'>
                  <h2 className='text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2'>
                    <FileText className='w-5 h-5 text-blue-500' />
                    Étapes de la procédure
                  </h2>
                  <div className='space-y-3'>
                    {selectedProcedure.steps.map((step: UserProcedureStep) => (
                      <div
                        key={step.nom}
                        className='bg-white border border-slate-200 rounded-2xl p-4 transition-all hover:shadow-sm'
                      >
                        <div className='flex items-start gap-3'>
                          <div className='flex-shrink-0 mt-1'>
                            {getStepStatusIcon(step.statut)}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center justify-between mb-2'>
                              <h3 className='font-medium text-slate-800 text-sm'>
                                {getStepDisplayName(step.nom)}
                              </h3>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getStepStatusColor(step.statut)}`}
                              >
                                {getStepDisplayStatus(step.statut)}
                              </span>
                            </div>

                            <div className='text-xs text-slate-500 space-y-1'>
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
                  <div className='sticky bottom-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-lg'>
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
              <h3 className='text-lg font-semibold text-slate-800 mb-2'>
                Confirmer l'annulation
              </h3>
              <p className='text-slate-600 mb-4'>
                Êtes-vous sûr de vouloir annuler votre procédure pour{' '}
                {procedureToCancel.destination} ?
              </p>

              <div className='mb-4'>
                <label
                  htmlFor='cancelReason'
                  className='block text-sm font-medium text-slate-700 mb-2'
                >
                  Raison de l'annulation
                </label>
                <textarea
                  id='cancelReason'
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder='Veuillez nous dire pourquoi vous souhaitez annuler cette procédure ?'
                  className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm'
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
                  className='flex-1 px-4 py-3 text-slate-600 hover:text-slate-800 transition-colors font-medium rounded-xl border border-slate-300 hover:border-slate-400'
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
            className='w-14 h-14 bg-blue-500 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center hover:bg-blue-600 active:scale-95 disabled:opacity-50'
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
