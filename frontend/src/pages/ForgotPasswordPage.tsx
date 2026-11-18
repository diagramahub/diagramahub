import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import AnimatedBackground from '../components/AnimatedBackground';
import LanguageSelector from '../components/LanguageSelector';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { apiErrorStatus } from '../utils/apiError';
import { BrandLogo } from '../components/BrandLogo';

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiService.requestPasswordReset({ email });
      setSubmitted(true);
    } catch (err: unknown) {
      const status = apiErrorStatus(err);
      if (status === 503) {
        setError(t('auth.emailServiceUnavailable'));
      } else if (status === 422) {
        setError(t('validation.emailInvalid'));
      } else {
        setError(t('auth.resetRequestError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <AnimatedBackground />
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggleButton />
        <LanguageSelector />
      </div>
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h2 className="mt-6 flex justify-center">
            <BrandLogo size="lg" />
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('auth.forgotPasswordSubtitle')}
          </p>
        </div>

        {submitted ? (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-3 rounded">
              <span className="block sm:inline">{t('auth.resetLinkSent')}</span>
            </div>
            <div className="text-center">
              <Link to="/login" className="font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300">
                {t('auth.backToLogin')}
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('common.email')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input relative focus:z-10"
                  placeholder={t('common.email')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary group relative w-full flex justify-center"
              >
                {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
              </button>
            </div>

            <div className="text-center">
              <Link to="/login" className="font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 text-sm">
                {t('auth.backToLogin')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
