import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import {
  BookOpen as FiBookOpen,
  ChevronDown as FiChevronDown,
  Cloud as FiCloud,
  CreditCard as FiCreditCard,
  Globe as FiGlobe,
  Mail as FiMail,
  Smartphone as FiSmartphone,
  Target as FiTarget,
  ThumbsUp as FiThumbsUp,
  Users as FiUsers,
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
  category: string;
}

const faqData: FaqItem[] = [
  {
    question: 'Quels services propose Paname Consulting ?',
    answer:
      "Conseil stratégique, formation professionnelle, accompagnement pour études à l'étranger, demande de visa, création de compte Pastel et préparation aux entretiens.",
    icon: <FiTarget className='w-5 h-5 text-sky-600' />,
    category: 'Services & Formations',
  },
  {
    question: "Comment m'inscrire à une formation ?",
    answer:
      'Inscription via notre site web, par téléphone ou en agence. Processus simplifié en 3 étapes : choix de la formation, validation du dossier et paiement.',
    icon: <FiBookOpen className='w-5 h-5 text-sky-600' />,
    category: 'Services & Formations',
  },
  {
    question: 'Formations en ligne disponibles ?',
    answer:
      "Catalogue de formations 100% en ligne : rédaction de CV/LM, techniques d'entretien, préparation aux tests linguistiques.",
    icon: <FiMail className='w-5 h-5 text-sky-600' />,
    category: 'Services & Formations',
  },
  {
    question: 'Comment puis-je contacter Paname Consulting ?',
    answer:
      'Téléphone : +223 91 83 09 41 - Formulaire de contact sur notre site - Email : panameconsulting906@gmail.com',
    icon: <FiSmartphone className='w-5 h-5 text-sky-600' />,
    category: 'Contact & Support',
  },
  {
    question: 'Services disponibles à distance ?',
    answer:
      'Tous nos services accessibles en ligne avec suivi personnalisé via notre plateforme sécurisée.',
    icon: <FiGlobe className='w-5 h-5 text-sky-600' />,
    category: 'Contact & Support',
  },
  {
    question: 'Options de paiement acceptées ?',
    answer:
      'Moneygram, Western Union, Orange Money, virements bancaires. Paiement échelonné possible.',
    icon: <FiCreditCard className='w-5 h-5 text-sky-600' />,
    category: 'Paiement & Tarifs',
  },
  {
    question: 'Proposez-vous des accompagnements visas ?',
    answer:
      "Oui, accompagnement complet : préparation dossier, simulation d'entretien, suivi jusqu'à l'obtention du visa. Taux de réussite de 92%.",
    icon: <FiCloud className='w-5 h-5 text-sky-600' />,
    category: 'Accompagnement & Suivi',
  },
  {
    question: 'Quel est votre taux de satisfaction ?',
    answer:
      '95% de nos étudiants recommandent nos services. Suivi personnalisé et résultats concrets depuis 2018.',
    icon: <FiThumbsUp className='w-5 h-5 text-sky-600' />,
    category: 'Accompagnement & Suivi',
  },
];

const categories = [
  { name: 'Services & Formations', icon: <FiBookOpen className='w-5 h-5' /> },
  { name: 'Contact & Support', icon: <FiSmartphone className='w-5 h-5' /> },
  { name: 'Paiement & Tarifs', icon: <FiCreditCard className='w-5 h-5' /> },
  { name: 'Accompagnement & Suivi', icon: <FiUsers className='w-5 h-5' /> },
];

const Faq = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(
    'Services & Formations'
  );

  const filteredFaqs = faqData.filter(item => item.category === activeCategory);

  return (
    <section className='py-16 px-4 sm:px-6 lg:px-8 bg-linear-to-br from-sky-50 to-white'>
      <div className='max-w-7xl mx-auto'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='text-center mb-12'
        >
          <h2 className='text-4xl font-bold text-gray-900 mb-4'>
            <span className='block text-sky-600 text-sm uppercase tracking-wide mb-3'>
              Support & Assistance
            </span>
            Foire aux questions
          </h2>
          <p className='text-gray-600 max-w-2xl mx-auto'>
            Trouvez rapidement les réponses à vos questions les plus fréquentes
          </p>
        </motion.div>

        {/* Catégories */}
        <div className='flex flex-wrap justify-center gap-4 mb-8'>
          {categories.map(category => (
            <button
              key={category.name}
              onClick={() => setActiveCategory(category.name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${
                  activeCategory === category.name
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-200'
                    : 'bg-white text-gray-600 hover:bg-sky-50 hover:text-sky-600'
                }`}
            >
              {category.icon}
              {category.name}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className='grid gap-4'>
          {filteredFaqs.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className='rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-300'
            >
              <button
                onClick={() =>
                  setActiveIndex(activeIndex === index ? null : index)
                }
                className='w-full p-6 flex items-center justify-between gap-4 group'
              >
                <div className='flex items-center gap-4'>
                  <div className='p-2 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors'>
                    {item.icon}
                  </div>
                  <h3 className='text-lg font-medium text-gray-900 text-left'>
                    {item.question}
                  </h3>
                </div>

                <motion.span
                  animate={{ rotate: activeIndex === index ? 180 : 0 }}
                  className='text-sky-600 ml-2'
                >
                  <FiChevronDown className='w-6 h-6' />
                </motion.span>
              </button>

              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className='overflow-hidden'
                  >
                    <div className='px-6 pb-6 pt-2 border-t border-gray-100'>
                      <p className='text-gray-600 leading-relaxed pl-14'>
                        {item.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Faq;
