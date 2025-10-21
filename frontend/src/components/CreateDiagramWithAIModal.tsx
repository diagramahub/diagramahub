import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CreateDiagramWithAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (diagramCode: string, diagramType: string) => void;
}

export default function CreateDiagramWithAIModal({ isOpen, onClose, onSuccess }: CreateDiagramWithAIModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [diagramType, setDiagramType] = useState('mermaid');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!description.trim() || description.length < 10) {
      setError(t('ai.validation.apiKeyMinLength'));
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await apiService.generateDiagram({
        description: description.trim(),
        diagram_type: diagramType,
        language: user?.language || 'es'
      });

      onSuccess(response.diagram_code, diagramType);
      onClose();
      setDescription('');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(t('ai.messages.noProvidersError'));
      } else {
        setError(err.response?.data?.detail || t('ai.createDiagram.error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('ai.createDiagram.title')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('ai.createDiagram.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
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
          {/* Diagram Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ai.createDiagram.diagramType')}
            </label>
            <select
              value={diagramType}
              onChange={(e) => setDiagramType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={generating}
            >
              <option value="mermaid">{t('ai.createDiagram.mermaid')}</option>
              <option value="plantuml">{t('ai.createDiagram.plantuml')}</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('ai.createDiagram.description')} *
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              placeholder={t('ai.createDiagram.descriptionPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
              disabled={generating}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t('ai.createDiagram.generating')}</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>{t('ai.createDiagram.button')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
