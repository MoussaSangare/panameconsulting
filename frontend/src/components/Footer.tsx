import {
  Instagram as FaInstagram,
  Phone as FaPhoneAlt,
  Mail as FaEnvelope,
  MapPin as FaMapMarkerAlt,
} from 'lucide-react';


const FaTiktok = () => (
  <svg className='w-5 h-5' viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 5 20.1a6.33 6.33 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

import { SiWhatsapp } from 'react-icons/si';
import { Link } from 'react-router-dom';
// AOS is now initialized globally in App.tsx

export default function Footer() {
  return (
    <footer
      role='contentinfo'
      className='px-4 py-12 bg-linear-to-br from-sky-50 to-sky-100 sm:px-6 lg:px-8 border-t border-sky-200 w-full'
    >
      <div className='max-w-7xl mx-auto'>
        {/* Grille responsive */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10'>
          {/* À propos - Animation seulement sur desktop */}
          <section
            className='space-y-4 text-left'
            data-aos='zoom-in'
            data-aos-disable='mobile'
          >
            <div className='flex items-center'>
              <img
                src='/paname-consulting.png'
                alt='Logo Paname Consulting'
                className='w-16 h-auto mr-3'
                loading='lazy'
              />
              <h2 className='text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-sky-600 to-sky-400'>
                PANAME CONSULTING
              </h2>
            </div>
            <p className='text-sm leading-relaxed text-sky-700'>
              Votre partenaire pour des études internationales réussies. Nous
              accompagnons les étudiants vers les meilleures opportunités
              académiques à travers le monde.
            </p>
            <div className='flex items-start space-x-2 text-sky-600'>
              <FaMapMarkerAlt className='shrink-0 mt-1' />
              <span className='text-sm'>
                Kalaban Coura, Imm.Bore <br />
                en face de l'hôtel Wassulu
              </span>
            </div>
          </section>

          {/* Services - Animation seulement sur desktop */}
          <section
            className='space-y-4 text-left'
            data-aos='fade-down'
            data-aos-disable='mobile'
          >
            <h2 className='text-lg font-semibold text-sky-600 border-b border-sky-200 pb-2'>
              Nos Services
            </h2>
            <nav aria-label='Liste des services proposés'>
              <ul className='space-y-3 text-sm text-sky-700'>
                {[
                  'Orientation académique personnalisée',
                  "Préparation des dossiers d'admission",
                  'Assistance pour les visas étudiants',
                  'Préparation aux entretiens',
                  'Suivi post-admission',
                ].map((service, index) => (
                  <li key={index} className='flex items-start'>
                    <span className='inline-block w-2 h-2 bg-sky-500 rounded-full mt-2 mr-2'></span>
                    {service}
                  </li>
                ))}
              </ul>
            </nav>
          </section>

          {/* Contact & Réseaux sociaux */}
          <section
            className='space-y-6 text-left md:col-span-2 lg:col-span-1'
            data-aos='zoom-in'
            data-aos-disable='mobile'
          >
            <div className='space-y-4'>
              <h2 className='text-lg font-semibold text-sky-600 border-b border-sky-200 pb-2'>
                Contact
              </h2>
              <div className='space-y-3'>
                {[
                  {
                    icon: (
                      <FaPhoneAlt className='w-4 h-4 group-hover:animate-pulse' />
                    ),
                    text: '+223 91 83 09 41',
                    to: 'tel:+22391830941',
                    bg: 'from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700',
                  },
                  {
                    icon: (
                      <FaEnvelope className='w-4 h-4 group-hover:animate-pulse' />
                    ),
                    text: 'Nous écrire',
                    to: 'mailto:panameconsulting906@gmail.com',
                    bg: 'from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600',
                  },
                  {
                    icon: (
                      <SiWhatsapp className='w-4 h-4 group-hover:animate-pulse' />
                    ),
                    text: 'WhatsApp',
                    to: 'https://wa.me/22391830941',
                    bg: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
                  },
                ].map((item, index) => (
                  <Link
                    key={index}
                    to={item.to}
                    target={item.to.startsWith('http') ? '_blank' : undefined}
                    rel={
                      item.to.startsWith('http')
                        ? 'noopener noreferrer'
                        : undefined
                    }
                    className={`flex items-center gap-3 px-4 py-3 text-white bg-linear-to-r ${item.bg} rounded shadow-md transition-all duration-300 group`}
                    aria-label={item.text}
                  >
                    {item.icon}
                    <span className='font-medium'>{item.text}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className='space-y-3'>
              <h3 className='text-lg font-semibold text-sky-600 border-b border-sky-200 pb-2'>
                Réseaux sociaux
              </h3>
              <div className='flex gap-3'>
                {[
                  {
                    icon: <FaInstagram className='w-5 h-5' />,
                    to: 'https://www.instagram.com/paname_consulting/',
                    bg: 'hover:bg-sky-500 hover:text-white',
                  },
                  {
                    icon: <FaTiktok  />,
                    to: 'https://www.tiktok.com/@paname.consulting',
                    bg: 'hover:bg-sky-500 hover:text-white',
                  },
                ].map((social, index) => (
                  <Link
                    key={index}
                    to={social.to}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={index === 0 ? 'Instagram' : 'TikTok'}
                    className={`p-3 bg-white text-sky-600 rounded shadow ${social.bg} transition-all duration-300`}
                  >
                    {social.icon}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Copyright */}
        <div className='mt-10'>
          <hr className='border-sky-200' />
          <div className='flex flex-col md:flex-row justify-between items-center pt-6 gap-4'>
            <p className='text-sm text-sky-600 order-2 md:order-1'>
              © {new Date().getFullYear()} Paname Consulting. Tous droits
              réservés.
            </p>
            <div className='flex flex-col md:flex-row gap-4 text-center order-1 md:order-2'>
              {[
                {
                  text: 'Politique de confidentialité',
                  to: '/politique-de-confidentialite',
                },
                {
                  text: "Conditions Générales D'utilisation",
                  to: '/conditions-generales',
                },
                { text: 'Mentions Légales', to: '/mentions-legales' },
              ].map((link, index) => (
                <Link
                  key={index}
                  to={link.to}
                  className='text-sm text-sky-600 hover:text-sky-500'
                >
                  {link.text}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
