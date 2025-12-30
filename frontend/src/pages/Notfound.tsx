/* eslint-disable no-undef */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const NotFound: React.FC = (): React.JSX.Element => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const [particles, setParticles] = useState<
    Array<{ id: number; style: React.CSSProperties }>
  >([]);

  // Generate random particles on mount
  useEffect(() => {
    const newParticles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      style: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: `${i * 0.2}s`,
        opacity: 0.5 + Math.random() * 0.5,
      },
    }));
    setParticles(newParticles);
  }, []);

  // Handle countdown and navigation
  useEffect(() => {
    let countdownInterval: number;
    let navigationTimeout: number;

    if (countdown > 0) {
      countdownInterval = window.setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      navigationTimeout = window.setTimeout(() => {
        navigate('/');
      }, 5000);
    } else {
      navigate('/');
    }

    return () => {
      if (countdownInterval) {
        window.clearInterval(countdownInterval);
      }
      if (navigationTimeout) {
        window.clearTimeout(navigationTimeout);
      }
    };
  }, [countdown, navigate]);

  const handleGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Page non trouvée - Paname Consulting</title>
        <meta
          name='description'
          content="La page que vous recherchez n'existe pas ou a été déplacée. Vous serez redirigé automatiquement."
        />
        <meta name='robots' content='noindex, nofollow' />
      </Helmet>

      <div className='min-h-screen bg-linear-to-b from-gray-50 to-white flex items-center justify-center p-4 md:p-6'>
        <div className='max-w-2xl w-full text-center space-y-8'>
          {/* Decorative Header */}
          <div className='relative'>
            <div className='absolute -inset-4 bg-linear-to-r from-blue-500/10 to-cyan-500/10 blur-3xl rounded-full' />

            <div className='relative'>
              {/* Animated 404 Number */}
              <div className='relative inline-block'>
                <span className='text-9xl md:text-[10rem] font-black bg-linear-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent'>
                  404
                </span>

                {/* Glow effect */}
                <div className='absolute inset-0 bg-linear-to-r from-blue-600/20 to-cyan-500/20 blur-2xl -z-10' />

                {/* Floating dots */}
                <div className='absolute -top-4 -right-4 w-8 h-8 bg-blue-400 rounded-full animate-[float_3s_ease-in-out_infinite]' />
                <div className='absolute -bottom-4 -left-4 w-6 h-6 bg-cyan-400 rounded-full animate-[float_3s_ease-in-out_infinite_1s]' />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className='space-y-6'>
            <div>
              <h1 className='text-3xl md:text-4xl font-bold text-gray-900 mb-3'>
                Page introuvable
              </h1>
              <p className='text-lg text-gray-600 max-w-lg mx-auto'>
                La page que vous recherchez semble avoir disparu dans l'espace
                numérique. Ne vous inquiétez pas, nous vous ramenons sur terre.
              </p>
            </div>

            {/* Countdown Timer */}
            <div className='max-w-sm mx-auto'>
              <div className='bg-linear-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg border border-gray-200'>
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-700 font-medium'>
                      Redirection dans :
                    </span>
                    <span className='text-3xl font-bold bg-linear-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent'>
                      {countdown}s
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className='h-2 bg-gray-200 rounded-full overflow-hidden'>
                    <div
                      className='h-full bg-linear-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000 ease-linear'
                      style={{ width: `${(countdown / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex flex-col sm:flex-row gap-4 justify-center pt-4'>
              <button
                onClick={handleGoHome}
                className='group relative px-8 py-4 bg-linear-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:translate-y-0'
              >
                <div className='absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
                <span className='relative flex items-center justify-center gap-2'>
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
                    />
                  </svg>
                  Retour à l'accueil
                </span>
              </button>

              <button
                onClick={handleGoBack}
                className='group relative px-8 py-4 bg-white text-gray-800 font-semibold rounded-xl border-2 border-gray-300 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:translate-y-0 hover:border-blue-400'
              >
                <div className='absolute inset-0 bg-blue-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
                <span className='relative flex items-center justify-center gap-2'>
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M10 19l-7-7m0 0l7-7m-7 7h18'
                    />
                  </svg>
                  Page précédente
                </span>
              </button>
            </div>

            {/* Help Text */}
            <div className='pt-6'>
              <p className='text-sm text-gray-500'>
                La redirection automatique s'arrêtera si vous interagissez avec
                la page
              </p>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className='fixed inset-0 pointer-events-none -z-10 overflow-hidden'>
            {/* Background Grid */}
            <div className='absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-size-[50px_50px] opacity-20' />

            {/* Animated Particles */}
            {particles.map(particle => (
              <div
                key={particle.id}
                className='absolute w-1 h-1 bg-linear-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse'
                style={particle.style}
              />
            ))}

            {/* Floating Shapes */}
            <div className='absolute top-1/4 left-1/4 w-32 h-32 border border-blue-200/30 rounded-full animate-[spin_20s_linear_infinite]' />
            <div className='absolute bottom-1/4 right-1/4 w-24 h-24 border border-cyan-200/30 rounded-full animate-[spin_15s_linear_infinite_reverse]' />
          </div>
        </div>

        {/* Custom Animations */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-10px) scale(1.05); }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          
          .animate-\\[spin_15s_linear_infinite_reverse\\] {
            animation: spin-reverse 15s linear infinite;
          }
        `}</style>
      </div>
    </>
  );
};

export default React.memo(NotFound);
