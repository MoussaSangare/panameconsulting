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
    icon: <FiKey className='w-5 h-5 sm:w-6 sm:h-6' />,
    title: "Création d'un Compte Pastel",
    description:
      'Nous créons votre compte Pastel rapidement et en toute sécurité.',
    keywords: 'compte pastel, création compte, sécurité',
  },
  {
    icon: <FiEdit className='w-5 h-5 sm:w-6 sm:h-6' />,
    title: 'Saisie des Informations Personnelles',
    description:
      'Saisie précise et sécurisée de vos informations personnelles.',
    keywords: 'informations personnelles, saisie données',
  },
  {
    icon: <FiBookOpen className='w-5 h-5 sm:w-6 sm:h-6' />,
    title: 'Choix des Universités et Formations',
    description:
      'Conseils personnalisés pour choisir les meilleures universités.',
    keywords: 'universités, formations, orientation',
  },
  {
    icon: <FiFileText className='w-5 h-5 sm:w-6 sm:h-6' />,
    title: 'Lettre de Motivation',
    description:
      'Rédaction de lettres de motivation percutantes et personnalisées.',
    keywords: 'lettre motivation, rédaction',
  },
  {
    icon: <FiUsers className='w-5 h-5 sm:w-6 sm:h-6' />,
    title: 'Préparation aux Entretiens',
    description: 'Préparation efficace et personnalisée pour vos entretiens.',
    keywords: 'préparation entretiens, simulation',
  },
  {
    icon: <FiBriefcase className='w-5 h-5 sm:w-6 sm:h-6' />,
    title: 'Assistance Demande de Visa',
    description: 'Accompagnement complet pour votre demande de visa.',
    keywords: 'visa, demande visa, assistance',
  },
];

const ServicesGrid = () => {
  return (
    <section className='py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-sky-50 to-white'>
      <div className='max-w-6xl mx-auto'>
        {/* En-tête */}
        <div className='text-center mb-12'>
          <span className='inline-block bg-gradient-to-r from-sky-100 to-sky-50 text-sky-700 border border-sky-200 px-4 py-1.5 rounded-full text-sm font-medium mb-3'>
            Nos Services
          </span>
          <h2 className='text-3xl sm:text-4xl font-bold text-gray-900 mb-3'>
            Un accompagnement{' '}
            <span className='bg-gradient-to-r from-sky-500 to-sky-600 bg-clip-text text-transparent'>
              complet
            </span>
          </h2>
          <p className='text-gray-600 text-base max-w-2xl mx-auto'>
            De la création de votre compte jusqu'à l'obtention de votre visa,
            nous vous guidons à chaque étape.
          </p>
        </div>

        {/* Grille des services */}
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {services.map((service, index) => (
            <div
              key={index}
              className='bg-white rounded-xl p-6 border border-gray-200 hover:border-sky-300 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1'
            >
              <div className='flex items-start gap-4'>
                {/* Icône avec gradient sky */}
                <div className='p-3 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white shrink-0 group-hover:from-sky-600 group-hover:to-sky-700 transition-all duration-300 shadow-sm'>
                  {service.icon}
                </div>

                <div className='flex-1 min-w-0'>
                  {/* Numéro d'étape */}
                  <span className='text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full'>
                    Étape {index + 1}
                  </span>

                  {/* Titre */}
                  <h3 className='text-lg font-semibold text-gray-900 mb-1 group-hover:text-sky-700 transition-colors duration-300'>
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
                        className='inline-block bg-gray-50 text-gray-700 text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-colors duration-200'
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
