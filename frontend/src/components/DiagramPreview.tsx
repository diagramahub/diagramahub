import { useEffect, useRef, useState, useCallback } from 'react';
import { renderDiagram } from '../utils/diagramRenderer';
import { sanitizeSvg } from '../utils/sanitize';

interface DiagramPreviewProps {
  code: string;
  diagramType: string;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.2;

export default function DiagramPreview({ code, diagramType }: DiagramPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Reset zoom/pan when code changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [code]);

  useEffect(() => {
    if (!containerRef.current || !code.trim()) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      setRenderError('');
      return;
    }

    const render = async () => {
      if (!containerRef.current) return;
      setRenderError('');
      containerRef.current.innerHTML = '';

      const result = await renderDiagram(code, diagramType);

      if (!containerRef.current) return;

      if ("svg" in result) {
        // Sanitize before injecting: diagram source can be untrusted (shared/imported)
        containerRef.current.innerHTML = sanitizeSvg(result.svg);
      } else {
        setRenderError(result.error);
      }
    };

    const timeout = setTimeout(render, 300);
    return () => clearTimeout(timeout);
  }, [code, diagramType]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(1)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(1)));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(1))));
  }, []);

  // Drag to pan
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

  const zoomPercent = Math.round(zoom * 100);
  const hasContent = code.trim() && !renderError;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg border border-gray-300 overflow-hidden">
      {/* Viewport */}
      <div
        ref={viewportRef}
        className={`flex-1 overflow-hidden relative ${hasContent ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        onWheel={hasContent ? handleWheel : undefined}
        onMouseDown={hasContent ? handleMouseDown : undefined}
        onMouseMove={hasContent ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {renderError ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-amber-600 text-sm text-center p-4">
              <p className="font-medium mb-1">⚠️ Error de sintaxis</p>
              <p className="text-xs text-gray-500">{renderError}</p>
            </div>
          </div>
        ) : !code.trim() ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-gray-400">Sin código para previsualizar</p>
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <div ref={containerRef} />
          </div>
        )}
      </div>

      {/* Zoom controls bar */}
      {hasContent && (
        <div className="flex items-center justify-center gap-1 px-3 py-1.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Alejar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors min-w-[3rem] text-center"
            title="Restablecer zoom"
          >
            {zoomPercent}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Acercar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
