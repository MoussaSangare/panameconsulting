import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  XCircle,
  X,
  Shield,
  AlertTriangle,
  RefreshCw,
  User,
  Eye,
  EyeOff,
  Key,
  Info,
  MoreVertical,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useAdminUserService, {
  User as UserType,
  UserStats,
  CreateUserDto,
  UpdateUserDto,
  AdminResetPasswordDto,
} from '../../api/admin/AdminUserService'; // Chemin corrigé
import { toast } from 'react-toastify';
import { Helmet } from 'react-helmet-async';

// Créer un alias pour éviter le conflit
interface AppUser extends UserType {}

// Interface locale pour création d'utilisateur
interface LocalCreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  password: string;
  role: 'admin' | 'user';
}

const UsersManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  
  // Utiliser le hook de service - CORRECTION
  const {
    getAllUsers,
    getUserStats,
    createUser: createUserService,
    updateUser: updateUserService,
    adminResetPassword: adminResetPasswordService,
    deleteUser: deleteUserService,
    toggleUserStatus: toggleUserStatusService,
    canAccessAdmin,
    isUserAdmin
  } = useAdminUserService();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState<string | null>(null);

  const [newUser, setNewUser] = useState<LocalCreateUserDto>({
    firstName: '',
    lastName: '',
    email: '',
    telephone: '',
    password: '',
    role: 'user',
  });

  const [editUser, setEditUser] = useState<UpdateUserDto>({});
  const [passwordData, setPasswordData] = useState<AdminResetPasswordDto>({
    newPassword: '',
    confirmNewPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileTouched, setProfileTouched] = useState<Record<string, boolean>>({});

  // Vérifier l'accès admin
  useEffect(() => {
    if (!canAccessAdmin) {
      toast.error('Accès refusé : droits administrateur requis');
    }
  }, [canAccessAdmin]);

  // Charger les utilisateurs
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error: any) {
      toast.error(`${error.message || 'Erreur lors du chargement'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les statistiques
  const loadStats = async () => {
    try {
      const statsData = await getUserStats();
      setStats(statsData);
    } catch (error: any) {
      toast.error(`${error.message || 'Erreur lors du chargement des statistiques'}`);
    }
  };

  useEffect(() => {
    if (canAccessAdmin) {
      loadUsers();
      loadStats();
    }
  }, [canAccessAdmin]);

  // Validation email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validation téléphone
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateProfileField = (name: string, value: string) => {
    let error = '';

    if (name === 'email' && value && !validateEmail(value)) {
      error = "Format d'email invalide";
    }

    if (name === 'telephone' && value && !validatePhone(value)) {
      error = 'Format de téléphone invalide';
    }

    setProfileErrors(prev => ({
      ...prev,
      [name]: error,
    }));

    return !error;
  };

  const handleProfileChange = (field: keyof UpdateUserDto, value: string) => {
    const newData = {
      ...editUser,
      [field]: value,
    };

    setEditUser(newData);
    setProfileTouched(prev => ({ ...prev, [field]: true }));
    validateProfileField(field, value);
  };

  const validateProfileBeforeSubmit = (): boolean => {
    const errors: Record<string, string> = {};

    if (editUser.email && !validateEmail(editUser.email)) {
      errors.email = "Format d'email invalide";
    }

    if (editUser.telephone && !validatePhone(editUser.telephone)) {
      errors.telephone = 'Format de téléphone invalide';
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async () => {
    try {
      if (!newUser.firstName?.trim() || !newUser.lastName?.trim()) {
        toast.error('Le prénom et le nom sont obligatoires');
        return;
      }

      if (!newUser.email || !validateEmail(newUser.email)) {
        toast.error("Format d'email invalide");
        return;
      }

      if (!newUser.telephone || !validatePhone(newUser.telephone)) {
        toast.error('Format de téléphone invalide');
        return;
      }

      if (!newUser.password || newUser.password.length < 8) {
        toast.error('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }

      const createUserDto: CreateUserDto = {
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        email: newUser.email.toLowerCase().trim(),
        telephone: newUser.telephone.trim(),
        password: newUser.password,
        role: newUser.role
      };

      const createdUser = await createUserService(createUserDto);

      setUsers(prev => [...prev, createdUser]);
      await loadStats();

      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        telephone: '',
        password: '',
        role: 'user',
      });

      setIsAddModalOpen(false);
      toast.success('Utilisateur créé avec succès');
    } catch (error: any) {
      toast.error(`${error.message}`);
    }
  };

  const handleEditUser = async () => {
    try {
      if (!selectedUser) {
        toast.error('Données manquantes');
        return;
      }

      if (!validateProfileBeforeSubmit()) {
        toast.error('Veuillez corriger les erreurs dans le formulaire');
        return;
      }

      const hasChanges =
        (editUser.email && editUser.email !== selectedUser.email) ||
        (editUser.telephone && editUser.telephone !== selectedUser.telephone);

      if (!hasChanges) {
        toast.error('Aucune modification détectée');
        return;
      }

      const updateData: UpdateUserDto = {};
      
      if (editUser.email && editUser.email !== selectedUser.email) {
        updateData.email = editUser.email.toLowerCase().trim();
      }
      
      if (editUser.telephone && editUser.telephone !== selectedUser.telephone) {
        updateData.telephone = editUser.telephone.trim();
      }

      const updatedUser = await updateUserService(selectedUser.id, updateData);

      setUsers(prev =>
        prev.map(user =>
          user.id === selectedUser.id ? { ...user, ...updatedUser } : user
        )
      );

      await loadStats();
      setEditUser({});
      setProfileErrors({});
      setProfileTouched({});
      setIsEditModalOpen(false);
      setSelectedUser(null);

      toast.success('Utilisateur modifié avec succès');
    } catch (error: any) {
      toast.error(`${error.message}`);
    }
  };

  const handleAdminResetPassword = async () => {
    try {
      if (!selectedUser) {
        toast.error('Données manquantes');
        return;
      }

      if (!passwordData.newPassword || passwordData.newPassword.length < 8) {
        toast.error('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmNewPassword) {
        toast.error('Les mots de passe ne correspondent pas');
        return;
      }

      await adminResetPasswordService(selectedUser.id, passwordData);

      setPasswordData({
        newPassword: '',
        confirmNewPassword: '',
      });
      setIsPasswordModalOpen(false);
      setSelectedUser(null);

      toast.success('Mot de passe réinitialisé avec succès');
    } catch (error: any) {
      toast.error(`${error.message}`);
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (!selectedUser) {
        toast.error('Données manquantes');
        return;
      }

      if (selectedUser.id === currentUser?.id) {
        toast.error('Vous ne pouvez pas supprimer votre propre compte');
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
        return;
      }

      await deleteUserService(selectedUser.id);

      setUsers(prev => prev.filter(user => user.id !== selectedUser.id));
      await loadStats();

      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      toast.success('Utilisateur supprimé avec succès');
    } catch (error: any) {
      toast.error(`${error.message}`);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    try {
      if (user.id === currentUser?.id) {
        toast.error('Vous ne pouvez pas désactiver votre propre compte');
        return;
      }

      const updatedUser = await toggleUserStatusService(user.id);

      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, ...updatedUser } : u))
      );

      await loadStats();
      toast.success(
        `Utilisateur ${!user.isActive ? 'activé' : 'désactivé'} avec succès`
      );
    } catch (error: any) {
      toast.error(`${error.message}`);
    }
  };

  const openEditModal = (user: AppUser) => {
    setSelectedUser(user);
    setEditUser({
      email: user.email,
      telephone: user.telephone,
    });
    setProfileErrors({});
    setProfileTouched({});
    setIsEditModalOpen(true);
    setShowMobileMenu(null);
  };

  const openPasswordModal = (user: AppUser) => {
    setSelectedUser(user);
    setPasswordData({
      newPassword: '',
      confirmNewPassword: '',
    });
    setIsPasswordModalOpen(true);
    setShowMobileMenu(null);
  };

  const openDeleteModal = (user: AppUser) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
    setShowMobileMenu(null);
  };

  const resetEditForm = () => {
    if (selectedUser) {
      setEditUser({
        email: selectedUser.email,
        telephone: selectedUser.telephone,
      });
    }
    setProfileErrors({});
    setProfileTouched({});
  };

  const hasEditChanges = () => {
    if (!selectedUser) return false;
    return (
      (editUser.email && editUser.email !== selectedUser.email) ||
      (editUser.telephone && editUser.telephone !== selectedUser.telephone)
    );
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(searchLower) ||
      user.lastName.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.telephone.includes(searchTerm)
    );
  });

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <UserCheck className='w-3 h-3 text-emerald-500' />
    ) : (
      <UserX className='w-3 h-3 text-rose-500' />
    );
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Actif' : 'Inactif';
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? (
      <ShieldCheck className='w-3 h-3 text-blue-500' />
    ) : (
      <User className='w-3 h-3 text-gray-500' />
    );
  };

  const getRoleText = (role: string) => {
    return role === 'admin' ? 'Administrateur' : 'Utilisateur';
  };

  const getRoleColor = (role: string) => {
    return role === 'admin'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';
  };

  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Accès refusé
          </h2>
          <p className="text-gray-600">
            Vous n'avez pas les droits administrateur requis pour accéder à cette page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gestion des Utilisateurs - Paname Consulting</title>
        <meta
          name='description'
          content="Interface d'administration pour gérer les comptes utilisateurs sur Paname Consulting. Accès réservé aux administrateurs."
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
      <div className='min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30 max-w-5xl mx-auto overflow-x-hidden'>
        <div className='mb-4 px-4'>
          <div className='flex items-center gap-2 mb-1'>
            <div className='p-2 bg-blue-500 rounded-lg'>
              <Users className='w-5 h-5 text-white' />
            </div>
            <div>
              <h1 className='text-xl font-bold text-slate-800'>
                Gestion des Utilisateurs
              </h1>
              <p className='text-slate-600 text-sm'>
                Administrez les comptes utilisateurs
              </p>
            </div>
          </div>
        </div>

        {stats && (
          <div className='grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4 px-4'>
            <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
              <div className='flex items-center'>
                <div className='p-2 bg-blue-500 rounded-lg'>
                  <Users className='w-4 h-4 text-white' />
                </div>
                <div className='ml-2'>
                  <p className='text-xs text-slate-600'>Total</p>
                  <p className='text-lg font-bold text-slate-800'>
                    {stats.totalUsers}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
              <div className='flex items-center'>
                <div className='p-2 bg-emerald-500 rounded-lg'>
                  <UserCheck className='w-4 h-4 text-white' />
                </div>
                <div className='ml-2'>
                  <p className='text-xs text-slate-600'>Actifs</p>
                  <p className='text-lg font-bold text-slate-800'>
                    {stats.activeUsers}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
              <div className='flex items-center'>
                <div className='p-2 bg-rose-500 rounded-lg'>
                  <UserX className='w-4 h-4 text-white' />
                </div>
                <div className='ml-2'>
                  <p className='text-xs text-slate-600'>Inactifs</p>
                  <p className='text-lg font-bold text-slate-800'>
                    {stats.inactiveUsers}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
              <div className='flex items-center'>
                <div className='p-2 bg-purple-500 rounded-lg'>
                  <ShieldCheck className='w-4 h-4 text-white' />
                </div>
                <div className='ml-2'>
                  <p className='text-xs text-slate-600'>Admins</p>
                  <p className='text-lg font-bold text-slate-800'>
                    {stats.adminUsers}
                  </p>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm'>
              <div className='flex items-center'>
                <div className='p-2 bg-slate-500 rounded-lg'>
                  <User className='w-4 h-4 text-white' />
                </div>
                <div className='ml-2'>
                  <p className='text-xs text-slate-600'>Utilisateurs</p>
                  <p className='text-lg font-bold text-slate-800'>
                    {stats.regularUsers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className='bg-white rounded-xl border border-slate-200/60 p-3 mb-4 shadow-sm mx-4'>
          <div className='flex flex-col space-y-3'>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <Search className='w-4 h-4 text-slate-400' />
              </div>
              <input
                type='text'
                placeholder='Rechercher un utilisateur...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
              />
            </div>

            <div className='flex gap-2'>
              <button
                onClick={() => {
                  loadUsers();
                  loadStats();
                  toast.info('Actualisation...');
                }}
                className='flex-1 px-3 py-2.5 bg-slate-500 text-white rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center gap-2'
              >
                <RefreshCw className='w-4 h-4' />
                <span className='text-sm'>Actualiser</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className='flex-1 px-3 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center gap-2'
              >
                <Plus className='w-4 h-4' />
                <span className='text-sm'>Nouveau</span>
              </button>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm mx-4'>
          <div className='px-4 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <User className='w-4 h-4' />
                <h2 className='text-base font-semibold'>
                  Liste des Utilisateurs
                </h2>
                <span className='bg-blue-400 text-blue-100 px-2 py-0.5 rounded-full text-xs'>
                  {filteredUsers.length}
                </span>
              </div>
            </div>
          </div>

          <div className='lg:hidden'>
            {isLoading ? (
              <div className='p-4 text-center'>
                <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto'></div>
                <p className='text-slate-600 mt-2 text-sm'>
                  Chargement...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className='p-6 text-center text-slate-500'>
                <User className='w-12 h-12 mx-auto mb-2 text-slate-400' />
                <p className='text-slate-500'>Aucun utilisateur trouvé</p>
                {searchTerm && (
                  <p className='text-slate-400 text-sm mt-1'>
                    Aucun résultat pour "{searchTerm}"
                  </p>
                )}
              </div>
            ) : (
              <div className='divide-y divide-slate-200'>
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className='p-4 hover:bg-slate-50 transition-colors'
                  >
                    <div className='flex justify-between items-start mb-3'>
                      <div className='flex items-center flex-1 min-w-0'>
                        <div className='w-12 h-12 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shrink-0'>
                          <User className='w-6 h-6 text-white' />
                        </div>
                        <div className='ml-3 flex-1 min-w-0'>
                          <h3 className='font-semibold text-slate-800 truncate'>
                            {user.firstName} {user.lastName}
                          </h3>
                          <div className='flex items-center gap-1 mt-1'>
                            <Mail className='w-3 h-3 text-slate-400 shrink-0' />
                            <p className='text-xs text-slate-600 truncate'>
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className='relative shrink-0'>
                        <button
                          onClick={() =>
                            setShowMobileMenu(
                              showMobileMenu === user.id ? null : user.id
                            )
                          }
                          className='p-2 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                        >
                          <MoreVertical className='w-4 h-4 text-slate-500' />
                        </button>

                        {showMobileMenu === user.id && (
                          <div className='absolute right-0 top-10 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-45'>
                            <button
                              onClick={() => openEditModal(user)}
                              className='w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-b border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            >
                              <Edit className='w-4 h-4' />
                              Modifier
                            </button>
                            <button
                              onClick={() => openPasswordModal(user)}
                              className='w-full px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 border-b border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            >
                              <Key className='w-4 h-4' />
                              Réinitialiser MDP
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={user.id === currentUser?.id}
                              className='w-full px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2 border-b border-slate-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            >
                              {user.isActive ? (
                                <EyeOff className='w-4 h-4' />
                              ) : (
                                <Eye className='w-4 h-4' />
                              )}
                              {user.isActive ? 'Désactiver' : 'Activer'}
                            </button>
                            <button
                              onClick={() => openDeleteModal(user)}
                              disabled={user.id === currentUser?.id}
                              className='w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            >
                              <Trash2 className='w-4 h-4' />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className='flex flex-wrap gap-2 mb-3'>
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getRoleColor(user.role)}`}
                      >
                        {getRoleIcon(user.role)}
                        <span className='ml-1.5'>{getRoleText(user.role)}</span>
                      </span>
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(user.isActive)}`}
                      >
                        {getStatusIcon(user.isActive)}
                        <span className='ml-1.5'>
                          {getStatusText(user.isActive)}
                        </span>
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-sm text-slate-600 mb-2'>
                      <Phone className='w-4 h-4 text-slate-400 shrink-0' />
                      <span className='truncate'>{user.telephone}</span>
                    </div>

                    <div className='text-xs text-slate-500 truncate'>
                      ID: {user.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='hidden lg:block overflow-x-auto'>
            <table className='w-full min-w-45'>
              <thead className='bg-slate-50'>
                <tr>
                  <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                    <div className='flex items-center gap-2'>
                      <User className='w-4 h-4' />
                      Utilisateur
                    </div>
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                    <div className='flex items-center gap-2'>
                      <Mail className='w-4 h-4' />
                      Contact
                    </div>
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                    <div className='flex items-center gap-2'>
                      <Shield className='w-4 h-4' />
                      Rôle
                    </div>
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                    Statut
                  </th>
                  <th className='px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-slate-200'>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className='px-4 py-8 text-center'>
                      <div className='flex justify-center'>
                        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500'></div>
                      </div>
                      <p className='text-slate-600 mt-2 text-sm'>
                        Chargement...
                      </p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='px-4 py-8 text-center'>
                      <User className='w-16 h-16 mx-auto mb-4 text-slate-400' />
                      <p className='text-slate-500'>Aucun utilisateur trouvé</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr
                      key={user.id}
                      className='hover:bg-slate-50 transition-colors'
                    >
                      <td className='px-4 py-4'>
                        <div className='flex items-center'>
                          <div className='w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center'>
                            <User className='w-5 h-5 text-white' />
                          </div>
                          <div className='ml-3'>
                            <p className='text-sm font-medium text-slate-800'>
                              {user.firstName} {user.lastName}
                            </p>
                            <p className='text-xs text-slate-500'>
                              ID: {user.id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className='px-4 py-4'>
                        <div className='space-y-1'>
                          <div className='flex items-center gap-2 text-sm text-slate-700'>
                            <Mail className='w-4 h-4 text-slate-400' />
                            <span>{user.email}</span>
                          </div>
                          <div className='flex items-center gap-2 text-sm text-slate-700'>
                            <Phone className='w-4 h-4 text-slate-400' />
                            <span>{user.telephone}</span>
                          </div>
                        </div>
                      </td>

                      <td className='px-4 py-4'>
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}
                        >
                          {getRoleIcon(user.role)}
                          <span className='ml-1.5'>
                            {getRoleText(user.role)}
                          </span>
                        </span>
                      </td>

                      <td className='px-4 py-4'>
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(user.isActive)}`}
                        >
                          {getStatusIcon(user.isActive)}
                          <span className='ml-1.5'>
                            {getStatusText(user.isActive)}
                          </span>
                        </span>
                      </td>

                      <td className='px-4 py-4'>
                        <div className='flex items-center gap-1'>
                          <button
                            onClick={() => openEditModal(user)}
                            className='p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                            title="Modifier l'utilisateur"
                          >
                            <Edit className='w-4 h-4' />
                          </button>

                          <button
                            onClick={() => openPasswordModal(user)}
                            className='p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                            title='Réinitialiser le mot de passe'
                          >
                            <Key className='w-4 h-4' />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={user.id === currentUser?.id}
                            className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                              user.id === currentUser?.id
                                ? 'text-slate-400 cursor-not-allowed'
                                : user.isActive
                                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={
                              user.id === currentUser?.id
                                ? 'Impossible de modifier votre statut'
                                : user.isActive
                                  ? 'Désactiver'
                                  : 'Activer'
                            }
                          >
                            {user.isActive ? (
                              <EyeOff className='w-4 h-4' />
                            ) : (
                              <Eye className='w-4 h-4' />
                            )}
                          </button>

                          <button
                            onClick={() => openDeleteModal(user)}
                            disabled={user.id === currentUser?.id}
                            className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                              user.id === currentUser?.id
                                ? 'text-slate-400 cursor-not-allowed'
                                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                            title={
                              user.id === currentUser?.id
                                ? 'Impossible de supprimer votre compte'
                                : 'Supprimer'
                            }
                          >
                            <Trash2 className='w-4 h-4' />
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

        {isAddModalOpen && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
            <div className='bg-white rounded-xl border border-slate-200/60 max-w-md w-full max-h-[85vh] overflow-y-auto'>
              <div className='flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white'>
                <h2 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                  <User className='w-5 h-5 text-blue-500' />
                  Nouvel Utilisateur
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className='p-1.5 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                >
                  <X className='w-5 h-5 text-slate-500' />
                </button>
              </div>

              <div className='p-4 space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                      <User className='w-4 h-4 text-slate-400' />
                      Prénom *
                    </label>
                    <input
                      type='text'
                      value={newUser.firstName}
                      onChange={e =>
                        setNewUser({ ...newUser, firstName: e.target.value })
                      }
                      placeholder='Jean'
                      className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-2'>
                    <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                      <User className='w-4 h-4 text-slate-400' />
                      Nom *
                    </label>
                    <input
                      type='text'
                      value={newUser.lastName}
                      onChange={e =>
                        setNewUser({ ...newUser, lastName: e.target.value })
                      }
                      placeholder='Dupont'
                      className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Mail className='w-4 h-4 text-slate-400' />
                    Email *
                  </label>
                  <input
                    type='email'
                    value={newUser.email}
                    onChange={e =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder='jean.dupont@example.com'
                    className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Phone className='w-4 h-4 text-slate-400' />
                    Téléphone *
                  </label>
                  <input
                    type='tel'
                    value={newUser.telephone}
                    onChange={e =>
                      setNewUser({ ...newUser, telephone: e.target.value })
                    }
                    placeholder='+33 1 23 45 67 89'
                    className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Key className='w-4 h-4 text-slate-400' />
                    Mot de passe *
                  </label>
                  <div className='relative'>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={e =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      placeholder='Minimum 8 caractères'
                      className='w-full px-3 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    >
                      {showPassword ? (
                        <EyeOff className='w-4 h-4' />
                      ) : (
                        <Eye className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                  <p className='text-xs text-slate-500'>
                    Doit contenir au moins 8 caractères
                  </p>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Shield className='w-4 h-4 text-slate-400' />
                    Rôle
                  </label>
                  <select
                    value={newUser.role}
                    onChange={e =>
                      setNewUser({
                        ...newUser,
                        role: e.target.value as 'admin' | 'user',
                      })
                    }
                    className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                  >
                    <option value='user'>Utilisateur</option>
                    <option value='admin'>Administrateur</option>
                  </select>
                </div>
              </div>

              <div className='flex gap-3 p-4 border-t border-slate-200 sticky bottom-0 bg-white'>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className='flex-1 px-4 py-2.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200'
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddUser}
                  className='flex-1 px-4 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center gap-2'
                >
                  <User className='w-4 h-4' />
                  Créer
                </button>
              </div>
            </div>
          </div>
        )}

        {isEditModalOpen && selectedUser && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
            <div className='bg-white rounded-xl border border-slate-200/60 max-w-md w-full max-h-[85vh] overflow-y-auto'>
              <div className='flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white'>
                <h2 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                  <Edit className='w-5 h-5 text-blue-500' />
                  Modifier l&apos;utilisateur
                </h2>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className='p-1.5 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                >
                  <X className='w-5 h-5 text-slate-500' />
                </button>
              </div>

              <div className='p-4 space-y-4'>
                <div className='bg-slate-50 rounded-lg p-3'>
                  <p className='text-sm font-medium text-slate-700'>
                    Modification de:{' '}
                    <span className='font-semibold'>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </span>
                  </p>
                  <p className='text-xs text-slate-500 mt-1'>
                    ID: {selectedUser.id}
                  </p>
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                      <User className='w-4 h-4 text-slate-400' />
                      Prénom
                    </label>
                    <input
                      type='text'
                      value={selectedUser.firstName}
                      disabled
                      className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed'
                    />
                    <p className='text-xs text-slate-500'>Non modifiable</p>
                  </div>

                  <div className='space-y-2'>
                    <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                      <User className='w-4 h-4 text-slate-400' />
                      Nom
                    </label>
                    <input
                      type='text'
                      value={selectedUser.lastName}
                      disabled
                      className='w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed'
                    />
                    <p className='text-xs text-slate-500'>Non modifiable</p>
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Mail className='w-4 h-4 text-slate-400' />
                    Email
                  </label>
                  <input
                    type='email'
                    value={editUser.email || ''}
                    onChange={e => handleProfileChange('email', e.target.value)}
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200 ${
                      profileErrors.email
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-slate-300'
                    }`}
                    placeholder='nouvel@email.com'
                  />
                  {profileTouched.email && profileErrors.email && (
                    <p className='text-xs text-red-600 flex items-center gap-2'>
                      <XCircle className='w-3 h-3' />
                      {profileErrors.email}
                    </p>
                  )}
                  <p className='text-xs text-slate-500'>
                    Actuel: {selectedUser.email}
                  </p>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Phone className='w-4 h-4 text-slate-400' />
                    Téléphone
                  </label>
                  <input
                    type='tel'
                    value={editUser.telephone || ''}
                    onChange={e =>
                      handleProfileChange('telephone', e.target.value)
                    }
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200 ${
                      profileErrors.telephone
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-slate-300'
                    }`}
                    placeholder='+33 1 23 45 67 89'
                  />
                  {profileTouched.telephone && profileErrors.telephone && (
                    <p className='text-xs text-red-600 flex items-center gap-2'>
                      <XCircle className='w-3 h-3' />
                      {profileErrors.telephone}
                    </p>
                  )}
                  <p className='text-xs text-slate-500'>
                    Actuel: {selectedUser.telephone}
                  </p>
                </div>

                <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                  <div className='flex items-start'>
                    <Info className='w-4 h-4 text-blue-500 mt-0.5 mr-2 shrink-0' />
                    <div>
                      <p className='text-xs text-blue-800 font-medium'>
                        Informations
                      </p>
                      <p className='text-xs text-blue-600 mt-0.5'>
                        Seuls l&apos;email et le téléphone peuvent être
                        modifiés.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='flex gap-3 p-4 border-t border-slate-200 sticky bottom-0 bg-white'>
                <button
                  onClick={resetEditForm}
                  disabled={!hasEditChanges()}
                  className='flex-1 px-4 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Annuler
                </button>
                <button
                  onClick={handleEditUser}
                  disabled={
                    !hasEditChanges() ||
                    Object.keys(profileErrors).some(key => profileErrors[key])
                  }
                  className={`flex-1 px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center gap-2 ${
                    !hasEditChanges() ||
                    Object.keys(profileErrors).some(key => profileErrors[key])
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  <Edit className='w-4 h-4' />
                  Modifier
                </button>
              </div>
            </div>
          </div>
        )}

        {isPasswordModalOpen && selectedUser && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
            <div className='bg-white rounded-xl border border-slate-200/60 max-w-md w-full'>
              <div className='flex items-center justify-between p-4 border-b border-slate-200'>
                <h2 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                  <Key className='w-5 h-5 text-green-500' />
                  Réinitialiser le mot de passe
                </h2>
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className='p-1.5 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                >
                  <X className='w-5 h-5 text-slate-500' />
                </button>
              </div>

              <div className='p-4 space-y-4'>
                <div className='bg-amber-50 border border-amber-200 rounded-lg p-3'>
                  <div className='flex items-start'>
                    <AlertTriangle className='w-4 h-4 text-amber-600 mt-0.5 mr-2 shrink-0' />
                    <div>
                      <p className='text-sm font-medium text-amber-800'>
                        Réinitialisation
                      </p>
                      <p className='text-xs text-amber-700 mt-1'>
                        Modification du mot de passe de{' '}
                        <strong>
                          {selectedUser.firstName} {selectedUser.lastName}
                        </strong>
                        .
                      </p>
                    </div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Key className='w-4 h-4 text-slate-400' />
                    Nouveau mot de passe *
                  </label>
                  <div className='relative'>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={e =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      placeholder='Minimum 8 caractères'
                      className='w-full px-3 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                    />
                    <button
                      type='button'
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className='absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    >
                      {showNewPassword ? (
                        <EyeOff className='w-4 h-4' />
                      ) : (
                        <Eye className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                  <p className='text-xs text-slate-500'>
                    Doit contenir au moins 8 caractères
                  </p>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium text-slate-700 flex items-center gap-2'>
                    <Key className='w-4 h-4 text-slate-400' />
                    Confirmer le mot de passe *
                  </label>
                  <div className='relative'>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmNewPassword}
                      onChange={e =>
                        setPasswordData({
                          ...passwordData,
                          confirmNewPassword: e.target.value,
                        })
                      }
                      placeholder='Confirmer le mot de passe'
                      className='w-full px-3 py-2.5 pr-10 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-all duration-200'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className='absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    >
                      {showConfirmPassword ? (
                        <EyeOff className='w-4 h-4' />
                      ) : (
                        <Eye className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className='flex gap-3 p-4 border-t border-slate-200'>
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className='flex-1 px-4 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200'
                >
                  Annuler
                </button>
                <button
                  onClick={handleAdminResetPassword}
                  disabled={
                    !passwordData.newPassword ||
                    !passwordData.confirmNewPassword ||
                    passwordData.newPassword !== passwordData.confirmNewPassword
                  }
                  className={`flex-1 px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center gap-2 ${
                    !passwordData.newPassword ||
                    !passwordData.confirmNewPassword ||
                    passwordData.newPassword !== passwordData.confirmNewPassword
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  <Key className='w-4 h-4' />
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteModalOpen && selectedUser && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
            <div className='bg-white rounded-xl border border-slate-200/60 max-w-md w-full'>
              <div className='flex items-center justify-between p-4 border-b border-slate-200'>
                <div className='flex items-center gap-2'>
                  <AlertTriangle className='w-5 h-5 text-rose-500' />
                  <h2 className='text-lg font-bold text-slate-800'>
                    Confirmation
                  </h2>
                </div>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className='p-1.5 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200'
                >
                  <X className='w-5 h-5 text-slate-500' />
                </button>
              </div>

              <div className='p-4'>
                <p className='text-sm text-slate-600 text-center'>
                  Supprimer{' '}
                  <span className='font-semibold text-slate-800'>
                    {selectedUser.firstName} {selectedUser.lastName}
                  </span>{' '}
                  ?
                </p>
                <p className='text-xs text-slate-500 text-center mt-1'>
                  Cette action est irréversible.
                </p>
                {selectedUser.id === currentUser?.id && (
                  <p className='text-rose-600 text-xs text-center mt-2 bg-rose-50 p-2 rounded border border-rose-200'>
                    Vous ne pouvez pas supprimer votre compte
                  </p>
                )}
              </div>

              <div className='flex gap-3 p-4 border-t border-slate-200'>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className='flex-1 px-4 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-all duration-200'
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={selectedUser.id === currentUser?.id}
                  className={`flex-1 px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center gap-2 ${
                    selectedUser.id === currentUser?.id
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-500 text-white hover:bg-rose-600'
                  }`}
                >
                  <Trash2 className='w-4 h-4' />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UsersManagement;