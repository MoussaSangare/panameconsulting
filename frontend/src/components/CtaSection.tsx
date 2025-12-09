import { ArrowRight } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import '../index.css';
import { FaBookOpen } from 'react-icons/fa';

interface CtaSectionProps {
  className?: string;
}

const CtaSection: React.FC<CtaSectionProps> = ({ className }) => {
  return (
    <section
      className={`relative py-12 md:py-16 mb-3 overflow-hidden bg-gradient-to-br from-sky-500 via-sky-600 to-sky-700 ${className || ''}`}
    >
      {/* Background decorations */}
      <div className='absolute inset-0 pointer-events-none z-0'>
        {/* Dot pattern - highly visible */}
        <div
          className='absolute inset-0 opacity-50'
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.5) 1.2px, transparent 1.2px)',
            backgroundSize: '10px 10px',
          }}
        />

        {/* Light overlay gradient */}
        <div className='absolute inset-0 bg-gradient-to-r from-sky-600/30 to-transparent' />

        {/* Decorative blobs */}
        <div className='absolute top-0 left-0 w-60 h-60 bg-sky-400/30 rounded-full filter blur-2xl' />
        <div className='absolute bottom-0 right-0 w-60 h-60 bg-sky-300/30 rounded-full filter blur-2xl' />
      </div>

      {/* Foreground content */}
      <div className='mx-auto px-4 sm:px-6 relative z-10'>
        <div className='flex flex-col lg:flex-row items-center justify-between gap-6'>
          {/* Text content */}
          <div className='text-center lg:text-left space-y-4 max-w-2xl'>
            <div className='flex items-center gap-2 text-sky-200 mb-2 justify-center lg:justify-start'>
              <FaBookOpen className='w-5 h-5' />
              <span className='text-sm font-medium uppercase tracking-wider'>
                Votre Avenir Commence Ici
              </span>
            </div>

            <h3 className='text-2xl sm:text-3xl md:text-4xl font-bold leading-tight'>
              <span className='block mt-1 bg-gradient-to-r from-white via-sky-100 to-white bg-clip-text text-transparent'>
                PANAME CONSULTING
              </span>
              <span className='text-white'>LE CAP VERS L'EXCELLENCE</span>
            </h3>

            <p className='text-base sm:text-lg text-sky-100 font-medium'>
              VOTRE PARTENAIRE VERS L'EXCELLENCE ACADÉMIQUE INTERNATIONALE
            </p>
          </div>

          {/* CTA button */}
          <div className='group relative'>
            <div className='absolute group-hover:opacity-100 transition duration-1000 group-hover:duration-200' />
            <Link
              to='/rendez-vous'
              className='relative flex items-center gap-2 bg-white px-6 py-3 rounded-full transition-all duration-300 transform hover:scale-105'
            >
              <span className='text-sky-600 font-semibold text-base'>
                RENDEZ-VOUS
              </span>
              <div className='w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center'>
                <ArrowRight className='w-4 h-4 text-white group-hover:translate-x-1 transition-transform' />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
