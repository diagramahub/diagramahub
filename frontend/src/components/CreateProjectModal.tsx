import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Project } from '../types/project';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
  isFirstProject?: boolean;
  editMode?: boolean;
  projectToEdit?: Project;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isFirstProject = false,
  editMode = false,
  projectToEdit
}) => {
  const { t } = useTranslation();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📊');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emojiOptions = ['📊', '📈', '📉', '🎯', '💡', '🚀', '⚡', '🔥', '💼', '🎨', '📱', '💻', '🌟', '🎓', '🏆', '🔧', '📝', '🗂️', '📦', '🎭'];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editMode && projectToEdit) {
        setProjectName(projectToEdit.name);
        setProjectDescription(projectToEdit.description || '');
        setSelectedEmoji(projectToEdit.emoji);
      } else {
        setProjectName(isFirstProject ? t('project.myFirstProject') : '');
        setProjectDescription('');
        setSelectedEmoji('📊');
      }
      setError(null);
    }
  }, [isOpen, isFirstProject, editMode, projectToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError(t('project.nameRequiredError'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editMode && projectToEdit) {
        // Update existing project
        await api.updateProject(projectToEdit.id, {
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          emoji: selectedEmoji,
        });
        onSuccess(projectToEdit.id);
      } else {
        // Create new project
        const project = await api.createProject({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          emoji: selectedEmoji,
        });
        onSuccess(project.id);
      }

      onClose();
    } catch (err: any) {
      console.error(`Error ${editMode ? 'updating' : 'creating'} project:`, err);
      setError(err.response?.data?.detail || t(editMode ? 'project.updateError' : 'project.createError'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            {isFirstProject ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('project.welcome')}</h2>
                <p className="text-gray-600">{t('project.firstProjectSubtitle')}</p>
              </>
            ) : editMode ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('project.editTitle')}</h2>
                <p className="text-gray-600">{t('project.editSubtitle')}</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('project.createTitle')}</h2>
                <p className="text-gray-600">{t('project.createSubtitle')}</p>
              </>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Emoji Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {t('project.icon')}
              </label>
              <div className="grid grid-cols-10 gap-2">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`text-2xl p-2 rounded-lg transition-all ${
                      selectedEmoji === emoji
                        ? 'bg-indigo-100 border-2 border-indigo-500 scale-110'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Name */}
            <div>
              <label htmlFor="project-name" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('project.nameRequired')}
              </label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('project.namePlaceholderExample')}
                required
                maxLength={100}
              />
              <p className="mt-2 text-sm text-gray-500">{t('project.nameHint')}</p>
            </div>

            {/* Project Description */}
            <div>
              <label htmlFor="project-description" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('project.descriptionOptional')}
              </label>
              <textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder={t('project.descriptionPlaceholderExample')}
                maxLength={500}
              />
              <p className="mt-2 text-sm text-gray-500">
                {projectDescription.length}/500 {t('project.characters')}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Info Box (only for first project) */}
            {isFirstProject && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-blue-800">
                      <strong>{t('project.whatNext')}</strong> {t('project.whatNextDescription')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              {!isFirstProject && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('common.cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !projectName.trim()}
                className={`${isFirstProject ? 'w-full' : 'flex-1'} bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {editMode ? t('project.savingChanges') : t('project.creatingProject')}
                  </span>
                ) : (
                  isFirstProject ? t('project.createAndContinue') : editMode ? t('project.saveChanges') : t('project.createProject')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;
