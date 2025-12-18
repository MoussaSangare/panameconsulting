import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    newPassword: false,
    confirmPassword: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  }>({
    text: '',
    type: 'success',
  });
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    // ✅ SUPPRIMÉ: Caractère spécial NON REQUIS par le backend
    // hasSpecialChar: false,
  });

  useEffect(() => {
    if (!token) {
      setMessage({
        text: 'Token invalide ou manquant',
        type: 'error',
      });
    }
  }, [token]);

  useEffect(() => {
    checkPasswordStrength(formData.newPassword);
  }, [formData.newPassword]);

  const checkPasswordStrength = (password: string) => {
    // ✅ SYNCHRONISÉ AVEC BACKEND (update-password.dto.ts, reset-password.dto.ts)
    // Backend: (?=.*[a-z])(?=.*[A-Z])(?=.*\d) - Pas de caractère spécial requis
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      // ✅ SUPPRIMÉ: Pas de caractère spécial requis
      // hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  };

  // ✅ CORRECT: Validation synchronisée avec backend
  const isPasswordValid = 
    passwordStrength.hasMinLength &&
    passwordStrength.hasUpperCase &&
    passwordStrength.hasLowerCase &&
    passwordStrength.hasNumber;
    // ✅ SUPPRIMÉ: Pas de caractère spécial requis
    // && passwordStrength.hasSpecialChar;

  const canSubmit =
    isPasswordValid && 
    formData.newPassword === formData.confirmPassword &&
    formData.newPassword.length > 0;

  const togglePasswordVisibility = (field: keyof typeof showPassword) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setMessage({
        text: 'Token invalide ou manquant',
        type: 'error',
      });
      return;
    }

    if (!canSubmit) {
      setMessage({
        text: 'Veuillez corriger les erreurs dans le formulaire',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: 'success' });

    try {
      await resetPassword(token, formData.newPassword);

      setMessage({
        text: 'Mot de passe réinitialisé avec succès ! Redirection...',
        type: 'success',
      });

      setTimeout(() => navigate('/connexion'), 3000);
    } catch (error: any) {
      // ✅ Gestion des erreurs synchronisée avec backend
      let errorMessage = error.message || 'Erreur lors de la réinitialisation';
      
      if (errorMessage.includes('Token invalide ou expiré')) {
        errorMessage = 'Le lien de réinitialisation a expiré ou est invalide. Veuillez en demander un nouveau.';
      } else if (errorMessage.includes('Utilisateur non trouvé')) {
        errorMessage = 'Le compte associé à ce lien n\'existe plus.';
      } else if (errorMessage.includes('Le mot de passe doit contenir au moins 8 caractères')) {
        errorMessage = 'Le mot de passe doit contenir au moins 8 caractères, avec au moins une majuscule, une minuscule et un chiffre.';
      } else if (errorMessage.includes('Les mots de passe ne correspondent pas')) {
        errorMessage = 'Les mots de passe ne correspondent pas.';
      } else if (errorMessage.includes('minuscule, majuscule et chiffre')) {
        errorMessage = 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre.';
      }

      setMessage({
        text: errorMessage,
        type: 'error',
      });
      
      // Log seulement en développement
      if (import.meta.env.DEV) {
        console.error('Erreur réinitialisation:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  interface PasswordRequirementProps {
    met: boolean;
    text: string;
  }

  const PasswordRequirement: React.FC<PasswordRequirementProps> = ({
    met,
    text,
  }) => (
    <div className='flex items-center gap-2 text-sm'>
      {met ? (
        <CheckCircle className='w-4 h-4 text-green-500' />
      ) : (
        <XCircle className='w-4 h-4 text-gray-400' />
      )}
      <span className={met ? 'text-green-600' : 'text-gray-500'}>{text}</span>
    </div>
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center p-4'>
      <div className='max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden'>
        {/* Header */}
        <div className='bg-gradient-to-r from-sky-500 to-sky-600 p-6 text-white text-center'>
          <div className='w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Lock className='w-8 h-8' />
          </div>
          <h1 className='text-2xl font-bold'>Nouveau mot de passe</h1>
          <p className='text-sky-100 mt-2'>
            Choisissez un mot de passe sécurisé
          </p>
        </div>

        {/* Form */}
        <div className='p-6'>
          {message.text && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              <div className='flex items-center gap-2'>
                {message.type === 'success' ? (
                  <CheckCircle className='w-5 h-5' />
                ) : (
                  <XCircle className='w-5 h-5' />
                )}
                <span className='font-medium'>{message.text}</span>
              </div>
            </div>
          )}

          {token ? (
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* New Password */}
              <div>
                <label
                  htmlFor='newPassword'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Nouveau mot de passe
                </label>
                <div className='relative'>
                  <input
                    id='newPassword'
                    name='newPassword'
                    type={showPassword.newPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    placeholder='Entrez votre nouveau mot de passe'
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-500/50 focus:outline-none transition-colors duration-200'
                    aria-describedby='passwordRequirements'
                    required
                    minLength={8}
                    autoComplete='new-password'
                  />
                  <button
                    type='button'
                    onClick={() => togglePasswordVisibility('newPassword')}
                    className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-sky-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded'
                    aria-label={
                      showPassword.newPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showPassword.newPassword ? (
                      <EyeOff className='w-5 h-5' />
                    ) : (
                      <Eye className='w-5 h-5' />
                    )}
                  </button>
                </div>

                {/* Password Requirements */}
                {formData.newPassword && (
                  <div
                    id='passwordRequirements'
                    className='mt-3 p-4 bg-gray-50 rounded-lg space-y-2'
                  >
                    <p className='text-sm font-medium text-gray-700 mb-2'>
                      ✅ Exigences de sécurité (synchronisées avec le serveur):
                    </p>
                    <PasswordRequirement
                      met={passwordStrength.hasMinLength}
                      text='Au moins 8 caractères'
                    />
                    <PasswordRequirement
                      met={passwordStrength.hasUpperCase}
                      text='Au moins une lettre majuscule (A-Z)'
                    />
                    <PasswordRequirement
                      met={passwordStrength.hasLowerCase}
                      text='Au moins une lettre minuscule (a-z)'
                    />
                    <PasswordRequirement
                      met={passwordStrength.hasNumber}
                      text='Au moins un chiffre (0-9)'
                    />
                    {/* ✅ SUPPRIMÉ: Caractère spécial non requis
                    <PasswordRequirement
                      met={passwordStrength.hasSpecialChar}
                      text='Au moins un caractère spécial (!@#$%^&*)'
                    /> */}
                    <p className='text-xs text-gray-500 pt-2 border-t border-gray-200 mt-2'>
                      Ces critères correspondent exactement à la validation du serveur.
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor='confirmPassword'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Confirmer le mot de passe
                </label>
                <div className='relative'>
                  <input
                    id='confirmPassword'
                    name='confirmPassword'
                    type={showPassword.confirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    placeholder='Confirmez votre nouveau mot de passe'
                    className={`w-full px-4 py-3 border rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-500/50 focus:outline-none transition-colors duration-200 ${
                      formData.confirmPassword &&
                      formData.newPassword !== formData.confirmPassword
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    required
                    minLength={8}
                    autoComplete='new-password'
                  />
                  <button
                    type='button'
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                    className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-sky-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded'
                    aria-label={
                      showPassword.confirmPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showPassword.confirmPassword ? (
                      <EyeOff className='w-5 h-5' />
                    ) : (
                      <Eye className='w-5 h-5' />
                    )}
                  </button>
                </div>
                {formData.confirmPassword &&
                  formData.newPassword !== formData.confirmPassword && (
                    <p className='mt-2 text-sm text-red-600 flex items-center gap-1'>
                      <XCircle className='w-4 h-4' />
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                {formData.confirmPassword &&
                  formData.newPassword === formData.confirmPassword &&
                  isPasswordValid && (
                    <p className='mt-2 text-sm text-green-600 flex items-center gap-1'>
                      <CheckCircle className='w-4 h-4' />
                      Les mots de passe correspondent et respectent les critères de sécurité
                    </p>
                  )}
              </div>

              {/* Submit Button */}
              <button
                type='submit'
                disabled={!canSubmit || loading}
                className={`w-full bg-gradient-to-r from-sky-500 to-sky-600 text-white py-3 px-4 rounded-lg font-medium hover:from-sky-600 hover:to-sky-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
                  canSubmit && !loading ? 'hover:shadow-md' : ''
                }`}
              >
                {loading ? (
                  <>
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                    Réinitialisation...
                  </>
                ) : (
                  <>
                    <Lock className='w-5 h-5' />
                    Réinitialiser le mot de passe
                  </>
                )}
              </button>
              
              {/* Aide visuelle */}
              {!canSubmit && formData.newPassword && (
                <div className='mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg'>
                  <p className='text-sm text-amber-800 flex items-center gap-2'>
                    <XCircle className='w-4 h-4' />
                    <span>Le mot de passe doit respecter tous les critères ci-dessus.</span>
                  </p>
                </div>
              )}
            </form>
          ) : (
            <div className='text-center py-8'>
              <XCircle className='w-16 h-16 text-red-400 mx-auto mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                Lien invalide
              </h3>
              <p className='text-gray-600'>
                Le lien de réinitialisation est invalide ou a expiré.
              </p>
              <button
                onClick={() => navigate('/mot-de-passe-oublie')}
                className='mt-4 text-sky-600 hover:text-sky-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded px-4 py-2'
              >
                Demander un nouveau lien
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='bg-gray-50 px-6 py-4 border-t border-gray-200'>
          <p className='text-center text-sm text-gray-600'>
            Revenir à la{' '}
            <button
              onClick={() => navigate('/connexion')}
              className='text-sky-600 hover:text-sky-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded px-1'
            >
              page de connexion
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;