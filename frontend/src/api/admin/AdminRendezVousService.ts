// AdminRendezVousService.ts
import { useAuth } from '../../context/AuthContext';

export interface Rendezvous {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  date: string;
  time: string;
  status: 'En attente' | 'Confirmé' | 'Terminé' | 'Annulé';
  destination: string;
  destinationAutre?: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre?: string;
  avisAdmin?: 'Favorable' | 'Défavorable';
  cancelledAt?: string;
  cancelledBy?: 'admin' | 'user';
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRendezVousData {
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

export interface RendezvousListResponse {
  data: Rendezvous[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ✅ Constantes pour la cohérence avec le backend
export const RENDEZVOUS_STATUS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
} as const;

export const ADMIN_OPINION = {
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

const TIME_SLOTS = [
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
] as const;

// ✅ Utilitaire pour créer une requête authentifiée
const createAuthenticatedFetch = (access_token: string | null) => {
  return async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    if (import.meta.env.DEV) {
      globalThis.console.log(`📡 Requête API: ${API_URL}${url}`);
    }

    if (!access_token) {
      if (import.meta.env.DEV) {
        globalThis.console.error('❌ Token non disponible');
      }
      throw new Error('Token non disponible. Veuillez vous reconnecter.');
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const fullUrl = `${API_URL}${url}`;

    try {
      const response = await globalThis.fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      });

      // ✅ Gérer les erreurs HTTP
      if (response.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      if (response.status === 403) {
        throw new Error('Accès non autorisé. Administrateur requis.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erreur ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(errorMessage);
      }

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // Variable 'parseError' est utilisée ici
        throw new Error(
          `Réponse invalide du serveur: ${responseText.substring(0, 100)}...`
        );
      }

      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        globalThis.console.error('❌ Erreur fetch:', error);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erreur de connexion au serveur');
    }
  };
};

// ✅ Service admin utilisant UNIQUEMENT les endpoints backend existants
export const createAdminRendezVousService = (access_token: string | null) => {
  const authenticatedFetch = createAuthenticatedFetch(access_token);

  return {
    // ==================== ENDPOINTS ADMIN EXCLUSIFS ====================

    /**
     * 1. LISTER TOUS LES RENDEZ-VOUS (Admin seulement)
     * GET /api/rendezvous?page=1&limit=10&status=Confirmé&date=2024-12-25&search=Dupont
     * ✅ ENDPOINT EXISTANT
     */
    fetchAllRendezvous: async (
      page: number = 1,
      limit: number = 10,
      filters?: {
        status?: string;
        date?: string;
        search?: string;
      }
    ): Promise<RendezvousListResponse> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('🔍 fetchAllRendezvous appelé avec:', {
          page,
          limit,
          filters,
        });
      }

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filters?.status && filters.status !== 'tous') {
        params.append('status', filters.status);
      }

      if (filters?.date) {
        const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
        if (!dateRegex.test(filters.date)) {
          throw new Error('Format de date invalide (YYYY-MM-DD requis)');
        }
        params.append('date', filters.date);
      }

      if (filters?.search) {
        params.append('search', filters.search.trim());
      }

      const url = `/api/rendezvous?${params.toString()}`;
      if (import.meta.env.DEV) {
        globalThis.console.log('🌐 URL de la requête:', url);
      }

      try {
        const result = await authenticatedFetch<RendezvousListResponse>(url);
        return result;
      } catch (error) {
        if (import.meta.env.DEV) {
          globalThis.console.error('❌ fetchAllRendezvous échoué:', error);
        }
        throw error;
      }
    },

    /**
     * 2. METTRE À JOUR LE STATUT (Admin seulement)
     * PUT /api/rendezvous/:id/status
     * ✅ ENDPOINT EXISTANT
     */
    updateRendezvousStatus: async (
      id: string,
      status: string,
      avisAdmin?: string
    ): Promise<Rendezvous> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('🔄 updateRendezvousStatus appelé:', {
          id,
          status,
          avisAdmin,
        });
      }

      if (!id || id.trim() === '') {
        throw new Error('ID de rendez-vous requis');
      }

      if (!status || status.trim() === '') {
        throw new Error('Le statut est requis');
      }

      if (!Object.values(RENDEZVOUS_STATUS).includes(status as any)) {
        throw new Error(
          `Statut invalide. Valeurs autorisées: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`
        );
      }

      // ✅ Correction: Construire l'URL avec l'ID dans le chemin
      const url = `/api/rendezvous/${id}/status`;

      const bodyData: any = { status };

      if (status === RENDEZVOUS_STATUS.COMPLETED) {
        if (!avisAdmin || avisAdmin.trim() === '') {
          throw new Error(
            "L'avis admin est obligatoire pour terminer un rendez-vous"
          );
        }
        if (!Object.values(ADMIN_OPINION).includes(avisAdmin as any)) {
          throw new Error(
            'Avis admin invalide. Valeurs autorisées: Favorable ou Défavorable'
          );
        }
        bodyData.avisAdmin = avisAdmin;
      }

      if (import.meta.env.DEV) {
        globalThis.console.log('🌐 URL de la requête:', url);
        globalThis.console.log('📤 Body de la requête:', bodyData);
      }

      const result = await authenticatedFetch<Rendezvous>(url, {
        method: 'PUT',
        body: JSON.stringify(bodyData),
      });

      return result;
    },

    /**
     * 3. ANNULER SANS RESTRICTION (Admin seulement)
     * DELETE /api/rendezvous/:id
     * ✅ ENDPOINT EXISTANT
     */
    cancelRendezvousAdmin: async (id: string): Promise<Rendezvous> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('🗑️ cancelRendezvousAdmin appelé:', id);
      }

      if (!id || id.trim() === '') {
        throw new Error('ID de rendez-vous requis');
      }

      const result = await authenticatedFetch<Rendezvous>(
        `/api/rendezvous/${id}`,
        {
          method: 'DELETE',
        }
      );

      return result;
    },

    // ==================== ENDPOINTS PARTAGÉS (EXISTANTS) ====================

    /**
     * CRÉER UN RENDEZ-VOUS (identique backend)
     * POST /api/rendezvous
     * ✅ ENDPOINT EXISTANT
     */
    createRendezvous: async (
      createData: CreateRendezVousData
    ): Promise<Rendezvous> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('➕ createRendezvous appelé:', createData);
      }

      // Validation stricte comme backend
      const errors: string[] = [];

      if (!createData.firstName?.trim())
        errors.push('Le prénom est obligatoire');
      if (!createData.lastName?.trim()) errors.push('Le nom est obligatoire');
      if (!createData.email?.trim()) errors.push("L'email est obligatoire");
      if (!createData.telephone?.trim())
        errors.push('Le téléphone est obligatoire');
      if (!createData.date?.trim()) errors.push('La date est obligatoire');
      if (!createData.time?.trim()) errors.push("L'heure est obligatoire");
      if (!createData.destination?.trim())
        errors.push('La destination est obligatoire');
      if (!createData.niveauEtude?.trim())
        errors.push("Le niveau d'étude est obligatoire");
      if (!createData.filiere?.trim())
        errors.push('La filière est obligatoire');

      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }

      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(createData.email)) {
        throw new Error('Format email invalide');
      }

      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(createData.telephone.replace(/\s/g, ''))) {
        throw new Error('Format téléphone invalide');
      }

      const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
      if (!dateRegex.test(createData.date)) {
        throw new Error('Format de date invalide (YYYY-MM-DD requis)');
      }

      const timeRegex = /^(09|1[0-6]):(00|30)$/;
      if (!timeRegex.test(createData.time)) {
        throw new Error(
          'Créneau horaire invalide (09:00-16:30, par pas de 30min)'
        );
      }

      // Préparation des données - STRICTEMENT comme le backend
      const processedData: any = {
        firstName: createData.firstName.trim(),
        lastName: createData.lastName.trim(),
        email: createData.email.toLowerCase().trim(),
        telephone: createData.telephone.trim(),
        date: createData.date,
        time: createData.time,
        niveauEtude: createData.niveauEtude,
      };

      // Gestion des champs "Autre" - STRICTEMENT comme le backend
      if (createData.destination === 'Autre') {
        if (
          !createData.destinationAutre ||
          createData.destinationAutre.trim() === ''
        ) {
          throw new Error('La destination "Autre" nécessite une précision');
        }
        processedData.destination = 'Autre';
        processedData.destinationAutre = createData.destinationAutre.trim();
      } else {
        processedData.destination = createData.destination;
      }

      if (createData.filiere === 'Autre') {
        if (!createData.filiereAutre || createData.filiereAutre.trim() === '') {
          throw new Error('La filière "Autre" nécessite une précision');
        }
        processedData.filiere = 'Autre';
        processedData.filiereAutre = createData.filiereAutre.trim();
      } else {
        processedData.filiere = createData.filiere;
      }

      if (import.meta.env.DEV) {
        globalThis.console.log(
          '📤 Données envoyées au backend:',
          processedData
        );
      }

      const result = await authenticatedFetch<Rendezvous>('/api/rendezvous', {
        method: 'POST',
        body: JSON.stringify(processedData),
      });

      return result;
    },

    /**
     * RÉCUPÉRER UN RENDEZ-VOUS SPÉCIFIQUE
     * GET /api/rendezvous/:id
     * ✅ ENDPOINT EXISTANT
     */
    fetchRendezvousById: async (id: string): Promise<Rendezvous> => {
      if (!id || id.trim() === '') {
        throw new Error('ID de rendez-vous requis');
      }

      const result = await authenticatedFetch<Rendezvous>(
        `/api/rendezvous/${id}`
      );

      return result;
    },

    /**
     * METTRE À JOUR UN RENDEZ-VOUS
     * PUT /api/rendezvous/:id
     * ✅ ENDPOINT EXISTANT
     */
    updateRendezvous: async (
      id: string,
      updateData: Partial<CreateRendezVousData>
    ): Promise<Rendezvous> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('🔄 updateRendezvous appelé:', {
          id,
          updateData,
        });
      }

      if (!id || id.trim() === '') {
        throw new Error('ID de rendez-vous requis');
      }

      const result = await authenticatedFetch<Rendezvous>(
        `/api/rendezvous/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
        }
      );

      return result;
    },

    /**
     * CONFIRMER UN RENDEZ-VOUS (Endpoint pour utilisateur)
     * PUT /api/rendezvous/:id/confirm
     * ✅ ENDPOINT EXISTANT
     */
    confirmRendezvous: async (id: string): Promise<Rendezvous> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('✅ confirmRendezvous appelé:', id);
      }

      if (!id || id.trim() === '') {
        throw new Error('ID de rendez-vous requis');
      }

      const result = await authenticatedFetch<Rendezvous>(
        `/api/rendezvous/${id}/confirm`,
        {
          method: 'PUT',
        }
      );

      return result;
    },

    /**
     * RENDEZ-VOUS PAR UTILISATEUR
     * GET /api/rendezvous/user?email=test@example.com&page=1&limit=10&status=En attente
     * ✅ ENDPOINT EXISTANT
     */
    fetchRendezvousByUser: async (
      email: string,
      page: number = 1,
      limit: number = 10,
      status?: string
    ): Promise<RendezvousListResponse> => {
      if (import.meta.env.DEV) {
        globalThis.console.log('👤 fetchRendezvousByUser appelé:', {
          email,
          page,
          limit,
          status,
        });
      }

      if (!email || email.trim() === '') {
        throw new Error('Email requis');
      }

      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Format email invalide');
      }

      const params = new URLSearchParams();
      params.append('email', encodeURIComponent(email));
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (status && status !== 'tous') {
        params.append('status', status);
      }

      const url = `/api/rendezvous/user?${params.toString()}`;
      if (import.meta.env.DEV) {
        globalThis.console.log('🌐 URL de la requête:', url);
      }

      return authenticatedFetch<RendezvousListResponse>(url);
    },

    // ==================== FONCTIONNALITÉS DISPONIBILITÉ ====================

    /**
     * CRÉNEAUX DISPONIBLES POUR UNE DATE
     * GET /api/rendezvous/available-slots?date=2024-12-25
     * ✅ ENDPOINT EXISTANT
     */
    fetchAvailableSlots: async (date: string): Promise<string[]> => {
      if (!date || date.trim() === '') {
        throw new Error('La date est requise');
      }

      const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
      if (!dateRegex.test(date)) {
        throw new Error('Format de date invalide (YYYY-MM-DD requis)');
      }

      return authenticatedFetch<string[]>(
        `/api/rendezvous/available-slots?date=${encodeURIComponent(date)}`
      );
    },

    /**
     * DATES DISPONIBLES
     * GET /api/rendezvous/available-dates
     * ✅ ENDPOINT EXISTANT
     */
    fetchAvailableDates: async (): Promise<string[]> => {
      return authenticatedFetch<string[]>('/api/rendezvous/available-dates');
    },

    // ==================== CONSTANTES ET UTILITAIRES ====================

    /**
     * NIVEAUX D'ÉTUDE (constants)
     */
    getEducationLevels: (): string[] => {
      return [...EDUCATION_LEVELS];
    },

    /**
     * CRÉNEAUX HORAIRES (constants)
     */
    getTimeSlots: (): string[] => {
      return [...TIME_SLOTS];
    },

    /**
     * STATUTS DISPONIBLES (constants)
     */
    getStatusOptions: (): string[] => {
      return Object.values(RENDEZVOUS_STATUS);
    },

    /**
     * AVIS ADMIN (constants)
     */
    getAdminOpinionOptions: (): string[] => {
      return Object.values(ADMIN_OPINION);
    },

    /**
     * MASQUER L'EMAIL (pour l'affichage)
     */
    maskEmail: (email: string): string => {
      if (!email) return '';

      const [localPart, domain] = email.split('@');

      if (!localPart || !domain) {
        if (import.meta.env.DEV) {
          globalThis.console.warn(`Format email invalide: ${email}`);
        }
        return 'email_non_disponible';
      }

      const maskedLocal =
        localPart.length <= 2
          ? localPart.charAt(0) + '*'
          : localPart.charAt(0) +
            '***' +
            localPart.charAt(localPart.length - 1);

      return `${maskedLocal}@${domain}`;
    },

    /**
     * VALIDER LES DONNÉES DE CRÉATION (comme backend)
     */
    validateCreateData: (data: CreateRendezVousData): string[] => {
      const errors: string[] = [];

      if (!data.firstName?.trim()) errors.push('Le prénom est obligatoire');
      if (!data.lastName?.trim()) errors.push('Le nom est obligatoire');
      if (!data.email?.trim()) errors.push("L'email est obligatoire");
      if (!data.telephone?.trim()) errors.push('Le téléphone est obligatoire');
      if (!data.date?.trim()) errors.push('La date est obligatoire');
      if (!data.time?.trim()) errors.push("L'heure est obligatoire");
      if (!data.destination?.trim())
        errors.push('La destination est obligatoire');
      if (!data.niveauEtude?.trim())
        errors.push("Le niveau d'étude est obligatoire");
      if (!data.filiere?.trim()) errors.push('La filière est obligatoire');

      if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
        errors.push('Format email invalide');
      }

      if (data.destination === 'Autre' && !data.destinationAutre?.trim()) {
        errors.push('La destination "Autre" nécessite une précision');
      }

      if (data.filiere === 'Autre' && !data.filiereAutre?.trim()) {
        errors.push('La filière "Autre" nécessite une précision');
      }

      return errors;
    },
  };
};

// ✅ Hook custom pour utiliser le service admin
export const useAdminRendezVousService = () => {
  const { access_token } = useAuth();
  return createAdminRendezVousService(access_token);
};
