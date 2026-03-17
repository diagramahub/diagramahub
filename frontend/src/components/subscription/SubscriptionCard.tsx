import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { Subscription } from '../../types/subscription';
import CancelSubscriptionModal from './CancelSubscriptionModal';

export default function SubscriptionCard() {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const data = await apiService.getMySubscription();
      setSubscription(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || t('subscription.errors.loadingSubscription'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (immediate: boolean) => {
    try {
      await apiService.cancelSubscription(immediate);
      setShowCancelModal(false);
      loadSubscription();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('subscription.errors.cancellingSubscription'));
    }
  };

  const handleUpdatePaymentMethod = async () => {
    try {
      setUpdatingPayment(true);
      const { session_url } = await apiService.updatePaymentMethod();
      if (session_url) {
        window.location.href = session_url;
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || t('subscription.errors.updatePaymentMethod'));
    } finally {
      setUpdatingPayment(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      active: { color: 'bg-green-100 text-green-800', text: t('subscription.status.active') },
      pending: { color: 'bg-yellow-100 text-yellow-800', text: t('subscription.status.pending') },
      payment_failed: { color: 'bg-red-100 text-red-800', text: t('subscription.status.payment_failed') },
      cancelled: { color: 'bg-gray-100 text-gray-800', text: t('subscription.status.cancelled') },
      expired: { color: 'bg-gray-100 text-gray-800', text: t('subscription.status.expired') },
    };

    const badge = badges[status] || badges.active;
    return (
      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">{t('subscription.errors.noSubscription')}</p>
      </div>
    );
  }

  const isAdmin = subscription.plan.name === 'Administrador';
  const isPaidPlan = subscription.plan.price_usd > 0;
  const isCancelled = subscription.cancelled_at !== null;
  const canCancel = isPaidPlan && subscription.status === 'active' && !isCancelled;

  return (
    <>
      {isAdmin ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('subscription.currentPlan')}</h2>
                <p className="mt-1 text-sm text-gray-600">{t('subscription.planDetails')}</p>
              </div>
              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                Administrador
              </span>
            </div>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Administrador</h3>
                <p className="text-sm text-gray-600">Acceso completo sin límites</p>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{t('subscription.features.unlimitedProjects')}</span>
                </div>
                <div className="flex items-center text-sm">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{t('subscription.features.unlimitedDiagrams')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('subscription.currentPlan')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('subscription.planDetails')}</p>
            </div>
            {getStatusBadge(subscription.status)}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Plan Info */}
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <h3 className="text-2xl font-bold text-gray-900">{subscription.plan.name}</h3>
              {subscription.plan.is_free && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                  {t('subscription.plans.free')}
                </span>
              )}
            </div>
            {subscription.plan.description && (
              <p className="text-sm text-gray-600">{subscription.plan.description}</p>
            )}
            <div className="mt-3">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(subscription.plan.price_usd)}
              </span>
              <span className="text-gray-600">{t('subscription.plans.perMonth')}</span>
            </div>
          </div>

          {/* Plan Features */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">{t('subscription.planFeatures')}</h4>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">
                  {subscription.plan.max_projects === null || subscription.plan.max_projects === -1
                    ? t('subscription.features.unlimitedProjects')
                    : t('subscription.features.upToProjects', { count: subscription.plan.max_projects })}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">
                  {subscription.plan.max_diagrams === null || subscription.plan.max_diagrams === -1
                    ? t('subscription.features.unlimitedDiagrams')
                    : t('subscription.features.upToDiagrams', { count: subscription.plan.max_diagrams })}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Dates */}
          {isPaidPlan && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">{t('subscription.billingInformation')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('subscription.started')}:</span>
                  <span className="text-gray-900 font-medium">{formatDate(subscription.started_at)}</span>
                </div>
                {subscription.current_period_end && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('subscription.nextBillingDate')}:</span>
                    <span className="text-gray-900 font-medium">{formatDate(subscription.current_period_end)}</span>
                  </div>
                )}
                {subscription.cancelled_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('subscription.cancelledOn')}:</span>
                    <span className="text-gray-900 font-medium">{formatDate(subscription.cancelled_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancellation Notice */}
          {isCancelled && subscription.current_period_end && (
            <div className="border-t border-gray-200 pt-6">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h5 className="text-sm font-medium text-yellow-800 mb-1">{t('subscription.cancellation.title')}</h5>
                    <p className="text-sm text-yellow-700">
                      {t('subscription.cancellation.message', { date: formatDate(subscription.current_period_end) })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {isPaidPlan && subscription.status === 'active' && (
            <div className="border-t border-gray-200 pt-6 space-y-3">
              <button
                onClick={handleUpdatePaymentMethod}
                disabled={updatingPayment}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingPayment ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                )}
                {t('subscription.updatePaymentMethod')}
              </button>
              {canCancel && (
                <>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    {t('subscription.cancelSubscription')}
                  </button>
                  {subscription.current_period_end && (
                    <p className="text-xs text-gray-500 text-center">
                      {t('subscription.cancellation.keepAccessUntil', { date: formatDate(subscription.current_period_end) })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Cancel Confirmation Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSubscription}

        periodEndDate={subscription.current_period_end}
      />
    </>
  );
}
