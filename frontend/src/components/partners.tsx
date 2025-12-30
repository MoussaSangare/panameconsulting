import { motion } from 'framer-motion';
import { ExternalLink, MapPin, Star, Globe } from 'lucide-react';

/**
 * Liste des partenaires institutionnels
 * @type {Array<{
 *   id: number,
 *   name: string,
 *   location: string,
 *   image: string,
 *   link: string,
 *   description?: string,
 *   category: string,
 *   since?: string
 * }>}
 */
const partners = [
  {
    id: 1,
    name: 'Supemir',
    location: 'Casablanca, Maroc',
    image: '/supemir.webp',
    link: 'https://www.supemir.com/',
    description:
      'École supérieure de commerce et de management renommée au Maroc, spécialisée dans les formations en gestion et commerce international.',
    category: 'IT et MANAGEMENT',
    since: '2025',
  },
  {
    id: 2,
    name: "L'École Multimédia",
    location: 'Paris, France',
    image: '/Ecolemultimediafrance.webp',
    link: 'https://www.ecole-multimedia.com/',
    description:
      'École pionnière dans la formation aux métiers du digital, du design et du développement web à Paris.',
    category: 'DIGITAL & MULTIMEDIA',
    since: '2025',
  },
  {
    id: 3,
    name: 'International Institute Ford Ghana',
    location: 'Accra, Ghana',
    image: '/internationalinstitute.png',
    link: 'https://visionfordgh.com/',
    description:
      "Institut international de formation offrant des programmes éducatifs innovants au Ghana et en Afrique de l'Ouest.",
    category: 'FORMATION EN ANGLAIS',
    since: '2025',
  },
  {
    id: 4,
    name: 'Université de Chongqing',
    location: 'Chongqing, Chine',
    image: '/universitechiongqing.png',
    link: 'https://english.cqu.edu.cn/',
    description:
      'Université prestigieuse classée parmi les meilleures institutions de recherche en Chine, avec des programmes académiques diversifiés.',
    category: 'RECHERCHE & INNOVATION',
    since: '2025',
  },
];

/**
 * Composant Partners - Affiche la section des partenaires institutionnels
 * @returns {JSX.Element} Section des partenaires
 */
const Partners = () => {
  return (
    <section
      className='py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-linear-to-br from-sky-50 via-white to-blue-50 relative overflow-hidden'
      aria-labelledby='partners-heading'
    >
      {/* Effets de fond décoratifs améliorés */}
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute -right-10 -top-10 w-80 h-80 rounded-full bg-sky-300/20 blur-[100px] animate-pulse-slow' />
        <div className='absolute -left-10 -bottom-10 w-80 h-80 rounded-full bg-blue-300/20 blur-[100px] animate-pulse-slow delay-700' />
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-200/10 blur-[120px] animate-pulse-slow delay-300' />
      </div>

      <div className='max-w-7xl mx-auto relative'>
        {/* En-tête améliorée */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -100px 0px' }}
          transition={{ duration: 0.6 }}
          className='text-center mb-16 sm:mb-20'
        >
          <motion.h2
            id='partners-heading'
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className='text-4xl sm:text-5xl font-bold text-gray-900 mb-4'
          >
            Nos Institutions{' '}
            <span className='text-transparent bg-clip-text bg-linear-to-r from-sky-600 to-blue-600'>
              Partenaires
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className='text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'
          >
            Collaborations exclusives avec des établissements d'excellence
            internationale pour offrir des opportunités éducatives et
            professionnelles uniques.
          </motion.p>
        </motion.div>

        {/* Grille des partenaires améliorée */}
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8'>
          {partners.map((partner, index) => (
            <motion.article
              key={partner.id}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '0px 0px -50px 0px' }}
              transition={{
                delay: index * 0.1,
                type: 'spring',
                stiffness: 90,
                damping: 15,
              }}
              whileHover={{ y: -5 }}
              className='group relative'
            >
              {/* Carte principale */}
              <div className='relative h-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-white/20'>
                {/* Badge de catégorie */}
                <div className='absolute top-4 left-4 z-10'>
                  <span className='inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-sky-700 text-xs font-medium px-3 py-1.5 rounded-full border border-sky-200/50'>
                    <Globe className='w-3 h-3' />
                    {partner.category}
                  </span>
                </div>

                {/* Container d'image avec overlay amélioré */}
                <div className='relative h-44 sm:h-52 bg-linear-to-br from-gray-100 to-gray-200 overflow-hidden'>
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className='h-full w-full'
                  >
                    <img
                      src={partner.image}
                      alt={`Logo de ${partner.name}`}
                      className='object-cover object-center w-full h-full transition-transform duration-500'
                      loading='lazy'
                      width='400'
                      height='300'
                    />
                  </motion.div>

                  {/* Overlay de gradient amélioré */}
                  <div className='absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-500' />

                  {/* Effet de brillance au survol */}
                  <div className='absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000' />
                </div>

                {/* Contenu de la carte */}
                <div className='relative p-5 sm:p-6'>
                  <div className='mb-4'>
                    <h3 className='text-xl font-bold text-gray-900 mb-2 group-hover:text-sky-700 transition-colors duration-300 line-clamp-1'>
                      {partner.name}
                    </h3>

                    <div className='flex items-center text-gray-600 mb-3'>
                      <MapPin
                        className='w-4 h-4 text-sky-500 mr-2 shrink-0'
                        aria-hidden='true'
                      />
                      <span className='text-sm font-medium'>
                        {partner.location}
                      </span>
                    </div>

                    <p className='text-gray-600 text-sm leading-relaxed line-clamp-3 group-hover:text-gray-700 transition-colors duration-300'>
                      {partner.description}
                    </p>
                  </div>

                  {/* Informations supplémentaires */}
                  <div className='flex items-center justify-between mb-4 pt-3 border-t border-gray-100'>
                    {partner.since && (
                      <div className='text-xs text-gray-500'>
                        Partenaire depuis{' '}
                        <span className='font-semibold text-sky-600'>
                          {partner.since}
                        </span>
                      </div>
                    )}
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      className='inline-flex items-center gap-1 bg-linear-to-r from-sky-500 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full'
                    >
                      <Star className='w-3 h-3' />
                      Actif
                    </motion.span>
                  </div>

                  {/* Bouton d'action */}
                  <motion.a
                    href={partner.link}
                    target='_blank'
                    rel='noopener noreferrer'
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className='w-full inline-flex items-center justify-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium py-2.5 px-4 rounded-xl transition-all duration-300 group/btn border border-sky-200/50'
                    aria-label={`Visiter le site de ${partner.name}`}
                  >
                    <span className='text-sm'>Visiter le site</span>
                    <ExternalLink
                      className='w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-0.5'
                      aria-hidden='true'
                    />
                  </motion.a>
                </div>

                {/* Bordure animée */}
                <div className='absolute inset-0 rounded-2xl bg-linear-to-r from-sky-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none' />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Partners;