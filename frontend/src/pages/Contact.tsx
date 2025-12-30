import '../index.css';
// import Form from '../components/Form';
import { Helmet } from 'react-helmet-async';
import CTASection from '../components/CtaSection';
import Faq from '../components/Faq';
import Form from '../components/Form';

export default function Contact() {
  return (
    <>
      <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
        <Helmet>
          <title>
            Contact - Accompagnement étudiant, Études à l'étranger, Vacances,
            Demandes de visa
          </title>
          <meta
            name='description'
            content="Paname Consulting est une entreprise spécialisée dans l'accompagnement étudiant pour des études à l'étranger, les vacances et voyages d'affaires réussis et les demandes de visa pour plusieurs destinations à travers le monde."
          />
          <meta
            name='ms-viewport'
            content='width=device-width, initial-scale=1, maximum-scale=1'
          />
          <meta
            name='viewport'
            content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
          />
          <meta
            name='keywords'
            content="Paname Consulting, Accompagnement étudiant, Études à l'étranger, Vacances, Demandes de visa, Destinations internationales"
          />
          <meta http-equiv='X-UA-Compatible' content='IE=edge' />
          <meta name='author' content='Paname Consulting' />
          {/* Balises de contrôle d'indexation */}
          <meta name='robots' content='noindex, nofollow' />
          <meta name='googlebot' content='noindex, nofollow' />{' '}
          {/* Ajout d'un style global pour désactiver le swipe horizontal */}
          <style type='text/css'>{`
                  html, body {
                      overscroll-behavior-x: none;
                      overflow-x: hidden;
                  }
                `}</style>
        </Helmet>

        <main className='flex-1 mt-2.5 sm:mt-2.5 bg-linear-to-b from-white via-sky-50 to-white'>
          <Form />
          <Faq />
          <CTASection />
        </main>
      </div>
    </>
  );
}
