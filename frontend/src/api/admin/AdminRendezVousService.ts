import { useMemo } from 'react';
import { toast } from 'react-toastify';

// Types exportés - alignés avec le backend
export type RendezvousStatus = 'En attente' | 'Confirmé' | 'Terminé' | 'Annulé';
export type AdminOpinion = 'Favorable' | 'Défavorable';

export interface Rendezvous {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  destination: string;
  destinationAutre?: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre?: string;
  date: string;
  time: string;
  status: RendezvousStatus;
  avisAdmin?: AdminOpinion;
  cancelledAt?: string;
  cancelledBy?: 'admin' | 'user';
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  dateTime?: Date;
  effectiveDestination?: string;
  effectiveFiliere?: string;
  isPast?: boolean;
  canBeCancelledByUser?: boolean;
}

export interface RendezvousListResponse {
  data: Rendezvous[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateRendezvousData {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  destination: string;
  destinationAutre?: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre?: string;
  date: string;
  time: string;
}

export interface UpdateRendezvousData {
  firstName?: string;
  lastName?: string;
  email?: string;
  telephone?: string;
  destination?: string;
  destinationAutre?: string;
  niveauEtude?: string;
  filiere?: string;
  filiereAutre?: string;
  date?: string;
  time?: string;
  status?: RendezvousStatus;
  avisAdmin?: AdminOpinion;
}

export interface FilterParams {
  page?: number;
  limit?: number;
  status?: RendezvousStatus;
  date?: string;
  search?: string;
}

// Constantes pour la cohérence avec le backend
const RENDEZVOUS_STATUS = {
  PENDING: 'En attente' as const,
  CONFIRMED: 'Confirmé' as const,
  COMPLETED: 'Terminé' as const,
  CANCELLED: 'Annulé' as const
};

const ADMIN_OPINION = {
  FAVORABLE: 'Favorable' as const,
  UNFAVORABLE: 'Défavorable' as const
};

const EDUCATION_LEVELS = [
  'Bac',
  'Bac+1',
  'Bac+2',
  'Licence',
  'Master I',
  'Master II',
  'Doctorat'
] as const;

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30'
] as const;

// Interface pour les messages d'erreur
interface ErrorMessages {
  // Messages génériques
  NETWORK_ERROR: string;
  SERVER_ERROR: string;
  UNAUTHORIZED: string;
  FORBIDDEN: string;
  NOT_FOUND: string;
  VALIDATION_ERROR: string;
  RATE_LIMIT: string;
  
  // Messages spécifiques au rendez-vous
  ACCOUNT_REQUIRED: string;
  EMAIL_MISMATCH: string;
  ALREADY_CONFIRMED: string;
  SLOT_UNAVAILABLE: string;
  DATE_FULL: string;
  PAST_DATE: string;
  PAST_SLOT: string;
  WEEKEND: string;
  HOLIDAY: string;
  INVALID_TIME: string;
  INVALID_TIME_SLOT: string;
  COMPLETED_NO_EDIT: string;
  CANCEL_THRESHOLD: string;
  CANCEL_ONLY_CONFIRMED: string;
  ADMIN_REQUIRED_STATUS: string;
  TERMINATE_REQUIRES_AVIS: string;
  INVALID_AVIS: string;
  DESTINATION_REQUIRED: string;
  FILIERE_REQUIRED: string;
  NO_ACCOUNT_FOUND: string;
  CANT_UPDATE_OTHERS: string;
  
  // Messages de succès
  CREATE_SUCCESS: string;
  UPDATE_SUCCESS: string;
  STATUS_UPDATE_SUCCESS: string;
  DELETE_SUCCESS: string;
  CONFIRM_SUCCESS: string;
  TERMINATE_SUCCESS: string;
  FETCH_SUCCESS: string;
}

// Messages d'erreur alignés avec le backend
const ERROR_MESSAGES: ErrorMessages = {
  // Messages génériques
  NETWORK_ERROR: 'Erreur réseau. Vérifiez votre connexion.',
  SERVER_ERROR: 'Erreur serveur. Veuillez réessayer.',
  UNAUTHORIZED: 'Session expirée. Veuillez vous reconnecter.',
  FORBIDDEN: 'Accès non autorisé.',
  NOT_FOUND: 'Rendez-vous non trouvé.',
  VALIDATION_ERROR: 'Données invalides.',
  RATE_LIMIT: 'Trop de requêtes. Veuillez patienter.',
  
  // Messages spécifiques au rendez-vous
  ACCOUNT_REQUIRED: 'Vous devez avoir un compte pour prendre un rendez-vous. Veuillez vous inscrire d\'abord.',
  EMAIL_MISMATCH: 'L\'email doit correspondre exactement à votre compte de connexion',
  ALREADY_CONFIRMED: 'Vous avez déjà un rendez-vous confirmé',
  SLOT_UNAVAILABLE: 'Ce créneau horaire n\'est pas disponible',
  DATE_FULL: 'Tous les créneaux sont complets pour cette date',
  PAST_DATE: 'Vous ne pouvez pas réserver une date passée',
  PAST_SLOT: 'Vous ne pouvez pas réserver un créneau passé',
  WEEKEND: 'Les réservations sont fermées le week-end',
  HOLIDAY: 'Les réservations sont fermées les jours fériés',
  INVALID_TIME: 'Les horaires disponibles sont entre 9h00 et 16h30',
  INVALID_TIME_SLOT: 'Les créneaux doivent être espacés de 30 minutes (9h00, 9h30, 10h00, etc.)',
  COMPLETED_NO_EDIT: 'Impossible de modifier un rendez-vous terminé',
  CANCEL_THRESHOLD: 'Vous ne pouvez plus annuler votre rendez-vous à moins de 2 heures de l\'heure prévue',
  CANCEL_ONLY_CONFIRMED: 'Vous ne pouvez annuler que les rendez-vous confirmés',
  ADMIN_REQUIRED_STATUS: 'Seuls les administrateurs peuvent changer le statut',
  TERMINATE_REQUIRES_AVIS: 'L\'avis admin est obligatoire pour terminer un rendez-vous',
  INVALID_AVIS: 'Avis admin invalide. Doit être \'Favorable\' ou \'Défavorable\'',
  DESTINATION_REQUIRED: 'La destination "Autre" nécessite une précision',
  FILIERE_REQUIRED: 'La filière "Autre" nécessite une précision',
  NO_ACCOUNT_FOUND: 'Aucun compte trouvé pour cet email. Veuillez d\'abord créer un compte.',
  CANT_UPDATE_OTHERS: 'Vous ne pouvez modifier que vos propres rendez-vous',
  
  // Messages de succès
  CREATE_SUCCESS: 'Rendez-vous créé avec succès',
  UPDATE_SUCCESS: 'Rendez-vous mis à jour',
  STATUS_UPDATE_SUCCESS: 'Statut mis à jour',
  DELETE_SUCCESS: 'Rendez-vous annulé',
  CONFIRM_SUCCESS: 'Rendez-vous confirmé',
  TERMINATE_SUCCESS: 'Rendez-vous terminé',
  FETCH_SUCCESS: 'Rendez-vous chargés',
} as const;

export class AdminRendezVousService {
  private fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>;
  private baseUrl: string = import.meta.env.VITE_API_URL || '';
  private lastRequestTime: number = 0;
  private MIN_REQUEST_INTERVAL = 1000;
  private requestQueue: Promise<any> = Promise.resolve();
  private isProcessingQueue: boolean = false;
  private activeRequests: Set<string> = new Set();
  private requestTimeout: number = 30000;

  constructor(fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>) {
    this.fetchWithAuth = fetchWithAuth;
  }

  private buildQueryString(params: FilterParams): string {
    const searchParams = new URLSearchParams();
    
    if (params.page !== undefined) searchParams.append('page', params.page.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params.status) searchParams.append('status', params.status);
    if (params.date) searchParams.append('date', params.date);
    if (params.search) searchParams.append('search', params.search.trim());
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  private async rateLimitedFetch(endpoint: string, options?: RequestInit): Promise<Response> {
    const requestId = `${endpoint}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.activeRequests.add(requestId);
      
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastRequestTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      try {
        const response = await this.fetchWithAuth(endpoint, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
      
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private async queueRequest<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(async () => {
          this.isProcessingQueue = true;
          try {
            console.log(`⌛ ${operationName} en cours...`);
            const result = await operation();
            console.log(`✅ ${operationName} réussi`);
            resolve(result);
          } catch (error) {
            console.error(`❌ ${operationName} échoué:`, error);
            reject(error);
          } finally {
            this.isProcessingQueue = false;
          }
        })
        .catch((error) => {
          console.error(`❌ Erreur dans la file d'attente pour ${operationName}:`, error);
          reject(error);
        });
    });
  }

  private async handleResponse<T>(response: Response, operation: string): Promise<T> {
    if (!response.ok) {
      let errorMessage = ERROR_MESSAGES.SERVER_ERROR;
      
      try {
        const errorData = await response.json();
        
        // Récupération du message d'erreur du backend
        if (errorData.message) {
          errorMessage = errorData.message;
          
          // Mapping des messages d'erreur spécifiques du backend
          if (errorMessage.includes('compte pour prendre un rendez-vous')) {
            errorMessage = ERROR_MESSAGES.ACCOUNT_REQUIRED;
          } else if (errorMessage.includes('doit correspondre exactement')) {
            errorMessage = ERROR_MESSAGES.EMAIL_MISMATCH;
          } else if (errorMessage.includes('déjà un rendez-vous confirmé')) {
            errorMessage = ERROR_MESSAGES.ALREADY_CONFIRMED;
          } else if (errorMessage.includes('créneau horaire n\'est pas disponible')) {
            errorMessage = ERROR_MESSAGES.SLOT_UNAVAILABLE;
          } else if (errorMessage.includes('Tous les créneaux sont complets')) {
            errorMessage = ERROR_MESSAGES.DATE_FULL;
          } else if (errorMessage.includes('date passée') || errorMessage.includes('Date invalide ou passée')) {
            errorMessage = ERROR_MESSAGES.PAST_DATE;
          } else if (errorMessage.includes('créneau passé')) {
            errorMessage = ERROR_MESSAGES.PAST_SLOT;
          } else if (errorMessage.includes('week-end')) {
            errorMessage = ERROR_MESSAGES.WEEKEND;
          } else if (errorMessage.includes('jours fériés')) {
            errorMessage = ERROR_MESSAGES.HOLIDAY;
          } else if (errorMessage.includes('horaires disponibles sont entre')) {
            errorMessage = ERROR_MESSAGES.INVALID_TIME;
          } else if (errorMessage.includes('créneaux doivent être espacés')) {
            errorMessage = ERROR_MESSAGES.INVALID_TIME_SLOT;
          } else if (errorMessage.includes('modifier un rendez-vous terminé')) {
            errorMessage = ERROR_MESSAGES.COMPLETED_NO_EDIT;
          } else if (errorMessage.includes('moins de 2 heures')) {
            errorMessage = ERROR_MESSAGES.CANCEL_THRESHOLD;
          } else if (errorMessage.includes('annuler que les rendez-vous confirmés')) {
            errorMessage = ERROR_MESSAGES.CANCEL_ONLY_CONFIRMED;
          } else if (errorMessage.includes('administrateurs peuvent changer le statut')) {
            errorMessage = ERROR_MESSAGES.ADMIN_REQUIRED_STATUS;
          } else if (errorMessage.includes('avis admin est obligatoire')) {
            errorMessage = ERROR_MESSAGES.TERMINATE_REQUIRES_AVIS;
          } else if (errorMessage.includes('Avis admin invalide')) {
            errorMessage = ERROR_MESSAGES.INVALID_AVIS;
          } else if (errorMessage.includes('nécessite une précision')) {
            if (errorMessage.includes('destination')) {
              errorMessage = ERROR_MESSAGES.DESTINATION_REQUIRED;
            } else if (errorMessage.includes('filière')) {
              errorMessage = ERROR_MESSAGES.FILIERE_REQUIRED;
            }
          } else if (errorMessage.includes('Aucun compte trouvé')) {
            errorMessage = ERROR_MESSAGES.NO_ACCOUNT_FOUND;
          } else if (errorMessage.includes('vos propres rendez-vous')) {
            errorMessage = ERROR_MESSAGES.CANT_UPDATE_OTHERS;
          }
        }
        
        // Gestion des codes HTTP
        switch (response.status) {
          case 400:
            if (!errorMessage.includes(ERROR_MESSAGES.ACCOUNT_REQUIRED) && 
                !errorMessage.includes(ERROR_MESSAGES.EMAIL_MISMATCH) &&
                !errorMessage.includes(ERROR_MESSAGES.ALREADY_CONFIRMED)) {
              errorMessage = errorData.message || ERROR_MESSAGES.VALIDATION_ERROR;
            }
            break;
          case 401:
            errorMessage = ERROR_MESSAGES.UNAUTHORIZED;
            break;
          case 403:
            if (!errorMessage.includes(ERROR_MESSAGES.ACCOUNT_REQUIRED) && 
                !errorMessage.includes(ERROR_MESSAGES.EMAIL_MISMATCH) &&
                !errorMessage.includes(ERROR_MESSAGES.ALREADY_CONFIRMED)) {
              errorMessage = ERROR_MESSAGES.FORBIDDEN;
            }
            break;
          case 404:
            errorMessage = ERROR_MESSAGES.NOT_FOUND;
            break;
          case 429:
            errorMessage = ERROR_MESSAGES.RATE_LIMIT;
            break;
        }
        
      } catch (parseError) {
        console.error('Erreur parsing error response:', parseError);
      }
      
      // Afficher le toast d'erreur
      toast.error(errorMessage, {
        autoClose: 5000,
        position: "top-right",
      });
      
      throw new Error(errorMessage);
    }
    
    try {
      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('Erreur de parsing JSON:', error);
      toast.error('Erreur lors du traitement de la réponse', {
        autoClose: 3000,
      });
      throw new Error('Erreur lors du traitement de la réponse');
    }
  }

  // ==================== MÉTHODES PUBLIQUES ====================

  // Méthode pour récupérer tous les rendez-vous (admin uniquement)
  async fetchAllRendezvous(
    page: number = 1, 
    limit: number = 10, 
    filters: FilterParams = {}
  ): Promise<RendezvousListResponse> {
    return this.queueRequest(async () => {
      try {
        const queryParams: FilterParams = { page, limit, ...filters };
        const queryString = this.buildQueryString(queryParams);
        const response = await this.rateLimitedFetch(`/api/rendezvous${queryString}`);
        
        const data = await this.handleResponse<RendezvousListResponse>(
          response,
          'Chargement des rendez-vous'
        );
        
        toast.success(`${data.data.length} rendez-vous chargés`, {
          autoClose: 2000,
          position: "top-right",
        });
        
        return data;
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            toast.error('La requête a expiré. Veuillez réessayer.', {
              autoClose: 3000,
            });
            throw new Error('Request timeout');
          }
        }
        throw error;
      }
    }, 'fetchAllRendezvous');
  }

  // Méthode pour créer un rendez-vous (admin ou utilisateur)
  async createRendezvous(data: CreateRendezvousData, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
    return this.queueRequest(async () => {
      try {
        // Validation frontale des données requises
        const requiredFields = ['firstName', 'lastName', 'email', 'telephone', 'date', 'time', 'destination', 'filiere', 'niveauEtude'];
        const missingFields = requiredFields.filter(field => !data[field as keyof CreateRendezvousData]);
        
        if (missingFields.length > 0) {
          toast.error(`Champs manquants: ${missingFields.join(', ')}`, {
            autoClose: 3000,
          });
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validation spécifique pour les champs "Autre"
        if (data.destination === 'Autre' && (!data.destinationAutre || data.destinationAutre.trim() === '')) {
          toast.error(ERROR_MESSAGES.DESTINATION_REQUIRED, {
            autoClose: 3000,
          });
          throw new Error(ERROR_MESSAGES.DESTINATION_REQUIRED);
        }
        
        if (data.filiere === 'Autre' && (!data.filiereAutre || data.filiereAutre.trim() === '')) {
          toast.error(ERROR_MESSAGES.FILIERE_REQUIRED, {
            autoClose: 3000,
          });
          throw new Error(ERROR_MESSAGES.FILIERE_REQUIRED);
        }

        // Pour les utilisateurs non-admin, vérifier que l'email correspond
        if (!isAdmin) {
          const normalizedDtoEmail = data.email.toLowerCase().trim();
          const normalizedUserEmail = userEmail.toLowerCase().trim();
          
          if (normalizedDtoEmail !== normalizedUserEmail) {
            toast.error(ERROR_MESSAGES.EMAIL_MISMATCH, {
              autoClose: 3000,
            });
            throw new Error(ERROR_MESSAGES.EMAIL_MISMATCH);
          }
        }

        const response = await this.rateLimitedFetch('/api/rendezvous', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await this.handleResponse<Rendezvous>(
          response,
          'Création du rendez-vous'
        );

        toast.success(ERROR_MESSAGES.CREATE_SUCCESS, {
          autoClose: 3000,
          position: "top-right",
        });
        
        return result;
      } catch (error) {
        throw error;
      }
    }, 'createRendezvous');
  }

  // Méthode pour récupérer les rendez-vous d'un utilisateur spécifique
  async fetchUserRendezvous(
    userEmail: string,
    page: number = 1,
    limit: number = 10,
    status?: RendezvousStatus
  ): Promise<RendezvousListResponse> {
    return this.queueRequest(async () => {
      try {
        const queryParams: FilterParams = { page, limit };
        if (status) queryParams.status = status;
        
        const queryString = this.buildQueryString(queryParams);
        const response = await this.rateLimitedFetch(`/api/rendezvous/user${queryString}`);
        
        const data = await this.handleResponse<RendezvousListResponse>(
          response,
          'Chargement des rendez-vous utilisateur'
        );
        
        return data;
      } catch (error) {
        throw error;
      }
    }, 'fetchUserRendezvous');
  }

  // Méthode pour récupérer un rendez-vous par ID
  async getRendezvousById(id: string, userEmail?: string, isAdmin: boolean = false): Promise<Rendezvous> {
    return this.queueRequest(async () => {
      if (!id || id.trim() === '' || id === 'undefined') {
        toast.error('ID rendez-vous invalide', {
          autoClose: 3000,
        });
        throw new Error('Invalid ID');
      }

      try {
        const response = await this.rateLimitedFetch(`/api/rendezvous/${id}`);
        
        const data = await this.handleResponse<Rendezvous>(
          response,
          'Récupération du rendez-vous'
        );
        
        // Vérifier les permissions d'accès
        if (!isAdmin && userEmail) {
          const normalizedRdvEmail = data.email.toLowerCase().trim();
          const normalizedUserEmail = userEmail.toLowerCase().trim();
          
          if (normalizedRdvEmail !== normalizedUserEmail) {
            toast.error(ERROR_MESSAGES.FORBIDDEN, {
              autoClose: 3000,
            });
            throw new Error(ERROR_MESSAGES.FORBIDDEN);
          }
        }
        
        return data;
      } catch (error) {
        throw error;
      }
    }, 'getRendezvousById');
  }

  // Méthode pour mettre à jour un rendez-vous
  async updateRendezvous(
    id: string, 
    data: UpdateRendezvousData, 
    userEmail: string, 
    isAdmin: boolean = false
  ): Promise<Rendezvous> {
    return this.queueRequest(async () => {
      if (!id || id.trim() === '' || id === 'undefined') {
        toast.error('ID rendez-vous invalide', {
          autoClose: 3000,
        });
        throw new Error('Invalid ID');
      }

      try {
        // Validation spécifique pour les champs "Autre"
        if (data.destination === 'Autre' && (!data.destinationAutre || data.destinationAutre.trim() === '')) {
          toast.error(ERROR_MESSAGES.DESTINATION_REQUIRED, {
            autoClose: 3000,
          });
          throw new Error(ERROR_MESSAGES.DESTINATION_REQUIRED);
        }
        
        if (data.filiere === 'Autre' && (!data.filiereAutre || data.filiereAutre.trim() === '')) {
          toast.error(ERROR_MESSAGES.FILIERE_REQUIRED, {
            autoClose: 3000,
          });
          throw new Error(ERROR_MESSAGES.FILIERE_REQUIRED);
        }

        // Si utilisateur normal tente de changer l'email
        if (!isAdmin && data.email) {
          const normalizedUpdateEmail = data.email.toLowerCase().trim();
          const normalizedUserEmail = userEmail.toLowerCase().trim();
          
          if (normalizedUpdateEmail !== normalizedUserEmail) {
            toast.error(ERROR_MESSAGES.EMAIL_MISMATCH, {
              autoClose: 3000,
            });
            throw new Error(ERROR_MESSAGES.EMAIL_MISMATCH);
          }
        }

        // Si utilisateur normal tente de changer le statut (sauf annulation)
        if (!isAdmin && data.status && data.status !== RENDEZVOUS_STATUS.CANCELLED) {
          toast.error(ERROR_MESSAGES.ADMIN_REQUIRED_STATUS, {
            autoClose: 3000,
          });
          throw new Error(ERROR_MESSAGES.ADMIN_REQUIRED_STATUS);
        }

        // Pour "Terminé", vérifier avisAdmin obligatoire
        if (data.status === RENDEZVOUS_STATUS.COMPLETED && !data.avisAdmin) {
          toast.error(ERROR_MESSAGES.TERMINATE_REQUIRES_AVIS, {
            autoClose: 3000,
          });
          throw new Error(ERROR_MESSAGES.TERMINATE_REQUIRES_AVIS);
        }

        // Pour "Terminé", avisAdmin doit être Favorable ou Défavorable
        if (data.status === RENDEZVOUS_STATUS.COMPLETED && data.avisAdmin) {
          if (data.avisAdmin !== ADMIN_OPINION.FAVORABLE && data.avisAdmin !== ADMIN_OPINION.UNFAVORABLE) {
            toast.error(ERROR_MESSAGES.INVALID_AVIS, {
              autoClose: 3000,
            });
            throw new Error(ERROR_MESSAGES.INVALID_AVIS);
          }
        }

        const response = await this.rateLimitedFetch(`/api/rendezvous/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await this.handleResponse<Rendezvous>(
          response,
          'Mise à jour du rendez-vous'
        );

        toast.success(ERROR_MESSAGES.UPDATE_SUCCESS, {
          autoClose: 3000,
          position: "top-right",
        });
        
        return result;
      } catch (error) {
        throw error;
      }
    }, 'updateRendezvous');
  }

  // Méthode pour mettre à jour le statut d'un rendez-vous (admin uniquement)
  async updateRendezvousStatus(
    id: string, 
    status: RendezvousStatus, 
    avisAdmin?: AdminOpinion, 
    userEmail?: string
  ): Promise<Rendezvous> {
    return this.queueRequest(async () => {
      if (!id || id.trim() === '' || id === 'undefined') {
        toast.error('ID rendez-vous invalide', {
          autoClose: 3000,
        });
        throw new Error('Invalid ID');
      }

      if (status === RENDEZVOUS_STATUS.COMPLETED && !avisAdmin) {
        toast.error(ERROR_MESSAGES.TERMINATE_REQUIRES_AVIS, {
          autoClose: 3000,
        });
        throw new Error(ERROR_MESSAGES.TERMINATE_REQUIRES_AVIS);
      }

      try {
        const body: any = { status };
        if (avisAdmin !== undefined) {
          body.avisAdmin = avisAdmin;
        }

        const response = await this.rateLimitedFetch(`/api/rendezvous/${id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const result = await this.handleResponse<Rendezvous>(
          response,
          'Mise à jour du statut'
        );

        toast.success(ERROR_MESSAGES.STATUS_UPDATE_SUCCESS, {
          autoClose: 3000,
          position: "top-right",
        });
        
        return result;
      } catch (error) {
        throw error;
      }
    }, 'updateRendezvousStatus');
  }

  // Méthode pour annuler un rendez-vous (admin ou utilisateur)
  async cancelRendezvous(
    id: string, 
    userEmail: string, 
    isAdmin: boolean = false, 
    cancellationReason?: string
  ): Promise<Rendezvous> {
    return this.queueRequest(async () => {
      if (!id || id.trim() === '' || id === 'undefined') {
        toast.error('ID rendez-vous invalide', {
          autoClose: 3000,
        });
        throw new Error('Invalid ID');
      }

      try {
        const response = await this.rateLimitedFetch(`/api/rendezvous/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: cancellationReason ? JSON.stringify({ cancellationReason }) : undefined,
        });

        const result = await this.handleResponse<Rendezvous>(
          response,
          'Annulation du rendez-vous'
        );

        toast.success(ERROR_MESSAGES.DELETE_SUCCESS, {
          autoClose: 3000,
          position: "top-right",
        });
        
        return result;
      } catch (error) {
        throw error;
      }
    }, 'cancelRendezvous');
  }

  // Méthode pour confirmer un rendez-vous (admin uniquement)
  async confirmRendezvous(id: string, userEmail?: string): Promise<Rendezvous> {
    return this.queueRequest(async () => {
      if (!id || id.trim() === '' || id === 'undefined') {
        toast.error('ID rendez-vous invalide', {
          autoClose: 3000,
        });
        throw new Error('Invalid ID');
      }

      try {
        const response = await this.rateLimitedFetch(`/api/rendezvous/${id}/confirm`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await this.handleResponse<Rendezvous>(
          response,
          'Confirmation du rendez-vous'
        );

        toast.success(ERROR_MESSAGES.CONFIRM_SUCCESS, {
          autoClose: 3000,
          position: "top-right",
        });
        
        return result;
      } catch (error) {
        throw error;
      }
    }, 'confirmRendezvous');
  }

  // Méthode pour récupérer les créneaux disponibles
  async fetchAvailableSlots(date: string): Promise<string[]> {
    return this.queueRequest(async () => {
      if (!date || date.trim() === '') {
        toast.error('Date requise', {
          autoClose: 3000,
        });
        throw new Error('Missing date');
      }

      // Validation du format de date
      const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
      if (!dateRegex.test(date)) {
        toast.error('Format de date invalide (YYYY-MM-DD requis)', {
          autoClose: 3000,
        });
        throw new Error('Invalid date format');
      }

      try {
        const response = await this.rateLimitedFetch(
          `/api/rendezvous/available-slots?date=${encodeURIComponent(date)}`
        );

        const data = await this.handleResponse<string[]>(
          response,
          'Chargement des créneaux disponibles'
        );
        
        return data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Date invalide')) {
          throw error;
        }
        throw error;
      }
    }, 'fetchAvailableSlots');
  }

  // Méthode pour récupérer les dates disponibles
  async fetchAvailableDates(): Promise<string[]> {
    return this.queueRequest(async () => {
      try {
        const response = await this.rateLimitedFetch('/api/rendezvous/available-dates');
        
        const data = await this.handleResponse<string[]>(
          response,
          'Chargement des dates disponibles'
        );
        
        return data;
      } catch (error) {
        throw error;
      }
    }, 'fetchAvailableDates');
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  resetRateLimiting(): void {
    this.lastRequestTime = 0;
    this.requestQueue = Promise.resolve();
    this.isProcessingQueue = false;
    this.activeRequests.clear();
  }

  isBusy(): boolean {
    const isRateLimited = Date.now() - this.lastRequestTime < this.MIN_REQUEST_INTERVAL;
    return this.isProcessingQueue || isRateLimited || this.activeRequests.size > 0;
  }

  getEstimatedWaitTime(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest >= this.MIN_REQUEST_INTERVAL) {
      return 0;
    }
    
    const rateLimitWait = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    const queueWait = this.activeRequests.size * this.MIN_REQUEST_INTERVAL;
    
    return rateLimitWait + queueWait;
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  cancelAllRequests(): void {
    this.activeRequests.clear();
    this.requestQueue = Promise.resolve();
    this.isProcessingQueue = false;
  }

  setMinRequestInterval(intervalMs: number): void {
    if (intervalMs < 500) {
      this.MIN_REQUEST_INTERVAL = 500;
    } else {
      this.MIN_REQUEST_INTERVAL = intervalMs;
    }
  }

  setRequestTimeout(timeoutMs: number): void {
    if (timeoutMs < 1000) {
      this.requestTimeout = 1000;
    } else {
      this.requestTimeout = timeoutMs;
    }
  }

  // Méthode pour valider les données avant envoi (alignée avec le backend)
  validateRendezvousData(data: Partial<CreateRendezvousData | UpdateRendezvousData>): string[] {
    const errors: string[] = [];
    
    if (data.firstName && data.firstName.trim().length < 2) {
      errors.push('Le prénom doit contenir au moins 2 caractères');
    }
    
    if (data.lastName && data.lastName.trim().length < 2) {
      errors.push('Le nom doit contenir au moins 2 caractères');
    }
    
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.push('Format d\'email invalide');
    }
    
    if (data.telephone && !/^\+?[1-9]\d{1,14}$/.test(data.telephone)) {
      errors.push('Format de téléphone invalide');
    }
    
    if (data.destination && data.destination.trim() === 'Autre' && !data.destinationAutre) {
      errors.push('La destination "Autre" nécessite une précision');
    }
    
    if (data.filiere && data.filiere.trim() === 'Autre' && !data.filiereAutre) {
      errors.push('La filière "Autre" nécessite une précision');
    }
    
    if (data.niveauEtude && !EDUCATION_LEVELS.includes(data.niveauEtude as any)) {
      errors.push('Niveau d\'étude invalide');
    }
    
    if (data.date) {
      const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
      if (!dateRegex.test(data.date)) {
        errors.push('Format de date invalide (YYYY-MM-DD requis)');
      }
    }
    
    if (data.time) {
      const timeRegex = /^(09|1[0-6]):(00|30)$/;
      if (!timeRegex.test(data.time)) {
        errors.push('Créneau horaire invalide (09:00-16:30, par pas de 30min)');
      }
    }
    
    // Vérifier si c'est un UpdateRendezvousData (qui contient status et avisAdmin)
    const isUpdateData = 'status' in data || 'avisAdmin' in data;
    
    if (isUpdateData) {
      // Ces vérifications ne s'appliquent que pour UpdateRendezvousData
      if (data.status && !Object.values(RENDEZVOUS_STATUS).includes(data.status as RendezvousStatus)) {
        errors.push('Statut invalide');
      }
      
      if (data.avisAdmin && !Object.values(ADMIN_OPINION).includes(data.avisAdmin as AdminOpinion)) {
        errors.push('Avis admin invalide');
      }
    }
    
    return errors;
  }

  // Méthode pour formater la date pour l'affichage
  formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Méthode pour formater l'heure
  formatDisplayTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return `${hours}h${minutes === 0 ? '00' : minutes}`;
  }

  // Méthode pour obtenir le statut avec style
  getStatusStyle(status: RendezvousStatus): { bg: string; text: string; icon: string } {
    switch (status) {
      case 'En attente':
        return { bg: 'bg-amber-100', text: 'text-amber-800', icon: '⏱️' };
      case 'Confirmé':
        return { bg: 'bg-sky-100', text: 'text-sky-800', icon: '✅' };
      case 'Terminé':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: '✓' };
      case 'Annulé':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: '✗' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓' };
    }
  }

  // Méthode pour vérifier si un rendez-vous peut être annulé par l'utilisateur
  canUserCancelRendezvous(rendezvous: Rendezvous): boolean {
    if (rendezvous.status !== RENDEZVOUS_STATUS.CONFIRMED) {
      return false;
    }
    
    if (rendezvous.canBeCancelledByUser !== undefined) {
      return rendezvous.canBeCancelledByUser;
    }
    
    // Calcul manuel si la propriété n'est pas disponible
    const rdvDateTime = new Date(`${rendezvous.date}T${rendezvous.time}:00`);
    const now = new Date();
    const diffMs = rdvDateTime.getTime() - now.getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    
    return diffMs > twoHoursMs;
  }

  // Méthode pour générer tous les créneaux horaires
  getAllTimeSlots(): string[] {
    return [...TIME_SLOTS];
  }

  // Méthode pour obtenir les niveaux d'étude disponibles
  getEducationLevels(): string[] {
    return [...EDUCATION_LEVELS];
  }

  // Méthode pour obtenir les statuts disponibles
  getAllStatuses(): RendezvousStatus[] {
    return Object.values(RENDEZVOUS_STATUS);
  }

  // Méthode pour obtenir les avis admin disponibles
  getAdminOpinions(): AdminOpinion[] {
    return Object.values(ADMIN_OPINION);
  }

  // Méthode pour vérifier si une date est un weekend
  isWeekend(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date.getDay() === 0 || date.getDay() === 6;
  }

  // Méthode pour vérifier si un créneau est passé
  isPastTimeSlot(dateStr: string, timeStr: string): boolean {
    const now = new Date();
    const slotDateTime = new Date(`${dateStr}T${timeStr}:00`);
    return slotDateTime < now;
  }

  // Méthode pour masquer l'email (sécurité)
  maskEmail(email: string): string {
    if (!email) return '***';
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    
    if (localPart.length <= 2) {
      return `${localPart.charAt(0)}***@${domain}`;
    }
    return `${localPart.charAt(0)}***${localPart.charAt(localPart.length - 1)}@${domain}`;
  }
}

// Hook personnalisé pour utiliser le service
export function useAdminRendezVousService(fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>) {
  return useMemo(() => new AdminRendezVousService(fetchWithAuth), [fetchWithAuth]);
}

// Fonction pour créer une instance du service (utile pour les composants non-hooks)
export function createAdminRendezVousService(fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>): AdminRendezVousService {
  return new AdminRendezVousService(fetchWithAuth);
}

// Fonction utilitaire pour créer un fetchWithAuth avec token
export function createAuthFetch(token: string): (endpoint: string, options?: RequestInit) => Promise<Response> {
  return async (endpoint: string, options?: RequestInit) => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });
    return response;
  };
}