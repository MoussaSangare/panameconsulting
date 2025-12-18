/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Trash2,
  Plus,
  User,
  Mail,
  Phone,
  GraduationCap,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  MoreVertical,
  Loader2,
  CheckCircle,
  XCircle,
  Edit,
  Save,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { AdminRendezVousService, createAdminRendezVousService, RendezvousStatus, AdminOpinion } from '../../api/admin/AdminRendezVousService';
import { destinationService } from '../../api/admin/AdminDestionService';

// Interface pour les destinations de l'API
interface Destination {
  _id: string;
  country: string;
  imagePath: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface pour les rendez-vous (en utilisant les types du service)
interface Rendezvous {
  id: string;  // L'API retourne 'id' au lieu de '_id'
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  date: string;
  time: string;
  status: RendezvousStatus;
  destination: string;
  destinationAutre?: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre?: string;
  avisAdmin?: AdminOpinion;
  createdAt: string;
  updatedAt: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

// Interface pour la création de rendez-vous
interface CreateRendezVousData {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  date: string;
  time: string;
  destination: string;
  destinationAutre: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre: string;
}

const AdminRendezVous = (): React.JSX.Element => {
  const { access_token, user } = useAuth();
  const [service, setService] = useState<AdminRendezVousService | null>(null);
  const [rendezvous, setRendezvous] = useState<Rendezvous[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [selectedRendezVous, setSelectedRendezVous] = useState<Rendezvous | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('tous');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(8);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [showAvisModal, setShowAvisModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    id: string;
    status: RendezvousStatus;
  } | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState<string | null>(null);
  const [editingRendezvous, setEditingRendezvous] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<Partial<Rendezvous>>({});

  // États pour la création d'un rendez-vous
  const [newRendezVous, setNewRendezVous] = useState<CreateRendezVousData>({
    firstName: '',
    lastName: '',
    email: '',
    telephone: '',
    date: '',
    time: '',
    destination: '',
    destinationAutre: '',
    niveauEtude: '',
    filiere: '',
    filiereAutre: '',
  });

  // Fonction pour basculer les actions mobiles
  const toggleMobileActions = (id: string) => {
    setShowMobileActions(prev => prev === id ? null : id);
  };

  // Mettre à jour le service quand le token change
  useEffect(() => {
    if (access_token) {
      const fetchWithAuth = async (endpoint: string, options?: RequestInit) => {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`,
            ...options?.headers,
          },
        });
        return response;
      };
      
      setService(createAdminRendezVousService(fetchWithAuth));
    }
  }, [access_token]);

  // Récupérer les destinations depuis l'API
  const fetchDestinations = async () => {
    setIsLoadingDestinations(true);
    try {
      const dests = await destinationService.getAllDestinationsWithoutPagination();
      const compatibleDestinations: Destination[] = dests.map(dest => ({
        _id: dest._id,
        country: dest.country,
        imagePath: dest.imagePath,
        text: dest.text,
        createdAt: dest.createdAt || new Date().toISOString(),
        updatedAt: dest.updatedAt || new Date().toISOString(),
      }));
      setDestinations(compatibleDestinations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des destinations';
      toast.error(errorMessage);
    } finally {
      setIsLoadingDestinations(false);
    }
  };

  // Vérifier si un rendez-vous peut être supprimé
  const canDeleteRendezvous = (rdv: Rendezvous): { canDelete: boolean; message?: string } => {
    const isAdmin = user?.role === 'admin';
    if (isAdmin) {
      return { canDelete: true };
    }
    
    // Si déjà annulé, on ne peut pas "re-annuler"
    if (rdv.status === 'Annulé') {
      return { canDelete: false, message: 'Rendez-vous déjà annulé' };
    }
    
    const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
    const now = new Date();
    const diffMs = rdvDateTime.getTime() - now.getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    
    if (diffMs <= twoHoursMs) {
      return {
        canDelete: false,
        message: "Vous ne pouvez plus annuler votre rendez-vous à moins de 2 heures de l'heure prévue",
      };
    }
    return { canDelete: true };
  };

  // Récupération des rendez-vous
  const loadRendezvous = async () => {
    if (!service) return;
    
    setIsLoading(true);
    try {
      const result = await service.fetchAllRendezvous(page, limit, {
        status: selectedStatus === 'tous' ? undefined : (selectedStatus as RendezvousStatus),
        search: searchTerm || undefined,
      });
      
      // Normaliser les données - l'API retourne 'id' au lieu de '_id'
      const normalizedRendezvous = result.data?.map((rdv: any) => ({
        id: rdv.id || rdv._id, // Prendre 'id' ou '_id' selon ce qui existe
        firstName: rdv.firstName,
        lastName: rdv.lastName,
        email: rdv.email,
        telephone: rdv.telephone,
        date: rdv.date,
        time: rdv.time,
        status: rdv.status,
        destination: rdv.destination,
        destinationAutre: rdv.destinationAutre,
        niveauEtude: rdv.niveauEtude,
        filiere: rdv.filiere,
        filiereAutre: rdv.filiereAutre,
        avisAdmin: rdv.avisAdmin,
        createdAt: rdv.createdAt,
        updatedAt: rdv.updatedAt,
        cancellationReason: rdv.cancellationReason,
        cancelledAt: rdv.cancelledAt,
        cancelledBy: rdv.cancelledBy,
      })) || [];
      
      setRendezvous(normalizedRendezvous);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Mise à jour du statut
  const handleUpdateStatus = async (id: string, status: RendezvousStatus, avisAdmin?: AdminOpinion) => {
    if (!service) {
      toast.error('Service non disponible');
      return;
    }

    if (!id || id.trim() === '') {
      toast.error('ID du rendez-vous invalide');
      return;
    }

    const rdvExists = rendezvous.find(rdv => rdv.id === id);
    if (!rdvExists) {
      toast.error('Rendez-vous non trouvé dans la liste locale');
      return;
    }

    try {
      const updatedRdv = await service.updateRendezvousStatus(
        id,
        status,
        avisAdmin
      );

      // Normaliser la réponse
      const normalizedRdv = {
        id: updatedRdv.id || (updatedRdv as any)._id,
        firstName: updatedRdv.firstName,
        lastName: updatedRdv.lastName,
        email: updatedRdv.email,
        telephone: updatedRdv.telephone,
        date: updatedRdv.date,
        time: updatedRdv.time,
        status: updatedRdv.status,
        destination: updatedRdv.destination,
        destinationAutre: (updatedRdv as any).destinationAutre,
        niveauEtude: updatedRdv.niveauEtude,
        filiere: updatedRdv.filiere,
        filiereAutre: (updatedRdv as any).filiereAutre,
        avisAdmin: updatedRdv.avisAdmin,
        createdAt: updatedRdv.createdAt,
        updatedAt: updatedRdv.updatedAt,
      };

      // Mettre à jour la liste des rendez-vous
      setRendezvous(prev => prev.map(rdv => 
        rdv.id === id 
          ? { ...rdv, status: normalizedRdv.status, avisAdmin: normalizedRdv.avisAdmin }
          : rdv
      ));

      if (selectedRendezVous?.id === id) {
        setSelectedRendezVous({
          ...selectedRendezVous,
          status: normalizedRdv.status,
          avisAdmin: normalizedRdv.avisAdmin,
        });
      }

      setShowAvisModal(false);
      setPendingStatusUpdate(null);
      setShowMobileActions(null);

      let successMessage = `Statut mis à jour: ${status}`;
      if (status === 'Terminé' && avisAdmin) {
        successMessage += ` (Avis: ${avisAdmin})`;
      }

      toast.success(successMessage);
    } catch (error: any) {
      let errorMessage = 'Une erreur est survenue lors de la mise à jour';

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('401')) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
        } else if (errorMessage.includes('403')) {
          errorMessage = 'Accès refusé. Vous devez être administrateur.';
        } else if (errorMessage.includes('404')) {
          errorMessage = 'Rendez-vous non trouvé.';
        } else if (errorMessage.includes('avis admin')) {
          errorMessage = "L'avis administratif est obligatoire pour terminer un rendez-vous.";
        }
      }

      toast.error(errorMessage);
      setShowAvisModal(false);
      setPendingStatusUpdate(null);
      setShowMobileActions(null);
    }
  };

  // Mise à jour complète d'un rendez-vous
  const handleUpdateRendezvous = async (id: string) => {
    if (!service) {
      toast.error('Service non disponible');
      return;
    }

    if (!id || id.trim() === '') {
      toast.error('ID du rendez-vous manquant ou invalide');
      return;
    }

    try {
      const updatedRdv = await service.updateRendezvous(
        id,
        editingForm,
        user?.email || '',
        true
      );

      // Normaliser la réponse
      const normalizedRdv = {
        id: updatedRdv.id || (updatedRdv as any)._id,
        firstName: updatedRdv.firstName,
        lastName: updatedRdv.lastName,
        email: updatedRdv.email,
        telephone: updatedRdv.telephone,
        date: updatedRdv.date,
        time: updatedRdv.time,
        status: updatedRdv.status,
        destination: updatedRdv.destination,
        destinationAutre: (updatedRdv as any).destinationAutre,
        niveauEtude: updatedRdv.niveauEtude,
        filiere: updatedRdv.filiere,
        filiereAutre: (updatedRdv as any).filiereAutre,
        avisAdmin: updatedRdv.avisAdmin,
        createdAt: updatedRdv.createdAt,
        updatedAt: updatedRdv.updatedAt,
      };

      setRendezvous(prev => prev.map(rdv => 
        rdv.id === id ? normalizedRdv : rdv
      ));

      setEditingRendezvous(null);
      setEditingForm({});

      toast.success('Rendez-vous mis à jour avec succès');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    }
  };

  // Gestion du changement de statut via select
  const handleStatusChange = (id: string, newStatus: string) => {
    if (!id || id.trim() === '') {
      toast.error('Erreur: ID du rendez-vous manquant ou invalide');
      return;
    }

    const rdvExists = rendezvous.find(rdv => rdv.id === id);
    if (!rdvExists) {
      toast.error('Erreur: Rendez-vous non trouvé dans la liste locale');
      return;
    }

    if (newStatus === 'Terminé') {
      setPendingStatusUpdate({ id, status: newStatus as RendezvousStatus });
      setShowAvisModal(true);
    } else {
      handleUpdateStatus(id, newStatus as RendezvousStatus);
    }
  };

  // Gestion de la sélection d'avis
  const handleAvisSelection = (avis: AdminOpinion) => {
    if (!pendingStatusUpdate) {
      toast.error('Erreur: Aucune mise à jour en cours');
      return;
    }

    if (!pendingStatusUpdate.id) {
      toast.error('Erreur: ID du rendez-vous manquant');
      return;
    }

    handleUpdateStatus(pendingStatusUpdate.id, pendingStatusUpdate.status, avis);
  };

  // Suppression
  const handleDelete = async (id: string) => {
    if (!service) {
      toast.error('Service non disponible');
      return;
    }

    if (!id || id === 'undefined') {
      toast.error('ID du rendez-vous invalide');
      return;
    }

    const rdvToDelete = rendezvous.find(rdv => rdv.id === id);
    if (!rdvToDelete) {
      toast.error('Rendez-vous non trouvé');
      return;
    }

    if (user?.role !== 'admin') {
      const { canDelete, message } = canDeleteRendezvous(rdvToDelete);
      if (!canDelete) {
        toast.error(message || 'Suppression non autorisée');
        setShowDeleteModal(null);
        setShowMobileActions(null);
        return;
      }
    }
    
    try {
      await service.cancelRendezvous(id, user?.email || '', true);
      setRendezvous(prev => prev.filter(rdv => rdv.id !== id));
      
      if (selectedRendezVous?.id === id) {
        setSelectedRendezVous(null);
      }
      
      setShowDeleteModal(null);
      setShowMobileActions(null);
      toast.success('Rendez-vous annulé avec succès');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    }
  };

  // Création d'un nouveau rendez-vous
  const handleCreateRendezVous = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) {
      toast.error('Service non disponible');
      return;
    }

    try {
      const createdRdv = await service.createRendezvous(newRendezVous, user?.email || '', true);
      
      // Normaliser la réponse
      const normalizedRdv = {
        id: createdRdv.id || (createdRdv as any)._id,
        firstName: createdRdv.firstName,
        lastName: createdRdv.lastName,
        email: createdRdv.email,
        telephone: createdRdv.telephone,
        date: createdRdv.date,
        time: createdRdv.time,
        status: createdRdv.status,
        destination: createdRdv.destination,
        destinationAutre: (createdRdv as any).destinationAutre,
        niveauEtude: createdRdv.niveauEtude,
        filiere: createdRdv.filiere,
        filiereAutre: (createdRdv as any).filiereAutre,
        avisAdmin: createdRdv.avisAdmin,
        createdAt: createdRdv.createdAt,
        updatedAt: createdRdv.updatedAt,
      };
      
      setRendezvous(prev => [normalizedRdv, ...prev]);
      setNewRendezVous({
        firstName: '',
        lastName: '',
        email: '',
        telephone: '',
        date: '',
        time: '',
        destination: '',
        destinationAutre: '',
        niveauEtude: '',
        filiere: '',
        filiereAutre: '',
      });
      setShowCreateModal(false);
      toast.success('Rendez-vous créé avec succès');
      
      const dates = await service.fetchAvailableDates();
      setAvailableDates(dates);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    }
  };

  // Gestion du changement de date pour charger les créneaux disponibles
  const handleDateChange = async (date: string) => {
    if (!service) return;
    
    setNewRendezVous(prev => ({
      ...prev,
      date,
      time: '',
    }));
    
    if (date) {
      try {
        const slots = await service.fetchAvailableSlots(date);
        setAvailableSlots(slots);
      } catch (error) {
        setAvailableSlots([]);
      }
    } else {
      setAvailableSlots([]);
    }
  };

  // Initialisation
  useEffect(() => {
    const initialize = async () => {
      if (!service) return;
      
      try {
        await Promise.all([
          loadRendezvous(),
          (async () => {
            try {
              const dates = await service.fetchAvailableDates();
              setAvailableDates(dates);
            } catch (error) {
              setAvailableDates([]);
            }
          })(),
          fetchDestinations(),
        ]);
      } catch (error) {
        // Silencieux en production
      }
    };
    
    if (service) {
      initialize();
    }
  }, [service, page, searchTerm, selectedStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmé':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'En attente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Annulé':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Terminé':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAvisColor = (avis: string) => {
    switch (avis) {
      case 'Favorable':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Défavorable':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatTime = (timeStr: string) => {
    return timeStr.replace(':', 'h');
  };

  const statuts = ['tous', 'En attente', 'Confirmé', 'Terminé', 'Annulé'];
  const avisOptions: AdminOpinion[] = ['Favorable', 'Défavorable'];
  const niveauxEtude = ['Bac', 'Bac+1', 'Bac+2', 'Licence', 'Master I', 'Master II', 'Doctorat'];
  const filieres = ['Informatique', 'Médecine', 'Ingénierie', 'Droit', 'Commerce', 'Autre'];

  // Options de destination depuis l'API + "Autre"
  const destinationOptions = [...destinations.map(dest => dest.country), 'Autre'];

  // Fonction pour démarrer l'édition d'un rendez-vous
  const startEditing = (rdv: Rendezvous) => {
    setEditingRendezvous(rdv.id);
    setEditingForm({
      firstName: rdv.firstName,
      lastName: rdv.lastName,
      email: rdv.email,
      telephone: rdv.telephone,
      destination: rdv.destination,
      destinationAutre: rdv.destinationAutre,
      niveauEtude: rdv.niveauEtude,
      filiere: rdv.filiere,
      filiereAutre: rdv.filiereAutre,
    });
  };

  // Fonction pour fermer tous les menus ouverts
  const closeAllMenus = () => {
    setShowMobileActions(null);
    setShowMobileFilters(false);
    if (editingRendezvous && Object.keys(editingForm).length === 0) {
      setEditingRendezvous(null);
    }
  };

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gestion des Rendez-vous - Paname Consulting</title>
        <meta
          name='description'
          content="Interface d'administration pour gérer les rendez-vous des utilisateurs sur Paname Consulting. Accès réservé aux administrateurs."
        />
        <meta name='robots' content='noindex, nofollow' />
      </Helmet>
      
      <div className='min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30' onClick={closeAllMenus}>
        {/* Container principal */}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'>
          
          {/* En-tête mobile-first */}
          <div className='mb-6'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <Calendar className='w-7 h-7 sm:w-8 sm:h-8 text-sky-600' />
                  <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800'>
                    Gestion des Rendez-vous
                  </h1>
                </div>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className='px-4 py-2.5 sm:px-5 sm:py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center gap-2 justify-center focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 active:scale-95'
                >
                  <Plus className='w-4 h-4 sm:w-5 sm:h-5' />
                  <span className='hidden sm:inline'>Nouveau RDV</span>
                  <span className='sm:hidden'>Nouveau</span>
                </button>
              </div>
              
              <p className='text-sm sm:text-base text-slate-600'>
                Consultez et gérez tous les rendez-vous du système
              </p>
            </div>
          </div>

          {/* Barre de recherche et filtres - Mobile First */}
          <div className='bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6'>
            <div className='flex flex-col gap-4'>
              {/* Barre de recherche */}
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5' />
                <input
                  type='text'
                  placeholder='Rechercher un rendez-vous...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent hover:border-sky-400 transition-all duration-200 text-sm sm:text-base'
                />
              </div>
              
              {/* Filtres - Layout responsive */}
              <div className='flex flex-col sm:flex-row gap-3'>
                {/* Bouton filtre mobile */}
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className='sm:hidden flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 rounded-lg hover:border-sky-400 transition-all duration-200'
                >
                  <Filter className='w-4 h-4' />
                  <span>Filtrer</span>
                  {showMobileFilters ? (
                    <ChevronUp className='w-4 h-4' />
                  ) : (
                    <ChevronDown className='w-4 h-4' />
                  )}
                </button>
                
                {/* Filtre de statut - toujours visible sur desktop */}
                <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:block sm:flex-1 sm:max-w-xs`}>
                  <div className='relative'>
                    <Filter className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <select
                      value={selectedStatus}
                      onChange={e => setSelectedStatus(e.target.value)}
                      className='w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent hover:border-sky-400 transition-all duration-200 appearance-none text-sm sm:text-base'
                    >
                      {statuts.map(statut => (
                        <option key={statut} value={statut}>
                          {statut === 'tous' ? 'Tous les statuts' : statut}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className='absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none' />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des rendez-vous - Mobile Cards */}
          <div className='lg:hidden'>
            {isLoading ? (
              <div className='bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center'>
                <Loader2 className='w-8 h-8 animate-spin text-sky-500 mx-auto' />
                <p className='text-slate-600 mt-3 text-sm'>Chargement des rendez-vous...</p>
              </div>
            ) : rendezvous.length === 0 ? (
              <div className='bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center'>
                <Calendar className='w-12 h-12 mx-auto mb-4 text-slate-400' />
                <p className='text-slate-600 font-medium'>Aucun rendez-vous trouvé</p>
                <p className='text-sm text-slate-500 mt-1'>
                  Essayez de modifier vos critères de recherche
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {rendezvous.map((rdv, index) => {
                  const { canDelete } = canDeleteRendezvous(rdv);
                  const isEditing = editingRendezvous === rdv.id;
                  
                  return (
                    <div 
                      key={`rdv-${rdv.id || index}-${index}`}
                      className='bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-200'
                    >
                      <div className='p-4'>
                        {/* En-tête avec nom et actions */}
                        <div className='flex justify-between items-start mb-4'>
                          <div className='flex-1 min-w-0'>
                            {isEditing ? (
                              <div className='space-y-2'>
                                <div className='flex gap-2'>
                                  <input
                                    type='text'
                                    value={editingForm.firstName || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, firstName: e.target.value }))}
                                    className='flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    placeholder='Prénom'
                                  />
                                  <input
                                    type='text'
                                    value={editingForm.lastName || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, lastName: e.target.value }))}
                                    className='flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    placeholder='Nom'
                                  />
                                </div>
                                <input
                                  type='email'
                                  value={editingForm.email || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, email: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Email'
                                />
                              </div>
                            ) : (
                              <>
                                <div className='flex items-center gap-2 mb-1'>
                                  <User className='w-4 h-4 text-slate-400 flex-shrink-0' />
                                  <h3 className='font-semibold text-slate-800 truncate'>
                                    {rdv.firstName} {rdv.lastName}
                                  </h3>
                                </div>
                                <div className='flex items-center gap-2 text-xs text-slate-600 mb-1 truncate'>
                                  <Mail className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                  <span className='truncate'>{rdv.email}</span>
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className='relative flex-shrink-0 ml-2'>
                            {isEditing ? (
                              <button
                                onClick={() => handleUpdateRendezvous(rdv.id)}
                                className='p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500'
                              >
                                <Save className='w-4 h-4' />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(rdv);
                                  }}
                                  className='p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 mr-1'
                                >
                                  <Edit className='w-4 h-4 text-slate-400' />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMobileActions(rdv.id);
                                  }}
                                  className='p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500'
                                >
                                  <MoreVertical className='w-4 h-4 text-slate-400' />
                                </button>
                              </>
                            )}
                            
                            {showMobileActions === rdv.id && (
                              <div className='absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-48 animate-in fade-in slide-in-from-top-2 duration-200'>
                                <div className='p-2'>
                                  <select
                                    value={rdv.status}
                                    onChange={e => {
                                      e.stopPropagation();
                                      handleStatusChange(rdv.id, e.target.value);
                                      setShowMobileActions(null);
                                    }}
                                    className={`w-full px-3 py-2 text-xs font-medium border rounded focus:outline-none focus:ring-2 focus:ring-sky-500 ${getStatusColor(rdv.status)}`}
                                  >
                                    <option value='En attente'>En attente</option>
                                    <option value='Confirmé'>Confirmé</option>
                                    <option value='Terminé'>Terminé</option>
                                    <option value='Annulé'>Annulé</option>
                                  </select>
                                </div>
                                
                                <div className='border-t border-slate-200'>
                                  <button
                                    onClick={() => {
                                      setShowDeleteModal(rdv.id);
                                      setShowMobileActions(null);
                                    }}
                                    disabled={!canDelete && user?.role !== 'admin'}
                                    className={`w-full px-3 py-2 text-xs flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                      canDelete || user?.role === 'admin'
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                    <Trash2 className='w-3 h-3' />
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Informations du rendez-vous */}
                        {isEditing ? (
                          <div className='space-y-3 mb-4'>
                            <div className='grid grid-cols-2 gap-2'>
                              <div>
                                <label className='text-xs text-slate-500 mb-1 block'>Téléphone</label>
                                <input
                                  type='tel'
                                  value={editingForm.telephone || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, telephone: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                />
                              </div>
                              <div>
                                <label className='text-xs text-slate-500 mb-1 block'>Niveau</label>
                                <select
                                  value={editingForm.niveauEtude || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, niveauEtude: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                >
                                  <option value=''>Sélectionner</option>
                                  {niveauxEtude.map(niveau => (
                                    <option key={niveau} value={niveau}>{niveau}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className='text-xs text-slate-500 mb-1 block'>Destination</label>
                              <select
                                value={editingForm.destination || ''}
                                onChange={(e) => setEditingForm(prev => ({ ...prev, destination: e.target.value }))}
                                className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                              >
                                <option value=''>Sélectionner</option>
                                {destinationOptions.map(dest => (
                                  <option key={dest} value={dest}>{dest}</option>
                                ))}
                              </select>
                              {editingForm.destination === 'Autre' && (
                                <input
                                  type='text'
                                  value={editingForm.destinationAutre || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, destinationAutre: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Précisez la destination'
                                />
                              )}
                            </div>
                            <div>
                              <label className='text-xs text-slate-500 mb-1 block'>Filière</label>
                              <select
                                value={editingForm.filiere || ''}
                                onChange={(e) => setEditingForm(prev => ({ ...prev, filiere: e.target.value }))}
                                className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                              >
                                <option value=''>Sélectionner</option>
                                {filieres.map(filiere => (
                                  <option key={filiere} value={filiere}>{filiere}</option>
                                ))}
                              </select>
                              {editingForm.filiere === 'Autre' && (
                                <input
                                  type='text'
                                  value={editingForm.filiereAutre || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, filiereAutre: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Précisez la filière'
                                />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className='grid grid-cols-2 gap-4 text-sm mb-4'>
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2'>
                                <Calendar className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {new Date(rdv.date).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <Clock className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {formatTime(rdv.time)}
                                </span>
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2'>
                                <MapPin className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {rdv.destination === 'Autre' && rdv.destinationAutre
                                    ? rdv.destinationAutre
                                    : rdv.destination}
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <BookOpen className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {rdv.filiere === 'Autre' && rdv.filiereAutre
                                    ? rdv.filiereAutre
                                    : rdv.filiere}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Badges de statut */}
                        <div className='flex flex-wrap gap-2 pt-3 border-t border-slate-200'>
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(rdv.status)}`}
                          >
                            {rdv.status}
                          </span>
                          {rdv.status === 'Terminé' && rdv.avisAdmin && (
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${getAvisColor(rdv.avisAdmin)}`}
                            >
                              {rdv.avisAdmin === 'Favorable' ? (
                                <CheckCircle className='w-3 h-3' />
                              ) : (
                                <XCircle className='w-3 h-3' />
                              )}
                              {rdv.avisAdmin}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Version desktop - Table */}
          <div className='hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead className='bg-slate-50 border-b border-slate-200'>
                  <tr>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Contact
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Date & Heure
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Destination & Filière
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Statut
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-200'>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className='px-6 py-12 text-center'>
                        <div className='flex flex-col items-center justify-center gap-3'>
                          <Loader2 className='w-8 h-8 animate-spin text-sky-500' />
                          <span className='text-slate-600'>
                            Chargement des rendez-vous...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : rendezvous.length === 0 ? (
                    <tr>
                      <td colSpan={5} className='px-6 py-12 text-center'>
                        <Calendar className='w-16 h-16 mx-auto mb-4 text-slate-400' />
                        <p className='text-slate-600 font-medium'>
                          Aucun rendez-vous trouvé
                        </p>
                        <p className='text-sm text-slate-500 mt-1'>
                          Essayez de modifier vos critères de recherche
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rendezvous.map((rdv, index) => {
                      const { canDelete } = canDeleteRendezvous(rdv);
                      const isEditing = editingRendezvous === rdv.id;
                      
                      return (
                        <tr 
                          key={`rdv-${rdv.id || index}-${index}`}
                          className='hover:bg-slate-50/50 transition-colors duration-150'
                        >
                          <td className='px-6 py-4'>
                            {isEditing ? (
                              <div className='space-y-2'>
                                <div className='flex gap-2'>
                                  <input
                                    type='text'
                                    value={editingForm.firstName || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, firstName: e.target.value }))}
                                    className='flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    placeholder='Prénom'
                                  />
                                  <input
                                    type='text'
                                    value={editingForm.lastName || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, lastName: e.target.value }))}
                                    className='flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    placeholder='Nom'
                                  />
                                </div>
                                <input
                                  type='email'
                                  value={editingForm.email || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, email: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Email'
                                />
                                <input
                                  type='tel'
                                  value={editingForm.telephone || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, telephone: e.target.value }))}
                                  className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Téléphone'
                                />
                              </div>
                            ) : (
                              <div className='space-y-1'>
                                <div className='flex items-center gap-2'>
                                  <User className='w-4 h-4 text-slate-400 flex-shrink-0' />
                                  <span className='font-medium text-slate-800'>
                                    {rdv.firstName} {rdv.lastName}
                                  </span>
                                </div>
                                <div className='flex items-center gap-2 text-sm'>
                                  <Mail className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                  <span className='text-slate-700 truncate'>{rdv.email}</span>
                                </div>
                                <div className='flex items-center gap-2 text-sm'>
                                  <Phone className='w-3 h-3 text-slate-400 flex-shrink-0' />
                                  <span className='text-slate-700'>{rdv.telephone}</span>
                                </div>
                              </div>
                            )}
                          </td>
                          
                          <td className='px-6 py-4'>
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2'>
                                <Calendar className='w-4 h-4 text-slate-400 flex-shrink-0' />
                                <span className='text-slate-700 font-medium'>
                                  {new Date(rdv.date).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <Clock className='w-4 h-4 text-slate-400 flex-shrink-0' />
                                <span className='text-slate-700'>
                                  {formatTime(rdv.time)}
                                </span>
                              </div>
                            </div>
                          </td>
                          
                          <td className='px-6 py-4'>
                            {isEditing ? (
                              <div className='space-y-2'>
                                <div>
                                  <label className='text-xs text-slate-500 mb-1 block'>Destination</label>
                                  <select
                                    value={editingForm.destination || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, destination: e.target.value }))}
                                    className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                                  >
                                    <option value=''>Sélectionner</option>
                                    {destinationOptions.map(dest => (
                                      <option key={dest} value={dest}>{dest}</option>
                                    ))}
                                  </select>
                                  {editingForm.destination === 'Autre' && (
                                    <input
                                      type='text'
                                      value={editingForm.destinationAutre || ''}
                                      onChange={(e) => setEditingForm(prev => ({ ...prev, destinationAutre: e.target.value }))}
                                      className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                      placeholder='Précisez la destination'
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className='text-xs text-slate-500 mb-1 block'>Filière</label>
                                  <select
                                    value={editingForm.filiere || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, filiere: e.target.value }))}
                                    className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                                  >
                                    <option value=''>Sélectionner</option>
                                    {filieres.map(filiere => (
                                      <option key={filiere} value={filiere}>{filiere}</option>
                                    ))}
                                  </select>
                                  {editingForm.filiere === 'Autre' && (
                                    <input
                                      type='text'
                                      value={editingForm.filiereAutre || ''}
                                      onChange={(e) => setEditingForm(prev => ({ ...prev, filiereAutre: e.target.value }))}
                                      className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                      placeholder='Précisez la filière'
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className='text-xs text-slate-500 mb-1 block'>Niveau d'étude</label>
                                  <select
                                    value={editingForm.niveauEtude || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, niveauEtude: e.target.value }))}
                                    className='w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  >
                                    <option value=''>Sélectionner</option>
                                    {niveauxEtude.map(niveau => (
                                      <option key={niveau} value={niveau}>{niveau}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <div className='space-y-2'>
                                <div className='flex items-start gap-2'>
                                  <MapPin className='w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0' />
                                  <div className='min-w-0'>
                                    <div className='font-medium text-slate-800'>Destination</div>
                                    <div className='text-sm text-slate-600 truncate'>
                                      {rdv.destination === 'Autre' && rdv.destinationAutre
                                        ? rdv.destinationAutre
                                        : rdv.destination}
                                    </div>
                                  </div>
                                </div>
                                <div className='flex items-start gap-2'>
                                  <BookOpen className='w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0' />
                                  <div className='min-w-0'>
                                    <div className='font-medium text-slate-800'>Filière</div>
                                    <div className='text-sm text-slate-600 truncate'>
                                      {rdv.filiere === 'Autre' && rdv.filiereAutre
                                        ? rdv.filiereAutre
                                        : rdv.filiere}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                          
                          <td className='px-6 py-4'>
                            <div className='space-y-2'>
                              <select
                                value={rdv.status}
                                onChange={e => {
                                  e.stopPropagation();
                                  handleStatusChange(rdv.id, e.target.value);
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-sky-400 transition-all duration-200 ${getStatusColor(rdv.status)}`}
                              >
                                <option value='En attente'>En attente</option>
                                <option value='Confirmé'>Confirmé</option>
                                <option value='Terminé'>Terminé</option>
                                <option value='Annulé'>Annulé</option>
                              </select>
                              {rdv.status === 'Terminé' && rdv.avisAdmin && (
                                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 ${getAvisColor(rdv.avisAdmin)}`}>
                                  {rdv.avisAdmin === 'Favorable' ? (
                                    <CheckCircle className='w-3 h-3 flex-shrink-0' />
                                  ) : (
                                    <XCircle className='w-3 h-3 flex-shrink-0' />
                                  )}
                                  {rdv.avisAdmin}
                                </div>
                              )}
                            </div>
                          </td>
                          
                          <td className='px-6 py-4'>
                            <div className='flex items-center gap-2'>
                              {isEditing ? (
                                <button
                                  onClick={() => handleUpdateRendezvous(rdv.id)}
                                  className='p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500'
                                >
                                  <Save className='w-4 h-4' />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(rdv);
                                  }}
                                  className='p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500'
                                >
                                  <Edit className='w-4 h-4 text-slate-400' />
                                </button>
                              )}
                              
                              <div className='relative'>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMobileActions(rdv.id);
                                  }}
                                  className='p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500'
                                >
                                  <MoreVertical className='w-4 h-4 text-slate-400' />
                                </button>
                                
                                {showMobileActions === rdv.id && (
                                  <div className='absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-48 animate-in fade-in slide-in-from-top-2 duration-200'>
                                    <div className='p-2'>
                                      <div className='text-xs font-medium text-slate-500 mb-2 px-2'>Actions</div>
                                      <div className='space-y-1'>
                                        <button
                                          onClick={() => {
                                            setShowDeleteModal(rdv.id);
                                            setShowMobileActions(null);
                                          }}
                                          disabled={!canDelete && user?.role !== 'admin'}
                                          className={`w-full px-3 py-2 text-sm flex items-center gap-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                            canDelete || user?.role === 'admin'
                                              ? 'text-red-600 hover:bg-red-50'
                                              : 'text-slate-400 cursor-not-allowed'
                                          }`}
                                        >
                                          <Trash2 className='w-4 h-4' />
                                          Supprimer
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex justify-center items-center gap-2 mt-6'>
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className='px-3 py-2 rounded-lg border border-slate-300 hover:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500'
              >
                Précédent
              </button>
              <span className='text-sm text-slate-600 px-3'>
                Page {page} sur {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className='px-3 py-2 rounded-lg border border-slate-300 hover:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500'
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={(e) => e.stopPropagation()}>
          <div className='bg-white rounded-2xl shadow-xl max-w-sm w-full mx-auto animate-in fade-in zoom-in-95 duration-200'>
            <div className='p-5 border-b border-slate-200'>
              <div className='flex items-center gap-3'>
                <AlertCircle className='w-6 h-6 text-red-500 flex-shrink-0' />
                <h2 className='text-lg font-bold text-slate-800'>
                  Confirmer la suppression
                </h2>
              </div>
              <p className='text-sm text-slate-600 mt-2'>
                Êtes-vous sûr de vouloir supprimer ce rendez-vous ? Cette action est irréversible.
              </p>
            </div>
            <div className='p-5 flex justify-end gap-3'>
              <button
                type='button'
                onClick={() => setShowDeleteModal(null)}
                className='px-4 py-2.5 text-slate-700 bg-white rounded-lg border border-slate-300 hover:bg-slate-50 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500'
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal)}
                className='px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:scale-95'
              >
                <Trash2 className='w-4 h-4' />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de sélection d'avis pour le statut "Terminé" */}
      {showAvisModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={(e) => e.stopPropagation()}>
          <div className='bg-white rounded-2xl shadow-xl max-w-xs w-full mx-auto animate-in fade-in zoom-in-95 duration-200'>
            <div className='p-5 border-b border-slate-200'>
              <div className='flex items-center gap-2'>
                <AlertCircle className='w-5 h-5 text-blue-500 flex-shrink-0' />
                <h2 className='text-base font-bold text-slate-800'>
                  Avis Administratif
                </h2>
              </div>
              <p className='text-xs text-slate-600 mt-1'>
                Sélectionnez un avis pour terminer le rendez-vous
              </p>
            </div>
            <div className='p-5 space-y-3'>
              <div className='grid grid-cols-1 gap-3'>
                {avisOptions.map(avis => (
                  <button
                    key={avis}
                    onClick={() => handleAvisSelection(avis)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-sky-400 active:scale-95 ${
                      avis === 'Favorable'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <div className='font-semibold text-sm flex items-center justify-between'>
                      <span>{avis}</span>
                      {avis === 'Favorable' ? (
                        <CheckCircle className='w-4 h-4 text-emerald-600 flex-shrink-0' />
                      ) : (
                        <XCircle className='w-4 h-4 text-rose-600 flex-shrink-0' />
                      )}
                    </div>
                    <div className='text-xs mt-1 opacity-75'>
                      {avis === 'Favorable'
                        ? 'Procédure créée'
                        : 'Critères non remplis'}
                    </div>
                  </button>
                ))}
              </div>
              <div className='flex justify-end gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => {
                    setShowAvisModal(false);
                    setPendingStatusUpdate(null);
                  }}
                  className='px-4 py-2 text-sm text-slate-700 bg-white rounded-lg border border-slate-300 hover:bg-slate-50 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500'
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de création de rendez-vous */}
      {showCreateModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={(e) => e.stopPropagation()}>
          <div className='bg-white rounded-2xl shadow-xl max-w-md w-full mx-auto animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto'>
            <div className='p-5 border-b border-slate-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Plus className='w-5 h-5 text-sky-500' />
                  <h2 className='text-lg font-bold text-slate-800'>
                    Créer un nouveau rendez-vous
                  </h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className='p-1 rounded-lg hover:bg-slate-100 transition-colors'
                >
                  <X className='w-5 h-5 text-slate-400' />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateRendezVous} className='p-5'>
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium text-slate-700 mb-1 block'>
                      Prénom *
                    </label>
                    <input
                      type='text'
                      value={newRendezVous.firstName}
                      onChange={e => setNewRendezVous(prev => ({ ...prev, firstName: e.target.value }))}
                      className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                      required
                    />
                  </div>
                  <div>
                    <label className='text-sm font-medium text-slate-700 mb-1 block'>
                      Nom *
                    </label>
                    <input
                      type='text'
                      value={newRendezVous.lastName}
                      onChange={e => setNewRendezVous(prev => ({ ...prev, lastName: e.target.value }))}
                      className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className='text-sm font-medium text-slate-700 mb-1 block'>
                    Email *
                  </label>
                  <input
                    type='email'
                    value={newRendezVous.email}
                    onChange={e => setNewRendezVous(prev => ({ ...prev, email: e.target.value }))}
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                    required
                  />
                </div>
                
                <div>
                  <label className='text-sm font-medium text-slate-700 mb-1 block'>
                    Téléphone *
                  </label>
                  <input
                    type='tel'
                    value={newRendezVous.telephone}
                    onChange={e => setNewRendezVous(prev => ({ ...prev, telephone: e.target.value }))}
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                    required
                  />
                </div>
                
                <div>
                  <label className='text-sm font-medium text-slate-700 mb-1 block'>
                    Destination *
                  </label>
                  <select
                    value={newRendezVous.destination}
                    onChange={e => setNewRendezVous(prev => ({ ...prev, destination: e.target.value, destinationAutre: '' }))}
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                    required
                  >
                    <option value=''>Sélectionner une destination</option>
                    {destinationOptions.map(dest => (
                      <option key={dest} value={dest}>{dest}</option>
                    ))}
                  </select>
                  {newRendezVous.destination === 'Autre' && (
                    <input
                      type='text'
                      value={newRendezVous.destinationAutre}
                      onChange={e => setNewRendezVous(prev => ({ ...prev, destinationAutre: e.target.value }))}
                      className='w-full px-3 py-2 border border-slate-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-sky-500'
                      placeholder='Précisez la destination'
                      required
                    />
                  )}
                </div>
                
                <div>
                  <label className='text-sm font-medium text-slate-700 mb-1 block'>
                    Niveau d'étude *
                  </label>
                  <select
                    value={newRendezVous.niveauEtude}
                    onChange={e => setNewRendezVous(prev => ({ ...prev, niveauEtude: e.target.value }))}
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                    required
                  >
                    <option value=''>Sélectionner un niveau</option>
                    {niveauxEtude.map(niveau => (
                      <option key={niveau} value={niveau}>{niveau}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className='text-sm font-medium text-slate-700 mb-1 block'>
                    Filière *
                  </label>
                  <select
                    value={newRendezVous.filiere}
                    onChange={e => setNewRendezVous(prev => ({ ...prev, filiere: e.target.value, filiereAutre: '' }))}
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                    required
                  >
                    <option value=''>Sélectionner une filière</option>
                    {filieres.map(filiere => (
                      <option key={filiere} value={filiere}>{filiere}</option>
                    ))}
                  </select>
                  {newRendezVous.filiere === 'Autre' && (
                    <input
                      type='text'
                      value={newRendezVous.filiereAutre}
                      onChange={e => setNewRendezVous(prev => ({ ...prev, filiereAutre: e.target.value }))}
                      className='w-full px-3 py-2 border border-slate-300 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-sky-500'
                      placeholder='Précisez la filière'
                      required
                    />
                  )}
                </div>
                
                <div>
                  <label className='text-sm font-medium text-slate-700 mb-1 block'>
                    Date *
                  </label>
                  <input
                    type='date'
                    value={newRendezVous.date}
                    onChange={e => handleDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                    required
                  />
                </div>
                
                {newRendezVous.date && (
                  <div>
                    <label className='text-sm font-medium text-slate-700 mb-1 block'>
                      Heure *
                    </label>
                    <select
                      value={newRendezVous.time}
                      onChange={e => setNewRendezVous(prev => ({ ...prev, time: e.target.value }))}
                      className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500'
                      required
                    >
                      <option value=''>Sélectionner un créneau</option>
                      {availableSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                      {availableSlots.length === 0 && newRendezVous.date && (
                        <option value='' disabled>Aucun créneau disponible</option>
                      )}
                    </select>
                  </div>
                )}
              </div>
              
              <div className='flex justify-end gap-3 mt-6 pt-5 border-t border-slate-200'>
                <button
                  type='button'
                  onClick={() => setShowCreateModal(false)}
                  className='px-4 py-2 text-slate-700 bg-white rounded-lg border border-slate-300 hover:bg-slate-50 transition-all duration-200 font-medium'
                >
                  Annuler
                </button>
                <button
                  type='submit'
                  disabled={!newRendezVous.time || availableSlots.length === 0}
                  className='px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Créer le rendez-vous
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminRendezVous;