import { useDialogA11y } from '../hooks/useDialogA11y';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { retryAfterSeconds } from '../utils/download';
import api, { type ProjectImportPreview, type ProjectImportResult } from '../services/api';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** Destination folder (null = project root). */
  folderId: string | null;
  folderName?: string | null;
  /** Files handed over by a drag & drop; otherwise the user picks them here. */
  initialFiles?: File[] | null;
  onImported: (result: ProjectImportResult) => void;
}

const ACCEPT = '.mmd,.mermaid,.puml,.plantuml,.pu,.iuml,.d2,.dbml,.json,.excalidraw,.md,.markdown,.txt,.zip';

const TYPE_BADGES: Record<string, string> = {
  mermaid: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  plantuml: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  d2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  dbml: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  freehand: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};
const TYPE_LABELS: Record<string, string> = { mermaid: 'MMD', plantuml: 'PUML', d2: 'D2', dbml: 'DBML', freehand: 'DRAW' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Step = 'pick' | 'preview' | 'importing';

/**
 * Import diagrams into a project: loose files, Diagramahub/any ZIP archives or
 * Excalidraw drawings. Always previews first (dry run) — folders, diagrams,
 * skipped files and the plan quota — and only creates on confirmation.
 */
export default function ImportProjectModal({
  isOpen,
  onClose,
  projectId,
  folderId,
  folderName = null,
  initialFiles = null,
  onImported,
}: ImportProjectModalProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>('pick');
  const [preview, setPreview] = useState<ProjectImportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Fresh state each time it opens; dropped files go straight to the preview.
  useEffect(() => {
    if (!isOpen) return;
    setFiles(initialFiles ?? []);
    setStep('pick');
    setPreview(null);
    setError(null);
    setDragging(false);
    // A preview cancelled by closing the dialog never reaches its `finally`
    setLoadingPreview(false);
  }, [isOpen, initialFiles]);

  const describeError = useCallback((err: unknown): string => {
    const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
    const detail = response?.data?.detail as { error?: string; reason?: string; file?: string; limit?: number; current_usage?: number } | string | undefined;
    if (response?.status === 413) return t('projectImport.errors.tooLarge');
    if (response?.status === 429) {
      const seconds = retryAfterSeconds(err);
      return seconds ? t('projectImport.errors.tooManyRetry', { seconds }) : t('projectImport.errors.tooMany');
    }
    if (typeof detail === 'object' && detail?.error === 'import_failed') {
      // Nothing (or not everything) could be undone: say which
      return detail && (detail as { rolled_back?: boolean }).rolled_back === false
        ? t('projectImport.errors.importFailedPartial')
        : t('projectImport.errors.importFailed');
    }
    if (typeof detail === 'object' && detail?.error === 'resource_limit_exceeded') {
      return t('projectImport.errors.quota', { current: detail.current_usage, limit: detail.limit });
    }
    if (typeof detail === 'object' && detail?.error === 'invalid_upload') {
      return t('projectImport.errors.invalidUpload', { file: detail.file, reason: t(`projectImport.reasons.${detail.reason}`, { defaultValue: detail.reason }) });
    }
    if (typeof detail === 'object' && detail?.error === 'nothing_to_import') return t('projectImport.errors.nothing');
    return t('projectImport.errors.generic');
  }, [t]);

  // Preview whenever the file list changes.
  useEffect(() => {
    if (!isOpen || files.length === 0) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setError(null);
    api
      .previewProjectImport(projectId, files, folderId)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setStep('preview');
      })
      .catch((err) => {
        if (cancelled) return;
        setPreview(null);
        setError(describeError(err));
      })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [isOpen, files, projectId, folderId, describeError]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleImport = async () => {
    if (!preview || !preview.allowed || preview.diagram_count === 0) return;
    setStep('importing');
    setError(null);
    try {
      const result = await api.runProjectImport(projectId, files, folderId);
      onImported(result);
      onClose();
    } catch (err) {
      setError(describeError(err));
      setStep('preview');
    }
  };

  // Escape (not while importing), initial focus, focus trap, focus restore
  const panelRef = useDialogA11y(isOpen, onClose, step !== 'importing');

  if (!isOpen) return null;

  const busy = step === 'importing';
  const canImport = !!preview && preview.allowed && preview.diagram_count > 0 && !busy && !loadingPreview;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="import-project-title">
      <div ref={panelRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h3 id="import-project-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('projectImport.title')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {folderName ? t('projectImport.intoFolder', { folder: folderName }) : t('projectImport.intoRoot')}
            </p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label={t('common.close')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone / picker */}
          <div
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) addFiles(e.dataTransfer.files); }}
            className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <svg className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-gray-700 dark:text-gray-300">{t('projectImport.dropHere')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('projectImport.accepted')}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {t('projectImport.chooseFiles')}
            </button>
            <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} aria-label={t('projectImport.chooseFiles')} />
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm max-h-32 overflow-y-auto" aria-label={t('projectImport.selectedFiles')}>
              {files.map((file, index) => (
                <li key={`${file.name}:${file.size}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="truncate text-gray-800 dark:text-gray-200">{file.name}</span>
                  <span className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {formatBytes(file.size)}
                    <button onClick={() => removeFile(index)} disabled={busy} aria-label={t('projectImport.removeFile', { file: file.name })} className="p-0.5 rounded text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Preview */}
          {(loadingPreview || preview) && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm space-y-2" aria-live="polite">
              <span className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('projectImport.preview')}</span>
              {loadingPreview || !preview ? (
                <span className="text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
              ) : (
                <>
                  <p className="text-gray-800 dark:text-gray-200">
                    {t('projectImport.willCreate', { diagrams: preview.diagram_count, folders: preview.folder_count })}
                    {preview.folders.length > 0 && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{t('projectImport.foldersList', { folders: preview.folders.join(', ') })}</span>
                    )}
                  </p>
                  {preview.diagrams.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto space-y-1" aria-label={t('projectImport.diagramsList')}>
                      {preview.diagrams.map((d) => (
                        <li key={d.source} className="flex items-center gap-2 text-xs">
                          <span className={`w-9 text-center rounded text-[9px] font-bold leading-4 flex-shrink-0 ${TYPE_BADGES[d.diagram_type] ?? 'bg-gray-100 text-gray-600'}`}>{TYPE_LABELS[d.diagram_type] ?? d.diagram_type}</span>
                          <span className="truncate text-gray-800 dark:text-gray-200" title={d.source}>{d.folder ? `${d.folder}/` : ''}{d.title}</span>
                          {d.has_description && <span className="text-gray-400 flex-shrink-0">{t('projectImport.withDescription')}</span>}
                          {d.warnings.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 flex-shrink-0" title={d.warnings.join(', ')}>
                              {t('projectImport.partial')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview.skipped.length > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400">
                      <span className="font-medium">{t('projectImport.skipped', { count: preview.skipped.length })}</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {preview.skipped.map((s) => (
                          <li key={s.source} className="truncate">
                            {s.source} — {t(`projectImport.reasons.${s.reason}`, { defaultValue: s.reason })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className={`text-xs ${preview.allowed ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400 font-medium'}`}>
                    {preview.limit == null
                      ? t('projectImport.quotaUnlimited', { current: preview.current_usage })
                      : preview.allowed
                        ? t('projectImport.quotaOk', { after: preview.current_usage + preview.diagram_count, limit: preview.limit })
                        : t('projectImport.errors.quota', { current: preview.current_usage + preview.diagram_count, limit: preview.limit })}
                  </p>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex gap-3 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleImport} disabled={!canImport} className="bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
            {busy ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('projectImport.importing')}
              </span>
            ) : (
              preview && preview.diagram_count > 0
                ? t('projectImport.importCount', { count: preview.diagram_count })
                : t('projectImport.import')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
