import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiPhone,
  FiUser,
} from 'react-icons/fi';

// Types pour TypeScript
interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
}

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  message?: string;
}

interface SubmitStatus {
  success?: boolean;
  message?: string;
}

const Form = () => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  // Gestion sécurisée des variables d'environnement
  const API_URL = import.meta.env.VITE_API_URL;

  // Effet de nettoyage avec gestion d'erreur
  useEffect(() => {
    if (submitStatus.message) {
      const timer = globalThis.setTimeout(() => setSubmitStatus({}), 5000);
      return () => globalThis.clearTimeout(timer);
    }
  }, [submitStatus]);

  // Validation mémoïsée pour la performance
  const validateField = useCallback((name: string, value: string): string => {
    const trimmedValue = value.trim();

    if (!trimmedValue && (name === 'email' || name === 'message')) {
      return 'Ce champ est obligatoire';
    }

    switch (name) {
      case 'email':
        if (!trimmedValue) return 'Email obligatoire';
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
          ? ''
          : 'Email invalide';
      case 'message':
        if (!trimmedValue) return 'Message obligatoire';
        return trimmedValue.length >= 10
          ? ''
          : 'Le message doit contenir au moins 10 caractères';
      case 'firstName':
      case 'lastName':
        return trimmedValue && !/^[a-zA-ZÀ-ÿ\s-]+$/.test(trimmedValue)
          ? 'Caractères invalides'
          : '';
      default:
        return '';
    }
  }, []);

  // Gestion des champs touchés
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setTouchedFields(prev => new Set(prev).add(name));
      setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    },
    [validateField]
  );

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formRef.current) return;

  setIsSubmitting(true);

  const formData = new FormData(formRef.current);
  const data: FormData = {
    firstName: (formData.get('firstName') as string) || '',
    lastName: (formData.get('lastName') as string) || '',
    email: (formData.get('email') as string) || '',
    message: (formData.get('message') as string) || '',
  };

  // Validation complète avant soumission
  const newErrors: ValidationErrors = {
    email: validateField('email', data.email),
    message: validateField('message', data.message),
    firstName: validateField('firstName', data.firstName),
    lastName: validateField('lastName', data.lastName),
  };

  setErrors(newErrors);
  setTouchedFields(new Set(['email', 'message', 'firstName', 'lastName']));

  if (Object.values(newErrors).some(error => error)) {
    setIsSubmitting(false);
    
    // Focus sur le premier champ en erreur
    const firstErrorField = Object.keys(newErrors).find(
      key => newErrors[key as keyof ValidationErrors]
    );
    if (firstErrorField) {
      const errorElement = globalThis.document?.getElementById(firstErrorField);
      if (errorElement && errorElement instanceof HTMLElement) {
        errorElement.focus();
      }
    }
    return;
  }

  try {
    if (!API_URL) {
      throw new Error('URL API non configurée');
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, 10000); // Timeout de 10s

    const response = await globalThis.fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        message: data.message.trim(),
      }),
      signal: controller.signal,
    });

    globalThis.clearTimeout(timeoutId);

    if (!response.ok) {
      // Essayer de récupérer le message d'erreur du backend
      let errorMessage = `Erreur HTTP: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        
        // Si le backend retourne des erreurs de validation détaillées
        if (errorData.errors) {
          // Mettre à jour les erreurs du formulaire avec celles du backend
          const backendErrors: ValidationErrors = {};
          Object.keys(errorData.errors).forEach(key => {
            if (key in backendErrors) {
              backendErrors[key as keyof ValidationErrors] = errorData.errors[key];
            }
          });
          if (Object.keys(backendErrors).length > 0) {
            setErrors(backendErrors);
            return;
          }
        }
      } catch (parseError) {
        // Si on ne peut pas parser la réponse JSON
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    setSubmitStatus({
      success: true,
      message: 'Message envoyé ! Vous recevrez une confirmation par email.',
    });
    formRef.current.reset();
    setTouchedFields(new Set());
    
  } catch (error) {
    // Log only in development
    if (import.meta.env.DEV) {
      console.error('Erreur soumission formulaire:', error);
    }

    let errorMessage = "Erreur lors de l'envoi. Veuillez réessayer.";

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'La requête a pris trop de temps. Veuillez réessayer.';
      } else {
        errorMessage = error.message || errorMessage;
      }
    }

    setSubmitStatus({
      success: false,
      message: errorMessage,
    });
  } finally {
    setIsSubmitting(false);
  }
};

  // Rendu conditionnel pour éviter les erreurs d'hydratation
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <main className='py-8 md:py-12 px-2 sm:px-4 lg:px-8 bg-gray-50'>
        <div className='max-w-7xl mx-auto'>
          <div className='bg-white rounded shadow-xl overflow-hidden'>
            <div className='flex flex-col md:flex-row'>
              {/* Squelette de chargement */}
              <div className='w-full md:w-2/3 p-8 lg:p-12'>
                <div className='animate-pulse'>
                  <div className='h-8 bg-gray-200 rounded w-1/3 mb-8'></div>
                  <div className='space-y-6'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                      <div className='h-12 bg-gray-200 rounded'></div>
                      <div className='h-12 bg-gray-200 rounded'></div>
                    </div>
                    <div className='h-12 bg-gray-200 rounded'></div>
                    <div className='h-32 bg-gray-200 rounded'></div>
                    <div className='h-12 bg-gray-200 rounded'></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className='py-8 md:py-12 px-2 sm:px-4 lg:px-8 bg-gray-50'>
      <div className='max-w-7xl mx-auto'>
        <div className='bg-white rounded shadow-xl overflow-hidden'>
          <div className='flex flex-col md:flex-row'>
            {/* SECTION GAUCHE - Optimisée pour l'affichage mobile */}
            <section
              className='relative w-full md:w-1/3 text-white space-y-6 p-8 lg:p-12 
              overflow-hidden
              bg-linear-to-tr from-sky-600 via-sky-500 to-sky-400
              before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.2),transparent_50%)]
              before:animate-[pulse_6s_ease-in-out_infinite]
              after:absolute after:inset-0 after:bg-[url("https://www.transparenttextures.com/patterns/cubes.png")]
              after:opacity-10 after:mix-blend-overlay
              backdrop-blur-md z-10'
              aria-labelledby='contact-info-title'
            >
              <h2
                id='contact-info-title'
                className='text-2xl font-bold drop-shadow-lg'
              >
                Paname Consulting
              </h2>

              <div className='space-y-4' role='list'>
                <ContactInfo
                  icon={
                    <FiMapPin
                      className='w-5 h-5 mt-1 text-sky-100'
                      aria-hidden='true'
                    />
                  }
                  title='Adresse'
                  content="Kalaban Coura, Imm.Bore <br/>en face de l'hôtel Wassulu"
                />
                <ContactInfo
                  icon={
                    <FiPhone
                      className='w-5 h-5 mt-1 text-sky-100'
                      aria-hidden='true'
                    />
                  }
                  title='Téléphone'
                  content={
                    <a
                      href='tel:+22391830941'
                      className='hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded'
                    >
                      +223 91 83 09 41
                    </a>
                  }
                />
                <ContactInfo
                  icon={
                    <FiMail
                      className='w-5 h-5 mt-1 text-sky-100'
                      aria-hidden='true'
                    />
                  }
                  title='Email'
                  content={
                    <a
                      href='mailto:panameconsulting906@gmail.com'
                      className='hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded'
                    >
                      panameconsulting906@gmail.com
                    </a>
                  }
                />
              </div>

              {/* Carte Google Maps optimisée pour mobile */}
              <div
                className='mt-8 h-56 md:h-64 lg:h-72 overflow-hidden shadow-lg'
                role='application'
                aria-label='Carte de localisation'
              >
                <iframe
                  src='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3894.010270463331!2d-7.993864324930176!3d12.581574287699127!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xe51cf2248975979%3A0xa90fabf3b7838312!2sImmeuble%20BORE!5e0!3m2!1sfr!2sml!4v1700000000000!5m2!1sfr!2sml'
                  className='w-full h-full rounded'
                  loading='lazy'
                  title="Localisation Paname Consulting - Kalaban Coura, Immeuble BORE en face de l'hôtel Wassulu"
                  style={{ border: 0 }}
                  aria-label='Carte interactive montrant la localisation de Paname Consulting'
                  allowFullScreen
                  referrerPolicy='no-referrer-when-downgrade'
                />
              </div>
            </section>

            {/* FORMULAIRE - Améliorations accessibilité */}
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className='w-full md:w-2/3 p-8 lg:p-12'
              noValidate
              aria-labelledby='contact-form-title'
            >
              <h2
                id='contact-form-title'
                className='text-2xl font-bold text-gray-800 mb-8'
              >
                Contactez-nous
              </h2>

              {submitStatus.message && (
                <div
                  role='alert'
                  aria-live='polite'
                  className={`mb-6 p-4 rounded-lg ${
                    submitStatus.success
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}

              <div className='space-y-6'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  <InputField
                    id='firstName'
                    label='Prénom'
                    name='firstName'
                    onBlur={handleBlur}
                    error={
                      touchedFields.has('firstName')
                        ? errors.firstName
                        : undefined
                    }
                    required={false}
                    icon={
                      <FiUser className='text-gray-400' aria-hidden='true' />
                    }
                    placeholder='Votre prénom'
                    disabled={isSubmitting}
                  />
                  <InputField
                    id='lastName'
                    label='Nom'
                    name='lastName'
                    onBlur={handleBlur}
                    error={
                      touchedFields.has('lastName')
                        ? errors.lastName
                        : undefined
                    }
                    required={false}
                    icon={
                      <FiUser className='text-gray-400' aria-hidden='true' />
                    }
                    placeholder='Votre nom de famille'
                    disabled={isSubmitting}
                  />
                </div>
                <InputField
                  id='email'
                  label='Email professionnel'
                  name='email'
                  type='email'
                  onBlur={handleBlur}
                  error={touchedFields.has('email') ? errors.email : undefined}
                  required={true}
                  icon={<FiMail className='text-gray-400' aria-hidden='true' />}
                  placeholder='exemple@entreprise.com'
                  disabled={isSubmitting}
                  autoComplete='email'
                />
                <TextAreaField
                  id='message'
                  label='Message'
                  name='message'
                  onBlur={handleBlur}
                  error={
                    touchedFields.has('message') ? errors.message : undefined
                  }
                  required={true}
                  icon={
                    <FiMessageSquare
                      className='text-gray-400'
                      aria-hidden='true'
                    />
                  }
                  placeholder='Votre message, avis ou commentaire...'
                  disabled={isSubmitting}
                />
                <SubmitButton isSubmitting={isSubmitting} />
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
};

// Composants avec typage TypeScript
interface ContactInfoProps {
  icon: React.ReactNode;
  title: string;
  content: string | React.ReactNode;
}

const ContactInfo = ({ icon, title, content }: ContactInfoProps) => (
  <div className='flex space-x-3' role='listitem'>
    {icon}
    <div>
      <p className='font-medium'>{title}</p>
      <div className='text-sm opacity-90'>
        {typeof content === 'string' ? (
          <span dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          content
        )}
      </div>
    </div>
  </div>
);

interface InputFieldProps {
  id: string;
  label: string;
  name: string;
  type?: string;
  error?: string;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  required: boolean;
  icon: React.ReactNode;
  placeholder: string;
  disabled?: boolean;
  autoComplete?: string;
}

const InputField = ({
  id,
  label,
  name,
  type = 'text',
  error,
  onBlur,
  required,
  icon,
  placeholder,
  disabled,
  autoComplete,
}: InputFieldProps) => (
  <div>
    <label
      htmlFor={id}
      className='block text-sm font-medium text-gray-700 mb-1'
    >
      {label} {required && '*'}
    </label>
    <div className='relative'>
      <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
        {icon}
      </div>
      <input
        id={id}
        name={name}
        type={type}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full pl-10 pr-4 py-3 rounded border ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
        } focus:outline-none focus:border-sky-500 hover:border-sky-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      />
    </div>
    {error && (
      <p id={`${id}-error`} className='mt-1 text-sm text-red-600' role='alert'>
        {error}
      </p>
    )}
  </div>
);

interface TextAreaFieldProps {
  id: string;
  label: string;
  name: string;
  error?: string;
  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  required: boolean;
  icon: React.ReactNode;
  placeholder: string;
  disabled?: boolean;
}

const TextAreaField = ({
  id,
  label,
  name,
  error,
  onBlur,
  required,
  icon,
  placeholder,
  disabled,
}: TextAreaFieldProps) => (
  <div>
    <label
      htmlFor={id}
      className='block text-sm font-medium text-gray-700 mb-1'
    >
      {label} {required && '*'}
    </label>
    <div className='relative'>
      <div className='absolute top-3 left-3'>{icon}</div>
      <textarea
        id={id}
        name={name}
        rows={5}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full pl-10 pr-4 py-3 rounded border ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
        } focus:outline-none focus:border-sky-500 hover:border-sky-400 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed`}
      />
    </div>
    {error && (
      <p id={`${id}-error`} className='mt-1 text-sm text-red-600' role='alert'>
        {error}
      </p>
    )}
  </div>
);

const SubmitButton = ({ isSubmitting }: { isSubmitting: boolean }) => (
  <button
    type='submit'
    disabled={isSubmitting}
    className='w-full px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold rounded transition-colors disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
    aria-live='polite'
  >
    {isSubmitting ? (
      <span className='flex items-center justify-center'>
        <Spinner />
        Envoi en cours...
      </span>
    ) : (
      'Envoyer'
    )}
  </button>
);

const Spinner = () => (
  <svg
    className='animate-spin -ml-1 mr-2 h-5 w-5 text-white'
    xmlns='http://www.w3.org/2000/svg'
    fill='none'
    viewBox='0 0 24 24'
    aria-hidden='true'
  >
    <circle
      className='opacity-25'
      cx='12'
      cy='12'
      r='10'
      stroke='currentColor'
      strokeWidth='4'
    ></circle>
    <path
      className='opacity-75'
      fill='currentColor'
      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
    ></path>
  </svg>
);

export default Form;
