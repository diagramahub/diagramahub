import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iframeSnippet } from '../utils/embed';

interface ShareEmbedAndQrProps {
  /** Public URL of the shared link (…/shared/<token>). */
  shareUrl: string;
  /** Whether the owner allows embedding; the iframe snippet is shown only then. */
  allowEmbed: boolean;
  /** Turns embedding on/off for the existing link. */
  onToggleEmbed: () => void;
  togglingEmbed: boolean;
  /** Base name for the downloaded QR image. */
  fileName: string;
}

/**
 * Embed (iframe snippet) and QR code sections of the share dialog, for a link
 * that already exists.
 */
export function ShareEmbedAndQr({
  shareUrl,
  allowEmbed,
  onToggleEmbed,
  togglingEmbed,
  fileName,
}: ShareEmbedAndQrProps) {
  const { t } = useTranslation();
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const snippet = iframeSnippet(shareUrl, fileName);

  useEffect(() => {
    if (!showQr || qrDataUrl) return;
    let cancelled = false;
    // Loaded on demand: the QR encoder is only needed when the user asks for it.
    import('qrcode')
      .then(({ toDataURL }) => toDataURL(shareUrl, { width: 512, margin: 2, errorCorrectionLevel: 'M' }))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [showQr, qrDataUrl, shareUrl]);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
    } catch {
      /* clipboard blocked: the snippet stays selectable in the textarea */
    }
  };

  return (
    <div className="space-y-4">
      {/* Embed */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label htmlFor="allow-embed-existing" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('sharing.allowEmbed')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('sharing.allowEmbedDesc')}</p>
          </div>
          <button
            id="allow-embed-existing"
            type="button"
            role="switch"
            aria-checked={allowEmbed}
            disabled={togglingEmbed}
            onClick={onToggleEmbed}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 ${
              allowEmbed ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                allowEmbed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {allowEmbed && (
          <div>
            <label htmlFor="embed-snippet" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('sharing.embedCode')}
            </label>
            <textarea
              id="embed-snippet"
              readOnly
              rows={3}
              value={snippet}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={copySnippet}
              className="btn btn-secondary mt-2"
            >
              {snippetCopied ? t('sharing.copied') : t('sharing.copyEmbedCode')}
            </button>
          </div>
        )}
      </div>

      {/* QR code */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('sharing.qrTitle')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('sharing.qrDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            aria-expanded={showQr}
            className="flex-shrink-0 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
          >
            {showQr ? t('sharing.qrHide') : t('sharing.qrShow')}
          </button>
        </div>
        {showQr && (
          <div className="mt-3 flex flex-col items-center gap-2">
            {qrError && <p className="text-sm text-red-600 dark:text-red-400">{t('sharing.qrError')}</p>}
            {!qrError && !qrDataUrl && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            )}
            {qrDataUrl && (
              <>
                {/* White background so the code stays scannable in dark mode */}
                <img src={qrDataUrl} alt={t('sharing.qrAlt')} className="w-44 h-44 rounded-md bg-white p-1" />
                <a
                  href={qrDataUrl}
                  download={`${fileName || 'diagram'}-qr.png`}
                  className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                >
                  {t('sharing.qrDownload')}
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
