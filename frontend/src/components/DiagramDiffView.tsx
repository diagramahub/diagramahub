/**
 * Componente para mostrar la comparación entre código original y corregido
 */
import React from 'react';

interface DiagramDiffViewProps {
  originalCode: string;
  correctedCode: string;
  explanation: string;
  changesSummary: string;
  diagramType?: string;
  onApply: () => void;
  onCancel: () => void;
}

export const DiagramDiffView: React.FC<DiagramDiffViewProps> = ({
  originalCode,
  correctedCode,
  explanation,
  changesSummary,
  diagramType = 'mermaid',
  onApply,
  onCancel
}) => {
  // Simple diff highlighting (line-by-line comparison)
  const originalLines = originalCode.split('\n');
  const correctedLines = correctedCode.split('\n');
  
  const maxLines = Math.max(originalLines.length, correctedLines.length);
  
  // Determine file extension based on diagram type
  const fileExtension = diagramType?.toLowerCase().includes('plantuml') || diagramType?.toLowerCase() === 'uml' 
    ? 'puml' 
    : 'mmd';
  
  const getDiffLines = () => {
    const diffLines: Array<{
      original: string;
      corrected: string;
      type: 'unchanged' | 'modified' | 'added' | 'removed';
    }> = [];
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const correctedLine = correctedLines[i] || '';
      
      if (originalLine === correctedLine) {
        diffLines.push({ original: originalLine, corrected: correctedLine, type: 'unchanged' });
      } else if (!originalLine) {
        diffLines.push({ original: '', corrected: correctedLine, type: 'added' });
      } else if (!correctedLine) {
        diffLines.push({ original: originalLine, corrected: '', type: 'removed' });
      } else {
        diffLines.push({ original: originalLine, corrected: correctedLine, type: 'modified' });
      }
    }
    
    return diffLines;
  };
  
  const diffLines = getDiffLines();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Corrección de Diagrama con IA
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {changesSummary}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Explanation */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-900 mb-2">
              Explicación de los cambios:
            </h3>
            <p className="text-sm text-purple-800 whitespace-pre-wrap">
              {explanation}
            </p>
          </div>

          {/* Side-by-side diff */}
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Código Original
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  {originalLines.length} líneas
                </span>
              </div>
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
                  <span className="text-xs text-gray-600 font-mono">original.{fileExtension}</span>
                </div>
                <pre className="overflow-x-auto">
                  <code className="block text-xs font-mono leading-relaxed">
                    {diffLines.map((line, idx) => (
                      <div
                        key={`original-${idx}`}
                        className={`flex ${
                          line.type === 'removed' || line.type === 'modified'
                            ? 'bg-red-50'
                            : line.type === 'unchanged'
                            ? ''
                            : 'bg-gray-50'
                        }`}
                      >
                        {/* Line number */}
                        <span className="inline-block w-12 flex-shrink-0 text-right pr-3 py-1 text-gray-400 select-none border-r border-gray-200 bg-gray-50">
                          {line.original ? idx + 1 : ''}
                        </span>
                        {/* Change indicator */}
                        <span className={`inline-block w-6 flex-shrink-0 text-center py-1 select-none ${
                          line.type === 'removed' ? 'text-red-600 font-bold' : 
                          line.type === 'modified' ? 'text-orange-600 font-bold' : 
                          'text-gray-300'
                        }`}>
                          {line.type === 'removed' ? '−' : line.type === 'modified' ? '~' : ''}
                        </span>
                        {/* Code content */}
                        <span className={`flex-1 px-3 py-1 ${
                          line.type === 'removed' || line.type === 'modified'
                            ? 'text-red-800'
                            : line.type === 'unchanged'
                            ? 'text-gray-800'
                            : 'text-gray-400'
                        }`}>
                          {line.original || '\u00A0'}
                        </span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>

            {/* Corrected */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Código Corregido
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  {correctedLines.length} líneas
                </span>
              </div>
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300">
                  <span className="text-xs text-gray-600 font-mono">corrected.{fileExtension}</span>
                </div>
                <pre className="overflow-x-auto">
                  <code className="block text-xs font-mono leading-relaxed">
                    {diffLines.map((line, idx) => (
                      <div
                        key={`corrected-${idx}`}
                        className={`flex ${
                          line.type === 'added' || line.type === 'modified'
                            ? 'bg-green-50'
                            : line.type === 'unchanged'
                            ? ''
                            : 'bg-gray-50'
                        }`}
                      >
                        {/* Line number */}
                        <span className="inline-block w-12 flex-shrink-0 text-right pr-3 py-1 text-gray-400 select-none border-r border-gray-200 bg-gray-50">
                          {line.corrected ? idx + 1 : ''}
                        </span>
                        {/* Change indicator */}
                        <span className={`inline-block w-6 flex-shrink-0 text-center py-1 select-none ${
                          line.type === 'added' ? 'text-green-600 font-bold' : 
                          line.type === 'modified' ? 'text-orange-600 font-bold' : 
                          'text-gray-300'
                        }`}>
                          {line.type === 'added' ? '+' : line.type === 'modified' ? '~' : ''}
                        </span>
                        {/* Code content */}
                        <span className={`flex-1 px-3 py-1 ${
                          line.type === 'added' || line.type === 'modified'
                            ? 'text-green-800'
                            : line.type === 'unchanged'
                            ? 'text-gray-800'
                            : 'text-gray-400'
                        }`}>
                          {line.corrected || '\u00A0'}
                        </span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white btn-glass rounded-lg transition-colors duration-200 font-medium text-sm shadow-sm"
          >
            Aplicar Corrección
          </button>
        </div>
      </div>
    </div>
  );
};
