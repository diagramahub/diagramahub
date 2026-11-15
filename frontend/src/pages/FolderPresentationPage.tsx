import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiService from '../services/api';
import type { Diagram, ProjectWithDiagrams } from '../types/project';
import { renderDiagram } from '../utils/diagramRenderer';
import { sanitizeSvg, escapeHtml } from '../utils/sanitize';
import FreehandCanvas from '../components/FreehandCanvas';
import { presentationSlides } from '../utils/presentation';
import { fitSvgToContainer } from '../utils/fitSvg';

/**
 * Full-screen presentation of a folder (or the whole project): one diagram per
 * slide, navigated with the arrow keys. /projects/:projectId/present?folder=<id>
 */
export default function FolderPresentationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folder');
  const startId = searchParams.get('start');

  const [project, setProject] = useState<ProjectWithDiagrams | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;
    apiService
      .getProject(projectId)
      .then(setProject)
      .catch(() => setLoadError(true));
  }, [projectId]);

  const { slides, title } = useMemo(
    () => (project ? presentationSlides(project, folderId) : { slides: [] as Diagram[], title: '' }),
    [project, folderId],
  );

  // Start at ?start=<diagramId> when given.
  useEffect(() => {
    if (!startId || slides.length === 0) return;
    const found = slides.findIndex((d) => d.id === startId);
    if (found >= 0) setIndex(found);
  }, [startId, slides]);

  const current: Diagram | undefined = slides[index];
  const exitTo = projectId ? `/projects/${projectId}${current ? `/diagrams/${current.id}` : ''}` : '/';

  const go = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(slides.length - 1, next))),
    [slides.length],
  );

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    navigate(exitTo);
  }, [navigate, exitTo]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          go(index + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          go(index - 1);
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(slides.length - 1);
          break;
        case 'n':
        case 'N':
          setShowNotes((v) => !v);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'Escape':
          // In browser full screen, Escape only leaves full screen.
          if (!document.fullscreenElement) exit();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go, index, slides.length, exit, toggleFullscreen]);

  // Render the current text-based diagram.
  useEffect(() => {
    if (!current || current.diagram_type === 'freehand' || !slideRef.current) return;
    let cancelled = false;
    slideRef.current.innerHTML = '';
    renderDiagram(current.content, current.diagram_type || 'mermaid')
      .then((result) => {
        if (cancelled || !slideRef.current) return;
        slideRef.current.innerHTML =
          'svg' in result
            ? sanitizeSvg(result.svg)
            : `<p class="p-4 text-center text-amber-600">⚠️ ${escapeHtml(result.error)}</p>`;
        fitSvgToContainer(slideRef.current);
      })
      .catch(() => {
        if (!cancelled && slideRef.current) {
          slideRef.current.innerHTML = `<p class="p-4 text-center text-red-500">${escapeHtml(t('diagram.render.error'))}</p>`;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [current, t]);

  const controlClass =
    'p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

  if (loadError || (project && slides.length === 0)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-950 text-gray-300 p-4 text-center">
        <p>{loadError ? t('presentation.loadError') : t('presentation.empty')}</p>
        <button
          type="button"
          onClick={() => navigate(projectId ? `/projects/${projectId}` : '/')}
          className="px-6 py-3 border border-gray-600 rounded-lg font-semibold text-gray-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
        >
          {t('presentation.back')}
        </button>
      </div>
    );
  }

  if (!project || !current) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-400">{t('common.loading')}</div>
    );
  }

  return (
    <div ref={rootRef} className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-400 truncate">{title || project.name}</p>
          <h1 className="text-sm font-semibold truncate">{current.title}</h1>
        </div>
        <span className="text-xs tabular-nums text-gray-400" aria-live="polite">
          {t('presentation.counter', { current: index + 1, total: slides.length })}
        </span>
        {current.description && (
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            aria-pressed={showNotes}
            aria-label={t('presentation.notes')}
            title={`${t('presentation.notes')} (N)`}
            className={controlClass}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? t('presentation.exitFullscreen') : t('presentation.fullscreen')}
          title={`${isFullscreen ? t('presentation.exitFullscreen') : t('presentation.fullscreen')} (F)`}
          className={controlClass}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={exit}
          aria-label={t('presentation.exit')}
          title={`${t('presentation.exit')} (Esc)`}
          className={controlClass}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 relative flex items-center justify-center p-6">
          {/* Diagram canvases stay light, as in the editor. */}
          <div className="w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden">
            {current.diagram_type === 'freehand' ? (
              <FreehandCanvas key={current.id} initialState={current.content} readOnly />
            ) : (
              <div
                ref={slideRef}
                role="img"
                aria-label={current.title}
                className="w-full h-full flex items-center justify-center p-6"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label={t('presentation.previous')}
            className={`absolute left-2 top-1/2 -translate-y-1/2 ${controlClass}`}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === slides.length - 1}
            aria-label={t('presentation.next')}
            className={`absolute right-2 top-1/2 -translate-y-1/2 ${controlClass}`}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </main>
        {showNotes && current.description && (
          <aside
            aria-label={t('presentation.notes')}
            className="w-80 flex-shrink-0 border-l border-white/10 overflow-y-auto p-4 prose prose-sm prose-invert max-w-none"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.description}</ReactMarkdown>
          </aside>
        )}
      </div>

      <footer className="h-1 bg-white/10" aria-hidden="true">
        <div
          className="h-full bg-purple-500 transition-all"
          style={{ width: `${((index + 1) / slides.length) * 100}%` }}
        />
      </footer>
    </div>
  );
}
