import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { MfaSetupTotpResponse } from '../../types/auth';
import RecoveryCodesModal from './RecoveryCodesModal';

interface MfaEnableTotpFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function MfaEnableTotpFlow({ onComplete, onCancel }: MfaEnableTotpFlowProps) {
  const { t } = useTranslation();
  const [setupData, setSetupData] = useState<MfaSetupTotpResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [error, setError] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  useEffect(() => {
    const fetchSetup = async () => {
      try {
        const data = await apiService.setupTotp();
        setSetupData(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || t('mfa.totp.errorSetup'));
      } finally {
        setSetupLoading(false);
      }
    };
    fetchSetup();
  }, [t]);

  const handleCopySecret = async () => {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret_key);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = setupData.secret_key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiService.enableTotp(code);
      if (response.codes && response.codes.length > 0) {
        setRecoveryCodes(response.codes);
        setShowRecoveryCodes(true);
      } else {
        // Already had recovery codes — just complete
        onComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mfa.totp.errorVerifying'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCodesClose = () => {
    setShowRecoveryCodes(false);
    onComplete();
  };

  if (setupLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">{t('mfa.totp.loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          {t('mfa.totp.title')}
        </h4>
        <p className="text-xs text-gray-600 mb-4">
          {t('mfa.totp.description')}
        </p>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {setupData && (
          <>
            {/* Step 1: QR Code */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-800 mb-1">
                {t('mfa.totp.step1')}
              </h5>
              <p className="text-xs text-gray-600 mb-3">
                {t('mfa.totp.step1Description')}
              </p>
              <div className="flex justify-center mb-3">
                <img
                  src={`data:image/png;base64,${setupData.qr_code_base64}`}
                  alt="TOTP QR Code"
                  className="w-48 h-48 border border-gray-200 rounded-lg"
                />
              </div>
              <p className="text-xs text-gray-500 mb-2">
                {t('mfa.totp.cantScanQr')}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-gray-200 rounded px-3 py-2 font-mono text-xs text-gray-800 break-all select-all">
                  {setupData.secret_key}
                </div>
                <button
                  onClick={handleCopySecret}
                  className="px-3 py-2 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors whitespace-nowrap"
                >
                  {secretCopied ? `✓ ${t('mfa.totp.secretCopied')}` : t('mfa.totp.copySecret')}
                </button>
              </div>
            </div>

            {/* Step 2: Verify Code */}
            <div>
              <h5 className="text-sm font-medium text-gray-800 mb-1">
                {t('mfa.totp.step2')}
              </h5>
              <p className="text-xs text-gray-600 mb-3">
                {t('mfa.totp.step2Description')}
              </p>
              <form onSubmit={handleVerifyCode}>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('mfa.totp.codePlaceholder')}
                  maxLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-center text-lg tracking-widest mb-3"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? t('mfa.totp.verifying') : t('mfa.totp.verifyCode')}
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t('mfa.totp.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      <RecoveryCodesModal
        codes={recoveryCodes}
        isOpen={showRecoveryCodes}
        onClose={handleRecoveryCodesClose}
      />
    </>
  );
}
