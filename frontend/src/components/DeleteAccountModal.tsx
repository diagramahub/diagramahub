import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmationPhrase: string) => Promise<void>;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedPhrase = t('dangerZone.confirmationPhrase');
  const isConfirmEnabled = inputValue === expectedPhrase;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setIsDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!isConfirmEnabled) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(inputValue);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        t('dangerZone.errorMessage');
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (isDeleting) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleCancel}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 flex-1">
                {t('dangerZone.modalTitle')}
              </h3>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            <p className="text-gray-600 text-sm">
              {t('dangerZone.modalDescription')}
            </p>

            <div>
              <label htmlFor="confirmation-phrase" className="block text-sm font-medium text-gray-700 mb-1">
                {t('dangerZone.modalInputLabel')}
              </label>
              <input
                id="confirmation-phrase"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('dangerZone.modalInputPlaceholder')}
                disabled={isDeleting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="off"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('dangerZone.modalCancelButton')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled || isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isDeleting ? t('dangerZone.modalDeleting') : t('dangerZone.modalConfirmButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
