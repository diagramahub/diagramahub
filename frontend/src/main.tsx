import * as Sentry from '@sentry/react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import i18n from './i18n/config'
import { SENTRY_DSN, APP_ENV } from './utils/runtimeConfig'

// Initialize Sentry conditionally — only when DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    release: import.meta.env.VITE_APP_VERSION || __APP_VERSION__,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

// Keep <html lang>, the document title and the meta description in sync with
// the active UI language (Spanish is the default). i18next detects the language
// on load and updates it when the user switches, so the document metadata stays
// coherent with what the app actually renders.
const applyDocumentLanguage = (lng?: string) => {
  const lang = lng?.startsWith('en') ? 'en' : 'es';
  document.documentElement.lang = lang;
  document.title = i18n.t('app.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', i18n.t('app.description'));
};

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.language);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
