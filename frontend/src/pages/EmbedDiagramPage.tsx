import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { renderDiagram } from '../utils/diagramRenderer';
import { sanitizeSvg, escapeHtml } from '../utils/sanitize';
import type { SharedDiagram } from '../types/sharing';
import { fitSvgToContainer } from '../utils/fitSvg';
import AccessCodeForm from '../components/AccessCodeForm';
import FreehandCanvas from '../components/FreehandCanvas';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';

type EmbedState =
  | 'loading'
  | 'diagram'
  | 'access_code'
  | 'not_allowed'
  | 'not_found'
  | 'expired'
  | 'gone'
  | 'error';

/**
 * Minimal view of a shared diagram for <iframe> embeds (/embed/:token).
 *
 * Public route outside AuthProvider. Only links whose owner turned on
 * embedding render here; nginx lets this path (and only this one) be framed.
 */
export default function EmbedDiagramPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<EmbedState>('loading');
  const [diagram, setDiagram] = useState<SharedDiagram | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);

  const stateForStatus = (status: number | undefined): EmbedState =>
    status === 404 ? 'not_found' : status === 410 ? 'gone' : 'error';

  const loadPublicDiagram = useCallback(async (linkToken: string) => {
    try {
      setDiagram(await api.getSharedDiagram(linkToken));
      setState('diagram');
    } catch (err: unknown) {
      setState(stateForStatus(apiErrorStatus(err)));
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setState('not_found');
      return;
    }
    const load = async () => {
      try {
        const info = await api.getSharedLinkInfo(token);
        if (!info.allow_embed) setState('not_allowed');
        else if (info.is_expired) setState('expired');
        else if (info.requires_code) setState('access_code');
        else await loadPublicDiagram(token);
      } catch (err: unknown) {
        setState(stateForStatus(apiErrorStatus(err)));
      }
    };
    load();
  }, [token, loadPublicDiagram]);

  const handleVerifyCode = async (code: string) => {
    if (!token) return;
    setVerifying(true);
    setAccessError(null);
    try {
      setDiagram(await api.verifyAccessCode(token, { access_code: code }));
      setState('diagram');
    } catch (err: unknown) {
      const status = apiErrorStatus(err);
      if (status === 403) {
        setAccessError(t('sharedView.wrongCode'));
        const match = (apiErrorMessage(err) || '').match(/Intentos restantes: (\d+)/);
        if (match) setAttemptsRemaining(parseInt(match[1], 10));
      } else if (status === 429) {
        setAttemptsRemaining(0);
        setAccessError(t('sharedView.tooManyAttempts'));
      } else if (status === 410) {
        setState('expired');
      } else if (status === 404) {
        setState('not_found');
      } else {
        setAccessError(t('sharedView.verifyError'));
      }
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (state !== 'diagram' || !diagram || diagram.diagram_type === 'freehand') return;
    const target = diagramRef.current;
    if (!target) return;
    let cancelled = false;
    const type = diagram.diagram_type || 'mermaid';
    renderDiagram(diagram.rendered_content, type)
      .then((result) => {
        if (cancelled || !diagramRef.current) return;
        diagramRef.current.innerHTML =
          'svg' in result
            ? sanitizeSvg(result.svg)
            : `<p class="p-4 text-center text-amber-600">⚠️ ${escapeHtml(result.error)}</p>`;
        fitSvgToContainer(diagramRef.current);
      })
      .catch(() => {
        if (!cancelled && diagramRef.current) {
          diagramRef.current.innerHTML = `<p class="p-4 text-center text-red-500">${escapeHtml(t('diagram.render.error'))}</p>`;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state, diagram, t]);

  const shareUrl = token ? `${window.location.origin}/shared/${token}` : '/';

  if (state === 'access_code') {
    return (
      <AccessCodeForm
        onSubmit={handleVerifyCode}
        error={accessError}
        attemptsRemaining={attemptsRemaining}
        loading={verifying}
      />
    );
  }

  if (state !== 'diagram') {
    const messages: Record<Exclude<EmbedState, 'diagram' | 'access_code'>, string> = {
      loading: t('sharedView.loading'),
      not_allowed: t('embed.notAllowed'),
      not_found: t('sharedView.notFoundMessage'),
      expired: t('sharedView.expiredMessage'),
      gone: t('sharedView.unavailableMessage'),
      error: t('sharedView.errorMessage'),
    };
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-gray-950 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">{messages[state]}</p>
        {state === 'not_allowed' && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
          >
            {t('embed.openInDiagramaHub')}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      <main className="flex-1 min-h-0 relative">
        {diagram?.diagram_type === 'freehand' ? (
          <FreehandCanvas initialState={diagram.rendered_content || diagram.content || ''} readOnly />
        ) : (
          // Diagram canvases stay light, as in the editor and the shared view.
          <div
            ref={diagramRef}
            role="img"
            aria-label={diagram?.title}
            className="w-full h-full flex items-center justify-center p-3 bg-white"
          />
        )}
      </main>
      <footer className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-gray-200 dark:border-gray-800 text-xs">
        <span className="truncate text-gray-600 dark:text-gray-400">{diagram?.title}</span>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 font-medium text-purple-600 dark:text-purple-400 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
        >
          {t('embed.openInDiagramaHub')}
        </a>
      </footer>
    </div>
  );
}
