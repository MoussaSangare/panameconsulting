// hooks/useAdminUserService.ts
import { useAuth } from '../../context/AuthContext';

// ===== INTERFACES (Alignées avec backend) =====
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  logoutUntil?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  regularUsers: number;
}

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  password: string;
  role: 'admin' | 'user'; // Note: Backend forcera USER pour tous les créations API
}

export interface UpdateUserDto {
  email?: string;
  telephone?: string;
}

export interface AdminResetPasswordDto {
  newPassword: string;
  confirmNewPassword: string;
}

export interface AccessCheckResponse {
  canAccess: boolean;
  reason?: string;
  user?: any;
  details?: any;
}

export interface MaintenanceStatus {
  isActive: boolean;
  enabledAt: string | null;
  message: string;
}

export interface MaintenanceResponse {
  message: string;
}

// ===== HOOK PERSONNALISÉ =====
export const useAdminUserService = () => {
  const { fetchWithAuth, user, isAuthenticated } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  // Fonction utilitaire pour vérifier les droits admin
  const isUserAdmin = (currentUser: any): boolean => {
    return currentUser?.role === 'admin';
  };

  // Extraire les messages d'erreur spécifiques du backend
  const extractBackendErrorMessage = (error: any): string => {
    if (error.message && typeof error.message === 'string') {
      // Messages d'erreur spécifiques du backend
      const backendMessages = [
        'Cet email est déjà utilisé',
        'Ce numéro de téléphone est déjà utilisé',
        'Cet email est réservé à l\'administrateur principal',
        'Impossible de supprimer l\'administrateur unique',
        'Impossible de désactiver l\'administrateur unique',
        'Seul l\'administrateur principal peut réinitialiser son mot de passe',
        'Le mot de passe doit contenir au moins 8 caractères',
        'Les mots de passe ne correspondent pas',
        'Au moins un champ (email ou téléphone) doit être fourni',
        'Format d\'email invalide',
        'Le téléphone doit contenir au moins 5 caractères',
        'Aucune donnée valide à mettre à jour',
        'Mode maintenance activé',
        'Compte désactivé',
        'Utilisateur non trouvé',
        'Déconnecté temporairement',
      ];
      
      for (const msg of backendMessages) {
        if (error.message.includes(msg)) {
          return msg;
        }
      }
    }
    return error.message || 'Une erreur est survenue';
  };

  // Fonction de requête admin sécurisée avec timeout
  const secureAdminFetch = async (
    endpoint: string,
    options: RequestInit = {},
    timeout = 15000 // 15 secondes par défaut
  ) => {
    if (!isAuthenticated || !isUserAdmin(user)) {
      throw new Error('Accès refusé : droits administrateur requis');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetchWithAuth(`${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      if (response.status === 403) {
        throw new Error('Accès refusé : droits administrateur requis');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      // Pour les réponses 204 (No Content)
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        throw new Error('La requête a expiré. Veuillez réessayer.');
      }
      
      if (err.message === 'SESSION_EXPIRED' || err.message.includes('Session expirée')) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }
      
      // Extraire le message d'erreur spécifique du backend
      const userMessage = extractBackendErrorMessage(err);
      throw new Error(userMessage);
    }
  };

  // Nettoyer les données pour ne pas envoyer de champs undefined/null
  const cleanData = (data: any): any => {
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== null && value !== '')
    );
  };

  // === MÉTHODES ADMIN UNIQUEMENT ===

  // Récupérer tous les utilisateurs
  const getAllUsers = async (): Promise<User[]> => {
    try {
      const users = await secureAdminFetch('/api/users', {
        method: 'GET',
      });

      return users as User[];
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors de la récupération des utilisateurs");
    }
  };

  // Obtenir les statistiques utilisateurs
  const getUserStats = async (): Promise<UserStats> => {
    try {
      const stats = await secureAdminFetch('/api/users/stats', {
        method: 'GET',
      });

      return stats as UserStats;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors de la récupération des statistiques');
    }
  };

  // Créer un utilisateur (sera toujours USER sauf si email=EMAIL_USER et premier admin)
  const createUser = async (userData: CreateUserDto): Promise<User> => {
    try {
      // Validation frontend supplémentaire
      if (!userData.email || !userData.email.includes('@')) {
        throw new Error('Format d\'email invalide');
      }

      if (userData.password.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caractères');
      }

      if (!userData.telephone || userData.telephone.trim().length < 5) {
        throw new Error('Le téléphone doit contenir au moins 5 caractères');
      }

      const result = await secureAdminFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      return result as User;
    } catch (err: any) {
      throw new Error(err.message || "Erreur lors de la création de l'utilisateur");
    }
  };

  // Mettre à jour un utilisateur
  const updateUser = async (userId: string, userData: UpdateUserDto): Promise<User> => {
    try {
      // Validation frontend
      if (userData.email && !userData.email.includes('@')) {
        throw new Error('Format d\'email invalide');
      }

      if (userData.telephone && userData.telephone.trim().length < 5) {
        throw new Error('Le téléphone doit contenir au moins 5 caractères');
      }

      // Nettoyer les données
      const cleanUserData = cleanData(userData);

      if (Object.keys(cleanUserData).length === 0) {
        throw new Error('Aucune donnée valide à mettre à jour');
      }

      const result = await secureAdminFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(cleanUserData),
      });

      return result as User;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors de la mise à jour');
    }
  };

  // Réinitialiser le mot de passe d'un utilisateur (admin)
  const adminResetPassword = async (
    userId: string,
    passwordData: AdminResetPasswordDto
  ): Promise<void> => {
    try {
      // Validation frontend
      if (passwordData.newPassword !== passwordData.confirmNewPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      if (passwordData.newPassword.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caractères');
      }

      await secureAdminFetch(`/api/users/${userId}/admin-reset-password`, {
        method: 'PATCH',
        body: JSON.stringify(passwordData),
      });
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors de la réinitialisation du mot de passe');
    }
  };

  // Supprimer un utilisateur
  const deleteUser = async (userId: string): Promise<void> => {
    try {
      await secureAdminFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors de la suppression');
    }
  };

  // Activer/désactiver un utilisateur
  const toggleUserStatus = async (userId: string): Promise<User> => {
    try {
      const result = await secureAdminFetch(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
      });

      return result as User;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors du changement de statut');
    }
  };

  // Vérifier l'accès d'un utilisateur
  const checkUserAccess = async (userId: string): Promise<AccessCheckResponse> => {
    try {
      const accessCheck = await secureAdminFetch(`/api/users/check-access/${userId}`, {
        method: 'GET',
      });

      return accessCheck as AccessCheckResponse;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur vérification accès');
    }
  };

  // Gestion du mode maintenance
  const getMaintenanceStatus = async (): Promise<MaintenanceStatus> => {
    try {
      const status = await secureAdminFetch('/api/users/maintenance-status', {
        method: 'GET',
      });

      return status as MaintenanceStatus;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur récupération statut maintenance');
    }
  };

  const setMaintenanceMode = async (enabled: boolean): Promise<MaintenanceResponse> => {
    try {
      const response = await secureAdminFetch('/api/users/maintenance-mode', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });

      return response as MaintenanceResponse;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur changement mode maintenance');
    }
  };

  // Mise à jour du profil utilisateur (accessible aussi aux non-admins)
  const updateProfile = async (userData: UpdateUserDto): Promise<User> => {
    try {
      // Validation frontend
      if (userData.email && !userData.email.includes('@')) {
        throw new Error('Format d\'email invalide');
      }

      if (userData.telephone && userData.telephone.trim().length < 5) {
        throw new Error('Le téléphone doit contenir au moins 5 caractères');
      }

      const cleanUserData = cleanData(userData);

      if (Object.keys(cleanUserData).length === 0) {
        throw new Error('Aucune donnée valide à mettre à jour');
      }

      const result = await secureAdminFetch('/api/users/profile/me', {
        method: 'PATCH',
        body: JSON.stringify(cleanUserData),
      });

      return result as User;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur lors de la mise à jour du profil');
    }
  };

  // Récupérer le profil de l'utilisateur connecté
  const getMyProfile = async (): Promise<User> => {
    try {
      const profile = await secureAdminFetch('/api/users/profile/me', {
        method: 'GET',
      });

      return profile as User;
    } catch (err: any) {
      throw new Error(err.message || 'Erreur récupération profil');
    }
  };

  return {
    // Méthodes admin
    getAllUsers,
    getUserStats,
    createUser,
    updateUser,
    adminResetPassword,
    deleteUser,
    toggleUserStatus,
    checkUserAccess,
    getMaintenanceStatus,
    setMaintenanceMode,
    updateProfile,
    getMyProfile,

    // Utilitaires
    isUserAdmin: isUserAdmin(user),
    canAccessAdmin: isAuthenticated && isUserAdmin(user),
    
    // Pour débogage
    currentUser: user,
  };
};

export default useAdminUserService;