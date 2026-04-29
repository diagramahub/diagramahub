import { Editor } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import { registerD2Language } from '../utils/d2Language';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'mermaid' | 'plantuml' | 'd2';
  height?: string;
  readOnly?: boolean;
  borderless?: boolean;
  theme?: 'vs-light' | 'vs-dark';
}

export default function CodeEditor({
  value,
  onChange,
  language = 'mermaid',
  height = '500px',
  readOnly = false,
  borderless = false,
  theme: editorTheme = 'vs-light',
}: CodeEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  // Determine the Monaco language mode
  // Monaco doesn't have native mermaid/plantuml support, so we use closest alternatives
  // D2 uses a custom registered language with its own tokenizer
  const monacoLanguage = language === 'd2' ? 'd2' : language === 'plantuml' ? 'java' : 'markdown';

  const handleEditorWillMount = (monaco: Monaco) => {
    registerD2Language(monaco);
  };

  return (
    <div className={borderless ? 'overflow-hidden' : 'border border-gray-200 rounded overflow-hidden'}>
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
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-sm text-gray-500">Cargando editor...</div>
          </div>
        }
      />
    </div>
  );
}
