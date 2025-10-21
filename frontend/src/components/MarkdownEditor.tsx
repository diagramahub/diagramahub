import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escribe tu descripción en Markdown...',
  className = '',
  minHeight = '500px'
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('preview');

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'preview'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          👁️ Descripción
        </button>
        <button
          onClick={() => setActiveTab('write')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'write'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ✏️ Editar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white">
        {activeTab === 'write' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full text-sm text-gray-800 bg-white p-4 focus:outline-none resize-none placeholder-gray-400"
            style={{ minHeight }}
            placeholder={placeholder}
          />
        ) : (
          <div className="prose prose-sm max-w-none p-4 bg-white text-gray-800">
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-400 italic">
                No hay contenido para previsualizar
              </p>
            )}
          </div>
        )}
      </div>

      {/* Markdown Tips */}
      {activeTab === 'write' && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          <strong>Tips:</strong> **negrita**, *cursiva*, # Título, - Lista, [link](url), `código`
        </div>
      )}
    </div>
  );
}
