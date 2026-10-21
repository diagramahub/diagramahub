import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="relative h-48 group/preview">
        <DiagramPreview code={code} diagramType={diagramType} />
        {/* Botones flotantes */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/preview:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-md text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-700 shadow-sm"
            title={copied ? t('chat.copied') : t('chat.copyCode')}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="p-1.5 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-md text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-700 shadow-sm"
              title={t('chat.preview.expand')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {status === 'pending' && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            {t('chat.preview.accept')}
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            {t('chat.preview.reject')}
          </button>
        </div>
      )}
      {status === 'accepted' && (
        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
          <span className="flex-1 text-xs text-green-700 dark:text-green-300 font-medium text-center">{t('chat.preview.accepted')}</span>
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="px-2 py-1 text-[10px] font-medium text-green-700 dark:text-green-300 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              title={t('chat.preview.restoreTitle')}
            >
              {t('chat.preview.restore')}
            </button>
          )}
        </div>
      )}
      {status === 'rejected' && (
        <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800">
          <span className="flex-1 text-xs text-orange-600 dark:text-orange-400 font-medium text-center">{t('chat.preview.rejected')}</span>
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="px-2 py-1 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              title={t('chat.preview.useTitle')}
            >
              {t('chat.preview.use')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
