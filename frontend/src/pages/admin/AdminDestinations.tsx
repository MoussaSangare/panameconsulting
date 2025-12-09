/* eslint-disable no-undef */

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  destinationService,
  type Destination,
  type CreateDestinationData,
  type UpdateDestinationData,
} from '../../api/admin/AdminDestionService';
import { Helmet } from 'react-helmet-async';
import RequireAdmin from '../../context/RequireAdmin';

interface DataSourceInfo {
  count: number;
  lastUpdated: string | null;
}

const initialForm = {
  country: '',
  text: '',
};

const AdminDestinations: React.FC = (): React.JSX.Element => {
  const { access_token, user, isAuthenticated } = useAuth();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [popover, setPopover] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dataSourceInfo, setDataSourceInfo] = useState<DataSourceInfo>({
    count: 0,
    lastUpdated: null,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const popoverTimeout = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Affiche un popover animé
  const showPopover = (message: string, type: 'success' | 'error'): void => {
    setPopover({ message, type });
    if (popoverTimeout.current) clearTimeout(popoverTimeout.current);
    popoverTimeout.current = window.setTimeout(() => setPopover(null), 3000);
  };

  // Charger les destinations
  const fetchDestinations = async (): Promise<void> => {
    setLoading(true);
    try {
      const data =
        await destinationService.getAllDestinationsWithoutPagination();
      setDestinations(data);

      // Pour déboguer - seulement en développement
      if (import.meta.env.DEV) {
        console.log('Destinations loaded:', data);
        if (data.length > 0) {
          console.log('First destination image:', {
            originalPath: data[0]?.imagePath,
            fullUrl: destinationService.getFullImageUrl(
              data[0]?.imagePath || ''
            ),
          });
        }
      }

      // Mettre à jour les informations de source de données
      const stats = await destinationService.getStatistics();

      if (import.meta.env.DEV) {
        console.log('Stats:', stats);
      }

      setDataSourceInfo({
        count: data.length,
        lastUpdated:
          stats.lastUpdated ||
          new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
      });
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Erreur détaillée:', error);
      }
      showPopover(
        error.message || 'Erreur lors du chargement des destinations',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Vérifier les droits admin - CORRIGÉ
  const hasAdminRights = (): boolean => {
    if (!isAuthenticated || !user || !access_token) {
      if (import.meta.env.DEV) {
        console.log(
          'hasAdminRights: false - not authenticated/no user/no token'
        );
      }
      return false;
    }

    // Vérifier le rôle admin
    const isAdminUser = user.role === 'admin';

    if (import.meta.env.DEV) {
      console.log('hasAdminRights check:', {
        isAuthenticated,
        user,
        role: user?.role,
        hasToken: !!access_token,
        isAdminUser,
      });
    }

    return isAdminUser;
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const isAdmin = hasAdminRights();
    if (!isAdmin) {
      showPopover('Droits administrateur requis pour cette action', 'error');
      return;
    }

    setLoading(true);

    try {
      if (!form.country.trim() || !form.text.trim()) {
        showPopover('Veuillez remplir tous les champs obligatoires', 'error');
        return;
      }

      if (form.text.length < 10 || form.text.length > 2000) {
        showPopover(
          'La description doit contenir entre 10 et 2000 caractères',
          'error'
        );
        return;
      }

      if (editingId) {
        // Mise à jour destination existante
        const updateData: UpdateDestinationData = {
          country: form.country.trim(),
          text: form.text.trim(),
          ...(imageFile && { imageFile }),
        };

        await destinationService.updateDestination(
          editingId,
          updateData,
          access_token!
        );
        showPopover('Destination modifiée avec succès', 'success');
      } else {
        // Création nouvelle destination
        if (!imageFile) {
          showPopover('Veuillez sélectionner une image', 'error');
          return;
        }

        const createData: CreateDestinationData = {
          country: form.country.trim(),
          text: form.text.trim(),
          imageFile,
        };

        await destinationService.createDestination(createData, access_token!);
        showPopover('Destination ajoutée avec succès', 'success');
      }

      // Réinitialiser et rafraîchir
      handleCancelEdit();
      fetchDestinations();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Erreur détaillée:', error);
      }
      // Le message d'erreur est déjà géré par le service
    } finally {
      setLoading(false);
    }
  };

  // Suppression
  const handleDelete = async (id: string): Promise<void> => {
    const isAdmin = hasAdminRights();
    if (!isAdmin) {
      showPopover('Droits administrateur requis pour cette action', 'error');
      return;
    }

    setLoading(true);
    try {
      await destinationService.deleteDestination(id, access_token!);
      showPopover('Destination supprimée avec succès', 'success');
      setShowDeleteConfirm(null);
      fetchDestinations();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Erreur détaillée:', error);
      }
      // Le message d'erreur est déjà géré par le service
    } finally {
      setLoading(false);
    }
  };

  // Gestion des changements de formulaire
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Gestion de l'image
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validation via le service
      const validation = destinationService.validateImageFile(file);
      if (!validation.isValid) {
        showPopover(validation.error!, 'error');
        e.target.value = '';
        return;
      }

      setImageFile(file);
    }
  };

  // Édition
  const handleEdit = (dest: Destination): void => {
    setForm({
      country: dest.country,
      text: dest.text,
    });
    setEditingId(dest._id);
    setImageFile(null);
  };

  // Annuler l'édition
  const handleCancelEdit = (): void => {
    setForm(initialForm);
    setEditingId(null);
    setImageFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    // Log d'état d'authentification pour déboguer
    if (import.meta.env.DEV) {
      console.log('AdminDestinations Auth State:', {
        access_token,
        user,
        isAuthenticated,
        isAdmin: user?.role === 'admin',
        userObject: user,
      });
    }

    fetchDestinations();
    return () => {
      if (popoverTimeout.current) clearTimeout(popoverTimeout.current);
    };
  }, [access_token, user, isAuthenticated]);

  const isAdmin = hasAdminRights();

  return (
    <>
      <Helmet>
        <title>Page de gestion des Destinations - Paname Consulting</title>
        <meta
          name='description'
          content="Interface d'administration pour gérer les destinations de voyage sur Paname Consulting. Accès réservé aux administrateurs."
        />
        <meta name='robots' content='noindex, nofollow' />
        <meta name='googlebot' content='noindex, nofollow' />
        <meta name='bingbot' content='noindex, nofollow' />
        <meta name='yandexbot' content='noindex, nofollow' />
        <meta name='duckduckbot' content='noindex, nofollow' />
        <meta name='baidu' content='noindex, nofollow' />
        <meta name='naver' content='noindex, nofollow' />
        <meta name='seznam' content='noindex, nofollow' />
      </Helmet>

      <RequireAdmin>
        <div className='min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 max-w-[1024px] mx-auto overflow-x-hidden'>
          {/* Header */}
          <div className='mb-4 px-4'>
            <div className='flex items-center gap-2 mb-1'>
              <div className='p-2 bg-blue-500 rounded-lg'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  viewBox='0 0 24 24'
                >
                  <path d='M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z' />
                </svg>
              </div>
              <div>
                <h1 className='text-xl font-bold text-slate-800'>
                  Gestion des Destinations
                </h1>
                <p className='text-slate-600 text-sm'>
                  Administrez les destinations de voyage
                </p>
              </div>
            </div>
          </div>

          {/* Cartes de statistiques */}
          {dataSourceInfo && (
            <div className='grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4 px-4'>
              <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
                <div className='flex items-center'>
                  <div className='p-2 bg-blue-500 rounded-lg'>
                    <svg
                      className='w-4 h-4 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                      />
                    </svg>
                  </div>
                  <div className='ml-2'>
                    <p className='text-xs text-slate-600'>Total</p>
                    <p className='text-lg font-bold text-slate-800'>
                      {dataSourceInfo.count}
                    </p>
                  </div>
                </div>
              </div>

              <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
                <div className='flex items-center'>
                  <div className='p-2 bg-emerald-500 rounded-lg'>
                    <svg
                      className='w-4 h-4 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </div>
                  <div className='ml-2'>
                    <p className='text-xs text-slate-600'>Statut</p>
                    <p className='text-lg font-bold text-slate-800'>Actif</p>
                  </div>
                </div>
              </div>

              {dataSourceInfo.lastUpdated && (
                <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
                  <div className='flex items-center'>
                    <div className='p-2 bg-purple-500 rounded-lg'>
                      <svg
                        className='w-4 h-4 text-white'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                    </div>
                    <div className='ml-2'>
                      <p className='text-xs text-slate-600'>Mise à jour</p>
                      <p className='text-sm font-bold text-slate-800 truncate'>
                        {dataSourceInfo.lastUpdated}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Popover global */}
          {popover && (
            <div
              className={`fixed top-4 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 flex items-center gap-2
              ${popover.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
            >
              {popover.type === 'success' ? (
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              ) : (
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              )}
              <span>{popover.message}</span>
            </div>
          )}

          {/* Formulaire */}
          <div className='bg-white rounded-xl border border-slate-200/60 p-4 mb-4 shadow-sm mx-4'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                {editingId ? (
                  <>
                    <svg
                      className='w-5 h-5 text-blue-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                      />
                    </svg>
                    Modifier une destination
                  </>
                ) : (
                  <>
                    <svg
                      className='w-5 h-5 text-blue-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                    Nouvelle destination
                  </>
                )}
              </h2>
            </div>

            {!isAdmin && (
              <div className='mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg'>
                <p className='text-amber-800 text-sm flex items-center gap-2'>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                    />
                  </svg>
                  Droits administrateur requis pour modifier les destinations
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-3'>
                <div>
                  <label
                    htmlFor='country'
                    className='text-sm font-medium text-slate-700 mb-1 flex items-center gap-2'
                  >
                    <svg
                      className='w-4 h-4 text-slate-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                    Pays *
                  </label>
                  <input
                    id='country'
                    name='country'
                    value={form.country}
                    onChange={handleChange}
                    required
                    disabled={!isAdmin}
                    className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    placeholder='Nom du pays'
                  />
                </div>

                <div>
                  <label
                    htmlFor='image'
                    className='text-sm font-medium text-slate-700 mb-1 flex items-center gap-2'
                  >
                    <svg
                      className='w-4 h-4 text-slate-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
                      />
                    </svg>
                    Image {!editingId && '*'}
                  </label>
                  <input
                    id='image'
                    name='image'
                    type='file'
                    accept='image/*'
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    disabled={!isAdmin}
                    className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 hover:border-blue-400 transition-all duration-200 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed'
                  />
                  <p className='text-xs text-slate-500 mt-1'>
                    JPG, PNG, WEBP, SVG - Max 5MB
                  </p>

                  {imageFile && (
                    <p className='text-sm text-green-600 mt-2 flex items-center gap-2'>
                      <svg
                        className='w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                      Fichier sélectionné: {imageFile.name}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor='text'
                  className='text-sm font-medium text-slate-700 mb-1 flex items-center gap-2'
                >
                  <svg
                    className='w-4 h-4 text-slate-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M4 6h16M4 12h16m-7 6h7'
                    />
                  </svg>
                  Description *
                </label>
                <textarea
                  id='text'
                  name='text'
                  value={form.text}
                  onChange={handleChange}
                  required
                  disabled={!isAdmin}
                  rows={4}
                  className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                  placeholder='Description de la destination (10-2000 caractères)'
                />
                <div className='flex justify-between items-center mt-1'>
                  <p className='text-xs text-slate-500'>
                    {form.text.length}/2000 caractères
                  </p>
                  {(form.text.length < 10 || form.text.length > 2000) && (
                    <p className='text-xs text-red-600 flex items-center gap-1'>
                      <svg
                        className='w-3 h-3'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                        />
                      </svg>
                      10-2000 caractères requis
                    </p>
                  )}
                </div>
              </div>

              <div className='flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200'>
                <button
                  type='submit'
                  disabled={loading || !isAdmin}
                  className='flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {loading ? (
                    <>
                      <svg
                        className='animate-spin w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                        />
                      </svg>
                      {editingId ? 'Modification...' : 'Ajout...'}
                    </>
                  ) : editingId ? (
                    <>
                      <svg
                        className='w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                      Modifier
                    </>
                  ) : (
                    <>
                      <svg
                        className='w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M12 4v16m8-8H4'
                        />
                      </svg>
                      Ajouter
                    </>
                  )}
                </button>

                {editingId && (
                  <button
                    type='button'
                    onClick={handleCancelEdit}
                    disabled={!isAdmin}
                    className='flex-1 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-none disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Liste des destinations */}
          <div className='bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm mx-4'>
            {/* En-tête */}
            <div className='px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    />
                  </svg>
                  <h2 className='text-base font-semibold'>
                    Liste des Destinations
                  </h2>
                  <span className='bg-blue-400 text-blue-100 px-2 py-0.5 rounded-full text-xs'>
                    {destinations.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Version tablette - Cartes améliorées */}
            <div className='lg:hidden'>
              {loading ? (
                <div className='p-4 text-center'>
                  <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto'></div>
                  <p className='text-slate-600 mt-2 text-sm'>
                    Chargement sécurisé...
                  </p>
                </div>
              ) : destinations.length === 0 ? (
                <div className='p-6 text-center text-slate-500'>
                  <svg
                    className='w-12 h-12 mx-auto mb-2 text-slate-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                  <p className='text-slate-500'>
                    Aucune destination à afficher
                  </p>
                  <p className='text-slate-400 text-sm mt-1'>
                    Commencez par ajouter votre première destination
                  </p>
                </div>
              ) : (
                <div className='divide-y divide-slate-200'>
                  {destinations.map(dest => (
                    <div
                      key={dest._id}
                      className='p-4 hover:bg-slate-50 transition-colors'
                    >
                      <div className='flex gap-3'>
                        <div className='flex-shrink-0'>
                          <img
                            src={destinationService.getFullImageUrl(
                              dest.imagePath
                            )}
                            alt={dest.country}
                            className='w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm'
                            onError={e => {
                              (e.target as HTMLImageElement).src =
                                '/paname-placeholder.png';
                            }}
                          />
                        </div>

                        <div className='flex-1 min-w-0'>
                          <h3 className='font-semibold text-slate-800 truncate flex items-center gap-2'>
                            {dest.country}
                          </h3>

                          <p className='text-slate-600 text-sm mt-1 line-clamp-2'>
                            {dest.text}
                          </p>

                          <div className='flex gap-3 mt-3'>
                            <button
                              onClick={() => handleEdit(dest)}
                              disabled={!isAdmin}
                              className='text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              <svg
                                className='w-4 h-4'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                                />
                              </svg>
                              Modifier
                            </button>

                            <button
                              onClick={() => setShowDeleteConfirm(dest._id)}
                              disabled={!isAdmin}
                              className='text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              <svg
                                className='w-4 h-4'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                />
                              </svg>
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Version desktop - Tableau */}
            <div className='hidden lg:block overflow-x-auto'>
              <table className='w-full min-w-[600px]'>
                <thead className='bg-slate-50'>
                  <tr>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      <div className='flex items-center gap-2'>
                        <svg
                          className='w-4 h-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        Destination
                      </div>
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Description
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-slate-200'>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className='px-4 py-8 text-center'>
                        <div className='flex justify-center'>
                          <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
                        </div>
                        <p className='text-slate-600 mt-2 text-sm'>
                          Chargement sécurisé...
                        </p>
                      </td>
                    </tr>
                  ) : destinations.length === 0 ? (
                    <tr>
                      <td colSpan={3} className='px-4 py-8 text-center'>
                        <svg
                          className='w-16 h-16 mx-auto mb-4 text-slate-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        <p className='text-slate-500'>
                          Aucune destination trouvée
                        </p>
                      </td>
                    </tr>
                  ) : (
                    destinations.map(dest => (
                      <tr
                        key={dest._id}
                        className='hover:bg-slate-50 transition-colors'
                      >
                        <td className='px-4 py-4'>
                          <div className='flex items-center'>
                            <img
                              src={destinationService.getFullImageUrl(
                                dest.imagePath
                              )}
                              alt={dest.country}
                              className='w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm'
                              onError={e => {
                                (e.target as HTMLImageElement).src =
                                  '/paname-placeholder.png';
                              }}
                            />
                            <div className='ml-3'>
                              <p className='text-sm font-medium text-slate-800'>
                                {dest.country}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className='px-4 py-4'>
                          <p className='text-sm text-slate-600 line-clamp-2'>
                            {dest.text}
                          </p>
                        </td>

                        <td className='px-4 py-4'>
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={() => handleEdit(dest)}
                              disabled={!isAdmin}
                              className='p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                              title='Modifier la destination'
                            >
                              <svg
                                className='w-4 h-4'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                                />
                              </svg>
                            </button>

                            <button
                              onClick={() => setShowDeleteConfirm(dest._id)}
                              disabled={!isAdmin}
                              className='p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                              title='Supprimer la destination'
                            >
                              <svg
                                className='w-4 h-4'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de confirmation suppression */}
          {showDeleteConfirm && (
            <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
              <div className='bg-white rounded-xl border border-slate-200/60 max-w-md w-full'>
                <div className='flex items-center justify-between p-4 border-b border-slate-200'>
                  <div className='flex items-center gap-2'>
                    <svg
                      className='w-5 h-5 text-red-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                      />
                    </svg>
                    <h2 className='text-lg font-bold text-slate-800'>
                      Confirmation
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className='p-1.5 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 transition-all duration-200'
                  >
                    <svg
                      className='w-5 h-5 text-slate-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='p-4'>
                  <p className='text-sm text-slate-600 text-center'>
                    Supprimer la destination{' '}
                    <span className='font-semibold text-slate-800'>
                      {
                        destinations.find(d => d._id === showDeleteConfirm)
                          ?.country
                      }
                    </span>{' '}
                    ?
                  </p>
                  <p className='text-xs text-slate-500 text-center mt-1'>
                    Cette action est irréversible.
                  </p>
                </div>

                <div className='flex gap-3 p-4 border-t border-slate-200'>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className='flex-1 px-4 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-none focus:border-blue-500 hover:border-blue-400 transition-all duration-200'
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleDelete(showDeleteConfirm)}
                    disabled={!isAdmin}
                    className={`flex-1 px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-none focus:border-blue-500 transition-all duration-200 flex items-center justify-center gap-2 ${
                      !isAdmin
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                      />
                    </svg>
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </RequireAdmin>
    </>
  );
};

export default AdminDestinations;
