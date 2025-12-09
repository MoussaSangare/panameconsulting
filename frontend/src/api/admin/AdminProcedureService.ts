import { toast } from 'react-toastify';

// ==================== TYPES ====================
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
  dateMaj: string;
  dateCreation: string;
  dateCompletion?: string;
}

export interface Procedure {
  _id: string;
  rendezVousId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  destination: string;
  filiere?: string;
  niveauEtude?: string;
  statut: ProcedureStatus;
  steps: Step[];
  isDeleted: boolean;
  deletedAt?: string;
  deletionReason?: string;
  raisonRejet?: string;
  dateCompletion?: string;
  createdAt: string;
  updatedAt: string;
  // Champs supplémentaires du rendez-vous
  rendezVous?: {
    _id: string;
    firstName: string;
    lastName: string;
    date: string;
    time: string;
    status: string;
    avisAdmin?: string;
  };
}

export interface PaginatedResponse {
  data: Procedure[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProcedureFilters {
  email?: string;
  statut?: ProcedureStatus | '';
  destination?: string;
  filiere?: string;
  search?: string;
}

export interface UpdateStepDto {
  statut?: StepStatus;
  raisonRefus?: string;
  dateCreation?: string;
  dateMaj?: string;
  dateCompletion?: string;
}

export interface UpdateProcedureDto {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
  destination?: string;
  destinationAutre?: string;
  filiere?: string;
  filiereAutre?: string;
  niveauEtude?: string;
  statut?: ProcedureStatus;
  steps?: UpdateStepDto[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletionReason?: string;
  raisonRejet?: string;
  dateCompletion?: string;
  dateDerniereModification?: string;
}

export interface CreateProcedureDto {
  rendezVousId: string;
}

export interface CancelProcedureDto {
  reason?: string;
}

export interface StatsResponse {
  byStatus: Array<{ _id: string; count: number }>;
  byDestination: Array<{ _id: string; count: number }>;
  total: number;
}

// ==================== CONSTANTS ====================
const API_BASE_URL = import.meta.env.VITE_API_URL;
const API_TIMEOUT = 30000;

// ==================== ERROR HANDLING ====================
export class ProcedureError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ProcedureError';
  }
}

const ERROR_MAPPING: Record<string, string> = {
  VALIDATION_RENDEZVOIS_NON_TERMINE: 'Le rendez-vous doit être terminé',
  VALIDATION_AVIS_NON_FAVORABLE: "L'avis administratif doit être favorable",
  VALIDATION_PROCEDURE_EXISTANTE: 'Une procédure existe déjà',
  VALIDATION_ORDRE_ETAPES: "Respectez l'ordre des étapes",
  VALIDATION_ETAPE_FINALISEE: 'Étape déjà finalisée',
  VALIDATION_ADMISSION_REJECTED: 'Admission rejetée/annulée',
  VALIDATION_VISA_REJECTED: 'Visa rejeté/annulé',
  VALIDATION_VISA_NON_COMPLETED: 'Visa non terminé',
  VALIDATION_ETAPE_NON_REPRISABLE: 'Étape non reprise',
  VALIDATION_PAGE_INVALIDE: 'Page invalide',
  VALIDATION_LIMIT_INVALIDE: 'Limite invalide',
  VALIDATION_RAISON_REQUISE: 'Raison requise',
  VALIDATION_RAISON_TROP_COURTE: 'Raison trop courte',
  VALIDATION_RAISON_TROP_LONGUE: 'Raison trop longue',
  UNAUTHORIZED: 'Session expirée',
  NOT_FOUND: 'Procédure non trouvée',
  FORBIDDEN: 'Accès interdit',
  NETWORK_ERROR: 'Erreur de connexion au serveur',
  TIMEOUT: 'La requête a expiré',
};

// ==================== UTILITY FUNCTIONS ====================
const maskSensitiveData = {
  email: (email: string): string => {
    if (!email) return '[email_masqué]';
    const [name, domain] = email.split('@');
    if (!name || !domain) return '[email_invalide]';
    return `${name.charAt(0)}***@${domain}`;
  },

  id: (id: string): string => {
    if (!id) return '[id_masqué]';
    if (id.length <= 8) return id;
    return `${id.substring(0, 4)}***${id.substring(id.length - 4)}`;
  },
};

// Fonction delay compatible SSR
const delay = (ms: number) => {
  if (typeof globalThis !== 'undefined' && globalThis.setTimeout) {
    return new Promise(resolve => globalThis.setTimeout(resolve, ms));
  }
  return Promise.resolve();
};

// ==================== TOAST UTILITIES ====================
const showToast = {
  success: (message: string) => {
    toast.success(message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },

  error: (message: string, code?: string) => {
    const userMessage =
      code && ERROR_MAPPING[code] ? `${ERROR_MAPPING[code]}` : message;

    toast.error(userMessage, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },

  info: (message: string) => {
    toast.info(message, {
      position: 'top-right',
      autoClose: 3000,
    });
  },
};

// ==================== MAIN SERVICE CLASS ====================
export class ProcedureService {
  private accessToken: string | null = null;
  private logoutCallback:
    | ((redirectPath?: string, silent?: boolean) => void)
    | null = null;

  constructor(
    accessToken?: string | null,
    logoutCallback?: (redirectPath?: string, silent?: boolean) => void
  ) {
    this.accessToken = accessToken || null;
    this.logoutCallback = logoutCallback || null;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setLogoutCallback(
    callback: (redirectPath?: string, silent?: boolean) => void
  ) {
    this.logoutCallback = callback;
  }

  // ==================== CORE REQUEST METHOD ====================
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // Vérifier si nous sommes dans un environnement navigateur
    if (typeof globalThis === 'undefined' || !globalThis.setTimeout) {
      throw new ProcedureError(
        'Environnement non supporté',
        'ENVIRONMENT_ERROR'
      );
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(
      () => controller.abort(),
      API_TIMEOUT
    );

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(this.accessToken && {
          Authorization: `Bearer ${this.accessToken}`,
        }),
        ...options.headers,
      };

      const response = await globalThis.fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      globalThis.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        let errorCode = 'UNKNOWN_ERROR';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
          errorCode = errorData.code || errorCode;
        } catch {
          // Utiliser le texte brut si le parsing échoue
        }

        // Gestion des erreurs spécifiques
        if (response.status === 401) {
          errorCode = 'UNAUTHORIZED';
          showToast.error(
            'Session expirée. Veuillez vous reconnecter.',
            'UNAUTHORIZED'
          );
          if (this.logoutCallback) {
            this.logoutCallback('/connexion', true);
          }
        } else if (response.status === 403) {
          errorCode = 'FORBIDDEN';
          showToast.error('Accès interdit', 'FORBIDDEN');
        } else if (response.status === 404) {
          errorCode = 'NOT_FOUND';
        } else if (response.status === 400) {
          // Mapping des erreurs de validation
          Object.keys(ERROR_MAPPING).forEach(code => {
            if (
              errorMessage.includes(code) ||
              errorMessage.includes(ERROR_MAPPING[code])
            ) {
              errorCode = code;
              errorMessage = ERROR_MAPPING[code];
            }
          });
        }

        // Tentative de reconnexion pour certaines erreurs
        if (response.status >= 500 && retryCount < 2) {
          await delay(1000 * (retryCount + 1));
          return this.makeRequest<T>(endpoint, options, retryCount + 1);
        }

        throw new ProcedureError(errorMessage, errorCode, response.status);
      }

      const data = await response.json();
      return data as T;
    } catch (error: any) {
      globalThis.clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ProcedureError(
          'La requête a expiré. Veuillez réessayer.',
          'TIMEOUT'
        );
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new ProcedureError(
          'Erreur de connexion au serveur. Vérifiez votre connexion internet.',
          'NETWORK_ERROR'
        );
      }

      if (error instanceof ProcedureError) {
        throw error;
      }

      throw new ProcedureError(
        error.message || 'Erreur inconnue',
        'UNKNOWN_ERROR'
      );
    }
  }

  // ==================== PUBLIC METHODS ====================

  // === ADMIN METHODS ===

  async fetchAdminProcedures(
    page: number = 1,
    limit: number = 10,
    filters: ProcedureFilters = {}
  ): Promise<PaginatedResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    if (filters.email) params.append('email', filters.email);
    if (filters.statut) params.append('statut', filters.statut);
    if (filters.destination) params.append('destination', filters.destination);
    if (filters.filiere) params.append('filiere', filters.filiere);
    if (filters.search) params.append('search', filters.search);

    return this.makeRequest<PaginatedResponse>(
      `/api/procedures/admin/all?${params.toString()}`
    );
  }

  async getAdminProcedureDetails(id: string): Promise<Procedure> {
    return this.makeRequest<Procedure>(`/api/procedures/admin/${id}`);
  }

  async updateAdminStep(
    procedureId: string,
    stepName: string,
    updates: UpdateStepDto
  ): Promise<Procedure> {
    const encodedStepName = encodeURIComponent(stepName);
    const result = await this.makeRequest<Procedure>(
      `/api/procedures/admin/${procedureId}/steps/${encodedStepName}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    showToast.success('Étape mise à jour avec succès');
    return result;
  }

  async deleteAdminProcedure(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.makeRequest<{
      success: boolean;
      message: string;
    }>(`/api/procedures/admin/${id}`, {
      method: 'DELETE',
      body: reason ? JSON.stringify({ reason }) : undefined,
    });

    showToast.success('Procédure supprimée avec succès');
    return result;
  }

  async rejectAdminProcedure(id: string, reason: string): Promise<Procedure> {
    const result = await this.makeRequest<Procedure>(
      `/api/procedures/admin/${id}/reject`,
      {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      }
    );

    showToast.success('Procédure rejetée avec succès');
    return result;
  }

  async updateAdminProcedure(
    id: string,
    updates: UpdateProcedureDto
  ): Promise<Procedure> {
    const result = await this.makeRequest<Procedure>(
      `/api/procedures/admin/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    showToast.success('Procédure mise à jour avec succès');
    return result;
  }

  async createProcedureFromRendezvous(
    rendezVousId: string
  ): Promise<Procedure> {
    const result = await this.makeRequest<Procedure>(
      '/api/procedures/admin/create',
      {
        method: 'POST',
        body: JSON.stringify({ rendezVousId }),
      }
    );

    showToast.success('Procédure créée avec succès');
    return result;
  }

  async getAdminProceduresOverview(): Promise<StatsResponse> {
    return this.makeRequest<StatsResponse>('/api/procedures/admin/stats');
  }

  // === USER METHODS ===

  async fetchUserProcedures(
    email: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse> {
    return this.makeRequest<PaginatedResponse>(
      `/api/procedures/user?email=${encodeURIComponent(email)}&page=${page}&limit=${limit}`
    );
  }

  async getUserProcedureDetails(id: string): Promise<Procedure> {
    return this.makeRequest<Procedure>(`/api/procedures/${id}`);
  }

  async cancelUserProcedure(
    id: string,
    email: string,
    reason?: string
  ): Promise<Procedure> {
    const result = await this.makeRequest<Procedure>(
      `/api/procedures/${id}/cancel`,
      {
        method: 'PUT',
        body: JSON.stringify({ reason, email }),
      }
    );

    showToast.success('Procédure annulée avec succès');
    return result;
  }

  async getUserProceduresByEmail(email: string): Promise<Procedure[]> {
    return this.makeRequest<Procedure[]>(
      `/api/procedures/email/${encodeURIComponent(email)}`
    );
  }

  // === COMMON METHODS ===

  async findProceduresByEmail(email: string): Promise<Procedure[]> {
    return this.makeRequest<Procedure[]>(
      `/api/procedures/find?email=${encodeURIComponent(email)}`
    );
  }

  async getActiveProcedures(
    page: number = 1,
    limit: number = 10,
    email?: string
  ): Promise<PaginatedResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (email) params.append('email', email);

    return this.makeRequest<PaginatedResponse>(
      `/api/procedures/active?${params.toString()}`
    );
  }

  async softDeleteProcedure(id: string, reason?: string): Promise<Procedure> {
    const result = await this.makeRequest<Procedure>(
      `/api/procedures/${id}/soft-delete`,
      {
        method: 'DELETE',
        body: reason ? JSON.stringify({ reason }) : undefined,
      }
    );

    showToast.success('Procédure archivée avec succès');
    return result;
  }

  // ==================== UTILITY METHODS ====================

  static translateStepName(stepName: StepName): string {
    switch (stepName) {
      case StepName.DEMANDE_ADMISSION:
        return "Demande d'admission";
      case StepName.DEMANDE_VISA:
        return 'Demande de visa';
      case StepName.PREPARATIF_VOYAGE:
        return 'Préparatifs de voyage';
      default:
        return stepName;
    }
  }

  static canModifyStep(
    procedure: Procedure,
    stepName: StepName,
    newStatus?: StepStatus
  ): { canModify: boolean; reason?: string } {
    const step = procedure.steps.find(s => s.nom === stepName);
    if (!step) {
      return { canModify: false, reason: 'Étape non trouvée' };
    }

    if (
      [
        StepStatus.COMPLETED,
        StepStatus.REJECTED,
        StepStatus.CANCELLED,
      ].includes(step.statut)
    ) {
      return { canModify: false, reason: 'Étape déjà finalisée' };
    }

    if (stepName !== StepName.DEMANDE_ADMISSION) {
      const admissionStep = procedure.steps.find(
        s => s.nom === StepName.DEMANDE_ADMISSION
      );
      if (
        admissionStep &&
        [StepStatus.REJECTED, StepStatus.CANCELLED].includes(
          admissionStep.statut
        )
      ) {
        return {
          canModify: false,
          reason: `Impossible de modifier car l'admission est ${admissionStep.statut.toLowerCase()}`,
        };
      }
    }

    if (stepName === StepName.PREPARATIF_VOYAGE) {
      const visaStep = procedure.steps.find(
        s => s.nom === StepName.DEMANDE_VISA
      );
      if (
        visaStep &&
        [StepStatus.REJECTED, StepStatus.CANCELLED].includes(visaStep.statut)
      ) {
        return {
          canModify: false,
          reason: `Impossible de modifier car le visa est ${visaStep.statut.toLowerCase()}`,
        };
      }
    }

    if (
      stepName === StepName.DEMANDE_VISA &&
      newStatus !== StepStatus.REJECTED
    ) {
      const admissionStep = procedure.steps.find(
        s => s.nom === StepName.DEMANDE_ADMISSION
      );
      if (admissionStep && admissionStep.statut !== StepStatus.COMPLETED) {
        return {
          canModify: false,
          reason: "L'admission doit être terminée avant de démarrer le visa",
        };
      }
    }

    if (
      stepName === StepName.PREPARATIF_VOYAGE &&
      newStatus !== StepStatus.REJECTED
    ) {
      const visaStep = procedure.steps.find(
        s => s.nom === StepName.DEMANDE_VISA
      );
      if (visaStep && visaStep.statut !== StepStatus.COMPLETED) {
        return {
          canModify: false,
          reason:
            'Le visa doit être terminé avant de démarrer les préparatifs de voyage',
        };
      }
    }

    return { canModify: true };
  }

  static getStatusColor(status: ProcedureStatus | StepStatus): string {
  if (status === ProcedureStatus.IN_PROGRESS || status === StepStatus.IN_PROGRESS) {
    return 'blue';
  }
  
  if (status === ProcedureStatus.COMPLETED || status === StepStatus.COMPLETED) {
    return 'green';
  }
  
  if (status === ProcedureStatus.REJECTED || status === StepStatus.REJECTED) {
    return 'red';
  }
  
  if (status === ProcedureStatus.CANCELLED || status === StepStatus.CANCELLED) {
    return 'gray';
  }
  
  if (status === StepStatus.PENDING) {
    return 'yellow';
  }
  
  return 'gray';
}

  static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  static maskEmail(email: string): string {
    return maskSensitiveData.email(email);
  }

  static maskId(id: string): string {
    return maskSensitiveData.id(id);
  }
}

// ==================== HOOK PERSONNALISÉ ====================
import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';

export const useProcedureService = () => {
  const { access_token, logout } = useAuth();

  return useMemo(() => {
    const instance = new ProcedureService(access_token, logout);
    return instance;
  }, [access_token, logout]);
};

// ==================== REACT HOOKS UTILITAIRES ====================
import { useState, useCallback } from 'react';

export const useProcedureActions = (service: ProcedureService) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withErrorHandling = useCallback(
    async <T>(
      operation: () => Promise<T>,
      successMessage?: string
    ): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const result = await operation();

        if (successMessage) {
          showToast.success(successMessage);
        }

        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'Une erreur est survenue';
        setError(errorMessage);


        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    setError,
    withErrorHandling,
  };
};