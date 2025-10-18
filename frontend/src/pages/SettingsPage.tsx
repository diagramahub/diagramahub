import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('nav.settings')}
          </p>
        </div>

        {/* Contenido principal */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t('settings.comingSoon')}</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              {t('settings.comingSoonDescription')}
            </p>
          </div>
        </div>

        {/* Secciones futuras (preview) */}
        <div className="mt-6 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-50">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{t('settings.appearance')}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500">{t('settings.appearanceDescription')}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-50">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{t('settings.notifications')}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500">{t('settings.notificationsDescription')}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-50">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{t('settings.privacy')}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500">{t('settings.privacyDescription')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
