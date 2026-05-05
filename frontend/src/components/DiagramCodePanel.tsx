import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, type OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import { registerD2Language } from '../utils/d2Language';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';

// Compact fix button for the title bar
function FixButton({ diagramId, errorContext, onFixSuccess, onFixError }: {
  diagramId: string;
  errorContext: string;
  onFixSuccess: (response: any) => void;
  onFixError: (error: string) => void;
}) {
  const [isFixing, setIsFixing] = useState(false);
  const { t } = useTranslation();

  const handleFix = async () => {
    setIsFixing(true);
    try {
      const response = await apiService.fixDiagram(diagramId, {
        error_context: errorContext,
        language: 'es'
      });
      onFixSuccess(response);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      onFixError(typeof detail === 'string' ? detail : 'Error al corregir el diagrama');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <button
      onClick={handleFix}
      disabled={isFixing}
      className="p-1 rounded transition-colors text-purple-500 hover:text-purple-400 disabled:opacity-50"
      aria-label={t('editor.fixWithAI')}
      title={t('editor.fixWithAI')}
    >
      {isFixing ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )}
    </button>
  );
}

interface DiagramCodePanelProps {
  value: string;
  onChange: (value: string) => void;
  diagramType: string;
  hasError: boolean;
  errorMessage?: string;
  onCopy: () => void;
  copied: boolean;
  onClose: () => void;
  isVisible?: boolean;
  diagramId?: string;
  onFixSuccess?: (response: any) => void;
  onFixError?: (error: string) => void;
}

export default function DiagramCodePanel({
  value,
  onChange,
  diagramType,
  hasError,
  errorMessage,
  onCopy,
  copied,
  onClose,
  isVisible = true,
  diagramId,
  onFixSuccess,
  onFixError,
}: DiagramCodePanelProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(400);

  // Force layout when editor mounts or container resizes
  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    // Force layout after a short delay to ensure container is sized
    setTimeout(() => {
      editor.layout();
    }, 100);
  }, []);

  // Calculate editor height from container using ResizeObserver
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) {
          setEditorHeight(h);
          // Also force Monaco to re-layout when container size changes
          if (editorRef.current) {
            editorRef.current.layout();
          }
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Force layout when value changes (e.g., when panel becomes visible)
  useEffect(() => {
    if (editorRef.current) {
      const timer = setTimeout(() => {
        editorRef.current?.layout();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [value]);

  // Force layout when panel visibility changes
  useEffect(() => {
    if (isVisible && editorRef.current) {
      // Use multiple delays to catch different timing scenarios
      const t1 = setTimeout(() => editorRef.current?.layout(), 50);
      const t2 = setTimeout(() => editorRef.current?.layout(), 200);
      const t3 = setTimeout(() => editorRef.current?.layout(), 500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isVisible]);

  const monacoLanguage = diagramType === 'd2' ? 'd2' : diagramType === 'plantuml' ? 'java' : 'markdown';
  const editorTheme = theme === 'dark' ? 'kiro-dark' : 'light';
  const fileExtension = diagramType === 'plantuml' ? 'diagram.puml' : diagramType === 'd2' ? 'diagram.d2' : diagramType === 'dbml' ? 'diagram.dbml' : 'diagram.mmd';

  const handleEditorWillMount = (monaco: Monaco) => {
    registerD2Language(monaco);

    // Define custom Kiro dark theme (matching sidebar dark bg)
    monaco.editor.defineTheme('kiro-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: 'a78bfa' },
        { token: 'number', foreground: 'e879f9' },
        { token: 'type', foreground: '818cf8' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'function', foreground: 'c4b5fd' },
        { token: 'operator', foreground: 'a5b4fc' },
        { token: 'delimiter', foreground: '94a3b8' },
      ],
      colors: {
        'editor.background': '#1f2937',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#2d3748',
        'editor.selectionBackground': '#7c3aed40',
        'editor.inactiveSelectionBackground': '#7c3aed20',
        'editorCursor.foreground': '#a78bfa',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#a78bfa',
        'editor.selectionHighlightBackground': '#7c3aed30',
        'editorIndentGuide.background1': '#374151',
        'editorIndentGuide.activeBackground1': '#7c3aed50',
        'editorBracketMatch.background': '#7c3aed30',
        'editorBracketMatch.border': '#7c3aed',
        'scrollbarSlider.background': '#7c3aed30',
        'scrollbarSlider.hoverBackground': '#7c3aed50',
        'scrollbarSlider.activeBackground': '#7c3aed70',
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-600 dark:text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>{fileExtension}</span>
            {hasError && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title={errorMessage || t('editor.syntaxError')} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasError && diagramId && onFixSuccess && onFixError && (
            <FixButton
              diagramId={diagramId}
              errorContext={errorMessage || 'Syntax error'}
              onFixSuccess={onFixSuccess}
              onFixError={onFixError}
            />
          )}
          <button
            onClick={onCopy}
            className={`p-1 rounded transition-colors ${copied ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
            aria-label={copied ? t('editor.copied') : t('editor.copyCode')}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors text-gray-500 hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Editor — uses pixel height from ResizeObserver */}
      <div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden">
        <Editor
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          height={`${editorHeight}px`}
          language={monacoLanguage}
          value={value}
          onChange={(v) => onChange(v || '')}
          theme={editorTheme}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'all',
            scrollbar: { vertical: 'visible', horizontal: 'visible', useShadows: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            fontLigatures: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: 'off',
            tabCompletion: 'off',
            parameterHints: { enabled: false },
            folding: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-gray-900">
              <div className="text-sm text-gray-500">Cargando editor...</div>
            </div>
          }
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400 flex-shrink-0">
        <div className="flex items-center gap-2">
          {hasError ? (
            <span className="flex items-center gap-1 text-red-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t('editor.syntaxError')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {t('editor.noErrors')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>{value.split('\n').length} {t('editor.lines')}</span>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <span className="uppercase">{diagramType}</span>
        </div>
      </div>
    </div>
  );
}
