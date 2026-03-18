import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UserAISettings, AI_PROVIDER_NAMES } from '../types/ai';
import PromptHistoryPanel from './PromptHistoryPanel';
import DiagramPreview from './DiagramPreview';

interface ImproveDiagramWithAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (improvedCode: string) => void;
  currentCode: string;
  diagramType: string;
  diagramId?: string;
  aiSettings?: UserAISettings | null;
}

export default function ImproveDiagramWithAIModal({
  isOpen,
  onClose,
  onAccept,
  currentCode,
  diagramType,
  diagramId,
  aiSettings
}: ImproveDiagramWithAIModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [improvementRequest, setImprovementRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [improvedCode, setImprovedCode] = useState('');
  const [error, setError] = useState('');
  const [useExistingCode, setUseExistingCode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<'code' | 'diagram'>('diagram');

  const handleGenerate = async () => {
    if (!improvementRequest.trim() || improvementRequest.length < 5) {
      setError(t('ai.validation.apiKeyMinLength'));
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const codeToUse = useExistingCode ? currentCode : '';
      const response = await apiService.improveDiagram({
        diagram_code: codeToUse,
        improvement_request: improvementRequest.trim(),
        diagram_type: diagramType,
        language: user?.language || 'es'
      });
      setImprovedCode(response.diagram_code);
      apiService.savePromptHistory({ prompt_text: improvementRequest.trim(), operation_type: 'improvement', diagram_id: diagramId }).catch(() => {});
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
    setImprovedCode('');
    setImprovementRequest('');
    setError('');
    setCopied(false);
    onClose();
  };

  const handleClose = () => {
    setImprovedCode('');
    setError('');
    onClose();
  };

  const handleReject = () => {
    setImprovedCode('');
    setError('');
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(improvedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
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

        {/* Two-column content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: History panel */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden flex-shrink-0">
            <PromptHistoryPanel
              onSelectPrompt={(text) => { setImprovementRequest(text); setError(''); }}
              operationType="improvement"
              diagramId={diagramId}
            />
          </div>

          {/* Right: Form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 space-y-4 flex-1 flex flex-col overflow-hidden">
              {/* Improvement Request */}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
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

              {/* Checkbox: Use existing code */}
              {!improvedCode && (
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="useExistingCode"
                      type="checkbox"
                      checked={useExistingCode}
                      onChange={(e) => setUseExistingCode(e.target.checked)}
                      disabled={generating}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
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

              {/* Preview */}
              {improvedCode && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setPreviewTab('diagram')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          previewTab === 'diagram'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                          </svg>
                          Diagrama
                        </span>
                      </button>
                      <button
                        onClick={() => setPreviewTab('code')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          previewTab === 'code'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          Código
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={handleCopy}
                      className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-all flex items-center gap-1.5 ${
                        copied
                          ? 'text-green-700 bg-green-50 border-green-300'
                          : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                      }`}
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

                  {previewTab === 'code' ? (
                    <>
                      <textarea
                        value={improvedCode}
                        onChange={(e) => setImprovedCode(e.target.value)}
                        className="w-full flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                        placeholder="Código del diagrama mejorado..."
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        💡 Puedes editar el código antes de aceptar los cambios
                      </p>
                    </>
                  ) : (
                    <div className="flex-1 min-h-0">
                      <DiagramPreview code={improvedCode} diagramType={diagramType} />
                    </div>
                  )}
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
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
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
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
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
                        {aiSettings?.default_provider ? (
                          <img
                            src={`/images/ai-providers/${aiSettings.default_provider}.svg`}
                            alt={AI_PROVIDER_NAMES[aiSettings.default_provider]}
                            className="w-4 h-4 object-contain brightness-0 invert"
                          />
                        ) : (
                          <span>⚡</span>
                        )}
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
      </div>
    </div>
  );
}