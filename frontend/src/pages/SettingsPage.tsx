import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import AIIntegrationsSection from '../components/AIIntegrationsSection';

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

        {/* AI Integrations Section */}
        <div className="mb-6">
          <AIIntegrationsSection />
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
