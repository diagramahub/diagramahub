import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import PremiumAvatar from '../components/PremiumAvatar';
import MfaSetupSection from '../components/mfa/MfaSetupSection';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';

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
  const { user } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile editing state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email] = useState(user?.email || '');
  const [profilePicture, setProfilePicture] = useState<string | undefined>(user?.profile_picture);
  const [imagePreview, setImagePreview] = useState<string | undefined>(user?.profile_picture);
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('profile.invalidImageType'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('profile.imageTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);
      setImagePreview(base64String);
      setError('');
    };
    reader.readAsDataURL(file);
  };

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
        timezone: timezone,
      });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess(t('profile.profileUpdated'));
      setIsEditingProfile(false);
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
    if (!newPassword || !confirmPassword) {
      setError(t('profile.allFieldsRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 12) {
      setError(t('profile.passwordTooShort'));
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/~`]/.test(newPassword)) {
      setError(t('validation.passwordSpecial'));
      return;
    }
    setLoading(true);
    try {
      await apiService.changePassword({ new_password: newPassword });
      setSuccess(t('profile.passwordUpdated'));
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('profile.passwordChangeError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('profile.title')}</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('profile.subtitle')}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          </div>
        )}

        {/* Profile Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('profile.profileInformation')}</h2>
            {!isEditingProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
              >
                {t('profile.edit')}
              </button>
            )}
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-6">
            {!isEditingProfile ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <PremiumAvatar size="xl" showPremiumBadge={true} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('profile.profilePicture')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.photoLimitInfo')}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.fullName')}</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{user?.full_name || t('profile.notSpecified')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.emailAddress')}</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.timezone')}</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">
                    {TIMEZONES.find(tz => tz.value === user?.timezone)?.label || 'UTC (Hora Universal)'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.memberSince')}</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('profile.profilePicture')}</label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                    {imagePreview ? (
                      <img src={imagePreview} alt={t('profile.profilePicture')} className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                        {getUserInitials()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex gap-3">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                          <span className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                            {t('profile.uploadPhoto')}
                          </span>
                        </label>
                        {imagePreview && (
                          <button type="button" onClick={handleRemoveImage} className="px-4 py-2 border border-red-300 dark:border-red-600 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            {t('profile.removePhoto')}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('profile.photoLimitInfo')}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('profile.fullName')}</label>
                  <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder={t('installation.fullNamePlaceholder')} />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('profile.emailAddress')}</label>
                  <input id="email" type="email" value={email} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400" disabled />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('profile.emailCannotChange')}</p>
                </div>
                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('profile.timezone')}</label>
                  <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    {TIMEZONES.map((tz) => (<option key={tz.value} value={tz.value}>{tz.label}</option>))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('profile.timezoneHint')}</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {loading ? t('profile.saving') : t('profile.saveChanges')}
                  </button>
                  <button type="button" onClick={() => { setIsEditingProfile(false); setFullName(user?.full_name || ''); setProfilePicture(user?.profile_picture); setImagePreview(user?.profile_picture); setTimezone(user?.timezone || 'UTC'); setError(''); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {t('profile.cancelEdit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security — Change Password */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('profile.accountSecurity')}</h2>
            {!isChangingPassword && (
              <button onClick={() => setIsChangingPassword(true)} className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium">
                {t('profile.changePassword')}
              </button>
            )}
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            {!isChangingPassword ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('profile.securityMessage')}</p>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('profile.newPassword')}</label>
                  <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="••••••••" />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('profile.passwordMinLength')}</p>
                  <PasswordStrengthIndicator password={newPassword} email={user?.email} />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('profile.confirmNewPassword')}</label>
                  <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="••••••••" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {loading ? t('profile.updating') : t('profile.updatePassword')}
                  </button>
                  <button type="button" onClick={() => { setIsChangingPassword(false); setNewPassword(''); setConfirmPassword(''); setError(''); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {t('profile.cancelEdit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* MFA Setup Section */}
        <MfaSetupSection />

        {/* Linked Accounts Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('profile.linkedAccounts')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('profile.linkedAccountsDescription')}</p>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            {user?.oauth_providers && user.oauth_providers.length > 0 ? (
              <div className="space-y-4">
                {user.oauth_providers.map((entry, index) => (
                  <div key={`${entry.provider}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                      {entry.provider === 'google' ? (
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{entry.provider.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.provider.charAt(0).toUpperCase() + entry.provider.slice(1)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('profile.linkedOn')} {new Date(entry.linked_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.noLinkedAccounts')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
