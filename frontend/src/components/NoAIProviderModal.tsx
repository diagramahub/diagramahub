import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface NoAIProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NoAIProviderModal({ isOpen, onClose }: NoAIProviderModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mx-auto mb-4">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
            {t('ai.validation.tokenRequiredTitle')}
          </h3>
          <p className="text-sm text-center text-gray-500 mb-6">
            {t('ai.validation.tokenRequiredMessage')}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                onClose();
                navigate('/profile?tab=settings');
              }}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 btn-glass rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t('ai.validation.goToSettings')}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
