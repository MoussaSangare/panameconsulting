import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

// ===== INTERFACES =====
export interface Contact {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  message: string;
  isRead: boolean;
  adminResponse?: string;
  respondedAt?: Date;
  respondedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactResponse {
  data: Contact[];
  total: number;
  page: number;
  limit: number;
}

export interface ContactStats {
  total: number;
  unread: number;
  read: number;
  responded: number;
  thisMonth: number;
  lastMonth: number;
}

export interface CreateContactDto {
  firstName?: string;
  lastName?: string;
  email: string;
  message: string;
}

export interface ContactFilters {
  page?: number;
  limit?: number;
  isRead?: boolean;
  search?: string;
}

// ===== HOOK PERSONNALISÉ =====
export const useContactService = () => {
  const { access_token, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;

  // Fonction utilitaire pour vérifier les droits admin
  const isUserAdmin = (currentUser: any): boolean => {
    return currentUser?.role === 'admin';
  };

  // Fonction de requête sécurisée avec gestion d'erreur
  const secureFetch = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {},
      requireAdmin = false
    ) => {
      if (requireAdmin && (!isAuthenticated || !isUserAdmin(user))) {
        throw new Error('Accès refusé : droits administrateur requis');
      }

      if (requireAdmin && !access_token) {
        throw new Error("Token d'authentification manquant");
      }

      // Vérifier si on est dans un environnement navigateur
      if (typeof globalThis === 'undefined' || !globalThis.setTimeout) {
        throw new Error('Environnement non supporté pour les requêtes HTTP');
      }

      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort(), 15000);

      try {
        const response = await globalThis.fetch(`${API_URL}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(requireAdmin && access_token
              ? { Authorization: `Bearer ${access_token}` }
              : {}),
            ...options.headers,
          },
          credentials: 'include',
        });

        globalThis.clearTimeout(timeoutId);

        // Gestion des erreurs HTTP
        if (response.status === 401) {
          throw new Error('Session expirée, veuillez vous reconnecter');
        }

        if (response.status === 403) {
          throw new Error('Accès refusé : droits insuffisants');
        }

        if (response.status === 404) {
          throw new Error('Ressource non trouvée');
        }

        if (response.status === 429) {
          throw new Error('Trop de requêtes, veuillez patienter');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || `Erreur ${response.status}`);
        }

        return await response.json();
      } catch (err: any) {
        globalThis.clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Timeout de la requête');
        }
        throw err;
      }
    },
    [API_URL, access_token, isAuthenticated, user]
  );

  // 📋 Récupérer tous les messages avec pagination et filtres
  const getAllContacts = useCallback(
    async (filters: ContactFilters = {}): Promise<ContactResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const { page = 1, limit = 20, isRead, search } = filters;

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (isRead !== undefined) params.append('isRead', isRead.toString());
        if (search) params.append('search', search.trim());

        return await secureFetch(
          `/api/contact?${params}`,
          {
            method: 'GET',
          },
          true
        );
      } catch (err: any) {
        const errorMessage =
          err.message || 'Erreur lors de la récupération des messages';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [secureFetch]
  );

  // 📊 Obtenir les statistiques des messages
  const getContactStats = useCallback(async (): Promise<ContactStats> => {
    setIsLoading(true);
    setError(null);

    try {
      return await secureFetch(
        '/api/contact/stats',
        {
          method: 'GET',
        },
        true
      );
    } catch (err: any) {
      const errorMessage =
        err.message || 'Erreur lors de la récupération des statistiques';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [secureFetch]);

  // 👁️ Récupérer un message spécifique
  const getContact = useCallback(
    async (id: string): Promise<Contact> => {
      setIsLoading(true);
      setError(null);

      try {
        return await secureFetch(
          `/api/contact/${id}`,
          {
            method: 'GET',
          },
          true
        );
      } catch (err: any) {
        const errorMessage =
          err.message || 'Erreur lors de la récupération du message';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [secureFetch]
  );

  // ✅ Marquer un message comme lu
  const markAsRead = useCallback(
    async (id: string): Promise<Contact> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await secureFetch(
          `/api/contact/${id}/read`,
          {
            method: 'PATCH',
          },
          true
        );

        toast.success('Message marqué comme lu');
        return result.contact;
      } catch (err: any) {
        const errorMessage =
          err.message || 'Erreur lors du marquage du message';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [secureFetch]
  );

  // 📩 Répondre à un message
  const replyToMessage = useCallback(
    async (id: string, reply: string): Promise<Contact> => {
      if (!reply || reply.trim().length < 1) {
        throw new Error('La réponse ne peut pas être vide');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await secureFetch(
          `/api/contact/${id}/reply`,
          {
            method: 'POST',
            body: JSON.stringify({ reply: reply.trim() }),
          },
          true
        );

        toast.success('Réponse envoyée avec succès');
        return result.contact;
      } catch (err: any) {
        const errorMessage =
          err.message || "Erreur lors de l'envoi de la réponse";
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [secureFetch]
  );

  // 🗑️ Supprimer un message
  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await secureFetch(
          `/api/contact/${id}`,
          {
            method: 'DELETE',
          },
          true
        );

        toast.success('Message supprimé avec succès');
      } catch (err: any) {
        const errorMessage =
          err.message || 'Erreur lors de la suppression du message';
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [secureFetch]
  );

  // 📧 Envoyer un message de contact (public)
  const createContact = useCallback(
    async (contactData: CreateContactDto): Promise<Contact> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await secureFetch(
          '/api/contact',
          {
            method: 'POST',
            body: JSON.stringify(contactData),
          },
          false
        );

        toast.success('Message envoyé avec succès');
        return result.contact;
      } catch (err: any) {
        const errorMessage = err.message || "Erreur lors de l'envoi du message";
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [secureFetch]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Données
    isLoading,
    error,

    // Fonctions admin
    getAllContacts,
    getContactStats,
    getContact,
    markAsRead,
    replyToMessage,
    deleteContact,

    // Fonction publique
    createContact,

    // Utilitaires
    clearError,

    // Métadonnées
    isAdmin: isUserAdmin(user),
    canAccessAdmin: isAuthenticated && isUserAdmin(user),
  };
};

// Hook spécialisé pour l'admin
export const useAdminContactService = () => {
  const contactService = useContactService();

  return {
    isLoading: contactService.isLoading,
    error: contactService.error,
    getAllContacts: contactService.getAllContacts,
    getContactStats: contactService.getContactStats,
    getContact: contactService.getContact,
    markAsRead: contactService.markAsRead,
    replyToMessage: contactService.replyToMessage,
    deleteContact: contactService.deleteContact,
    clearError: contactService.clearError,
    isAdmin: contactService.isAdmin,
    canAccessAdmin: contactService.canAccessAdmin,
  };
};

export default useContactService;
