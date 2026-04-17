import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import RecoveryCodesModal from './RecoveryCodesModal';

interface MfaEnableEmailFlowProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function MfaEnableEmailFlow({ onComplete, onCancel }: MfaEnableEmailFlowProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  const handleSendCode = async () => {
    setLoading(true);
    setError('');
    try {
      await apiService.enableEmailMfa();
      setStep('verify');
    } catch (err: any) {
      if (err.response?.status === 503) {
        setError(t('mfa.email.emailUnavailable'));
      } else {
        setError(err.response?.data?.detail || t('mfa.email.errorSending'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiService.verifyEmailActivation(code);
      if (response.codes && response.codes.length > 0) {
        setRecoveryCodes(response.codes);
        setShowRecoveryCodes(true);
      } else {
        // Already had recovery codes — just complete
        onComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mfa.email.errorVerifying'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCodesClose = () => {
    setShowRecoveryCodes(false);
    onComplete();
  };

  return (
    <>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          {t('mfa.email.title')}
        </h4>
        <p className="text-xs text-gray-600 mb-4">
          {t('mfa.email.description')}
        </p>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {step === 'request' && (
          <div className="flex gap-2">
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('mfa.email.sendingCode') : t('mfa.email.sendCode')}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {t('mfa.email.cancel')}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyCode}>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {t('mfa.email.codeSent')}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mfa.email.enterCode')}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('mfa.email.codePlaceholder')}
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
                {loading ? t('mfa.email.verifying') : t('mfa.email.verifyCode')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('mfa.email.cancel')}
              </button>
            </div>
          </form>
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
