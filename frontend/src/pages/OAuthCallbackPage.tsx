import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

const OAuthCallbackPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithOAuth } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const provider = searchParams.get('provider') || 'google';

      if (!code || !state) {
        navigate('/login?oauth_error=true', { replace: true });
        return;
      }

      try {
        const response = await apiService.oauthCallback({ code, state, provider });
        await loginWithOAuth(response.access_token);
        navigate('/dashboard', { replace: true });
      } catch {
        navigate('/login?oauth_error=true', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, loginWithOAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mb-4" />
        <p className="text-gray-600 text-lg">{t('oauth.authenticating')}</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
