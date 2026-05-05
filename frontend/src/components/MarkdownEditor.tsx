import { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  fontSize?: number;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escribe tu descripción en Markdown...',
  className = '',
  fontSize,
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  const easymdeOptions = useMemo(() => ({
    spellChecker: false,
    placeholder,
    status: false,
    minHeight: '300px',
    autofocus: true,
    toolbar: [
      'bold', 'italic', 'strikethrough', '|',
      'heading-1', 'heading-2', 'heading-3', '|',
      'unordered-list', 'ordered-list', '|',
      'code', 'quote', 'link', 'table', '|',
      'horizontal-rule', '|',
      'preview', 'side-by-side',
    ] as const,
  }), [placeholder]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {isEditing ? (
        <>
          {/* Edit mode header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Editando descripción · Markdown</span>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Listo
            </button>
          </div>
          {/* EasyMDE WYSIWYG */}
          <div className="flex-1 overflow-auto markdown-wysiwyg">
            <SimpleMDE
              value={value}
              onChange={handleChange}
              options={easymdeOptions}
            />
          </div>
        </>
      ) : (
        <>
          {/* Read-only mode header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Descripción</span>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
              title="Editar descripción"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>
          </div>
          {/* Markdown preview */}
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
            <div
              className="prose prose-sm max-w-none p-4 text-gray-800 dark:text-gray-200 prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-code:text-purple-700 dark:prose-code:text-purple-300 prose-code:bg-purple-50 dark:prose-code:bg-purple-900/30 prose-code:px-1 prose-code:rounded prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600"
              style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
            >
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                  <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm italic">Sin descripción</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline"
                  >
                    Agregar descripción
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
