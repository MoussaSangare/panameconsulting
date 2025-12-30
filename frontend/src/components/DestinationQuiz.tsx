import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Languages,
  BookOpen,
  MapPin,
  Sparkles,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Heart,
  Globe,
} from 'lucide-react';

// Types
interface Question {
  id: string;
  question: string;
  icon: React.ReactElement;
  options: {
    value: string;
    label: string;
    description?: string;
  }[];
}

interface Destination {
  id: string;
  name: string;
  description: string;
  advantages: string[];
  score: number;
  matchPercentage: number;
  flag: string;
  costLevel: 'low' | 'medium' | 'high';
  language: string[];
  specialties: string[];
}

// Composant Loader simple
const Loader: React.FC<{ message?: string; subMessage?: string }> = ({
  message = 'Chargement...',
  subMessage,
}) => {
  return (
    <div className='text-center max-w-md'>
      <div className='relative w-24 h-24 mx-auto mb-6'>
        <div className='absolute inset-0 bg-linear-to-r from-sky-400 to-blue-500 rounded-full opacity-20 blur-xl animate-pulse'></div>
        <div className='absolute inset-4 border-4 border-sky-300 rounded-full border-t-transparent animate-spin'></div>
        <div className='absolute inset-6 bg-linear-to-r from-sky-100 to-blue-100 rounded-full flex items-center justify-center'>
          <Globe className='h-8 w-8 text-sky-600 animate-pulse' />
        </div>
      </div>

      <div className='space-y-3'>
        <h3 className='text-lg font-bold text-gray-800'>{message}</h3>
        {subMessage && <p className='text-gray-600 text-sm'>{subMessage}</p>}

        <div className='w-full bg-gray-200 rounded-full h-1.5 mt-4'>
          <div
            className='bg-linear-to-r from-sky-500 to-blue-500 h-1.5 rounded-full animate-pulse'
            style={{ width: '75%' }}
          ></div>
        </div>
      </div>
    </div>
  );
};

// Composant de carte de destination optimisé
const DestinationCard: React.FC<{ destination: Destination; rank: number }> =
  React.memo(({ destination, rank }) => (
    <div
      className={`relative border-2 rounded-xl p-3 text-left flex flex-col h-full transition-all duration-300 hover:shadow-lg ${
        rank === 1
          ? 'border-sky-400 bg-linear-to-br from-sky-50 via-white to-blue-50 shadow-md'
          : rank === 2
            ? 'border-blue-300 bg-linear-to-br from-blue-50 to-white shadow-sm'
            : 'border-gray-200 bg-white shadow-xs'
      }`}
    >
      {/* Badge de rang avec effet dégradé */}
      <div
        className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md ${
          rank === 1
            ? 'bg-linear-to-r from-yellow-400 via-yellow-500 to-orange-500'
            : rank === 2
              ? 'bg-linear-to-r from-gray-400 via-gray-500 to-gray-600'
              : 'bg-linear-to-r from-amber-700 via-amber-800 to-amber-900'
        }`}
      >
        #{rank}
      </div>

      {/* En-tête avec drapeau et score */}
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center space-x-2'>
          <span className='text-xl'>{destination.flag}</span>
          <div>
            <h3 className='text-base font-bold text-gray-900'>
              {destination.name}
            </h3>
            <div className='flex items-center space-x-1 mt-0.5'>
              <div
                className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  destination.costLevel === 'low'
                    ? 'bg-green-100 text-green-800'
                    : destination.costLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {destination.costLevel === 'low'
                  ? '💰 Faible coût'
                  : destination.costLevel === 'medium'
                    ? '💰 Coût moyen'
                    : '💰 Élevé'}
              </div>
            </div>
          </div>
        </div>
        <div className='flex items-center bg-linear-to-r from-sky-100 to-blue-100 px-2 py-1 rounded-full shadow-xs'>
          <Sparkles className='h-3 w-3 text-sky-600 mr-1' />
          <span className='text-xs font-bold text-sky-700'>
            {destination.matchPercentage}%
          </span>
        </div>
      </div>

      {/* Description */}
      <p className='text-gray-600 text-xs mb-3 grow'>
        {destination.description}
      </p>

      {/* Langues */}
      <div className='mb-2'>
        <div className='flex items-center text-xs font-medium text-sky-600 mb-1'>
          <Globe className='h-3 w-3 mr-1' />
          Langues : {destination.language.join(', ')}
        </div>
      </div>

      {/* Avantages */}
      <div className='mt-1'>
        <h4 className='font-semibold text-sky-600 text-xs mb-2 flex items-center'>
          <BadgeCheck className='h-3 w-3 mr-1.5' />
          Points forts :
        </h4>
        <ul className='space-y-1.5'>
          {destination.advantages.slice(0, 3).map((advantage, i) => (
            <li key={i} className='flex items-start group'>
              <div className='h-1.5 w-1.5 rounded-full bg-sky-500 mr-2 mt-1 shrink-0 group-hover:scale-125 transition-transform'></div>
              <span className='text-gray-700 text-xs leading-relaxed'>
                {advantage}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  ));

const DestinationQuiz: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Destination[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Questions avec plus de profondeur
  const questions: Question[] = useMemo(
    () => [
      {
        id: 'budget',
        question: 'Quel est votre budget annuel pour les études ?',
        icon: <Banknote className='w-6 h-6 text-sky-600' />,
        options: [
          {
            value: 'low',
            label: '2-3M FCFA',
            description: 'Budget économique',
          },
          { value: 'medium', label: '3-5M FCFA', description: 'Budget moyen' },
          {
            value: 'high',
            label: '5-10M FCFA',
            description: 'Budget confortable',
          },
          {
            value: 'premium',
            label: '10M+ FCFA',
            description: 'Budget premium',
          },
        ],
      },
      {
        id: 'language',
        question: 'Quelle est votre préférence linguistique ?',
        icon: <Languages className='w-6 h-6 text-sky-600' />,
        options: [
          { value: 'fr', label: 'Français', description: 'Exclusivement' },
          { value: 'en', label: 'Anglais', description: 'Exclusivement' },
          {
            value: 'fr-en',
            label: 'Français/Anglais',
            description: 'Bilingue',
          },
          {
            value: 'other',
            label: 'Autre',
            description: 'Ouvert aux autres langues',
          },
        ],
      },
      {
        id: 'field',
        question: 'Dans quel domaine souhaitez-vous étudier ?',
        icon: <BookOpen className='w-6 h-6 text-sky-600' />,
        options: [
          { value: 'tech', label: 'Technologie & Informatique' },
          { value: 'medical', label: 'Médecine & Santé' },
          { value: 'engineering', label: 'Ingénierie & Sciences' },
          { value: 'business', label: 'Commerce & Management' },
          { value: 'arts', label: 'Arts & Culture' },
        ],
      },
      {
        id: 'career',
        question: 'Quel est votre objectif professionnel principal ?',
        icon: <Briefcase className='w-6 h-6 text-sky-600' />,
        options: [
          { value: 'local', label: 'Travailler dans mon pays' },
          { value: 'international', label: 'Carrière internationale' },
          { value: 'research', label: 'Recherche académique' },
          { value: 'entrepreneur', label: 'Entrepreneuriat' },
        ],
      },
      {
        id: 'lifestyle',
        question: 'Quel style de vie recherchez-vous ?',
        icon: <Heart className='w-6 h-6 text-sky-600' />,
        options: [
          { value: 'dynamic', label: 'Vie dynamique et urbaine' },
          { value: 'traditional', label: 'Culture traditionnelle' },
          { value: 'balanced', label: 'Équilibre vie pro/perso' },
          { value: 'adventure', label: 'Aventure et découverte' },
        ],
      },
    ],
    []
  );

  // Destinations avec plus de détails
  const destinations: Destination[] = useMemo(
    () => [
      {
        id: 'france',
        name: 'France',
        description:
          'Excellence académique avec grandes écoles prestigieuses, culture riche et reconnaissance mondiale.',
        advantages: [
          'Grandes écoles (Polytechnique, HEC, Sorbonne)',
          'Frais universitaires très bas pour étudiants internationaux',
          'Système de bourses Excellence-Major',
          'Vie étudiante dynamique et culture riche',
          'Diplômes reconnus mondialement',
          'Centre de recherche européen',
        ],
        score: 0,
        matchPercentage: 0,
        flag: '🇫🇷',
        costLevel: 'medium',
        language: ['Français', 'Anglais'],
        specialties: ['Ingénierie', 'Commerce', 'Sciences', 'Arts'],
      },
      {
        id: 'russie',
        name: 'Russie',
        description:
          "Formation scientifique d'excellence avec coûts abordables, tradition académique solide.",
        advantages: [
          'Universités réputées en médecine (Sechenov)',
          'Coûts très compétitifs (1-3M FCFA/an)',
          'Programmes en anglais disponibles',
          'Logement étudiant à bas prix',
          'Bourses gouvernementales nombreuses',
          'Fort en sciences et technologies',
        ],
        score: 0,
        matchPercentage: 0,
        flag: '🇷🇺',
        costLevel: 'low',
        language: ['Russe', 'Anglais'],
        specialties: ['Médecine', 'Sciences', 'Ingénierie', 'Technologie'],
      },
      {
        id: 'maroc',
        name: 'Maroc',
        description:
          'Proximité culturelle, coûts abordables, pont entre Afrique et Europe.',
        advantages: [
          'Coûts très compétitifs (1-2M FCFA/an)',
          'Environnement francophone familier',
          'Universités reconnues (UM6P, Al Akhawayn)',
          'Proximité géographique pour africains',
          'Économie en forte croissance',
          'Culture riche et hospitalière',
        ],
        score: 0,
        matchPercentage: 0,
        flag: '🇲🇦',
        costLevel: 'low',
        language: ['Français', 'Arabe'],
        specialties: ['Commerce', 'Ingénierie', 'Tourisme', 'Agriculture'],
      },
      {
        id: 'algerie',
        name: 'Algérie',
        description:
          'Destination économique avec système éducatif francophone en développement.',
        advantages: [
          'Coûts extrêmement bas (< 1M FCFA/an)',
          'Environnement francophone intégral',
          'Proximité culturelle totale',
          'Universités en développement rapide',
          'Frais de scolarité presque gratuits',
          'Accueil chaleureux',
        ],
        score: 0,
        matchPercentage: 0,
        flag: '🇩🇿',
        costLevel: 'low',
        language: ['Français', 'Arabe'],
        specialties: ['Médecine', 'Ingénierie', 'Droit', 'Sciences'],
      },
      {
        id: 'turquie',
        name: 'Turquie',
        description:
          'Pont entre Orient et Occident, éducation de qualité à prix modéré.',
        advantages: [
          'Coûts raisonnables (2-4M FCFA/an)',
          'Mix culturel unique',
          'Universités anglophones de qualité',
          'Position géostratégique importante',
          'Économie dynamique',
          'Programmes de bourses Turkiye Bursları',
        ],
        score: 0,
        matchPercentage: 0,
        flag: '🇹🇷',
        costLevel: 'medium',
        language: ['Turc', 'Anglais'],
        specialties: [
          'Ingénierie',
          'Médecine',
          'Relations Internationales',
          'Tourisme',
        ],
      },
      {
        id: 'chine',
        name: 'Chine',
        description:
          "Superpuissance économique avec investissements massifs dans l'éducation.",
        advantages: [
          'Bourses gouvernementales complètes',
          'Universités de rang mondial (Tsinghua, Peking)',
          'Croissance économique exceptionnelle',
          'Programmes en anglais nombreux',
          'Technologie de pointe',
          'Expérience culturelle unique',
        ],
        score: 0,
        matchPercentage: 0,
        flag: '🇨🇳',
        costLevel: 'medium',
        language: ['Chinois', 'Anglais'],
        specialties: [
          'Technologie',
          'Ingénierie',
          'Business',
          'Médecine Traditionnelle',
        ],
      },
    ],
    []
  );

  // Logique de scoring avancée
  const calculateResults = useCallback(
    (answers: Record<string, string>): Destination[] => {
      const scoredDestinations = destinations.map(d => ({ ...d, score: 0 }));

      // Facteurs de pondération
      const weights = {
        budget: 4,
        language: 3,
        field: 3,
        career: 2,
        lifestyle: 2,
      };

      // Règles de scoring détaillées
      Object.entries(answers).forEach(([questionId, answer]) => {
        const weight = weights[questionId as keyof typeof weights] || 1;

        scoredDestinations.forEach(dest => {
          let scoreToAdd = 0;

          switch (questionId) {
            case 'budget':
              if (
                answer === 'low' &&
                ['algerie', 'maroc', 'russie'].includes(dest.id)
              )
                scoreToAdd = 4;
              if (
                answer === 'medium' &&
                ['turquie', 'chine', 'france'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (answer === 'high' && ['france', 'chine'].includes(dest.id))
                scoreToAdd = 3;
              if (answer === 'premium' && ['france'].includes(dest.id))
                scoreToAdd = 4;
              break;

            case 'language':
              if (
                answer === 'fr' &&
                ['france', 'maroc', 'algerie'].includes(dest.id)
              )
                scoreToAdd = 4;
              if (
                answer === 'en' &&
                ['chine', 'turquie', 'russie'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (answer === 'fr-en' && ['france', 'maroc'].includes(dest.id))
                scoreToAdd = 3;
              if (answer === 'other' && ['chine', 'turquie'].includes(dest.id))
                scoreToAdd = 2;
              break;

            case 'field':
              if (
                answer === 'tech' &&
                ['chine', 'russie', 'france'].includes(dest.id)
              )
                scoreToAdd = 4;
              if (
                answer === 'medical' &&
                ['russie', 'france', 'chine'].includes(dest.id)
              )
                scoreToAdd = 4;
              if (
                answer === 'engineering' &&
                ['france', 'chine', 'turquie', 'russie'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (
                answer === 'business' &&
                ['france', 'maroc', 'turquie'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (
                answer === 'arts' &&
                ['france', 'turquie', 'maroc'].includes(dest.id)
              )
                scoreToAdd = 3;
              break;

            case 'career':
              if (
                answer === 'international' &&
                ['france', 'chine', 'turquie'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (answer === 'local' && ['maroc', 'algerie'].includes(dest.id))
                scoreToAdd = 4;
              if (
                answer === 'research' &&
                ['france', 'chine', 'russie'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (
                answer === 'entrepreneur' &&
                ['chine', 'turquie', 'maroc'].includes(dest.id)
              )
                scoreToAdd = 3;
              break;

            case 'lifestyle':
              if (
                answer === 'dynamic' &&
                ['chine', 'turquie', 'france'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (
                answer === 'traditional' &&
                ['maroc', 'algerie', 'turquie'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (
                answer === 'balanced' &&
                ['france', 'maroc'].includes(dest.id)
              )
                scoreToAdd = 3;
              if (
                answer === 'adventure' &&
                ['chine', 'russie', 'turquie'].includes(dest.id)
              )
                scoreToAdd = 4;
              break;
          }

          dest.score += scoreToAdd * weight;
        });
      });

      // Bonus pour compatibilité globale
      scoredDestinations.forEach(dest => {
        // Bonus pour francophones
        if (answers.language === 'fr' && dest.language.includes('Français')) {
          dest.score += 2;
        }
        // Bonus pour anglophones
        if (answers.language === 'en' && dest.language.includes('Anglais')) {
          dest.score += 2;
        }
        // Bonus budget
        if (
          (answers.budget === 'low' && dest.costLevel === 'low') ||
          (answers.budget === 'premium' && dest.costLevel === 'high')
        ) {
          dest.score += 3;
        }
      });

      const maxPossibleScore = 70;
      const filtered = scoredDestinations.filter(d => d.score > 0);

      if (filtered.length === 0) {
        return destinations.slice(0, 3).map((d, i) => ({
          ...d,
          matchPercentage: 80 - i * 10,
        }));
      }

      return filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(d => ({
          ...d,
          matchPercentage: Math.min(
            98,
            Math.max(65, Math.round((d.score / maxPossibleScore) * 100))
          ),
        }));
    },
    [destinations]
  );

  // Gestion des réponses avec animation
  const handleAnswer = useCallback(
    async (questionId: string, answer: string) => {
      setSelectedOption(answer);

      const newAnswers = { ...answers, [questionId]: answer };
      setAnswers(newAnswers);

      await new Promise(resolve => globalThis.setTimeout(resolve, 300));

      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
        setSelectedOption(null);
      } else {
        setIsCalculating(true);
        globalThis.setTimeout(() => {
          const topDestinations = calculateResults(newAnswers);
          setResults(topDestinations);
          setIsCalculating(false);
        }, 1500);
      }
    },
    [answers, currentStep, questions.length, calculateResults]
  );

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setSelectedOption(answers[questions[currentStep - 1].id] || null);
    }
  }, [currentStep, answers, questions]);

  const progress = ((currentStep + 1) / questions.length) * 100;

  // Écran de résultats
  if (results.length > 0) {
    return (
      <div className='min-h-screen bg-gray-50 py-6 px-4 sm:px-6'>
        <div className='max-w-6xl mx-auto'>
          {/* En-tête avec effet visuel */}
          <div className='text-center mb-8 relative'>
            <div className='mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-linear-to-r from-sky-100 to-blue-100 shadow-md mb-4'>
              <MapPin className='h-8 w-8 text-sky-600' />
            </div>
            <div className='absolute top-0 right-10 w-20 h-20 bg-blue-100 rounded-full opacity-20 blur-lg'></div>
            <div className='absolute bottom-0 left-10 w-16 h-16 bg-sky-100 rounded-full opacity-20 blur-lg'></div>

            <h1 className='text-2xl sm:text-3xl font-bold bg-linear-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent'>
              Vos Destinations Idéales
            </h1>
            <p className='text-gray-600 max-w-2xl mx-auto text-sm'>
              Basé sur vos préférences, découvrez les pays qui correspondent le
              mieux à votre projet d'études
            </p>
          </div>

          {/* Grille des résultats */}
          <div className='grid gap-6 md:grid-cols-3 mb-8'>
            {results.map((destination, index) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                rank={index + 1}
              />
            ))}
          </div>

          {/* Statistiques */}
          <div className='bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8'>
            <h3 className='font-bold text-gray-800 mb-4 text-base'>
              Analyse de vos résultats
            </h3>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='text-center p-3 bg-sky-50 rounded-lg'>
                <div className='text-xl font-bold text-sky-600'>
                  {results[0]?.matchPercentage}%
                </div>
                <div className='text-xs text-gray-600'>Meilleur match</div>
              </div>
              <div className='text-center p-3 bg-blue-50 rounded-lg'>
                <div className='text-xl font-bold text-blue-600'>
                  {results.length}
                </div>
                <div className='text-xs text-gray-600'>
                  Destinations recommandées
                </div>
              </div>
              <div className='text-center p-3 bg-sky-50 rounded-lg'>
                <div className='text-xl font-bold text-sky-600'>
                  {results.filter(d => d.costLevel === 'low').length}
                </div>
                <div className='text-xs text-gray-600'>
                  Destinations économiques
                </div>
              </div>
              <div className='text-center p-3 bg-blue-50 rounded-lg'>
                <div className='text-xl font-bold text-blue-600'>
                  {new Set(results.flatMap(d => d.language)).size}
                </div>
                <div className='text-xs text-gray-600'>Langues proposées</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className='text-center space-y-4'>
            <div className='flex flex-col sm:flex-row justify-center gap-3'>
              <Link
                to='/rendez-vous'
                className='inline-flex items-center justify-center px-6 py-2.5 font-bold text-white bg-linear-to-r from-sky-500 to-blue-500 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-sm'
              >
                Discuter avec un conseiller
                <ChevronRight className='ml-2 h-4 w-4' />
              </Link>

              <button
                onClick={() => {
                  setCurrentStep(0);
                  setAnswers({});
                  setResults([]);
                  setSelectedOption(null);
                }}
                className='inline-flex items-center justify-center px-6 py-2.5 font-semibold text-sky-600 border-2 border-sky-200 rounded-lg hover:bg-sky-50 transition-all duration-300 text-sm'
              >
                <svg
                  className='w-4 h-4 mr-1.5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
                Refaire le test
              </button>
            </div>

            <p className='text-gray-500 text-xs'>
              Ces résultats sont basés sur l'analyse de {questions.length}{' '}
              critères personnalisés
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Écran de chargement avec Loader
  if (isCalculating) {
    return (
      <div className='min-h-screen bg-white flex flex-col items-center justify-center p-4'>
        <Loader
          message='Calcul de vos résultats...'
          subMessage={`Analyse de ${destinations.length} destinations selon ${Object.keys(answers).length} critères`}
        />
      </div>
    );
  }

  // Interface du questionnaire
  const currentQuestion = questions[currentStep];

  return (
    <div className='min-h-screen bg-gray-50 py-6 px-4 sm:px-6'>
      <div className='max-w-2xl mx-auto'>
        {/* Barre de progression */}
        <div className='mb-6'>
          <div className='flex justify-between items-center mb-3'>
            <div className='text-sm font-medium text-sky-600'>
              <span className='bg-sky-100 px-2.5 py-1 rounded-full'>
                Question {currentStep + 1}/{questions.length}
              </span>
            </div>
            <div className='text-sm font-bold text-sky-500'>
              {Math.round(progress)}% complété
            </div>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-2 shadow-inner'>
            <div
              className='bg-linear-to-r from-sky-500 to-blue-500 h-2 rounded-full transition-all duration-700 shadow-sm'
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Carte de question */}
        <div className='bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6'>
          {/* En-tête */}
          <div className='p-5 text-center border-b border-gray-100 bg-linear-to-r from-sky-50 to-blue-50'>
            <div className='flex justify-center mb-4'>
              <div className='p-2.5 bg-white rounded-full shadow-xs'>
                {currentQuestion.icon}
              </div>
            </div>
            <h2 className='text-xl font-bold text-gray-900 mb-2'>
              {currentQuestion.question}
            </h2>
            <div className='text-xs text-gray-500'>
              Sélectionnez l'option qui vous correspond le mieux
            </div>
          </div>

          {/* Options */}
          <div className='p-4 space-y-2'>
            {currentQuestion.options.map(option => (
              <button
                key={option.value}
                onClick={() => handleAnswer(currentQuestion.id, option.value)}
                className={`w-full p-3 text-left rounded-lg border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                  selectedOption === option.value
                    ? 'border-sky-500 bg-linear-to-r from-sky-50 to-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'
                }`}
              >
                <div className='flex items-start'>
                  <div
                    className={`shrink-0 flex items-center justify-center h-5 w-5 rounded-full border mr-3 mt-0.5 ${
                      selectedOption === option.value
                        ? 'border-sky-500 bg-sky-500'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {selectedOption === option.value && (
                      <div className='h-1.5 w-1.5 rounded-full bg-white'></div>
                    )}
                  </div>
                  <div className='flex-1'>
                    <div className='font-semibold text-gray-900 text-sm mb-1'>
                      {option.label}
                    </div>
                    {option.description && (
                      <div className='text-xs text-gray-600'>
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className='bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100'>
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center font-medium px-3 py-1.5 rounded-lg transition-all ${
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-sky-500 hover:text-sky-600 hover:bg-sky-100'
              }`}
            >
              <ChevronLeft className='w-4 h-4 mr-1.5' />
              <span className='text-sm'>Précédent</span>
            </button>

            <div className='text-xs text-gray-500 font-medium'>
              <span className='text-sky-500 font-bold'>{currentStep + 1}</span>{' '}
              / {questions.length}
            </div>
          </div>
        </div>

        {/* Indicateurs de progression */}
        <div className='flex justify-between items-center px-4'>
          <div className='text-xs text-gray-500'>
            {currentStep > 0
              ? `${Object.keys(answers).length} réponses enregistrées`
              : 'Commencez par la première question'}
          </div>
          <div className='flex space-x-1.5'>
            {questions.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 w-6 rounded-full transition-all duration-500 ${
                  index === currentStep
                    ? 'bg-linear-to-r from-sky-500 to-blue-500'
                    : index < currentStep
                      ? 'bg-green-400'
                      : 'bg-gray-300'
                }`}
                title={`Question ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Information */}
        <div className='mt-6 text-center'>
          <div className='inline-flex items-center text-xs text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200'>
            <Sparkles className='h-3 w-3 text-sky-500 mr-1.5' />
            Analyse personnalisée de {destinations.length} destinations
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DestinationQuiz);
