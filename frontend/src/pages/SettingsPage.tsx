import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const loadData = async () => {
      try {
        const data = await apiService.getMySubscription();
        setSubscription(data);
      } catch (err) {
        console.error('Error loading subscription:', err);
      }
      if (user?.role === 'admin') {
        apiService.getAdminCount().then(data => {
          setIsSoleAdmin(data.count <= 1);
        }).catch(() => {});
      }
    };
    loadData();
  }, []);

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('common.settings')}
            </h1>
            <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('settings.comingSoonDescription')}
            </p>
          </div>

          {/* AI Integrations Section */}
          <div className="mb-6">
            <AIIntegrationsSection />
          </div>

          {/* Danger Zone */}
          <div className="mt-6 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">{t('dangerZone.title')}</h2>
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
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
