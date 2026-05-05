import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { MfaStatusResponse } from '../../types/auth';
import MfaEnableEmailFlow from './MfaEnableEmailFlow';
import MfaEnableTotpFlow from './MfaEnableTotpFlow';
import RecoveryCodesModal from './RecoveryCodesModal';

/* ------------------------------------------------------------------ */
/* SVG Icon components                                                 */
/* ------------------------------------------------------------------ */

const EmailIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

const ShieldIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const KeyIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const StarIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
  </svg>
);

export default function MfaSetupSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Flow states
  const [showEnableEmail, setShowEnableEmail] = useState(false);
  const [showEnableTotp, setShowEnableTotp] = useState(false);

  // Disable flow
  const [disableMethod, setDisableMethod] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Recovery codes
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await apiService.getMfaStatus();
      setStatus(data);
    } catch {
      setError(t('mfa.setup.errorLoadingStatus'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleEnableComplete = () => {
    setShowEnableEmail(false);
    setShowEnableTotp(false);
    clearMessages();
    setLoading(true);
    loadStatus();
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableMethod) return;
    setDisableLoading(true);
    clearMessages();
    try {
      await apiService.disableMfa(disablePassword, disableMethod);
      setSuccess(t('mfa.setup.methodDisabled'));
      setDisableMethod(null);
      setDisablePassword('');
      setLoading(true);
      loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mfa.setup.errorDisabling'));
    } finally {
      setDisableLoading(false);
    }
  };

  const handleSetDefault = async (method: string) => {
    clearMessages();
    try {
      await apiService.setDefaultMfaMethod(method);
      setSuccess(t('mfa.setup.defaultMethodUpdated'));
      setLoading(true);
      loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mfa.setup.errorSettingDefault'));
    }
  };

  const handleRegenerateCodes = async () => {
    clearMessages();
    try {
      const response = await apiService.regenerateRecoveryCodes();
      setRecoveryCodes(response.codes);
      setShowRecoveryCodes(true);
      setSuccess(t('mfa.setup.codesRegenerated'));
      loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('mfa.setup.errorRegenerating'));
    }
  };

  const hasEmail = status?.methods.includes('email') ?? false;
  const hasTotp = status?.methods.includes('totp') ?? false;
  const hasBoth = hasEmail && hasTotp;

  const getMethodLabel = (method: string) => {
    return method === 'email' ? t('mfa.setup.statusEmail') : t('mfa.setup.statusTotp');
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('mfa.setup.title')}</h2>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('mfa.setup.title')}</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('mfa.setup.description')}</p>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {/* Current Status */}
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status?.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {status?.enabled ? t('mfa.setup.statusEnabled') : t('mfa.setup.statusDisabled')}
            </span>
          </div>

          {/* Method cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Email MFA card */}
            <div className={`relative rounded-lg border p-4 ${hasEmail ? 'border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30'}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 p-2 rounded-lg ${hasEmail ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                  <EmailIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('mfa.setup.statusEmail')}</h4>
                    {hasEmail && <CheckCircleIcon className="w-4 h-4 text-green-500 dark:text-green-400" />}
                    {status?.default_method === 'email' && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                        <StarIcon className="w-3 h-3" />
                        {t('mfa.setup.defaultMethod')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('mfa.setup.emailDescription')}</p>

                  {hasEmail ? (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {hasBoth && status?.default_method !== 'email' && (
                        <button
                          onClick={() => handleSetDefault('email')}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                        >
                          {t('mfa.setup.setDefaultEmail')}
                        </button>
                      )}
                      <button
                        onClick={() => { clearMessages(); setDisableMethod('email'); }}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium"
                      >
                        {t('mfa.setup.disableEmail')}
                      </button>
                    </div>
                  ) : (
                    !showEnableEmail && !showEnableTotp && !disableMethod && (
                      <button
                        onClick={() => { clearMessages(); setShowEnableEmail(true); }}
                        className="mt-3 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        {t('mfa.setup.enableEmail')}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* TOTP MFA card */}
            <div className={`relative rounded-lg border p-4 ${hasTotp ? 'border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30'}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 p-2 rounded-lg ${hasTotp ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                  <ShieldIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('mfa.setup.statusTotp')}</h4>
                    {hasTotp && <CheckCircleIcon className="w-4 h-4 text-green-500 dark:text-green-400" />}
                    {status?.default_method === 'totp' && (
                      <span className="inline-flex items-center gap-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                        <StarIcon className="w-3 h-3" />
                        {t('mfa.setup.defaultMethod')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('mfa.setup.totpDescription')}</p>

                  {hasTotp ? (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {hasBoth && status?.default_method !== 'totp' && (
                        <button
                          onClick={() => handleSetDefault('totp')}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                        >
                          {t('mfa.setup.setDefaultTotp')}
                        </button>
                      )}
                      <button
                        onClick={() => { clearMessages(); setDisableMethod('totp'); }}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium"
                      >
                        {t('mfa.setup.disableTotp')}
                      </button>
                    </div>
                  ) : (
                    !showEnableEmail && !showEnableTotp && !disableMethod && (
                      <button
                        onClick={() => { clearMessages(); setShowEnableTotp(true); }}
                        className="mt-3 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        {t('mfa.setup.enableTotp')}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recovery codes section */}
          {status?.enabled && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <KeyIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('mfa.setup.recoveryCodesRemaining', { count: status.recovery_codes_remaining })}
                </span>
              </div>
              <button
                onClick={handleRegenerateCodes}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
              >
                {t('mfa.setup.regenerateCodes')}
              </button>
            </div>
          )}

          {/* Disable confirmation */}
          {disableMethod && (
            <form onSubmit={handleDisableMfa} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                {t('mfa.setup.confirmDisableTitle')}
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                {t('mfa.setup.confirmDisableMessage', { method: getMethodLabel(disableMethod) })}
              </p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={t('mfa.setup.passwordPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={disableLoading || !disablePassword}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {disableLoading ? t('mfa.setup.disabling') : t('mfa.setup.confirmDisableTitle')}
                </button>
                <button
                  type="button"
                  onClick={() => { setDisableMethod(null); setDisablePassword(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Enable flows */}
          {showEnableEmail && (
            <MfaEnableEmailFlow
              onComplete={handleEnableComplete}
              onCancel={() => setShowEnableEmail(false)}
            />
          )}
          {showEnableTotp && (
            <MfaEnableTotpFlow
              onComplete={handleEnableComplete}
              onCancel={() => setShowEnableTotp(false)}
            />
          )}
        </div>
      </div>

      <RecoveryCodesModal
        codes={recoveryCodes}
        isOpen={showRecoveryCodes}
        onClose={() => setShowRecoveryCodes(false)}
      />
    </>
  );
}
