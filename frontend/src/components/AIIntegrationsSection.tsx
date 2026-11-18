import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAISettings, AIProviderConfig, AI_PROVIDER_NAMES, AI_PROVIDER_STATUS, AI_PROVIDER_MODELS } from '../types/ai';
import apiService from '../services/api';
import AddProviderModal from './AddProviderModal';
import EditProviderModal from './EditProviderModal';
import ConfirmModal from './ConfirmModal';
import { ErrorToast } from './ErrorToast';
import { apiErrorMessage } from '../utils/apiError';
import { modelReadsImages } from '../utils/imageInput';
import { STAR_PATH } from './FavoriteStarButton';

const ACTION_BUTTON =
  'p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

export default function AIIntegrationsSection() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<UserAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<{ provider: AIProviderConfig; index: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // "Fix generated diagrams automatically" (saved per user, default on)
  const handleAutoFixChange = async (enabled: boolean) => {
    // Optimistic: the checkbox reacts at once; reverted if saving fails
    setSettings((prev) => (prev ? { ...prev, auto_fix_generated: enabled } : prev));
    setActionError(null);
    try {
      setSettings(await apiService.setAutoFixGenerated(enabled));
    } catch {
      setSettings((prev) => (prev ? { ...prev, auto_fix_generated: !enabled } : prev));
      setActionError(t('ai.autoFix.error'));
    }
  };
  const clearActionError = useCallback(() => setActionError(null), []);

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

  const handleRemoveProvider = async () => {
    if (removeIndex === null) return;
    const index = removeIndex;
    setRemoveIndex(null);
    try {
      setActionLoading(`remove-${index}`);
      await apiService.removeAIProvider(index);
      await loadSettings();
    } catch (error: unknown) {
      setActionError(apiErrorMessage(error) || t('errors.genericError'));
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
    } catch (error: unknown) {
      setActionError(apiErrorMessage(error) || t('errors.genericError'));
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

  const providers = settings
    ? [...settings.providers]
        .map((provider, index) => ({ provider, index }))
        // Default first, then the rest in the order they were added.
        .sort((a, b) => Number(settings.default_provider === b.provider.provider) - Number(settings.default_provider === a.provider.provider))
    : [];

  return (
    <>
      <section className="card" aria-labelledby="ai-integrations-title">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="ai-integrations-title" className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{t('ai.title')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('ai.subtitle')}</p>
          </div>
          {!!settings?.providers.length && (
            <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-secondary btn-sm self-start sm:self-auto flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('ai.addProvider')}
            </button>
          )}
        </div>

        {/* Providers */}
        <div className="px-4 sm:px-6 py-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : !providers.length ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full mb-3" aria-hidden="true">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('ai.noProviders')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4 max-w-md mx-auto">{t('ai.noProvidersDescription')}</p>
              <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                {t('ai.addProvider')}
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {providers.map(({ provider, index }) => {
                const isDefault = settings?.default_provider === provider.provider;
                const isAvailable = AI_PROVIDER_STATUS[provider.provider] === 'available';
                const providerName = AI_PROVIDER_NAMES[provider.provider];
                const name = provider.display_name || providerName;
                const retired = !AI_PROVIDER_MODELS[provider.provider]?.some((m) => m.id === provider.model);
                const readsImages = modelReadsImages(provider.provider, provider.model);
                const busy = actionLoading !== null;

                return (
                  <li
                    key={index}
                    className={`rounded-xl border bg-white dark:bg-gray-900 p-4 flex flex-col ${
                      isDefault
                        ? 'border-purple-300 dark:border-purple-800 ring-1 ring-purple-200/70 dark:ring-purple-900/50'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    {/* Name */}
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <img src={`/images/ai-providers/${provider.provider}.svg`} alt="" className="w-5 h-5 object-contain" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={name}>{name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{providerName}</p>
                      </div>
                      {isDefault && <span className="badge flex-shrink-0">{t('ai.status.default')}</span>}
                    </div>

                    {/* Model and key */}
                    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{t('ai.form.model')}</dt>
                      <dd className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-gray-800 dark:text-gray-200 truncate" title={provider.model}>{provider.model}</span>
                        {readsImages && (
                          <svg className="w-3.5 h-3.5 flex-shrink-0 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label={t('ai.form.readsImages')}>
                            <title>{t('ai.form.readsImages')}</title>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        {retired && (
                          <span className="flex-shrink-0 text-amber-600 dark:text-amber-400" title={t('ai.form.retiredHint')}>({t('ai.form.retired')})</span>
                        )}
                      </dd>
                      <dt className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{t('ai.form.apiKey')}</dt>
                      <dd className="font-mono text-gray-500 dark:text-gray-400 truncate">{provider.api_key}</dd>
                    </dl>

                    {/* Status and actions */}
                    <div className="mt-auto pt-3">
                      <div className="mt-1 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${provider.is_active ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`} aria-hidden="true" />
                          <span className="truncate">
                            {provider.is_active ? t('ai.status.active') : t('ai.status.inactive')}
                            {!isAvailable && ` · ${t('ai.status.comingSoon')}`}
                          </span>
                        </span>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {isAvailable && !isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(index)}
                              disabled={busy}
                              className={ACTION_BUTTON}
                              aria-label={t('ai.makeDefault', { name })}
                              title={t('ai.makeDefault', { name })}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={STAR_PATH} />
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditProvider(provider, index)}
                            disabled={busy}
                            className={ACTION_BUTTON}
                            aria-label={`${t('ai.editProvider')}: ${name}`}
                            title={t('ai.editProvider')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveIndex(index)}
                            disabled={busy}
                            className={`${ACTION_BUTTON} hover:!text-red-600 dark:hover:!text-red-400`}
                            aria-label={`${t('ai.removeProvider')}: ${name}`}
                            title={t('ai.removeProvider')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {/* Preferences */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-700 rounded focus:ring-purple-500"
              checked={settings?.auto_fix_generated !== false}
              disabled={!settings}
              onChange={(e) => handleAutoFixChange(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{t('ai.autoFix.label')}</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">{t('ai.autoFix.hint')}</span>
            </span>
          </label>
        </div>
      </section>

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

      {/* Remove Confirmation Modal */}
      <ConfirmModal
        isOpen={removeIndex !== null}
        onClose={() => setRemoveIndex(null)}
        onConfirm={handleRemoveProvider}
        title={t('ai.messages.removeTitle')}
        message={t('ai.messages.removeConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />

      <ErrorToast message={actionError} onClose={clearActionError} />
    </>
  );
}
