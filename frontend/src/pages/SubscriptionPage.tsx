import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import SubscriptionCard from '../components/subscription/SubscriptionCard';
import UsageIndicator from '../components/subscription/UsageIndicator';
import PlanSelector from '../components/subscription/PlanSelector';
import BillingHistory from '../components/subscription/BillingHistory';
import SuccessCelebrationModal from '../components/subscription/SuccessCelebrationModal';
import { Subscription } from '../types/subscription';

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPlan, setCelebrationPlan] = useState<any>(null);

  const loadSubscription = async () => {
    try {
      const data = await apiService.getMySubscription();
      setSubscription(data);

      // Check if we should show celebration modal (returning from successful payment)
      const urlParams = new URLSearchParams(window.location.search);
      const showSuccess = urlParams.get('success');
      const sessionId = urlParams.get('session_id');

      if (showSuccess === 'true' && sessionId && data.plan.price_usd > 0) {
        setCelebrationPlan(data.plan);
        setShowCelebration(true);
        window.history.replaceState({}, '', '/subscription');
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const handlePlanSelected = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('subscription.title')}
            </h1>
            <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('subscription.planDetails')}
            </p>
          </div>

          <div className="space-y-6">
            {/* Current Subscription */}
            <div key={`subscription-${refreshKey}`}>
              <SubscriptionCard />
            </div>

            {/* Usage Indicator */}
            <div key={`usage-${refreshKey}`}>
              <UsageIndicator />
            </div>

            {/* Change Plan Button - hide for admin */}
            {user?.role !== 'admin' && !showPlanSelector && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() => setShowPlanSelector(true)}
                  className="w-full px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  {t('subscription.changePlan')}
                </button>
              </div>
            )}

            {/* Plan Selector */}
            {showPlanSelector && (
              <div key={`plans-${refreshKey}`}>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('subscription.selectNewPlan')}</h3>
                  <button
                    onClick={() => setShowPlanSelector(false)}
                    className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {t('subscription.cancelSelection')}
                  </button>
                </div>
                <PlanSelector
                  currentSubscription={subscription}
                  onPlanSelected={() => {
                    handlePlanSelected();
                    setShowPlanSelector(false);
                  }}
                />
              </div>
            )}

            {/* Billing History - hide for admin */}
            {user?.role !== 'admin' && <BillingHistory />}
          </div>
        </main>
      </div>

      {/* Success Celebration Modal */}
      {celebrationPlan && (
        <SuccessCelebrationModal
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          planName={celebrationPlan.name}
          planPrice={celebrationPlan.price_usd}
          maxProjects={celebrationPlan.max_projects}
          maxDiagrams={celebrationPlan.max_diagrams}
        />
      )}
    </>
  );
}
