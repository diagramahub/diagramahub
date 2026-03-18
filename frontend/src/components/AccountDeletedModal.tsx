import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface AccountDeletedModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export default function AccountDeletedModal({ isOpen, onConfirm }: AccountDeletedModalProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(15);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(15);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, handleConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M8 9v1M16 9v1M9 16c.5-.5 1.5-1 3-1s2.5.5 3 1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 flex-1">
                {t('dangerZone.deletedModalTitle')}
              </h3>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            <p className="text-sm text-gray-500 italic">
              {t('dangerZone.deletedModalFarewell')}
            </p>
            <p className="text-gray-600 text-sm">
              {t('dangerZone.deletedModalDescription')}
            </p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>{t('dangerZone.deletedItemProjects')}</li>
              <li>{t('dangerZone.deletedItemDiagrams')}</li>
              <li>{t('dangerZone.deletedItemFolders')}</li>
              <li>{t('dangerZone.deletedItemSettings')}</li>
              <li>{t('dangerZone.deletedItemHistory')}</li>
            </ul>
            <p className="text-xs text-gray-400">
              {t('dangerZone.redirectCountdown', { seconds: countdown })}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 btn-glass rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t('dangerZone.understoodButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
