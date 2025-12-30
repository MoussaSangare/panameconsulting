import { useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate();

  // Calcul dynamique des années d'expérience
  const currentYear = new Date().getFullYear();
  const startYear = 2023;
  const yearsOfExperience = currentYear - startYear;

  const stats = [
    {
      number: `${yearsOfExperience}+`,
      label: "Années d'expérience",
      description: 'Depuis 2023',
      icon: (
        <svg
          className='w-4 h-4'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
      ),
    },
    {
      number: '8+',
      label: 'Pays partenaires',
      description: 'À travers le monde',
      icon: (
        <svg
          className='w-4 h-4'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
      ),
    },
    {
      number: '100%',
      label: 'Accompagnement',
      description: 'Personnalisé',
      icon: (
        <svg
          className='w-4 h-4'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
          />
        </svg>
      ),
    },
    {
      number: '2 ans',
      label: "D'expertise",
      description: 'Formation continue',
      icon: (
        <svg
          className='w-4 h-4'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 10V3L4 14h7v7l9-11h-7z'
          />
        </svg>
      ),
    },
  ];

  const countries = [
    { name: 'Chine', slug: 'chine' },
    { name: 'France', slug: 'france' },
    { name: 'Chypre', slug: 'chypre' },
    { name: 'Maroc', slug: 'maroc' },
    { name: 'Algérie', slug: 'algerie' },
    { name: 'Tunisie', slug: 'tunisie' },
    { name: 'Sénégal', slug: 'senegal' },
    { name: 'Russie', slug: 'russie' },

  ];

  const handleDestinationClick = (countrySlug: string) => {
    navigate(`/destination/${countrySlug}`);
  };

  return (
    <>
    <div className='min-h-screen bg-gray-50 lg:mt-10'>
      {/* Hero Section - Mobile First */}
      <div className='relative min-h-screen bg-linear-to-br from-sky-600 via-sky-700 to-sky-800 text-white overflow-hidden'>
        {/* Image de fond avec overlay */}
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{
            backgroundImage:
              'url("/Heroimage.avif")',
          }}
        />
        <div className='absolute inset-0 bg-sky-900/70'></div>

        {/* Contenu du Hero */}
        <div className='relative z-10 container mx-auto px-3 sm:px-4 min-h-screen flex items-center py-4 sm:py-6'>
          <div className='max-w-6xl mx-auto w-full'>
            <div className='flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8'>
              {/* Texte principal - Gauche */}
              <div className='lg:w-1/2 text-center lg:text-left'>
                {/* Logo */}
                <div className='flex flex-col sm:flex-row items-center lg:items-start lg:flex-col gap-2 sm:gap-3 mb-4 sm:mb-6'>
                  <div className='w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-lg'>
                    <svg
                      className='w-6 h-6 sm:w-7 sm:h-7 text-sky-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1.5}
                        d='M9 9h6M9 12h4M9 15h5'
                      />
                    </svg>
                  </div>
                  <h1 className='text-xl sm:text-2xl font-bold tracking-wide'>
                    PANAME CONSULTING
                  </h1>
                </div>

                {/* Tagline principale */}
                <h2 className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 leading-tight text-balance hero-text-shadow'>
                  LE CAP VERS
                  <br className='hidden xs:block' />
                  <span className='text-sky-300'> L'EXCELLENCE</span>
                </h2>

                {/* Sous-titre */}
                <p className='text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed opacity-95 max-w-xl lg:max-w-none text-balance'>
                  Depuis {startYear}, notre équipe multiculturelle accompagne
                  les étudiants ambitieux vers les meilleures universités du
                  monde. De la sélection du programme jusqu'à votre
                  installation, nous transformons vos ambitions en réussites
                  concrètes.
                </p>

                {/* CTA Buttons */}
                <div className='mb-4 sm:mb-6 lg:mb-0'>
                  <h3 className='text-sm sm:text-base font-semibold mb-3 sm:mb-4 text-sky-100'>
                    Commencez votre aventure dès aujourd'hui
                  </h3>
                  <div className='flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center lg:justify-start'>
                    <button
                      onClick={() => navigate('/rendez-vous')}
                      className='bg-white text-sky-600 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 hover:bg-sky-50 border-2 border-white min-w-35 sm:min-w-40'
                    >
                      Rendez-Vous
                    </button>
                    <button
                      onClick={() => navigate('/services')}
                      className='border-2 border-white text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-semibold text-sm hover:bg-white hover:text-sky-600 transition-all duration-300 min-w-35 sm:min-w-40 backdrop-blur-sm'
                    >
                      Nos Services
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Section - Droite - Optimisée Mobile First */}
              <div className='lg:w-2/5 w-full'>
                <div className='bg-white/10 backdrop-blur-sm rounded-2xl p-3 sm:p-4 md:p-6 border border-white/20 shadow-2xl'>
                  {/* En-tête */}
                  <div className='text-center mb-4 sm:mb-6'>
                    <h3 className='text-base sm:text-lg md:text-xl font-semibold text-white mb-1 sm:mb-2'>
                      Notre Impact
                    </h3>
                    <p className='text-xs sm:text-sm text-sky-100 opacity-90'>
                      Chiffres clés depuis notre création
                    </p>
                  </div>

                  {/* Grille de stats responsive */}
                  <div className='grid grid-cols-2 gap-2 sm:gap-3 md:gap-6'>
                    {stats.map((stat, index) => (
                      <div
                        key={index}
                        className='group bg-white/5 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 lg:p-5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 cursor-pointer'
                      >
                        {/* Icone et nombre */}
                        <div className='flex items-center justify-between mb-1 sm:mb-2'>
                          <div className='text-xl sm:text-2xl md:text-3xl font-bold text-white'>
                            {stat.number}
                          </div>
                          <div className='text-sky-300 bg-sky-400/20 p-1.5 sm:p-2 rounded-md sm:rounded-lg group-hover:bg-sky-400/30 transition-colors'>
                            {stat.icon}
                          </div>
                        </div>

                        {/* Labels */}
                        <div className='space-y-0.5 sm:space-y-1'>
                          <div className='text-xs sm:text-sm font-semibold text-white'>
                            {stat.label}
                          </div>
                          <div className='text-xs text-sky-100 opacity-80'>
                            {stat.description}
                          </div>
                        </div>

                        {/* Barre de progression décorative */}
                        <div className='mt-2 sm:mt-3 h-1 bg-white/10 rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-sky-300 rounded-full transition-all duration-1000 group-hover:bg-sky-200'
                            style={{
                              width: `${Math.min(100, 70 + index * 10)}%`,
                              animation: `slideIn 1.5s ease-out ${index * 0.2}s both`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Badge d'années en bas */}
                  <div className='mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10'>
                    <div className='flex items-center justify-center gap-1.5 sm:gap-2 text-xs text-sky-100'>
                      <svg
                        className='w-3 h-3'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13 10V3L4 14h7v7l9-11h-7z'
                        />
                      </svg>
                      <span>Expertise croissante depuis {startYear}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Countries Section */}
      <section className='py-4 sm:py-6 md:py-8 lg:py-12 bg-linear-to-r from-sky-500 to-sky-600'>
        <div className='container mx-auto px-3 sm:px-4'>
          <h2 className='text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-center text-white mb-1.5 sm:mb-2 md:mb-3'>
            Explorez nos Destinations
          </h2>
          <p className='text-center text-sky-100 mb-3 sm:mb-4 md:mb-6 text-xs sm:text-sm max-w-2xl mx-auto'>
            Découvrez les opportunités d'études dans nos pays partenaires
          </p>

          <div className='flex flex-wrap justify-center gap-1.5 sm:gap-2 md:gap-3'>
            {countries.map((country, index) => (
              <button
                key={index}
                onClick={() => handleDestinationClick(country.slug)}
                className='bg-white/20 text-white px-2 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-2 rounded-full font-medium backdrop-blur-sm hover:bg-white/30 transition-all duration-300 hover:scale-105 cursor-pointer border border-white/30 text-xs sm:text-sm group'
              >
                <span className='flex items-center gap-1'>
                  {country.name}
                  <svg
                    className='w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M14 5l7 7m0 0l-7 7m7-7H3'
                    />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Hero;