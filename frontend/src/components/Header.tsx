/* eslint-disable no-undef */

import {
  Calendar,
  FileText,
  Home as HomeIcon,
  Info as InfoIcon,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail as MailIcon,
  Menu,
  Phone as PhoneIcon,
  Settings as ToolsIcon,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header(): React.JSX.Element {
  const { user, isAuthenticated, logout, isLoading: authLoading } = useAuth();
  const [showTopBar] = useState(true);
  const [nav, setNav] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [blinkColor, setBlinkColor] = useState('text-gray-600');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogoClick = (): void => {
    if (!isMounted) return;
    if (location.pathname === '/') {
      window?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        nav &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(event.target as Node)
      ) {
        setNav(false);
      }

      if (
        dropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (nav) setNav(false);
        if (dropdownOpen) setDropdownOpen(false);
      }
    };

    document?.addEventListener('mousedown', handleClickOutside);
    document?.addEventListener('keydown', handleEscapeKey);

    return () => {
      document?.removeEventListener('mousedown', handleClickOutside);
      document?.removeEventListener('keydown', handleEscapeKey);
    };
  }, [nav, dropdownOpen]);

  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;
    const blink = (): void => {
      setBlinkColor('text-sky-500');
      blinkTimeout = setTimeout(() => {
        setBlinkColor('text-gray-600');
      }, 2000);
    };

    const blinkInterval = setInterval(blink, 6000);

    return () => {
      clearInterval(blinkInterval);
      clearTimeout(blinkTimeout);
    };
  }, []);

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.sessionStorage?.removeItem('redirect_after_login');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    } finally {
      setIsLoggingOut(false);
      setDropdownOpen(false);
      if (nav) setNav(false);
    }
  };

  const handleProtectedNavigation = (path: string, isMobile: boolean = false): void => {
    if (!isAuthenticated) {
      window.sessionStorage?.setItem('redirect_after_login', path);
      navigate('/connexion', {
        state: {
          message: 'Veuillez vous connecter pour accéder à cette page',
          from: path,
        }
      });
    } else {
      navigate(path);
      if (isMobile && nav) setNav(false);
      if (!isMobile) setDropdownOpen(false);
    }
  };

  const navItems = [
    { name: 'Accueil', path: '/', icon: <HomeIcon className='w-5 h-5' /> },
    {
      name: 'Services',
      path: '/services',
      icon: <ToolsIcon className='w-5 h-5' />,
      className: blinkColor,
    },
    {
      name: 'À Propos',
      path: '/a-propos',
      icon: <InfoIcon className='w-5 h-5' />,
    },
    {
      name: 'Contact',
      path: '/contact',
      icon: <MailIcon className='w-5 h-5' />,
    },
  ];

  const userMenuItems = [
    {
      name: 'Tableau de bord',
      path: '/gestionnaire/statistiques',
      icon: <LayoutDashboard className='w-4 h-4' />,
      visible: user?.role === 'admin' || user?.isAdmin === true,
      requiresAuth: true,
      section: 'admin',
    },
    {
      name: 'Ma Procédure',
      path: '/ma-procedure',
      icon: <FileText className='w-4 h-4' />,
      visible: user?.role === 'user',
      requiresAuth: true,
      section: 'user',
    },
    {
      name: 'Mes Rendez-Vous',
      path: '/mes-rendez-vous',
      icon: <Calendar className='w-4 h-4' />,
      visible: user?.role === 'user',
      requiresAuth: true,
      section: 'user',
    },
    {
      name: 'Mon Profil',
      path: '/mon-profil',
      icon: <UserIcon className='w-4 h-4' />,
      visible: true,
      requiresAuth: true,
      section: 'profile',
    },
    {
      name: 'Déconnexion',
      action: handleLogout,
      icon: isLoggingOut ? (
        <div className='w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin'></div>
      ) : (
        <LogOut className='w-4 h-4' />
      ),
      visible: isAuthenticated,
      disabled: isLoggingOut,
      requiresAuth: true,
      section: 'logout',
    },
  ];

  const getUserInitials = (): string => {
    if (!user) return '';
    const firstNameInitial = user.firstName ? user.firstName.charAt(0).toUpperCase() : '';
    const lastNameInitial = user.lastName ? user.lastName.charAt(0).toUpperCase() : '';
    return `${firstNameInitial}${lastNameInitial}`;
  };

  const getUserDisplayName = (): string => {
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || '';
  };

  // Menu admin simplifié - seulement Tableau de bord
  const adminMenuItems = [
    {
      name: 'Tableau de bord',
      path: '/gestionnaire/statistiques',
      icon: <LayoutDashboard className='w-4 h-4' />,
      visible: user?.role === 'admin' || user?.isAdmin === true,
    },
    {
      name: 'Mon Profil',
      path: '/gestionnaire/profil',
      icon: <UserIcon className='w-4 h-4' />,
      visible: true,
    },
    {
      name: 'Déconnexion',
      action: handleLogout,
      icon: isLoggingOut ? (
        <div className='w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin'></div>
      ) : (
        <LogOut className='w-4 h-4' />
      ),
      visible: true,
      disabled: isLoggingOut,
    },
  ];

  // Menu utilisateur normal
  const normalUserMenuItems = [
    {
      name: 'Ma Procédure',
      path: '/ma-procedure',
      icon: <FileText className='w-4 h-4' />,
      visible: true,
    },
    {
      name: 'Mes Rendez-Vous',
      path: '/mes-rendez-vous',
      icon: <Calendar className='w-4 h-4' />,
      visible: true,
    },
    {
      name: 'Mon Profil',
      path: '/mon-profil',
      icon: <UserIcon className='w-4 h-4' />,
      visible: true,
    },
    {
      name: 'Déconnexion',
      action: handleLogout,
      icon: isLoggingOut ? (
        <div className='w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin'></div>
      ) : (
        <LogOut className='w-4 h-4' />
      ),
      visible: true,
      disabled: isLoggingOut,
    },
  ];

  // Sélection du menu selon le rôle
  const getMenuItems = () => {
    if (user?.role === 'admin' || user?.isAdmin === true) {
      return adminMenuItems;
    }
    return normalUserMenuItems;
  };

  const currentMenuItems = getMenuItems();

  return (
    <header role='banner' className='fixed top-0 z-50 w-full font-sans '>
      {/* Top Bar - Desktop seulement */}
      <div
        className={`bg-sky-500 text-white text-sm transition-all duration-300 ${showTopBar ? 'h-10' : 'h-0 overflow-hidden'} hidden md:block`}
        aria-hidden={!showTopBar}
      >
        <div className='mx-auto px-4 h-full flex flex-row items-center justify-between'>
          <div className='flex items-center space-x-6'>
            <a
              href='tel:+22391830941'
              className='flex items-center font-medium hover:text-sky-100 transition-colors'
              aria-label='Numéro de téléphone Paname Consulting'
            >
              <PhoneIcon className='w-4 h-4 mr-2' />
              <span>+223 91 83 09 41</span>
            </a>
            <a
              href='mailto:panameconsulting906@gmail.com'
              className='flex items-center font-medium hover:text-sky-100 transition-colors'
              aria-label='Adresse e-mail Paname Consulting'
            >
              <MailIcon className='w-4 h-4 mr-2' />
              <span>panameconsulting906@gmail.com</span>
            </a>
          </div>
          <div className='flex items-center'>
            <span
              className='font-semibold bg-white/20 px-3 py-1 rounded-full'
              aria-label='Slogan de Paname Consulting: Le cap vers l excellence'
            >
              LE CAP VERS L'EXCELLENCE
            </span>
          </div>
        </div>
      </div>

      {/* Navigation principale */}
      <nav
        className='bg-white shadow-md sm:py-1'
        role='navigation'
        aria-label='Menu principal'
      >
        <div className='px-4'>
          <div className='flex items-center justify-between py-4 lg:py-1 md:py-0'>
            {/* Logo */}
            <div
              className='flex items-center cursor-pointer'
              onClick={handleLogoClick}
              role='button'
              tabIndex={0}
              aria-label="Retour à l'accueil"
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleLogoClick();
                }
              }}
            >
              <div className='w-12 h-12 md:w-16 md:h-16 rounded-full shadow-sm'>
                <img
                  src='/paname-consulting.jpg'
                  alt='Logo Paname Consulting'
                  className='w-full h-auto rounded'
                  width={64}
                  height={64}
                  loading='lazy'
                />
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className='hidden lg:flex items-center space-x-4'>
              {/* Navigation principale */}
              <ul
                className='flex space-x-2'
                role='menubar'
                aria-label='Navigation principale'
              >
                {navItems.map(item => (
                  <li key={item.path} role='none'>
                    <Link
                      to={item.path}
                      role='menuitem'
                      aria-current={
                        location.pathname === item.path ? 'page' : undefined
                      }
                      className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm md:text-base hover:bg-gray-50 ${
                        location.pathname === item.path
                          ? 'text-sky-600 border-b-2 border-sky-500'
                          : 'text-gray-600 hover:text-sky-500'
                      } ${item.className || ''}`}
                    >
                      {item.icon}
                      <span className='ml-2'>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Avatar seulement visible lorsque connecté */}
              {isAuthenticated && user ? (
                <div className='relative ml-2 md:ml-4' ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className='flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-sky-500 text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 transition-all duration-200 hover:scale-105 hover:bg-sky-600'
                    aria-label='Menu utilisateur'
                    aria-expanded={dropdownOpen}
                    aria-haspopup='true'
                    disabled={authLoading}
                  >
                    <span className='text-xs md:text-sm font-semibold'>
                      {getUserInitials()}
                    </span>
                  </button>

                  {dropdownOpen && (
                    <div
                      className='absolute right-0 mt-2 w-48 md:w-56 bg-white rounded-lg shadow-xl py-1 z-50 border border-gray-200'
                      role='menu'
                      aria-orientation='vertical'
                    >
                      {/* Header du dropdown */}
                      <div className='px-3 md:px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg'>
                        <p className='text-sm font-semibold text-gray-800 truncate'>
                          {getUserDisplayName()}
                        </p>
                        <p className='text-xs text-gray-500 truncate mt-1'>
                          {user?.email}
                        </p>
                        {user?.role === 'admin' || user?.isAdmin === true ? (
                          <div className='mt-2'>
                            <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-800'>
                              Administrateur
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Liens utilisateur */}
                      <div className='py-2'>
                        {currentMenuItems
                          .filter(item => item.visible)
                          .map((item, index) =>
                            item.path ? (
                              <button
                                key={index}
                                onClick={() => handleProtectedNavigation(item.path)}
                                className='flex w-full items-center px-3 md:px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-sky-600 transition-all duration-150 font-medium'
                                role='menuitem'
                                disabled={item.disabled}
                                aria-disabled={item.disabled}
                              >
                                <span className='shrink-0 text-gray-400'>
                                  {item.icon}
                                </span>
                                <span className='ml-3 truncate'>{item.name}</span>
                                {user?.role === 'admin' && item.name === 'Tableau de bord' && (
                                  <span className='ml-auto text-xs text-sky-500 font-semibold'>
                                    ADMIN
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                key={index}
                                onClick={() => {
                                  if (item.action) item.action();
                                }}
                                className='flex w-full items-center px-3 md:px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all duration-150 font-medium mt-2 border-t border-gray-100'
                                role='menuitem'
                                disabled={item.disabled}
                                aria-disabled={item.disabled}
                              >
                                <span className='shrink-0'>
                                  {item.icon}
                                </span>
                                <span className='ml-3 truncate'>{item.name}</span>
                              </button>
                            )
                          )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex items-center space-x-1 md:space-x-2 ml-2 md:ml-4'>
                  <Link
                    to='/connexion'
                    className='flex items-center px-3 py-1.5 md:px-4 md:py-2 text-sky-600 hover:bg-sky-50 border border-sky-200 transition-all duration-200 rounded-full font-medium text-sm md:text-base hover:border-sky-300'
                    aria-label='Se connecter'
                    state={{ from: location.pathname }}
                  >
                    <LogIn className='w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2' />
                    <span className='hidden sm:inline'>Connexion</span>
                    <span className='sm:hidden'>Login</span>
                  </Link>
                  <Link
                    to='/inscription'
                    className='flex items-center px-3 py-1.5 md:px-4 md:py-2 text-white bg-sky-500 hover:bg-sky-600 transition-all duration-200 rounded-full font-medium text-sm md:text-base'
                    aria-label='Créer un compte'
                  >
                    <UserPlus className='w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2' />
                    <span className='hidden sm:inline'>Inscription</span>
                    <span className='sm:hidden'>Sign up</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Bouton hamburger mobile */}
            <button
              ref={hamburgerRef}
              className='lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-all duration-200'
              onClick={() => setNav(!nav)}
              aria-label={nav ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={nav}
              aria-controls='mobile-menu'
              disabled={authLoading}
            >
              {nav ? (
                <X className='w-6 h-6 text-gray-700' />
              ) : (
                <Menu className='w-6 h-6 text-gray-700' />
              )}
            </button>
          </div>

          {/* MOBILE MENU */}
          {nav && (
            <div
              id='mobile-menu'
              className='lg:hidden fixed inset-0 bg-black/50 z-40 mt-16'
              onClick={() => setNav(false)}
              ref={mobileMenuRef}
            >
              <div
                className='absolute right-0 top-0 w-4/5 max-w-sm h-full bg-white shadow-lg overflow-y-auto'
                role='menu'
                aria-label='Navigation mobile'
                onClick={(e) => e.stopPropagation()}
              >
                {/* En-tête mobile */}
                <div className='sticky top-0 bg-white border-b z-10'>
                  <div className='px-4 py-3 flex items-center justify-between bg-gray-50'>
                    <div className='flex items-center'>
                      {/* Avatar mobile seulement si connecté */}
                      {isAuthenticated && (
                        <div className='flex items-center justify-center w-10 h-10 rounded-full bg-sky-500 text-white font-bold mr-3'>
                          {getUserInitials()}
                        </div>
                      )}
                      <div>
                        {isAuthenticated ? (
                          <>
                            <p className='text-sm font-bold text-gray-800 truncate'>
                              {getUserDisplayName()}
                            </p>
                            <p className='text-xs text-gray-500 truncate'>
                              {user?.email}
                            </p>
                            {user?.role === 'admin' && (
                              <span className='inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-sky-100 text-sky-800'>
                                Administrateur
                              </span>
                            )}
                          </>
                        ) : (
                          <p className='text-sm font-bold text-gray-800'>
                            Menu Paname Consulting
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONTENU DU MENU MOBILE */}
                <div className='p-4 space-y-6'>
                  {/* SECTION 1: LIENS AUTHENTIFIÉS (si connecté) */}
                  {isAuthenticated && (
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between px-2 mb-2'>
                        <h3 className='text-xs font-bold text-gray-700 uppercase tracking-wider'>
                          Mon Espace
                        </h3>
                        <span className='text-xs font-semibold text-sky-600 bg-sky-100 px-2 py-0.5 rounded'>
                          Connecté
                        </span>
                      </div>
                      {currentMenuItems
                        .filter(item => item.name !== 'Déconnexion')
                        .map((item, index) => (
                          <div key={index}>
                            {item.path ? (
                              <button
                                onClick={() => handleProtectedNavigation(item.path, true)}
                                className='flex w-full items-center px-3 py-3 text-gray-800 hover:bg-gray-50 hover:text-sky-600 rounded-lg transition-all duration-150 font-medium'
                                role='menuitem'
                                disabled={item.disabled}
                                aria-disabled={item.disabled}
                              >
                                <span className='shrink-0 text-sky-500'>
                                  {item.icon}
                                </span>
                                <span className='ml-3 flex-1 text-left font-semibold'>{item.name}</span>
                                {user?.role === 'admin' && item.name === 'Tableau de bord' && (
                                  <span className='ml-2 text-xs font-bold text-white bg-sky-500 px-2 py-0.5 rounded'>
                                    ADMIN
                                  </span>
                                )}
                                <span className='ml-2 text-gray-400'>
                                  →
                                </span>
                              </button>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* SECTION 2: NAVIGATION PRINCIPALE */}
                  <div className={`${isAuthenticated ? 'border-t border-gray-200 pt-4' : ''}`}>
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 px-2'>
                        Navigation
                      </h3>
                      {navItems.map(item => (
                        <div key={item.path}>
                          <Link
                            to={item.path}
                            onClick={() => setNav(false)}
                            role='menuitem'
                            aria-current={
                              location.pathname === item.path ? 'page' : undefined
                            }
                            className={`flex items-center px-3 py-3 rounded-lg transition-all duration-150 font-medium ${
                              location.pathname === item.path
                                ? 'bg-sky-50 text-sky-600 border-l-4 border-sky-500'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-sky-500'
                            }`}
                          >
                            <span className={`shrink-0 ${
                              location.pathname === item.path ? 'text-sky-500' : 'text-gray-400'
                            }`}>
                              {item.icon}
                            </span>
                            <span className='ml-3 flex-1 font-medium'>{item.name}</span>
                            {location.pathname === item.path && (
                              <span className='text-xs font-semibold text-sky-500 bg-sky-100 px-2 py-0.5 rounded'>
                                Actif
                              </span>
                            )}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 3: AUTHENTIFICATION (si non connecté) */}
                  {!isAuthenticated && (
                    <div className='pt-4 border-t border-gray-200'>
                      <h3 className='text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 px-2'>
                        Compte
                      </h3>
                      <div className='space-y-2'>
                        <Link
                          to='/connexion'
                          onClick={() => setNav(false)}
                          className='flex items-center justify-between w-full px-3 py-3 text-sky-600 hover:bg-sky-50 border border-sky-200 rounded-lg transition-all duration-200 font-medium hover:border-sky-300'
                          role='menuitem'
                          state={{ from: location.pathname }}
                        >
                          <div className='flex items-center'>
                            <LogIn className='w-5 h-5 mr-2 text-sky-500' />
                            <span className='font-semibold'>Connexion</span>
                          </div>
                          <span className='text-xs text-gray-500'>
                            →
                          </span>
                        </Link>
                        <Link
                          to='/inscription'
                          onClick={() => setNav(false)}
                          className='flex items-center justify-between w-full px-3 py-3 text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-all duration-200 font-medium'
                          role='menuitem'
                        >
                          <div className='flex items-center'>
                            <UserPlus className='w-5 h-5 mr-2' />
                            <span className='font-semibold'>Inscription</span>
                          </div>
                          <span className='text-xs text-white/90'>
                            →
                          </span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: DÉCONNEXION (en bas si connecté) */}
                  {isAuthenticated && (
                    <div className='pt-4 border-t border-gray-200'>
                      <div className='space-y-2'>
                        <button
                          onClick={handleLogout}
                          className='flex w-full items-center justify-between px-3 py-3 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all duration-200 font-medium'
                          role='menuitem'
                          disabled={isLoggingOut}
                          aria-disabled={isLoggingOut}
                        >
                          <div className='flex items-center'>
                            {isLoggingOut ? (
                              <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2'></div>
                            ) : (
                              <LogOut className='w-5 h-5 mr-2' />
                            )}
                            <span className='font-semibold'>
                              {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
                            </span>
                          </div>
                          <span className='text-xs text-white/80'>
                            →
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Header;