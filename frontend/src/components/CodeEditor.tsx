import { Editor } from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'mermaid' | 'plantuml';
  height?: string;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  onChange,
  language = 'mermaid',
  height = '500px',
  readOnly = false,
}: CodeEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  // Determine the Monaco language mode
  // Monaco doesn't have native mermaid/plantuml support, so we use closest alternatives
  const monacoLanguage = language === 'plantuml' ? 'java' : 'markdown';

  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        onChange={handleEditorChange}
        theme="vs-light"
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
