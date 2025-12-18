import React, { useState, useEffect } from 'react';
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiPhone,
  FiUser,
  FiAlertCircle,
} from 'react-icons/fi';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading, error: authError, isAuthenticated, user } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    telephone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // Redirection si déjà connecté
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = user.role === 'admin'
        ? '/gestionnaire/statistiques'
        : '/';
      navigate(redirectPath);
    }
  }, [isAuthenticated, user, navigate]);

  // Récupération des messages de redirection
  useEffect(() => {
    if (location.state?.message) {
      console.info('Message de redirection:', location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Synchronisation des erreurs d'authentification
  useEffect(() => {
    if (authError) {
      setFormError(authError);
    }
  }, [authError]);

 const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;

  if (name === 'telephone') {
    
    const cleanedValue = value
      .replace(/\s/g, '') // Supprimer tous les espaces
      .replace(/[^\d+]/g, '') // Garder uniquement les chiffres et le +
      .replace(/(?<!^)\+/g, ''); // Supprimer les + qui ne sont pas au début
    
    setFormData(prev => ({ ...prev, [name]: cleanedValue }));
  } else {
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  if (formError) setFormError('');
};

  const validateForm = (): boolean => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setFormError('Le prénom et le nom sont obligatoires');
      return false;
    }

    if (formData.firstName.length < 2 || formData.lastName.length < 2) {
      setFormError('Le prénom et le nom doivent contenir au moins 2 caractères');
      return false;
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFormError("Format d'email invalide");
      return false;
    }

    const phoneDigits = formData.telephone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setFormError('Le téléphone doit contenir au moins 8 chiffres');
      return false;
    }

    // Validation du mot de passe
    if (formData.password.length < 8) {
      setFormError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(formData.password)) {
      setFormError(
        'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
      );
      return false;
    }

    // Validation de la confirmation
    if (formData.password !== formData.confirmPassword) {
      setFormError('Les mots de passe ne correspondent pas');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');

      if (!validateForm()) {
        return;
      }

      try {
        
        await register(formData);
        
      } catch (err: any) {
        console.error('Erreur inscription frontend:', {
          message: err.message,
          data: formData
        });
        
        setFormError(err.message || 'Erreur lors de la création du compte');
      }
    };

  return (
    <div className='flex items-center justify-center p-4 min-h-screen bg-sky-50'>
      <div className='w-full max-w-sm'>
        <div className='bg-white rounded-lg shadow-md overflow-hidden'>
          <div className='bg-gradient-to-r from-sky-500 to-sky-600 p-4 text-center'>
            <div className='flex items-center justify-center space-x-2'>
              <div className='bg-white p-1 rounded-full'>
                <div className='w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center'>
                  <FiUser className='text-white text-lg' />
                </div>
              </div>
              <h1 className='text-lg font-bold text-white'>
                <Link to='/'>Créer Un Compte</Link>
              </h1>
            </div>
          </div>

          <div className='p-4 space-y-3'>
            <form className='space-y-3' onSubmit={handleSubmit}>
              {/* Nom et prénom */}
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Prénom *
                  </label>
                  <div className='relative'>
                    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                      <FiUser className='text-gray-400' />
                    </div>
                    <input
                      name='firstName'
                      type='text'
                      value={formData.firstName}
                      onChange={handleChange}
                      className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors'
                      placeholder='Votre prénom'
                      required
                      disabled={isLoading}
                      autoComplete='given-name'
                      minLength={2}
                    />
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Nom *
                  </label>
                  <div className='relative'>
                    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                      <FiUser className='text-gray-400' />
                    </div>
                    <input
                      name='lastName'
                      type='text'
                      value={formData.lastName}
                      onChange={handleChange}
                      className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors'
                      placeholder='Votre nom'
                      required
                      disabled={isLoading}
                      autoComplete='family-name'
                      minLength={2}
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Email *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiMail className='text-gray-400' />
                  </div>
                  <input
                    name='email'
                    type='email'
                    value={formData.email}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors'
                    placeholder='votre@email.com'
                    required
                    disabled={isLoading}
                    autoComplete='email'
                  />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Téléphone *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiPhone className='text-gray-400' />
                  </div>
                  <input
                      name='telephone'
                      type='tel'
                      value={formData.telephone}
                      onChange={handleChange}
                      className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors'
                      placeholder='Ex: +33123456789 ou 0123456789'
                      required
                      disabled={isLoading}
                      autoComplete='tel'
                      minLength={8} // Changé de 10 à 8
                      maxLength={20}
                    />
                    <p className='text-xs text-gray-500 mt-1'>
                    Format: +33123456789 ou 0123456789 (minimum 8 chiffres, + optionnel)
                    </p>
                </div>
              </div>



              {/* Mot de passe */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Mot de passe *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiLock className='text-gray-400' />
                  </div>
                  <input
                    name='password'
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 pr-9 transition-colors'
                    placeholder='••••••••'
                    required
                    minLength={8}
                    disabled={isLoading}
                    autoComplete='new-password'
                  />
                  <button
                    type='button'
                    className='absolute inset-y-0 right-0 pr-3 flex items-center'
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label={
                      showPassword
                        ? 'Cacher le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showPassword ? (
                      <FiEyeOff className='text-gray-400 hover:text-gray-600' />
                    ) : (
                      <FiEye className='text-gray-400 hover:text-gray-600' />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmation mot de passe */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Confirmer le mot de passe *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiLock className='text-gray-400' />
                  </div>
                  <input
                    name='confirmPassword'
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 pr-9 transition-colors'
                    placeholder='••••••••'
                    required
                    minLength={8}
                    disabled={isLoading}
                    autoComplete='new-password'
                  />
                  <button
                    type='button'
                    className='absolute inset-y-0 right-0 pr-3 flex items-center'
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    aria-label={
                      showConfirmPassword
                        ? 'Cacher le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff className='text-gray-400 hover:text-gray-600' />
                    ) : (
                      <FiEye className='text-gray-400 hover:text-gray-600' />
                    )}
                  </button>
                </div>
              </div>

              {/* Erreur */}
              {formError && (
                <div
                  className='p-3 text-red-600 text-sm bg-red-50 rounded-md border border-red-200'
                  role='alert'
                >
                  <div className='flex items-center'>
                    <FiAlertCircle className='mr-2 flex-shrink-0' />
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              {/* Bouton soumission */}
              <button
                type='submit'
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded-md text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 font-medium transition-all duration-200 ${
                  isLoading
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-md active:scale-[0.98]'
                }`}
              >
                {isLoading ? 'Création en cours...' : 'Créer mon compte'}
              </button>

              <div className='text-center'>
                <p className='text-xs text-gray-600'>
                  Vous avez déjà un compte?{' '}
                  <Link
                    to='/connexion'
                    className='font-medium text-sky-600 hover:text-sky-500 transition-colors hover:underline'
                  >
                    Se connecter
                  </Link>
                </p>
                <p className='text-xs text-gray-500 mt-2'>
                  * Champs obligatoires
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;