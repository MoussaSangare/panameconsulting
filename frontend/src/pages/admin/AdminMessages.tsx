// AdminMessages.tsx - Version Mobile avec Toast uniques
import React, { useState, useEffect } from 'react';
import AdminContactService, {
  Contact,
  ContactStats,
} from '../../api/admin/AdminContactService';
import { toast } from 'react-toastify';

// Remplacer les imports Heroicons par :
import EyeIcon from '@heroicons/react/24/outline/EyeIcon';
import CheckIcon from '@heroicons/react/24/outline/CheckIcon';
import TrashIcon from '@heroicons/react/24/outline/TrashIcon';
import MagnifyingGlassIcon from '@heroicons/react/24/outline/MagnifyingGlassIcon';
import FunnelIcon from '@heroicons/react/24/outline/FunnelIcon';
import ArrowPathIcon from '@heroicons/react/24/outline/ArrowPathIcon';
import UserIcon from '@heroicons/react/24/outline/UserIcon';
import EnvelopeIcon from '@heroicons/react/24/outline/EnvelopeIcon';
import CalendarIcon from '@heroicons/react/24/outline/CalendarIcon';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { Helmet } from 'react-helmet-async';
import { FiSend } from 'react-icons/fi';

const AdminMessages: React.FC = () => {
  const contactService = AdminContactService();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // États pour la pagination et filtres
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    isRead: undefined as boolean | undefined,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);

  // Charger les contacts
  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await contactService.getAllContacts(filters);
      setContacts(response.data);
      setTotalContacts(response.total);
    } catch {
      toast.error('Erreur lors du chargement des messages');
    } finally {
      setLoading(false);
    }
  };

  // Charger les statistiques
  const loadStats = async () => {
    try {
      const statsData = await contactService.getContactStats();
      setStats(statsData);
    } catch {
      toast.error('Erreur lors du chargement des statistiques');
    }
  };

  useEffect(() => {
    loadContacts();
    loadStats();
  }, [filters]);

  // Gestionnaires d'actions
  const handleMarkAsRead = async (id: string) => {
    try {
      setActionLoading(`read-${id}`);
      await contactService.markAsRead(id);
      await loadContacts();
      await loadStats();
      toast.success('Message marqué comme lu');
    } catch {
      toast.error('Erreur lors du marquage du message');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReply = async () => {
    if (!selectedContact || !replyMessage.trim()) {
      toast.error('Veuillez saisir un message');
      return;
    }

    try {
      setActionLoading('reply');
      await contactService.replyToMessage(selectedContact._id, replyMessage);
      await loadContacts();
      await loadStats();
      setIsReplyModalOpen(false);
      setReplyMessage('');
      toast.success('Réponse envoyée avec succès');
    } catch {
      toast.error("Erreur lors de l'envoi de la réponse");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setActionLoading(`delete-${id}`);
      await contactService.deleteContact(id);
      await loadContacts();
      await loadStats();
      setIsDeleteModalOpen(false);
      setSelectedContact(null);
      toast.success('Message supprimé avec succès');
    } catch {
      toast.error('Erreur lors de la suppression du message');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDeleteModalOpen(true);
  };

  const handleViewDetails = async (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(true);

    // Marquer comme lu si ce n'est pas déjà fait
    if (!contact.isRead) {
      await handleMarkAsRead(contact._id);
    }
  };

  const handleOpenReply = (contact: Contact) => {
    setSelectedContact(contact);
    setIsReplyModalOpen(true);
  };

  // Formatage de la date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Gestion des filtres
  const handleFilterChange = (
    key: string,
    value: string | boolean | undefined
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const applyFilters = () => {
    setShowFilters(false);
    loadContacts();
  };

  const resetFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      search: '',
      isRead: undefined,
    });
    setShowFilters(false);
  };

  // Pagination
  const totalPages = Math.ceil(totalContacts / filters.limit);
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  // Rendu du statut
  const renderStatusBadge = (isRead: boolean, hasResponse: boolean) => {
    return (
      <div className='flex flex-wrap gap-1'>
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            isRead ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {isRead ? 'Lu' : 'Non lu'}
        </span>
        {hasResponse && (
          <span className='inline-flex px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full'>
            Répondu
          </span>
        )}
      </div>
    );
  };

  if (loading && contacts.length === 0) {
    return (
      <div className='min-h-screen bg-slate-50 p-3'>
        <div className='animate-pulse'>
          <div className='h-7 bg-blue-200 rounded w-2/5 mb-6'></div>
          <div className='space-y-3'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='h-24 bg-white rounded-lg shadow'></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gestion des Messages - Paname Consulting</title>
        <meta
          name='description'
          content="Interface d'administration pour gérer les messages des utilisateurs sur Paname Consulting. Accès réservé aux administrateurs."
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

      <div className='min-h-screen bg-slate-50 p-3'>
        {/* En-tête */}
        <div className='mb-4'>
          <h1 className='text-xl font-bold text-blue-600 mb-1'>
            Gestion des Messages
          </h1>
          <p className='text-slate-600 text-xs'>
            Gérez les messages des utilisateurs et répondez à leurs demandes
          </p>
        </div>

        {/* Bouton filtre mobile */}
        <div className='mb-4'>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className='w-full bg-white border border-slate-300 rounded-lg p-3 flex items-center justify-between shadow-sm'
          >
            <span className='text-sm font-medium text-slate-700'>
              Filtres et recherche
            </span>
            <FunnelIcon className='w-4 h-4 text-slate-500' />
          </button>
        </div>

        {/* Filtres mobile */}
        {showFilters && (
          <div className='bg-white rounded-lg shadow p-4 mb-4 fixed inset-3 z-40 overflow-y-auto'>
            <div className='flex justify-between items-center mb-3'>
              <h3 className='text-lg font-medium text-slate-900'>Filtres</h3>
              <button
                onClick={() => setShowFilters(false)}
                className='p-1 rounded-full hover:bg-slate-100'
              >
                <XMarkIcon className='w-5 h-5 text-slate-500' />
              </button>
            </div>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-slate-700 mb-1'>
                  Recherche
                </label>
                <div className='relative'>
                  <input
                    type='text'
                    placeholder='Nom, email ou message...'
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className='w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-none focus:border-blue-500 text-sm'
                  />
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <MagnifyingGlassIcon className='w-4 h-4 text-slate-400' />
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-slate-700 mb-1'>
                  Statut
                </label>
                <select
                  value={
                    filters.isRead === undefined
                      ? ''
                      : filters.isRead.toString()
                  }
                  onChange={e =>
                    handleFilterChange(
                      'isRead',
                      e.target.value === ''
                        ? undefined
                        : e.target.value === 'true'
                    )
                  }
                  className='w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-none focus:border-blue-500 text-sm'
                >
                  <option value=''>Tous les statuts</option>
                  <option value='false'>Non lus</option>
                  <option value='true'>Lus</option>
                </select>
              </div>

              <div className='flex space-x-2 pt-2'>
                <button
                  onClick={applyFilters}
                  className='flex-1 bg-blue-600 text-white px-3 py-2 text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center'
                >
                  <MagnifyingGlassIcon className='w-4 h-4 inline mr-1' />
                  Appliquer
                </button>
                <button
                  onClick={resetFilters}
                  className='flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors text-sm flex items-center justify-center'
                >
                  <ArrowPathIcon className='w-4 h-4 inline mr-1' />
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cartes de statistiques */}
        {stats && (
          <div className='grid grid-cols-2 gap-2 mb-4'>
            <div className='bg-white rounded-lg shadow p-3 border-l-4 border-blue-500'>
              <div className='flex items-center'>
                <div className='bg-blue-100 p-2 rounded-lg'>
                  <EnvelopeIcon className='w-4 h-4 text-blue-600' />
                </div>
                <div className='ml-3'>
                  <p className='text-xs text-blue-600'>Total</p>
                  <p className='text-base font-bold text-blue-900'>
                    {stats.total}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-lg shadow p-3 border-l-4 border-red-500'>
              <div className='flex items-center'>
                <div className='bg-red-100 p-2 rounded-lg'>
                  <EnvelopeIcon className='w-4 h-4 text-red-600' />
                </div>
                <div className='ml-3'>
                  <p className='text-xs text-red-600'>Non Lus</p>
                  <p className='text-base font-bold text-red-900'>
                    {stats.unread}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-lg shadow p-3 border-l-4 border-green-500'>
              <div className='flex items-center'>
                <div className='bg-green-100 p-2 rounded-lg'>
                  <CheckIcon className='w-4 h-4 text-green-600' />
                </div>
                <div className='ml-3'>
                  <p className='text-xs text-green-600'>Répondu</p>
                  <p className='text-base font-bold text-green-900'>
                    {stats.responded}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-lg shadow p-3 border-l-4 border-purple-500'>
              <div className='flex items-center'>
                <div className='bg-purple-100 p-2 rounded-lg'>
                  <CalendarIcon className='w-4 h-4 text-purple-600' />
                </div>
                <div className='ml-3'>
                  <p className='text-xs text-purple-600'>Ce Mois</p>
                  <p className='text-base font-bold text-purple-900'>
                    {stats.thisMonth}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Liste des messages */}
        <div className='bg-white rounded-lg shadow'>
          <div className='px-4 py-3 bg-blue-600 text-white'>
            <h2 className='text-base font-semibold'>
              Messages des Utilisateurs
            </h2>
          </div>

          <div className='divide-y divide-slate-200'>
            {contacts.map(contact => (
              <div
                key={contact._id}
                className={`p-3 hover:bg-slate-50 transition-colors ${
                  !contact.isRead ? 'bg-blue-25' : ''
                }`}
              >
                <div className='flex justify-between items-start mb-2'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='bg-blue-100 p-2 rounded-full flex-shrink-0'>
                      <UserIcon className='w-4 h-4 text-blue-600' />
                    </div>
                    <div className='ml-3 min-w-0 flex-1'>
                      <p className='text-sm font-medium text-slate-900 truncate'>
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className='text-xs text-slate-600 truncate'>
                        {contact.email}
                      </p>
                    </div>
                  </div>
                  <div className='ml-2 flex-shrink-0'>
                    {renderStatusBadge(contact.isRead, !!contact.adminResponse)}
                  </div>
                </div>

                <div className='mb-2'>
                  <p className='text-sm text-slate-900 line-clamp-2'>
                    {contact.message}
                  </p>
                </div>

                <div className='flex justify-between items-center'>
                  <div className='text-xs text-slate-500'>
                    {formatDate(contact.createdAt)}
                  </div>
                  <div className='flex space-x-1'>
                    <button
                      onClick={() => handleViewDetails(contact)}
                      className='text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors'
                      title='Voir les détails'
                    >
                      <EyeIcon className='w-4 h-4' />
                    </button>

                    <button
                      onClick={() => handleOpenReply(contact)}
                      className='text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors'
                      title='Répondre'
                    >
                      <FiSend className='w-4 h-4' />
                    </button>

                    {!contact.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(contact._id)}
                        disabled={actionLoading === `read-${contact._id}`}
                        className='text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50 transition-colors disabled:opacity-50'
                        title='Marquer comme lu'
                      >
                        <CheckIcon className='w-4 h-4' />
                      </button>
                    )}

                    <button
                      onClick={() => confirmDelete(contact)}
                      disabled={actionLoading === `delete-${contact._id}`}
                      className='text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50'
                      title='Supprimer'
                    >
                      <TrashIcon className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='px-3 py-3 bg-slate-50 border-t border-slate-200'>
              <div className='flex flex-col items-center justify-between space-y-2'>
                <p className='text-xs text-slate-700'>
                  Page {filters.page} sur {totalPages} • {totalContacts}{' '}
                  messages
                </p>
                <div className='flex space-x-2'>
                  <button
                    onClick={() => handlePageChange(filters.page - 1)}
                    disabled={filters.page === 1}
                    className='px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors'
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => handlePageChange(filters.page + 1)}
                    disabled={filters.page === totalPages}
                    className='px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors'
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          )}

          {contacts.length === 0 && !loading && (
            <div className='text-center py-8'>
              <EnvelopeIcon className='mx-auto h-8 w-8 text-slate-400' />
              <h3 className='mt-2 text-sm font-medium text-slate-900'>
                Aucun message
              </h3>
              <p className='mt-1 text-xs text-slate-500'>
                Aucun message ne correspond à vos critères de recherche.
              </p>
            </div>
          )}
        </div>

        {/* Modal de détails */}
        {isDetailModalOpen && selectedContact && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50'>
            <div className='bg-white rounded-lg w-full max-h-[85vh] overflow-y-auto'>
              <div className='px-4 py-3 bg-blue-600 text-white sticky top-0'>
                <h3 className='text-base font-semibold'>Détails du Message</h3>
              </div>

              <div className='p-4 space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-1'>
                    De
                  </label>
                  <p className='text-slate-900 font-medium'>
                    {selectedContact.firstName} {selectedContact.lastName}
                  </p>
                  <p className='text-slate-600 text-sm'>
                    {selectedContact.email}
                  </p>
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-1'>
                    Date d'envoi
                  </label>
                  <p className='text-slate-900'>
                    {formatDate(selectedContact.createdAt)}
                  </p>
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-1'>
                    Message
                  </label>
                  <div className='bg-slate-50 p-3 rounded-lg'>
                    <p className='text-slate-900 whitespace-pre-wrap text-sm'>
                      {selectedContact.message}
                    </p>
                  </div>
                </div>

                {selectedContact.adminResponse && (
                  <div>
                    <label className='block text-sm font-medium text-green-700 mb-1'>
                      Votre réponse
                    </label>
                    <div className='bg-green-50 p-3 rounded-lg'>
                      <p className='text-green-900 whitespace-pre-wrap text-sm'>
                        {selectedContact.adminResponse}
                      </p>
                      <p className='text-green-600 text-xs mt-2'>
                        Répondu le {formatDate(selectedContact.respondedAt!)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className='px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col space-y-2'>
                {!selectedContact.adminResponse && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenReply(selectedContact);
                    }}
                    className='px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors w-full'
                  >
                    Répondre
                  </button>
                )}
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className='px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-100 transition-colors w-full'
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de réponse */}
        {isReplyModalOpen && selectedContact && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50'>
            <div className='bg-white rounded-lg w-full'>
              <div className='px-4 py-3 bg-blue-600 text-white'>
                <h3 className='text-base font-semibold'>Répondre au message</h3>
              </div>

              <div className='p-4 space-y-4'>
                <div>
                  <p className='text-slate-900 font-medium text-sm'>
                    À : {selectedContact.firstName} {selectedContact.lastName}
                  </p>
                  <p className='text-slate-600 text-xs'>
                    {selectedContact.email}
                  </p>
                </div>

                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-2'>
                    Votre réponse
                  </label>
                  <textarea
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    rows={6}
                    className='w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-none focus:border-blue-500 resize-none'
                    placeholder='Tapez votre réponse ici...'
                  />
                </div>
              </div>

              <div className='px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col space-y-2'>
                <button
                  onClick={handleReply}
                  disabled={!replyMessage.trim() || actionLoading === 'reply'}
                  className='px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full'
                >
                  {actionLoading === 'reply'
                    ? 'Envoi...'
                    : 'Envoyer la réponse'}
                </button>
                <button
                  onClick={() => {
                    setIsReplyModalOpen(false);
                    setReplyMessage('');
                  }}
                  className='px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-100 transition-colors w-full'
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {isDeleteModalOpen && selectedContact && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50'>
            <div className='bg-white rounded-lg w-full max-w-sm'>
              <div className='px-4 py-3 bg-red-600 text-white'>
                <h3 className='text-base font-semibold'>
                  Confirmer la suppression
                </h3>
              </div>

              <div className='p-4'>
                <p className='text-slate-700 text-sm'>
                  Êtes-vous sûr de vouloir supprimer le message de{' '}
                  <strong>
                    {selectedContact.firstName} {selectedContact.lastName}
                  </strong>{' '}
                  ?
                </p>
                <p className='text-slate-500 text-xs mt-2'>
                  Cette action est irréversible.
                </p>
              </div>

              <div className='px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col space-y-2'>
                <button
                  onClick={() => handleDelete(selectedContact._id)}
                  disabled={actionLoading === `delete-${selectedContact._id}`}
                  className='px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full'
                >
                  {actionLoading === `delete-${selectedContact._id}`
                    ? 'Suppression...'
                    : 'Supprimer'}
                </button>
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedContact(null);
                  }}
                  className='px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-100 transition-colors w-full'
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminMessages;
