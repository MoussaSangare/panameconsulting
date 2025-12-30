import { BadgeCheck, HeartHandshake, Medal, Sparkles } from 'lucide-react';

const Valeur = () => {
  const valeurs = [
    {
      icon: <HeartHandshake className='w-8 h-8' />,
      title: 'Engagement',
      description:
        'Nous nous engageons à fournir des solutions innovantes et à respecter nos engagements.',
    },
    {
      icon: <BadgeCheck className='w-8 h-8' />,
      title: 'Expertise',
      description:
        "Notre équipe possède une expertise approfondie dans le domaine du conseil et de l'innovation.",
    },
    {
      icon: <Sparkles className='w-8 h-8' />,
      title: 'Intégrité',
      description:
        'Nous agissons avec transparence et honnêteté dans toutes nos relations professionnelles.',
    },
    {
      icon: <Medal className='w-8 h-8' />,
      title: 'Excellence',
      description:
        "Nous visons l'excellence dans chaque projet et chaque service que nous fournissons.",
    },
  ];

  return (
    <section className='py-16 sm:py-24 bg-linear-to-b from-sky-50 to-white'>
      <div className='mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='text-center mb-14'>
          <h2 className='text-3xl sm:text-4xl font-bold text-sky-500 mb-4'>
            Nos Valeurs
          </h2>
          <p className='text-lg text-gray-600 max-w-3xl mx-auto'>
            Les principes qui guident chacune de nos actions et interactions
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
          {valeurs.map((valeur, index) => (
            <div
              key={index}
              className='group relative p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border-b-4 border-transparent hover:border-sky-500'
            >
              <div className='absolute -top-5 left-6 p-2 bg-sky-400 text-white rounded-full group-hover:bg-sky-500 transition-colors duration-300'>
                {valeur.icon}
              </div>
              <h3 className='mt-6 text-xl font-semibold text-sky-600 group-hover:text-sky-500 transition-colors duration-300'>
                {valeur.title}
              </h3>
              <p className='mt-3 text-gray-600 leading-relaxed'>
                {valeur.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Valeur;
