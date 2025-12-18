import {
  useState,
  useEffect,
  useCallback,
  FormEvent,
  ChangeEvent,
} from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import {
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiBook,
  FiChevronRight,
  FiChevronLeft,
  FiGlobe,
  FiTarget,
  FiAward,
  FiWatch,
  FiCheckCircle,
} from 'react-icons/fi';
import { FaGraduationCap } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';

interface Destination {
  _id: string;
  country: string;
  imagePath: string;
  text: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  destination: string;
  destinationAutre?: string;
  niveauEtude: string;
  filiere: string;
  filiereAutre?: string;
  date: string;
  time: string;
}

const API_URL = import.meta.env.VITE_API_URL;

/* global fetch, setTimeout, localStorage, console */
const RendezVous = () => {
  const { isAuthenticated, access_token, refreshToken, logout, user } =
    useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    destination: '',
    niveauEtude: '',
    filiere: '',
    date: '',
    time: '',
  });

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOtherDestination, setShowOtherDestination] = useState(false);
  const [showOtherFiliere, setShowOtherFiliere] = useState(false);
  const [success, setSuccess] = useState(false);

  const niveauxEtude = [
    'Bac',
    'Bac+1',
    'Bac+2',
    'Licence',
    'Master I',
    'Master II',
    'Doctorat',
  ];
  const filieres = [
    'Informatique',
    'Médecine',
    'Ingénierie',
    'Droit',
    'Commerce',
    'Autre',
  ];

  useEffect(() => {
    AOS.init({
      duration: 300,
      easing: 'ease-in-out',
      once: true,
    });
  }, []);

  const fetchDestinations = useCallback(async (): Promise<void> => {
    setLoadingDestinations(true);
    try {
      const response = await fetch(`${API_URL}/api/destinations/all`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data: Destination[] = await response.json();
      setDestinations([
        ...data,
        { _id: 'autre', country: 'Autre', imagePath: '', text: '' },
      ]);
    } catch (error) {
      console.error('Erreur destinations:', error);
      toast.error('Impossible de charger les destinations');
    } finally {
      setLoadingDestinations(false);
    }
  }, []);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'destination') {
      setShowOtherDestination(value === 'Autre');
      if (value !== 'Autre') {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          destinationAutre: undefined,
        }));
        return;
      }
    }

    if (name === 'filiere') {
      setShowOtherFiliere(value === 'Autre');
      if (value !== 'Autre') {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          filiereAutre: undefined,
        }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ✅ Validation STRICTE du téléphone (identique au backend)
  const validatePhone = (phone: string): boolean => {
    const cleanedPhone = phone.replace(/[\s\-()]/g, '');
    return /^\+?[1-9]\d{1,14}$/.test(cleanedPhone);
  };

  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const isDatePassed = (dateStr: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateStr);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate < today;
  };

  const isTimePassed = (timeStr: string, dateStr: string): boolean => {
    const today = new Date();
    const selectedDate = new Date(dateStr);

    if (selectedDate.toDateString() !== today.toDateString()) return false;

    const [hours, minutes] = timeStr.split(':').map(Number);
    const selectedTime = new Date();
    selectedTime.setHours(hours, minutes, 0, 0);

    return selectedTime < today;
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.firstName?.trim() &&
          formData.lastName?.trim() &&
          formData.email?.trim() &&
          formData.telephone?.trim() &&
          validatePhone(formData.telephone)
        );
      case 2:
        if (!formData.destination) return false;
        if (
          formData.destination === 'Autre' &&
          !formData.destinationAutre?.trim()
        )
          return false;
        if (!formData.niveauEtude) return false;
        if (!formData.filiere) return false;
        if (formData.filiere === 'Autre' && !formData.filiereAutre?.trim())
          return false;
        return true;
      case 3:
        return !!(formData.date && formData.time);
      default:
        return false;
    }
  };

  const nextStep = (): void => {
    if (isStepValid(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      setTimeout(() => AOS.refreshHard(), 50);
    } else {
      if (currentStep === 1) {
        if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
          toast.error('Prénom et nom sont obligatoires');
        } else if (!formData.email?.trim()) {
          toast.error('Email est obligatoire');
        } else if (
          !formData.telephone?.trim() ||
          !validatePhone(formData.telephone)
        ) {
          toast.error('Numéro de téléphone invalide (format: +22812345678, 8-15 chiffres, ne doit pas commencer par 0)');
        }
      } else if (currentStep === 2) {
        if (!formData.destination) {
          toast.error('La destination est obligatoire');
        } else if (
          formData.destination === 'Autre' &&
          !formData.destinationAutre?.trim()
        ) {
          toast.error('La destination "Autre" nécessite une précision');
        } else if (!formData.niveauEtude) {
          toast.error("Le niveau d'étude est obligatoire");
        } else if (!formData.filiere) {
          toast.error('La filière est obligatoire');
        } else if (
          formData.filiere === 'Autre' &&
          !formData.filiereAutre?.trim()
        ) {
          toast.error('La filière "Autre" nécessite une précision');
        }
      }
    }
  };

  const prevStep = (): void => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setTimeout(() => AOS.refreshHard(), 50);
  };

  const fetchAvailableDates = useCallback(async (): Promise<void> => {
    setLoadingDates(true);
    try {
      const response = await fetch(`${API_URL}/api/rendezvous/available-dates`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const dates: string[] = await response.json();
      const filteredDates = dates
        .filter((date: string) => !isDatePassed(date))
        .sort(
          (a: string, b: string) =>
            new Date(a).getTime() - new Date(b).getTime()
        );

      setAvailableDates(filteredDates);
    } catch (error) {
      console.error('Erreur dates:', error);
      toast.error('Impossible de charger les dates');
    } finally {
      setLoadingDates(false);
    }
  }, []);

  const fetchAvailableSlots = useCallback(
    async (date: string): Promise<void> => {
      if (!date) return;

      setLoadingSlots(true);
      setAvailableSlots([]);
      try {
        const response = await fetch(
          `${API_URL}/api/rendezvous/available-slots?date=${date}`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erreur ${response.status}: ${errorText}`);
        }

        let slots: string[] = await response.json();
        if (date === new Date().toISOString().split('T')[0]) {
          slots = slots.filter((slot: string) => !isTimePassed(slot, date));
        }

        setAvailableSlots(slots);
      } catch (error) {
        console.error('Erreur créneaux:', error);
        toast.error('Impossible de charger les créneaux');
      } finally {
        setLoadingSlots(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchDestinations();
    fetchAvailableDates();
  }, [fetchDestinations, fetchAvailableDates]);

  useEffect(() => {
    if (formData.date) fetchAvailableSlots(formData.date);
  }, [formData.date, fetchAvailableSlots]);

 const handleSubmit = async (e: FormEvent): Promise<void> => {
  e.preventDefault();

  if (!isAuthenticated) {
    toast.error('Veuillez vous connecter pour prendre un rendez-vous');
    navigate('/connexion', {
      state: {
        redirectTo: '/rendez-vous',
        message: 'Connectez-vous pour prendre un rendez-vous',
      },
    });
    return;
  }

  if (!access_token) {
    toast.error('Session invalide. Veuillez vous reconnecter.');
    logout();
    return;
  }

  // Validation STRICTE des données (identique au backend)
  if (!validatePhone(formData.telephone)) {
    toast.error('Numéro de téléphone invalide (format: +228XXXXXXXXX, 8-15 chiffres, ne doit pas commencer par 0)');
    return;
  }

  if (formData.destination === 'Autre' && !formData.destinationAutre?.trim()) {
    toast.error('La destination "Autre" nécessite une précision');
    return;
  }

  if (formData.filiere === 'Autre' && !formData.filiereAutre?.trim()) {
    toast.error('La filière "Autre" nécessite une précision');
    return;
  }

  // Validation email (regex identique au backend)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email.trim())) {
    toast.error('Format d\'email invalide');
    return;
  }

  // Vérifier que la date n'est pas passée
  if (isDatePassed(formData.date)) {
    toast.error('Vous ne pouvez pas réserver une date passée');
    return;
  }

  // Vérifier que le créneau n'est pas passé (si date d'aujourd'hui)
  if (formData.date === new Date().toISOString().split('T')[0] && formData.time) {
    if (isTimePassed(formData.time, formData.date)) {
      toast.error('Vous ne pouvez pas réserver un créneau passé');
      return;
    }
  }

  // ✅ CORRECTION: Préparation des données COHÉRENTES avec backend
  // SUPPRIMER userId - Le backend ne l'attend pas dans le DTO
  const submitData: Record<string, any> = {
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim().toLowerCase(),
    telephone: formData.telephone.trim(),
    niveauEtude: formData.niveauEtude,
    date: formData.date,
    time: formData.time,
    // ⚠️ NE PAS ENVOYER userId - Le backend le récupère depuis le token JWT
    // SUPPRIMER: userId: user?.id
  };

  // Gestion STRICTE des champs "Autre" (identique au backend)
  if (formData.destination === 'Autre') {
    submitData.destination = 'Autre';
    submitData.destinationAutre = formData.destinationAutre!.trim();
  } else {
    submitData.destination = formData.destination;
    // Ne pas envoyer destinationAutre si pas "Autre"
    delete submitData.destinationAutre;
  }

  if (formData.filiere === 'Autre') {
    submitData.filiere = 'Autre';
    submitData.filiereAutre = formData.filiereAutre!.trim();
  } else {
    submitData.filiere = formData.filiere;
    // Ne pas envoyer filiereAutre si pas "Autre"
    delete submitData.filiereAutre;
  }

  console.log('📤 Données envoyées au backend:', submitData); // Debug log

  setLoading(true);

  try {
    const makeRequest = async (currentToken: string): Promise<Response> => {
      return fetch(`${API_URL}/api/rendezvous`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(submitData),
      });
    };

    let response = await makeRequest(access_token);

    // ✅ Gestion STRICTE des erreurs 401 (identique au backend)
    if (response.status === 401) {
      try {
        const refreshed = await refreshToken();
        if (refreshed) {
          const currentToken = localStorage.getItem('access_token');
          if (currentToken) {
            response = await makeRequest(currentToken);
          } else {
            throw new Error('Session expirée');
          }
        } else {
          throw new Error('Session expirée');
        }
      } catch (error) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        logout();
        navigate('/connexion');
        return;
      }
    }

    // ✅ Vérification stricte de la réponse
    if (!response.ok) {
      let errorMessage = 'Erreur lors de la création du rendez-vous';
      try {
        const errorData = await response.json();
        console.error('❌ Erreur backend:', errorData); // Debug log
        errorMessage = errorData.message || errorData.error || errorMessage;

        // Gestion des erreurs spécifiques du backend
        if (errorMessage.includes('Vous avez déjà un rendez-vous confirmé')) {
          toast.error('Vous avez déjà un rendez-vous confirmé. Annulez-le avant d\'en créer un nouveau.', {
            autoClose: 5000,
          });
          setTimeout(() => {
            navigate('/mes-rendez-vous');
          }, 2000);
          return;
        }

        if (errorMessage.includes('Email ne correspond pas')) {
          toast.error('L\'email doit correspondre à votre compte. Veuillez utiliser votre email de connexion.');
          return;
        }

        if (
          errorMessage.includes('créneau') ||
          errorMessage.includes('disponible') ||
          errorMessage.includes('complets')
        ) {
          toast.error(
            'Ce créneau n\'est plus disponible. Veuillez choisir un autre horaire.'
          );
          if (formData.date) fetchAvailableSlots(formData.date);
          setFormData(prev => ({ ...prev, time: '' }));
          return;
        }

        if (errorMessage.includes('weekend') || errorMessage.includes('week-end')) {
          toast.error('Les réservations sont fermées le week-end');
          fetchAvailableDates();
          setFormData(prev => ({ ...prev, date: '', time: '' }));
          return;
        }

        if (errorMessage.includes('férié')) {
          toast.error('Les réservations sont fermées les jours fériés');
          fetchAvailableDates();
          setFormData(prev => ({ ...prev, date: '', time: '' }));
          return;
        }

        // Afficher le message d'erreur exact du backend
        toast.error(`Erreur: ${errorMessage}`);
        return;
      } catch {
        const textError = await response.text();
        console.error('❌ Erreur serveur (non-JSON):', textError);
        toast.error('Erreur serveur. Veuillez réessayer.');
        return;
      }
    }

    // ✅ Vérification de la réponse JSON
    let result;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error('Réponse serveur vide');
      }
      result = JSON.parse(responseText);
      console.log('✅ Réponse backend:', result); // Debug log
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      toast.error('Erreur de format de réponse du serveur');
      return;
    }

    if (!result || typeof result !== 'object') {
      throw new Error('Réponse serveur invalide');
    }

    // ✅ SUCCÈS - Rendez-vous IMMÉDIATEMENT "Confirmé" (comme backend)
    setSuccess(true);
    toast.success('✅ Rendez-vous créé et confirmé avec succès !');

    setTimeout(() => {
      navigate('/mes-rendez-vous');
    }, 2000);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erreur inconnue';

    console.error('❌ Erreur lors de la soumission:', errorMessage);

    if (
      errorMessage.includes('Session expirée') ||
      errorMessage.includes('Token')
    ) {
      toast.error('Session expirée. Redirection vers la connexion...');
      setTimeout(() => {
        logout();
        navigate('/connexion');
      }, 1500);
    } else if (errorMessage.includes('Réponse serveur invalide')) {
      toast.error('Erreur technique. Veuillez réessayer plus tard.');
    } else {
      toast.error(`Erreur: ${errorMessage}`);
    }
  } finally {
    setLoading(false);
  }
};

  // ==================== RENDER FUNCTIONS ====================

  const renderStep1 = () => (
    <div data-aos='fade-up' className='space-y-3'>
      <h2 className='text-md font-semibold text-sky-600'>
        <span className='flex items-center gap-2'>
          <FiUser className='text-sky-500 h-4 w-4' />
          Informations personnelles
        </span>
      </h2>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div>
          <label
            htmlFor='firstName'
            className='mb-1 block text-xs font-medium text-gray-700'
          >
            Prénom *
          </label>
          <input
            type='text'
            id='firstName'
            name='firstName'
            value={formData.firstName}
            onChange={handleInputChange}
            className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
            placeholder='Votre prénom'
            required
            minLength={2}
            maxLength={50}
          />
        </div>

        <div>
          <label
            htmlFor='lastName'
            className='mb-1 block text-xs font-medium text-gray-700'
          >
            Nom *
          </label>
          <input
            type='text'
            id='lastName'
            name='lastName'
            value={formData.lastName}
            onChange={handleInputChange}
            className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
            placeholder='Votre nom'
            required
            minLength={2}
            maxLength={50}
          />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div>
          <label
            htmlFor='email'
            className='mb-1 block text-xs font-medium text-gray-700'
          >
            <span className='flex items-center gap-1'>
              <FiMail className='text-sky-500 h-3 w-3' />
              Email *
            </span>
          </label>
          <input
            type='email'
            id='email'
            name='email'
            value={formData.email}
            onChange={handleInputChange}
            className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
            placeholder='exemple@email.com'
            required
            readOnly={!!user?.email}
            maxLength={100}
          />
        </div>

        <div>
          <label
            htmlFor='telephone'
            className='mb-1 block text-xs font-medium text-gray-700'
          >
            <span className='flex items-center gap-1'>
              <FiPhone className='text-sky-500 h-3 w-3' />
              Téléphone *
            </span>
          </label>
          <input
            type='tel'
            id='telephone'
            name='telephone'
            value={formData.telephone}
            onChange={handleInputChange}
            className={`w-full rounded border px-3 py-2 text-sm transition-all duration-150 focus:outline-none focus:ring-none hover:border-sky-400 ${
              formData.telephone && !validatePhone(formData.telephone)
                ? 'border-red-300 focus:border-red-500'
                : 'border-gray-300 focus:border-sky-500'
            }`}
            placeholder='+22812345678'
            required
            maxLength={20}
          />
          {formData.telephone && !validatePhone(formData.telephone) && (
            <p className='mt-1 text-xs text-red-600'>
              Format: +22812345678 (8-15 chiffres, ne doit pas commencer par 0)
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div data-aos='fade-up' className='space-y-3'>
      <h2 className='text-md font-semibold text-sky-600'>
        <span className='flex items-center gap-2'>
          <FaGraduationCap className='text-sky-500 h-4 w-4' />
          Projet d'études
        </span>
      </h2>

      <div>
        <label
          htmlFor='destination'
          className='mb-1 block text-xs font-medium text-gray-700'
        >
          <span className='flex items-center gap-1'>
            <FiGlobe className='text-sky-500 h-3 w-3' />
            Destination *
          </span>
        </label>
        {loadingDestinations ? (
          <div className='flex items-center justify-center rounded border border-gray-300 px-3 py-2'>
            <div className='h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent'></div>
            <span className='ml-2 text-xs text-gray-600'>Chargement...</span>
          </div>
        ) : (
          <>
            <select
              id='destination'
              name='destination'
              value={formData.destination}
              onChange={handleInputChange}
              className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
              required
            >
              <option value=''>Sélectionnez une destination</option>
              {destinations.map(dest => (
                <option key={dest._id} value={dest.country}>
                  {dest.country}
                </option>
              ))}
            </select>

            {showOtherDestination && (
              <div className='mt-3'>
                <label
                  htmlFor='destinationAutre'
                  className='mb-1 block text-xs font-medium text-gray-700'
                >
                  <span className='flex items-center gap-1'>
                    <FiTarget className='text-sky-500 h-3 w-3' />
                    Précisez votre destination *
                  </span>
                </label>
                <input
                  type='text'
                  id='destinationAutre'
                  name='destinationAutre'
                  value={formData.destinationAutre || ''}
                  onChange={handleInputChange}
                  className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
                  placeholder='Ex: Suisse, Allemagne, Japon...'
                  maxLength={100}
                  required
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div>
          <label
            htmlFor='niveauEtude'
            className='mb-1 block text-xs font-medium text-gray-700'
          >
            <span className='flex items-center gap-1'>
              <FiAward className='text-sky-500 h-3 w-3' />
              Niveau d'étude *
            </span>
          </label>
          <select
            id='niveauEtude'
            name='niveauEtude'
            value={formData.niveauEtude}
            onChange={handleInputChange}
            className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
            required
          >
            <option value=''>Sélectionnez votre niveau</option>
            {niveauxEtude.map(niv => (
              <option key={niv} value={niv}>
                {niv}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor='filiere'
            className='mb-1 block text-xs font-medium text-gray-700'
          >
            <span className='flex items-center gap-1'>
              <FiBook className='text-sky-500 h-3 w-3' />
              Filière *
            </span>
          </label>
          <select
            id='filiere'
            name='filiere'
            value={formData.filiere}
            onChange={handleInputChange}
            className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
            required
          >
            <option value=''>Sélectionnez votre filière</option>
            {filieres.map(fil => (
              <option key={fil} value={fil}>
                {fil}
              </option>
            ))}
          </select>

          {showOtherFiliere && (
            <div className='mt-3'>
              <label
                htmlFor='filiereAutre'
                className='mb-1 block text-xs font-medium text-gray-700'
              >
                Précisez votre filière *
              </label>
              <input
                type='text'
                id='filiereAutre'
                name='filiereAutre'
                value={formData.filiereAutre || ''}
                onChange={handleInputChange}
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
                placeholder='Ex: Architecture, Psychologie...'
                maxLength={100}
                required
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div data-aos='fade-up' className='space-y-3'>
      <h2 className='text-md font-semibold text-sky-600'>
        <span className='flex items-center gap-2'>
          <FiCalendar className='text-sky-500 h-4 w-4' />
          Choix du créneau
        </span>
      </h2>

      <div>
        <label
          htmlFor='date'
          className='mb-1 block text-xs font-medium text-gray-700'
        >
          <span className='flex items-center gap-1'>
            <FiCalendar className='text-sky-500 h-3 w-3' />
            Date *
          </span>
        </label>
        {loadingDates ? (
          <div className='flex items-center justify-center rounded border border-gray-300 px-3 py-2'>
            <div className='h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent'></div>
            <span className='ml-2 text-xs text-gray-600'>Chargement...</span>
          </div>
        ) : availableDates.length > 0 ? (
          <select
            id='date'
            name='date'
            value={formData.date}
            onChange={handleInputChange}
            className='w-full rounded border border-gray-300 px-3 py-2 text-sm transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none hover:border-sky-400'
            required
          >
            <option value=''>Sélectionnez une date</option>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {formatDateDisplay(date)}
              </option>
            ))}
          </select>
        ) : (
          <div className='rounded border border-red-300 bg-red-50 px-3 py-2'>
            <p className='text-xs text-red-600'>Aucune date disponible</p>
          </div>
        )}
      </div>

      {formData.date && (
        <div>
          <label className='mb-1 block text-xs font-medium text-gray-700'>
            <span className='flex items-center gap-1'>
              <FiWatch className='text-sky-500 h-3 w-3' />
              Horaire *
            </span>
          </label>
          {loadingSlots ? (
            <div className='flex items-center justify-center rounded border border-gray-300 px-3 py-2'>
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent'></div>
              <span className='ml-2 text-xs text-gray-600'>Chargement...</span>
            </div>
          ) : availableSlots.length > 0 ? (
            <div className='grid grid-cols-3 gap-1 sm:grid-cols-4'>
              {availableSlots.map(slot => {
                const isSelected = formData.time === slot;
                const isPassed = isTimePassed(slot, formData.date);

                return (
                  <button
                    key={slot}
                    type='button'
                    onClick={() =>
                      !isPassed &&
                      setFormData(prev => ({ ...prev, time: slot }))
                    }
                    disabled={isPassed}
                    className={`rounded px-2 py-1.5 text-xs transition-all duration-150 focus:outline-none focus:ring-none ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : isPassed
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'border border-gray-300 bg-white text-gray-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className='rounded border border-amber-300 bg-amber-50 px-3 py-2'>
              <p className='text-xs text-amber-700'>
                Aucun créneau disponible pour cette date
              </p>
            </div>
          )}

          {formData.time && (
            <div className='mt-3 rounded bg-sky-50 p-3'>
              <p className='text-xs text-sky-700'>
                <span className='font-medium'>Créneau sélectionné :</span>{' '}
                {formatDateDisplay(formData.date)} à {formData.time}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderProgressSteps = () => (
    <div className='mb-6'>
      <div className='flex items-center justify-between'>
        {[1, 2, 3].map(step => (
          <div key={step} className='flex flex-col items-center'>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all duration-150 ${
                currentStep >= step
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {step}
            </div>
            <span
              className={`mt-1 text-xs font-medium ${
                currentStep >= step ? 'text-sky-600' : 'text-gray-400'
              }`}
            >
              {step === 1 ? 'Personnel' : step === 2 ? 'Projet' : 'Créneau'}
            </span>
          </div>
        ))}
      </div>
      <div className='relative -mt-4'>
        <div className='absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-gray-200'>
          <div
            className='h-full bg-sky-600 transition-all duration-150'
            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );

  const renderSuccessMessage = () => (
    <div data-aos='zoom-in' className='text-center'>
      <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100'>
        <FiCheckCircle className='h-8 w-8 text-emerald-600' />
      </div>
      <h2 className='mb-3 text-lg font-bold text-gray-800'>
        Rendez-vous confirmé !
      </h2>
      <p className='mb-6 text-sm text-gray-600'>
        Votre rendez-vous a été créé et confirmé avec succès. 
        <br />
        Vous allez être redirigé vers vos rendez-vous.
      </p>
      <div className='animate-pulse'>
        <div className='inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2'>
          <div className='h-2 w-2 rounded-full bg-emerald-500'></div>
          <span className='text-xs text-emerald-700'>
            Redirection en cours...
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>
          Prenez Rendez-Vous avec nos consultant - Paname Consulting
        </title>
        <meta
          name='description'
          content='Prenez rendez-vous avec un conseiller Paname Consulting'
        />
        <meta name='robots' content='noindex, nofollow' />
        <meta name='googlebot' content='noindex, nofollow' />
        <meta name='bingbot' content='noindex, nofollow' />
        <meta name='yandexbot' content='noindex, nofollow' />
        <meta name='duckduckbot' content='noindex, nofollow' />
        <meta name='baidu' content='noindex, nofollow' />
        <meta name='naver' content='noindex, nofollow' />
        <meta name='seznam' content='noindex, nofollow' />
        <link
          rel='canonical'
          href='https://panameconsulting.vercel.app/rendez-vous'
        />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=5" 
        />
      </Helmet>

      <div className='min-h-screen bg-gradient-to-b from-sky-50 to-white py-6'>
        <div className='mx-auto max-w-2xl px-3 sm:px-4'>
          {!isAuthenticated ? (
            <div data-aos='zoom-in' className='rounded-lg bg-white p-6 shadow'>
              <div className='text-center'>
                <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100'>
                  <FiUser className='h-8 w-8 text-sky-600' />
                </div>
                <h2 className='mb-3 text-lg font-bold text-gray-800'>
                  Connexion requise
                </h2>
                <p className='mb-6 text-sm text-gray-600'>
                  Vous devez être connecté pour prendre un rendez-vous.
                </p>
                <button
                  onClick={() =>
                    navigate('/connexion', {
                      state: {
                        redirectTo: '/rendez-vous',
                        message: 'Connectez-vous pour prendre un rendez-vous',
                      },
                    })
                  }
                  className='inline-flex items-center justify-center gap-2 rounded bg-sky-600 px-6 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-sky-700 focus:border-sky-500 focus:outline-none focus:ring-none'
                >
                  Se connecter
                </button>
              </div>
            </div>
          ) : success ? (
            <div
              data-aos='zoom-in'
              className='overflow-hidden rounded-lg bg-white p-8 shadow-lg'
            >
              {renderSuccessMessage()}
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className='overflow-hidden rounded-lg bg-white shadow-lg'
              data-aos='fade-up'
            >
              <div className='border-b border-gray-100 bg-gradient-to-r from-sky-500 to-sky-600 px-6 py-4'>
                <h1 className='text-xl font-bold text-white'>
                  📅 Prendre un rendez-vous
                </h1>
                <p className='mt-1 text-sm text-sky-100'>
                  Complétez les informations pour planifier votre consultation
                </p>
              </div>

              <div className='px-4 py-6 sm:px-6 sm:py-8'>
                {renderProgressSteps()}

                <div className='space-y-6'>
                  {currentStep === 1 && renderStep1()}
                  {currentStep === 2 && renderStep2()}
                  {currentStep === 3 && renderStep3()}
                </div>

                <div className='mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between'>
                  {currentStep > 1 && (
                    <button
                      type='button'
                      onClick={prevStep}
                      className='inline-flex items-center justify-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 focus:border-sky-500 focus:outline-none focus:ring-none'
                    >
                      <FiChevronLeft className='h-4 w-4' />
                      Retour
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type='button'
                      onClick={nextStep}
                      disabled={!isStepValid(currentStep)}
                      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none ${
                        isStepValid(currentStep)
                          ? 'bg-sky-600 text-white hover:bg-sky-700'
                          : 'cursor-not-allowed bg-gray-300 text-gray-500'
                      }`}
                    >
                      Continuer
                      <FiChevronRight className='h-4 w-4' />
                    </button>
                  ) : (
                    <button
                      type='submit'
                      disabled={loading || !isStepValid(3)}
                      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-all duration-150 focus:border-sky-500 focus:outline-none focus:ring-none ${
                        !loading && isStepValid(3)
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'cursor-not-allowed bg-gray-300 text-gray-500'
                      }`}
                    >
                      {loading ? (
                        <>
                          <div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'></div>
                          Traitement...
                        </>
                      ) : (
                        <>
                          Confirmer le rendez-vous
                          <FiChevronRight className='h-4 w-4' />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className='border-t border-gray-100 bg-gray-50 px-6 py-4'>
                <p className='text-center text-xs text-gray-500'>
                  Tous les champs marqués d'un * sont obligatoires.
                  <br />
                  Les rendez-vous sont immédiatement confirmés après création.
                  <br />
                  Vous recevrez une confirmation par email.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default RendezVous;