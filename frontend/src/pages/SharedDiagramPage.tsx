import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import mermaid from 'mermaid';
import plantumlEncoder from 'plantuml-encoder';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { SharedLinkInfo, SharedDiagram } from '../types/sharing';
import AccessCodeForm from '../components/AccessCodeForm';
import CodeEditor from '../components/CodeEditor';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.2;

export default function SharedDiagramPage() {
  const { token } = useParams<{ token: string }>();

  // State
  const [linkInfo, setLinkInfo] = useState<SharedLinkInfo | null>(null);
  const [diagram, setDiagram] = useState<SharedDiagram | null>(null);
  const [pageState, setPageState] = useState<
    'loading' | 'not_found' | 'expired' | 'gone' | 'access_code' | 'diagram' | 'error'
  >('loading');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [descCopied, setDescCopied] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showCodeView, setShowCodeView] = useState(false);

  // Description panel resize state
  const [panelWidth, setPanelWidth] = useState(320);
  const [resizingPanel, setResizingPanel] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const PANEL_MIN_W = 240;
  const PANEL_MAX_W = 600;

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingPanel(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!resizingPanel) return;
    const onMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      const newW = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, resizeStartWidth.current + delta));
      setPanelWidth(newW);
    };
    const onUp = () => setResizingPanel(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizingPanel]);

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Refs
  const diagramRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      securityLevel: 'loose',
    });
  }, []);

  // Fetch link info on mount
  useEffect(() => {
    if (!token) {
      setPageState('not_found');
      return;
    }

    const fetchLinkInfo = async () => {
      try {
        const info = await api.getSharedLinkInfo(token);
        setLinkInfo(info);

        if (info.is_expired) {
          setPageState('expired');
          return;
        }

        if (info.requires_code) {
          setPageState('access_code');
        } else {
          // Public link — fetch diagram directly
          await fetchDiagram();
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
          setPageState('not_found');
        } else if (status === 410) {
          setPageState('gone');
        } else {
          setPageState('error');
        }
      }
    };

    fetchLinkInfo();
  }, [token]);

  const fetchDiagram = async () => {
    if (!token) return;
    try {
      const data = await api.getSharedDiagram(token);
      setDiagram(data);
      setPageState('diagram');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 410) {
        setPageState('gone');
      } else if (status === 404) {
        setPageState('not_found');
      } else {
        setPageState('error');
      }
    }
  };

  const handleVerifyCode = async (code: string) => {
    if (!token) return;
    setVerifying(true);
    setAccessError(null);

    try {
      const data = await api.verifyAccessCode(token, { access_code: code });
      setDiagram(data);
      setPageState('diagram');
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || '';

      if (status === 403) {
        setAccessError('Código de acceso incorrecto');
        // Parse attempts remaining from detail
        const match = detail.match(/Intentos restantes: (\d+)/);
        if (match) {
          setAttemptsRemaining(parseInt(match[1], 10));
        }
      } else if (status === 429) {
        setAttemptsRemaining(0);
        setAccessError('Demasiados intentos');
      } else if (status === 410) {
        setPageState('expired');
      } else if (status === 404) {
        setPageState('not_found');
      } else {
        setAccessError('Error al verificar el código');
      }
    } finally {
      setVerifying(false);
    }
  };

  // Render diagram (Mermaid or PlantUML)
  useEffect(() => {
    if (!diagram || !diagramRef.current) return;

    const renderDiagram = async () => {
      if (!diagramRef.current) return;

      try {
        diagramRef.current.innerHTML = '';
        const type = diagram.diagram_type?.toLowerCase() || 'mermaid';

        if (type === 'plantuml' || type === 'uml') {
          const encoded = plantumlEncoder.encode(diagram.rendered_content);
          const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
          diagramRef.current.innerHTML = `<img src="${url}" alt="PlantUML Diagram" style="max-width:none;" draggable="false" />`;
        } else {
          mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });
          const id = `shared-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          try {
            const { svg } = await mermaid.render(id, diagram.rendered_content);
            diagramRef.current.innerHTML = svg;
          } catch (renderErr) {
            const failedEl = document.getElementById(id);
            if (failedEl) failedEl.remove();
            diagramRef.current.innerHTML = `<div class="text-amber-600 p-4 text-center"><p class="font-medium">⚠️ Error al renderizar el diagrama</p></div>`;
          }
        }
      } catch {
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `<div class="text-red-500 p-4 text-center"><p>Error al renderizar el diagrama</p></div>`;
        }
      }
    };

    renderDiagram();
  }, [diagram]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(1)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(1)));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (!diagramRef.current || !viewportRef.current) return;
    const diagramRect = diagramRef.current.getBoundingClientRect();
    const containerRect = viewportRef.current.getBoundingClientRect();
    const scaleX = (containerRect.width * 0.9) / diagramRect.width;
    const scaleY = (containerRect.height * 0.9) / diagramRect.height;
    const newZoom = Math.min(scaleX, scaleY) * zoom;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)));
    setPan({ x: 0, y: 0 });
  }, [zoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(1))));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Touch handlers for mobile pan
  const touchStart = useRef({ x: 0, y: 0 });
  const touchPanStart = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchPanStart.current = { ...pan };
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setPan({
        x: touchPanStart.current.x + (e.touches[0].clientX - touchStart.current.x),
        y: touchPanStart.current.y + (e.touches[0].clientY - touchStart.current.y),
      });
    }
  }, []);

  const handleCopyCode = async () => {
    if (!diagram?.content) return;
    try {
      await navigator.clipboard.writeText(diagram.content);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleCopyDescription = async () => {
    if (!diagram?.description) return;
    try {
      await navigator.clipboard.writeText(diagram.description);
      setDescCopied(true);
      setTimeout(() => setDescCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const zoomPercent = Math.round(zoom * 100);

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl mb-4">
            <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-gray-600">Cargando diagrama...</p>
        </div>
      </div>
    );
  }

  // 404 - Not found
  if (pageState === 'not_found') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Enlace no encontrado</h1>
          <p className="text-gray-500">
            El enlace que buscas no existe o ya no está disponible. Verifica la URL o solicita un nuevo enlace al propietario del diagrama.
          </p>
        </div>
      </div>
    );
  }

  // Expired
  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Enlace expirado</h1>
          <p className="text-gray-500">
            Este enlace ha expirado y ya no es accesible. Solicita un nuevo enlace al propietario del diagrama.
          </p>
        </div>
      </div>
    );
  }

  // Gone (diagram deleted or link revoked)
  if (pageState === 'gone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Diagrama no disponible</h1>
          <p className="text-gray-500">
            El diagrama ya no está disponible. Es posible que haya sido eliminado por su propietario.
          </p>
        </div>
      </div>
    );
  }

  // Generic error
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error</h1>
          <p className="text-gray-500">
            Ocurrió un error al cargar el diagrama. Intenta de nuevo más tarde.
          </p>
        </div>
      </div>
    );
  }

  // Access code form
  if (pageState === 'access_code') {
    return (
      <AccessCodeForm
        onSubmit={handleVerifyCode}
        error={accessError}
        attemptsRemaining={attemptsRemaining}
        loading={verifying}
      />
    );
  }

  // Diagram view
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-lg font-bold flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7, #9333ea)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            DiagramaHub
          </span>
          <span className="text-gray-300 flex-shrink-0">/</span>
          <span className="text-sm font-medium text-gray-700 truncate">
            {diagram?.title || linkInfo?.diagram_title || 'Diagrama compartido'}
          </span>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Grupo de paneles — estilo editor */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {/* Código button — only if allow_copy_code */}
            {diagram?.allow_copy_code && diagram?.content && (
              <button
                onClick={() => { setShowCodeView(!showCodeView); if (!showCodeView) setShowDescription(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  showCodeView
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span>Código</span>
                </div>
              </button>
            )}
            {/* Descripción button — only if description exists */}
            {diagram?.description && (
              <button
                onClick={() => { setShowDescription(!showDescription); if (!showDescription) setShowCodeView(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  showDescription
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Descripción</span>
                </div>
              </button>
            )}
          </div>

          {/* Separador */}
          <div className="h-6 w-px bg-gray-300"></div>

          {/* Grupo de zoom — estilo editor */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-1 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Reducir zoom"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 text-xs font-mono text-gray-700 min-w-[45px] text-center hover:bg-white rounded transition-colors"
              title="Restablecer zoom"
            >
              {zoomPercent}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-1 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Aumentar zoom"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button
              onClick={handleFitToScreen}
              className="p-1 hover:bg-white rounded transition-colors"
              title="Ajustar a pantalla"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content area: diagram + floating side panel */}
      <div className="flex-1 overflow-hidden relative">
        {/* Diagram viewport */}
        <div
          ref={viewportRef}
          className={`w-full h-full overflow-hidden ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <div ref={diagramRef} className="select-none" />
          </div>
        </div>

        {/* Floating right side panel - Description (markdown) */}
        {showDescription && diagram?.description && (
          <div
            className="absolute top-3 right-3 bottom-3 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col z-10"
            style={{ width: panelWidth }}
          >
            {/* Resize handle (left edge) */}
            <div
              onMouseDown={handleResizeMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-300 active:bg-purple-400 rounded-l-lg transition-colors z-20"
            />
            {/* Panel header */}
            <div className="bg-gray-100 px-4 py-2.5 border-b border-gray-300 flex items-center justify-between flex-shrink-0 rounded-t-lg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-mono text-gray-600">descripción.md</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDescription}
                  className={`p-1.5 rounded transition-colors ${
                    descCopied
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  }`}
                  title={descCopied ? '¡Copiado!' : 'Copiar descripción'}
                >
                  {descCopied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setShowDescription(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1.5 rounded transition-colors"
                  title="Cerrar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Scrollable markdown content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              <div className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-800 prose-a:text-purple-600 prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:rounded">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {diagram.description}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Floating left side panel - Code (read-only) */}
        {showCodeView && diagram?.allow_copy_code && diagram?.content && (
          <div className="absolute top-4 left-4 z-30 w-[32rem] bg-white rounded-lg shadow-xl border border-gray-300 max-h-[calc(100%-5rem)] overflow-hidden flex flex-col">
            {/* Header — same style as editor */}
            <div className="bg-gray-100 px-4 py-2.5 border-b border-gray-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs font-mono text-gray-600">
                  {diagram.diagram_type === 'plantuml' ? 'diagram.puml' : 'diagram.mmd'}
                </span>
                <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">solo lectura</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className={`p-1.5 rounded transition-colors ${
                    codeCopied
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  }`}
                  title={codeCopied ? '¡Copiado!' : 'Copiar código'}
                >
                  {codeCopied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setShowCodeView(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1.5 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Code editor read-only */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={diagram.content}
                onChange={() => {}}
                language={diagram.diagram_type === 'plantuml' ? 'plantuml' : 'mermaid'}
                height="500px"
                readOnly
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer - Status bar similar to editor */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between text-xs">
          {/* Left side info */}
          <div className="flex items-center gap-4">
            {/* Diagram type */}
            <div className="flex items-center gap-1.5 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span>{diagram?.diagram_type === 'plantuml' ? 'PlantUML' : 'Mermaid'}</span>
            </div>

            <div className="h-3 w-px bg-gray-300"></div>

            {/* Zoom */}
            <div className="flex items-center gap-1 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <span>Zoom: {zoomPercent}%</span>
            </div>

            <div className="h-3 w-px bg-gray-300"></div>

            {/* Shared badge */}
            <div className="flex items-center gap-1.5 text-purple-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Vista compartida</span>
            </div>
          </div>

          {/* Right side - Owner name */}
          <div className="flex items-center gap-2">
            {diagram?.owner_name && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Creado por <span className="font-medium text-gray-700">{diagram.owner_name}</span></span>
              </div>
            )}
            <span className="text-xs text-gray-400">•</span>
            <span
              className="text-xs font-semibold"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              DiagramaHub
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
