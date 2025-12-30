import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

// ==================== TYPES CONFORMES AU BACKEND ====================
export enum ProcedureStatus {
  IN_PROGRESS = 'En cours',
  COMPLETED = 'Terminée',
  REJECTED = 'Refusée',
  CANCELLED = 'Annulée',
}

export enum StepStatus {
  PENDING = 'En attente',
  IN_PROGRESS = 'En cours',
  COMPLETED = 'Terminé',
  REJECTED = 'Rejeté',
  CANCELLED = 'Annulé',
}

export enum StepName {
  DEMANDE_ADMISSION = 'DEMANDE ADMISSION',
  DEMANDE_VISA = 'DEMANDE VISA',
  PREPARATIF_VOYAGE = 'PREPARATIF VOYAGE',
}

export interface Step {
  nom: StepName;
  statut: StepStatus;
  raisonRefus?: string;
  dateCreation: Date;
  dateMaj: Date;
  dateCompletion?: Date;
}

export interface RendezvousInfo {
  _id: string;
  firstName: string;
  lastName: string;
  date: Date;
  time: string;
  status: string;
  avisAdmin?: string;
}

export interface UserProcedure {
  _id: string;
  rendezVousId?: string | RendezvousInfo; // ✅ Conforme au backend (peuplé ou non)
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  destination: string;
  destinationAutre?: string;
  filiere: string;
  filiereAutre?: string;
  niveauEtude: string;
  statut: ProcedureStatus;
  steps: Step[];
  raisonRejet?: string;
  dateCompletion?: Date;
  dateDerniereModification?: Date;
  createdAt: Date;
  updatedAt: Date;
  // ✅ PAS de isDeleted - Géré par statut dans le backend
}

export interface PaginatedUserProcedures {
  data: UserProcedure[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== SERVICE API SIMPLIFIÉ ====================
class ProcedureApiService {
  private fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>;

  constructor(fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>) {
    this.fetchWithAuth = fetchWithAuth;
  }

  /**
   * Récupérer les procédures de l'utilisateur connecté
   */
  async fetchUserProcedures(
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedUserProcedures> {
    try {
      const response = await this.fetchWithAuth(
        `/api/procedures/user?page=${page}&limit=${limit}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('SESSION_EXPIRED');
        }
        
        const errorText = await response.text();
        throw new Error(`Erreur ${response.status}: ${errorText || 'Erreur serveur'}`);
      }

      const data = await response.json();
      return data; // ✅ Le backend formate déjà correctement
    } catch (error: any) {
      console.error('Erreur fetchUserProcedures:', error.message);
      
      // Messages utilisateur-friendly
      if (error.message === 'SESSION_EXPIRED') {
        throw error;
      } else if (error.message.includes('404')) {
        throw new Error('Endpoint non trouvé');
      } else if (error.message.includes('500')) {
        throw new Error('Erreur serveur interne');
      }
      
      throw new Error('Impossible de charger vos procédures');
    }
  }

  /**
   * Récupérer les détails d'une procédure
   */
  async fetchProcedureDetails(procedureId: string): Promise<UserProcedure> {
    if (!procedureId) {
      throw new Error('ID de procédure manquant');
    }

    try {
      const response = await this.fetchWithAuth(`/api/procedures/${procedureId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Procédure non trouvée');
        }
        throw new Error(`Erreur ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      console.error('Erreur fetchProcedureDetails:', error.message);
      
      if (error.message === 'SESSION_EXPIRED') {
        throw error;
      }
      
      toast.error(this.getUserFriendlyMessage(error.message));
      throw error;
    }
  }

  /**
   * Annuler une procédure
   */
  async cancelProcedure(procedureId: string, reason?: string): Promise<UserProcedure> {
    if (!procedureId) {
      throw new Error('ID de procédure manquant');
    }

    try {
      const response = await this.fetchWithAuth(
        `/api/procedures/${procedureId}/cancel`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Erreur ${response.status}`;
        
        if (response.status === 403) {
          throw new Error('Action non autorisée');
        } else if (response.status === 400) {
          throw new Error('Procédure déjà finalisée');
        }
        
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      console.error('Erreur cancelProcedure:', error.message);
      
      if (error.message === 'SESSION_EXPIRED') {
        throw error;
      }
      
      toast.error(this.getUserFriendlyMessage(error.message));
      throw error;
    }
  }

  /**
   * Messages d'erreur utilisateur-friendly
   */
  private getUserFriendlyMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      'SESSION_EXPIRED': 'Session expirée - Veuillez vous reconnecter',
      'Action non autorisée': 'Vous ne pouvez annuler que vos propres procédures',
      'Procédure déjà finalisée': 'Cette procédure est déjà finalisée',
      'Procédure non trouvée': 'Cette procédure n\'existe plus',
      'Erreur 404': 'Procédure non trouvée',
      'Erreur 403': 'Accès refusé',
      'Erreur 500': 'Erreur serveur',
    };

    return messages[errorCode] || errorCode || 'Une erreur est survenue';
  }
}

// ==================== HOOKS SIMPLIFIÉS ====================

/**
 * Hook pour récupérer les procédures de l'utilisateur
 */
export const useUserProcedures = (page: number = 1, limit: number = 10) => {
  const { fetchWithAuth } = useAuth();
  const [procedures, setProcedures] = useState<PaginatedUserProcedures | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiService = new ProcedureApiService(fetchWithAuth);
      const data = await apiService.fetchUserProcedures(page, limit);
      setProcedures(data);
    } catch (err: any) {
      setError(err.message);
      
      // Ne pas afficher toast pour SESSION_EXPIRED (géré par le contexte)
      if (err.message !== 'SESSION_EXPIRED') {
        toast.error(err.message || 'Erreur lors du chargement des procédures');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, limit]);

  useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  return {
    procedures,
    loading,
    error,
    refetch: fetchProcedures,
  };
};

/**
 * Hook pour récupérer les détails d'une procédure
 */
export const useProcedureDetails = (procedureId: string | null) => {
  const { fetchWithAuth } = useAuth();
  const [procedure, setProcedure] = useState<UserProcedure | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!procedureId) {
      setProcedure(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiService = new ProcedureApiService(fetchWithAuth);
      const data = await apiService.fetchProcedureDetails(procedureId);
      setProcedure(data);
    } catch (err: any) {
      setError(err.message);
      
      if (err.message !== 'SESSION_EXPIRED') {
        toast.error(err.message || 'Erreur lors du chargement des détails');
      }
    } finally {
      setLoading(false);
    }
  }, [procedureId, fetchWithAuth]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return {
    procedure,
    loading,
    error,
    refetch: fetchDetails,
  };
};

/**
 * Hook pour annuler une procédure
 */
export const useCancelProcedure = () => {
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);

  const cancelProcedure = useCallback(
    async (procedureId: string, reason?: string): Promise<UserProcedure | null> => {
      if (!procedureId) {
        throw new Error('ID de procédure manquant');
      }

      setLoading(true);

      try {
        const apiService = new ProcedureApiService(fetchWithAuth);
        const data = await apiService.cancelProcedure(procedureId, reason);
        toast.success('Procédure annulée avec succès');
        return data;
      } catch (err: any) {
        // Le toast est déjà géré par le service
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth]
  );

  return {
    cancelProcedure,
    loading,
  };
};

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Vérifie si une procédure peut être annulée
 */
export const canCancelProcedure = (procedure: UserProcedure): boolean => {
  const finalStatuses = [
    ProcedureStatus.COMPLETED,
    ProcedureStatus.CANCELLED,
    ProcedureStatus.REJECTED,
  ];

  // Impossible d'annuler une procédure déjà finalisée
  if (finalStatuses.includes(procedure.statut)) {
    return false;
  }

  // Vérifier si des étapes sont déjà terminées
  const hasCompletedSteps = procedure.steps.some(
    (step) => step.statut === StepStatus.COMPLETED
  );

  // Peut annuler si aucune étape n'est terminée
  return !hasCompletedSteps;
};

/**
 * Calcule la progression d'une procédure
 */
export const getProgressStatus = (
  procedure: UserProcedure
): {
  percentage: number;
  completed: number;
  total: number;
} => {
  const totalSteps = procedure.steps.length;
  
  // Compter les étapes terminées
  const completedSteps = procedure.steps.filter(
    (step) => step.statut === StepStatus.COMPLETED
  ).length;

  return {
    percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    completed: completedSteps,
    total: totalSteps,
  };
};

/**
 * Formate une date pour l'affichage
 */
export const formatProcedureDate = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Date invalide';
  }
};

/**
 * Formate une date avec heure pour l'affichage
 */
export const formatProcedureDateTime = (dateString: string | Date): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Date invalide';
  }
};

/**
 * Obtient le nom d'affichage d'une étape
 */
export const getStepDisplayName = (stepName: StepName): string => {
  const stepNames: Record<StepName, string> = {
    [StepName.DEMANDE_ADMISSION]: "Demande d'admission",
    [StepName.DEMANDE_VISA]: 'Demande de visa',
    [StepName.PREPARATIF_VOYAGE]: 'Préparatifs de voyage',
  };
  return stepNames[stepName] || stepName.toString();
};

/**
 * Obtient le statut d'affichage d'une procédure
 */
export const getProcedureDisplayStatus = (status: ProcedureStatus): string => {
  return status.toString();
};

/**
 * Obtient le statut d'affichage d'une étape
 */
export const getStepDisplayStatus = (status: StepStatus): string => {
  return status.toString();
};

/**
 * Obtient la couleur du statut d'une procédure
 */
export const getProcedureStatusColor = (statut: ProcedureStatus): string => {
  switch (statut) {
    case ProcedureStatus.IN_PROGRESS:
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case ProcedureStatus.COMPLETED:
      return 'bg-green-50 text-green-700 border-green-200';
    case ProcedureStatus.CANCELLED:
      return 'bg-gray-100 text-gray-700 border-gray-300';
    case ProcedureStatus.REJECTED:
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

/**
 * Obtient la couleur du statut d'une étape
 */
export const getStepStatusColor = (statut: StepStatus): string => {
  switch (statut) {
    case StepStatus.PENDING:
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case StepStatus.IN_PROGRESS:
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case StepStatus.COMPLETED:
      return 'bg-green-50 text-green-700 border-green-200';
    case StepStatus.CANCELLED:
      return 'bg-gray-100 text-gray-600 border-gray-300';
    case StepStatus.REJECTED:
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

/**
 * Vérifie si une procédure a un rendez-vous associé peuplé
 */
export const hasPopulatedRendezvous = (procedure: UserProcedure): boolean => {
  return (
    procedure.rendezVousId !== undefined &&
    procedure.rendezVousId !== null &&
    typeof procedure.rendezVousId === 'object' &&
    'firstName' in procedure.rendezVousId
  );
};

// Export pour utilisation externe
export default ProcedureApiService;