import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type ExportFormat = 'png' | 'pdf' | 'svg' | 'markdown';

export interface ExportContentOptions {
  includeDescription: boolean;
  includeProjectInfo: boolean;
}

interface ExportDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportOptions: ExportContentOptions;
  setExportOptions: (options: ExportContentOptions) => void;
  /** The format currently being exported, or null when idle. */
  exportingFormat: ExportFormat | null;
  /** PNG export resolution scale (1x screen / 2x standard / 3x high). */
  pngScale: 1 | 2 | 3;
  setPngScale: (scale: 1 | 2 | 3) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportPdf: () => void;
  onExportMarkdown: () => void;
  onDownloadSource: () => void;
  diagramType?: string;
}

/** Small spinner shown on the export button while an export runs. */
const Spinner: React.FC = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const ExportDiagramModal: React.FC<ExportDiagramModalProps> = ({
  isOpen,
  onClose,
  exportOptions,
  setExportOptions,
  exportingFormat,
  pngScale,
  setPngScale,
  onExportPng,
  onExportSvg,
  onExportPdf,
  onExportMarkdown,
  onDownloadSource,
  diagramType,
}) => {
  const { t } = useTranslation();
  // Format selected for export; the options below adapt to it.
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');

  if (!isOpen) return null;

  const isBusy = exportingFormat !== null;

  const formats: {
    id: ExportFormat;
    label: string;
    hint: string;
    accent: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'png',
      label: 'PNG',
      hint: t('editor.formatHintPng'),
      accent: 'text-purple-600 dark:text-purple-400',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      ),
    },
    {
      id: 'svg',
      label: 'SVG',
      hint: t('editor.formatHintSvg'),
      accent: 'text-emerald-600 dark:text-emerald-400',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
        />
      ),
    },
    {
      id: 'pdf',
      label: 'PDF',
      hint: t('editor.formatHintPdf'),
      accent: 'text-red-600 dark:text-red-400',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      ),
    },
    {
      id: 'markdown',
      label: 'Markdown',
      hint: t('editor.formatHintMarkdown'),
      accent: 'text-gray-700 dark:text-gray-300',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      ),
    },
  ];

  const sourceLabel =
    diagramType === 'plantuml'
      ? '.puml'
      : diagramType === 'd2'
        ? '.d2'
        : '.mmd';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-auto overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('editor.exportDiagram')}
          </h3>
          <button
            onClick={onClose}
            disabled={isBusy}
            aria-label={t('common.cancel')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Format grid */}
          <div className="grid grid-cols-2 gap-3">
            {formats.map((format) => {
              const isSelected = selectedFormat === format.id;
              return (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  disabled={isBusy}
                  aria-pressed={isSelected}
                  className={`group flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-gray-700 disabled:hover:bg-transparent`}
                >
                  <span className={format.accent}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {format.icon}
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {format.label}
                  </span>
                  <span className="text-[11px] leading-tight text-gray-400 dark:text-gray-500 text-center">
                    {format.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Contextual options for the selected format */}
          {selectedFormat === 'svg' ? (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3">
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {t('editor.svgVectorNote')}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3 space-y-2.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('editor.exportOptions')}
              </p>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeDescription}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, includeDescription: e.target.checked })
                  }
                  className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('editor.includeDescription')}
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeProjectInfo}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, includeProjectInfo: e.target.checked })
                  }
                  className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t('editor.includeProjectInfo')}
                </span>
              </label>
              {/* PNG resolution selector — only visible when PNG is selected */}
              {selectedFormat === 'png' && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    {t('editor.pngResolution')}
                  </p>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    {([1, 2, 3] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setPngScale(scale)}
                        className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                          pngScale === scale
                            ? 'bg-purple-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {t(`editor.pngScale${scale}x`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary export action for the selected format */}
          <button
            onClick={() => {
              if (selectedFormat === 'png') onExportPng();
              else if (selectedFormat === 'pdf') onExportPdf();
              else if (selectedFormat === 'svg') onExportSvg();
              else onExportMarkdown();
            }}
            disabled={isBusy}
                        className="w-full flex items-center justify-center bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isBusy ? (
              <Spinner />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
            {t('editor.exportAction')}
          </button>

          {/* Source download (secondary) */}
          <button
            onClick={onDownloadSource}
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            {t('editor.downloadSource')} ({sourceLabel})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDiagramModal;
