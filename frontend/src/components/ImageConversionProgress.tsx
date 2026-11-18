import { useTranslation } from 'react-i18next';
import { CONVERSION_STEPS, conversionHint, diagramTypeName, stepState, type ConversionPhase } from '../utils/imageConversion';

interface ImageConversionProgressProps {
  phase: ConversionPhase;
  /** Upload progress, 0-1 (null until the browser reports it). */
  uploadFraction: number | null;
  /** Seconds since the conversion started. */
  elapsed: number;
  model: string | null;
  diagramType: string;
}

/** The three steps of "diagram from image" while it runs: upload, AI, preview. */
export function ImageConversionProgress({ phase, uploadFraction, elapsed, model, diagramType }: ImageConversionProgressProps) {
  const { t } = useTranslation();
  const hint = t(`imageToDiagram.progress.hints.${conversionHint(elapsed)}`, {
    model: model || t('imageToDiagram.progress.theModel'),
    type: diagramTypeName(diagramType),
  });
  const percent = uploadFraction === null ? null : Math.round(uploadFraction * 100);
  const detail: Record<string, string> = {
    upload: percent === null ? t('imageToDiagram.progress.uploading') : t('imageToDiagram.progress.uploadingPercent', { percent }),
    analyze: hint,
    render: t('imageToDiagram.progress.rendering'),
  };

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-500/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-purple-800 dark:text-purple-200">{t('imageToDiagram.progress.title')}</p>
        <span className="text-xs tabular-nums text-purple-700/80 dark:text-purple-300/80" aria-hidden="true">
          {t('imageToDiagram.progress.elapsed', { seconds: elapsed })}
        </span>
      </div>

      <ol className="space-y-2">
        {CONVERSION_STEPS.map((step) => {
          const state = stepState(step, phase);
          return (
            <li key={step} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center" aria-hidden="true">
                {state === 'done' ? (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : state === 'current' ? (
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 motion-safe:animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    state === 'pending'
                      ? 'text-gray-400 dark:text-gray-500'
                      : state === 'current'
                        ? 'text-gray-900 dark:text-gray-100 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t(`imageToDiagram.progress.steps.${step}`)}
                </p>
                {state === 'current' && (
                  <>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{detail[step]}</p>
                    {step === 'upload' && percent !== null ? (
                      <div className="mt-1.5 h-1 rounded-full bg-purple-100 dark:bg-purple-900/40 overflow-hidden">
                        <div className="h-full bg-purple-600 dark:bg-purple-400 transition-[width] duration-200" style={{ width: `${percent}%` }} />
                      </div>
                    ) : (
                      <div className="mt-1.5 h-1 rounded-full bg-purple-100 dark:bg-purple-900/40 overflow-hidden">
                        <div className="h-full w-2/5 rounded-full bg-purple-600 dark:bg-purple-400 animate-indeterminate-bar" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Screen readers hear each step once, not the ticking seconds. */}
      <p className="sr-only" aria-live="polite">
        {t(`imageToDiagram.progress.steps.${phase === 'done' ? 'render' : phase}`)}. {phase === 'analyze' ? hint : ''}
      </p>
    </div>
  );
}
