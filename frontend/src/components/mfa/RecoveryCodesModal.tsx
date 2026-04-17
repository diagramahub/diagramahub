import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RecoveryCodesModalProps {
  codes: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function RecoveryCodesModal({ codes, isOpen, onClose }: RecoveryCodesModalProps) {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = codes.join('\n');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('mfa.recoveryCodes.title')}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('mfa.recoveryCodes.description')}
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800">
            <svg className="w-4 h-4 inline-block mr-1 -mt-0.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {t('mfa.recoveryCodes.warning')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {codes.map((code, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-center font-mono text-sm text-gray-800"
            >
              {code}
            </div>
          ))}
        </div>

        <button
          onClick={handleCopyAll}
          className="w-full mb-4 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
        >
          {copied ? `✓ ${t('mfa.recoveryCodes.copied')}` : t('mfa.recoveryCodes.copyAll')}
        </button>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">
            {t('mfa.recoveryCodes.confirmSaved')}
          </span>
        </label>

        <button
          onClick={handleClose}
          disabled={!confirmed}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t('mfa.recoveryCodes.close')}
        </button>
      </div>
    </div>
  );
}
