import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (immediate: boolean) => Promise<void>;
  periodEndDate: string | null;
}

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  periodEndDate
}: CancelSubscriptionModalProps) {
  const { t } = useTranslation();
  const [cancellationType, setCancellationType] = useState<'end_of_period' | 'immediate'>('end_of_period');
  const [cancelling, setCancelling] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleConfirm = async () => {
    setCancelling(true);
    try {
      await onConfirm(cancellationType === 'immediate');
      onClose();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
    } finally {
      setCancelling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('subscription.cancellation.confirmTitle')}
            </h3>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Question */}
            <div>
              <p className="text-sm font-medium text-gray-900 mb-4">
                {t('subscription.cancellation.whenToCancel')}
              </p>

              {/* Option 1: End of Period (Recommended) */}
              <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer mb-3 hover:bg-gray-50 transition-colors"
                style={{ borderColor: cancellationType === 'end_of_period' ? '#3B82F6' : '#E5E7EB' }}>
                <input
                  type="radio"
                  name="cancellation_type"
                  value="end_of_period"
                  checked={cancellationType === 'end_of_period'}
                  onChange={() => setCancellationType('end_of_period')}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {t('subscription.cancellation.endOfPeriod', { date: formatDate(periodEndDate) })}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {t('subscription.plans.recommended')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {t('subscription.cancellation.endOfPeriodDescription')}
                  </p>
                </div>
              </label>

              {/* Option 2: Immediate */}
              <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderColor: cancellationType === 'immediate' ? '#3B82F6' : '#E5E7EB' }}>
                <input
                  type="radio"
                  name="cancellation_type"
                  value="immediate"
                  checked={cancellationType === 'immediate'}
                  onChange={() => setCancellationType('immediate')}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    {t('subscription.cancellation.immediately')}
                  </span>
                  <p className="mt-1 text-xs text-gray-600">
                    {t('subscription.cancellation.immediatelyDescription')}
                  </p>
                </div>
              </label>
            </div>

            {/* Warning for immediate cancellation */}
            {cancellationType === 'immediate' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-yellow-700">
                    {t('subscription.cancellation.immediateWarning')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              disabled={cancelling}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('subscription.cancellation.cancelButton')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={cancelling}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? t('subscription.cancellation.cancelling') : t('subscription.cancellation.confirmButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
