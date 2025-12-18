import {
  FiKey,
  FiEdit,
  FiBookOpen,
  FiFileText,
  FiUsers,
  FiBriefcase,
} from 'react-icons/fi';

const services = [
  {
    icon: <FiKey className='w-5 h-5' />,
    title: "Création d'un Compte Pastel",
    description:
      'Nous créons votre compte Pastel rapidement et en toute sécurité.',
    keywords: 'compte pastel, création compte, sécurité',
  },
  {
    icon: <FiEdit className='w-5 h-5' />,
    title: 'Saisie des Informations Personnelles',
    description:
      'Saisie précise et sécurisée de vos informations personnelles.',
    keywords: 'informations personnelles, saisie données',
  },
  {
    icon: <FiBookOpen className='w-5 h-5' />,
    title: 'Choix des Universités et Formations',
    description:
      'Conseils personnalisés pour choisir les meilleures universités.',
    keywords: 'universités, formations, orientation',
  },
  {
    icon: <FiFileText className='w-5 h-5' />,
    title: 'Lettre de Motivation',
    description:
      'Rédaction de lettres de motivation percutantes et personnalisées.',
    keywords: 'lettre motivation, rédaction',
  },
  {
    icon: <FiUsers className='w-5 h-5' />,
    title: 'Préparation aux Entretiens',
    description: 'Préparation efficace et personnalisée pour vos entretiens.',
    keywords: 'préparation entretiens, simulation',
  },
  {
    icon: <FiBriefcase className='w-5 h-5' />,
    title: 'Assistance Demande de Visa',
    description: 'Accompagnement complet pour votre demande de visa.',
    keywords: 'visa, demande visa, assistance',
  },
];

const ServicesGrid = () => {
  return (
    <section className='py-12 px-4 sm:px-6 lg:px-8 bg-white'>
      <div className='max-w-6xl mx-auto'>
        {/* En-tête */}
        <div className='text-center mb-10 sm:mb-12'>
          <span className='inline-block bg-sky-100 text-sky-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3'>
            Nos Services
          </span>
          <h2 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-3'>
            Un accompagnement{' '}
            <span className='text-sky-600'>
              complet
            </span>
          </h2>
          <p className='text-gray-600 text-sm sm:text-base max-w-2xl mx-auto'>
            De la création de votre compte jusqu'à l'obtention de votre visa,
            nous vous guidons à chaque étape.
          </p>
        </div>

        {/* Grille des services */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
          {services.map((service, index) => (
            <div
              key={index}
              className='bg-white rounded-lg sm:rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-sky-300 hover:shadow-md sm:hover:shadow-lg transition-all duration-300'
            >
              <div className='flex items-start gap-4'>
                {/* Icône */}
                <div className='p-2.5 sm:p-3 rounded-lg sm:rounded-full bg-sky-500 text-white'>
                  {service.icon}
                </div>

                <div className='flex-1 min-w-0'>
                  {/* Numéro d'étape */}
                  <span className='inline-block text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded mb-2'>
                    Étape {index + 1}
                  </span>

                  {/* Titre */}
                  <h3 className='text-base sm:text-lg font-semibold text-gray-900 mb-2'>
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className='text-sm text-gray-600 mb-3'>
                    {service.description}
                  </p>

                  {/* Mots-clés */}
                  <div className='flex flex-wrap gap-1.5'>
                    {service.keywords.split(', ').map((keyword, idx) => (
                      <span
                        key={idx}
                        className='inline-block bg-gray-50 text-gray-700 text-xs px-2 py-1 rounded border border-gray-200'
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesGrid;