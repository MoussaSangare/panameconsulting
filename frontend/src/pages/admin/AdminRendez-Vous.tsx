/* eslint-disable no-undef */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Briefcase,
  GraduationCap,
  Globe,
  ChevronLeft,
  ChevronRight,
  Shield,
  Check,
  X as XIcon,
  ExternalLink,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { AdminRendezVousService, createAdminRendezVousService, RendezvousStatus, AdminOpinion, Rendezvous } from '../../api/admin/AdminRendezVousService';
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

// Interface locale pour les rendez-vous (plus simple que celle du service)
interface LocalRendezvous {
  id: string;
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
  canBeCancelledByUser?: boolean;
  isPast?: boolean;
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
  destinationAutre?: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre?: string;
}

// Constantes
const EDUCATION_LEVELS = ['Bac', 'Bac+1', 'Bac+2', 'Licence', 'Master I', 'Master II', 'Doctorat'] as const;
const FILIERES = ['Informatique', 'Médecine', 'Ingénierie', 'Droit', 'Commerce', 'Autre'] as const;
const STATUTS = ['En attente', 'Confirmé', 'Terminé', 'Annulé'] as const;
const ADMIN_AVIS = ['Favorable', 'Défavorable'] as const;

const AdminRendezVous = (): React.JSX.Element => {
  const { access_token, user } = useAuth();
  const [service, setService] = useState<AdminRendezVousService | null>(null);
  const [rendezvous, setRendezvous] = useState<LocalRendezvous[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
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
  const [editingForm, setEditingForm] = useState<Partial<LocalRendezvous>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

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
  const toggleMobileActions = useCallback((id: string) => {
    setShowMobileActions(prev => prev === id ? null : id);
  }, []);

  // Fermer les menus au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowMobileActions(null);
      }
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowCreateModal(false);
        setShowDeleteModal(null);
        setShowAvisModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        createdAt: dest.createdAt?.toString(),
        updatedAt: dest.updatedAt?.toString(),
      }));
      setDestinations(compatibleDestinations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des destinations';
      toast.error(errorMessage);
    } finally {
      setIsLoadingDestinations(false);
    }
  };

  // Normaliser les données du backend vers le format local
  const normalizeRendezvous = (rdv: Rendezvous): LocalRendezvous => ({
    id: rdv.id || (rdv as any)._id || '',
    firstName: rdv.firstName || '',
    lastName: rdv.lastName || '',
    email: rdv.email || '',
    telephone: rdv.telephone || '',
    date: rdv.date || '',
    time: rdv.time || '',
    status: rdv.status || 'En attente',
    destination: rdv.destination || '',
    destinationAutre: rdv.destinationAutre,
    niveauEtude: rdv.niveauEtude || '',
    filiere: rdv.filiere || '',
    filiereAutre: rdv.filiereAutre,
    avisAdmin: rdv.avisAdmin,
    createdAt: rdv.createdAt || new Date().toISOString(),
    updatedAt: rdv.updatedAt || new Date().toISOString(),
    cancellationReason: rdv.cancellationReason,
    cancelledAt: rdv.cancelledAt,
    cancelledBy: rdv.cancelledBy,
    canBeCancelledByUser: rdv.canBeCancelledByUser,
    isPast: rdv.isPast,
  });

  // Vérifier si un rendez-vous peut être supprimé
  const canDeleteRendezvous = useCallback((rdv: LocalRendezvous): { canDelete: boolean; message?: string } => {
    const isAdmin = user?.role === 'admin';
    
    if (isAdmin) {
      return { canDelete: true };
    }
    
    if (rdv.status === 'Annulé') {
      return { canDelete: false, message: 'Rendez-vous déjà annulé' };
    }
    
    if (rdv.status === 'Terminé') {
      return { canDelete: false, message: 'Impossible de supprimer un rendez-vous terminé' };
    }
    
    if (rdv.canBeCancelledByUser !== undefined) {
      return { 
        canDelete: rdv.canBeCancelledByUser,
        message: rdv.canBeCancelledByUser ? undefined : "Vous ne pouvez plus annuler votre rendez-vous à moins de 2 heures de l'heure prévue"
      };
    }
    
    // Calcul manuel si la propriété n'est pas disponible
    if (rdv.date && rdv.time) {
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
    }
    
    return { canDelete: true };
  }, [user?.role]);

  // Récupération des rendez-vous
  const loadRendezvous = async () => {
    if (!service) return;
    
    setIsLoading(true);
    try {
      const result = await service.fetchAllRendezvous(page, limit, {
        status: selectedStatus === 'tous' ? undefined : (selectedStatus as RendezvousStatus),
        search: searchTerm.trim() || undefined,
      });
      
      const normalizedRendezvous = (result.data || []).map(normalizeRendezvous);
      
      setRendezvous(normalizedRendezvous);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue lors du chargement';
      if (!errorMessage.includes('Session expirée')) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Rafraîchir la liste
  const refreshList = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Mise à jour du statut
  const handleUpdateStatus = async (id: string, status: RendezvousStatus, avisAdmin?: AdminOpinion) => {
    if (!service || !id) {
      toast.error('Service non disponible ou ID invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedRdv = await service.updateRendezvousStatus(id, status, avisAdmin, user?.email);
      const normalizedRdv = normalizeRendezvous(updatedRdv);

      setRendezvous(prev => prev.map(rdv => 
        rdv.id === id ? { ...rdv, status: normalizedRdv.status, avisAdmin: normalizedRdv.avisAdmin } : rdv
      ));

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
        } else if (errorMessage.includes('futur')) {
          errorMessage = "Impossible de marquer comme terminé un rendez-vous futur.";
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mise à jour complète d'un rendez-vous
// Mise à jour complète d'un rendez-vous
const handleUpdateRendezvous = async (id: string) => {
  if (!service || !id) {
    toast.error('Service non disponible ou ID invalide');
    return;
  }

  setIsSubmitting(true);
  try {
    // Validation des champs "Autre"
    if (editingForm.destination === 'Autre' && (!editingForm.destinationAutre || editingForm.destinationAutre.trim() === '')) {
      toast.error('La destination "Autre" nécessite une précision');
      return;
    }
    
    if (editingForm.filiere === 'Autre' && (!editingForm.filiereAutre || editingForm.filiereAutre.trim() === '')) {
      toast.error('La filière "Autre" nécessite une précision');
      return;
    }

    // Récupérer le rendez-vous original pour les champs non modifiés
    const originalRdv = rendezvous.find(rdv => rdv.id === id);
    if (!originalRdv) {
      toast.error('Rendez-vous non trouvé');
      return;
    }

    // CORRECTION ICI : Inclure tous les champs requis pour le DTO backend
    const updateData = {
      firstName: editingForm.firstName || originalRdv.firstName,
      lastName: editingForm.lastName || originalRdv.lastName,
      email: editingForm.email || originalRdv.email,
      telephone: editingForm.telephone || originalRdv.telephone,
      destination: editingForm.destination || originalRdv.destination,
      destinationAutre: editingForm.destination === 'Autre' ? (editingForm.destinationAutre || originalRdv.destinationAutre) : undefined,
      niveauEtude: editingForm.niveauEtude || originalRdv.niveauEtude,
      filiere: editingForm.filiere || originalRdv.filiere,
      filiereAutre: editingForm.filiere === 'Autre' ? (editingForm.filiereAutre || originalRdv.filiereAutre) : undefined,
      // Inclure date et time si nécessaire
      date: originalRdv.date,  // Conserver la date originale
      time: originalRdv.time,  // Conserver l'heure originale
    };

    // Nettoyer les données : supprimer les champs undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    // Valider que tous les champs requis sont présents
    const requiredFields = ['firstName', 'lastName', 'email', 'telephone', 'destination', 'niveauEtude', 'filiere'];
    const missingFields = requiredFields.filter(field => !updateData[field as keyof typeof updateData]);
    
    if (missingFields.length > 0) {
      toast.error(`Champs requis manquants: ${missingFields.join(', ')}`);
      return;
    }

    // Validation supplémentaire pour les champs "Autre"
    if (updateData.destination === 'Autre' && (!updateData.destinationAutre || updateData.destinationAutre.trim() === '')) {
      toast.error('La destination "Autre" nécessite une précision');
      return;
    }
    
    if (updateData.filiere === 'Autre' && (!updateData.filiereAutre || updateData.filiereAutre.trim() === '')) {
      toast.error('La filière "Autre" nécessite une précision');
      return;
    }

    // CORRECTION ICI : Valider les données avant l'envoi
    const validationErrors = service.validateRendezvousData(updateData);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error));
      return;
    }

    const updatedRdv = await service.updateRendezvous(id, updateData, user?.email || '', true);
    const normalizedRdv = normalizeRendezvous(updatedRdv);

    setRendezvous(prev => prev.map(rdv => rdv.id === id ? normalizedRdv : rdv));
    setEditingRendezvous(null);
    setEditingForm({});

    toast.success('Rendez-vous mis à jour avec succès');
  } catch (error: any) {
    console.error('Erreur détaillée:', error);
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    
    // Message plus détaillé pour les erreurs de validation
    if (errorMessage.includes('Validation failed') || errorMessage.includes('Données invalides')) {
      toast.error('Erreur de validation des données. Veuillez vérifier tous les champs.');
    } else {
      toast.error(errorMessage);
    }
  } finally {
    setIsSubmitting(false);
  }
};

  // Gestion du changement de statut via select
  const handleStatusChange = useCallback((id: string, newStatus: string) => {
    if (!id) {
      toast.error('Erreur: ID du rendez-vous manquant');
      return;
    }

    const rdvExists = rendezvous.find(rdv => rdv.id === id);
    if (!rdvExists) {
      toast.error('Erreur: Rendez-vous non trouvé');
      return;
    }

    // Règles spéciales pour admin
    const isAdmin = user?.role === 'admin';
    
    if (newStatus === 'Terminé') {
      // Pour "Terminé", toujours demander l'avis admin
      setPendingStatusUpdate({ id, status: newStatus as RendezvousStatus });
      setShowAvisModal(true);
    } else if (newStatus === 'En attente' && isAdmin) {
      // Pour "En attente", pas besoin d'avis
      handleUpdateStatus(id, newStatus as RendezvousStatus);
    } else if (newStatus === 'Annulé') {
      // Pour "Annulé", demander confirmation
      setShowDeleteModal(id);
    } else {
      // Pour les autres statuts (Confirmé)
      handleUpdateStatus(id, newStatus as RendezvousStatus);
    }
  }, [rendezvous, user?.role]);

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
    if (!service || !id) {
      toast.error('Service non disponible ou ID invalide');
      return;
    }

    const rdvToDelete = rendezvous.find(rdv => rdv.id === id);
    if (!rdvToDelete) {
      toast.error('Rendez-vous non trouvé');
      return;
    }

    setIsSubmitting(true);
    try {
      await service.cancelRendezvous(id, user?.email || '', true);
      setRendezvous(prev => prev.filter(rdv => rdv.id !== id));
      setShowDeleteModal(null);
      setShowMobileActions(null);
      toast.success('Rendez-vous annulé avec succès');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Création d'un nouveau rendez-vous
  const handleCreateRendezVous = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) {
      toast.error('Service non disponible');
      return;
    }

    setIsSubmitting(true);
    try {
      // Validation frontale
      const errors: string[] = service.validateRendezvousData(newRendezVous);
      if (errors.length > 0) {
        errors.forEach(error => toast.error(error));
        return;
      }

      const createdRdv = await service.createRendezvous(newRendezVous, user?.email || '', true);
      const normalizedRdv = normalizeRendezvous(createdRdv);

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
      
      // Rafraîchir les dates disponibles
      const dates = await service.fetchAvailableDates();
      setAvailableDates(dates);
      
      toast.success('Rendez-vous créé avec succès');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
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
          fetchDestinations(),
          (async () => {
            try {
              const dates = await service.fetchAvailableDates();
              setAvailableDates(dates);
            } catch (error) {
              setAvailableDates([]);
            }
          })(),
        ]);
      } catch (error) {
        console.error('Erreur initialisation:', error);
      }
    };
    
    if (service) {
      initialize();
    }
  }, [service, page, searchTerm, selectedStatus, refreshTrigger]);

  // Fonctions utilitaires
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmé':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'En attente':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Annulé':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Terminé':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Options de destination depuis l'API + "Autre"
  const destinationOptions = [...destinations.map(dest => dest.country), 'Autre'];

  // Fonction pour démarrer l'édition d'un rendez-vous
  const startEditing = (rdv: LocalRendezvous) => {
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
    setShowMobileActions(null);
  };

  // Fonction pour annuler l'édition
  const cancelEditing = () => {
    setEditingRendezvous(null);
    setEditingForm({});
  };

  // Fonction pour fermer tous les menus ouverts
  const closeAllMenus = () => {
    setShowMobileActions(null);
    setShowMobileFilters(false);
    if (editingRendezvous && Object.keys(editingForm).length === 0) {
      setEditingRendezvous(null);
    }
  };

  // Fonction pour obtenir les transitions de statut autorisées
  const getAvailableStatusTransitions = (currentStatus: string): string[] => {
    const isAdmin = user?.role === 'admin';
    
    // Transitions complètes pour admin
    const adminTransitions: Record<string, string[]> = {
      'En attente': ['Confirmé', 'Annulé', 'Terminé'],
      'Confirmé': ['En attente', 'Terminé', 'Annulé'],
      'Terminé': ['En attente', 'Confirmé', 'Annulé'],
      'Annulé': ['En attente', 'Confirmé', 'Terminé'],
    };
    
    // Transitions limitées pour utilisateur
    const userTransitions: Record<string, string[]> = {
      'En attente': [],
      'Confirmé': ['Annulé'],
      'Terminé': [],
      'Annulé': [],
    };
    
    const transitions = isAdmin ? adminTransitions : userTransitions;
    const availableTransitions = transitions[currentStatus] || [];
    
    // Toujours inclure le statut actuel + transitions autorisées
    return [currentStatus, ...availableTransitions];
  };

  // Calcul des stats
  const stats = {
    total: rendezvous.length,
    confirmed: rendezvous.filter(r => r.status === 'Confirmé').length,
    pending: rendezvous.filter(r => r.status === 'En attente').length,
    completed: rendezvous.filter(r => r.status === 'Terminé').length,
    cancelled: rendezvous.filter(r => r.status === 'Annulé').length,
  };

  if (!service) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-sky-500 mx-auto mb-4" />
          <p className="text-slate-600">Initialisation du service...</p>
        </div>
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
      
      <div className='min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30' onClick={closeAllMenus}>
        {/* Container principal */}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'>
          
          {/* En-tête mobile-first */}
          <div className='mb-6'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <Calendar className='w-7 h-7 sm:w-8 sm:h-8 text-sky-600' />
                  <div>
                    <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800'>
                      Gestion des Rendez-vous
                    </h1>
                    <p className='text-sm text-slate-600 mt-1 hidden sm:block'>
                      {stats.total} rendez-vous • {stats.confirmed} confirmés • {stats.pending} en attente
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  disabled={isSubmitting}
                  className='px-4 py-2.5 sm:px-5 sm:py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center gap-2 justify-center focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isSubmitting ? (
                    <Loader2 className='w-4 h-4 sm:w-5 sm:h-5 animate-spin' />
                  ) : (
                    <Plus className='w-4 h-4 sm:w-5 sm:h-5' />
                  )}
                  <span className='hidden sm:inline'>Nouveau RDV</span>
                  <span className='sm:hidden'>Nouveau</span>
                </button>
              </div>
              
              <p className='text-sm sm:text-base text-slate-600 sm:hidden'>
                {stats.total} rendez-vous • {stats.confirmed} confirmés • {stats.pending} en attente
              </p>
            </div>
          </div>

          {/* Barre de recherche et filtres - Mobile First */}
          <div className='bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6' ref={modalRef}>
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
                
                {/* Filtre de statut */}
                <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:block sm:flex-1 sm:max-w-xs`}>
                  <div className='relative'>
                    <Filter className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <select
                      value={selectedStatus}
                      onChange={e => {
                        setSelectedStatus(e.target.value);
                        setPage(1);
                      }}
                      className='w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent hover:border-sky-400 transition-all duration-200 appearance-none text-sm sm:text-base'
                    >
                      <option value='tous'>Tous les statuts</option>
                      {STATUTS.map(statut => (
                        <option key={statut} value={statut}>{statut}</option>
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
                  {searchTerm || selectedStatus !== 'tous' ? 'Essayez de modifier vos critères de recherche' : 'Créez votre premier rendez-vous'}
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {rendezvous.map((rdv, index) => {
                  const { canDelete } = canDeleteRendezvous(rdv);
                  const isEditing = editingRendezvous === rdv.id;
                  const isAdmin = user?.role === 'admin';
                  const statusOptions = getAvailableStatusTransitions(rdv.status);
                  
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
                                  <div className='flex-1'>
                                    <input
                                      type='text'
                                      value={editingForm.firstName || ''}
                                      onChange={(e) => setEditingForm(prev => ({ ...prev, firstName: e.target.value }))}
                                      className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                      placeholder='Prénom'
                                      required
                                    />
                                  </div>
                                  <div className='flex-1'>
                                    <input
                                      type='text'
                                      value={editingForm.lastName || ''}
                                      onChange={(e) => setEditingForm(prev => ({ ...prev, lastName: e.target.value }))}
                                      className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                      placeholder='Nom'
                                      required
                                    />
                                  </div>
                                </div>
                                <input
                                  type='email'
                                  value={editingForm.email || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, email: e.target.value }))}
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Email'
                                  required
                                />
                              </div>
                            ) : (
                              <>
                                <div className='flex items-center gap-2 mb-1'>
                                  <User className='w-4 h-4 text-slate-400 shrink-0' />
                                  <h3 className='font-semibold text-slate-800 truncate'>
                                    {rdv.firstName} {rdv.lastName}
                                  </h3>
                                </div>
                                <div className='flex items-center gap-2 text-xs text-slate-600 mb-1 truncate'>
                                  <Mail className='w-3 h-3 text-slate-400 shrink-0' />
                                  <span className='truncate'>{rdv.email}</span>
                                </div>
                                <div className='flex items-center gap-2 text-xs text-slate-600 truncate'>
                                  <Phone className='w-3 h-3 text-slate-400 shrink-0' />
                                  <span className='truncate'>{rdv.telephone}</span>
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className='relative shrink-0 ml-2' ref={actionsRef}>
                            {isEditing ? (
                              <div className='flex gap-1'>
                                <button
                                  onClick={() => handleUpdateRendezvous(rdv.id)}
                                  disabled={isSubmitting}
                                  className='p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50'
                                >
                                  {isSubmitting ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                  ) : (
                                    <Check className='w-4 h-4' />
                                  )}
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className='p-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500'
                                >
                                  <XIcon className='w-4 h-4' />
                                </button>
                              </div>
                            ) : (
                              <>
                                {isAdmin && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing(rdv);
                                    }}
                                    className='p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 mr-1'
                                  >
                                    <Edit className='w-4 h-4 text-slate-400' />
                                  </button>
                                )}
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
                                  <div className='text-xs font-medium text-slate-500 mb-1 px-2'>Changer le statut</div>
                                  <select
                                    value={rdv.status}
                                    onChange={e => {
                                      e.stopPropagation();
                                      handleStatusChange(rdv.id, e.target.value);
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-sky-400 transition-all duration-200 ${getStatusColor(rdv.status)}`}
                                  >
                                    {getAvailableStatusTransitions(rdv.status).map(status => (
                                      <option key={status} value={status}>
                                        {status}
                                        {status === 'En attente' && user?.role === 'admin' && ' (Admin seulement)'}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div className='border-t border-slate-200'>
                                  <button
                                    onClick={() => {
                                      setShowDeleteModal(rdv.id);
                                      setShowMobileActions(null);
                                    }}
                                    disabled={!canDelete && !isAdmin}
                                    className={`w-full px-3 py-2 text-xs flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                      canDelete || isAdmin
                                        ? 'text-rose-600 hover:bg-rose-50'
                                        : 'text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                    <Trash2 className='w-3 h-3' />
                                    {isAdmin ? 'Supprimer' : 'Annuler'}
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
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  required
                                />
                              </div>
                              <div>
                                <label className='text-xs text-slate-500 mb-1 block'>Niveau</label>
                                <select
                                  value={editingForm.niveauEtude || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, niveauEtude: e.target.value }))}
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  required
                                >
                                  <option value=''>Sélectionner</option>
                                  {EDUCATION_LEVELS.map(niveau => (
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
                                className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                                required
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
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Précisez la destination'
                                  required
                                />
                              )}
                            </div>
                            <div>
                              <label className='text-xs text-slate-500 mb-1 block'>Filière</label>
                              <select
                                value={editingForm.filiere || ''}
                                onChange={(e) => setEditingForm(prev => ({ ...prev, filiere: e.target.value }))}
                                className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                                required
                              >
                                <option value=''>Sélectionner</option>
                                {FILIERES.map(filiere => (
                                  <option key={filiere} value={filiere}>{filiere}</option>
                                ))}
                              </select>
                              {editingForm.filiere === 'Autre' && (
                                <input
                                  type='text'
                                  value={editingForm.filiereAutre || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, filiereAutre: e.target.value }))}
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Précisez la filière'
                                  required
                                />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className='grid grid-cols-2 gap-4 text-sm mb-4'>
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2'>
                                <Calendar className='w-3 h-3 text-slate-400 shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {formatDate(rdv.date)}
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <Clock className='w-3 h-3 text-slate-400 shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {formatTime(rdv.time)}
                                </span>
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2'>
                                <MapPin className='w-3 h-3 text-slate-400 shrink-0' />
                                <span className='text-slate-700 truncate'>
                                  {rdv.destination === 'Autre' && rdv.destinationAutre
                                    ? rdv.destinationAutre
                                    : rdv.destination}
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <BookOpen className='w-3 h-3 text-slate-400 shrink-0' />
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
                          {rdv.isPast && (
                            <span className='px-2 py-1 rounded-lg text-xs font-medium border bg-slate-100 text-slate-800 border-slate-200'>
                              Passé
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
                          {searchTerm || selectedStatus !== 'tous' ? 'Essayez de modifier vos critères de recherche' : 'Créez votre premier rendez-vous'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rendezvous.map((rdv, index) => {
                      const { canDelete } = canDeleteRendezvous(rdv);
                      const isEditing = editingRendezvous === rdv.id;
                      const isAdmin = user?.role === 'admin';
                      const statusOptions = getAvailableStatusTransitions(rdv.status);
                      
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
                                    className='flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    placeholder='Prénom'
                                    required
                                  />
                                  <input
                                    type='text'
                                    value={editingForm.lastName || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, lastName: e.target.value }))}
                                    className='flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    placeholder='Nom'
                                    required
                                  />
                                </div>
                                <input
                                  type='email'
                                  value={editingForm.email || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, email: e.target.value }))}
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Email'
                                  required
                                />
                                <input
                                  type='tel'
                                  value={editingForm.telephone || ''}
                                  onChange={(e) => setEditingForm(prev => ({ ...prev, telephone: e.target.value }))}
                                  className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                  placeholder='Téléphone'
                                  required
                                />
                              </div>
                            ) : (
                              <div className='space-y-1'>
                                <div className='flex items-center gap-2'>
                                  <User className='w-4 h-4 text-slate-400 shrink-0' />
                                  <span className='font-medium text-slate-800'>
                                    {rdv.firstName} {rdv.lastName}
                                  </span>
                                </div>
                                <div className='flex items-center gap-2 text-sm'>
                                  <Mail className='w-3 h-3 text-slate-400 shrink-0' />
                                  <span className='text-slate-700 truncate'>{rdv.email}</span>
                                </div>
                                <div className='flex items-center gap-2 text-sm'>
                                  <Phone className='w-3 h-3 text-slate-400 shrink-0' />
                                  <span className='text-slate-700'>{rdv.telephone}</span>
                                </div>
                              </div>
                            )}
                          </td>
                          
                          <td className='px-6 py-4'>
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2'>
                                <Calendar className='w-4 h-4 text-slate-400 shrink-0' />
                                <span className='text-slate-700 font-medium'>
                                  {formatDate(rdv.date)}
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <Clock className='w-4 h-4 text-slate-400 shrink-0' />
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
                                    className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                                    required
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
                                      className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                      placeholder='Précisez la destination'
                                      required
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className='text-xs text-slate-500 mb-1 block'>Filière</label>
                                  <select
                                    value={editingForm.filiere || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, filiere: e.target.value }))}
                                    className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2'
                                    required
                                  >
                                    <option value=''>Sélectionner</option>
                                    {FILIERES.map(filiere => (
                                      <option key={filiere} value={filiere}>{filiere}</option>
                                    ))}
                                  </select>
                                  {editingForm.filiere === 'Autre' && (
                                    <input
                                      type='text'
                                      value={editingForm.filiereAutre || ''}
                                      onChange={(e) => setEditingForm(prev => ({ ...prev, filiereAutre: e.target.value }))}
                                      className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                      placeholder='Précisez la filière'
                                      required
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className='text-xs text-slate-500 mb-1 block'>Niveau d'étude</label>
                                  <select
                                    value={editingForm.niveauEtude || ''}
                                    onChange={(e) => setEditingForm(prev => ({ ...prev, niveauEtude: e.target.value }))}
                                    className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-500'
                                    required
                                  >
                                    <option value=''>Sélectionner</option>
                                    {EDUCATION_LEVELS.map(niveau => (
                                      <option key={niveau} value={niveau}>{niveau}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <div className='space-y-2'>
                                <div className='flex items-start gap-2'>
                                  <MapPin className='w-4 h-4 text-slate-400 mt-0.5 shrink-0' />
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
                                  <BookOpen className='w-4 h-4 text-slate-400 mt-0.5 shrink-0' />
                                  <div className='min-w-0'>
                                    <div className='font-medium text-slate-800'>Filière</div>
                                    <div className='text-sm text-slate-600 truncate'>
                                      {rdv.filiere === 'Autre' && rdv.filiereAutre
                                        ? rdv.filiereAutre
                                        : rdv.filiere}
                                    </div>
                                  </div>
                                </div>
                                <div className='flex items-start gap-2'>
                                  <GraduationCap className='w-4 h-4 text-slate-400 mt-0.5 shrink-0' />
                                  <div className='min-w-0'>
                                    <div className='font-medium text-slate-800'>Niveau</div>
                                    <div className='text-sm text-slate-600 truncate'>{rdv.niveauEtude}</div>
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
                                disabled={statusOptions.length <= 1 || isSubmitting}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-sky-400 transition-all duration-200 ${getStatusColor(rdv.status)} ${statusOptions.length <= 1 || isSubmitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                              >
                                {statusOptions.map(status => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                              {rdv.status === 'Terminé' && rdv.avisAdmin && (
                                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 ${getAvisColor(rdv.avisAdmin)}`}>
                                  {rdv.avisAdmin === 'Favorable' ? (
                                    <CheckCircle className='w-3 h-3 shrink-0' />
                                  ) : (
                                    <XCircle className='w-3 h-3 shrink-0' />
                                  )}
                                  {rdv.avisAdmin}
                                </div>
                              )}
                              {rdv.isPast && (
                                <div className='px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-100 text-slate-800 border-slate-200'>
                                  Rendez-vous passé
                                </div>
                              )}
                            </div>
                          </td>
                          
                          <td className='px-6 py-4'>
                            <div className='flex items-center gap-2'>
                              {isEditing ? (
                                <div className='flex gap-1'>
                                  <button
                                    onClick={() => handleUpdateRendezvous(rdv.id)}
                                    disabled={isSubmitting}
                                    className='p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50'
                                  >
                                    {isSubmitting ? (
                                      <Loader2 className='w-4 h-4 animate-spin' />
                                    ) : (
                                      <Check className='w-4 h-4' />
                                    )}
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className='p-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500'
                                  >
                                    <XIcon className='w-4 h-4' />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {isAdmin && (
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
                                  
                                  <div className='relative' ref={actionsRef}>
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
                                              disabled={!canDelete && !isAdmin}
                                              className={`w-full px-3 py-2 text-sm flex items-center gap-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                                                canDelete || isAdmin
                                                  ? 'text-rose-600 hover:bg-rose-50'
                                                  : 'text-slate-400 cursor-not-allowed'
                                              }`}
                                            >
                                              <Trash2 className='w-4 h-4' />
                                              {isAdmin ? 'Supprimer' : 'Annuler'}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
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
            <div className='flex flex-col sm:flex-row justify-between items-center gap-4 mt-6'>
              <div className='text-sm text-slate-600'>
                Affichage de <span className='font-medium'>{(page - 1) * limit + 1}</span> à <span className='font-medium'>{Math.min(page * limit, stats.total)}</span> sur <span className='font-medium'>{stats.total}</span> rendez-vous
              </div>
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1 || isLoading}
                  className='px-4 py-2 rounded-lg border border-slate-300 hover:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 flex items-center gap-2'
                >
                  <ChevronLeft className='w-4 h-4' />
                  <span className='hidden sm:inline'>Précédent</span>
                </button>
                <div className='flex items-center gap-1'>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          page === pageNum
                            ? 'bg-sky-500 text-white'
                            : 'border border-slate-300 hover:border-sky-400 text-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages || isLoading}
                  className='px-4 py-2 rounded-lg border border-slate-300 hover:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 flex items-center gap-2'
                >
                  <span className='hidden sm:inline'>Suivant</span>
                  <ChevronRight className='w-4 h-4' />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={(e) => e.stopPropagation()}>
          <div className='bg-white rounded-2xl shadow-xl max-w-sm w-full mx-auto animate-in fade-in zoom-in-95 duration-200' ref={modalRef}>
            <div className='p-5 border-b border-slate-200'>
              <div className='flex items-center gap-3'>
                <AlertCircle className='w-6 h-6 text-rose-500 shrink-0' />
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
                disabled={isSubmitting}
                className='px-4 py-2.5 text-slate-700 bg-white rounded-lg border border-slate-300 hover:bg-slate-50 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50'
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal)}
                disabled={isSubmitting}
                className='px-4 py-2.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all duration-200 font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 active:scale-95 disabled:opacity-50'
              >
                {isSubmitting ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Trash2 className='w-4 h-4' />
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de sélection d'avis pour le statut "Terminé" */}
      {showAvisModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={(e) => e.stopPropagation()}>
          <div className='bg-white rounded-2xl shadow-xl max-w-xs w-full mx-auto animate-in fade-in zoom-in-95 duration-200' ref={modalRef}>
            <div className='p-5 border-b border-slate-200'>
              <div className='flex items-center gap-2'>
                <Shield className='w-5 h-5 text-sky-500 shrink-0' />
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
                {ADMIN_AVIS.map(avis => (
                  <button
                    key={avis}
                    onClick={() => handleAvisSelection(avis as AdminOpinion)}
                    disabled={isSubmitting}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-sky-400 active:scale-95 disabled:opacity-50 ${
                      avis === 'Favorable'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <div className='font-semibold text-sm flex items-center justify-between'>
                      <span>{avis}</span>
                      {avis === 'Favorable' ? (
                        <CheckCircle className='w-4 h-4 text-emerald-600 shrink-0' />
                      ) : (
                        <XCircle className='w-4 h-4 text-rose-600 shrink-0' />
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
                  disabled={isSubmitting}
                  className='px-4 py-2 text-sm text-slate-700 bg-white rounded-lg border border-slate-300 hover:bg-slate-50 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50'
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
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto' onClick={(e) => e.stopPropagation()}>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto my-8 animate-in fade-in zoom-in-95 duration-200' ref={modalRef}>
            {/* Formulaire */}
            <form onSubmit={handleCreateRendezVous} className='p-4 md:p-6'>
              <div className='space-y-6 md:space-y-8 max-h-[65vh] md:max-h-[70vh] overflow-y-auto pr-1 md:pr-3 pb-4'>
                {/* Informations personnelles */}
                <div className='bg-white rounded-xl p-4 md:p-5 shadow-xs border border-slate-100'>
                  <div className='flex items-center gap-2 mb-4 md:mb-5'>
                    <div className='p-2 bg-sky-50 rounded-lg'>
                      <User className='w-4 h-4 md:w-5 md:h-5 text-sky-600' />
                    </div>
                    <h3 className='text-sm md:text-base font-semibold text-slate-900'>
                      Informations personnelles
                    </h3>
                  </div>
                  
                  <div className='space-y-4 md:space-y-5'>
                    {/* Prénom et Nom - Empilés sur mobile */}
                    <div className='flex flex-col sm:flex-row gap-4 md:gap-5'>
                      <div className='flex-1'>
                        <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                          Prénom <span className='text-rose-500'>*</span>
                        </label>
                        <div className='relative group'>
                          <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                            <User className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                          </div>
                          <input
                            type='text'
                            value={newRendezVous.firstName}
                            onChange={e => setNewRendezVous(prev => ({ ...prev, firstName: e.target.value }))}
                            className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base placeholder:text-slate-400 bg-white transition-all duration-200'
                            required
                            placeholder='Jean'
                          />
                        </div>
                      </div>
                      
                      <div className='flex-1'>
                        <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                          Nom <span className='text-rose-500'>*</span>
                        </label>
                        <div className='relative group'>
                          <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                            <User className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                          </div>
                          <input
                            type='text'
                            value={newRendezVous.lastName}
                            onChange={e => setNewRendezVous(prev => ({ ...prev, lastName: e.target.value }))}
                            className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base placeholder:text-slate-400 bg-white transition-all duration-200'
                            required
                            placeholder='Dupont'
                          />
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                        Email <span className='text-rose-500'>*</span>
                      </label>
                      <div className='relative group'>
                        <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                          <Mail className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                        </div>
                        <input
                          type='email'
                          value={newRendezVous.email}
                          onChange={e => setNewRendezVous(prev => ({ ...prev, email: e.target.value }))}
                          className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base placeholder:text-slate-400 bg-white transition-all duration-200'
                          required
                          placeholder='jean.dupont@email.com'
                        />
                      </div>
                    </div>

                    {/* Téléphone */}
                    <div>
                      <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                        Téléphone <span className='text-rose-500'>*</span>
                      </label>
                      <div className='relative group'>
                        <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                          <Phone className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                        </div>
                        <input
                          type='tel'
                          value={newRendezVous.telephone}
                          onChange={e => setNewRendezVous(prev => ({ ...prev, telephone: e.target.value }))}
                          className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base placeholder:text-slate-400 bg-white transition-all duration-200'
                          required
                          placeholder='+228 XX XX XX XX'
                        />
                        <span className='absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-400'>
                          Togo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informations académiques */}
                <div className='bg-white rounded-xl p-4 md:p-5 shadow-xs border border-slate-100'>
                  <div className='flex items-center gap-2 mb-4 md:mb-5'>
                    <div className='p-2 bg-sky-50 rounded-lg'>
                      <GraduationCap className='w-4 h-4 md:w-5 md:h-5 text-sky-600' />
                    </div>
                    <h3 className='text-sm md:text-base font-semibold text-slate-900'>
                      Informations académiques
                    </h3>
                  </div>
                  
                  <div className='space-y-4 md:space-y-5'>
                    {/* Niveau d'étude */}
                    <div>
                      <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                        Niveau d'étude <span className='text-rose-500'>*</span>
                      </label>
                      <div className='relative group'>
                        <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                          <BookOpen className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                        </div>
                        <select
                          value={newRendezVous.niveauEtude}
                          onChange={e => setNewRendezVous(prev => ({ ...prev, niveauEtude: e.target.value }))}
                          className='w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base appearance-none bg-white cursor-pointer transition-all duration-200'
                          required
                        >
                          <option value='' className='text-slate-400'>Sélectionner un niveau</option>
                          {EDUCATION_LEVELS.map(niveau => (
                            <option key={niveau} value={niveau} className='text-slate-700'>{niveau}</option>
                          ))}
                        </select>
                        <ChevronDown className='absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none' />
                      </div>
                    </div>

                    {/* Filière */}
                    <div>
                      <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                        Filière <span className='text-rose-500'>*</span>
                      </label>
                      <div className='relative group'>
                        <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                          <Briefcase className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                        </div>
                        <select
                          value={newRendezVous.filiere}
                          onChange={e => setNewRendezVous(prev => ({ 
                            ...prev, 
                            filiere: e.target.value, 
                            filiereAutre: '' 
                          }))}
                          className='w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base appearance-none bg-white cursor-pointer transition-all duration-200'
                          required
                        >
                          <option value='' className='text-slate-400'>Sélectionner une filière</option>
                          {FILIERES.map(filiere => (
                            <option key={filiere} value={filiere} className='text-slate-700'>{filiere}</option>
                          ))}
                        </select>
                        <ChevronDown className='absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none' />
                      </div>
                      
                      {newRendezVous.filiere === 'Autre' && (
                        <div className='mt-3 animate-fadeIn'>
                          <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                            Précisez votre filière <span className='text-rose-500'>*</span>
                          </label>
                          <div className='relative group'>
                            <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                              <Briefcase className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                            </div>
                            <input
                              type='text'
                              value={newRendezVous.filiereAutre}
                              onChange={e => setNewRendezVous(prev => ({ ...prev, filiereAutre: e.target.value }))}
                              className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base placeholder:text-slate-400 bg-white transition-all duration-200'
                              placeholder='Ex: Génie Civil, Design Graphique...'
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Destination */}
                <div className='bg-white rounded-xl p-4 md:p-5 shadow-xs border border-slate-100'>
                  <div className='flex items-center gap-2 mb-4 md:mb-5'>
                    <div className='p-2 bg-sky-50 rounded-lg'>
                      <Globe className='w-4 h-4 md:w-5 md:h-5 text-sky-600' />
                    </div>
                    <h3 className='text-sm md:text-base font-semibold text-slate-900'>
                      Destination
                    </h3>
                  </div>
                  
                  <div>
                    <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                      Pays souhaité <span className='text-rose-500'>*</span>
                    </label>
                    <div className='relative group'>
                      <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                        <MapPin className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                      </div>
                      <select
                        value={newRendezVous.destination}
                        onChange={e => setNewRendezVous(prev => ({ 
                          ...prev, 
                          destination: e.target.value, 
                          destinationAutre: '' 
                        }))}
                        className='w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base appearance-none bg-white cursor-pointer transition-all duration-200'
                        required
                      >
                        <option value='' className='text-slate-400'>Sélectionner une destination</option>
                        {destinationOptions.map(dest => (
                          <option key={dest} value={dest} className='text-slate-700'>{dest}</option>
                        ))}
                      </select>
                      <ChevronDown className='absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none' />
                    </div>
                    
                    {newRendezVous.destination === 'Autre' && (
                      <div className='mt-3 animate-fadeIn'>
                        <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                          Précisez la destination <span className='text-rose-500'>*</span>
                        </label>
                        <div className='relative group'>
                          <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                            <MapPin className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                          </div>
                          <input
                            type='text'
                            value={newRendezVous.destinationAutre}
                            onChange={e => setNewRendezVous(prev => ({ ...prev, destinationAutre: e.target.value }))}
                            className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base placeholder:text-slate-400 bg-white transition-all duration-200'
                            placeholder='Ex: Canada, Japon, Australie...'
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date et heure */}
                <div className='bg-white rounded-xl p-4 md:p-5 shadow-xs border border-slate-100'>
                  <div className='flex items-center gap-2 mb-4 md:mb-5'>
                    <div className='p-2 bg-sky-50 rounded-lg'>
                      <Calendar className='w-4 h-4 md:w-5 md:h-5 text-sky-600' />
                    </div>
                    <h3 className='text-sm md:text-base font-semibold text-slate-900'>
                      Date et heure
                    </h3>
                  </div>
                  
                  <div className='space-y-4 md:space-y-5'>
                    {/* Date */}
                    <div>
                      <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                        Date <span className='text-rose-500'>*</span>
                      </label>
                      <div className='relative group'>
                        <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                          <Calendar className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                        </div>
                        <input
                          type='date'
                          value={newRendezVous.date}
                          onChange={e => handleDateChange(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className='w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base bg-white cursor-pointer transition-all duration-200 scheme-light'
                          required
                        />
                      </div>
                    </div>

                    {/* Heure - Conditionnel */}
                    {newRendezVous.date && (
                      <div className='animate-fadeIn'>
                        <label className='text-xs md:text-sm font-medium text-slate-700 mb-2 block'>
                          Heure <span className='text-rose-500'>*</span>
                        </label>
                        <div className='relative group'>
                          <div className='absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center'>
                            <Clock className='w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors' />
                          </div>
                          <select
                            value={newRendezVous.time}
                            onChange={e => setNewRendezVous(prev => ({ ...prev, time: e.target.value }))}
                            className='w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm md:text-base appearance-none bg-white cursor-pointer transition-all duration-200 disabled:bg-slate-50 disabled:cursor-not-allowed'
                            required
                            disabled={availableSlots.length === 0}
                          >
                            <option value='' className='text-slate-400'>
                              {availableSlots.length === 0 ? 'Aucun créneau disponible' : 'Sélectionner un créneau'}
                            </option>
                            {availableSlots.map(slot => (
                              <option key={slot} value={slot} className='text-slate-700'>
                                {slot.replace(':', 'h')}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className='absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none' />
                        </div>
                        
                        {availableSlots.length === 0 && (
                          <div className='mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg'>
                            <p className='text-xs text-amber-700 flex items-start gap-2'>
                              <span className='text-amber-600 mt-0.5'>ℹ️</span>
                              <span>
                                Aucun créneau disponible pour cette date. Veuillez choisir une autre date.
                              </span>
                            </p>
                          </div>
                        )}
                        
                        {availableSlots.length > 0 && newRendezVous.time && (
                          <div className='mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg'>
                            <p className='text-xs text-emerald-700 flex items-center gap-2'>
                              <span>✓</span>
                              <span>Créneau sélectionné : <strong>{newRendezVous.time.replace(':', 'h')}</strong></span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Boutons - Sticky sur mobile */}
              <div className='sticky bottom-0 left-0 right-0 bg-linear-to-t from-white via-white to-transparent pt-6 mt-2 pb-2 md:pb-0'>
                <div className='flex flex-col sm:flex-row gap-3'>
                  <button
                    type='button'
                    onClick={() => setShowCreateModal(false)}
                    disabled={isSubmitting}
                    className='order-2 sm:order-1 px-6 py-3.5 text-slate-600 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 transition-all duration-200 font-medium text-sm md:text-base flex items-center justify-center gap-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <X className='w-4 h-4 md:w-5 md:h-5' />
                    Annuler
                  </button>
                  <button
                    type='submit'
                    disabled={!newRendezVous.time || availableSlots.length === 0 || isSubmitting}
                    className='order-1 sm:order-2 px-6 py-3.5 bg-linear-to-r from-sky-500 to-sky-600 text-white rounded-xl hover:from-sky-600 hover:to-sky-700 active:scale-[0.98] transition-all duration-200 font-medium text-sm md:text-base shadow-sm shadow-sky-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 flex-1'
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className='w-4 h-4 md:w-5 md:h-5 animate-spin' />
                        <span>Création en cours...</span>
                      </>
                    ) : (
                      <>
                        <Plus className='w-4 h-4 md:w-5 md:h-5' />
                        <span>Créez</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Indicateur de progression (optionnel) */}
                <div className='mt-4 text-center'>
                  <div className='flex justify-center items-center gap-2'>
                    {[1, 2, 3, 4].map((step) => (
                      <div 
                        key={step}
                        className={`w-1.5 h-1.5 rounded-full ${step <= 4 ? 'bg-sky-500' : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>
                  <p className='text-xs text-slate-500 mt-2'>
                    Remplissez tous les champs pour prendre rendez-vous
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminRendezVous;