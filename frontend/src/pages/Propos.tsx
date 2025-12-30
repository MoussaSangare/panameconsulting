import { Helmet } from 'react-helmet-async';
import About from '../components/About';
import CTASection from '../components/CtaSection';

import Valeur from '../components/Valeur';
import '../index.css';

export default function Propos() {
  return (
    <>
      <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
        <Helmet>
          <title>
            À Propos - Accompagnement étudiant, Études à l'étranger, Vacances,
            Demandes de visa.
          </title>
          <meta
            name='description'
            content="Paname Consulting est une entreprise spécialisée dans l'accompagnement étudiant pour des études à l'étranger, les vacances et voyages d'affaires réussis et les démandes de visa pour plusieurs destinations à travers le monde."
          />
          <meta
            name='keywords'
            content="Paname Consulting, Accompagnement étudiant, Études à l'étranger, Vacances, Demandes de visa, Destinations internationales"
          />
          <meta name='author' content='Paname Consulting' />
          <meta http-equiv='X-UA-Compatible' content='IE=edge' />
          {/* Balises de contrôle d'indexation */}
          <meta name='robots' content='noindex, nofollow' />
          <meta name='googlebot' content='noindex, nofollow' />
          <meta
            name='ms-viewport'
            content='width=device-width, initial-scale=1, maximum-scale=1'
          />
          <meta
            name='viewport'
            content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
          />
          <link rel='manifest' href='/manifest.json' />

          {/* Ajout d'un style global pour désactiver le swipe horizontal */}
          <style type='text/css'>{`
                  html, body {
                     overscroll-behavior-x: none;
                     overflow-x: hidden;
                  }
               `}</style>
        </Helmet>
        <main className='flex-1 bg-linear-to-b from-white via-sky-50 to-white'>
          <About />
          <Valeur />
          <CTASection />
        </main>
      </div>
    </>
  );
}
