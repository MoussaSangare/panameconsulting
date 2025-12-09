export interface User {
  _id: string;
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
  role: 'admin' | 'user';
}

export interface UpdateUserDto {
  email?: string;
  telephone?: string;
}

// Variables d'environnement compatibles SSR
const isBrowser = typeof window !== 'undefined';
const isServer = typeof window === 'undefined';

class AdminUserService {
  private token: string | null = null;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '';
    this.initializeToken();
  }

  private initializeToken(): void {
    try {
      // ✅ Récupérer le token depuis localStorage (comme dans AuthContext)
      if (isBrowser && window.localStorage) {
        this.token = window.localStorage.getItem('access_token');
      }

      // Vérifier aussi dans le document.cookie pour le refresh token
      if (!this.token && isBrowser) {
        // Utiliser import.meta.env.MODE pour vérifier l'environnement
        if (import.meta.env.DEV) {
          console.warn('Token non trouvé dans localStorage');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erreur accès localStorage:', error);
      }
    }
  }

  private async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // ✅ Vérifier et rafraîchir le token si nécessaire
    if (!this.token) {
      this.initializeToken();
    }

    if (!this.token) {
      throw new Error('Token non disponible - Veuillez vous reconnecter');
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include' as RequestCredentials,
    };

    // Utiliser fetch global (disponible dans Node 18+ et navigateurs)
    const response = await fetch(`${this.baseURL}${endpoint}`, requestOptions);

    // ✅ Gérer l'expiration du token
    if (response.status === 401) {
      if (import.meta.env.DEV) {
        console.log('Token expiré, tentative de rafraîchissement...');
      }

      // Essayer de rafraîchir le token via l'endpoint de refresh
      const refreshed = await this.attemptTokenRefresh();
      if (refreshed && this.token) {
        // Réessayer la requête avec le nouveau token
        requestOptions.headers = {
          ...requestOptions.headers,
          Authorization: `Bearer ${this.token}`,
        };
        return fetch(`${this.baseURL}${endpoint}`, requestOptions);
      } else {
        throw new Error('Session expirée - Veuillez vous reconnecter');
      }
    }

    return response;
  }

  private async attemptTokenRefresh(): Promise<boolean> {
    if (!isBrowser) return false;

    // Utiliser l'endpoint de refresh comme dans AuthContext
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important pour les cookies
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.logged_out || data.session_expired) {
        return false;
      }
      return false;
    }

    const data = await response.json();

    if (data.access_token) {
      if (isBrowser && window.localStorage) {
        window.localStorage.setItem('access_token', data.access_token);
      }
      this.token = data.access_token;
      return true;
    }

    return false;
  }

  // === MÉTHODES ADMIN UNIQUEMENT ===

  async getAllUsers(): Promise<User[]> {
    const response = await this.makeAuthenticatedRequest('/api/users');

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Vous n'avez pas les permissions administrateur");
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Erreur ${response.status} lors de la récupération des utilisateurs`
      );
    }

    const data = await response.json();
    return data.data || data || [];
  }

  async getUserStats(): Promise<UserStats> {
    const response = await this.makeAuthenticatedRequest('/api/users/stats');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || 'Erreur lors de la récupération des statistiques'
      );
    }

    return await response.json();
  }

  async createUser(userData: CreateUserDto): Promise<User> {
    const response = await this.makeAuthenticatedRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || "Erreur lors de la création de l'utilisateur"
      );
    }

    const data = await response.json();
    return data.data || data;
  }

  async updateUser(userId: string, userData: UpdateUserDto): Promise<User> {
    const response = await this.makeAuthenticatedRequest(
      `/api/users/${userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(userData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de la mise à jour');
    }

    return await response.json();
  }

  async adminResetPassword(
    userId: string,
    passwordData: { newPassword: string; confirmNewPassword: string }
  ): Promise<void> {
    // ✅ Changement de POST à PATCH
    const response = await this.makeAuthenticatedRequest(
      `/api/users/${userId}/admin-reset-password`,
      {
        method: 'PATCH',
        body: JSON.stringify(passwordData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          'Erreur lors de la réinitialisation du mot de passe'
      );
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest(
      `/api/users/${userId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Utilisateur non trouvé');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Erreur lors de la suppression');
    }
  }

  async toggleUserStatus(userId: string): Promise<User> {
    const response = await this.makeAuthenticatedRequest(
      `/api/users/${userId}/toggle-status`,
      {
        method: 'PATCH',
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Utilisateur non trouvé');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || 'Erreur lors du changement de statut'
      );
    }

    const data = await response.json();
    return data;
  }

  // === MÉTHODES UTILITAIRES ===

  setToken(token: string): void {
    this.token = token;
    if (isBrowser && window.localStorage) {
      window.localStorage.setItem('access_token', token);
    }
  }

  clearToken(): void {
    this.token = null;
    try {
      if (isBrowser && window.localStorage) {
        window.localStorage.removeItem('access_token');
        window.localStorage.removeItem('refresh_token');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erreur suppression token localStorage:', error);
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }
}

// Hook personnalisé pour utiliser le service
export const useAdminUserService = () => {
  return new AdminUserService();
};

export default AdminUserService;
