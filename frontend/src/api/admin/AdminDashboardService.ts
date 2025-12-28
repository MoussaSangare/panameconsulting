/* eslint-disable no-undef */

import { useAuth } from '../../context/AuthContext';
import React from 'react';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  regularUsers: number;
  totalProcedures: number;
  proceduresByStatus: { _id: string; count: number }[];
  proceduresByDestination: { _id: string; count: number }[];
  totalRendezvous: number;
  rendezvousStats: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  totalContacts?: number;
  unreadContacts?: number;
}

export interface RecentActivity {
  _id: string;
  type: 'procedure' | 'rendezvous' | 'user' | 'contact';
  action: string;
  description: string;
  timestamp: Date;
  userEmail?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

class AdminDashboardService {
  private static instance: AdminDashboardService;
  private baseUrl: string;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 secondes
  private readonly MAX_CACHE_SIZE = 50;
  private activeRequests = new Map<string, Promise<any>>();

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL;
    console.log(
      `📡 AdminDashboardService initialisé avec URL: ${this.baseUrl}`
    );
  }

  static getInstance(): AdminDashboardService {
    if (!AdminDashboardService.instance) {
      AdminDashboardService.instance = new AdminDashboardService();
    }
    return AdminDashboardService.instance;
  }

  private async request(
    endpoint: string,
    accessToken: string,
    options: RequestInit = {},
    useRequestDeduplication = true
  ) {
    if (!accessToken) {
      throw new Error('UNAUTHORIZED');
    }

    // 🔧 Déduplication des requêtes identiques
    const requestKey = `${endpoint}:${JSON.stringify(options)}`;

    if (useRequestDeduplication && this.activeRequests.has(requestKey)) {
      console.log(`🔄 Utilisation de la requête en cours pour ${endpoint}`);
      return await this.activeRequests.get(requestKey)!;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const url = `${this.baseUrl}/${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    const finalHeaders = { ...headers };

    if (options.headers) {
      Object.entries(options.headers as Record<string, string>).forEach(
        ([key, value]) => {
          if (
            key.toLowerCase() !== 'content-type' ||
            value !== 'multipart/form-data'
          ) {
            finalHeaders[key] = value;
          }
        }
      );
    }

    const requestPromise = (async () => {
      try {
        console.log(`📤 Envoi requête ${endpoint}`);

        const response = await fetch(url, {
          ...options,
          headers: finalHeaders,
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401) {
            const error = new Error('UNAUTHORIZED') as ApiError;
            error.status = 401;
            throw error;
          }

          if (response.status === 403) {
            const error = new Error('FORBIDDEN') as ApiError;
            error.status = 403;
            throw error;
          }

          if (response.status === 429) {
            const error = new Error('TOO_MANY_REQUESTS') as ApiError;
            error.status = 429;
            error.message = 'Trop de requêtes, veuillez patienter';
            throw error;
          }

          const errorData = await response.json().catch(() => ({}));
          const error = new Error(
            errorData.message ||
              `Erreur ${response.status}: ${response.statusText}`
          ) as ApiError;
          error.status = response.status;
          error.code = errorData.code;
          throw error;
        }

        const data = await response.json();
        console.log(`✅ Réponse reçue de ${endpoint}`);
        return data;
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          console.error(`⏰ Timeout sur l'endpoint ${endpoint}`);
          const timeoutError = new Error(
            'Le serveur met trop de temps à répondre'
          ) as ApiError;
          timeoutError.code = 'TIMEOUT';
          throw timeoutError;
        }

        console.error(`❌ API Error ${endpoint}:`, error);
        throw error;
      } finally {
        if (useRequestDeduplication) {
          this.activeRequests.delete(requestKey);
        }
      }
    })();

    if (useRequestDeduplication) {
      this.activeRequests.set(requestKey, requestPromise);
    }

    return await requestPromise;
  }

  private async requestWithCache(
    endpoint: string,
    accessToken: string,
    options: RequestInit = {},
    useCache = true
  ) {
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;

    // Vérifier le cache
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`📦 Utilisation du cache pour ${endpoint}`);
        return cached.data;
      }
    }

    // Faire la requête
    const data = await this.request(endpoint, accessToken, options, true);

    // Mettre en cache
    if (useCache) {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });

      // Nettoyer le cache si trop grand
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        const oldestKey = Array.from(this.cache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0]?.[0];
        if (oldestKey) {
          this.cache.delete(oldestKey);
          console.log(`🧹 Cache nettoyé - clé supprimée: ${oldestKey}`);
        }
      }
    }

    return data;
  }

  private getDefaultStats(): DashboardStats {
    return {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      adminUsers: 0,
      regularUsers: 0,
      totalProcedures: 0,
      proceduresByStatus: [],
      proceduresByDestination: [],
      totalRendezvous: 0,
      rendezvousStats: {
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
      },
      totalContacts: 0,
      unreadContacts: 0,
    };
  }

  // ==================== MÉTHODES PRINCIPALES ====================

  /**
   * Récupère toutes les statistiques pour le dashboard admin
   */
  async getDashboardStats(accessToken: string): Promise<DashboardStats> {
    try {
      console.log('📊 Récupération des statistiques du dashboard');

      // Récupérer les statistiques utilisateurs avec cache
      const userStats = await this.requestWithCache(
        '/users/stats',
        accessToken,
        {},
        true
      );

      // Initialiser avec les stats utilisateurs
      const stats: DashboardStats = {
        ...this.getDefaultStats(),
        totalUsers: userStats.totalUsers || 0,
        activeUsers: userStats.activeUsers || 0,
        inactiveUsers: userStats.inactiveUsers || 0,
        adminUsers: userStats.adminUsers || 0,
        regularUsers: userStats.regularUsers || 0,
      };

      // Récupérer les autres stats en parallèle (sans bloquer)
      const [procedureStats, contactStats, rendezvousResponse] =
        await Promise.allSettled([
          this.requestWithCache(
            '/procedures/admin/stats',
            accessToken,
            {},
            true
          ).catch(() => null),
          this.requestWithCache('/contact/stats', accessToken, {}, true).catch(
            () => null
          ),
          this.requestWithCache(
            '/rendezvous?limit=99',
            accessToken,
            {},
            true
          ).catch(() => ({ data: [] })),
        ]);

      // Traiter les statistiques des procédures
      if (procedureStats.status === 'fulfilled' && procedureStats.value) {
        stats.totalProcedures = procedureStats.value.total || 0;
        stats.proceduresByStatus = procedureStats.value.byStatus || [];
        stats.proceduresByDestination =
          procedureStats.value.byDestination || [];
      }

      // Traiter les statistiques des contacts
      if (contactStats.status === 'fulfilled' && contactStats.value) {
        stats.totalContacts = contactStats.value.total || 0;
        stats.unreadContacts = contactStats.value.unread || 0;
      }

      // Traiter les rendez-vous
      if (
        rendezvousResponse.status === 'fulfilled' &&
        rendezvousResponse.value
      ) {
        const allRendezvous = rendezvousResponse.value.data || [];
        stats.totalRendezvous = allRendezvous.length;
        stats.rendezvousStats = {
          pending: allRendezvous.filter(
            (rdv: any) => rdv.status === 'En attente'
          ).length,
          confirmed: allRendezvous.filter(
            (rdv: any) => rdv.status === 'Confirmé'
          ).length,
          completed: allRendezvous.filter(
            (rdv: any) => rdv.status === 'Terminé'
          ).length,
          cancelled: allRendezvous.filter((rdv: any) => rdv.status === 'Annulé')
            .length,
        };
      }

      console.log('✅ Statistiques récupérées avec succès');
      return stats;
    } catch (error: any) {
      console.error('❌ Erreur récupération stats dashboard:', error);

      // Retourner des valeurs par défaut en cas d'erreur
      return this.getDefaultStats();
    }
  }

  /**
   * Récupère les activités récentes
   */
  async getRecentActivities(
    accessToken: string,
    limit = 5
  ): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = [];

      // Récupérer les activités en parallèle
      const [proceduresResponse, rendezvousResponse, contactsResponse] =
        await Promise.allSettled([
          this.requestWithCache(
            `/procedures/admin/all?page=1&limit=${limit}`,
            accessToken,
            {},
            false
          ),
          this.requestWithCache(
            `/rendezvous?page=1&limit=${limit}`,
            accessToken,
            {},
            false
          ),
          this.requestWithCache(
            `/contact?page=1&limit=${limit}`,
            accessToken,
            {},
            false
          ),
        ]);

      // Procédures récentes
      if (
        proceduresResponse.status === 'fulfilled' &&
        proceduresResponse.value
      ) {
        const procedures = proceduresResponse.value.data || [];
        procedures.forEach((procedure: any) => {
          activities.push({
            _id: procedure._id,
            type: 'procedure',
            action: procedure.statut,
            description: `Procédure ${procedure.statut} pour ${procedure.prenom} ${procedure.nom}`,
            timestamp: new Date(procedure.createdAt || procedure.updatedAt),
            userEmail: procedure.email,
          });
        });
      }

      // Rendez-vous récents
      if (
        rendezvousResponse.status === 'fulfilled' &&
        rendezvousResponse.value
      ) {
        const rendezvous = rendezvousResponse.value.data || [];
        rendezvous.forEach((rdv: any) => {
          activities.push({
            _id: rdv._id,
            type: 'rendezvous',
            action: rdv.status,
            description: `Rendez-vous ${rdv.status} pour ${rdv.firstName} ${rdv.lastName}`,
            timestamp: new Date(rdv.createdAt || rdv.updatedAt),
            userEmail: rdv.email,
          });
        });
      }

      // Contacts récents
      if (contactsResponse.status === 'fulfilled' && contactsResponse.value) {
        const contacts = contactsResponse.value.data || [];
        contacts.forEach((contact: any) => {
          activities.push({
            _id: contact._id,
            type: 'contact',
            action: contact.isRead ? 'lu' : 'non lu',
            description: `Message de ${contact.email}: ${contact.subject}`,
            timestamp: new Date(contact.createdAt),
            userEmail: contact.email,
          });
        });
      }

      // Trier par date décroissante et limiter
      return activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Erreur récupération activités récentes:', error);
      return [];
    }
  }

  /**
   * Récupère les statistiques détaillées des procédures
   */
  async getDetailedProcedureStats(accessToken: string): Promise<any> {
    try {
      return await this.requestWithCache(
        '/procedures/admin/stats',
        accessToken,
        {},
        true
      );
    } catch (error) {
      console.error('❌ Erreur récupération stats procédures:', error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        byStatus: [],
        byDestination: [],
      };
    }
  }

  /**
   * Récupère les messages de contact non lus
   */
  async getUnreadContacts(accessToken: string): Promise<any[]> {
    try {
      const response = await this.requestWithCache(
        '/contact?isRead=false&limit=5',
        accessToken,
        {},
        true
      );
      return response.data || [];
    } catch (error) {
      console.error('❌ Erreur récupération contacts non lus:', error);
      return [];
    }
  }

  /**
   * Nettoyer le cache
   */
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cache vidé - ${cacheSize} entrées supprimées`);
  }

  /**
   * Annuler toutes les requêtes en cours
   */
  cancelAllRequests(): void {
    const requestCount = this.activeRequests.size;
    this.activeRequests.clear();
    console.log(`✋ ${requestCount} requêtes annulées`);
  }

  /**
   * Obtenir des informations sur l'état du service
   */
  getServiceStatus(): {
    cacheSize: number;
    activeRequests: number;
    baseUrl: string;
  } {
    return {
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests.size,
      baseUrl: this.baseUrl,
    };
  }
}

// Instance unique du service
export const adminDashboardService = AdminDashboardService.getInstance();

// Hook React pour utiliser le service
export const useAdminDashboard = () => {
  const { access_token, refreshToken, isAuthenticated, user, isLoading } =
    useAuth();

  // Wrapper pour gérer le rafraîchissement automatique du token
  const secureRequest = async <T>(
    fn: (token: string) => Promise<T>
  ): Promise<T> => {
    if (!access_token) {
      throw new Error('UNAUTHORIZED');
    }

    try {
      return await fn(access_token);
    } catch (error: any) {
      // Si le token a expiré, essayer de le rafraîchir
      if (error.message === 'UNAUTHORIZED' && refreshToken) {
        console.log('🔄 Tentative de rafraîchissement du token...');
        const refreshed = await refreshToken();
        if (refreshed && access_token) {
          // Réessayer avec le nouveau token
          console.log('✅ Token rafraîchi, nouvelle tentative...');
          return await fn(access_token);
        }
      }
      throw error;
    }
  };

  return {
    // Méthodes principales avec gestion automatique du refresh token
    getDashboardStats: () =>
      secureRequest(token => adminDashboardService.getDashboardStats(token)),

    getRecentActivities: (limit?: number) =>
      secureRequest(token =>
        adminDashboardService.getRecentActivities(token, limit)
      ),

    getDetailedProcedureStats: () =>
      secureRequest(token =>
        adminDashboardService.getDetailedProcedureStats(token)
      ),

    getUnreadContacts: () =>
      secureRequest(token => adminDashboardService.getUnreadContacts(token)),

    // Méthodes utilitaires
    clearCache: () => adminDashboardService.clearCache(),
    cancelRequests: () => adminDashboardService.cancelAllRequests(),
    getServiceStatus: () => adminDashboardService.getServiceStatus(),

    // Informations du contexte
    isAuthenticated,
    user,
    isLoading,
  };
};

// Hook pour les données du dashboard
export const useDashboardData = () => {
  const { getDashboardStats, getRecentActivities, isAuthenticated } =
    useAdminDashboard();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [activities, setActivities] = React.useState<RecentActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const lastFetchRef = React.useRef<number>(0);
  const isFetchingRef = React.useRef<boolean>(false);
  const fetchCountRef = React.useRef<number>(0);
  const maxFetches = 3; // ✅ Limite de tentatives
  const minInterval = 30000; // ✅ 30 secondes minimum entre les requêtes

  const fetchDashboardData = React.useCallback(async () => {
    // Éviter les appels multiples
    if (
      isFetchingRef.current ||
      !isAuthenticated ||
      fetchCountRef.current >= maxFetches
    ) {
      console.log('⏸️ Appel ignoré - en cours ou limite atteinte');
      return;
    }

    // Limiter la fréquence des requêtes
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;

    if (timeSinceLastFetch < minInterval) {
      console.log(
        `⏰ Trop tôt pour une nouvelle requête (${Math.round(timeSinceLastFetch / 1000)}s)`
      );
      return;
    }

    isFetchingRef.current = true;
    fetchCountRef.current++;
    lastFetchRef.current = now;

    try {
      console.log('🔄 Chargement des données du dashboard...');
      setLoading(true);
      setError(null);

      const [statsData, activitiesData] = await Promise.allSettled([
        getDashboardStats(),
        getRecentActivities(10),
      ]);

      // Traiter les résultats
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      } else {
        console.error('❌ Erreur stats:', statsData.reason);
      }

      if (activitiesData.status === 'fulfilled') {
        setActivities(activitiesData.value);
      } else {
        console.error('❌ Erreur activités:', activitiesData.reason);
      }

      fetchCountRef.current = 0; // Réinitialiser en cas de succès
      console.log('✅ Données du dashboard chargées');
    } catch (err: any) {
      console.error('❌ Erreur chargement dashboard:', err);
      setError(err.message || 'Erreur lors du chargement des données');

      // Si c'est une erreur 429 (trop de requêtes), attendre plus longtemps
      if (
        err.message?.includes('429') ||
        err.message?.includes('TOO_MANY_REQUESTS')
      ) {
        console.warn('⚠️ Trop de requêtes, attente augmentée');
        lastFetchRef.current = now + 60000; // Attendre 1 minute supplémentaire
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    getDashboardStats,
    getRecentActivities,
    isAuthenticated,
    maxFetches,
    minInterval,
  ]);

  React.useEffect(() => {
    if (isAuthenticated) {
      console.log(
        '🔐 Utilisateur authentifié, préparation chargement dashboard'
      );

      // Attendre un peu avant la première requête
      const timer = setTimeout(() => {
        fetchDashboardData();
      }, 1000);

      return () => {
        clearTimeout(timer);
        console.log('🧹 Nettoyage timer chargement dashboard');
      };
    } else {
      console.log(
        '👤 Utilisateur non authentifié, pas de chargement dashboard'
      );
      setStats(null);
      setActivities([]);
      setLoading(false);
      setError(null);
    }
  }, [fetchDashboardData, isAuthenticated]);

  // Ajouter un intervalle de rafraîchissement contrôlé
  React.useEffect(() => {
    if (!isAuthenticated) {
      console.log(
        '🛑 Arrêt rafraîchissement automatique - utilisateur non authentifié'
      );
      return;
    }

    console.log('⏱️ Démarrage rafraîchissement automatique (5 minutes)');
    const refreshInterval = setInterval(() => {
      console.log('🔄 Rafraîchissement automatique des données');
      fetchDashboardData();
    }, 300000); // ✅ Rafraîchir toutes les 5 minutes

    return () => {
      console.log('🧹 Nettoyage intervalle rafraîchissement');
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, fetchDashboardData]);

  const refresh = React.useCallback(() => {
    console.log('🔄 Rafraîchissement manuel demandé');
    fetchDashboardData();
  }, [fetchDashboardData]);

  const forceRefresh = React.useCallback(() => {
    console.log('💥 Force refresh demandé');
    fetchCountRef.current = 0;
    lastFetchRef.current = 0;
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    activities,
    loading,
    error,
    refresh,
    forceRefresh,
    lastFetchTime: lastFetchRef.current,
    fetchCount: fetchCountRef.current,
  };
};

// Hook simplifié pour les statistiques rapides
export const useQuickStats = () => {
  const { getDashboardStats, isAuthenticated } = useAdminDashboard();
  const [quickStats, setQuickStats] = React.useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProcedures: 0,
    totalRendezvous: 0,
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    const loadQuickStats = async () => {
      setLoading(true);
      try {
        const stats = await getDashboardStats();
        setQuickStats({
          totalUsers: stats.totalUsers,
          activeUsers: stats.activeUsers,
          totalProcedures: stats.totalProcedures,
          totalRendezvous: stats.totalRendezvous,
        });
      } catch (error) {
        console.error('❌ Erreur chargement quick stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuickStats();
  }, [isAuthenticated, getDashboardStats]);

  return { quickStats, loading };
};
