// userService.ts
import { toast } from 'react-toastify';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  telephone?: string;
  isActive: boolean;
  isAdmin?: boolean;
  logoutUntil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  regularUsers: number;
}

export interface MaintenanceStatus {
  isActive: boolean;
  enabledAt: string | null;
  message: string;
}

export interface UserUpdateData {
  email?: string;
  telephone?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

class UserService {
  private readonly VITE_API_URL = import.meta.env.VITE_API_URL;

  // ==================== MÉTHODES PUBLIQUES (USER) ====================

  async getCurrentUser(token: string): Promise<User> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/auth/me`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || 'Erreur lors de la récupération du profil';

      // Gestion du toast par le service
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const userData = await response.json();

    return {
      id: userData.id || userData._id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      telephone: userData.telephone,
      isActive: userData.isActive !== false,
      isAdmin: userData.role === UserRole.ADMIN,
      logoutUntil: userData.logoutUntil,
    };
  }

  async updateProfile(
    token: string,
    updateData: UserUpdateData
  ): Promise<User> {
    // Validation des données
    if (!updateData.email && !updateData.telephone) {
      const errorMessage =
        'Au moins un champ (email ou téléphone) doit être fourni';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const requestData: any = {};
    if (updateData.email !== undefined) {
      requestData.email = updateData.email.trim();
    }
    if (updateData.telephone !== undefined) {
      requestData.telephone = updateData.telephone.trim();
    }

    if (Object.keys(requestData).length === 0) {
      const errorMessage = 'Aucune donnée valide à mettre à jour';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/profile/me`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage =
        errorData.message ||
        `Erreur ${response.status} lors de la mise à jour du profil`;

      // Gestion spécifique des erreurs
      if (response.status === 400) {
        if (errorData.message?.includes('email est déjà utilisé')) {
          errorMessage = 'Cet email est déjà utilisé';
        }
        if (
          errorData.message?.includes('numéro de téléphone est déjà utilisé')
        ) {
          errorMessage = 'Ce numéro de téléphone est déjà utilisé';
        }
        if (errorData.message?.includes("Format d'email invalide")) {
          errorMessage = "Format d'email invalide";
        }
      }

      if (response.status === 401) {
        errorMessage = 'Session expirée - Veuillez vous reconnecter';
      }

      // Le service gère le toast
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const result = await response.json();

    // Succès - le service gère le toast de succès
    toast.success('Profil mis à jour avec succès');

    return {
      id: result.id,
      email: result.email,
      firstName: result.firstName,
      lastName: result.lastName,
      role: result.role,
      telephone: result.telephone || '',
      isActive: result.isActive,
      isAdmin: result.role === UserRole.ADMIN,
    };
  }

  // ==================== MÉTHODES ADMIN ====================

  async getAllUsers(token: string): Promise<User[]> {
    const response = await globalThis.fetch(`${this.VITE_API_URL}/api/users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || 'Erreur lors de la récupération des utilisateurs';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const users = await response.json();
    return users.map((user: any) => ({
      id: user._id || user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      telephone: user.telephone || '',
      isActive: user.isActive,
      isAdmin: user.role === UserRole.ADMIN,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  async getUserStats(token: string): Promise<UserStats> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/stats`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || 'Erreur lors de la récupération des statistiques';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  async createUser(token: string, userData: any): Promise<User> {
    const response = await globalThis.fetch(`${this.VITE_API_URL}/api/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || "Erreur lors de la création de l'utilisateur";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const user = await response.json();

    toast.success('Utilisateur créé avec succès');

    return {
      id: user._id || user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      telephone: user.telephone || '',
      isActive: user.isActive,
      isAdmin: user.role === UserRole.ADMIN,
    };
  }

  async updateUser(
    token: string,
    userId: string,
    updateData: UserUpdateData
  ): Promise<User> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/${userId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || "Erreur lors de la mise à jour de l'utilisateur";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const user = await response.json();

    toast.success('Utilisateur mis à jour avec succès');

    return {
      id: user.id || user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      telephone: user.telephone || '',
      isActive: user.isActive,
      isAdmin: user.role === UserRole.ADMIN,
    };
  }

  async deleteUser(token: string, userId: string): Promise<void> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/${userId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || "Erreur lors de la suppression de l'utilisateur";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    toast.success('Utilisateur supprimé avec succès');
  }

  async toggleUserStatus(token: string, userId: string): Promise<User> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/${userId}/toggle-status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || 'Erreur lors du changement de statut';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const user = await response.json();

    const statusMessage = user.isActive
      ? 'Utilisateur activé avec succès'
      : 'Utilisateur désactivé avec succès';
    toast.success(statusMessage);

    return {
      id: user.id || user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      telephone: user.telephone || '',
      isActive: user.isActive,
      isAdmin: user.role === UserRole.ADMIN,
    };
  }

  async adminResetPassword(
    token: string,
    userId: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/${userId}/admin-reset-password`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          newPassword,
          confirmNewPassword: confirmPassword,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        'Erreur lors de la réinitialisation du mot de passe';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    toast.success('Mot de passe réinitialisé avec succès');
  }

  async getMaintenanceStatus(token: string): Promise<MaintenanceStatus> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/maintenance-status`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        'Erreur lors de la récupération du statut maintenance';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  async setMaintenanceMode(token: string, enabled: boolean): Promise<void> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/maintenance-mode`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || 'Erreur lors du changement du mode maintenance';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    const message = enabled
      ? 'Mode maintenance activé'
      : 'Mode maintenance désactivé';
    toast.success(message);
  }

  async checkUserAccess(
    token: string,
    userId: string
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    const response = await globalThis.fetch(
      `${this.VITE_API_URL}/api/users/check-access/${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || "Erreur lors de la vérification d'accès";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    return await response.json();
  }
}

export const userService = new UserService();
