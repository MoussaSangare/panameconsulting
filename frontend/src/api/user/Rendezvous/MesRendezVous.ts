import { useAuth } from '../../../context/AuthContext';
import { useCallback, useRef } from 'react';
import {
  Rendezvous,
  UpdateRendezvousDto,
  UserRendezvousParams,
  RendezvousStatus,
  AvailableSlotsResponse,
  AvailableDatesResponse,
  TimeSlot,
  getStatusConfig,
  formatRendezvousDate,
  formatRendezvousTime,
  isRendezvousUpcoming,
  canCancelRendezvous,
  getTimeRemainingMessage,
  createFormattedRendezvous,
} from '../types/rendezvous.types';

// Vérification si on est dans un environnement navigateur
const isBrowser = typeof window !== 'undefined';

// Constantes EXACTEMENT comme dans le backend
const RENDEZVOUS_STATUS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
} as const;

const ADMIN_OPINION = {
  FAVORABLE: 'Favorable',
  UNFAVORABLE: 'Défavorable',
} as const;

const EDUCATION_LEVELS = [
  'Bac',
  'Bac+1',
  'Bac+2',
  'Licence',
  'Master I',
  'Master II',
  'Doctorat',
] as const;

// Expressions régulières
const TIME_SLOT_REGEX = /^(09|1[0-6]):(00|30)$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

export class RendezvousApiService {
  private static API_URL = import.meta.env.VITE_API_URL as string;
  private static abortControllers: Map<string, AbortController> = new Map();
  static logger: any;

  // ==================== GESTION D'AUTHENTIFICATION ====================

  private static getAuthToken(): string | null {
    try {
      if (isBrowser && window.localStorage) {
        return window.localStorage.getItem('access_token');
      }
      return null;
    } catch {
      return null;
    }
  }

  private static createAuthHeaders(
    additionalHeaders?: Record<string, string>
  ): Record<string, string> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    refreshTokenCallback?: () => Promise<boolean>,
    requestId?: string
  ): Promise<T> {
    const url = `${this.API_URL}${endpoint}`;

    const token = this.getAuthToken();

    const publicEndpoints = [
      '/api/rendezvous/available-slots',
      '/api/rendezvous/available-dates',
    ];

    if (!token && !publicEndpoints.includes(endpoint)) {
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (requestId) {
      this.abortPreviousRequest(requestId);
    }

    const abortController = new AbortController();
    if (requestId) {
      this.abortControllers.set(requestId, abortController);
    }

    const baseHeaders = this.createAuthHeaders(
      options.headers as Record<string, string>
    );

    const requestOptions: RequestInit = {
      ...options,
      headers: baseHeaders,
      credentials: 'include',
      signal: abortController.signal,
    };

    try {
      const response = await fetch(url, requestOptions);

      if (requestId) {
        this.abortControllers.delete(requestId);
      }

      if (response.status === 401 && refreshTokenCallback) {
        const refreshed = await refreshTokenCallback();

        if (refreshed) {
          if (requestId) {
            this.abortPreviousRequest(requestId);
          }

          const newAbortController = new AbortController();
          if (requestId) {
            this.abortControllers.set(requestId, newAbortController);
          }

          const newHeaders = this.createAuthHeaders(
            options.headers as Record<string, string>
          );

          const retryResponse = await fetch(url, {
            ...options,
            headers: newHeaders,
            credentials: 'include',
            signal: newAbortController.signal,
          });

          if (requestId) {
            this.abortControllers.delete(requestId);
          }

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json();
            throw this.createApiError(errorData, retryResponse.status);
          }

          return retryResponse.json();
        }

        const errorData = await response.json();
        throw this.createApiError(errorData, response.status);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw this.createApiError(errorData, response.status);
      }

      if (response.status === 204) {
        return null as T;
      }

      return response.json();
    } catch (error: any) {
      if (requestId) {
        this.abortControllers.delete(requestId);
      }

      if (error.name === 'AbortError') {
        throw error;
      }

      throw error;
    }
  }

  private static abortPreviousRequest(requestId: string): void {
    const existingController = this.abortControllers.get(requestId);
    if (existingController && !existingController.signal.aborted) {
      existingController.abort();
      this.abortControllers.delete(requestId);
    }
  }

  private static createApiError(data: any, status: number): ApiError {
    const error = new Error(data?.message || 'Erreur API') as ApiError;
    error.status = status;
    error.code = data?.code || `HTTP_${status}`;
    error.details = data?.details || data;
    return error;
  }

  // ==================== ENDPOINTS RENDEZ-VOUS ====================

  static async getUserRendezvous(
    params: UserRendezvousParams,
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<{
    data: Rendezvous[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { email, page = 1, limit = 10, status } = params;

    // VALIDATIONS STRICTES (comme backend)
    if (!email || email.trim() === '') {
      throw new Error("L'email est requis");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Format d'email invalide");
    }

    if (page < 1) {
      throw new Error('Le numéro de page doit être supérieur à 0');
    }

    if (limit < 1 || limit > 100) {
      throw new Error('La limite doit être entre 1 et 100');
    }

    if (status && !Object.values(RENDEZVOUS_STATUS).includes(status as any)) {
      throw new Error(
        `Statut invalide. Valeurs autorisées: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`
      );
    }

    const token = this.getAuthToken();
    if (!token) {
      const error = new Error('Session expirée') as ApiError;
      error.status = 401;
      error.code = 'SESSION_EXPIRED';
      throw error;
    }

    // Construction des paramètres de requête (identique au backend)
    const queryParams = new URLSearchParams({
      email: encodeURIComponent(email.trim().toLowerCase()),
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) {
      queryParams.append('status', encodeURIComponent(status));
    }

    const requestId = `get-user-rendezvous-${email}-${page}-${Date.now()}`;

    // Appel API avec le type exact retourné par le backend
    const response = await this.makeRequest<{
      data: Rendezvous[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(
      `/api/rendezvous/user?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: this.createAuthHeaders(),
      },
      refreshTokenCallback,
      requestId
    );

    // VALIDATION DE LA RÉPONSE
    if (!response || typeof response !== 'object') {
      throw new Error('Réponse du serveur invalide');
    }

    // Assurer que tous les champs sont présents avec des valeurs par défaut
    const validatedData = Array.isArray(response.data) ? response.data : [];
    const validatedTotal =
      typeof response.total === 'number'
        ? response.total
        : validatedData.length;
    const validatedPage =
      typeof response.page === 'number' ? response.page : page;
    const validatedLimit =
      typeof response.limit === 'number' ? response.limit : limit;

    // Calculer totalPages si non fourni (compatibilité)
    const validatedTotalPages =
      typeof response.totalPages === 'number'
        ? response.totalPages
        : Math.ceil(validatedTotal / validatedLimit);

    return {
      data: validatedData,
      total: validatedTotal,
      page: validatedPage,
      limit: validatedLimit,
      totalPages: validatedTotalPages,
    };
  }

  static async getRendezvousById(
    id: string,
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<Rendezvous> {
    if (!id || id.trim() === '') {
      throw new Error('ID du rendez-vous requis');
    }

    if (id === 'stats') {
      throw new Error('ID de rendez-vous invalide');
    }

    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Session expirée');
    }

    const response = await this.makeRequest<Rendezvous>(
      `/api/rendezvous/${id}`,
      { method: 'GET' },
      refreshTokenCallback,
      `get-by-id-${id}`
    );

    return response;
  }

  static async updateRendezvous(
    id: string,
    data: UpdateRendezvousDto,
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<Rendezvous> {
    if (!id || id.trim() === '') {
      throw new Error('ID du rendez-vous requis');
    }

    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Session expirée');
    }

    if (data.date) {
      if (!DATE_REGEX.test(data.date)) {
        throw new Error('Format de date invalide');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(data.date);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        throw new Error('Impossible de modifier vers une date passée');
      }
    }

    if (data.time) {
      if (!TIME_SLOT_REGEX.test(data.time)) {
        throw new Error('Créneau horaire invalide');
      }
    }

    const processedData = this.processOtherFieldsForUpdate(data);

    if (processedData.email) {
      processedData.email = processedData.email.toLowerCase().trim();
    }

    const response = await this.makeRequest<Rendezvous>(
      `/api/rendezvous/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(processedData),
      },
      refreshTokenCallback,
      `update-${id}`
    );

    return response;
  }

  static async cancelRendezvous(
    id: string,
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<Rendezvous> {
    if (!id || id.trim() === '') {
      throw new Error('ID du rendez-vous requis');
    }

    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Session expirée');
    }

    const response = await this.makeRequest<Rendezvous>(
      `/api/rendezvous/${id}`,
      { method: 'DELETE' },
      refreshTokenCallback,
      `cancel-${id}`
    );

    return response;
  }

  static async confirmRendezvous(
    id: string,
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<Rendezvous> {
    if (!id || id.trim() === '') {
      const error = new Error('ID du rendez-vous requis') as ApiError;
      error.status = 400;
      error.code = 'MISSING_ID';
      throw error;
    }

    const token = this.getAuthToken();
    if (!token) {
      const error = new Error('Session expirée') as ApiError;
      error.status = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const response = await this.makeRequest<Rendezvous>(
      `/api/rendezvous/${encodeURIComponent(id)}/confirm`,
      {
        method: 'PUT',
        headers: this.createAuthHeaders(),
        body: JSON.stringify({}),
      },
      refreshTokenCallback,
      `confirm-${id}`
    );

    return response;
  }

  static async getAvailableSlots(
    date: string,
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<AvailableSlotsResponse> {
    if (!date || date.trim() === '') {
      throw new Error('La date est requise');
    }

    if (!DATE_REGEX.test(date)) {
      throw new Error('Format de date invalide');
    }

    const response = await this.makeRequest<string[]>(
      `/api/rendezvous/available-slots?date=${encodeURIComponent(date)}`,
      { method: 'GET' },
      refreshTokenCallback,
      `slots-${date}`
    );

    const slots = response.filter((slot): slot is TimeSlot =>
      [
        '09:00',
        '09:30',
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
        '12:30',
        '13:00',
        '13:30',
        '14:00',
        '14:30',
        '15:00',
        '15:30',
        '16:00',
        '16:30',
      ].includes(slot as TimeSlot)
    );

    return { slots, date };
  }

  static async getAvailableDates(
    refreshTokenCallback?: () => Promise<boolean>
  ): Promise<AvailableDatesResponse> {
    const response = await this.makeRequest<string[]>(
      '/api/rendezvous/available-dates',
      { method: 'GET' },
      refreshTokenCallback,
      'dates'
    );

    const now = new Date();
    const fromDate = now.toISOString().split('T')[0];
    const toDate = new Date(now);
    toDate.setDate(now.getDate() + 60);
    const toDateStr = toDate.toISOString().split('T')[0];

    return {
      dates: response,
      fromDate,
      toDate: toDateStr,
    };
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  static processOtherFieldsForUpdate(
    data: UpdateRendezvousDto
  ): UpdateRendezvousDto {
    const processed = { ...data };

    if (processed.destination === 'Autre' && processed.destinationAutre) {
      processed.destination = 'Autre';
      processed.destinationAutre = processed.destinationAutre.trim();
    } else if (processed.destination !== 'Autre') {
      delete processed.destinationAutre;
    }

    if (processed.filiere === 'Autre' && processed.filiereAutre) {
      processed.filiere = 'Autre';
      processed.filiereAutre = processed.filiereAutre.trim();
    } else if (processed.filiere !== 'Autre') {
      delete processed.filiereAutre;
    }

    if (processed.email) {
      processed.email = processed.email.toLowerCase().trim();
    }

    return processed;
  }

  static canCancelRendezvous(rdv: Rendezvous): boolean {
    return canCancelRendezvous(rdv);
  }

  static getTimeRemainingMessage(rdv: Rendezvous): string | null {
    return getTimeRemainingMessage(rdv);
  }

  static formatDate(dateStr: string): string {
    return formatRendezvousDate(dateStr);
  }

  static formatTime(timeStr: string): string {
    return formatRendezvousTime(timeStr);
  }

  static isUpcoming(rdv: Rendezvous): boolean {
    return isRendezvousUpcoming(rdv);
  }

  static getStatusConfig(status: RendezvousStatus) {
    return getStatusConfig(status);
  }

  static createFormattedRendezvous(rdv: Rendezvous) {
    return createFormattedRendezvous(rdv);
  }

  static isValidStatus(status: string): boolean {
    return Object.values(RENDEZVOUS_STATUS).includes(status as any);
  }

  static isValidAdminOpinion(opinion: string): boolean {
    return Object.values(ADMIN_OPINION).includes(opinion as any);
  }

  static isValidEducationLevel(level: string): boolean {
    return EDUCATION_LEVELS.includes(level as any);
  }

  static getAvailableActions(rdv: Rendezvous, userRole: string): string[] {
    const actions: string[] = [];
    const isAdmin = userRole === 'admin';

    if (!rdv) return actions;

    switch (rdv.status) {
      case RENDEZVOUS_STATUS.PENDING:
        if (!isAdmin) {
          actions.push('confirm');
        }
        if (this.canCancelRendezvous(rdv)) {
          actions.push('cancel');
        }
        break;

      case RENDEZVOUS_STATUS.CONFIRMED:
        if (this.canCancelRendezvous(rdv)) {
          actions.push('cancel');
        }
        break;

      case RENDEZVOUS_STATUS.COMPLETED:
        // Aucune action pour l'utilisateur
        break;

      case RENDEZVOUS_STATUS.CANCELLED:
        // Aucune action pour l'utilisateur
        break;
    }

    if (isAdmin) {
      // Admin peut toujours changer le statut sauf pour annulé
      if (rdv.status !== RENDEZVOUS_STATUS.CANCELLED) {
        actions.push('update_status');
      }
    }

    return actions;
  }
}

// ==================== HOOK REACT ====================

export function useRendezvousApi() {
  const { refreshToken } = useAuth();

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastRequestRef = useRef<Map<string, number>>(new Map());

  const createRequestId = (type: string, ...params: any[]): string => {
    return `${type}-${params.join('-')}`;
  };

  const abortPreviousRequest = (requestId: string): void => {
    const existingController = abortControllersRef.current.get(requestId);
    if (existingController && !existingController.signal.aborted) {
      existingController.abort();
      abortControllersRef.current.delete(requestId);
    }
  };

  const debouncedRequest = <T>(
    requestFn: () => Promise<T>,
    requestId: string,
    minDelay: number = 300
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const lastRequestTime = lastRequestRef.current.get(requestId) || 0;
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;

      if (timeSinceLastRequest < minDelay) {
        abortPreviousRequest(requestId);
      }

      lastRequestRef.current.set(requestId, now);

      const abortController = new AbortController();
      abortControllersRef.current.set(requestId, abortController);

      requestFn()
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            reject(error);
          }
        })
        .finally(() => {
          abortControllersRef.current.delete(requestId);
        });
    });
  };

  const getUserRendezvous = useCallback(
    async (
      params: UserRendezvousParams
    ): Promise<{
      data: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }> => {
      const { email, page = 1 } = params;

      try {
        if (!email) {
          throw new Error("L'email est requis");
        }

        const response = await RendezvousApiService.getUserRendezvous(
          params,
          refreshToken
        );

        // S'assurer que tous les champs sont présents
        return {
          data: response.data || [],
          total: response.total || 0,
          page: response.page || page,
          limit: response.limit || params.limit || 10,
          totalPages:
            response.totalPages ||
            Math.ceil(
              (response.total || 0) / (response.limit || params.limit || 10)
            ),
        };
      } catch (error: any) {
        if (error.message.includes('Session')) {
          throw new Error('Votre session a expiré');
        }

        if (
          error.message.includes('Format') ||
          error.message.includes('email')
        ) {
          throw new Error('Adresse email invalide');
        }

        if (error.message.includes('Paramètres')) {
          throw new Error('Paramètres de recherche invalides');
        }

        throw new Error('Impossible de charger vos rendez-vous');
      }
    },
    [refreshToken]
  );

  const getRendezvousById = useCallback(
    async (id: string): Promise<Rendezvous> => {
      const requestId = createRequestId('getById', id);
      return debouncedRequest(
        () => RendezvousApiService.getRendezvousById(id, refreshToken),
        requestId
      );
    },
    [refreshToken]
  );

  const updateRendezvous = useCallback(
    async (id: string, data: UpdateRendezvousDto): Promise<Rendezvous> => {
      const requestId = createRequestId('update', id);
      return debouncedRequest(
        () => RendezvousApiService.updateRendezvous(id, data, refreshToken),
        requestId,
        500
      );
    },
    [refreshToken]
  );

  const cancelRendezvous = useCallback(
    async (id: string): Promise<Rendezvous> => {
      const requestId = createRequestId('cancel', id);
      return debouncedRequest(
        () => RendezvousApiService.cancelRendezvous(id, refreshToken),
        requestId,
        500
      );
    },
    [refreshToken]
  );

  const confirmRendezvous = useCallback(
    async (id: string): Promise<Rendezvous> => {
      const requestId = createRequestId('confirm', id);
      return debouncedRequest(
        () => RendezvousApiService.confirmRendezvous(id, refreshToken),
        requestId,
        500
      );
    },
    [refreshToken]
  );

  const abortAllRequests = useCallback((): void => {
    abortControllersRef.current.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    abortControllersRef.current.clear();
    lastRequestRef.current.clear();
  }, []);

  return {
    // Méthodes de récupération
    getUserRendezvous,
    getRendezvousById,

    // Méthodes de modification utilisateur
    updateRendezvous,
    cancelRendezvous,
    confirmRendezvous,

    // Méthodes utilitaires
    abortAllRequests,

    // Déléguées à la classe statique
    canCancelRendezvous:
      RendezvousApiService.canCancelRendezvous.bind(RendezvousApiService),
    getTimeRemainingMessage:
      RendezvousApiService.getTimeRemainingMessage.bind(RendezvousApiService),
    formatDate: RendezvousApiService.formatDate.bind(RendezvousApiService),
    formatTime: RendezvousApiService.formatTime.bind(RendezvousApiService),
    isUpcoming: RendezvousApiService.isUpcoming.bind(RendezvousApiService),
    getStatusConfig:
      RendezvousApiService.getStatusConfig.bind(RendezvousApiService),
    createFormattedRendezvous:
      RendezvousApiService.createFormattedRendezvous.bind(RendezvousApiService),
    isValidStatus:
      RendezvousApiService.isValidStatus.bind(RendezvousApiService),
    isValidAdminOpinion:
      RendezvousApiService.isValidAdminOpinion.bind(RendezvousApiService),
    isValidEducationLevel:
      RendezvousApiService.isValidEducationLevel.bind(RendezvousApiService),
    getAvailableActions:
      RendezvousApiService.getAvailableActions.bind(RendezvousApiService),

    processOtherFieldsForUpdate:
      RendezvousApiService.processOtherFieldsForUpdate,

    // Constantes exportées
    RENDEZVOUS_STATUS,
    ADMIN_OPINION,
    EDUCATION_LEVELS,
  };
}

export type RendezvousApiHook = ReturnType<typeof useRendezvousApi>;
