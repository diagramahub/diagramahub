import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import AIIntegrationsSection from '../components/AIIntegrationsSection';
import DeleteAccountModal from '../components/DeleteAccountModal';
import AccountDeletedModal from '../components/AccountDeletedModal';
import { Subscription } from '../types/subscription';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isSoleAdmin, setIsSoleAdmin] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);

  useEffect(() => {
    apiService.getMySubscription()
      .then(setSubscription)
      .catch((err) => console.error('Error loading subscription:', err));
  }, []);

  // Follows the role: the user can be refreshed after the first render.
  const isAdmin = user?.role === 'admin';
  useEffect(() => {
    if (!isAdmin) {
      setIsSoleAdmin(false);
      return;
    }
    apiService.getAdminCount().then(data => {
      setIsSoleAdmin(data.count <= 1);
    }).catch(() => {});
  }, [isAdmin]);

  const hasActivePaidPlan = subscription?.status === 'active' && subscription.plan.price_usd > 0;
  const cannotDelete = hasActivePaidPlan || isSoleAdmin;

  const handleDeleteAccount = async (confirmationPhrase: string) => {
    await apiService.deleteAccount(confirmationPhrase);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setShowDeleteModal(false);
    setShowDeletedModal(true);
  };

  const handleDeletedAcknowledged = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-6 sm:py-12">
          <div className="mb-6 sm:mb-8">
            <h1 className="page-title">
              {t('common.settings')}
            </h1>
            <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('settings.pageDescription')}
            </p>
          </div>

          {/* AI Integrations Section */}
          <div className="mb-6">
            <AIIntegrationsSection />
          </div>

          {/* API keys live in their own section */}
          <Link
            to="/api-keys"
            className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 sm:px-6 py-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-gray-900 dark:text-gray-100">{t('apiKeys.title')}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-400">{t('apiKeys.settingsLink')}</span>
            </span>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Danger Zone */}
          <div className="mt-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 sm:p-6">
            <h2 className="text-[15px] font-semibold text-red-800 dark:text-red-400">{t('dangerZone.title')}</h2>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{t('dangerZone.description')}</p>
            {hasActivePaidPlan && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-medium">
                {t('dangerZone.disabledMessage')}
              </p>
            )}
            {isSoleAdmin && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-medium">
                {t('dangerZone.soleAdminMessage')}
              </p>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={cannotDelete}
              className="btn btn-destructive mt-4"
            >
              {t('dangerZone.deleteButton')}
            </button>
          </div>
        </main>
      </div>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
      <AccountDeletedModal
        isOpen={showDeletedModal}
        onConfirm={handleDeletedAcknowledged}
      />
    </>
  );
}
