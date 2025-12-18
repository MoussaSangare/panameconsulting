import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Renommer l'interface pour éviter le conflit avec le composant
interface DestinationType {
  _id: string;
  country: string;
  imagePath: string;
  text: string;
}

const defaultDestinations: DestinationType[] = [
  {
    _id: '1',
    country: 'Russie',
    imagePath: '/russie.png',
    text: "La Russie propose un enseignement supérieur d'excellence avec des universités historiques comme MGU. Système éducatif combinant tradition et recherche de pointe dans un environnement multiculturel. Coûts de scolarité très compétitifs et bourses disponibles pour étudiants internationaux. Logements universitaires abordables et infrastructures modernes.",
  },
  {
    _id: '2',
    country: 'Chine',
    imagePath: '/chine.jpg',
    text: 'La Chine développe des pôles universitaires high-tech avec des programmes innovants en IA et commerce international. Universités comme Tsinghua rivalisent avec les meilleures mondiales. Environnement dynamique combinant technologie et culture millénaire. Cours en anglais disponibles avec des partenariats industriels solides pour des stages en entreprise.',
  },
  {
    _id: '3',
    country: 'Maroc',
    imagePath: '/maroc.webp',
    text: "Le Maroc offre un enseignement de qualité en français/arabe avec des frais accessibles. Universités reconnues en Afrique et programmes d'échange avec l'Europe. Environnement sécurisé et cadre de vie agréable. Spécialisations en ingénierie, médecine et commerce avec des liens forts vers le marché africain des parcours axés sur le professionnelisme.",
  },
  {
    _id: '4',
    country: 'Algérie',
    imagePath: '/algerie.png',
    text: "L'Algérie dispose d'universités performantes en sciences et médecine avec des coûts très abordables. Système éducatif francophone et infrastructures récentes. Opportunités de recherche dans les énergies renouvelables et la pharmacologie. Vie étudiante riche et logements universitaires subventionnés / abordables.",
  },
  {
    _id: '5',
    country: 'Turquie',
    imagePath: '/turquie.webp',
    text: 'La Turquie combine éducation de qualité et frais modestes avec des universités accréditées internationalement. Position géographique unique entre Europe et Asie. Programmes en anglais disponibles avec spécialisation en ingénierie et relations internationales. Cadre de vie moderne préservant un riche héritage culturel.',
  },
  {
    _id: '6',
    country: 'France',
    imagePath: '/france.svg',
    text: "La France maintient sa tradition d'excellence académique avec des universités historiques et grandes écoles renommées. Système éducatif diversifié offrant des formations pointues dans tous les domaines. Réseau d'anciens élèves influents et forte employabilité internationale. Vie culturelle riche et nombreuses bourses disponibles.",
  },
];

const VITE_API_URL =
  (import.meta as any).env.VITE_API_URL;

const Destination = () => {
  const [destinations, setDestinations] =
    useState<DestinationType[]>(defaultDestinations);
  const [loading, setLoading] = useState(true);

  const getFullImageUrl = (imagePath: string) => {
    if (!imagePath) return '/paname-consulting.jpg';

    // URLs déjà complètes
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }

    // Images dans public (par défaut)
    if (imagePath.startsWith('/')) {
      return imagePath;
    }

    const baseUrl = VITE_API_URL;

    // Images uploadées
    let cleanPath = imagePath;
    if (!cleanPath.startsWith('uploads/')) {
      cleanPath = `uploads/${cleanPath}`;
    }
    cleanPath = cleanPath.replace(/\/\//g, '/');

    return `${baseUrl}/${cleanPath}`;
  };

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      const response = await globalThis.fetch(
        `${VITE_API_URL}/api/destinations`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        // Si la réponse n'est pas OK, utiliser les données par défaut
        setDestinations(defaultDestinations);
        return;
      }

      const result = await response.json();

      // Utiliser les données du serveur si disponibles
      if (result?.data && result.data.length > 0) {
        setDestinations(
          result.data.map((dest: any) => ({
            ...dest,
            imagePath: getFullImageUrl(dest.imagePath),
          }))
        );
      } else {
        // Si aucune donnée, utiliser les valeurs par défaut
        setDestinations(defaultDestinations);
      }
    } catch (err: any) {
      // Ajouter le type 'any' pour utiliser la variable err
      if (import.meta.env.DEV) {
        globalThis.console.warn('Erreur de chargement des destinations:', err);
      }
      // En cas d'erreur, utiliser les données par défaut
      setDestinations(defaultDestinations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500'></div>
      </div>
    );
  }

  return (
    <section className='px-5 py-20 bg-white lg:py-20'>
      <ToastContainer position='bottom-right' />
      <div className='max-w-7xl mx-auto'>
        <div className='text-center mb-16'>
           <span className='inline-block bg-sky-100 text-sky-600 px-4 py-1.5 rounded-full text-sm font-medium mb-3'>
            Nos Destinations Phares
          </span>
          <p className='text-lg text-gray-600 max-w-3xl mx-auto lg:text-xl'>
            Envie d'évasion ? Découvrez nos destinations les plus en vogue. Un
            voyage unique vous attend, juste au bon moment.
          </p>
        </div>

        <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8'>
          {destinations.map(dest => (
            <div
              key={dest._id}
              className='group bg-white rounded shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2'
            >
              <div className='relative h-52 overflow-hidden rounded'>
                <img
                  src={getFullImageUrl(dest.imagePath)}
                  alt={`${dest.country} flag`}
                  className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105'
                  onError={e => {
                    (e.target as HTMLImageElement).src =
                      '/paname-consulting.jpg';
                  }}
                  loading='lazy'
                />
              </div>

              <div className='p-6 text-center space-y-4 lg:p-8'>
                <h3 className='text-2xl font-bold text-sky-500 '>
                  {dest.country}
                </h3>
                <p className='text-gray-600 leading-relaxed text-start'>
                  {dest.text}
                </p>
                <Link
                  to='/rendez-vous'
                  state={{ preselectedDestination: dest.country }}
                  className='block mt-3 text-center bg-sky-500 hover:bg-sky-600 text-white py-2 px-4 rounded transition-colors text-sm'
                >
                  Rendez-Vous
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Destination;
