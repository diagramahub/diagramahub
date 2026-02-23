import { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { Subscription } from '../../types/subscription';
import ConfirmModal from '../ConfirmModal';

export default function SubscriptionCard() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
      setError(err.response?.data?.detail || 'Error loading subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      await apiService.cancelSubscription();
      setShowCancelModal(false);
      loadSubscription();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error cancelling subscription');
    } finally {
      setCancelling(false);
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
      active: { color: 'bg-green-100 text-green-800', text: 'Active' },
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      payment_failed: { color: 'bg-red-100 text-red-800', text: 'Payment Failed' },
      cancelled: { color: 'bg-gray-100 text-gray-800', text: 'Cancelled' },
      expired: { color: 'bg-gray-100 text-gray-800', text: 'Expired' },
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
        <p className="text-gray-600">No subscription found</p>
      </div>
    );
  }

  const isPaidPlan = subscription.plan.price_usd > 0;
  const canCancel = isPaidPlan && subscription.status === 'active';

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
              <p className="mt-1 text-sm text-gray-600">Your subscription details and status</p>
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
                  FREE
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
              <span className="text-gray-600">/month</span>
            </div>
          </div>

          {/* Plan Features */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Plan Features</h4>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">
                  {subscription.plan.max_projects === null || subscription.plan.max_projects === -1
                    ? 'Unlimited projects'
                    : `Up to ${subscription.plan.max_projects} project${subscription.plan.max_projects !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">
                  {subscription.plan.max_diagrams === null || subscription.plan.max_diagrams === -1
                    ? 'Unlimited diagrams'
                    : `Up to ${subscription.plan.max_diagrams} diagram${subscription.plan.max_diagrams !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Dates */}
          {isPaidPlan && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Billing Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span className="text-gray-900 font-medium">{formatDate(subscription.started_at)}</span>
                </div>
                {subscription.current_period_end && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Next billing date:</span>
                    <span className="text-gray-900 font-medium">{formatDate(subscription.current_period_end)}</span>
                  </div>
                )}
                {subscription.cancelled_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cancelled on:</span>
                    <span className="text-gray-900 font-medium">{formatDate(subscription.cancelled_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {canCancel && (
            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                Cancel Subscription
              </button>
              <p className="mt-2 text-xs text-gray-500 text-center">
                You'll keep access until {formatDate(subscription.current_period_end)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSubscription}
        title="Cancel Subscription"
        message={`Are you sure you want to cancel your ${subscription.plan.name} subscription? You'll keep access until ${formatDate(subscription.current_period_end)}, then you'll be moved to the FREE plan.`}
        confirmText={cancelling ? 'Cancelling...' : 'Cancel Subscription'}
        cancelText="Keep Subscription"
        isDangerous={true}
      />
    </>
  );
}
