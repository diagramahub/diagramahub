import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface MfaVerifyLocationState {
  mfa_token: string;
  mfa_default_method: string;
  available_methods: string[];
}

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

const ArrowLeftIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS = 3;

type ViewMode = 'code' | 'methodSelection' | 'recovery';

const MfaVerifyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { completeMfaLogin } = useAuth();

  const state = location.state as MfaVerifyLocationState | null;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<string>(
    state?.mfa_default_method || 'email'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendsRemaining, setResendsRemaining] = useState(MAX_RESENDS);
  const [sendingEmail, setSendingEmail] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect to login if no MFA state
  useEffect(() => {
    if (!state?.mfa_token) {
      navigate('/login', { replace: true });
    }
  }, [state, navigate]);

  // Auto-focus code input
  useEffect(() => {
    if (viewMode === 'code' || viewMode === 'recovery') {
      codeInputRef.current?.focus();
    }
  }, [viewMode, currentMethod]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownIntervalRef.current) {
              clearInterval(cooldownIntervalRef.current);
              cooldownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    };
  }, [resendCooldown]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (viewMode === 'recovery') {
      setCode(value);
    } else {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 6) {
        setCode(numericValue);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state?.mfa_token || !code.trim()) return;

    setError('');
    setLoading(true);

    try {
      const response = await apiService.verifyMfaCode(
        state.mfa_token,
        code.trim(),
        viewMode === 'recovery' ? undefined : currentMethod,
        viewMode === 'recovery'
      );

      await completeMfaLogin(response.access_token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || '';

      if (status === 401 && detail.toLowerCase().includes('expir')) {
        navigate('/login', {
          replace: true,
          state: { message: t('mfa.verify.tokenExpired') },
        });
      } else {
        setError(detail || t('mfa.verify.invalidCode'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = useCallback(async () => {
    if (!state?.mfa_token || resendCooldown > 0 || resendsRemaining <= 0) return;

    try {
      const response = await apiService.resendEmailCode(state.mfa_token);
      setResendsRemaining(response.resends_remaining);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setError('');
    } catch (err: any) {
      const detail = err.response?.data?.detail || '';
      setError(detail || t('mfa.verify.resendError'));
    }
  }, [state?.mfa_token, resendCooldown, resendsRemaining, t]);

  // When user selects email from the method selection screen,
  // send the code first, then switch to code input view.
  const handleSelectEmailMethod = useCallback(async () => {
    if (!state?.mfa_token) return;

    setSendingEmail(true);
    setError('');

    try {
      await apiService.switchMfaMethod(state.mfa_token, 'email');
      setCurrentMethod('email');
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setViewMode('code');
    } catch (err: any) {
      const detail = err.response?.data?.detail || '';
      setError(detail || t('mfa.verify.switchError'));
    } finally {
      setSendingEmail(false);
    }
  }, [state?.mfa_token, t]);

  const handleSelectTotpMethod = () => {
    setCurrentMethod('totp');
    setCode('');
    setError('');
    setViewMode('code');
  };

  const handleShowMethodSelection = () => {
    setError('');
    setCode('');
    setViewMode('methodSelection');
  };

  // Don't render if no state (will redirect)
  if (!state?.mfa_token) {
    return null;
  }

  const canResend =
    currentMethod === 'email' &&
    viewMode === 'code' &&
    resendCooldown === 0 &&
    resendsRemaining > 0;

  const hasMultipleMethods =
    state.available_methods && state.available_methods.length > 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-2xl">
        {/* Header */}
        <div>
          <h2 className="mt-4 text-center text-3xl font-extrabold">
            <span
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              DiagramaHub
            </span>
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('mfa.verify.title')}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* ---- METHOD SELECTION VIEW ---- */}
        {viewMode === 'methodSelection' && (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600 mb-4">
              {t('mfa.verify.chooseMethod')}
            </p>

            {state.available_methods.includes('totp') && (
              <button
                onClick={handleSelectTotpMethod}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors text-left"
              >
                <div className="flex-shrink-0 p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <ShieldIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('mfa.verify.methodTotp')}</p>
                  <p className="text-xs text-gray-500">{t('mfa.verify.methodTotpDesc')}</p>
                </div>
              </button>
            )}

            {state.available_methods.includes('email') && (
              <button
                onClick={handleSelectEmailMethod}
                disabled={sendingEmail}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex-shrink-0 p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <EmailIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {sendingEmail ? t('mfa.verify.sendingEmailCode') : t('mfa.verify.methodEmail')}
                  </p>
                  <p className="text-xs text-gray-500">{t('mfa.verify.methodEmailDesc')}</p>
                </div>
              </button>
            )}

            {/* Back to current method */}
            <button
              type="button"
              onClick={() => { setViewMode('code'); setError(''); }}
              className="flex items-center justify-center gap-1.5 w-full mt-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              {t('mfa.verify.backToCode')}
            </button>
          </div>
        )}

        {/* ---- CODE INPUT VIEW (TOTP / EMAIL) ---- */}
        {viewMode === 'code' && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Method-specific message */}
            <div className="text-center text-sm text-gray-600">
              {currentMethod === 'email' ? (
                <div className="flex items-center justify-center gap-2">
                  <EmailIcon className="w-4 h-4 text-gray-400" />
                  <p>{t('mfa.verify.emailSent')}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <ShieldIcon className="w-4 h-4 text-gray-400" />
                  <p>{t('mfa.verify.totpPrompt')}</p>
                </div>
              )}
            </div>

            {/* Code input */}
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-1">
                {t('mfa.verify.codeLabel')}
              </label>
              <input
                ref={codeInputRef}
                id="mfa-code"
                name="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={handleCodeChange}
                maxLength={6}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-center tracking-widest text-lg"
                placeholder="000000"
              />
            </div>

            {/* Resend section for email method */}
            {currentMethod === 'email' && (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={!canResend}
                  className={`font-medium ${
                    canResend
                      ? 'text-purple-600 hover:text-purple-500 cursor-pointer'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {resendCooldown > 0
                    ? `${t('mfa.verify.resend')} (${resendCooldown}s)`
                    : t('mfa.verify.resend')}
                </button>
                <span className="text-gray-500">
                  {t('mfa.verify.resendsRemaining', { count: resendsRemaining })}
                </span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('mfa.verify.verifying') : t('mfa.verify.submit')}
            </button>

            {/* Links */}
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => { setViewMode('recovery'); setCode(''); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full font-medium text-purple-600 hover:text-purple-500 text-sm"
              >
                <KeyIcon className="w-3.5 h-3.5" />
                {t('mfa.verify.useRecoveryCode')}
              </button>

              {hasMultipleMethods && (
                <button
                  type="button"
                  onClick={handleShowMethodSelection}
                  className="block w-full font-medium text-purple-600 hover:text-purple-500 text-sm"
                >
                  {t('mfa.verify.tryAnotherMethod')}
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="block w-full font-medium text-gray-500 hover:text-gray-700 text-sm"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </form>
        )}

        {/* ---- RECOVERY CODE VIEW ---- */}
        {viewMode === 'recovery' && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <KeyIcon className="w-4 h-4 text-gray-400" />
              <p>{t('mfa.verify.recoveryPrompt')}</p>
            </div>

            <div>
              <label htmlFor="mfa-recovery" className="block text-sm font-medium text-gray-700 mb-1">
                {t('mfa.verify.recoveryCodeLabel')}
              </label>
              <input
                ref={codeInputRef}
                id="mfa-recovery"
                name="mfa-recovery"
                type="text"
                inputMode="text"
                required
                value={code}
                onChange={handleCodeChange}
                maxLength={11}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-center tracking-widest text-lg"
                placeholder="XXXXX-XXXXX"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('mfa.verify.verifying') : t('mfa.verify.submit')}
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => { setViewMode('code'); setCode(''); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full font-medium text-purple-600 hover:text-purple-500 text-sm"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5" />
                {t('mfa.verify.backToCode')}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="block w-full font-medium text-gray-500 hover:text-gray-700 text-sm"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default MfaVerifyPage;
