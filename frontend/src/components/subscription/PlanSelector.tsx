import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { Plan, Subscription } from '../../types/subscription';
import { apiErrorMessage } from '../../utils/apiError';
import { diagramLimitLines, isUnlimited } from '../../utils/plans';
import { dateLocale } from '../../utils/locale';

interface PlanSelectorProps {
  currentSubscription: Subscription | null;
  onPlanSelected?: () => void;
}

export default function PlanSelector({ currentSubscription, onPlanSelected }: PlanSelectorProps) {
  const { t, i18n } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingToPlan, setChangingToPlan] = useState<string | null>(null);

  useEffect(() => {
    apiService
      .getPlans()
      .then((data) => {
        setPlans(data);
        setError('');
      })
      .catch((err: unknown) => setError(apiErrorMessage(err) || t('subscription.planSelector.errorLoading')))
      .finally(() => setLoading(false));
  }, [t]);

  const handleSelectPlan = async (planId: string) => {
    try {
      setChangingToPlan(planId);
      const response = await apiService.initiateCheckout(planId);
      
      if (response.session_url) {
        // Redirect to Stripe checkout
        window.location.href = response.session_url;
      } else {
        // Free plan - reload to show updated subscription
        if (onPlanSelected) {
          onPlanSelected();
        }
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('subscription.planSelector.errorChanging'));
      setChangingToPlan(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(dateLocale(i18n.language), {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.plan.id === planId;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('subscription.planSelector.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('subscription.planSelector.subtitle')}</p>
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <ul className="space-y-4">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.id);
            const isChanging = changingToPlan === plan.id;
            const lines = [
              isUnlimited(plan.max_projects)
                ? t('subscription.features.unlimitedProjects')
                : t('subscription.features.upToProjects', { count: plan.max_projects }),
              ...diagramLimitLines(plan, t),
            ];

            return (
              <li
                key={plan.id}
                className={`rounded-lg border-2 p-4 sm:p-6 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-600'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                    {isCurrent && <span className="badge">{t('subscription.planSelector.current')}</span>}
                    {plan.is_free && !isCurrent && (
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {t('subscription.planSelector.free')}
                      </span>
                    )}
                  </div>
                  {plan.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{plan.description}</p>}
                  <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                    {lines.map((line) => (
                      <li key={line} className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 dark:text-green-400 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 sm:ml-6">
                  <div className="sm:text-right">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatPrice(plan.price_usd)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('subscription.planSelector.perMonth')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent || isChanging}
                    className={isCurrent ? 'btn btn-secondary' : 'btn btn-primary'}
                  >
                    {isCurrent
                      ? t('subscription.planSelector.current')
                      : isChanging
                        ? t('subscription.planSelector.processing')
                        : plan.is_free
                          ? t('subscription.planSelector.switchToFree')
                          : t('subscription.planSelector.select')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
