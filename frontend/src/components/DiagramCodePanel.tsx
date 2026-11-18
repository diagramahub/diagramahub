import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, type OnMount } from '@monaco-editor/react';
import { MONACO_DARK_THEME, monacoLanguageFor, setupMonaco } from '../utils/monacoSetup';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import type { FixDiagramResponse } from '../types/ai';
import { mermaidSyntaxError } from '../utils/mermaidCheck';

// Compact fix button for the title bar
function FixButton({ diagramId, diagramType, errorContext, onFixSuccess, onFixError }: {
  diagramId: string;
  diagramType: string;
  errorContext: string;
  onFixSuccess: (response: FixDiagramResponse) => void;
  onFixError: (error: string) => void;
}) {
  const [isFixing, setIsFixing] = useState(false);
  const { t, i18n } = useTranslation();

  const handleFix = async () => {
    setIsFixing(true);
    const language = i18n.language?.startsWith('en') ? 'en' : 'es';
    try {
      let response = await apiService.fixDiagram(diagramId, { error_context: errorContext, language });
      // The server can only check Mermaid structurally: the real parser runs here. A fix
      // that still doesn't parse gets one more try with the new error.
      if (diagramType === 'mermaid') {
        let syntaxError = await mermaidSyntaxError(response.corrected_code);
        if (syntaxError) {
          response = await apiService.fixDiagram(diagramId, {
            error_context: `${errorContext}\n\nA previous fix still fails with: ${syntaxError}\nThat attempt was:\n${response.corrected_code}`,
            language,
          });
          syntaxError = await mermaidSyntaxError(response.corrected_code);
        }
        if (syntaxError) {
          onFixError(t('editor.fixStillInvalid', { error: syntaxError }));
          return;
        }
      }
      onFixSuccess(response);
    } catch (error: unknown) {
      const detail = apiErrorMessage(error);
      onFixError(typeof detail === 'string' ? detail : t('editor.fixFailed'));
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
  onFixSuccess?: (response: FixDiagramResponse) => void;
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
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
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

  const monacoLanguage = monacoLanguageFor(diagramType);
  const editorTheme = theme === 'dark' ? MONACO_DARK_THEME : 'light';
  const fileExtension = diagramType === 'plantuml' ? 'diagram.puml' : diagramType === 'd2' ? 'diagram.d2' : diagramType === 'dbml' ? 'diagram.dbml' : 'diagram.mmd';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
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
              diagramType={diagramType}
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
          beforeMount={setupMonaco}
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
              <div className="text-sm text-gray-500">{t('editor.loadingEditor')}</div>
            </div>
          }
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-100 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-xs font-mono text-gray-600 dark:text-gray-400 flex-shrink-0">
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
          <span>{t('editor.lineCount', { count: value.split('\n').length })}</span>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <span className="uppercase">{diagramType}</span>
        </div>
      </div>
    </div>
  );
}
