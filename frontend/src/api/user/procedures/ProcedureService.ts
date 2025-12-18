import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

// ==================== TYPES SÉCURISÉS ====================
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

export interface UserProcedureStep {
  nom: StepName;
  statut: StepStatus;
  dateCreation: Date;
  dateMaj: Date;
  raisonRefus?: string;
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
  rendezVousId: RendezvousInfo | string;
  prenom: string;
  nom: string;
  email: string;
  destination: string;
  destinationAutre?: string;
  filiere: string;
  filiereAutre?: string;
  niveauEtude: string;
  telephone?: string;
  statut: ProcedureStatus;
  steps: UserProcedureStep[];
  raisonRejet?: string;
  dateCompletion?: Date;
  dateDerniereModification?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUserProcedures {
  data: UserProcedure[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CancelProcedureDto {
  reason?: string;
}

// ==================== SERVICE API UTILISANT LE CONTEXTE ====================
class ProcedureApiService {
  /**
   * Récupérer les procédures de l'utilisateur connecté
   * Utilise fetchWithAuth du contexte pour gérer automatiquement les tokens
   */
  async fetchUserProcedures(
    fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedUserProcedures> {
    try {
      const response = await fetchWithAuth(
        `/api/procedures/user?page=${page}&limit=${limit}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Transforme les données pour correspondre à l'interface frontend
      const transformedData: PaginatedUserProcedures = {
        data: data.data.map(this.transformProcedureData.bind(this)),
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages,
      };

      return transformedData;
    } catch (error: any) {
      if (import.meta.env.DEV) {
        globalThis.console.error('Erreur fetchUserProcedures:', error.message);
      }

      // Afficher un toast uniquement pour les erreurs non liées à la session
      if (error.message !== 'SESSION_EXPIRED') {
        toast.error(this.getUserFriendlyMessage(error.message));
      }

      throw error;
    }
  }

  /**
   * Récupérer les détails d'une procédure spécifique
   */
  async fetchProcedureDetails(
    fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>,
    procedureId: string
  ): Promise<UserProcedure> {
    if (!procedureId) {
      toast.error('ID de procédure manquant');
      throw new Error('ID de procédure manquant');
    }

    try {
      const response = await fetchWithAuth(`/api/procedures/${procedureId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return this.transformProcedureData(data);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        globalThis.console.error(
          'Erreur fetchProcedureDetails:',
          error.message
        );
      }

      if (error.message !== 'SESSION_EXPIRED') {
        toast.error(this.getUserFriendlyMessage(error.message));
      }

      throw error;
    }
  }

  /**
   * Annuler une procédure
   */
  async cancelProcedure(
    fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>,
    procedureId: string,
    reason?: string
  ): Promise<UserProcedure> {
    if (!procedureId) {
      toast.error('ID de procédure manquant');
      throw new Error('ID de procédure manquant');
    }

    try {
      const response = await fetchWithAuth(
        `/api/procedures/${procedureId}/cancel`,
        {
          method: 'PUT',
          body: JSON.stringify({ reason } as CancelProcedureDto),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      toast.success('Procédure annulée avec succès');
      return this.transformProcedureData(data);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        globalThis.console.error('Erreur cancelProcedure:', error.message);
      }

      if (error.message !== 'SESSION_EXPIRED') {
        toast.error(this.getUserFriendlyMessage(error.message));
      }

      throw error;
    }
  }

  /**
   * Transformer les données du backend pour correspondre au frontend
   */
  private transformProcedureData(data: any): UserProcedure {
    return {
      _id: data._id || data.id,
      rendezVousId: data.rendezVousId || '',
      prenom: data.prenom || '',
      nom: data.nom || '',
      email: data.email || '',
      destination: data.destination || '',
      destinationAutre: data.destinationAutre,
      filiere: data.filiere || '',
      filiereAutre: data.filiereAutre,
      niveauEtude: data.niveauEtude || '',
      telephone: data.telephone,
      statut: (data.statut as ProcedureStatus) || ProcedureStatus.IN_PROGRESS,
      steps: this.transformSteps(data.steps || []),
      raisonRejet: data.raisonRejet,
      dateCompletion: data.dateCompletion
        ? new Date(data.dateCompletion)
        : undefined,
      dateDerniereModification: data.dateDerniereModification
        ? new Date(data.dateDerniereModification)
        : undefined,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Transformer les étapes du backend pour correspondre au frontend
   */
  private transformSteps(steps: any[]): UserProcedureStep[] {
    return steps.map(step => ({
      nom: step.nom as StepName,
      statut: step.statut as StepStatus,
      dateCreation: new Date(step.dateCreation),
      dateMaj: new Date(step.dateMaj),
      raisonRefus: step.raisonRefus,
      dateCompletion: step.dateCompletion
        ? new Date(step.dateCompletion)
        : undefined,
    }));
  }

  /**
   * Messages d'erreur utilisateur-friendly
   */
  private getUserFriendlyMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      SESSION_EXPIRED: 'Session expirée - Veuillez vous reconnecter',
      'ID de procédure manquant': 'Identifiant de procédure manquant',
      'Délai de connexion dépassé': 'Délai de connexion dépassé',
      'Erreur 400': 'Requête incorrecte',
      'Erreur 403': 'Accès refusé',
      'Erreur 404': 'Procédure non trouvée',
      'Erreur 500': 'Erreur serveur',
    };

    return messages[errorCode] || 'Une erreur est survenue';
  }
}

// ==================== HOOKS PERSONNALISÉS UTILISANT LE CONTEXTE ====================

/**
 * Hook pour récupérer les procédures de l'utilisateur
 */
export const useUserProcedures = (page: number = 1, limit: number = 10) => {
  const { fetchWithAuth, access_token } = useAuth();
  const [procedures, setProcedures] = useState<PaginatedUserProcedures | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProcedures = useCallback(async () => {
    // Vérifier que nous avons un token
    if (!access_token) {
      setLoading(false);
      setError('Non authentifié');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiService = new ProcedureApiService();
      const data = await apiService.fetchUserProcedures(
        fetchWithAuth,
        page,
        limit
      );
      setProcedures(data);
    } catch (err: any) {
      const errorMessage = err.message || 'ERREUR_INCONNUE';
      setError(errorMessage);

      // Le contexte gère déjà la déconnexion pour SESSION_EXPIRED
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, access_token, page, limit]);

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
  const { fetchWithAuth, access_token } = useAuth();
  const [procedure, setProcedure] = useState<UserProcedure | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!procedureId) {
      setProcedure(null);
      setLoading(false);
      return;
    }

    if (!access_token) {
      setLoading(false);
      setError('Non authentifié');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiService = new ProcedureApiService();
      const data = await apiService.fetchProcedureDetails(
        fetchWithAuth,
        procedureId
      );
      setProcedure(data);
    } catch (err: any) {
      const errorMessage = err.message || 'ERREUR_INCONNUE';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [procedureId, fetchWithAuth, access_token]);

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
  const { fetchWithAuth, access_token } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);

  const cancelProcedure = useCallback(
    async (
      procedureId: string,
      reason?: string
    ): Promise<UserProcedure | null> => {
      if (!access_token) {
        throw new Error('Non authentifié');
      }

      if (!procedureId) {
        throw new Error('ID de procédure manquant');
      }

      setLoading(true);

      try {
        const apiService = new ProcedureApiService();
        const data = await apiService.cancelProcedure(
          fetchWithAuth,
          procedureId,
          reason
        );
        return data;
      } catch (err: any) {
        const errorMessage = err.message || 'ERREUR_INCONNUE';
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchWithAuth, access_token]
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

  if (finalStatuses.includes(procedure.statut)) {
    return false;
  }

  // Vérifier si des étapes sont déjà terminées
  const hasCompletedSteps = procedure.steps.some(
    (step: UserProcedureStep) => step.statut === StepStatus.COMPLETED
  );

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
  const completedSteps = procedure.steps.filter(
    (step: UserProcedureStep) => step.statut === StepStatus.COMPLETED
  ).length;

  return {
    percentage:
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    completed: completedSteps,
    total: totalSteps,
  };
};

/**
 * Formate une date pour l'affichage
 */
export const formatProcedureDate = (dateString: string | Date): string => {
  try {
    const date =
      typeof dateString === 'string' ? new Date(dateString) : dateString;

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
      return 'bg-red-50 text-red-700 border-red-200';
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
      return 'bg-red-50 text-red-700 border-red-200';
    case StepStatus.REJECTED:
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

// Export pour utilisation externe
export default ProcedureApiService;