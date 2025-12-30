// userProfileApi.ts - SERVICE FRONTEND COMPLET ET SÉCURISÉ
import { toast } from 'react-toastify';

// ==================== INTERFACES ====================
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

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

export interface PasswordUpdateData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Interface pour les fonctions d'authentification du contexte
export interface AuthContextFunctions {
  fetchWithAuth: (endpoint: string, options?: RequestInit) => Promise<Response>;
  refreshToken: () => Promise<boolean>;
  access_token: string | null;
}

// ==================== CONSTANTS ====================
const API_ENDPOINTS = {
  PROFILE_ME: '/api/users/profile/me',
  AUTH_ME: '/api/auth/me',
  UPDATE_PASSWORD: '/api/auth/update-password',
  FORGOT_PASSWORD: '/api/auth/forgot-password',
  RESET_PASSWORD: '/api/auth/reset-password',
} as const;

const ERROR_MESSAGES = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_DATA: 'Données invalides',
  NETWORK_ERROR: 'Erreur réseau. Vérifiez votre connexion.',
  UNKNOWN_ERROR: 'Une erreur est survenue',
  PROFILE_UPDATE_SUCCESS: 'Profil mis à jour avec succès',
  PASSWORD_UPDATE_SUCCESS: 'Mot de passe changé avec succès',
  FORGOT_PASSWORD_SUCCESS: 'Si votre email est enregistré, vous recevrez un lien de réinitialisation',
} as const;

// ==================== SERVICE PRINCIPAL ====================
class UserProfileService {
  /**
   * Récupérer le profil de l'utilisateur connecté
   * Utilise fetchWithAuth du contexte
   */
  static async getCurrentUser(authFunctions: AuthContextFunctions): Promise<User | null> {
    try {
      const response = await authFunctions.fetchWithAuth(API_ENDPOINTS.AUTH_ME);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          console.warn('Session expirée détectée');
          return null;
        }

        const errorMessage = errorData.message || ERROR_MESSAGES.UNKNOWN_ERROR;
        toast.error(errorMessage);
        return null;
      }

      const userData = await response.json();

      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        telephone: userData.telephone,
        isActive: userData.isActive !== false,
        isAdmin: userData.role === UserRole.ADMIN,
        logoutUntil: userData.logoutUntil,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      };

      return user;

    } catch (error: any) {
      console.error('Erreur lors de la récupération du profil:', error);
      
      if (error.message !== ERROR_MESSAGES.SESSION_EXPIRED) {
        toast.error(ERROR_MESSAGES.NETWORK_ERROR);
      }
      
      return null;
    }
  }

  /**
   * Mettre à jour le profil utilisateur
   */
  static async updateProfile(
    authFunctions: AuthContextFunctions,
    updateData: UserUpdateData
  ): Promise<User> {
    try {
      // Validation des données
      const hasEmail = updateData.email !== undefined && updateData.email.trim() !== '';
      const hasTelephone = updateData.telephone !== undefined;
      
      if (!hasEmail && !hasTelephone) {
        const errorMessage = 'Au moins un champ (email ou téléphone) doit être fourni';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Préparer les données
      const requestData: any = {};
      
      if (hasEmail) {
        requestData.email = updateData.email!.trim();
      }
      
      if (hasTelephone) {
        requestData.telephone = updateData.telephone!.trim();
      }

      const response = await authFunctions.fetchWithAuth(API_ENDPOINTS.PROFILE_ME, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error('Erreur lors du parsing de la réponse:', errorText);
        }
        
        const errorMessage = errorData?.message || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Rafraîchir le token si nécessaire
      await authFunctions.refreshToken();
      
      toast.success(ERROR_MESSAGES.PROFILE_UPDATE_SUCCESS);

      return {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        telephone: result.telephone,
        isActive: result.isActive !== false,
        isAdmin: result.role === UserRole.ADMIN,
      };
    } catch (error: any) {
      console.error('Erreur updateProfile:', error);
      
      if (error.message !== ERROR_MESSAGES.SESSION_EXPIRED) {
        toast.error(error.message || ERROR_MESSAGES.UNKNOWN_ERROR);
      }
      
      throw error;
    }
  }

  /**
   * Met à jour le mot de passe de l'utilisateur
   */
  static async updatePassword(
    authFunctions: AuthContextFunctions,
    passwordData: PasswordUpdateData
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validation côté client
      if (passwordData.newPassword !== passwordData.confirmNewPassword) {
        const errorMessage = 'Les nouveaux mots de passe ne correspondent pas';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      if (passwordData.newPassword.length < 8) {
        const errorMessage = 'Le mot de passe doit contenir au moins 8 caractères';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Validation de complexité
      const hasLowerCase = /[a-z]/.test(passwordData.newPassword);
      const hasUpperCase = /[A-Z]/.test(passwordData.newPassword);
      const hasNumber = /[0-9]/.test(passwordData.newPassword);

      if (!hasLowerCase || !hasUpperCase || !hasNumber) {
        const errorMessage = 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const response = await authFunctions.fetchWithAuth(API_ENDPOINTS.UPDATE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          confirmNewPassword: passwordData.confirmNewPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      // Rafraîchir le token après changement de mot de passe
      await authFunctions.refreshToken();
      
      toast.success(ERROR_MESSAGES.PASSWORD_UPDATE_SUCCESS);
      
      return {
        success: true,
        message: ERROR_MESSAGES.PASSWORD_UPDATE_SUCCESS,
      };
    } catch (error: any) {
      console.error('Erreur updatePassword:', error);
      
      if (error.message !== ERROR_MESSAGES.SESSION_EXPIRED) {
        toast.error(error.message || ERROR_MESSAGES.UNKNOWN_ERROR);
      }
      
      throw error;
    }
  }

  /**
   * Réinitialisation du mot de passe (oubli de mot de passe)
   */
  static async forgotPassword(email: string): Promise<void> {
    try {
      const VITE_API_URL = import.meta.env.VITE_API_URL;
      
      // Validation de l'email
      if (!email || email.trim() === '') {
        toast.error('Veuillez entrer une adresse email');
        throw new Error('Email requis');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Format d\'email invalide');
        throw new Error('Email invalide');
      }

      const response = await window.fetch(
        `${VITE_API_URL}${API_ENDPOINTS.FORGOT_PASSWORD}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || "Erreur lors de l'envoi de l'email";
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      toast.success(ERROR_MESSAGES.FORGOT_PASSWORD_SUCCESS);
    } catch (error: any) {
      console.error('Erreur forgotPassword:', error);
      
      // Ne pas afficher de toast si c'est déjà fait
      if (!error.message.includes('Email')) {
        toast.error(error.message || "Erreur lors de l'envoi de l'email de réinitialisation");
      }
      
      throw error;
    }
  }

  /**
   * Réinitialisation du mot de passe avec token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Validation
      if (!token || token.trim() === '') {
        toast.error('Token de réinitialisation invalide');
        throw new Error('Token invalide');
      }

      if (newPassword.length < 8) {
        toast.error('Le mot de passe doit contenir au moins 8 caractères');
        throw new Error('Mot de passe trop court');
      }

      // Validation de complexité
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);

      if (!hasLowerCase || !hasUpperCase || !hasNumber) {
        toast.error('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre');
        throw new Error('Mot de passe invalide');
      }

      const VITE_API_URL = import.meta.env.VITE_API_URL ;
      const response = await window.fetch(
        `${VITE_API_URL}${API_ENDPOINTS.RESET_PASSWORD}`,
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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Erreur lors de la réinitialisation';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      toast.success('Mot de passe réinitialisé avec succès');
    } catch (error: any) {
      console.error('Erreur resetPassword:', error);
      
      // Ne pas afficher de toast si c'est déjà fait
      if (!error.message.includes('Mot de passe') && !error.message.includes('Token')) {
        toast.error(error.message || 'Erreur lors de la réinitialisation du mot de passe');
      }
      
      throw error;
    }
  }

  /**
   * Valider un email
   */
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    if (!email || email.trim() === '') {
      return { isValid: false, error: 'L\'email est requis' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    return {
      isValid,
      error: isValid ? undefined : 'Format d\'email invalide'
    };
  }

  /**
   * Valider un téléphone
   */
  static validateTelephone(telephone: string): { isValid: boolean; error?: string } {
    if (!telephone || telephone.trim() === '') {
      return { isValid: true }; // Téléphone optionnel
    }
    
    const phoneRegex = /^[+]?[0-9\s\-\(\)\.]{8,20}$/;
    const cleanedPhone = telephone.replace(/[\s\-\(\)\.]/g, '');
    const hasMinDigits = cleanedPhone.length >= 8;
    
    const isValid = phoneRegex.test(telephone) && hasMinDigits;
    
    return {
      isValid,
      error: isValid ? undefined : 'Format invalide (minimum 8 chiffres)'
    };
  }

  /**
   * Valider un mot de passe
   */
  static validatePassword(password: string, confirmPassword?: string): {
    isValid: boolean;
    errors: string[];
    validation: {
      hasMinLength: boolean;
      hasLowerCase: boolean;
      hasUpperCase: boolean;
      hasNumber: boolean;
      passwordsMatch: boolean;
    };
  } {
    const validation = {
      hasMinLength: password.length >= 8,
      hasLowerCase: /[a-z]/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      passwordsMatch: confirmPassword ? password === confirmPassword : true,
    };

    const errors: string[] = [];
    
    if (!validation.hasMinLength) errors.push('Minimum 8 caractères');
    if (!validation.hasLowerCase) errors.push('Une lettre minuscule');
    if (!validation.hasUpperCase) errors.push('Une lettre majuscule');
    if (!validation.hasNumber) errors.push('Un chiffre');
    if (confirmPassword && !validation.passwordsMatch) errors.push('Les mots de passe doivent correspondre');

    return {
      isValid: Object.values(validation).every(v => v),
      errors,
      validation,
    };
  }
}

// ==================== UTILITAIRE POUR LE PROFIL ====================
export class ProfileUtils {
  /**
   * Formater un numéro de téléphone pour l'affichage
   */
  static formatPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    
    // Retirer tous les caractères non numériques
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      // Format français: 06 12 34 56 78
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    } else if (cleaned.length > 10 && cleaned.startsWith('33')) {
      // Format international français: +33 6 12 34 56 78
      const mobile = cleaned.substring(2);
      if (mobile.length === 9) {
        return `+33 ${mobile.substring(0, 1)} ${mobile.substring(1, 3)} ${mobile.substring(3, 5)} ${mobile.substring(5, 7)} ${mobile.substring(7, 9)}`;
      }
    }
    
    return phoneNumber;
  }

  /**
   * Masquer partiellement un email pour l'affichage
   */
  static maskEmailForDisplay(email: string): string {
    if (!email || typeof email !== 'string') return '•••@•••';
    
    const [name, domain] = email.split('@');
    if (!name || !domain) return '•••@•••';
    
    if (name.length <= 2) {
      return `${name.charAt(0)}•@${domain.charAt(0)}••`;
    }
    
    const maskedName = `${name.charAt(0)}•••${name.charAt(name.length - 1)}`;
    const domainParts = domain.split('.');
    
    if (domainParts.length >= 2) {
      const maskedDomain = `${domainParts[0].charAt(0)}••.${domainParts.slice(-1)[0]}`;
      return `${maskedName}@${maskedDomain}`;
    }
    
    return `${maskedName}@${domain.charAt(0)}••`;
  }

  /**
   * Vérifier si un utilisateur peut modifier son profil
   */
  static canUserUpdateProfile(user: User | null): boolean {
    if (!user) return false;
    
    // L'utilisateur doit être actif
    if (!user.isActive) return false;
    
    // Vérifier si l'utilisateur est temporairement déconnecté
    if (user.logoutUntil) {
      const logoutUntil = new Date(user.logoutUntil);
      if (logoutUntil > new Date()) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Obtenir le message d'état du compte
   */
  static getAccountStatusMessage(user: User | null): { message: string; type: 'success' | 'warning' | 'error' } {
    if (!user) {
      return { message: 'Compte non disponible', type: 'error' };
    }
    
    if (!user.isActive) {
      return { message: 'Compte désactivé', type: 'error' };
    }
    
    if (user.logoutUntil) {
      const logoutUntil = new Date(user.logoutUntil);
      if (logoutUntil > new Date()) {
        const remainingHours = Math.ceil((logoutUntil.getTime() - Date.now()) / (1000 * 60 * 60));
        return { 
          message: `Déconnexion temporaire (reste ${remainingHours}h)`, 
          type: 'warning' 
        };
      }
    }
    
    return { message: 'Compte actif', type: 'success' };
  }
}

// ==================== HOOK PERSONNALISÉ ====================
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

export const useUserProfile = () => {
  const { fetchWithAuth, access_token, refreshToken, user: contextUser } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!access_token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authFunctions: AuthContextFunctions = {
        fetchWithAuth,
        refreshToken,
        access_token,
      };
      
      const profile = await UserProfileService.getCurrentUser(authFunctions);
      setUser(profile);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, access_token, refreshToken]);

  const updateProfile = useCallback(async (updateData: UserUpdateData): Promise<User> => {
    const authFunctions: AuthContextFunctions = {
      fetchWithAuth,
      refreshToken,
      access_token,
    };
    
    const updatedUser = await UserProfileService.updateProfile(authFunctions, updateData);
    setUser(updatedUser);
    return updatedUser;
  }, [fetchWithAuth, access_token, refreshToken]);

  const updatePassword = useCallback(async (passwordData: PasswordUpdateData): Promise<{ success: boolean; message: string }> => {
    const authFunctions: AuthContextFunctions = {
      fetchWithAuth,
      refreshToken,
      access_token,
    };
    
    return await UserProfileService.updatePassword(authFunctions, passwordData);
  }, [fetchWithAuth, access_token, refreshToken]);

  // Synchroniser avec le contexte
  useEffect(() => {
    if (contextUser && !user) {
      setUser({
        id: contextUser.id,
        email: contextUser.email,
        firstName: contextUser.firstName,
        lastName: contextUser.lastName,
        role: contextUser.role,
        telephone: contextUser.telephone,
        isActive: contextUser.isActive,
        isAdmin: contextUser.isAdmin,
      });
    }
  }, [contextUser, user]);

  // Charger au montage
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    user,
    loading,
    error,
    refetchProfile: fetchProfile,
    updateProfile,
    updatePassword,
    canUpdate: ProfileUtils.canUserUpdateProfile(user),
    accountStatus: ProfileUtils.getAccountStatusMessage(user),
  };
};

// ==================== EXPORT POUR UTILISATION DIRECTE ====================
export const userProfileService = UserProfileService;
export const profileUtils = ProfileUtils;