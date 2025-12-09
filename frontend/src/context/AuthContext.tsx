import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

// ==================== INTERFACES TYPESCRIPT ====================
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  telephone?: string;
  isAdmin?: boolean;
}

enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
  iat: number;
}

interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isAdmin: boolean;
  };
  message?: string;
}

interface RegisterResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
  };
  message?: string;
}

interface LogoutAllResponse {
  success: boolean;
  message: string;
  stats: {
    usersLoggedOut: number;
    adminPreserved: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  access_token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  logoutAll: () => Promise<LogoutAllResponse>;
  register: (data: RegisterFormData) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ==================== CONSTANTS ====================
const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRATION_MS: 15 * 60 * 1000,
  PREVENTIVE_REFRESH_MS: 2 * 60 * 1000,
  MAX_SESSION_DURATION_MS: 30 * 60 * 1000,
  MAX_REFRESH_ATTEMPTS: 3,

  ERROR_MESSAGES: {
    PASSWORD_RESET_REQUIRED: 'PASSWORD RESET REQUIRED',
    COMPTE_DESACTIVE: 'COMPTE DESACTIVE',
    MAINTENANCE_MODE: 'MAINTENANCE MODE',
  } as const,
} as const;

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER_DATA: 'user_data',
  SESSION_START: 'session_start',
} as const;

// Chemins de redirection
const REDIRECT_PATHS = {
  LOGIN: '/connexion',
  HOME: '/',
  ADMIN_DASHBOARD: '/gestionnaire/statistiques',
} as const;

// Messages toast
const TOAST_MESSAGES = {
  LOGIN_SUCCESS: 'Connexion réussie !',
  LOGOUT_SUCCESS: 'Déconnexion réussie',
  REGISTER_SUCCESS: 'Inscription réussie !',
  PASSWORD_RESET_SUCCESS: 'Mot de passe réinitialisé avec succès !',
  SESSION_EXPIRED: 'Session expirée. Veuillez vous reconnecter.',
  LOGOUT_ALL_SUCCESS: 'Déconnexion globale réussie',
  FORGOT_PASSWORD_SUCCESS: 'Email de réinitialisation envoyé',
  INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
  ACCOUNT_DISABLED: "Votre compte est désactivé. Contactez l'administrateur.",
} as const;

// ==================== CONTEXT ====================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(() => {
    const stored = window.localStorage?.getItem(STORAGE_KEYS.USER_DATA);
    return stored ? JSON.parse(stored) : null;
  });

  const [access_token, setAccessToken] = useState<string | null>(
    window.localStorage?.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  );

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const VITE_API_URL = import.meta.env.VITE_API_URL as string;

  // ==================== FONCTIONS ESSENTIELLES ====================

  const cleanupAuthData = useCallback((): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
      window.localStorage?.removeItem(key);
    });

    setAccessToken(null);
    setUser(null);
    setError(null);

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
  }, []);

  const fetchUserData = useCallback(
    async (token: string): Promise<void> => {
      try {
        const response = await window.fetch(`${VITE_API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Erreur de récupération du profil');
        }

        const userData = await response.json();

        const mappedUser: User = {
          id: userData.id || userData._id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          isActive: userData.isActive !== false,
          telephone: userData.telephone,
          isAdmin: userData.role === UserRole.ADMIN,
        };

        setUser(mappedUser);
        window.localStorage?.setItem(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(mappedUser)
        );
      } catch (error) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.error('Erreur récupération utilisateur:', error);
        }
        throw error;
      }
    },
    [VITE_API_URL]
  );

  const checkAuth = useCallback(async (): Promise<void> => {
    const savedToken = window.localStorage?.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(savedToken);
      const isTokenExpired = decoded.exp * 1000 < Date.now();

      if (!isTokenExpired) {
        await fetchUserData(savedToken);
        setupTokenRefresh(decoded.exp);
      } else {
        cleanupAuthData();
      }
    } catch (error) {
      // Log only in development
      if (import.meta.env.DEV) {
        console.warn('Erreur vérification auth:', error);
      }
      cleanupAuthData();
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserData, cleanupAuthData]);

  const setupTokenRefresh = useCallback((exp: number): void => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const refreshTime =
      exp * 1000 - Date.now() - AUTH_CONSTANTS.PREVENTIVE_REFRESH_MS;

    if (refreshTime > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        logout();
        toast.info(TOAST_MESSAGES.SESSION_EXPIRED);
      }, refreshTime);
    }
  }, []);

  // ==================== MÉTHODES D'AUTHENTIFICATION ====================

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await window.fetch(`${VITE_API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });

        const data: LoginResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Erreur de connexion');
        }

        window.localStorage?.setItem(
          STORAGE_KEYS.ACCESS_TOKEN,
          data.access_token
        );
        setAccessToken(data.access_token);

        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          role: data.user.role,
          isActive: true,
          isAdmin: data.user.role === UserRole.ADMIN,
        };

        setUser(userData);
        window.localStorage?.setItem(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(userData)
        );
        window.localStorage?.setItem(
          STORAGE_KEYS.SESSION_START,
          Date.now().toString()
        );

        const decoded = jwtDecode<JwtPayload>(data.access_token);
        setupTokenRefresh(decoded.exp);

        // Redirection centralisée
        const redirectPath =
          data.user.role === UserRole.ADMIN
            ? REDIRECT_PATHS.ADMIN_DASHBOARD
            : REDIRECT_PATHS.HOME;

        navigate(redirectPath);
        toast.success(TOAST_MESSAGES.LOGIN_SUCCESS);
      } catch (err: any) {
        setError(err.message);
        toast.error(
          err.message.includes('incorrect')
            ? TOAST_MESSAGES.INVALID_CREDENTIALS
            : err.message
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [VITE_API_URL, setupTokenRefresh, navigate]
  );

  const register = useCallback(
    async (formData: RegisterFormData): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await window.fetch(
          `${VITE_API_URL}/api/auth/register`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              telephone: formData.phone,
              password: formData.password,
            }),
            credentials: 'include',
          }
        );

        const data: RegisterResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Erreur lors de l'inscription");
        }

        window.localStorage?.setItem(
          STORAGE_KEYS.ACCESS_TOKEN,
          data.access_token
        );
        setAccessToken(data.access_token);

        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          role: data.user.role,
          isActive: data.user.isActive,
          isAdmin: data.user.role === UserRole.ADMIN,
        };

        setUser(userData);
        window.localStorage?.setItem(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(userData)
        );
        window.localStorage?.setItem(
          STORAGE_KEYS.SESSION_START,
          Date.now().toString()
        );

        const decoded = jwtDecode<JwtPayload>(data.access_token);
        setupTokenRefresh(decoded.exp);

        // Même redirection que login
        const redirectPath =
          data.user.role === UserRole.ADMIN
            ? REDIRECT_PATHS.ADMIN_DASHBOARD
            : REDIRECT_PATHS.HOME;

        navigate(redirectPath);
        toast.success(TOAST_MESSAGES.REGISTER_SUCCESS);
      } catch (err: any) {
        setError(err.message);
        toast.error(
          err.message.includes('déjà utilisé')
            ? err.message
            : "Erreur lors de l'inscription"
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [VITE_API_URL, setupTokenRefresh, navigate]
  );

  const logout = useCallback((): void => {
    if (access_token) {
      window
        .fetch(`${VITE_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })
        .catch(error => {
          // Log only in development
          if (import.meta.env.DEV) {
            console.error('Erreur logout backend:', error);
          }
        });
    }

    cleanupAuthData();
    navigate(REDIRECT_PATHS.LOGIN);
    toast.info(TOAST_MESSAGES.LOGOUT_SUCCESS);
  }, [access_token, VITE_API_URL, cleanupAuthData, navigate]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const currentToken = window.localStorage?.getItem(
      STORAGE_KEYS.ACCESS_TOKEN
    );

    if (!currentToken) {
      // Log only in development
      if (import.meta.env.DEV) {
        console.log('❌ Pas de token à rafraîchir');
      }
      return false;
    }

    try {
      // Log only in development
      if (import.meta.env.DEV) {
        console.log('🔄 Tentative de rafraîchissement du token...');
      }

      const response = await window.fetch(`${VITE_API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        credentials: 'include',
      });

      // Gérer les erreurs d'authentification
      if (response.status === 401) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.log('❌ Refresh token expiré ou invalide');
        }
        logout();
        return false;
      }

      if (!response.ok) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.warn(`❌ Refresh échoué: ${response.status}`);
        }
        return false;
      }

      const data = await response.json();

      if (!data.access_token) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.error('❌ Pas de nouveau token reçu');
        }
        return false;
      }

      // Stocker le nouveau token
      window.localStorage?.setItem(
        STORAGE_KEYS.ACCESS_TOKEN,
        data.access_token
      );
      setAccessToken(data.access_token);

      // Rafraîchir les données utilisateur
      await fetchUserData(data.access_token);

      // Mettre à jour le timer de refresh
      try {
        const decoded = jwtDecode<JwtPayload>(data.access_token);
        setupTokenRefresh(decoded.exp);
      } catch (error) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.error('Erreur mise à jour timer:', error);
        }
      }

      // Log only in development
      if (import.meta.env.DEV) {
        console.log('✅ Token rafraîchi avec succès');
      }
      return true;
    } catch (error) {
      // Log only in development
      if (import.meta.env.DEV) {
        console.error('❌ Erreur lors du refresh:', error);
      }

      // En cas d'erreur réseau, on ne déconnecte pas immédiatement
      if (
        error instanceof TypeError &&
        error.message.includes('Failed to fetch')
      ) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.warn('🌐 Erreur réseau - le token actuel reste valable');
        }
        return false;
      }

      // Pour les autres erreurs, déconnecter
      logout();
      return false;
    }
  }, [VITE_API_URL, logout, fetchUserData, setupTokenRefresh]);

  const logoutAll = useCallback(async (): Promise<LogoutAllResponse> => {
    if (!access_token || user?.role !== UserRole.ADMIN) {
      throw new Error('Accès non autorisé - Admin seulement');
    }

    try {
      const response = await window.fetch(
        `${VITE_API_URL}/api/auth/logout-all`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      const data: LogoutAllResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Erreur lors de la déconnexion globale'
        );
      }

      toast.success(data.message);
      return data;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la déconnexion globale');
      throw err;
    }
  }, [access_token, user]);

  const forgotPassword = useCallback(
    async (email: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await window.fetch(
          `${VITE_API_URL}/api/auth/forgot-password`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || "Erreur lors de l'envoi de l'email");
        }

        toast.success(TOAST_MESSAGES.FORGOT_PASSWORD_SUCCESS);
        navigate(REDIRECT_PATHS.LOGIN);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Erreur lors de l'envoi de l'email");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [VITE_API_URL, navigate]
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        if (newPassword.length < 8) {
          throw new Error(
            'Le mot de passe doit contenir au moins 8 caractères'
          );
        }

        const response = await window.fetch(
          `${VITE_API_URL}/api/auth/reset-password`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              newPassword,
              confirmPassword: newPassword,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Erreur lors de la réinitialisation');
        }

        toast.success(TOAST_MESSAGES.PASSWORD_RESET_SUCCESS);
        navigate(REDIRECT_PATHS.LOGIN);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || 'Erreur lors de la réinitialisation');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [VITE_API_URL, navigate]
  );

  // ==================== EFFETS ====================

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async (): Promise<void> => {
      if (!isMounted) return;

      await checkAuth();

      if (isMounted) {
        // Vérification session toutes les 5 minutes
        sessionCheckIntervalRef.current = setInterval(
          () => {
            const sessionStart = window.localStorage?.getItem(
              STORAGE_KEYS.SESSION_START
            );
            if (sessionStart) {
              const sessionAge = Date.now() - parseInt(sessionStart);
              if (sessionAge > AUTH_CONSTANTS.MAX_SESSION_DURATION_MS) {
                logout();
                toast.info(TOAST_MESSAGES.SESSION_EXPIRED);
              }
            }
          },
          5 * 60 * 1000
        );
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [checkAuth, logout]);

  // ==================== VALEUR DU CONTEXT ====================

  const value: AuthContextType = {
    user,
    access_token,
    isAuthenticated: !!user && !!access_token,
    isLoading,
    error,
    login,
    logout,
    logoutAll,
    register,
    forgotPassword,
    resetPassword,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ==================== HOOKS ====================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
