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

interface ContactFilters {
  page?: number;  // Rendre optionnel
  limit?: number; // Rendre optionnel
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
    // Vérification des droits admin
    if (requireAdmin && (!isAuthenticated || !isUserAdmin(user))) {
      throw new Error('Accès refusé : droits administrateur requis');
    }

    if (requireAdmin && !access_token) {
      throw new Error("Token d'authentification manquant");
    }

    // Vérifier l'URL de l'API
    if (!API_URL || typeof API_URL !== 'string') {
      throw new Error('Configuration API invalide');
    }

    // Vérifier si on est dans un environnement navigateur
    if (typeof globalThis === 'undefined' || !globalThis.setTimeout) {
      throw new Error('Environnement non supporté pour les requêtes HTTP');
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 15000);

    try {
      // Construction de l'URL complète
      const fullUrl = `${API_URL}${endpoint}`;
      
      // Validation de l'URL
      try {
        new URL(fullUrl);
      } catch {
        throw new Error(`URL invalide : ${fullUrl}`);
      }

      const response = await globalThis.fetch(fullUrl, {
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

      // Gestion des erreurs réseau
      if (response.status === 0 || response.type === 'error') {
        throw new Error('Erreur de connexion au serveur. Vérifiez votre connexion réseau.');
      }

      // Gestion des erreurs HTTP spécifiques
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
        throw new Error('Trop de requêtes, veuillez patienter quelques instants');
      }

      if (response.status >= 500) {
        throw new Error('Erreur serveur, veuillez réessayer ultérieurement');
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData?.message || `Erreur ${response.status} - ${response.statusText}`);
        } catch {
          throw new Error(`Erreur ${response.status} - ${response.statusText}`);
        }
      }

      // Parse la réponse
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else if (contentType && contentType.includes('text/')) {
          return await response.text();
        } else {
          return await response.blob();
        }
      } catch (parseError) {
        throw new Error('Erreur lors de la lecture de la réponse');
      }
    } catch (err: any) {
      globalThis.clearTimeout(timeoutId);
      
      // Gestion des erreurs spécifiques
      if (err.name === 'AbortError') {
        throw new Error('La requête a expiré (timeout de 15s)');
      }
      
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
      }
      
      if (err.message.includes('URL invalide')) {
        throw err;
      }
      
      // Si l'erreur a déjà un message, la propager
      if (err.message && err.message !== 'FetchError') {
        throw err;
      }
      
      throw new Error('Une erreur inattendue est survenue');
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
      // Paramètres avec valeurs par défaut
      const { 
        page = 1, 
        limit = 10, 
        isRead, 
        search 
      } = filters;

      // Validation des paramètres
      if (page < 1) {
        throw new Error('Le numéro de page doit être supérieur à 0');
      }
      
      if (limit < 1 || limit > 100) {
        throw new Error('La limite doit être comprise entre 1 et 100');
      }

      // Construction des paramètres de requête
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (isRead !== undefined) {
        params.append('isRead', isRead.toString());
      }
      
      if (search && search.trim().length > 0) {
        params.append('search', search.trim());
        
        // Validation de la longueur de recherche
        if (search.trim().length > 100) {
          throw new Error('La recherche ne peut pas dépasser 100 caractères');
        }
      }

      // Appel API
      const response = await secureFetch(
        `/api/contact?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        },
        true
      );

      // Validation de la réponse
      if (!response || typeof response !== 'object') {
        throw new Error('Réponse du serveur invalide');
      }

      // Vérification de la structure de la réponse
      const requiredFields = ['data', 'total', 'page', 'limit'];
      for (const field of requiredFields) {
        if (!(field in response)) {
          throw new Error(`Réponse incomplète : champ ${field} manquant`);
        }
      }

      // Conversion et validation des données
      const processedData = Array.isArray(response.data) 
        ? response.data.map((contact: any) => {
            // Validation des champs requis
            if (!contact._id || !contact.email || !contact.message) {
              console.warn('Contact avec des champs manquants:', contact);
            }

            return {
              _id: String(contact._id || ''),
              firstName: contact.firstName || undefined,
              lastName: contact.lastName || undefined,
              email: String(contact.email || ''),
              message: String(contact.message || ''),
              isRead: Boolean(contact.isRead || false),
              adminResponse: contact.adminResponse || undefined,
              respondedAt: contact.respondedAt ? new Date(contact.respondedAt) : undefined,
              respondedBy: contact.respondedBy ? String(contact.respondedBy) : undefined,
              createdAt: contact.createdAt ? new Date(contact.createdAt) : new Date(),
              updatedAt: contact.updatedAt ? new Date(contact.updatedAt) : new Date(),
            };
          })
        : [];

      return {
        data: processedData,
        total: Number(response.total) || 0,
        page: Number(response.page) || 1,
        limit: Number(response.limit) || 10,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la récupération des messages';
      setError(errorMessage);
      
      // Toast avec options améliorées
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
      
      // Log en console pour le débogage
      console.error('Erreur getAllContacts:', {
        filters,
        error: err.message,
        stack: err.stack,
      });
      
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
