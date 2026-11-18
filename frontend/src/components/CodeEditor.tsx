import { Editor } from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import type { Monaco } from '@monaco-editor/react';
import { monacoLanguageFor, setupMonaco } from '../utils/monacoSetup';
import { useTheme } from '../contexts/ThemeContext';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'mermaid' | 'plantuml' | 'd2';
  height?: string;
  readOnly?: boolean;
  borderless?: boolean;
  theme?: "vs-light" | "vs-dark";
}

export default function CodeEditor({
  value,
  onChange,
  language = 'mermaid',
  height = '500px',
  readOnly = false,
  borderless = false,
  theme: editorThemeProp,
}: CodeEditorProps) {
  const { t } = useTranslation();
  const { theme: appTheme } = useTheme();

  // Use explicit prop if provided, otherwise auto-detect from ThemeContext
  const editorTheme = editorThemeProp ?? (appTheme === 'dark' ? 'vs-dark' : 'vs-light');

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  const monacoLanguage = monacoLanguageFor(language);

  const handleEditorWillMount = (monaco: Monaco) => {
    setupMonaco(monaco);
  };

  return (
    <div className={borderless ? 'overflow-hidden' : 'border border-gray-200 dark:border-gray-800 rounded overflow-hidden'}>
      <Editor
        beforeMount={handleEditorWillMount}
        height={height}
        language={monacoLanguage}
        value={value}
        onChange={handleEditorChange}
        theme={editorTheme}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          padding: { top: 10, bottom: 10 },
          renderLineHighlight: 'all',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
          fontLigatures: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          contextmenu: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          parameterHints: { enabled: false },
          folding: true,
          foldingHighlight: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('editor.loadingEditor')}</div>
          </div>
        }
      />
    </div>
  );
}
