import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';

// Import des icônes Lucide
import {
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
  MapPin,
  GraduationCap,
  FileText,
  Calendar,
  RefreshCw,
  BookOpen,
  Mail,
  Phone,
  Globe,
  BarChart3,
  Info,
  Archive,
  UserCircle,
  TrendingUp,
  ListChecks,
} from 'lucide-react';

// Import du service et hooks personnalisés
import {
  ProcedureService,
  useProcedureService,
  useProcedureActions,
  Procedure,
  ProcedureStatus,
  StepStatus,
  StepName,
  ProcedureFilters,
  PaginatedResponse,
  StatsResponse,
} from '../../api/admin/AdminProcedureService';

// ==================== COMPOSANT PRINCIPAL ====================
const AdminProcedure: React.FC = () => {
  // Utilisation du hook personnalisé
  const procedureService = useProcedureService();
  const {
    loading: actionLoading,
    // Remove unused variable: error: actionError,
    withErrorHandling,
  } = useProcedureActions(procedureService);

  // États
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Filtres
  const [filters, setFilters] = useState<ProcedureFilters>({
    email: '',
    statut: '',
    destination: '',
    filiere: '',
  });

  // Modal states
  const [activeModal, setActiveModal] = useState<
    'detail' | 'action' | 'stats' | null
  >(null);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(
    null
  );
  const [selectedStep, setSelectedStep] = useState<StepName | null>(null);
  const [actionType, setActionType] = useState<
    'complete' | 'reject' | 'delete' | null
  >(null);
  const [actionReason, setActionReason] = useState('');

  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [filterInput, setFilterInput] = useState('');
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(
    null
  );
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadProcedures();
    loadStats();
  }, [pagination.page, filters]);

  // Chargement des procédures
  const loadProcedures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await withErrorHandling<PaginatedResponse>(
        () =>
          procedureService.fetchAdminProcedures(
            pagination.page,
            pagination.limit,
            filters
          ),
        undefined
      );

      setProcedures(response.data);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    filters,
    withErrorHandling,
    procedureService,
  ]);

  // Chargement des statistiques
  const loadStats = useCallback(async () => {
    try {
      const statsData = await withErrorHandling<StatsResponse>(
        () => procedureService.getAdminProceduresOverview(),
        undefined
      );
      setStats(statsData);
    } catch (err) {
      // Only log errors in development
      if (import.meta.env.DEV) {
        console.error('Erreur chargement stats:', err);
      }
    }
  }, [withErrorHandling, procedureService]);

  // Rafraîchissement
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await withErrorHandling(async () => {
        await Promise.all([loadProcedures(), loadStats()]);
      }, 'Données rafraîchies');
    } finally {
      setRefreshing(false);
    }
  };

  // Actions sur les étapes
  const handleCompleteStep = async (stepName: StepName) => {
    if (!selectedProcedure) return;

    const validation = ProcedureService.canModifyStep(
      selectedProcedure,
      stepName,
      StepStatus.COMPLETED
    );
    if (!validation.canModify) {
      toast.error(validation.reason);
      return;
    }

    await withErrorHandling(async () => {
      const updatedProcedure = await procedureService.updateAdminStep(
        selectedProcedure._id,
        stepName,
        {
          statut: StepStatus.COMPLETED,
          dateMaj: new Date().toISOString(),
          dateCompletion: new Date().toISOString(),
        }
      );

      setProcedures(prev =>
        prev.map(p => (p._id === selectedProcedure._id ? updatedProcedure : p))
      );

      if (selectedProcedure._id === expandedProcedure) {
        setSelectedProcedure(updatedProcedure);
      }

      return updatedProcedure;
    }, 'Étape terminée avec succès');

    closeModal();
  };

  const handleRejectStep = async () => {
    if (!selectedProcedure || !selectedStep || !actionReason.trim()) {
      toast.error('Veuillez fournir une raison pour le rejet');
      return;
    }

    if (actionReason.trim().length < 5) {
      toast.error('La raison doit contenir au moins 5 caractères');
      return;
    }

    await withErrorHandling(async () => {
      const updatedProcedure = await procedureService.updateAdminStep(
        selectedProcedure._id,
        selectedStep,
        {
          statut: StepStatus.REJECTED,
          raisonRefus: actionReason,
          dateMaj: new Date().toISOString(),
        }
      );

      setProcedures(prev =>
        prev.map(p => (p._id === selectedProcedure._id ? updatedProcedure : p))
      );

      if (selectedProcedure._id === expandedProcedure) {
        setSelectedProcedure(updatedProcedure);
      }

      return updatedProcedure;
    }, 'Étape rejetée avec succès');

    closeModal();
  };

  // Actions sur les procédures
  const handleDeleteProcedure = async () => {
    if (!selectedProcedure) return;

    await withErrorHandling(async () => {
      await procedureService.deleteAdminProcedure(
        selectedProcedure._id,
        actionReason || 'Supprimé par administrateur'
      );

      setProcedures(prev => prev.filter(p => p._id !== selectedProcedure._id));

      return true;
    }, 'Procédure supprimée avec succès');

    closeModal();
  };

  const handleRejectProcedure = async () => {
    if (!selectedProcedure || !actionReason.trim()) {
      toast.error('Veuillez fournir une raison pour le rejet');
      return;
    }

    if (actionReason.trim().length < 5) {
      toast.error('La raison doit contenir au moins 5 caractères');
      return;
    }

    await withErrorHandling(async () => {
      const updatedProcedure = await procedureService.rejectAdminProcedure(
        selectedProcedure._id,
        actionReason
      );

      setProcedures(prev =>
        prev.map(p =>
          p._id === selectedProcedure._id
            ? {
                ...p,
                statut: ProcedureStatus.REJECTED,
                raisonRejet: actionReason,
              }
            : p
        )
      );

      return updatedProcedure;
    }, 'Procédure rejetée avec succès');

    closeModal();
  };

  // Gestion des modals
  const openDetailModal = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setActiveModal('detail');
  };

  const openActionModal = (
    procedure: Procedure,
    type: 'complete' | 'reject' | 'delete',
    step?: StepName
  ) => {
    setSelectedProcedure(procedure);
    setSelectedStep(step || null);
    setActionType(type);
    setActionReason('');
    setActiveModal('action');
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedProcedure(null);
    setSelectedStep(null);
    setActionType(null);
    setActionReason('');
  };

  // Filtres
  const handleFilterChange = useCallback(
    (key: keyof ProcedureFilters, value: string) => {
      setFilters(prev => ({ ...prev, [key]: value }));
      setPagination(prev => ({ ...prev, page: 1 }));
    },
    []
  );

  const handleSearchInput = (value: string) => {
    setFilterInput(value);
    setFilters(prev => ({ ...prev, search: value }));
  };

  const resetFilters = () => {
    setFilters({
      email: '',
      statut: '',
      destination: '',
      filiere: '',
      search: '',
    });
    setFilterInput('');
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowFilters(false);
  };

  // Pagination
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Toggle expand/collapse
  const toggleExpand = (procedureId: string) => {
    setExpandedProcedure(prev => (prev === procedureId ? null : procedureId));
  };

  // Rendu du statut
  const renderStatusBadge = (status: ProcedureStatus) => {
    const color = ProcedureService.getStatusColor(status);
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      gray: 'bg-gray-50 text-gray-700 border-gray-200',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    }[color];

    const Icon =
      status === ProcedureStatus.COMPLETED
        ? CheckCircle
        : status === ProcedureStatus.REJECTED
          ? XCircle
          : Clock;

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colorClasses}`}
      >
        <Icon className='w-4 h-4 mr-2' />
        {status}
      </span>
    );
  };

  const renderStepStatus = (status: StepStatus) => {
    const color = ProcedureService.getStatusColor(status);
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      red: 'bg-red-50 text-red-600',
      gray: 'bg-gray-50 text-gray-600',
      yellow: 'bg-yellow-50 text-yellow-600',
    }[color];

    const Icon =
      status === StepStatus.COMPLETED
        ? CheckCircle
        : status === StepStatus.REJECTED || status === StepStatus.CANCELLED
          ? XCircle
          : Clock;

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded text-xs ${colorClasses}`}
      >
        <Icon className='w-3 h-3 mr-1' />
        {status}
      </span>
    );
  };

  // Calcul des statistiques locales
  const calculateLocalStats = useCallback(() => {
    return {
      total: pagination.total,
      inProgress: procedures.filter(
        p => p.statut === ProcedureStatus.IN_PROGRESS
      ).length,
      completed: procedures.filter(p => p.statut === ProcedureStatus.COMPLETED)
        .length,
      rejected: procedures.filter(p => p.statut === ProcedureStatus.REJECTED)
        .length,
      cancelled: procedures.filter(p => p.statut === ProcedureStatus.CANCELLED)
        .length,
    };
  }, [procedures, pagination.total]);

  const localStats = calculateLocalStats();

  // Loading skeleton
  if (loading && procedures.length === 0) {
    return (
      <div className='min-h-screen bg-gray-50 p-4 md:p-6'>
        <div className='animate-pulse space-y-6'>
          <div className='h-8 bg-gray-200 rounded w-1/3'></div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='h-24 bg-white rounded-xl shadow-sm'></div>
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className='h-32 bg-white rounded-xl shadow-sm'></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gestion des Procédures - Admin</title>
        <meta name='robots' content='noindex, nofollow' />
        <meta name='googlebot' content='noindex, nofollow' />
        <meta name='bingbot' content='noindex, nofollow' />
        <meta name='yandexbot' content='noindex, nofollow' />
        <meta name='duckduckbot' content='noindex, nofollow' />
        <meta name='baidu' content='noindex, nofollow' />
        <meta name='naver' content='noindex, nofollow' />
        <meta name='seznam' content='noindex, nofollow' />
      </Helmet>

      <div className='min-h-screen p-4 md:p-6'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold text-gray-900'>
                Gestion des Procédures
              </h1>
              <p className='text-gray-600 text-sm md:text-base mt-1'>
                {pagination.total} procédures au total •{' '}
                {ProcedureService.maskId('sample')}
              </p>
            </div>
            <div className='flex items-center space-x-3'>
              <button
                onClick={handleRefresh}
                disabled={refreshing || actionLoading}
                className='p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl disabled:opacity-50 transition-colors'
                title='Rafraîchir'
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className='mb-8 space-y-4'>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
            <input
              type='text'
              value={filterInput}
              onChange={e => handleSearchInput(e.target.value)}
              className='w-full pl-12 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
              placeholder='Rechercher par email, nom, prénom...'
            />
          </div>

          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='flex items-center text-sm text-gray-700 hover:text-blue-600 transition-colors'
            >
              <Filter className='w-4 h-4 mr-2' />
              Filtres avancés
            </button>

            {(filters.email ||
              filters.statut ||
              filters.destination ||
              filters.filiere ||
              filters.search) && (
              <button
                onClick={resetFilters}
                className='flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors'
              >
                <X className='w-4 h-4 mr-1' />
                Réinitialiser les filtres
              </button>
            )}
          </div>

          {showFilters && (
            <div className='bg-white p-5 rounded-xl border border-gray-200 shadow-sm'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Statut
                  </label>
                  <select
                    value={filters.statut}
                    onChange={e => handleFilterChange('statut', e.target.value)}
                    className='w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
                  >
                    <option value=''>Tous les statuts</option>
                    {Object.values(ProcedureStatus).map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Destination
                  </label>
                  <input
                    type='text'
                    value={filters.destination || ''}
                    onChange={e =>
                      handleFilterChange('destination', e.target.value)
                    }
                    className='w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
                    placeholder='Filtrer par destination...'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Filière
                </label>
                <input
                  type='text'
                  value={filters.filiere || ''}
                  onChange={e => handleFilterChange('filiere', e.target.value)}
                  className='w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
                  placeholder='Filtrer par filière...'
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          <div className='bg-gradient-to-br from-blue-50 to-white p-5 rounded-2xl border border-blue-100'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-gray-500 text-sm font-medium'>
                  En cours
                </div>
                <div className='text-2xl font-bold text-blue-600 mt-1'>
                  {localStats.inProgress}
                </div>
              </div>
              <div className='p-3 bg-blue-100 rounded-xl'>
                <Clock className='w-6 h-6 text-blue-600' />
              </div>
            </div>
          </div>

          <div className='bg-gradient-to-br from-green-50 to-white p-5 rounded-2xl border border-green-100'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-gray-500 text-sm font-medium'>
                  Terminées
                </div>
                <div className='text-2xl font-bold text-green-600 mt-1'>
                  {localStats.completed}
                </div>
              </div>
              <div className='p-3 bg-green-100 rounded-xl'>
                <CheckCircle className='w-6 h-6 text-green-600' />
              </div>
            </div>
          </div>

          <div className='bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl border border-red-100'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-gray-500 text-sm font-medium'>
                  Rejetées
                </div>
                <div className='text-2xl font-bold text-red-600 mt-1'>
                  {localStats.rejected}
                </div>
              </div>
              <div className='p-3 bg-red-100 rounded-xl'>
                <XCircle className='w-6 h-6 text-red-600' />
              </div>
            </div>
          </div>

          <div className='bg-gradient-to-br from-gray-50 to-white p-5 rounded-2xl border border-gray-100'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-gray-500 text-sm font-medium'>Total</div>
                <div className='text-2xl font-bold text-gray-900 mt-1'>
                  {localStats.total}
                </div>
              </div>
              <div className='p-3 bg-gray-100 rounded-xl'>
                <FileText className='w-6 h-6 text-gray-600' />
              </div>
            </div>
          </div>
        </div>

        {/* Procedures List */}
        <div className='space-y-4'>
          {error && (
            <div className='bg-red-50 border border-red-200 rounded-xl p-4'>
              <div className='flex items-center'>
                <AlertTriangle className='w-5 h-5 text-red-400 mr-3' />
                <p className='text-red-700 text-sm'>{error}</p>
              </div>
            </div>
          )}

          {procedures.map(procedure => (
            <div
              key={procedure._id}
              className='bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300'
            >
              {/* Header */}
              <div
                className='p-5 cursor-pointer hover:bg-gray-50 transition-colors'
                onClick={() => toggleExpand(procedure._id)}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center'>
                      <UserCircle className='w-6 h-6 text-gray-400 mr-3 flex-shrink-0' />
                      <div className='min-w-0'>
                        <h3 className='font-semibold text-gray-900 truncate'>
                          {procedure.prenom} {procedure.nom}
                        </h3>
                        <div className='flex items-center mt-1'>
                          <Mail className='w-4 h-4 text-gray-400 mr-2 flex-shrink-0' />
                          <p className='text-sm text-gray-600 truncate'>
                            {procedure.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center space-x-3 ml-4'>
                    {renderStatusBadge(procedure.statut)}
                    {expandedProcedure === procedure._id ? (
                      <ChevronUp className='w-5 h-5 text-gray-400 flex-shrink-0' />
                    ) : (
                      <ChevronDown className='w-5 h-5 text-gray-400 flex-shrink-0' />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedProcedure === procedure._id && (
                <div className='border-t border-gray-100 p-5 space-y-5'>
                  {/* Info Grid */}
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='flex items-start'>
                      <MapPin className='w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0' />
                      <div>
                        <div className='text-xs text-gray-500 font-medium'>
                          Destination
                        </div>
                        <div className='text-sm font-medium text-gray-900'>
                          {procedure.destination}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-start'>
                      <GraduationCap className='w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0' />
                      <div>
                        <div className='text-xs text-gray-500 font-medium'>
                          Filière
                        </div>
                        <div className='text-sm font-medium text-gray-900'>
                          {procedure.filiere || 'Non spécifié'}
                        </div>
                      </div>
                    </div>
                    {procedure.niveauEtude && (
                      <div className='flex items-start'>
                        <BookOpen className='w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0' />
                        <div>
                          <div className='text-xs text-gray-500 font-medium'>
                            Niveau d'étude
                          </div>
                          <div className='text-sm font-medium text-gray-900'>
                            {procedure.niveauEtude}
                          </div>
                        </div>
                      </div>
                    )}
                    {procedure.telephone && (
                      <div className='flex items-start'>
                        <Phone className='w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0' />
                        <div>
                          <div className='text-xs text-gray-500 font-medium'>
                            Téléphone
                          </div>
                          <div className='text-sm font-medium text-gray-900'>
                            {procedure.telephone}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Steps */}
                  <div>
                    <div className='flex items-center mb-4'>
                      <ListChecks className='w-5 h-5 text-gray-400 mr-2' />
                      <h4 className='text-sm font-semibold text-gray-900'>
                        Étapes de la procédure
                      </h4>
                    </div>
                    <div className='space-y-3'>
                      {procedure.steps.map(step => (
                        <div
                          key={step.nom}
                          className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center mb-1'>
                              <div className='text-sm font-medium text-gray-900 truncate'>
                                {ProcedureService.translateStepName(step.nom)}
                              </div>
                              {step.raisonRefus && (
                                <Info className='w-4 h-4 text-red-500 ml-2 flex-shrink-0' />
                              )}
                            </div>
                            <div className='text-xs text-gray-500'>
                              Dernière mise à jour:{' '}
                              {ProcedureService.formatDate(step.dateMaj)}
                            </div>
                            {step.raisonRefus && (
                              <div className='text-xs text-red-600 mt-2 p-2 bg-red-50 rounded-lg'>
                                {step.raisonRefus}
                              </div>
                            )}
                          </div>
                          <div className='flex items-center space-x-2 ml-4'>
                            {renderStepStatus(step.statut)}
                            {step.statut === StepStatus.IN_PROGRESS && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openActionModal(
                                    procedure,
                                    'complete',
                                    step.nom
                                  );
                                }}
                                className='p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors'
                                title='Terminer cette étape'
                              >
                                <CheckCircle className='w-5 h-5' />
                              </button>
                            )}
                            {[
                              StepStatus.PENDING,
                              StepStatus.IN_PROGRESS,
                            ].includes(step.statut) && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openActionModal(
                                    procedure,
                                    'reject',
                                    step.nom
                                  );
                                }}
                                className='p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors'
                                title='Rejeter cette étape'
                              >
                                <XCircle className='w-5 h-5' />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100'>
                    <button
                      onClick={() => openDetailModal(procedure)}
                      className='flex-1 flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors'
                    >
                      <Eye className='w-4 h-4 mr-2' />
                      Détails complets
                    </button>
                    <button
                      onClick={() => openActionModal(procedure, 'reject')}
                      className='flex-1 flex items-center justify-center px-4 py-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                      disabled={
                        procedure.statut === ProcedureStatus.REJECTED ||
                        procedure.statut === ProcedureStatus.CANCELLED
                      }
                    >
                      <XCircle className='w-4 h-4 mr-2' />
                      Rejeter
                    </button>
                    <button
                      onClick={() => openActionModal(procedure, 'delete')}
                      className='flex-1 flex items-center justify-center px-4 py-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors'
                    >
                      <Trash2 className='w-4 h-4 mr-2' />
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {procedures.length === 0 && !loading && (
            <div className='text-center py-16 bg-white rounded-2xl border border-gray-200'>
              <AlertTriangle className='mx-auto w-16 h-16 text-gray-400' />
              <p className='text-gray-600 mt-4 text-lg'>
                Aucune procédure trouvée
              </p>
              {(filters.email ||
                filters.statut ||
                filters.destination ||
                filters.filiere) && (
                <button
                  onClick={resetFilters}
                  className='mt-4 px-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium'
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className='flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-gray-200'>
            <div className='text-sm text-gray-600 mb-4 sm:mb-0'>
              Page {pagination.page} sur {pagination.totalPages} •{' '}
              {pagination.total} procédures
            </div>
            <div className='flex space-x-2'>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className='px-4 py-2.5 text-sm border border-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center'
              >
                <ChevronUp className='w-4 h-4 mr-2 rotate-90' />
                Précédent
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className='px-4 py-2.5 text-sm border border-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center'
              >
                Suivant
                <ChevronUp className='w-4 h-4 ml-2 -rotate-90' />
              </button>
            </div>
          </div>
        )}

        {/* Modal Overlay */}
        {(activeModal === 'detail' ||
          activeModal === 'action' ||
          activeModal === 'stats') && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
            <div className='bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl'>
              {/* Detail Modal */}
              {activeModal === 'detail' && selectedProcedure && (
                <>
                  <div className='p-6 border-b border-gray-200'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-lg font-semibold text-gray-900'>
                        Détails de la procédure
                      </h3>
                      <button
                        onClick={closeModal}
                        className='p-2 hover:bg-gray-100 rounded-xl transition-colors'
                      >
                        <X className='w-5 h-5 text-gray-500' />
                      </button>
                    </div>
                  </div>

                  <div className='p-6 overflow-y-auto max-h-[60vh] space-y-6'>
                    {/* Student Info */}
                    <div>
                      <h4 className='text-sm font-semibold text-gray-900 mb-4 flex items-center'>
                        <User className='w-4 h-4 mr-2' />
                        Informations étudiant
                      </h4>
                      <div className='space-y-4'>
                        <div className='flex items-center'>
                          <UserCircle className='w-5 h-5 text-gray-400 mr-3 flex-shrink-0' />
                          <div>
                            <div className='text-xs text-gray-500'>
                              Nom complet
                            </div>
                            <div className='text-sm font-medium'>
                              {selectedProcedure.prenom} {selectedProcedure.nom}
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center'>
                          <Mail className='w-5 h-5 text-gray-400 mr-3 flex-shrink-0' />
                          <div>
                            <div className='text-xs text-gray-500'>Email</div>
                            <div className='text-sm font-medium'>
                              {selectedProcedure.email}
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center'>
                          <MapPin className='w-5 h-5 text-gray-400 mr-3 flex-shrink-0' />
                          <div>
                            <div className='text-xs text-gray-500'>
                              Destination
                            </div>
                            <div className='text-sm font-medium'>
                              {selectedProcedure.destination}
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center'>
                          <GraduationCap className='w-5 h-5 text-gray-400 mr-3 flex-shrink-0' />
                          <div>
                            <div className='text-xs text-gray-500'>Filière</div>
                            <div className='text-sm font-medium'>
                              {selectedProcedure.filiere || 'Non spécifié'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <h4 className='text-sm font-semibold text-gray-900 mb-4 flex items-center'>
                        <TrendingUp className='w-4 h-4 mr-2' />
                        Statut global
                      </h4>
                      <div className='flex justify-center mb-4'>
                        {renderStatusBadge(selectedProcedure.statut)}
                      </div>
                      {selectedProcedure.raisonRejet && (
                        <div className='p-4 bg-red-50 rounded-xl'>
                          <div className='text-xs text-red-600 font-medium mb-1 flex items-center'>
                            <AlertTriangle className='w-3 h-3 mr-1' />
                            Raison du rejet
                          </div>
                          <div className='text-sm text-red-700'>
                            {selectedProcedure.raisonRejet}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div>
                      <h4 className='text-sm font-semibold text-gray-900 mb-4 flex items-center'>
                        <Calendar className='w-4 h-4 mr-2' />
                        Chronologie
                      </h4>
                      <div className='space-y-3'>
                        <div className='flex justify-between text-sm'>
                          <span className='text-gray-500'>Création</span>
                          <span className='font-medium'>
                            {ProcedureService.formatDate(
                              selectedProcedure.createdAt
                            )}
                          </span>
                        </div>
                        <div className='flex justify-between text-sm'>
                          <span className='text-gray-500'>
                            Dernière mise à jour
                          </span>
                          <span className='font-medium'>
                            {ProcedureService.formatDate(
                              selectedProcedure.updatedAt
                            )}
                          </span>
                        </div>
                        {selectedProcedure.dateCompletion && (
                          <div className='flex justify-between text-sm'>
                            <span className='text-gray-500'>Terminée le</span>
                            <span className='font-medium'>
                              {ProcedureService.formatDate(
                                selectedProcedure.dateCompletion
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='p-6 border-t border-gray-200'>
                    <button
                      onClick={closeModal}
                      className='w-full px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium'
                    >
                      Fermer
                    </button>
                  </div>
                </>
              )}

              {/* Action Modal */}
              {activeModal === 'action' && selectedProcedure && (
                <>
                  <div className='p-6 border-b border-gray-200'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-lg font-semibold text-gray-900'>
                          {actionType === 'complete' && "Terminer l'étape"}
                          {actionType === 'reject' && selectedStep
                            ? "Rejeter l'étape"
                            : 'Rejeter la procédure'}
                          {actionType === 'delete' && 'Supprimer la procédure'}
                        </h3>
                        {selectedStep && (
                          <p className='text-sm text-gray-600 mt-1'>
                            Étape:{' '}
                            {ProcedureService.translateStepName(selectedStep)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={closeModal}
                        className='p-2 hover:bg-gray-100 rounded-xl transition-colors'
                      >
                        <X className='w-5 h-5 text-gray-500' />
                      </button>
                    </div>
                  </div>

                  <div className='p-6'>
                    {(actionType === 'reject' || actionType === 'delete') && (
                      <div className='mb-6'>
                        <label className='text-sm font-medium text-gray-700 mb-2 flex items-center'>
                          <AlertTriangle className='w-4 h-4 mr-1' />
                          {actionType === 'reject'
                            ? 'Raison du rejet'
                            : 'Raison de la suppression'}
                          <span className='text-red-500 ml-1'>*</span>
                        </label>
                        <textarea
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          placeholder={
                            actionType === 'reject'
                              ? 'Expliquez pourquoi cette étape/procédure est rejetée (min 5 caractères)...'
                              : 'Expliquez pourquoi cette procédure est supprimée (min 5 caractères)...'
                          }
                          rows={4}
                          className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
                        />
                        <p className='text-xs text-gray-500 mt-2 flex items-center'>
                          <Info className='w-3 h-3 mr-1' />
                          Minimum 5 caractères requis
                        </p>
                      </div>
                    )}

                    {actionType === 'complete' && (
                      <div className='mb-6'>
                        <div className='p-4 bg-green-50 rounded-xl'>
                          <div className='flex items-center text-green-800'>
                            <CheckCircle className='w-5 h-5 mr-2' />
                            <p className='text-sm font-medium'>
                              Confirmez-vous la complétion de cette étape ?
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className='flex flex-col sm:flex-row gap-3'>
                      <button
                        onClick={closeModal}
                        className='flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium'
                        disabled={actionLoading}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          if (actionType === 'complete')
                            handleCompleteStep(selectedStep!);
                          else if (actionType === 'reject' && selectedStep)
                            handleRejectStep();
                          else if (actionType === 'reject')
                            handleRejectProcedure();
                          else if (actionType === 'delete')
                            handleDeleteProcedure();
                        }}
                        disabled={
                          actionLoading ||
                          ((actionType === 'reject' ||
                            actionType === 'delete') &&
                            actionReason.trim().length < 5)
                        }
                        className={`flex-1 px-4 py-3 rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                          actionType === 'complete'
                            ? 'bg-green-600 hover:bg-green-700'
                            : actionType === 'reject'
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-gray-900 hover:bg-gray-800'
                        }`}
                      >
                        {actionLoading ? (
                          <span className='flex items-center justify-center'>
                            <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
                            Traitement...
                          </span>
                        ) : (
                          <>
                            {actionType === 'complete' && 'Confirmer'}
                            {actionType === 'reject' && 'Rejeter'}
                            {actionType === 'delete' && 'Supprimer'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Stats Modal */}
              {activeModal === 'stats' && stats && (
                <>
                  <div className='p-6 border-b border-gray-200'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-lg font-semibold text-gray-900 flex items-center'>
                        <BarChart3 className='w-5 h-5 mr-2' />
                        Statistiques globales
                      </h3>
                      <button
                        onClick={closeModal}
                        className='p-2 hover:bg-gray-100 rounded-xl transition-colors'
                      >
                        <X className='w-5 h-5 text-gray-500' />
                      </button>
                    </div>
                  </div>

                  <div className='p-6 overflow-y-auto max-h-[60vh] space-y-6'>
                    {/* Total */}
                    <div className='text-center bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl'>
                      <div className='text-4xl font-bold text-gray-900'>
                        {stats.total}
                      </div>
                      <div className='text-sm text-gray-600 mt-2'>
                        Procédures totales
                      </div>
                    </div>

                    {/* By Status */}
                    <div>
                      <h4 className='text-sm font-semibold text-gray-900 mb-4'>
                        Répartition par statut
                      </h4>
                      <div className='space-y-3'>
                        {stats.byStatus.map(item => (
                          <div
                            key={item._id}
                            className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'
                          >
                            <div className='flex items-center'>
                              {item._id === ProcedureStatus.IN_PROGRESS && (
                                <Clock className='w-4 h-4 mr-3 text-blue-500' />
                              )}
                              {item._id === ProcedureStatus.COMPLETED && (
                                <CheckCircle className='w-4 h-4 mr-3 text-green-500' />
                              )}
                              {item._id === ProcedureStatus.REJECTED && (
                                <XCircle className='w-4 h-4 mr-3 text-red-500' />
                              )}
                              {item._id === ProcedureStatus.CANCELLED && (
                                <Archive className='w-4 h-4 mr-3 text-gray-500' />
                              )}
                              <span className='text-sm font-medium text-gray-900'>
                                {item._id}
                              </span>
                            </div>
                            <span className='text-lg font-bold text-blue-600'>
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* By Destination */}
                    <div>
                      <h4 className='text-sm font-semibold text-gray-900 mb-4'>
                        Répartition par destination
                      </h4>
                      <div className='space-y-3'>
                        {stats.byDestination.map(item => (
                          <div
                            key={item._id}
                            className='flex items-center justify-between p-4 bg-gray-50 rounded-xl'
                          >
                            <div className='flex items-center'>
                              <Globe className='w-4 h-4 mr-3 text-gray-500' />
                              <span className='text-sm font-medium text-gray-900 truncate'>
                                {item._id}
                              </span>
                            </div>
                            <span className='text-lg font-bold text-green-600'>
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className='p-6 border-t border-gray-200'>
                    <button
                      onClick={closeModal}
                      className='w-full px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium'
                    >
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminProcedure;
