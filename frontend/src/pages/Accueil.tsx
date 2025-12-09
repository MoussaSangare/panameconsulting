import { Helmet } from 'react-helmet-async';
import About from '../components/About';
import CtaSection from '../components/CtaSection';
import Form from '../components/Form';
import Hero from '../components/Hero';
// import Partners from '../components/partners';
import Valeur from '../components/Valeur';
import '../index.css';

function Accueil() {
  return (
    <>
      <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
        <Helmet>
          <title>
            Paname Consulting - Accompagnement étudiant, Études à l'étranger,
            Vacances, Demandes de visa
          </title>
          <meta
            name='title'
            content="Paname Consulting - Accompagnement étudiant, Études à l'étranger, Vacances, Demandes de visa"
          />
          {/* Meta utf  */}
          <meta charSet='utf-8' />
          <meta httpEquiv='Content-Type' content='text/html; charset=utf-8' />
          <meta httpEquiv='Content-Script-Type' content='text/javascript' />
          {/* Tout pour que le rendu sur chrome soit le rendu sur edge */}
          <meta httpEquiv='X-UA-Compatible' content='IE=edge' />

          {/* Balises de recherche */}
          <meta
            name='description'
            content="Paname Consulting est une entreprise spécialisée dans l'accompagnement étudiant pour des études à l'étranger, les vacances et voyages d'affaires réussis et les demandes de visa pour plusieurs destinations à travers le monde."
          />
          <meta
            name='keywords'
            content="Paname Consulting, Accompagnement étudiant, Études à l'étranger, Vacances, Demandes de visa, Destinations internationales"
          />
          <meta name='author' content='Paname Consulting' />
          <meta name='robots' content='index, follow' />
          <meta name='googlebot' content='index, follow' />
          <meta name='bingbot' content='index, follow' />
          <meta name='yandexbot' content='index, follow' />
          <meta
            name='viewport'
            content='width=device-width, initial-scale=1.0, maximum-scale=5.0'
          />
          <meta name='theme-color' content='#ffffff' />
          {/* Suppression de la balise dupliquée */}
          <link
            rel='shortcut icon'
            href='/paname-consulting.ico'
            type='image/x-icon'
          />
          <link rel='icon' href='/paname-consulting.ico' type='image/x-icon' />
          <link rel='apple-touch-icon' href='/paname-consulting.ico' />
          <link rel='manifest' href='/manifest.json' />
          <link rel='canonical' href='https://panameconsulting.vercel.app/' />

          {/* Balises Open Graph pour le partage social */}
          <meta
            property='og:title'
            content="Paname Consulting - Votre partenaire pour les études à l'étranger"
          />
          <meta
            property='og:description'
            content='Accompagnement étudiant, voyages et demandes de visa pour destinations internationales'
          />
          <meta property='og:type' content='website' />
          <meta property='og:url' content='https://panameconsulting.com/' />
          <meta
            property='og:image'
            content='https://panameconsulting.com/paname-consulting.jpg'
          />
          <meta property='og:locale' content='fr_FR' />

          {/* Balises Twitter */}
          <meta name='twitter:card' content='summary_large_image' />
          <meta name='twitter:site' content='@PanameConsult' />
          <meta name='twitter:creator' content='@PanameConsult' />
          <meta name='twitter:title' content='Paname Consulting' />
          <meta
            name='twitter:description'
            content="Votre partenaire pour les études à l'étranger et les voyages internationaux"
          />
          <meta
            name='twitter:image'
            content='https://panameconsulting.com/paname-consulting.jpg'
          />
          {/* Ajout d'un style global pour désactiver le swipe horizontal */}
          <style type='text/css'>{`
                html, body {
                    overscroll-behavior-x: none;
                    overflow-x: hidden;
                }
              `}</style>
        </Helmet>

        <main className='flex-1'>
          <Hero />
          <About />
          <Valeur />
          {/* <Partners /> */}
          <Form />

          <CtaSection />
        </main>
      </div>
    </>
  );
}

export default Accueil;
