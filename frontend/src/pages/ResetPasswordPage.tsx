import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!success) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [success, navigate]);

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push(t('validation.passwordMin'));
    if (!/[A-Z]/.test(password)) errors.push(t('validation.passwordUppercase'));
    if (!/[a-z]/.test(password)) errors.push(t('validation.passwordLowercase'));
    if (!/\d/.test(password)) errors.push(t('validation.passwordNumber'));
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);

    if (newPassword !== confirmPassword) {
      setValidationErrors([t('validation.passwordMismatch')]);
      return;
    }

    const pwErrors = validatePassword(newPassword);
    if (pwErrors.length > 0) {
      setValidationErrors(pwErrors);
      return;
    }

    setLoading(true);
    try {
      await apiService.confirmPasswordReset({ email, token, new_password: newPassword });
      setSuccess(true);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 400) {
        setError(t('auth.resetTokenInvalid'));
      } else {
        setError(t('auth.resetRequestError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold">
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
            {t('auth.resetPasswordSubtitle')}
          </p>
        </div>

        {success ? (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
              <span className="block sm:inline">{t('auth.resetPasswordSuccess')}</span>
            </div>
            <p className="text-center text-sm text-gray-500">
              {t('auth.redirectingToLogin', { seconds: countdown })}
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                <span className="block sm:inline">{error}</span>
                {error === t('auth.resetTokenInvalid') && (
                  <div className="mt-2">
                    <Link
                      to="/forgot-password"
                      className="font-medium text-purple-600 hover:text-purple-500 text-sm"
                    >
                      {t('auth.requestNewResetLink')}
                    </Link>
                  </div>
                )}
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                <ul className="list-disc list-inside">
                  {validationErrors.map((ve, i) => (
                    <li key={i} className="text-sm">{ve}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.newPassword')}
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder={t('installation.passwordPlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.confirmNewPassword')}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder={t('auth.confirmNewPassword')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 btn-glass hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('auth.resettingPassword') : t('auth.resetPasswordButton')}
              </button>
            </div>

            <div className="text-center">
              <Link to="/login" className="font-medium text-purple-600 hover:text-purple-500 text-sm">
                {t('auth.backToLogin')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
