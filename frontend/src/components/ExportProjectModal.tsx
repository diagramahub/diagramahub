import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { type ProjectExportFormat, type ProjectExportSummary, type ProjectExportVariant } from '../services/api';

interface FolderOption {
  id: string;
  name: string;
}

interface ExportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  folders: FolderOption[];
  /** Preselects the "single folder" scope (e.g. opened from a folder's menu). */
  initialFolderId?: string | null;
}

type Scope = 'project' | 'folder';

const radioClass =
  'h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700';
const optionClass =
  'flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors';
const optionIdle = 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40';
const optionActive = 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Export a whole project (or one of its folders) as a ZIP of source files or
 * as a single Markdown document (AI-context or standard variant). Shows what
 * will be downloaded (counts, size, token estimate) before downloading.
 */
export default function ExportProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  folders,
  initialFolderId = null,
}: ExportProjectModalProps) {
  const { t, i18n } = useTranslation();
  const [scope, setScope] = useState<Scope>('project');
  const [folderId, setFolderId] = useState<string>('');
  const [format, setFormat] = useState<ProjectExportFormat>('zip');
  const [variant, setVariant] = useState<ProjectExportVariant>('ai');
  const [descriptions, setDescriptions] = useState(true);
  const [summary, setSummary] = useState<ProjectExportSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Reset to the caller's context each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setScope(initialFolderId ? 'folder' : 'project');
    setFolderId(initialFolderId ?? folders[0]?.id ?? '');
    setFormat('zip');
    setVariant('ai');
    setDescriptions(true);
    setExportError(null);
  }, [isOpen, initialFolderId, folders]);

  const effectiveFolderId = scope === 'folder' ? folderId || null : null;
  const scopeInvalid = scope === 'folder' && !folderId;

  const request = useMemo(
    () => ({ format, variant, descriptions, folderId: effectiveFolderId }),
    [format, variant, descriptions, effectiveFolderId],
  );

  // Live summary of what the current options would download.
  useEffect(() => {
    if (!isOpen || scopeInvalid) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setSummary(null);
    setSummaryError(false);
    api
      .getProjectExportSummary(projectId, request)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setSummaryError(true); });
    return () => { cancelled = true; };
  }, [isOpen, projectId, request, scopeInvalid]);

  const handleExport = useCallback(async () => {
    if (scopeInvalid) return;
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await api.downloadProjectExport(projectId, request);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setExportError(status === 429 ? t('projectExport.tooMany') : t('projectExport.error'));
    } finally {
      setExporting(false);
    }
  }, [projectId, request, scopeInvalid, onClose, t]);

  // Escape closes (unless a download is in progress)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !exporting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, exporting, onClose]);

  if (!isOpen) return null;

  const numberFormat = new Intl.NumberFormat(i18n.language?.startsWith('en') ? 'en-US' : 'es-ES');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="export-project-title">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h3 id="export-project-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('projectExport.title')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            aria-label={t('common.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Scope */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('projectExport.scope')}</legend>
            <div className="space-y-2">
              <label className={`${optionClass} ${scope === 'project' ? optionActive : optionIdle}`}>
                <input type="radio" name="export-scope" className={`${radioClass} mt-0.5`} checked={scope === 'project'} onChange={() => setScope('project')} />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {t('projectExport.scopeProject')}
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectExport.scopeProjectHint')}</span>
                </span>
              </label>
              <label className={`${optionClass} ${scope === 'folder' ? optionActive : optionIdle} ${folders.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input type="radio" name="export-scope" className={`${radioClass} mt-0.5`} checked={scope === 'folder'} disabled={folders.length === 0} onChange={() => setScope('folder')} />
                <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200">
                  {t('projectExport.scopeFolder')}
                  {scope === 'folder' && (
                    <select
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      aria-label={t('projectExport.scopeFolder')}
                      className="mt-2 w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  )}
                  {folders.length === 0 && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectExport.noFolders')}</span>
                  )}
                </span>
              </label>
            </div>
          </fieldset>

          {/* Format */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('projectExport.format')}</legend>
            <div className="space-y-2">
              <label className={`${optionClass} ${format === 'zip' ? optionActive : optionIdle}`}>
                <input type="radio" name="export-format" className={`${radioClass} mt-0.5`} checked={format === 'zip'} onChange={() => setFormat('zip')} />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {t('projectExport.formatZip')}
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectExport.formatZipHint')}</span>
                </span>
              </label>
              <label className={`${optionClass} ${format === 'markdown' ? optionActive : optionIdle}`}>
                <input type="radio" name="export-format" className={`${radioClass} mt-0.5`} checked={format === 'markdown'} onChange={() => setFormat('markdown')} />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">
                  {t('projectExport.formatMarkdown')}
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectExport.formatMarkdownHint')}</span>
                  {format === 'markdown' && (
                    <span className="mt-3 block space-y-1.5" role="radiogroup" aria-label={t('projectExport.variant')}>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="radio" name="export-variant" className={`${radioClass} mt-0.5`} checked={variant === 'ai'} onChange={() => setVariant('ai')} />
                        <span className="text-sm">
                          {t('projectExport.variantAi')}
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectExport.variantAiHint')}</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="radio" name="export-variant" className={`${radioClass} mt-0.5`} checked={variant === 'standard'} onChange={() => setVariant('standard')} />
                        <span className="text-sm">
                          {t('projectExport.variantStandard')}
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectExport.variantStandardHint')}</span>
                        </span>
                      </label>
                    </span>
                  )}
                </span>
              </label>
            </div>
          </fieldset>

          {/* Options */}
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={descriptions}
              onChange={(e) => setDescriptions(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
            />
            {t('projectExport.includeDescriptions')}
          </label>

          {/* Summary */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm" aria-live="polite">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{t('projectExport.summary')}</span>
            {scopeInvalid ? (
              <span className="text-gray-500 dark:text-gray-400">{t('projectExport.noFolders')}</span>
            ) : summaryError ? (
              <span className="text-red-600 dark:text-red-400">{t('projectExport.summaryError')}</span>
            ) : summary ? (
              <span className="text-gray-800 dark:text-gray-200">
                {t('projectExport.summaryLine', {
                  diagrams: summary.diagram_count,
                  folders: summary.folder_count,
                  size: summary.size_is_upper_bound
                    ? t('projectExport.sizeUpTo', { size: formatBytes(summary.size_bytes) })
                    : formatBytes(summary.size_bytes),
                })}
                {summary.estimated_tokens != null && (
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('projectExport.tokens', { tokens: numberFormat.format(summary.estimated_tokens) })}
                  </span>
                )}
                {summary.diagram_count === 0 && (
                  <span className="block text-xs text-amber-600 dark:text-amber-400 mt-0.5">{t('projectExport.empty')}</span>
                )}
              </span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
            )}
          </div>

          {exportError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{exportError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || scopeInvalid || !summary}
            className="bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('projectExport.exporting')}
              </span>
            ) : (
              t('projectExport.export')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
