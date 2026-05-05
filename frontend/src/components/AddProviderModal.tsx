import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AIProviderType,
  CreateProviderRequest,
  AI_PROVIDER_NAMES,
  AI_PROVIDER_MODELS,
  AI_PROVIDER_STATUS,
  AI_PROVIDER_API_KEY_URLS,
  getRecommendedModel,
} from '../types/ai';
import apiService from '../services/api';

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProviderModal({ isOpen, onClose, onSuccess }: AddProviderModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState<CreateProviderRequest>({
    provider: AIProviderType.GEMINI,
    api_key: '',
    model: getRecommendedModel(AIProviderType.GEMINI),
    display_name: '',
    is_default: false,
    parameters: {
      temperature: 0.7,
      max_output_tokens: 2048
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        provider: AIProviderType.GEMINI,
        api_key: '',
        model: getRecommendedModel(AIProviderType.GEMINI),
        display_name: '',
        is_default: false,
        parameters: {
          temperature: 0.7,
          max_output_tokens: 2048
        }
      });
      setErrors({});
      setTestResult(null);
    }
  }, [isOpen]);

  const handleProviderChange = (provider: AIProviderType) => {
    const defaultModel = getRecommendedModel(provider);
    setFormData({
      ...formData,
      provider,
      model: defaultModel
    });
    setTestResult(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.api_key) {
      newErrors.api_key = t('ai.validation.apiKeyRequired');
    } else if (formData.api_key.length < 10) {
      newErrors.api_key = t('ai.validation.apiKeyMinLength');
    }

    if (!formData.model) {
      newErrors.model = t('ai.validation.modelRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await apiService.testAIProvider({
        provider: formData.provider,
        api_key: formData.api_key,
        model: formData.model
      });

      setTestResult({
        success: result.valid,
        message: result.valid ? t('ai.messages.testSuccess') : t('ai.messages.testError')
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.detail || t('ai.messages.testError')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      await apiService.addAIProvider(formData);
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.response?.status === 501) {
        setErrors({ submit: t('ai.status.comingSoon') });
      } else {
        setErrors({ submit: error.response?.data?.detail || t('errors.genericError') });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isProviderAvailable = AI_PROVIDER_STATUS[formData.provider] === 'available';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('ai.addProvider')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ai.form.provider')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(AIProviderType).map((provider) => {
                const isAvailable = AI_PROVIDER_STATUS[provider] === 'available';
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleProviderChange(provider)}
                    disabled={!isAvailable}
                    className={`relative p-4 border-2 rounded-lg text-left transition-all flex items-center space-x-3 ${
                      formData.provider === provider
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : isAvailable
                        ? 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {isAvailable && formData.provider === provider && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Provider Icon */}
                    <div className="flex-shrink-0">
                      <img 
                        src={`/images/ai-providers/${provider}.svg`} 
                        alt={AI_PROVIDER_NAMES[provider]}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          // Fallback to text initials or default icon if image fails
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      {/* Fallback Icon */}
                      <div className="hidden w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 font-bold">
                        {AI_PROVIDER_NAMES[provider].charAt(0)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{AI_PROVIDER_NAMES[provider]}</div>
                      {!isAvailable && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                          {t('ai.status.comingSoon')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('ai.form.apiKey')} *
              </label>
              <a
                href={AI_PROVIDER_API_KEY_URLS[formData.provider]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1"
              >
                {t('ai.help.getApiKey')}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => {
                setFormData({ ...formData, api_key: e.target.value });
                setTestResult(null);
              }}
              placeholder={t('ai.form.apiKeyPlaceholder')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                errors.api_key ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={!isProviderAvailable}
            />
            {errors.api_key && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.api_key}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('ai.help.security')}</p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ai.form.model')} *
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                errors.model ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={!isProviderAvailable}
            >
              {AI_PROVIDER_MODELS[formData.provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}{m.recommended ? ' ★ Recomendado' : ''}
                </option>
              ))}
            </select>
            {errors.model && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.model}</p>
            )}
          </div>

          {/* Display Name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ai.form.displayName')}
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder={t('ai.form.displayNamePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={!isProviderAvailable}
            />
          </div>

          {/* Set as Default */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600 rounded"
              disabled={!isProviderAvailable}
            />
            <label htmlFor="is_default" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {t('ai.form.isDefault')}
            </label>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              <div className="flex items-start">
                <svg
                  className={`w-5 h-5 mr-2 mt-0.5 ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {testResult.success ? (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                <span className="text-sm">{testResult.message}</span>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{errors.submit}</p>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading || testing || !isProviderAvailable || !formData.api_key}
            className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? t('common.loading') : t('ai.testProvider')}
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !isProviderAvailable}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 btn-glass rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
