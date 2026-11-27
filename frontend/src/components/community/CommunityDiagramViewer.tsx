import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNonPassiveWheel } from '../../hooks/useNonPassiveWheel';
import { sanitizeSvg } from '../../utils/sanitize';
import { loadCommunitySvg } from './svgCache';

interface CommunityDiagramViewerProps {
  cacheKey: string;
  content: string;
  diagramType: string;
  title: string;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const PADDING = 24;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Interactive viewer for a published diagram: fits large diagrams on load, then
 * zoom (buttons, keys, Ctrl/⌘ + wheel or pinch; plain wheel in full screen),
 * drag to pan, double-click to fit, and full screen.
 */
export function CommunityDiagramViewer({ cacheKey, content, diagramType, title }: CommunityDiagramViewerProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<{ width: number; height: number } | null>(null);
  const movedRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    const size = sizeRef.current;
    if (!stage || !size) return;
    const width = stage.clientWidth - PADDING * 2;
    const height = stage.clientHeight - PADDING * 2;
    const scale = clamp(Math.min(width / size.width, height / size.height, 2), MIN_SCALE, MAX_SCALE);
    movedRef.current = false;
    setView({
      scale,
      x: (stage.clientWidth - size.width * scale) / 2,
      y: (stage.clientHeight - size.height * scale) / 2,
    });
  }, []);

  // Render (cached) and size the SVG at its natural dimensions.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadCommunitySvg(cacheKey, content, diagramType).then((svg) => {
      const host = contentRef.current;
      if (cancelled || !host) return;
      if (!svg) {
        setStatus('error');
        return;
      }
      host.innerHTML = sanitizeSvg(svg);
      const element = host.querySelector('svg');
      if (!element) {
        setStatus('error');
        return;
      }
      const box = element.viewBox?.baseVal;
      const width = box && box.width ? box.width : parseFloat(element.getAttribute('width') || '') || element.getBoundingClientRect().width;
      const height = box && box.height ? box.height : parseFloat(element.getAttribute('height') || '') || element.getBoundingClientRect().height;
      element.removeAttribute('width');
      element.removeAttribute('height');
      element.style.maxWidth = 'none';
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.display = 'block';
      sizeRef.current = { width, height };
      setStatus('ready');
      fit();
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, content, diagramType, fit]);

  // Keep the diagram fitted when the frame changes size, unless the user moved it.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!movedRef.current) fit();
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === frameRef.current);
      window.setTimeout(fit, 50);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [fit]);

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const px = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const py = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    movedRef.current = true;
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = scale / current.scale;
      return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }, []);

  // Plain wheel scrolls the page; Ctrl/⌘ + wheel (and trackpad pinch) zooms. In full screen the wheel zooms.
  useNonPassiveWheel(
    stageRef,
    status === 'ready'
      ? (event) => {
          if (!fullscreen && !event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
        }
      : null,
    status,
  );

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || status !== 'ready') return;
    dragRef.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    movedRef.current = true;
    setView((current) => ({ ...current, x: drag.viewX + event.clientX - drag.x, y: drag.viewY + event.clientY - drag.y }));
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 40;
    const pan = (dx: number, dy: number) => {
      movedRef.current = true;
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    };
    const actions: Record<string, () => void> = {
      '+': () => zoomAt(1.2),
      '=': () => zoomAt(1.2),
      '-': () => zoomAt(1 / 1.2),
      '0': fit,
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frameRef.current?.requestFullscreen();
    } catch {
      /* full screen not allowed (iframe, browser setting) */
    }
  };

  const iconButton =
    'inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white';

  return (
    <div
      ref={frameRef}
      className={`flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${
        fullscreen ? 'h-screen w-screen' : 'h-[55vh] sm:h-[min(70vh,720px)] min-h-[18rem] rounded-lg'
      }`}
    >
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 px-2 h-10 flex-shrink-0">
        <p className="hidden sm:block flex-1 truncate px-1 text-xs text-gray-500 dark:text-gray-400">
          {fullscreen ? t('community.viewer.hintFullscreen') : t('community.viewer.hint')}
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => zoomAt(1 / 1.2)} disabled={status !== 'ready'} className={iconButton} aria-label={t('community.viewer.zoomOut')} title={t('community.viewer.zoomOut')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth={2} d="M5 12h14" /></svg>
          </button>
          <button type="button" onClick={fit} disabled={status !== 'ready'} className="h-7 min-w-[3.25rem] rounded px-1.5 text-xs font-medium tabular-nums text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 dark:text-gray-300 dark:hover:bg-gray-800" title={t('community.viewer.fit')}>
            {Math.round(view.scale * 100)}%
          </button>
          <button type="button" onClick={() => zoomAt(1.2)} disabled={status !== 'ready'} className={iconButton} aria-label={t('community.viewer.zoomIn')} title={t('community.viewer.zoomIn')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth={2} d="M12 5v14M5 12h14" /></svg>
          </button>
          <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
          <button type="button" onClick={fit} disabled={status !== 'ready'} className={iconButton} aria-label={t('community.viewer.fit')} title={t('community.viewer.fit')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>
          </button>
          <button type="button" onClick={toggleFullscreen} className={iconButton} aria-label={fullscreen ? t('community.viewer.exitFullscreen') : t('community.viewer.fullscreen')} title={fullscreen ? t('community.viewer.exitFullscreen') : t('community.viewer.fullscreen')}>
            {fullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Diagram canvases stay light, as in the editor. */}
      <div
        ref={stageRef}
        role="img"
        aria-label={`${t('community.viewer.label')}: ${title}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={fit}
        className={`relative flex-1 min-h-0 overflow-hidden bg-white touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/50 ${
          status === 'ready' ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
        {status === 'loading' && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">{t('common.loading')}</p>
        )}
        {status === 'error' && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-amber-600">{t('community.previewError')}</p>
        )}
      </div>
    </div>
  );
}
