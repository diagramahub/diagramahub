import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface EditorTopBarProps {
  projectName: string;
  projectId: string;
  diagramTitle: string;
  onTitleChange: (title: string) => void;
}

export default function EditorTopBar({
  projectName,
  projectId,
  diagramTitle,
  onTitleChange,
}: EditorTopBarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(diagramTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(diagramTitle);
  }, [diagramTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setEditValue(diagramTitle);
    setIsEditing(true);
  };

  const handleFinishEditing = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== diagramTitle) {
      onTitleChange(trimmed);
    } else {
      setEditValue(diagramTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFinishEditing();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(diagramTitle);
    }
  };

  return (
    <div className="flex items-center h-10 px-3 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
      {/* Back to Dashboard */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors mr-3"
        aria-label={t('editor.backToDashboard')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="hidden sm:inline">{t('editor.backToDashboard')}</span>
      </button>

      {/* Breadcrumb separator */}
      <div className="hidden sm:flex items-center text-gray-300 dark:text-gray-600 mr-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Project name breadcrumb */}
      <button
        onClick={() => navigate(`/projects/${projectId}`)}
        className="hidden sm:inline text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors truncate max-w-[160px]"
        title={projectName}
      >
        {projectName}
      </button>

      {/* Breadcrumb separator */}
      <div className="hidden sm:flex items-center text-gray-300 dark:text-gray-600 mx-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Editable diagram title */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleFinishEditing}
          onKeyDown={handleKeyDown}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-purple-500 outline-none px-1 py-0.5 max-w-[200px]"
          aria-label={t('editor.editDiagramTitle')}
        />
      ) : (
        <button
          onClick={handleStartEditing}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors truncate max-w-[200px] flex items-center gap-1"
          title={t('editor.clickToEditTitle')}
        >
          <span className="truncate">{diagramTitle}</span>
          <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
    </div>
  );
}
