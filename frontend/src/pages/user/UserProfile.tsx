import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { UserHeader, usePageConfig } from '../../components/user/UserHeader';
import { useAuth } from '../../context/AuthContext';
import { userProfileService, UserUpdateData} from '../../api/user/Profile/userProfileApi';
import { Loader2, Mail, Phone, Shield, User, UserCheck, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

const UserProfile = () => {
  const { user, fetchWithAuth, refreshToken, access_token } = useAuth();
  const pageConfig = usePageConfig();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // États pour les informations du profil
  const [profileData, setProfileData] = useState({
    email: '',
    telephone: '',
  });
  
  // États pour le mot de passe
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  
  // États pour afficher/masquer les mots de passe
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // États pour la validation
  const [emailError, setEmailError] = useState('');
  const [telephoneError, setTelephoneError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  
  // États pour la validation en temps réel du mot de passe
  const [passwordValidation, setPasswordValidation] = useState({
    hasMinLength: false,
    hasLowerCase: false,
    hasUpperCase: false,
    hasNumber: false,
    passwordsMatch: false,
  });

  // Référence pour éviter les chargements multiples
  const isInitialLoad = useRef(false);
  const hasLoadedProfile = useRef(false);

  // Validation de l'email
  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') {
      setEmailError('L\'email ne peut pas être vide');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    setEmailError(isValid ? '' : 'Format d\'email invalide');
    return isValid;
  };

  // Validation du téléphone
  const validateTelephone = (telephone: string): boolean => {
    if (!telephone || telephone.trim() === '') {
      setTelephoneError('');
      return true;
    }
    
    const phoneRegex = /^[+]?[0-9\s\-\(\)\.]{8,20}$/;
    const cleanedPhone = telephone.replace(/[\s\-\(\)\.]/g, '');
    const hasMinDigits = cleanedPhone.length >= 8;
    
    const isValid = phoneRegex.test(telephone) && hasMinDigits;
    setTelephoneError(isValid ? '' : 'Format invalide (minimum 8 chiffres)');
    return isValid;
  };

  // Validation du mot de passe en temps réel
  const validatePasswordInRealTime = useCallback(() => {
    const validations = {
      hasMinLength: passwordData.newPassword.length >= 8,
      hasLowerCase: /[a-z]/.test(passwordData.newPassword),
      hasUpperCase: /[A-Z]/.test(passwordData.newPassword),
      hasNumber: /[0-9]/.test(passwordData.newPassword),
      passwordsMatch: passwordData.newPassword === passwordData.confirmNewPassword && passwordData.newPassword.length > 0,
    };
    
    setPasswordValidation(validations);
    
    const errors: string[] = [];
    if (!validations.hasMinLength) errors.push('Minimum 8 caractères');
    if (!validations.hasLowerCase) errors.push('Une minuscule');
    if (!validations.hasUpperCase) errors.push('Une majuscule');
    if (!validations.hasNumber) errors.push('Un chiffre');
    if (!validations.passwordsMatch) errors.push('Les mots de passe doivent correspondre');
    
    setPasswordErrors(errors);
    
    return Object.values(validations).every(v => v);
  }, [passwordData.newPassword, passwordData.confirmNewPassword]);

  // Effet pour valider le mot de passe en temps réel
  useEffect(() => {
    if (passwordData.newPassword || passwordData.confirmNewPassword) {
      validatePasswordInRealTime();
    }
  }, [passwordData.newPassword, passwordData.confirmNewPassword, validatePasswordInRealTime]);

  // Charger les données du profil UNE SEULE FOIS
  const loadUserProfile = useCallback(async () => {
    if (isLoading || hasLoadedProfile.current) return;
    
    setIsLoading(true);
    try {
      const userData = await userProfileService.getCurrentUser({
        fetchWithAuth,
        refreshToken,
        access_token,
      });
      
      if (userData) {
        setProfileData({
          email: userData.email || '',
          telephone: userData.telephone || '',
        });
        hasLoadedProfile.current = true;
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      
      if (user) {
        setProfileData({
          email: user.email || '',
          telephone: user.telephone || '',
        });
        hasLoadedProfile.current = true;
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, refreshToken, access_token, user, isLoading]);

  // Rafraîchir les données MANUELLEMENT seulement
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      hasLoadedProfile.current = false;
      await loadUserProfile();
      toast.success('Profil actualisé');
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      toast.error('Erreur lors du rafraîchissement');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadUserProfile, isRefreshing]);

  // Gérer la soumission du profil
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation des champs
    const isEmailValid = validateEmail(profileData.email);
    const isPhoneValid = validateTelephone(profileData.telephone);
    
    if (!isEmailValid || !isPhoneValid) {
      toast.error('Veuillez corriger les erreurs avant de soumettre');
      return;
    }

    // Vérifier si des modifications ont été apportées
    const hasEmailChanged = profileData.email !== user?.email;
    const hasTelephoneChanged = profileData.telephone !== user?.telephone;
    
    if (!hasEmailChanged && !hasTelephoneChanged) {
      toast.info('Aucune modification à enregistrer');
      return;
    }

    setIsLoading(true);
    
    try {
      const updateData: UserUpdateData = {};
      
      if (hasEmailChanged && profileData.email.trim() !== '') {
        updateData.email = profileData.email.trim();
      }
      
      if (hasTelephoneChanged) {
        updateData.telephone = profileData.telephone.trim();
      }

      await userProfileService.updateProfile(
        { fetchWithAuth, refreshToken, access_token },
        updateData
      );
      
      // Rafraîchir seulement après une mise à jour réussie
      hasLoadedProfile.current = false;
      await loadUserProfile();
      
      toast.success('Profil mis à jour avec succès');
      
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      if (error.message !== 'SESSION_EXPIRED') {
        toast.error(error.message || 'Erreur lors de la mise à jour du profil');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Gérer la soumission du mot de passe
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!passwordData.currentPassword || passwordData.currentPassword.trim() === '') {
      toast.error('Le mot de passe actuel est requis');
      return;
    }
    
    const isPasswordValid = validatePasswordInRealTime();
    if (!isPasswordValid) {
      toast.error('Veuillez corriger les erreurs du mot de passe');
      return;
    }

    setIsUpdatingPassword(true);
    
    try {
      await userProfileService.updatePassword(
        { fetchWithAuth, refreshToken, access_token },
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          confirmNewPassword: passwordData.confirmNewPassword,
        }
      );
      
      // Réinitialiser le formulaire
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      
      setPasswordValidation({
        hasMinLength: false,
        hasLowerCase: false,
        hasUpperCase: false,
        hasNumber: false,
        passwordsMatch: false,
      });
      
      setPasswordErrors([]);
      
      toast.success('Mot de passe changé avec succès');
      
    } catch (error: any) {
      console.error('Erreur lors du changement de mot de passe:', error);
      if (error.message !== 'SESSION_EXPIRED') {
        toast.error(error.message || 'Erreur lors du changement de mot de passe');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Effet initial - charger les données UNE SEULE FOIS
  useEffect(() => {
    if (!isInitialLoad.current && user && !hasLoadedProfile.current) {
      isInitialLoad.current = true;
      loadUserProfile();
    }
  }, [user, loadUserProfile]);

  // Synchroniser avec les données du contexte (sans appel API supplémentaire)
  useEffect(() => {
    if (user && !hasLoadedProfile.current) {
      setProfileData({
        email: user.email || '',
        telephone: user.telephone || '',
      });
      hasLoadedProfile.current = true;
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white pt-16 pb-8">
      <UserHeader
        title={pageConfig.title}
        subtitle={pageConfig.subtitle}
        pageTitle={pageConfig.pageTitle}
        description={pageConfig.description}
        isLoading={isRefreshing}
        onRefresh={handleRefresh}
      />

      <div className="px-4 max-w-4xl mx-auto mt-16 space-y-6">
        {/* Section Informations personnelles */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-sky-600" />
              Informations personnelles
            </h2>

            {isLoading && !profileData.email ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                {/* Nom complet (lecture seule) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Nom complet
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <p className="text-xs text-gray-500">
                    Le nom complet ne peut pas être modifié ici
                  </p>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Mail className="w-4 h-4" />
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => {
                      setProfileData({ ...profileData, email: e.target.value });
                      if (e.target.value !== user?.email) {
                        validateEmail(e.target.value);
                      }
                    }}
                    onBlur={() => validateEmail(profileData.email)}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      emailError ? 'border-red-300' : 'border-gray-300'
                    } focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all`}
                    placeholder="votre@email.com"
                    required
                  />
                  {emailError && (
                    <p className="text-sm text-red-600">{emailError}</p>
                  )}
                </div>

                {/* Téléphone */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Phone className="w-4 h-4" />
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={profileData.telephone}
                    onChange={(e) => {
                      setProfileData({ ...profileData, telephone: e.target.value });
                      if (e.target.value !== user?.telephone) {
                        validateTelephone(e.target.value);
                      }
                    }}
                    onBlur={() => validateTelephone(profileData.telephone)}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      telephoneError ? 'border-red-300' : 'border-gray-300'
                    } focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all`}
                    placeholder="0612345678"
                  />
                  {telephoneError ? (
                    <p className="text-sm text-red-600">{telephoneError}</p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Format: 0612345678 ou +33612345678
                    </p>
                  )}
                </div>

                {/* Bouton de soumission */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-linear-to-r from-sky-500 to-sky-600 text-white font-medium rounded-xl hover:from-sky-600 hover:to-sky-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enregistrement...
                    </span>
                  ) : (
                    'Mettre à jour mon profil'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Section Changement de mot de passe */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-sky-600" />
              Changement de mot de passe
            </h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              {/* Mot de passe actuel */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value
                    })}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
                    placeholder="Entrez votre mot de passe actuel"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Nouveau mot de passe */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value
                    })}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
                    placeholder="Entrez votre nouveau mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmation du nouveau mot de passe */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmNewPassword}
                    onChange={(e) => setPasswordData({
                      ...passwordData,
                      confirmNewPassword: e.target.value
                    })}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
                    placeholder="Confirmez votre nouveau mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Validation du mot de passe */}
              {passwordData.newPassword && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-700">
                    Votre mot de passe doit contenir :
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasMinLength ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${passwordValidation.hasMinLength ? 'text-green-600' : 'text-gray-600'}`}>
                        Minimum 8 caractères
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasLowerCase ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-gray-600'}`}>
                        Au moins une lettre minuscule
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasUpperCase ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-gray-600'}`}>
                        Au moins une lettre majuscule
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasNumber ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-600'}`}>
                        Au moins un chiffre
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.passwordsMatch ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${passwordValidation.passwordsMatch ? 'text-green-600' : 'text-gray-600'}`}>
                        Les mots de passe correspondent
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bouton de soumission */}
              <button
                type="submit"
                disabled={isUpdatingPassword || passwordErrors.length > 0 || !passwordData.currentPassword}
                className="w-full py-3 px-4 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isUpdatingPassword ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Changement en cours...
                  </span>
                ) : (
                  'Changer mon mot de passe'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Section Informations de sécurité */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-600" />
              Sécurité du compte
            </h2>

            <div className="space-y-4">
              {/* Statut du compte */}
              <div className="flex items-center justify-between p-4 bg-linear-to-r from-sky-50 to-blue-50 rounded-xl border border-sky-100">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    user?.isActive ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">Statut du compte</p>
                    <p className="text-sm text-gray-600">
                      {user?.isActive ? 'Actif' : 'Inactif'}
                    </p>
                  </div>
                </div>
                <UserCheck className="w-5 h-5 text-sky-600" />
              </div>

            </div>

            {/* Conseils de sécurité */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">Conseils de sécurité</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 shrink-0" />
                  <span className="text-sm text-gray-600">
                    Utilisez des mots de passe uniques et complexes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 shrink-0" />
                  <span className="text-sm text-gray-600">
                    Ne partagez jamais vos identifiants de connexion
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 shrink-0" />
                  <span className="text-sm text-gray-600">
                    Déconnectez-vous des appareils publics après utilisation
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-2 shrink-0" />
                  <span className="text-sm text-gray-600">
                    Activez l'authentification à deux facteurs si disponible
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;