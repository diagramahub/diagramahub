import { useTranslation } from 'react-i18next';

interface MobileBottomToolbarProps {
  onToggleCode: () => void;
  onToggleDescription: () => void;
  onToggleFileBrowser: () => void;
  onToggleAppearance: () => void;
  onToggleFullscreen: () => void;
  onExport: () => void;
  onShare: () => void;
  onToggleChat: () => void;
  isCodeOpen?: boolean;
  isDescriptionOpen?: boolean;
  isFullscreen?: boolean;
  isChatOpen?: boolean;
  isShared?: boolean;
}

/**
 * Fixed bottom toolbar for mobile editor viewport (< 768px).
 * Replaces the top toolbar when the screen is too narrow.
 */
export default function MobileBottomToolbar({
  onToggleCode,
  onToggleDescription,
  onToggleFileBrowser,
  onToggleAppearance,
  onToggleFullscreen,
  onExport,
  onShare,
  onToggleChat,
  isCodeOpen,
  isDescriptionOpen,
  isFullscreen,
  isChatOpen,
  isShared,
}: MobileBottomToolbarProps) {
  const { t } = useTranslation();

  const buttons = [
    {
      key: 'file',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      label: t('editor.structure'),
      onClick: onToggleFileBrowser,
    },
    {
      key: 'code',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      label: t('editor.code'),
      onClick: onToggleCode,
      active: isCodeOpen,
    },
    {
      key: 'description',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      ),
      label: t('editor.description'),
      onClick: onToggleDescription,
      active: isDescriptionOpen,
    },
    {
      key: 'appearance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      label: t('editor.style'),
      onClick: onToggleAppearance,
    },
    {
      key: 'export',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      label: t('editor.exportDiagram'),
      onClick: onExport,
    },
    {
      key: 'fullscreen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isFullscreen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          )}
        </svg>
      ),
      label: isFullscreen ? t('editor.exitFullscreen') : t('editor.fullscreen'),
      onClick: onToggleFullscreen,
      active: isFullscreen,
    },
    {
      key: 'chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      label: t('editor.aiChat'),
      onClick: onToggleChat,
      active: isChatOpen,
    },
    {
      key: 'share',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
      label: t('editor.shareDiagram'),
      onClick: onShare,
      active: isShared,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {buttons.map((btn) => (
          <button
            key={btn.key}
            onClick={btn.onClick}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors ${
              btn.active
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 dark:text-gray-400 active:text-purple-600 dark:active:text-purple-400'
            }`}
            aria-label={btn.label}
          >
            {btn.icon}
            <span className="text-[10px] leading-tight truncate max-w-full">
              {btn.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
