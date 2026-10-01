import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorToastProps {
  /** Message to show; nothing renders while it is null/empty. */
  message: string | null;
  onClose: () => void;
  /** Auto-dismiss delay in ms; 0 keeps it until closed. */
  autoHideMs?: number;
}

/**
 * Bottom-right error notification (DESIGN.md "Notifications") used instead of
 * the browser's blocking `alert()`: dismissible, dark-mode aware, auto-hides.
 */
export function ErrorToast({ message, onClose, autoHideMs = 6000 }: ErrorToastProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!message || !autoHideMs) return;
    const timeout = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(timeout);
  }, [message, autoHideMs, onClose]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 flex items-start gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md shadow-lg max-w-md z-[60]"
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={onClose}
        className="p-0.5 text-red-500 hover:text-red-700 dark:hover:text-red-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label={t('common.close')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
