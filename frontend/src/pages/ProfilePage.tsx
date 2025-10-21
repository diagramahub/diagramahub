import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import AIIntegrationsSection from '../components/AIIntegrationsSection';

// Lista de zonas horarias comunes
const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'Europe/London', label: 'Londres (GMT+0)' },
  { value: 'Europe/Paris', label: 'París (GMT+1)' },
  { value: 'Europe/Berlin', label: 'Berlín (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Tokio (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghái (GMT+8)' },
  { value: 'Asia/Dubai', label: 'Dubái (GMT+4)' },
  { value: 'Australia/Sydney', label: 'Sídney (GMT+11)' },
  { value: 'UTC', label: 'UTC (Hora Universal)' },
];

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Estados para edición de perfil
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState<string | undefined>(user?.profile_picture);
  const [imagePreview, setImagePreview] = useState<string | undefined>(user?.profile_picture);
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');

  // Estados para cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados de UI
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Obtener iniciales para el avatar
  const getUserInitials = () => {
    if (user?.full_name) {
      const names = user.full_name.trim().split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0].substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Manejar selección de imagen
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError(t('profile.invalidImageType'));
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError(t('profile.imageTooLarge'));
      return;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);
      setImagePreview(base64String);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  // Eliminar foto de perfil
  const handleRemoveImage = () => {
    setProfilePicture(undefined);
    setImagePreview(undefined);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updatedUser = await apiService.updateProfile({
        full_name: fullName,
        profile_picture: profilePicture,
        timezone: timezone
      });

      // Actualizar usuario en localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setSuccess(t('profile.profileUpdated'));
      setIsEditingProfile(false);

      // Recargar página para reflejar cambios en toda la aplicación
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('profile.profileUpdateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('profile.allFieldsRequired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('profile.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await apiService.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess(t('profile.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('profile.passwordChangeError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('profile.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('profile.subtitle')}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              {t('common.profile')}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              {t('common.settings')}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="ml-auto whitespace-nowrap py-4 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              {t('common.logout')}
            </button>
          </nav>
        </div>

        {/* Mensajes de éxito o error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
          <>
        {/* Información del Perfil */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.profileInformation')}</h2>
            {!isEditingProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('profile.edit')}
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {!isEditingProfile ? (
              <div className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt={t('profile.profilePicture')}
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                      {getUserInitials()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t('profile.profilePicture')}</p>
                    <p className="text-xs text-gray-500">{t('profile.photoLimitInfo')}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">{t('profile.fullName')}</label>
                  <p className="mt-1 text-gray-900">{user?.full_name || t('profile.notSpecified')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('profile.emailAddress')}</label>
                  <p className="mt-1 text-gray-900">{user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('profile.timezone')}</label>
                  <p className="mt-1 text-gray-900">
                    {TIMEZONES.find(tz => tz.value === user?.timezone)?.label || 'UTC (Hora Universal)'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('profile.memberSince')}</label>
                  <p className="mt-1 text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Upload de foto de perfil */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('profile.profilePicture')}
                  </label>
                  <div className="flex items-center gap-6">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt={t('profile.profilePicture')}
                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                        {getUserInitials()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex gap-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                          <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                            {t('profile.uploadPhoto')}
                          </span>
                        </label>
                        {imagePreview && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-600 bg-white hover:bg-red-50 transition-colors"
                          >
                            {t('profile.removePhoto')}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {t('profile.photoLimitInfo')}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.fullName')}
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('installation.fullNamePlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.emailAddress')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('profile.emailCannotChange')}</p>
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.timezone')}
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{t('profile.timezoneHint')}</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? t('profile.saving') : t('profile.saveChanges')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setFullName(user?.full_name || '');
                      setEmail(user?.email || '');
                      setProfilePicture(user?.profile_picture);
                      setImagePreview(user?.profile_picture);
                      setTimezone(user?.timezone || 'UTC');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t('profile.cancelEdit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Seguridad - Cambiar Contraseña */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.accountSecurity')}</h2>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('profile.changePassword')}
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {!isChangingPassword ? (
              <div>
                <p className="text-sm text-gray-600">
                  {t('profile.securityMessage')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.currentPassword')}
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.newPassword')}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('profile.passwordMinLength')}</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.confirmNewPassword')}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? t('profile.updating') : t('profile.updatePassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t('profile.cancelEdit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
          </>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <>
            {/* AI Integrations Section */}
            <div className="mb-6">
              <AIIntegrationsSection />
            </div>

            {/* Secciones futuras (preview) */}
            <div className="mt-6 space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-50">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">{t('settings.appearance')}</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-500">{t('settings.appearanceDescription')}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-50">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">{t('settings.notifications')}</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-500">{t('settings.notificationsDescription')}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-50">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">{t('settings.privacy')}</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-500">{t('settings.privacyDescription')}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>

    {/* Logout Confirmation Modal */}
    <ConfirmModal
      isOpen={showLogoutConfirm}
      onClose={() => setShowLogoutConfirm(false)}
      onConfirm={handleLogout}
      title={t('auth.logoutConfirm')}
      message={t('auth.logoutMessage')}
      confirmText={t('common.logout')}
      cancelText={t('common.cancel')}
      isDangerous={true}
    />
    </>
  );
}
