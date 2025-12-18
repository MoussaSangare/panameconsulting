// UserRendezvousService.ts - VERSION COMPLÈTE AVEC RATE LIMITING
import { toast } from 'react-toastify';

export interface Rendezvous {
  _id: string;
  userId: string;
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
  status: string;
  avisAdmin?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt?: string;
  effectiveDestination?: string;
  effectiveFiliere?: string;
  isPast?: boolean;
  canBeCancelledByUser?: boolean;
}

export interface ApiResponse {
  data: Rendezvous[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FetchRendezvousParams {
  page: number;
  limit: number;
  status?: string;
}

export interface AuthFunctions {
  getAccessToken: () => string | null;
  refreshToken: () => Promise<boolean>;
  logout: () => void;
  fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export class UserRendezvousService {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 secondes entre les requêtes

  constructor(
    private auth: AuthFunctions
  ) {}

  /**
   * Ajoute une requête à la file d'attente
   */
  private async addToQueue<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Respecter l'intervalle minimum entre les requêtes
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          
          if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            await this.wait(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
          }
          
          const result = await requestFn();
          this.lastRequestTime = Date.now();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * Traite la file d'attente
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.requestQueue.length > 0) {
        const requestFn = this.requestQueue.shift();
        if (requestFn) {
          await requestFn();
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Attendre un certain temps
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Récupère les rendez-vous de l'utilisateur
   */
  async fetchUserRendezvous(params: FetchRendezvousParams): Promise<ApiResponse> {
    return this.addToQueue(async () => {
      try {
        const urlParams = new URLSearchParams({
          page: params.page.toString(),
          limit: params.limit.toString(),
        });

        if (params.status) {
          urlParams.append('status', params.status);
        }

        const endpoint = `/api/rendezvous/user?${urlParams.toString()}`;
        
        if (import.meta.env.DEV) {
          console.log('📤 Envoi requête rendez-vous...');
        }

        const response = await this.auth.fetchWithAuth(endpoint);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 429) {
            // Rate limiting détecté
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
            
            throw new Error(`RATE_LIMIT:${waitTime}`);
          }
          
          throw new Error(errorData.message || `Erreur ${response.status}`);
        }

        return await response.json();
      } catch (error: any) {
        if (error.message.startsWith('RATE_LIMIT:')) {
          const waitTime = parseInt(error.message.split(':')[1]);
          
          if (import.meta.env.DEV) {
            console.log(`⏳ Rate limit détecté, attente de ${waitTime}ms`);
          }
          
          // Attendre le temps indiqué
          await this.wait(waitTime);
          
          // Réessayer une fois après l'attente
          return this.fetchUserRendezvous(params);
        }
        
        if (import.meta.env.DEV) {
          console.error('❌ Erreur fetchUserRendezvous:', error.message);
        }

        if (error.message !== 'SESSION_EXPIRED' && 
            error.message !== 'SESSION_CHECK_IN_PROGRESS') {
          toast.error('Impossible de charger vos rendez-vous');
        }
        
        throw error;
      }
    });
  }

  /**
   * Annule un rendez-vous
   */
  async cancelRendezvous(rdvId: string): Promise<Rendezvous> {
    return this.addToQueue(async () => {
      try {
        const response = await this.auth.fetchWithAuth(
          `/api/rendezvous/${rdvId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const errorData = await response.json();
          
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
            throw new Error(`RATE_LIMIT:${waitTime}`);
          }
          
          throw new Error(errorData.message || 'Erreur lors de l\'annulation');
        }

        const result = await response.json();
        toast.success('Rendez-vous annulé avec succès');
        return result;
      } catch (error: any) {
        if (error.message.startsWith('RATE_LIMIT:')) {
          const waitTime = parseInt(error.message.split(':')[1]);
          await this.wait(waitTime);
          return this.cancelRendezvous(rdvId);
        }
        
        if (import.meta.env.DEV) {
          console.error('❌ Erreur cancelRendezvous:', error.message);
        }

        if (error.message !== 'SESSION_EXPIRED' && 
            error.message !== 'SESSION_CHECK_IN_PROGRESS') {
          if (error.message.includes('à moins de 2 heures')) {
            toast.error('Impossible d\'annuler à moins de 2 heures du rendez-vous');
          } else if (error.message.includes('non confirmé')) {
            toast.error('Vous ne pouvez annuler que les rendez-vous confirmés');
          } else {
            toast.error(error.message || 'Erreur lors de l\'annulation');
          }
        }
        
        throw error;
      }
    });
  }

  /**
   * Formate une date en français
   */
  static formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Formate une heure
   */
  static formatTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':');
    return `${hours}h${minutes}`;
  }

  /**
   * Vérifie si un rendez-vous peut être annulé
   */
  static canCancelRendezvous(rdv: Rendezvous): boolean {
    if (rdv.status !== 'Confirmé') return false;
    return rdv.canBeCancelledByUser !== false;
  }

  /**
   * Récupère la destination effective
   */
  static getEffectiveDestination(rdv: Rendezvous): string {
    return rdv.effectiveDestination || rdv.destination;
  }

  /**
   * Récupère la filière effective
   */
  static getEffectiveFiliere(rdv: Rendezvous): string {
    return rdv.effectiveFiliere || rdv.filiere;
  }
}