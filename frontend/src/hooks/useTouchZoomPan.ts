import { useCallback, useRef } from 'react';

interface UseTouchZoomPanOptions {
  /** Current zoom level */
  zoom: number;
  /** Current pan position */
  pan: { x: number; y: number };
  /** Callback to set zoom */
  setZoom: (z: number | ((prev: number) => number)) => void;
  /** Callback to set pan */
  setPan: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  /** Min/max zoom bounds */
  minZoom?: number;
  maxZoom?: number;
}

interface TouchState {
  /** Whether a touch gesture is active */
  isActive: boolean;
  /** Starting distance between two fingers (pinch) */
  startDistance: number;
  /** Starting zoom when pinch began */
  startZoom: number;
  /** Starting pan when gesture began */
  startPan: { x: number; y: number };
  /** Midpoint of the two fingers */
  midpoint: { x: number; y: number };
}

/**
 * Adds pinch-to-zoom and single-finger pan to any element.
 *
 * Returns an object of touch event handlers to spread onto the target element.
 * Coexists with mouse-based zoom (wheel) and pan (mousedown/mousemove).
 */
export function useTouchZoomPan({
  zoom,
  pan,
  setZoom,
  setPan,
  minZoom = 0.2,
  maxZoom = 5.0,
}: UseTouchZoomPanOptions) {
  const touchRef = useRef<TouchState>({
    isActive: false,
    startDistance: 0,
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    midpoint: { x: 0, y: 0 },
  });

  const getTouchDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchMidpoint = (touches: TouchList): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;

    if (touches.length === 1) {
      // Single finger — prepare to pan
      touchRef.current = {
        isActive: true,
        startDistance: 0,
        startZoom: zoom,
        startPan: { ...pan },
        midpoint: { x: touches[0].clientX, y: touches[0].clientY },
      };
    } else if (touches.length === 2) {
      // Two fingers — prepare to pinch-zoom
      touchRef.current = {
        isActive: true,
        startDistance: getTouchDistance(touches),
        startZoom: zoom,
        startPan: { ...pan },
        midpoint: getTouchMidpoint(touches),
      };
      e.preventDefault();
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current;
    if (!state.isActive) return;

    const touches = e.touches;

    if (touches.length === 1) {
      // Single finger — pan
      const dx = touches[0].clientX - state.midpoint.x;
      const dy = touches[0].clientY - state.midpoint.y;
      setPan({
        x: state.startPan.x + dx,
        y: state.startPan.y + dy,
      });
    } else if (touches.length === 2) {
      // Two fingers — pinch zoom
      const currentDistance = getTouchDistance(touches);
      const currentMid = getTouchMidpoint(touches);

      if (state.startDistance > 0) {
        const scale = currentDistance / state.startDistance;
        const newZoom = Math.min(maxZoom, Math.max(minZoom, state.startZoom * scale));

        // Zoom toward the midpoint between fingers
        const zoomRatio = newZoom / state.startZoom;
        setPan({
          x: currentMid.x - (currentMid.x - state.startPan.x) * zoomRatio,
          y: currentMid.y - (currentMid.y - state.startPan.y) * zoomRatio,
        });
        setZoom(newZoom);
      }
      e.preventDefault();
    }
  }, [setZoom, setPan, minZoom, maxZoom]);

  const handleTouchEnd = useCallback(() => {
    touchRef.current.isActive = false;
  }, []);

  const handleTouchCancel = useCallback(() => {
    touchRef.current.isActive = false;
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}
