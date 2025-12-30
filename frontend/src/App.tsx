import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { Helmet } from 'react-helmet-async';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';

// Components communs
import Header from './components/Header';
import Footer from './components/Footer';
import Loader from './components/Loader';

// Pages publiques
import Accueil from './pages/Accueil';
import Contact from './pages/Contact';
import Propos from './pages/Propos';
import Services from './pages/Services';
import NotFound from './pages/Notfound';
import RendezVous from './pages/user/rendezvous/RendezVous';

// Pages de connexion, inscription, mot de passe oublié
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import MotdePasseoublie from './pages/MotdePasseoublie';

// Pages admin (lazy loaded)
const UsersManagement = lazy(() => import('./pages/admin/UsersManagement'));
const AdminLayout = lazy(() => import('./AdminLayout'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));
const AdminProcedure = lazy(() => import('./pages/admin/AdminProcedure'));
const AdminDestinations = lazy(() => import('./pages/admin/AdminDestinations'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminRendezVous = lazy(() => import('./pages/admin/AdminRendez-Vous'));

// Restrictions admin
import RequireAdmin from './context/RequireAdmin';

import MesRendezVous from './pages/user/rendezvous/MesRendezVous';
import UserProfile from './pages/user/UserProfile';
import UserProcedure from './pages/user/UserProcedure';
import ResetPassword from './components/auth/ResetPassword';

// Layout pour les pages publiques
const PublicLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
      <Header />
      <main className='flex-1 mt-20'>{children}</main>
      <Footer />
    </div>
  );
};

// Layout minimal sans Header ni Footer
const MinimalLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
      <main className='flex-1'>{children}</main>
    </div>
  );
};

// Layout pour la page d'accueil avec loader intégré
const AccueilLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [showLoader, setShowLoader] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Timer pour montrer le loader sur la page d'accueil seulement
    const timer = setTimeout(() => {
      setShowLoader(false);
      setHasLoaded(true);
    }, 2000); // Durée du loader sur la page d'accueil

    return () => clearTimeout(timer);
  }, []);

  // Si ce n'est pas la page d'accueil, ne pas montrer le loader
  if (location.pathname !== '/') {
    return (
      <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
        <Header />
        <main className='flex-1 mt-20'>{children}</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className='flex flex-col min-h-screen w-full overflow-x-hidden touch-pan-y'>
      <Header />
      <main className='flex-1 mt-20'>
        {/* Loader uniquement sur la page d'accueil */}
        {showLoader ? (
          <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
            <Loader />
          </div>
        ) : null}
        {/* Contenu avec transition */}
        <div className={showLoader ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

function App() {
  const location = useLocation();
  const [navigationKey, setNavigationKey] = useState(0);
  const { isLoading, isAuthenticated, user } = useAuth();
  const [isAOSInitialized, setIsAOSInitialized] = useState(false);

  const safeScrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (typeof globalThis.window === 'undefined') return;

    try {
      globalThis.window.scrollTo({
        top: 0,
        behavior: behavior,
      });
    } catch {
      globalThis.window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    safeScrollToTop();

    const handlePopState = () => {
      safeScrollToTop('auto');
      setNavigationKey(prev => prev + 1);
    };

    globalThis.window.addEventListener('popstate', handlePopState);
    return () => {
      globalThis.window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, safeScrollToTop]);

  useEffect(() => {
    if (typeof globalThis.window === 'undefined' || isAOSInitialized) return;

    AOS.init({
      duration: 600,
      once: true,
      easing: 'ease-out-cubic',
      offset: 50,
    });

    setIsAOSInitialized(true);
  }, [isAOSInitialized]);

  // Loader global pendant le chargement de l'authentification
  if (isLoading) {
    return <Loader />;
  }

  return (
    <ErrorBoundary>
      <Helmet>
        <title>
          Paname Consulting - Études à l'Étranger, Voyages d'Affaires & demandes
          de Visas
        </title>
        <meta
          name='description'
          content="Paname Consulting : expert en accompagnement étudiant à l'étranger, organisation de voyages d'affaires et demandes de visa. Conseil personnalisé pour votre réussite internationale."
        />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=5" 
        />
        <link rel="icon" href="/paname-consulting.ico" sizes="any" />
        <link rel="icon" href="/paname-consulting.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/paname-consulting.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta property="og:url" content="https://panameconsulting.vercel.app" />
      </Helmet>

      <div key={navigationKey}>
        <Routes>
          {/* Page d'accueil avec loader */}
          <Route
            path='/'
            element={
              <AccueilLayout>
                <Accueil />
              </AccueilLayout>
            }
          />

          {/* Autres pages publiques sans loader */}
          <Route
            path='/services'
            element={
              <PublicLayout>
                <Services />
              </PublicLayout>
            }
          />

          <Route
            path='/contact'
            element={
              <PublicLayout>
                <Contact />
              </PublicLayout>
            }
          />

          <Route
            path='/a-propos'
            element={
              <PublicLayout>
                <Propos />
              </PublicLayout>
            }
          />

          {/* Routes authentifiées (utilisateurs) */}
          <Route
            path='/rendez-vous'
            element={
              isAuthenticated ? (
                <MinimalLayout>
                  <RendezVous />
                </MinimalLayout>
              ) : (
                <Navigate
                  to='/connexion'
                  replace
                  state={{ from: location.pathname }}
                />
              )
            }
          />

          <Route
            path='/mes-rendez-vous'
            element={
              isAuthenticated ? (
                <MinimalLayout>
                  <MesRendezVous />
                </MinimalLayout>
              ) : (
                <Navigate
                  to='/connexion'
                  replace
                  state={{ from: location.pathname }}
                />
              )
            }
          />

          <Route
            path='/mon-profil'
            element={
              isAuthenticated ? (
                <MinimalLayout>
                  <UserProfile />
                </MinimalLayout>
              ) : (
                <Navigate
                  to='/connexion'
                  replace
                  state={{ from: location.pathname }}
                />
              )
            }
          />

          <Route
            path='/ma-procedure'
            element={
              isAuthenticated ? (
                <MinimalLayout>
                  <UserProcedure />
                </MinimalLayout>
              ) : (
                <Navigate
                  to='/connexion'
                  replace
                  state={{ from: location.pathname }}
                />
              )
            }
          />

          {/* Routes d'authentification */}
          <Route
            path='/reset-password'
            element={
              <MinimalLayout>
                <ResetPassword />
              </MinimalLayout>
            }
          />

          <Route
            path='/connexion'
            element={
              isAuthenticated ? (
                <Navigate
                  to={user?.role === 'admin' || user?.isAdmin === true 
                    ? '/'  // ← MODIFIÉ: Redirige vers la page d'accueil, pas vers /gestionnaire/statistiques
                    : '/'}
                  replace
                />
              ) : (
                <MinimalLayout>
                  <Connexion />
                </MinimalLayout>
              )
            }
          />

          <Route
            path='/inscription'
            element={
              isAuthenticated ? (
                <Navigate
                  to={user?.role === 'admin' || user?.isAdmin === true 
                    ? '/'  // ← MODIFIÉ: Redirige vers la page d'accueil, pas vers /gestionnaire/statistiques
                    : '/'}
                  replace
                />
              ) : (
                <MinimalLayout>
                  <Inscription />
                </MinimalLayout>
              )
            }
          />

          <Route
            path='/mot-de-passe-oublie'
            element={
              isAuthenticated ? (
                <Navigate
                  to={user?.role === 'admin' || user?.isAdmin === true 
                    ? '/'  // ← MODIFIÉ: Redirige vers la page d'accueil, pas vers /gestionnaire/statistiques
                    : '/'}
                  replace
                />
              ) : (
                <MinimalLayout>
                  <MotdePasseoublie />
                </MinimalLayout>
              )
            }
          />

          {/* Routes admin - TOUTES LES ROUTES EXPLICITES */}
          {/* /gestionnaire seul → NotFound */}
          <Route path="/gestionnaire" element={<NotFound />} />

          {/* Routes admin avec layout */}
          <Route
            path='/gestionnaire/statistiques'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />
          
          <Route
            path='/gestionnaire/utilisateurs'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <UsersManagement />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />
          
          <Route
            path='/gestionnaire/messages'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <AdminMessages />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />
          
          <Route
            path='/gestionnaire/procedures'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <AdminProcedure />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />
          
          <Route
            path='/gestionnaire/profil'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <AdminProfile />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />
          
          <Route
            path='/gestionnaire/destinations'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <AdminDestinations />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />
          
          <Route
            path='/gestionnaire/rendez-vous'
            element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}>
                  <AdminLayout>
                    <AdminRendezVous />
                  </AdminLayout>
                </Suspense>
              </RequireAdmin>
            }
          />

          {/* Autres routes sous /gestionnaire → NotFound */}
          <Route path="/gestionnaire/*" element={<NotFound />} />

          {/* Route 404 pour toutes les autres routes */}
          <Route path='*' element={<NotFound />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}

export default App;