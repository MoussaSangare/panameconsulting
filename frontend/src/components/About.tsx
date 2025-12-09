import AOS from 'aos';
import 'aos/dist/aos.css';
import React, { useEffect } from 'react';
import {
  FiArrowRight,
  FiAward,
  FiBook,
  FiTarget,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';

const About = () => {
  const location = useLocation();
  const isAboutPage = location.pathname === '/a-propos';

  useEffect(() => {
    AOS.init({
      once: true,
      duration: 800,
      easing: 'ease-in-out',
    });
  }, []);

  const services = [
    {
      icon: <FiBook className='w-6 h-6' />,
      title: 'Formation professionnelle',
      text: 'Expertise pointue et pédagogie innovante pour booster votre carrière',
    },
    {
      icon: <FiTarget className='w-6 h-6' />,
      title: 'Conseil stratégique',
      text: 'Solutions personnalisées pour vos choix professionnels et éducatifs',
    },
    {
      icon: <FiUser className='w-6 h-6' />,
      title: 'Coaching personnalisé',
      text: 'Accompagnement sur mesure avec méthodologie orientée résultats',
    },
    {
      icon: <FiUsers className='w-6 h-6' />,
      title: 'Team-building',
      text: "Ateliers dynamiques pour renforcer la cohésion d'équipe",
    },
  ];

  return (
    <div className='bg-gradient-to-b from-white via-sky-50 to-white mt-5'>
      <section
        id='a-propos'
        className='py-12 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto'
      >
        <div className='text-center'>
          <span
            className='inline-block px-4 py-2 mb-3 text-xs font-bold text-sky-600 uppercase tracking-widest bg-sky-50 rounded-full border-l-4 border-sky-500 shadow-sm transition-all duration-300 hover:shadow-md'
            data-aos='fade-up'
            data-aos-duration='500'
          >
            Qui Sommes Nous ?
          </span>
        </div>

        {/* Section Fondateur */}
        <section
          id='fondateur'
          className='bg-white overflow-hidden shadow-xl border border-gray-100 rounded-2xl'
          data-aos='fade-up'
          data-aos-duration='800'
          data-aos-delay='200'
        >
          <div className='flex flex-col lg:flex-row'>
            <div className='lg:w-2/5 bg-gradient-to-br from-sky-500 to-sky-700 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden'>
              {/* Texture déco */}
              <div className='absolute inset-0 pointer-events-none'>
                <div
                  className='absolute inset-0 opacity-20'
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '6px 6px',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
                    maskImage:
                      'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
                  }}
                />
              </div>
              <div className='text-center mb-6 md:mb-8 relative z-10'>
                <div className='mx-auto bg-gray-200 rounded w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 flex items-center justify-center overflow-hidden'>
                  <img
                    src='/damini.webp'
                    alt='Photo de Sangare Damini'
                    className='w-full h-full object-cover'
                    loading='lazy'
                  />
                </div>
              </div>
              <div className='text-white text-center relative z-10'>
                <h3 className='text-xl md:text-2xl font-bold mb-1'>
                  Sangare Damini
                </h3>
                <p className='text-sky-100 text-sm font-medium'>
                  Fondateur & CEO
                </p>
                <div className='flex justify-center mt-4 space-x-3 md:space-x-4'>
                  <div className='bg-sky-400/30 p-1.5 md:p-2 rounded-full'>
                    <FiAward className='w-4 h-4 md:w-5 md:h-5' />
                  </div>
                  <div className='bg-sky-400/30 p-1.5 md:p-2 rounded-full'>
                    <FiUsers className='w-4 h-4 md:w-5 md:h-5' />
                  </div>
                  <div className='bg-sky-400/30 p-1.5 md:p-2 rounded-full'>
                    <FiTarget className='w-4 h-4 md:w-5 md:h-5' />
                  </div>
                </div>
              </div>
            </div>

            <div className='lg:w-3/5 p-6 md:p-8 bg-white'>
              <div className='mb-6'>
                <span className='inline-block text-sky-600 bg-sky-100 px-3 py-1 text-xs font-semibold mb-3'>
                  Notre histoire
                </span>
                <h3 className='text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-4'>
                  Notre mission, votre réussite
                </h3>
              </div>

              <div className='space-y-3 md:space-y-4 text-gray-700 text-sm md:text-base'>
                <p>
                  Fondée par{' '}
                  <strong className='text-sky-600'>Sangare Damini</strong>,
                  PANAME CONSULTING est née d'une passion pour l'éducation et
                  l'accompagnement.
                </p>
                <p>
                  Notre mission : vous offrir un accompagnement sur mesure pour
                  vos projets d'études à l'étranger, dans un monde en constante
                  mutation.
                </p>
                <p>
                  <span className='font-semibold text-sky-600'>
                    PANAME CONSULTING
                  </span>{' '}
                  est votre passerelle vers l'international. Nous transformons
                  l'éducation en opportunités mondiales grâce à un
                  accompagnement sur-mesure pour vos projets en France, Canada,
                  Turquie et au-delà.
                </p>

                <div className='bg-sky-50 p-3 md:p-4 border-l-4 border-sky-500 mt-4 md:mt-6'>
                  <p className='italic text-gray-700 text-sm md:text-base'>
                    "L'éducation est le passeport pour l'avenir, car demain
                    appartient à ceux qui s'y préparent aujourd'hui."{' '}
                    <b>: " Malcolm X "</b>
                  </p>
                </div>
              </div>

              <div className='mt-6 md:mt-8'>
                {!isAboutPage && (
                  <Link
                    to='/a-propos'
                    className='inline-flex items-center font-medium text-sky-700 bg-sky-100/60 hover:bg-sky-200 px-4 py-1.5 md:px-5 md:py-2 shadow-sm hover:shadow-md transition-all group text-sm md:text-base'
                  >
                    <span className='relative z-10 flex items-center gap-2'>
                      <span className='font-semibold group-hover:underline underline-offset-4'>
                        VOIR-PLUS
                      </span>
                      <FiArrowRight className='transition-transform group-hover:translate-x-1' />
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <div className='mt-12 md:mt-16'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6'>
            {services.map((service, index) => (
              <div
                key={index}
                data-aos='fade-up'
                data-aos-duration='800'
                data-aos-delay={300 + index * 100}
                className='flex flex-col p-4 md:p-6 bg-white shadow hover:shadow-md transition-shadow rounded-lg border border-gray-100'
              >
                <div className='flex justify-start mb-3 md:mb-4'>
                  <div className='flex items-center justify-center rounded-full w-10 h-10 md:w-12 md:h-12 bg-sky-100 text-sky-600'>
                    {React.cloneElement(service.icon, {
                      className: 'w-5 h-5 md:w-6 md:h-6',
                    })}
                  </div>
                </div>

                <div className='flex-1 text-left'>
                  <h3 className='text-base md:text-lg font-semibold text-gray-900 mb-1 md:mb-2'>
                    {service.title}
                  </h3>
                  <p className='text-gray-600 text-xs md:text-sm'>
                    {service.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
