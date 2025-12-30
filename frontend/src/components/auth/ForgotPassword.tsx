/* eslint-disable no-undef */

import { useAuth } from '../../context/AuthContext';
import React, { useState } from 'react';
import { FiAlertCircle, FiMail } from 'react-icons/fi';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const ForgotPassword: React.FC = (): React.JSX.Element => {
  const navigate = useNavigate();
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const { forgotPassword, isLoading } = useAuth();

  const handlePasswordReset = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');

    if (!resetEmail) {
      setError('Veuillez entrer votre email');
      return;
    }

    try {
      await forgotPassword(resetEmail);
      toast.success(
        'Si votre email est enregistré, vous recevrez un lien de réinitialisation'
      );
      setResetEmail(''); // Réinitialiser le champ
    } catch (err: any) {
      // Ajouter le type 'any'
      // Vous pouvez utiliser la variable 'err' si vous en avez besoin pour le débogage
      if (import.meta.env.DEV) {
        console.error('Erreur de réinitialisation:', err);
      }
      toast.error("Une erreur est survenue lors de l'envoi de l'email");
      setResetEmail(''); // Réinitialiser le champ
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-sky-50 to-sky-100 p-4'>
      <div className='w-full max-w-md'>
        <div className='bg-white rounded-2xl shadow-xl overflow-hidden'>
          <div className='bg-linear-to-r from-sky-500 to-sky-600 p-6 text-center'>
            <div className='flex items-center justify-center space-x-2'>
              <div className='bg-white p-2 rounded-full'>
                <div className='w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center'>
                  <FiMail className='text-white text-xl' />
                </div>
              </div>
              <Link to='/'>
                <h1 className='text-2xl font-bold text-white'>
                  Réinitialisation
                </h1>
              </Link>
            </div>
          </div>

          <div className='p-6 md:p-8'>
            <form onSubmit={handlePasswordReset} className='space-y-1'>
              <h2 className='text-xl md:text-2xl font-bold text-center text-gray-800'>
                Mot de passe oublié
              </h2>
              <p className='text-gray-600 text-center text-sm md:text-base'>
                Entrez votre adresse email pour réinitialiser votre mot de
                passe.
              </p>

              {error && (
                <div className='p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center'>
                  <FiAlertCircle className='mr-2 shrink-0' />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor='reset-email'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Email
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <FiMail className='text-gray-400' />
                  </div>
                  <input
                    id='reset-email'
                    type='email'
                    value={resetEmail}
                    onChange={e => {
                      setResetEmail(e.target.value);
                      setError('');
                    }}
                    className={`pl-10 w-full px-4 py-2.5 rounded bg-gray-50 border ${error ? 'border-red-300' : 'border-gray-300'} focus:outline-none focus:ring-none focus:border-sky-500 hover:border-sky-400 transition-colors`}
                    placeholder='votre@email.com'
                    required
                  />
                </div>
              </div>

              <div className='flex flex-col gap-3'>
                <button
                  type='submit'
                  disabled={isLoading}
                  className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded shadow-sm text-white bg-linear-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 focus:outline-none focus:ring-none font-medium transition-all duration-200 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  {isLoading
                    ? 'Envoi en cours...'
                    : "Envoyer l'email de réinitialisation"}
                </button>

                <button
                  type='button'
                  onClick={() => navigate(-1)}
                  className='w-full flex items-center justify-center py-2.5 px-4 text-sky-600 bg-sky-50 rounded hover:bg-sky-100 focus:outline-none focus:ring-none font-medium transition-colors duration-200'
                >
                  <ArrowLeft className='mr-2' />
                  Retour
                </button>
              </div>
            </form>
          </div>

          <div className='bg-gray-50 px-6 py-4 text-center'>
            <p className='text-xs text-gray-500'>
              &copy; {new Date().getFullYear()} Paname Consulting. Tous droits
              réservés.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
