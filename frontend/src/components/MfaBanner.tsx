import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const MFA_BANNER_DISMISSED_KEY = 'mfa_banner_dismissed';

const MfaBanner: React.FC = () => {
  const { t } = useTranslation();
  const { mfaEnabled } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Never show banner for OAuth sessions — provider already enforces strong auth
    const isOAuthSession = localStorage.getItem('oauth_session') === 'true';
    if (isOAuthSession) {
      setDismissed(true);
      return;
    }

    // Show banner only if MFA is not enabled and not dismissed this session
    if (!mfaEnabled) {
      const isDismissed = localStorage.getItem(MFA_BANNER_DISMISSED_KEY) === 'true';
      setDismissed(isDismissed);
    } else {
      setDismissed(true);
    }
  }, [mfaEnabled]);

  const handleDismiss = () => {
    localStorage.setItem(MFA_BANNER_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  const handleNavigateToSecurity = () => {
    navigate('/profile?tab=profile#mfa');
  };

  if (dismissed || mfaEnabled) {
    return null;
  }

  return (
    <div className="text-white px-4 py-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 40%, #4c1d95 70%, #6d28d9 100%)' }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <p className="text-sm font-medium truncate">
            {t('mfa.banner.message')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleNavigateToSecurity}
            className="px-3 py-1.5 text-sm font-medium bg-white text-purple-700 rounded-md hover:bg-purple-50 transition-colors shadow-sm"
          >
            {t('mfa.banner.enable')}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MfaBanner;
