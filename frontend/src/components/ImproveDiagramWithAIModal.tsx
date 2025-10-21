import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ImproveDiagramWithAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (improvedCode: string) => void;
  currentCode: string;
  diagramType: string;
}

export default function ImproveDiagramWithAIModal({
  isOpen,
  onClose,
  onAccept,
  currentCode,
  diagramType
}: ImproveDiagramWithAIModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [improvementRequest, setImprovementRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [improvedCode, setImprovedCode] = useState('');
  const [error, setError] = useState('');
  const [useExistingCode, setUseExistingCode] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!improvementRequest.trim() || improvementRequest.length < 5) {
      setError(t('ai.validation.apiKeyMinLength'));
      return;
    }

    setGenerating(true);
    setError('');

    try {
      // Si no se usa código existente, enviar código vacío para generar desde cero
      const codeToUse = useExistingCode ? currentCode : '';

      const response = await apiService.improveDiagram({
        diagram_code: codeToUse,
        improvement_request: improvementRequest.trim(),
        diagram_type: diagramType,
        language: user?.language || 'es'
      });

      setImprovedCode(response.diagram_code);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(t('ai.messages.noProvidersError'));
      } else {
        setError(err.response?.data?.detail || t('ai.improveDiagram.error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    onAccept(improvedCode);
    handleClose();
  };

  const handleClose = () => {
    // Solo limpiar el código mejorado, mantener el texto del usuario
    setImprovedCode('');
    setError('');
    onClose();
  };

  const handleReject = () => {
    // Rechazar mejora pero mantener el texto para que el usuario pueda refinarlo
    setImprovedCode('');
    setError('');
    setCopied(false);
    // NO limpiamos improvementRequest para que el usuario pueda editar y volver a intentar
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(improvedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('ai.improveDiagram.title')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('ai.improveDiagram.subtitle')}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
              disabled={generating}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Improvement Request - Always visible to allow editing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ai.improveDiagram.improvementRequest')} *
            </label>
            <textarea
              value={improvementRequest}
              onChange={(e) => {
                setImprovementRequest(e.target.value);
                setError('');
              }}
              placeholder={t('ai.improveDiagram.improvementPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              disabled={generating}
              readOnly={!!improvedCode}
            />
            {improvedCode && (
              <p className="mt-2 text-xs text-gray-500">
                {t('ai.improveDiagram.editHint', 'Rechaza para editar tu solicitud y volver a intentar')}
              </p>
            )}
          </div>

          {/* Checkbox: Use existing code as context */}
          {!improvedCode && (
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="useExistingCode"
                  type="checkbox"
                  checked={useExistingCode}
                  onChange={(e) => setUseExistingCode(e.target.checked)}
                  disabled={generating}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="useExistingCode" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Utilizar el código existente como contexto
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  {useExistingCode
                    ? 'La IA mejorará el diagrama actual basándose en tu solicitud'
                    : 'La IA creará un diagrama completamente nuevo desde cero'}
                </p>
              </div>
            </div>
          )}

          {/* Preview - Show improved code (editable) */}
          {improvedCode && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t('ai.improveDiagram.preview')}
                </label>
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-all flex items-center gap-1.5 ${
                    copied
                      ? 'text-green-700 bg-green-50 border-green-300'
                      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Copiar al portapapeles"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={improvedCode}
                onChange={(e) => setImprovedCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                rows={16}
                placeholder="Código del diagrama mejorado..."
              />
              <p className="mt-2 text-xs text-gray-500">
                💡 Puedes editar el código antes de aceptar los cambios
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          {!improvedCode ? (
            <>
              <button
                onClick={handleClose}
                disabled={generating}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !improvementRequest.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('ai.improveDiagram.generating')}</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{t('ai.improveDiagram.button')}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
              >
                {t('ai.improveDiagram.rejectButton')}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                {t('ai.improveDiagram.acceptButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
