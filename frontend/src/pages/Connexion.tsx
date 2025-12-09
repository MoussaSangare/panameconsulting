import { Helmet } from 'react-helmet-async';
import Login from '../components/auth/Login';
import React from 'react';

const Connexion = () => {
  const pageTitle = 'Connexion à votre compte - PANAME CONSULTING';
  const pageDescription =
    "Accédez à votre espace personnel pour gérer votre dossier d'études à l'étranger avec Paname Consulting";
  const canonicalUrl = 'https://panameconsulting.com/connexion';

  return (
    <>
      <Helmet>
        {/* Balises fondamentales */}
        <title>{pageTitle}</title>
        <meta name='description' content={pageDescription} />
        <link rel='canonical' href={canonicalUrl} />

        {/* Balises de contrôle d'indexation */}
        <meta name='robots' content='noindex, nofollow' />
        <meta name='googlebot' content='noindex, nofollow' />

        {/* Balises Open Graph / Facebook */}
        <meta property='og:title' content={pageTitle} />
        <meta property='og:description' content={pageDescription} />
        <meta property='og:url' content={canonicalUrl} />
        <meta property='og:type' content='website' />
        <meta
          property='og:image'
          content='https://panameconsulting.vercel.app/paname-consulting.jpg'
        />
        <meta property='og:image:alt' content='Logo Paname Consulting' />

        {/* Balises Twitter */}
        <meta name='twitter:card' content='summary_large_image' />
        <meta name='twitter:title' content={pageTitle} />
        <meta name='twitter:description' content={pageDescription} />
        <meta
          name='twitter:image'
          content='https://panameconsulting.vercel.app/paname-consulting.jpg'
        />

        {/* Favicon et icônes */}
        <link rel='icon' href='/paname-consulting.ico' />
        <link
          rel='apple-touch-icon'
          sizes='180x180'
          href='/paname-consulting.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='32x32'
          href='/paname-consulting.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='16x16'
          href='/paname-consulting.png'
        />
        <link rel='manifest' href='/manifest.json' />
        <meta name='theme-color' content='#0369a1' />
      </Helmet>

      <main className='min-h-screen flex flex-col'>
        <Login />
      </main>
    </>
  );
};

export default React.memo(Connexion);
