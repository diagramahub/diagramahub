import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { renderDiagram } from '../utils/diagramRenderer';
import { sanitizeSvg, escapeHtml } from '../utils/sanitize';
import { MAX_IMAGE_BYTES, modelReadsImages } from '../utils/imageInput';
import { conversionScope, sketchContext } from '../utils/sketchScope';
import { elementsToMermaid } from '../utils/sketchToMermaid';
import type { ConversionPhase } from '../utils/imageConversion';
import { ImageConversionProgress } from './ImageConversionProgress';
import type { FreehandElement } from '../types/freehand';

type Target = 'mermaid' | 'plantuml' | 'd2';
type Method = 'exact' | 'ai';
type ErrorKey = 'tooLarge' | 'notImage' | 'notSupported' | 'truncated' | 'empty' | 'noProvider' | 'generic';

const TARGETS: { id: Target; label: string }[] = [
  { id: 'mermaid', label: 'Mermaid' },
  { id: 'plantuml', label: 'PlantUML' },
  { id: 'd2', label: 'D2' },
];

/** Longest side of the picture sent to the AI: enough to read, well under the 4 MB limit. */
const AI_IMAGE_SIDE = 2000;

interface SketchConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** The whole sketch and the selection when the dialog opened. */
  elements: FreehandElement[];
  selectedIds: string[];
  /** PNG of some elements (`ids`) or of everything (`null`), framed on them. */
  renderPng: (ids: string[] | null, maxSide: number) => Promise<Blob | null>;
  /** AI provider/model used for the conversion (the editor's choice). */
  hasAI: boolean;
  provider: string | null;
  model: string | null;
  /** Create the new diagram (the dialog stays open on failure). */
  onCreate: (code: string, target: Target) => Promise<void>;
}

/**
 * Freehand sketch → diagram: pick the part (selection or whole whiteboard),
 * the target and the method (exact structural reading, or AI from a picture
 * of that part plus its exact texts), check the result, then create it.
 */
export function SketchConversionModal({
  isOpen,
  onClose,
  title,
  elements,
  selectedIds,
  renderPng,
  hasAI,
  provider,
  model,
  onCreate,
}: SketchConversionModalProps) {
  const { t, i18n } = useTranslation();
  const [scope, setScope] = useState<'selection' | 'all'>('all');
  const [target, setTarget] = useState<Target>('mermaid');
  const [method, setMethod] = useState<Method>('exact');
  const [instructions, setInstructions] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ConversionPhase | null>(null);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const panelRef = useDialogA11y(isOpen, onClose, !busy && !creating);

  const readsImages = modelReadsImages(provider, model);
  const aiAvailable = hasAI && readsImages;

  const scoped = useMemo(
    () => conversionScope(elements, scope === 'selection' ? selectedIds : []),
    [elements, selectedIds, scope],
  );
  const exact = useMemo(() => elementsToMermaid(scoped), [scoped]);
  const exactComplete = exact.nodeCount > 0 && Object.keys(exact.skipped).length === 0;
  // Exact when it reads everything (and Mermaid is the target), else AI when there is one
  const recommended: Method = exactComplete && target === 'mermaid' ? 'exact' : aiAvailable ? 'ai' : 'exact';

  // Reset when opened: the selection decides the default scope
  useEffect(() => {
    if (!isOpen) return;
    setScope(selectedIds.length > 0 ? 'selection' : 'all');
    setTarget('mermaid');
    setInstructions('');
    setCode(null);
    setError(null);
    setPhase(null);
  }, [isOpen, selectedIds]);

  // The method follows the recommendation until a result exists
  useEffect(() => {
    if (!code) setMethod(recommended);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the scope or target changes the recommendation
  }, [recommended]);

  // Picture of the part being converted
  useEffect(() => {
    if (!isOpen) return;
    let url: string | null = null;
    let cancelled = false;
    renderPng(scope === 'selection' ? selectedIds : null, 900)
      .then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch(() => setPreviewUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [isOpen, scope, selectedIds, renderPng]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Seconds counter while the AI works
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (phase === 'upload' && uploadFraction === null && elapsed >= 2) setPhase('analyze');
  }, [phase, uploadFraction, elapsed]);

  // Draw the result
  useEffect(() => {
    if (!code || !renderRef.current) return;
    let cancelled = false;
    renderDiagram(code, target).then((result) => {
      if (cancelled || !renderRef.current) return;
      renderRef.current.innerHTML =
        'svg' in result ? sanitizeSvg(result.svg) : `<p class="p-3 text-xs text-amber-600">⚠️ ${escapeHtml(result.error)}</p>`;
      setPhase('done');
    });
    return () => {
      cancelled = true;
    };
  }, [code, target]);

  const leftOut = Object.entries(exact.skipped).map(([reason, count]) => t(`conversion.sketchSkipped.${reason}`, { count }));

  const convertExact = () => {
    // What was left out goes into the code as Mermaid comments, so it stays visible and editable
    const header = [
      `%% ${t('conversion.sketchGenerated', { title })}`,
      ...leftOut.map((line) => `%% ${line}`),
      '',
    ].join('\n');
    setPhase('render');
    setCode(header + exact.code);
  };

  const convertWithAI = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setPhase('upload');
    setUploadFraction(null);
    try {
      const ids = scope === 'selection' ? scoped.map((el) => el.id) : null;
      let image = await renderPng(ids, AI_IMAGE_SIDE);
      if (image && image.size > MAX_IMAGE_BYTES) image = await renderPng(ids, AI_IMAGE_SIDE / 2);
      if (!image) {
        setPhase(null);
        setError(t('sketchConversion.renderError'));
        return;
      }
      const result = await apiService.diagramFromImage({
        image,
        diagramType: target,
        language: i18n.language?.startsWith('en') ? 'en' : 'es',
        instructions: instructions.trim() || undefined,
        provider: provider ?? undefined,
        model: model ?? undefined,
        sketchContext: sketchContext(scoped) || undefined,
        signal: controller.signal,
        onUploadProgress: (fraction) => {
          setUploadFraction(fraction);
          if (fraction >= 1) setPhase('analyze');
        },
      });
      setPhase('render');
      setCode(result.diagram_code);
    } catch (err: unknown) {
      setPhase(null);
      if (controller.signal.aborted) return;
      const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
      const detail = response?.data?.detail as { error?: string } | undefined;
      const map: Record<string, ErrorKey> = {
        image_too_large: 'tooLarge',
        invalid_image: 'notImage',
        images_not_supported: 'notSupported',
        response_truncated: 'truncated',
        empty_response: 'empty',
      };
      const key = (detail?.error && map[detail.error]) || (response?.status === 404 ? 'noProvider' : 'generic');
      setError(t(`imageToDiagram.errors.${key}`));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const create = async () => {
    if (!code) return;
    setCreating(true);
    try {
      await onCreate(code, target);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const exactUsable = target === 'mermaid' && exact.nodeCount > 0;
  const canConvert = scoped.length > 0 && (method === 'exact' ? exactUsable : aiAvailable);
  const optionCls = (active: boolean, disabled = false) =>
    `w-full text-left rounded-lg border p-3 transition-colors ${
      disabled
        ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800'
        : active
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
          : 'border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700'
    }`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sketch-conversion-title"
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-2xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 id="sketch-conversion-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('sketchConversion.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('sketchConversion.subtitle')}</p>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {!code ? (
            <>
              {/* What */}
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sketchConversion.scope')}</legend>
                <div className="flex flex-col sm:flex-row gap-2">
                  {selectedIds.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="radio" name="sketch-scope" checked={scope === 'selection'} onChange={() => setScope('selection')} className="accent-purple-600" />
                      {t('sketchConversion.scopeSelection', { count: conversionScope(elements, selectedIds).length })}
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="radio" name="sketch-scope" checked={scope === 'all'} onChange={() => setScope('all')} className="accent-purple-600" />
                    {t('sketchConversion.scopeAll', { count: elements.length })}
                  </label>
                </div>
                {selectedIds.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('sketchConversion.scopeHint')}</p>}
                {/* Diagram canvases stay light, as in the editor. */}
                <div className="mt-2 bg-white border border-gray-200 dark:border-gray-800 rounded-lg p-2 flex justify-center min-h-[6rem]">
                  {previewUrl ? (
                    <img src={previewUrl} alt={t('sketchConversion.previewAlt')} className="max-h-48 max-w-full object-contain" />
                  ) : (
                    <span className="self-center text-xs text-gray-400">{scoped.length === 0 ? t('sketchConversion.empty') : '…'}</span>
                  )}
                </div>
              </fieldset>

              {/* Into */}
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sketchConversion.target')}</legend>
                <div className="flex gap-1" role="radiogroup" aria-label={t('sketchConversion.target')}>
                  {TARGETS.map((option) => (
                    <button key={option.id} type="button" role="radio" aria-checked={target === option.id} onClick={() => setTarget(option.id)}
                      className={`btn btn-sm ${target === option.id ? 'btn-primary' : 'btn-secondary'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* How */}
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sketchConversion.method')}</legend>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMethod('exact')} disabled={target !== 'mermaid'} aria-pressed={method === 'exact'}
                    className={optionCls(method === 'exact', target !== 'mermaid')}>
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t('sketchConversion.exact')}
                      {recommended === 'exact' && <span className="badge">{t('sketchConversion.recommended')}</span>}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('sketchConversion.exactHint')} {target !== 'mermaid' && t('sketchConversion.exactMermaidOnly')}
                    </span>
                  </button>
                  <button type="button" onClick={() => setMethod('ai')} disabled={!aiAvailable} aria-pressed={method === 'ai'}
                    className={optionCls(method === 'ai', !aiAvailable)}>
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t('sketchConversion.ai')}
                      {recommended === 'ai' && <span className="badge">{t('sketchConversion.recommended')}</span>}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {!hasAI
                        ? t('sketchConversion.aiNoProvider')
                        : !readsImages
                          ? t('imageToDiagram.modelWithoutImages', { model: model || provider || '' })
                          : `${t('sketchConversion.aiHint')} (${model})`}
                    </span>
                  </button>
                </div>

                {/* What the exact reading covers here */}
                {method === 'exact' && target === 'mermaid' && scoped.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {exact.nodeCount > 0 ? (
                      <>
                        <p>{t('sketchConversion.willConvert', { nodes: exact.nodeCount, edges: exact.edgeCount })}</p>
                        {leftOut.length > 0 && <p className="text-amber-700 dark:text-amber-400">{t('sketchConversion.leftOut')} {leftOut.join(' · ')}</p>}
                      </>
                    ) : (
                      <p className="text-amber-700 dark:text-amber-400">{t('sketchConversion.nothingExact')}</p>
                    )}
                  </div>
                )}
              </fieldset>

              {method === 'ai' && (
                <div>
                  <label htmlFor="sketch-instructions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sketchConversion.instructions')}
                  </label>
                  <textarea id="sketch-instructions" rows={2} maxLength={500} value={instructions} disabled={busy}
                    onChange={(e) => setInstructions(e.target.value)} placeholder={t('sketchConversion.instructionsPlaceholder')}
                    className="input h-auto py-2 resize-none" />
                </div>
              )}

              {phase && phase !== 'done' && busy && (
                <ImageConversionProgress phase={phase} uploadFraction={uploadFraction} elapsed={elapsed} model={model} diagramType={target} />
              )}
            </>
          ) : (
            <div className="space-y-2 motion-safe:animate-fade-in">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('sketchConversion.result')}</p>
              {/* Diagram canvases stay light, as in the editor. */}
              <div ref={renderRef}
                className="bg-white border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-80 overflow-auto flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-3 justify-end">
          {code ? (
            <>
              <button type="button" onClick={() => { setCode(null); setPhase(null); }} disabled={creating} className="btn btn-secondary">
                {t('sketchConversion.back')}
              </button>
              <button type="button" onClick={create} disabled={creating} className="btn btn-primary">
                {creating ? t('sketchConversion.creating') : t('sketchConversion.create')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={busy ? () => abortRef.current?.abort() : onClose} className="btn btn-secondary">
                {busy ? t('imageToDiagram.progress.cancel') : t('common.cancel')}
              </button>
              <button type="button" onClick={method === 'exact' ? convertExact : () => void convertWithAI()} disabled={!canConvert || busy} className="btn btn-primary">
                {busy ? t('imageToDiagram.generating') : t('sketchConversion.convert')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
