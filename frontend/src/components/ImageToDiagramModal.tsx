import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { renderDiagram } from '../utils/diagramRenderer';
import { sanitizeSvg, escapeHtml } from '../utils/sanitize';
import { IMAGE_ACCEPT, imageProblem, modelReadsImages } from '../utils/imageInput';
import type { ConversionPhase } from '../utils/imageConversion';
import { ImageConversionProgress } from './ImageConversionProgress';
import type { AIProviderType } from '../types/ai';

interface ImageToDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Target type: the current diagram's type. */
  diagramType: string;
  /** Provider and model selected in the chat (the request uses them). */
  provider: AIProviderType | null;
  model?: string | null;
  /** Whether applying replaces existing code (shown as a warning). */
  replacesCode: boolean;
  onApply: (code: string) => void;
}

type ErrorKey = 'tooLarge' | 'notImage' | 'notSupported' | 'truncated' | 'empty' | 'noProvider' | 'generic';

const primaryButtonClass = 'btn btn-primary';
const secondaryButtonClass = 'btn btn-secondary';

/** Upload a whiteboard photo, screenshot or sketch and turn it into diagram code with AI. */
export function ImageToDiagramModal({
  isOpen,
  onClose,
  diagramType,
  provider,
  model = null,
  replacesCode,
  onApply,
}: ImageToDiagramModalProps) {
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Progress while converting: real upload progress, then the AI's wait (elapsed seconds).
  const [phase, setPhase] = useState<ConversionPhase | null>(null);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const panelRef = useDialogA11y(isOpen, onClose, !generating);
  const readsImages = modelReadsImages(provider, model);

  // Reset when opened; release the preview URL when it changes or closes.
  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setInstructions('');
    setError(null);
    setCode(null);
    setPhase(null);
    setCancelled(false);
  }, [isOpen]);

  // Abort a running conversion when the dialog goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Seconds counter while converting.
  useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [generating]);

  // Some browsers report no upload progress for small files: after a moment the wait is the AI's.
  useEffect(() => {
    if (phase === 'upload' && uploadFraction === null && elapsed >= 2) setPhase('analyze');
  }, [phase, uploadFraction, elapsed]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = useCallback((candidate: File | undefined | null) => {
    if (!candidate) return;
    const problem = imageProblem(candidate);
    setError(problem);
    setCode(null);
    setPhase(null);
    setCancelled(false);
    setFile(problem ? null : candidate);
  }, []);

  // Paste an image from the clipboard while the dialog is open.
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (pasted) pick(pasted);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, pick]);

  useEffect(() => {
    if (!code || !renderRef.current) return;
    let cancelled = false;
    renderDiagram(code, diagramType).then((result) => {
      if (cancelled || !renderRef.current) return;
      renderRef.current.innerHTML =
        'svg' in result ? sanitizeSvg(result.svg) : `<p class="p-3 text-xs text-amber-600">⚠️ ${escapeHtml(result.error)}</p>`;
      setPhase('done');
    });
    return () => {
      cancelled = true;
    };
  }, [code, diagramType]);

  const generate = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setError(null);
    setCode(null);
    setCancelled(false);
    setPhase('upload');
    setUploadFraction(null);
    try {
      const result = await apiService.diagramFromImage({
        image: file,
        diagramType,
        language: i18n.language?.startsWith('en') ? 'en' : 'es',
        instructions: instructions.trim() || undefined,
        provider: provider ?? undefined,
        model: model ?? undefined,
        signal: controller.signal,
        onUploadProgress: (fraction) => {
          setUploadFraction(fraction);
          // Once the image is up, the wait is the AI's.
          if (fraction >= 1) setPhase('analyze');
        },
      });
      setPhase('render');
      setCode(result.diagram_code);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setPhase(null);
        setCancelled(true);
        return;
      }
      setPhase(null);
      const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
      const detail = response?.data?.detail as { error?: string } | undefined;
      const map: Record<string, ErrorKey> = {
        image_too_large: 'tooLarge',
        invalid_image: 'notImage',
        images_not_supported: 'notSupported',
        response_truncated: 'truncated',
        empty_response: 'empty',
      };
      setError((detail?.error && map[detail.error]) || (response?.status === 404 ? 'noProvider' : 'generic'));
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const cancelConversion = () => abortRef.current?.abort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-to-diagram-title"
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-2xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 id="image-to-diagram-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('imageToDiagram.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('imageToDiagram.subtitle')}</p>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {!readsImages && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm">
              {t('imageToDiagram.modelWithoutImages', { model: model || provider || '' })}
            </div>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={generating}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 min-h-[10rem] focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
              dragOver
                ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
            }`}
          >
            {previewUrl ? (
              <span className="relative inline-block max-w-full overflow-hidden rounded">
                <img src={previewUrl} alt={t('imageToDiagram.previewAlt')} className="max-h-48 max-w-full rounded object-contain block" />
                {generating && (
                  // The AI "reading" the picture: a tint and a sweeping line.
                  <span className="absolute inset-0 bg-purple-600/10 dark:bg-purple-400/10" aria-hidden="true">
                    <span className="animate-image-scan absolute inset-x-0 top-[44%] h-[12%] bg-gradient-to-b from-transparent via-purple-500/40 to-transparent">
                      <span className="absolute inset-x-0 top-1/2 h-0.5 bg-purple-500 dark:bg-purple-300 shadow-[0_0_8px_2px_rgba(168,85,247,0.6)]" />
                    </span>
                  </span>
                )}
              </span>
            ) : (
              <>
                <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-300">{t('imageToDiagram.drop')}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('imageToDiagram.formats')}</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          <div>
            <label htmlFor="image-instructions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('imageToDiagram.instructions')}
            </label>
            <textarea
              id="image-instructions"
              rows={2}
              maxLength={500}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={generating}
              placeholder={t('imageToDiagram.instructionsPlaceholder')}
              className="input h-auto py-2 resize-none"
            />
          </div>

          {phase && phase !== 'done' && (
            <ImageConversionProgress phase={phase} uploadFraction={uploadFraction} elapsed={elapsed} model={model} diagramType={diagramType} />
          )}

          {cancelled && <p className="text-sm text-gray-500 dark:text-gray-400">{t('imageToDiagram.progress.cancelled')}</p>}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {t(`imageToDiagram.errors.${error}`)}
            </p>
          )}

          {code && (
            <div className={`space-y-2 ${phase === 'done' ? 'motion-safe:animate-fade-in' : 'invisible h-0 overflow-hidden'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('imageToDiagram.result')}</p>
                <span className="text-xs text-green-700 dark:text-green-400">{t('imageToDiagram.progress.doneIn', { seconds: elapsed })}</span>
              </div>
              {/* Diagram canvases stay light, as in the editor. */}
              <div
                ref={renderRef}
                className="bg-white border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-64 overflow-auto flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
              />
              {replacesCode && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{t('imageToDiagram.replaceWarning')}</p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-3 justify-end">
          <button type="button" onClick={generating ? cancelConversion : onClose} className={secondaryButtonClass}>
            {generating ? t('imageToDiagram.progress.cancel') : t('common.cancel')}
          </button>
          {code ? (
            <button
              type="button"
              onClick={() => {
                onApply(code);
                onClose();
              }}
              className={primaryButtonClass}
            >
              {t('imageToDiagram.apply')}
            </button>
          ) : (
            <button type="button" onClick={generate} disabled={!file || generating || !readsImages} className={primaryButtonClass}>
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 motion-safe:animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('imageToDiagram.generating')}
                </span>
              ) : (
                t('imageToDiagram.generate')
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
