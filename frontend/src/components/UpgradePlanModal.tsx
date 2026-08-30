import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: string;
  currentUsage: number;
  limit: number;
}

export default function UpgradePlanModal({ isOpen, onClose, resourceType, currentUsage, limit }: UpgradePlanModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const resourceLabel = t(`subscription.usage.${resourceType}`, resourceType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
            {t('subscription.upgradePlan.title')}
          </h3>
          <p className="text-sm text-center text-gray-500 mb-2">
            {t('subscription.upgradePlan.message', { resource: resourceLabel })}
          </p>
          <p className="text-center text-sm font-medium text-amber-700 bg-amber-50 rounded-lg py-2 px-3 mb-6">
            {resourceLabel}: {currentUsage}/{limit}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                onClose();
                navigate('/profile?tab=subscription');
              }}
              className="w-full bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
            >
              {t('subscription.upgradePlan.action')}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
