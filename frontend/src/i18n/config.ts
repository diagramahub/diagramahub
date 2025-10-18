import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationES from './locales/es.json';
import translationEN from './locales/en.json';

// Translation resources
const resources = {
  es: {
    translation: translationES
  },
  en: {
    translation: translationEN
  }
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'es', // Default language
    lng: localStorage.getItem('language') || 'es', // Get saved language or default to Spanish

    interpolation: {
      escapeValue: false // React already escapes values
    },

    detection: {
      // Order and from where user language should be detected
      order: ['localStorage', 'navigator'],

      // Cache user language in localStorage
      caches: ['localStorage'],

      // Keys to lookup language from
      lookupLocalStorage: 'language'
    }
  });

export default i18n;
