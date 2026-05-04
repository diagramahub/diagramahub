import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAISettings, AIProviderConfig, AI_PROVIDER_NAMES, AI_PROVIDER_STATUS } from '../types/ai';
import apiService from '../services/api';
import AddProviderModal from './AddProviderModal';
import EditProviderModal from './EditProviderModal';

export default function AIIntegrationsSection() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<UserAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<{ provider: AIProviderConfig; index: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAISettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProvider = async (index: number) => {
    if (!window.confirm(t('ai.messages.removeConfirm'))) return;

    try {
      setActionLoading(`remove-${index}`);
      await apiService.removeAIProvider(index);
      await loadSettings();
    } catch (error: any) {
      alert(error.response?.data?.detail || t('errors.genericError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (index: number) => {
    const provider = settings?.providers[index];
    if (!provider) return;

    try {
      setActionLoading(`default-${index}`);
      await apiService.setDefaultAIProvider(provider.provider);
      await loadSettings();
    } catch (error: any) {
      alert(error.response?.data?.detail || t('errors.genericError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditProvider = (provider: AIProviderConfig, index: number) => {
    setEditingProvider({ provider, index });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingProvider(null);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('ai.title')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('ai.subtitle')}</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 btn-glass rounded-lg hover:bg-purple-700 flex items-center space-x-2 self-start sm:self-auto flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>{t('ai.addProvider')}</span>
            </button>
          </div>
        </div>

        {/* Providers List */}
        <div className="px-4 sm:px-6 py-4">
          {!settings?.providers.length ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('ai.noProviders')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{t('ai.noProvidersDescription')}</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 btn-glass rounded-lg hover:bg-purple-700"
              >
                {t('ai.addProvider')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sort providers: default first, then others */}
              {[...settings.providers]
                .sort((a, b) => {
                  const aIsDefault = settings.default_provider === a.provider;
                  const bIsDefault = settings.default_provider === b.provider;
                  if (aIsDefault && !bIsDefault) return -1;
                  if (!aIsDefault && bIsDefault) return 1;
                  return 0;
                })
                .map((provider) => {
                  // Find original index for API calls
                  const originalIndex = settings.providers.findIndex(p => p === provider);
                  const isDefault = settings.default_provider === provider.provider;
                  const isAvailable = AI_PROVIDER_STATUS[provider.provider] === 'available';

                return (
                  <div
                    key={originalIndex}
                    className={`p-4 border rounded-lg ${
                      isDefault ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:space-x-3 sm:gap-0">
                          <img
                            src={`/images/ai-providers/${provider.provider}.svg`}
                            alt={AI_PROVIDER_NAMES[provider.provider]}
                            className="w-6 h-6 object-contain"
                          />
                          <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">
                            {provider.display_name || AI_PROVIDER_NAMES[provider.provider]}
                          </h4>
                          {isDefault && (
                            <span className="px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                              {t('ai.status.default')}
                            </span>
                          )}
                          {!isAvailable && (
                            <span className="px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                              {t('ai.status.comingSoon')}
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              provider.is_active
                                ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30'
                                : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            {provider.is_active ? t('ai.status.active') : t('ai.status.inactive')}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{t('ai.form.provider')}:</span>{' '}
                            {AI_PROVIDER_NAMES[provider.provider]}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{t('ai.form.model')}:</span> {provider.model}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{t('ai.form.apiKey')}:</span>{' '}
                            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                              {provider.api_key}
                            </code>
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleEditProvider(provider, originalIndex)}
                          disabled={actionLoading !== null}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                          title={t('ai.editProvider')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        {isAvailable && (
                          <button
                            onClick={() => handleSetDefault(originalIndex)}
                            disabled={actionLoading === `default-${originalIndex}`}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              isDefault
                                ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={t('ai.form.isDefault')}
                          >
                            <svg 
                              className="w-5 h-5" 
                              fill={isDefault ? 'currentColor' : 'none'} 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveProvider(originalIndex)}
                          disabled={actionLoading === `remove-${originalIndex}`}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                          title={t('ai.removeProvider')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AddProviderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadSettings}
      />

      {/* Edit Modal */}
      <EditProviderModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={loadSettings}
        provider={editingProvider?.provider || null}
        providerIndex={editingProvider?.index || 0}
      />
    </>
  );
}
