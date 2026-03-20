import { useState } from 'react';
import { ImprovementStatus } from '../types/chat';
import DiagramPreview from './DiagramPreview';

interface DiagramPreviewInlineProps {
  code: string;
  diagramType: string;
  status?: ImprovementStatus;
  onAccept?: () => void;
  onReject?: () => void;
  onRestore?: () => void;
  onExpand?: () => void;
}

export default function DiagramPreviewInline({
  code,
  diagramType,
  status,
  onAccept,
  onReject,
  onRestore,
  onExpand,
}: DiagramPreviewInlineProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
      <div className="relative h-48 group/preview">
        <DiagramPreview code={code} diagramType={diagramType} />
        {/* Botones flotantes */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/preview:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 bg-white/90 border border-gray-200 rounded-md text-gray-500 hover:text-purple-600 hover:bg-white shadow-sm"
            title={copied ? 'Copiado' : 'Copiar código'}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="p-1.5 bg-white/90 border border-gray-200 rounded-md text-gray-500 hover:text-purple-600 hover:bg-white shadow-sm"
              title="Ver en grande"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {status === 'pending' && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            ✓ Aceptar
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-orange-600 bg-white border border-orange-300 rounded-md hover:bg-orange-50 transition-colors"
          >
            ✗ Rechazar
          </button>
        </div>
      )}
      {status === 'accepted' && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border-t border-green-200">
          <span className="flex-1 text-xs text-green-700 font-medium text-center">✓ Mejora aceptada</span>
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="px-2 py-1 text-[10px] font-medium text-green-700 bg-white border border-green-300 rounded hover:bg-green-100 transition-colors"
              title="Restaurar esta versión"
            >
              ↩ Restaurar
            </button>
          )}
        </div>
      )}
      {status === 'rejected' && (
        <div className="flex items-center gap-2 p-2 bg-orange-50 border-t border-orange-200">
          <span className="flex-1 text-xs text-orange-600 font-medium text-center">✗ Mejora rechazada</span>
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="px-2 py-1 text-[10px] font-medium text-orange-600 bg-white border border-orange-300 rounded hover:bg-orange-100 transition-colors"
              title="Utilizar esta versión"
            >
              ↩ Utilizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
