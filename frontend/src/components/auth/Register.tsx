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
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const { register, isLoading } = useAuth(); // Retirer isRefreshing

  useEffect(() => {
    if (location.state?.message) {
      toast.info(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Validation en temps réel pour le téléphone
    if (name === 'phone') {
      // Supprimer les espaces et caractères non numériques sauf le + initial
      const cleanedValue = value.replace(/\s/g, '').replace(/[^\d+]/g, '');

      setFormData(prev => ({ ...prev, [name]: cleanedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (error) setError('');
  };

  const validateForm = (): boolean => {
    // Validation du prénom et nom
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires');
      return false;
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Format d'email invalide");
      return false;
    }

    // Validation du téléphone (minimum 5 chiffres comme backend)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 5) {
      setError('Le téléphone doit contenir au moins 5 chiffres');
      return false;
    }

    // Validation du mot de passe
    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(formData.password)) {
      setError(
        'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
      );
      return false;
    }

    // Validation de la confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation côté client
    if (!validateForm()) {
      return;
    }

    try {
      // ✅ DÉLÉGATION COMPLETE : AuthContext gère tous les toasts et erreurs
      await register(formData);
      // Plus de toast ici - tout est géré dans l'AuthContext
    } catch (err: any) {
      let message = 'Une erreur est survenue lors de la création du compte';

      if (err.message) {
        message = err.message;
      }

      setError(message);
      // Plus de toast ici - l'erreur est déjà gérée dans l'AuthContext
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
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label
                    htmlFor='firstName'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Prénom *
                  </label>
                  <div className='relative'>
                    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                      <FiUser className='text-gray-400' />
                    </div>
                    <input
                      id='firstName'
                      name='firstName'
                      type='text'
                      value={formData.firstName}
                      onChange={handleChange}
                      className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-none focus:border-sky-500 transition-colors'
                      placeholder='Votre prénom'
                      required
                      disabled={isLoading} // Retirer isRefreshing
                      autoComplete='given-name'
                      minLength={2}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor='lastName'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    Nom *
                  </label>
                  <div className='relative'>
                    <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                      <FiUser className='text-gray-400' />
                    </div>
                    <input
                      id='lastName'
                      name='lastName'
                      type='text'
                      value={formData.lastName}
                      onChange={handleChange}
                      className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-none focus:border-sky-500 transition-colors'
                      placeholder='Votre nom'
                      required
                      disabled={isLoading} // Retirer isRefreshing
                      autoComplete='family-name'
                      minLength={2}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Email *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiMail className='text-gray-400' />
                  </div>
                  <input
                    id='email'
                    name='email'
                    type='email'
                    value={formData.email}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-none focus:border-sky-500 transition-colors'
                    placeholder='votre@email.com'
                    required
                    disabled={isLoading} // Retirer isRefreshing
                    autoComplete='email'
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor='phone'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Téléphone *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiPhone className='text-gray-400' />
                  </div>
                  <input
                    id='phone'
                    name='phone'
                    type='tel'
                    value={formData.phone}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-none focus:border-sky-500 transition-colors'
                    placeholder='Ex: +33123456789'
                    required
                    disabled={isLoading} // Retirer isRefreshing
                    autoComplete='tel'
                    pattern='[\d\s+]*'
                    minLength={5}
                    maxLength={20}
                  />
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  Format accepté: chiffres avec ou sans + (minimum 5 chiffres)
                </p>
              </div>

              <div>
                <label
                  htmlFor='password'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Mot de passe *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiLock className='text-gray-400' />
                  </div>
                  <input
                    id='password'
                    name='password'
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-none focus:border-sky-500 pr-9 transition-colors'
                    placeholder='••••••••'
                    required
                    minLength={8}
                    autoComplete='new-password'
                    disabled={isLoading} // Retirer isRefreshing
                  />
                  <button
                    type='button'
                    className='absolute inset-y-0 right-0 pr-3 flex items-center'
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading} // Retirer isRefreshing
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
                <p className='text-xs text-gray-500 mt-1'>
                  Minimum 8 caractères, avec minuscule, majuscule et chiffre
                </p>
              </div>

              <div>
                <label
                  htmlFor='confirmPassword'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Confirmer le mot de passe *
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiLock className='text-gray-400' />
                  </div>
                  <input
                    id='confirmPassword'
                    name='confirmPassword'
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className='pl-9 w-full px-3 py-2 rounded bg-gray-50 border border-gray-300 hover:border-sky-400 focus:outline-none focus:ring-none focus:border-sky-500 pr-9 transition-colors'
                    placeholder='••••••••'
                    required
                    minLength={8}
                    autoComplete='new-password'
                    disabled={isLoading} // Retirer isRefreshing
                  />
                  <button
                    type='button'
                    className='absolute inset-y-0 right-0 pr-3 flex items-center'
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading} // Retirer isRefreshing
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

              {error && (
                <div
                  className='p-3 text-red-600 text-sm bg-red-50 rounded-md border border-red-200'
                  role='alert'
                >
                  <div className='flex items-center'>
                    <FiAlertCircle className='mr-2 flex-shrink-0' />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <button
                type='submit'
                disabled={isLoading} // Retirer isRefreshing
                className={`w-full py-2 px-4 rounded-md text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 font-medium transition-all duration-200 ${
                  isLoading
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-md'
                }`}
              >
                {isLoading ? 'Création en cours...' : 'Créer mon compte'}
              </button>

              <div className='text-center'>
                <p className='text-xs text-gray-600'>
                  Vous avez déjà un compte?{' '}
                  <Link
                    to='/connexion'
                    className='font-medium text-sky-600 hover:text-sky-500 transition-colors'
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
