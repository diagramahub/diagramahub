import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AIProviderConfig,
  UpdateProviderRequest,
  AI_PROVIDER_NAMES,
  AI_PROVIDER_MODELS,
  AI_PROVIDER_API_KEY_URLS
} from '../types/ai';
import apiService from '../services/api';

interface EditProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  provider: AIProviderConfig | null;
  providerIndex: number;
}

export default function EditProviderModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  provider,
  providerIndex 
}: EditProviderModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);    
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState<UpdateProviderRequest>({
    api_key: '',
    model: '',
    display_name: '',
    is_active: true
  });

  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && provider) {
      setFormData({
        api_key: '',
        model: provider.model,
        display_name: provider.display_name || '',
        is_active: provider.is_active
      });
      setIsEditingApiKey(false);
      setErrors({});
      setTestResult(null);
    }
  }, [isOpen, provider]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.api_key && formData.api_key.length < 10) {
      newErrors.api_key = t('ai.validation.apiKeyMinLength');
    }

    if (!formData.model) {
      newErrors.model = t('ai.validation.modelRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!provider || !isEditingApiKey || !formData.api_key) return;
    
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await apiService.testAIProvider({
        provider: provider.provider,
        api_key: formData.api_key,
        model: formData.model || provider.model
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

    // Validar solo si se está editando la API key
    if (isEditingApiKey && !validateForm()) return;

    setLoading(true);
    try {
      // Solo enviar campos que han sido modificados
      const updateData: UpdateProviderRequest = {};
      
      // Solo incluir API key si se está editando y tiene valor
      if (isEditingApiKey && formData.api_key) {
        updateData.api_key = formData.api_key;
      }
      
      // Solo incluir modelo si cambió
      if (formData.model && formData.model !== provider?.model) {
        updateData.model = formData.model;
      }
      
      // Solo incluir display_name si cambió
      if (formData.display_name !== (provider?.display_name || '')) {
        updateData.display_name = formData.display_name;
      }
      
      // Solo incluir is_active si cambió
      if (formData.is_active !== provider?.is_active) {
        updateData.is_active = formData.is_active;
      }

      // Si no hay cambios, cerrar el modal sin hacer nada
      if (Object.keys(updateData).length === 0) {
        onClose();
        return;
      }

      await apiService.updateAIProvider(providerIndex, updateData);
      onSuccess();
      onClose();
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.detail || t('errors.genericError') });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !provider) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{t('ai.editProvider')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
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
          {/* Provider Info (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ai.form.provider')}
            </label>
            <div className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 flex items-center space-x-3">
              <div className="flex-shrink-0">
                <img 
                  src={`/images/ai-providers/${provider.provider}.svg`} 
                  alt={AI_PROVIDER_NAMES[provider.provider]}
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 font-bold">
                  {AI_PROVIDER_NAMES[provider.provider].charAt(0)}
                </div>
              </div>
              <div className="font-medium text-gray-900">{AI_PROVIDER_NAMES[provider.provider]}</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">{t('ai.help.providerCannotChange')}</p>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('ai.form.apiKey')}
              </label>
              {isEditingApiKey && (
                <a
                  href={AI_PROVIDER_API_KEY_URLS[provider.provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  {t('ai.help.getApiKey')}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
            {!isEditingApiKey ? (
              <div className="relative">
                <input
                  type="text"
                  value={provider.api_key}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    setIsEditingApiKey(true);
                    setFormData({ ...formData, api_key: '' });
                    setTestResult(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingApiKey(true);
                    setFormData({ ...formData, api_key: '' });
                    setTestResult(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {t('ai.form.changeApiKey')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => {
                    setFormData({ ...formData, api_key: e.target.value });
                    setTestResult(null);
                  }}
                  placeholder={t('ai.form.apiKeyPlaceholder')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.api_key ? 'border-red-500' : 'border-gray-300'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingApiKey(false);
                    setFormData({ ...formData, api_key: '' });
                    setTestResult(null);
                    setErrors({ ...errors, api_key: '' });
                  }}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
            {errors.api_key && (
              <p className="mt-1 text-sm text-red-600">{errors.api_key}</p>
            )}
            {!isEditingApiKey && (
              <p className="mt-2 text-xs text-gray-500">{t('ai.help.clickToChangeApiKey')}</p>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ai.form.model')} *
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.model ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {AI_PROVIDER_MODELS[provider.provider].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            {errors.model && (
              <p className="mt-1 text-sm text-red-600">{errors.model}</p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ai.form.displayName')}
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder={t('ai.form.displayNamePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              {t('ai.form.isActive')}
            </label>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading || testing || !isEditingApiKey || !formData.api_key}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? t('common.loading') : t('ai.testProvider')}
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
