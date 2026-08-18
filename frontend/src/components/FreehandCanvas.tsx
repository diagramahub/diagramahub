/**
 * Freehand/Whiteboard canvas editor.
 * Inspired by Excalidraw's interaction model:
 * - selectedIds (Set) is the single source of truth for selection
 * - Click = select one, Shift+Click = toggle, Drag empty = marquee
 * - Draw shape → auto-select it, switch to select tool
 * - Floating style panel appears when elements are selected
 * - HiDPI canvas rendering
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type {
  FreehandCanvasState,
  FreehandElement,
  FreehandTool,
  FreehandPoint,
  ConnectionBinding,
} from "../types/freehand";
import {
  DEFAULT_CANVAS_STATE,
  FREEHAND_COLORS,
  FREEHAND_STROKE_WIDTHS,
} from "../types/freehand";

// ─── Utilities ───

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function parseCanvasState(json: string): FreehandCanvasState {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.version === 1 && Array.isArray(parsed.elements)) return parsed;
  } catch { /* ignore */ }
  return { ...DEFAULT_CANVAS_STATE };
}

function getAnchorPoint(el: FreehandElement, side: ConnectionBinding["anchorSide"]): FreehandPoint {
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  switch (side) {
    case "top": return { x: cx, y: el.y };
    case "bottom": return { x: cx, y: el.y + el.height };
    case "left": return { x: el.x, y: cy };
    case "right": return { x: el.x + el.width, y: cy };
    default: return { x: cx, y: cy };
  }
}

function closestAnchorSide(el: FreehandElement, point: FreehandPoint): ConnectionBinding["anchorSide"] {
  const sides: ConnectionBinding["anchorSide"][] = ["top", "bottom", "left", "right"];
  let best: ConnectionBinding["anchorSide"] = "center";
  let bestDist = Infinity;
  for (const side of sides) {
    const a = getAnchorPoint(el, side);
    const d = Math.hypot(a.x - point.x, a.y - point.y);
    if (d < bestDist) { bestDist = d; best = side; }
  }
  return best;
}

function hitTest(pos: FreehandPoint, el: FreehandElement): boolean {
  // For arrows/lines, test distance to the line segment (not bounding box)
  if ((el.type === "arrow" || el.type === "line") && el.points && el.points.length >= 2) {
    const threshold = Math.max(el.strokeWidth || 2, 6) + 4;
    for (let i = 0; i < el.points.length - 1; i++) {
      const a = el.points[i], b = el.points[i + 1];
      const dist = distToSegment(pos, a, b);
      if (dist <= threshold) return true;
    }
    return false;
  }
  const pad = 4;
  return pos.x >= el.x - pad && pos.x <= el.x + el.width + pad &&
         pos.y >= el.y - pad && pos.y <= el.y + el.height + pad;
}

/** Distance from point to line segment. */
function distToSegment(p: FreehandPoint, a: FreehandPoint, b: FreehandPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isShape(el: FreehandElement): boolean {
  return ["rectangle", "diamond", "ellipse"].includes(el.type);
}

// Cached offscreen context for text measurement (avoids creating a canvas per keystroke)
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  return measureCtx;
}

function measureTextWidth(text: string, fontSize: number, fontFamily?: string): number {
  if (!text) return 0;
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontSize}px ${fontFamily || "sans-serif"}`;
  let w = 0;
  for (const line of text.split("\n")) w = Math.max(w, ctx.measureText(line).width);
  return w;
}

/** Rounded-rectangle path (ctx.roundRect is not available everywhere). */
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Returns a copy of el shifted by (dx, dy), including its points. */
function shiftElement(el: FreehandElement, dx: number, dy: number): FreehandElement {
  if (dx === 0 && dy === 0) return el;
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
    points: el.points ? el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) : undefined,
  };
}

/** Recomputes arrow/line endpoints bound to any element in movedIds (honors rotation). */
function updateBoundArrows(els: FreehandElement[], movedIds: Set<string>): FreehandElement[] {
  return els.map((e) => {
    if (e.type !== "arrow" && e.type !== "line") return e;
    if (movedIds.has(e.id)) return e; // the arrow itself moved
    let changed = false;
    const pts = [...(e.points || [])];
    if (e.startBinding && movedIds.has(e.startBinding.elementId)) {
      const t = els.find((x) => x.id === e.startBinding!.elementId);
      if (t) { pts[0] = getRotatedAnchor(t, e.startBinding!.anchorSide); changed = true; }
    }
    if (e.endBinding && movedIds.has(e.endBinding.elementId)) {
      const t = els.find((x) => x.id === e.endBinding!.elementId);
      if (t) { pts[pts.length - 1] = getRotatedAnchor(t, e.endBinding!.anchorSide); changed = true; }
    }
    if (!changed) return e;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { ...e, points: pts, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 };
  });
}

// ─── Rotation helpers ───
function rotatePoint(p: FreehandPoint, cx: number, cy: number, rad: number): FreehandPoint {
  return {
    x: cx + (p.x - cx) * Math.cos(rad) - (p.y - cy) * Math.sin(rad),
    y: cy + (p.x - cx) * Math.sin(rad) + (p.y - cy) * Math.cos(rad),
  };
}

/** Anchor point honoring the element's rotation (used for arrow bindings). */
function getRotatedAnchor(el: FreehandElement, side: ConnectionBinding["anchorSide"]): FreehandPoint {
  const pt = getAnchorPoint(el, side);
  if (!el.rotation) return pt;
  const rad = (el.rotation * Math.PI) / 180;
  return rotatePoint(pt, el.x + el.width / 2, el.y + el.height / 2, rad);
}

// ─── Alignment guides (Miro-style red lines) ───
export interface AlignGuide {
  axis: "v" | "h";
  pos: number; // world coordinate of the guide line
}

interface AlignResult {
  dx: number;
  dy: number;
  guides: AlignGuide[];
}

function guidesEqual(a: AlignGuide[], b: AlignGuide[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((g, i) => g.axis === b[i].axis && g.pos === b[i].pos);
}

const GUIDE_THRESHOLD = 5; // world units

/**
 * Finds alignment matches between a live bounding box and every other element.
 * Returns the correction delta (dx/dy) to apply and the guides to draw.
 */
function computeAlignGuides(bbox: { x: number; y: number; width: number; height: number }, elements: FreehandElement[], excludeIds: Set<string>): AlignResult {
  const myX = [bbox.x, bbox.x + bbox.width / 2, bbox.x + bbox.width];
  const myY = [bbox.y, bbox.y + bbox.height / 2, bbox.y + bbox.height];
  let bestDx: { d: number; ref: number } | null = null;
  let bestDy: { d: number; ref: number } | null = null;

  for (const el of elements) {
    if (excludeIds.has(el.id)) continue;
    const tx = [el.x, el.x + el.width / 2, el.x + el.width];
    const ty = [el.y, el.y + el.height / 2, el.y + el.height];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const dx = tx[j] - myX[i];
        if (Math.abs(dx) <= GUIDE_THRESHOLD && (!bestDx || Math.abs(dx) < Math.abs(bestDx.d))) bestDx = { d: dx, ref: tx[j] };
        const dy = ty[j] - myY[i];
        if (Math.abs(dy) <= GUIDE_THRESHOLD && (!bestDy || Math.abs(dy) < Math.abs(bestDy.d))) bestDy = { d: dy, ref: ty[j] };
      }
    }
  }

  const guides: AlignGuide[] = [];
  if (bestDx) {
    guides.push({ axis: "v", pos: bbox.x + bestDx.d });
  }
  if (bestDy) {
    guides.push({ axis: "h", pos: bbox.y + bestDy.d });
  }
  return { dx: bestDx?.d ?? 0, dy: bestDy?.d ?? 0, guides };
}

interface FreehandCanvasProps {
  initialState: string;
  onChange?: (state: string) => void;
  /** Zoom level controlled by the parent editor toolbar. */
  zoom?: number;
  /** Called when the canvas requests a zoom change (Ctrl+scroll). */
  onZoomChange?: (zoom: number) => void;
  /** Read-only mode: hides toolbar and disables editing (pan/zoom still work). */
  readOnly?: boolean;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type InteractionMode = "idle" | "drawing" | "dragging" | "resizing" | "marquee" | "endpoint" | "erasing" | "rotating";

export default function FreehandCanvas({ initialState, onChange, zoom = 1, onZoomChange, readOnly = false }: FreehandCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Undo/redo history (declared before elements so the initializer can seed it)
  const historyRef = useRef<FreehandElement[][]>([]);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(false);
  // Last JSON we emitted — used to tell our own updates apart from external content loads
  const lastEmittedRef = useRef(initialState);

  // Core state
  const [elements, setElements] = useState<FreehandElement[]>(() => {
    const els = parseCanvasState(initialState).elements;
    historyRef.current = [els];
    historyIndexRef.current = 0;
    return els;
  });
  const [background] = useState("#ffffff");
  const [activeTool, setActiveTool] = useState<FreehandTool>("select");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Drawing defaults (also used for style editing)
  const [strokeColor, setStrokeColor] = useState("#1e1e1e");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);

  // Interaction state (using refs to avoid stale closures in handlers)
  const [mode, setMode] = useState<InteractionMode>("idle");
  const modeRef = useRef<InteractionMode>("idle");
  modeRef.current = mode;
  const [drawStart, setDrawStart] = useState<FreehandPoint | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<FreehandPoint | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<FreehandPoint[]>([]);
  const [dragOffset, setDragOffset] = useState<FreehandPoint>({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ x: number; y: number; elX: number; elY: number; elW: number; elH: number; elPoints?: FreehandPoint[] } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Endpoint dragging for arrows/lines (0 = start, 1 = end)
  const [draggingEndpointIdx, setDraggingEndpointIdx] = useState<number | null>(null);
  // Inline text editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  // Hovered anchor for arrow drawing
  const [hoveredAnchor, setHoveredAnchor] = useState<{ elementId: string; side: ConnectionBinding["anchorSide"] } | null>(null);
  // Hovered element in select mode (visual feedback)
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Active alignment guides (Miro red lines)
  const [guides, setGuides] = useState<AlignGuide[]>([]);
  // Rotation drag origin
  const rotationStartRef = useRef<{ cx: number; cy: number; angle: number; rotation: number } | null>(null);
  // Space key for temporary panning
  const spaceDownRef = useRef(false);
  // Inline text editing originals (for cancel/revert)
  const editingOriginalRef = useRef("");
  const editingIsNewRef = useRef(false);
  // Eraser drag state
  const erasingElementsRef = useRef<FreehandElement[]>([]);
  const erasingDidEraseRef = useRef(false);
  // Wheel-pan persistence: emit after the user stops scrolling
  const wheelEmitTimeoutRef = useRef<number | null>(null);
  // Alignment-guide drag origin: bbox captured on first move so snapping uses
  // the accumulated pointer delta (per-event deltas stick the selection to a guide)
  const dragBBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Clipboard & cursor tracking for copy/paste
  const clipboardRef = useRef<FreehandElement[]>([]);
  const mousePosRef = useRef<FreehandPoint>({ x: 100, y: 100 });

  // Infinite canvas: viewport pan offset
  const [panOffset, setPanOffset] = useState<FreehandPoint>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<FreehandPoint>({ x: 0, y: 0 });
  // Zoom anchoring: keeps the point under the cursor fixed while zooming
  const prevZoomRef = useRef(zoom);
  const zoomAnchorRef = useRef<FreehandPoint | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // ─── Undo/redo history ───
  const pushHistory = useCallback((els: FreehandElement[]) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(
      els.map((el) => ({ ...el, points: el.points ? el.points.map((p) => ({ ...p })) : undefined })),
    );
    if (historyRef.current.length > 100) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  // ─── Emit changes ───
  const emit = useCallback((els: FreehandElement[]) => {
    // Serialize the live viewport so pan position survives reloads and diagram switches.
    const json = JSON.stringify({ version: 1, elements: els, viewport: { zoom, scrollX: panOffset.x, scrollY: panOffset.y }, background });
    lastEmittedRef.current = json;
    onChange?.(json);
    if (!skipHistoryRef.current) pushHistory(els);
  }, [onChange, background, pushHistory, zoom, panOffset]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const els = historyRef.current[historyIndexRef.current];
    skipHistoryRef.current = true;
    setElements(els);
    emit(els);
    skipHistoryRef.current = false;
    setSelectedIds(new Set());
  }, [emit]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const els = historyRef.current[historyIndexRef.current];
    skipHistoryRef.current = true;
    setElements(els);
    emit(els);
    skipHistoryRef.current = false;
    setSelectedIds(new Set());
  }, [emit]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1;

  // ─── External content changes (e.g. switching diagrams) reset the canvas ───
  useEffect(() => {
    if (initialState === lastEmittedRef.current) return;
    lastEmittedRef.current = initialState;
    const state = parseCanvasState(initialState);
    setElements(state.elements);
    // Restore the persisted viewport instead of resetting it (and clear any
    // stale pan left over from the previously open diagram).
    setPanOffset({ x: state.viewport?.scrollX ?? 0, y: state.viewport?.scrollY ?? 0 });
    setSelectedIds(new Set());
    setEditingId(null);
    setEditingText("");
    setMode("idle");
    setHoveredId(null);
    historyRef.current = [state.elements];
    historyIndexRef.current = 0;
  }, [initialState]);

  // ─── Sync toolbar to first selected element ───
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const first = elements.find((e) => selectedIds.has(e.id));
    if (first) {
      setStrokeColor(first.strokeColor);
      setFillColor(first.fillColor);
      setStrokeWidth(first.strokeWidth);
    }
  }, [selectedIds, elements]);

  // ─── Resize canvas ───
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    obs.observe(c);
    return () => obs.disconnect();
  }, []);

  // ─── Read-only: auto-fit content into view once the canvas is sized ───
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!readOnly || didFitRef.current) return;
    if (elements.length === 0) return;
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const padding = 60;
    const scale = Math.min(
      (canvasSize.width - padding) / contentW,
      (canvasSize.height - padding) / contentH,
      1.5,
    );
    const fitZoom = Math.max(0.2, Math.min(scale, 1.5));
    const offsetX = (canvasSize.width - contentW * fitZoom) / 2 - minX * fitZoom;
    const offsetY = (canvasSize.height - contentH * fitZoom) / 2 - minY * fitZoom;

    didFitRef.current = true;
    prevZoomRef.current = fitZoom;
    setPanOffset({ x: offsetX, y: offsetY });
    onZoomChange?.(fitZoom);
  }, [readOnly, elements, canvasSize, onZoomChange]);

  // ─── Style editing: update all selected elements ───
  const updateStyle = useCallback((prop: keyof Pick<FreehandElement, "strokeColor" | "fillColor" | "strokeWidth">, value: string | number) => {
    if (selectedIds.size === 0) return;
    const updated = elements.map((el) => selectedIds.has(el.id) ? { ...el, [prop]: value } : el);
    setElements(updated);
    emit(updated);
  }, [selectedIds, elements, emit]);

  const onStrokeColor = (c: string) => { setStrokeColor(c); updateStyle("strokeColor", c); };
  const onFillColor = (c: string) => { setFillColor(c); updateStyle("fillColor", c); };
  const onStrokeWidth = (w: number) => { setStrokeWidth(w); updateStyle("strokeWidth", w); };

  // ─── Move elements + update connected arrows ───
  const moveElements = useCallback((ids: Set<string>, dx: number, dy: number): FreehandElement[] => {
    const moved = elements.map((e) => {
      if (!ids.has(e.id)) return e;
      const m = { ...e, x: e.x + dx, y: e.y + dy };
      // Always move points for elements that have them
      if (e.points) {
        m.points = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      // If dragging a connected arrow directly, detach it
      if ((e.type === "arrow" || e.type === "line") && (e.startBinding || e.endBinding)) {
        m.startBinding = undefined;
        m.endBinding = undefined;
      }
      return m;
    });
    // Update arrows connected to moved elements (endpoints follow rotated anchors)
    return updateBoundArrows(moved, ids);
  }, [elements]);

  // ─── Resize handle detection ───
  const HANDLE_SIZE = 7;
  const getHandle = (pos: FreehandPoint, el: FreehandElement): ResizeHandle | null => {
    const hs = HANDLE_SIZE;
    const pts: [ResizeHandle, number, number][] = [
      ["nw", el.x, el.y], ["n", el.x + el.width / 2, el.y], ["ne", el.x + el.width, el.y],
      ["w", el.x, el.y + el.height / 2], ["e", el.x + el.width, el.y + el.height / 2],
      ["sw", el.x, el.y + el.height], ["s", el.x + el.width / 2, el.y + el.height], ["se", el.x + el.width, el.y + el.height],
    ];
    for (const [id, hx, hy] of pts) {
      if (Math.abs(pos.x - hx) <= hs && Math.abs(pos.y - hy) <= hs) return id;
    }
    return null;
  };

  const resizeCursor: Record<ResizeHandle, string> = { nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize", se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize" };

  // ─── Draw canvas ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Apply pan offset for world-space rendering
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw elements
    for (const el of elements) {
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      ctx.strokeStyle = el.strokeColor || "#1e1e1e";
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.lineWidth = el.strokeWidth || 2;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      // Rotation transform: renders the element and its selection UI rotated
      if (el.rotation) {
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      renderElement(ctx, el);

      // Selection UI
      if (selectedIds.has(el.id)) {
        const isArrowOrLine = el.type === "arrow" || el.type === "line";

        if (isArrowOrLine) {
          // For arrows/lines: show only endpoint handles (circles)
          const pts = el.points || [{ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height }];
          for (const pt of [pts[0], pts[pts.length - 1]]) {
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.fill();
            ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2; ctx.stroke();
          }
        } else {
          // For shapes: bounding box + resize handles
          ctx.setLineDash([5, 5]); ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.5;
          ctx.strokeRect(el.x - 3, el.y - 3, el.width + 6, el.height + 6);
          ctx.setLineDash([]);
          // Resize handles (only single-select, not for rotated elements)
          if (selectedIds.size === 1 && !el.rotation) {
            const hpts: [number, number][] = [
              [el.x, el.y], [el.x + el.width / 2, el.y], [el.x + el.width, el.y],
              [el.x, el.y + el.height / 2], [el.x + el.width, el.y + el.height / 2],
              [el.x, el.y + el.height], [el.x + el.width / 2, el.y + el.height], [el.x + el.width, el.y + el.height],
            ];
            for (const [hx, hy] of hpts) {
              ctx.fillStyle = "#fff"; ctx.fillRect(hx - 4, hy - 4, 8, 8);
              ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.5; ctx.strokeRect(hx - 4, hy - 4, 8, 8);
            }
          }
          // Rotation handle (single-select, shapes & text)
          if (selectedIds.size === 1 && (isShape(el) || el.type === "text")) {
            const cx = el.x + el.width / 2;
            const topY = el.y - 18;
            ctx.beginPath(); ctx.moveTo(cx, topY + 8); ctx.lineTo(cx, topY - 6);
            ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, topY - 10, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#fff"; ctx.fill();
            ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.5; ctx.stroke();
          }
          // Anchor points for shapes
          if (isShape(el)) {
            for (const side of ["top", "bottom", "left", "right"] as ConnectionBinding["anchorSide"][]) {
              // Drawn inside the rotated context: use unrotated geometry (the transform rotates it)
              const pt = getAnchorPoint(el, side);
              ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
              ctx.fillStyle = "#7c3aed"; ctx.fill();
              ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
            }
          }
        }
      }
      ctx.restore();
    }

    // Hover highlight (select mode)
    if (hoveredId && !selectedIds.has(hoveredId) && mode === "idle") {
      const hel = elements.find((el) => el.id === hoveredId);
      if (hel) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(124,58,237,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hel.x - 3, hel.y - 3, hel.width + 6, hel.height + 6);
        ctx.restore();
      }
    }

    // Alignment guides (Miro-style red lines)
    if (guides.length > 0) {
      const gx0 = -panOffset.x / zoom;
      const gy0 = -panOffset.y / zoom;
      const gx1 = (canvasSize.width - panOffset.x) / zoom;
      const gy1 = (canvasSize.height - panOffset.y) / zoom;
      ctx.save();
      ctx.strokeStyle = "#e03131";
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      for (const g of guides) {
        ctx.beginPath();
        if (g.axis === "v") { ctx.moveTo(g.pos, gy0); ctx.lineTo(g.pos, gy1); }
        else { ctx.moveTo(gx0, g.pos); ctx.lineTo(gx1, g.pos); }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Hovered anchor
    if (hoveredAnchor) {
      const tel = elements.find((e) => e.id === hoveredAnchor.elementId);
      if (tel) {
        const pt = getAnchorPoint(tel, hoveredAnchor.side);
        ctx.save(); ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(124,58,237,0.25)"; ctx.fill();
        ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      }
    }

    // Marquee
    if (marqueeRect) {
      ctx.save();
      ctx.fillStyle = "rgba(124,58,237,0.06)"; ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h);
      ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h);
      ctx.restore();
    }

    // Drawing preview
    if (mode === "drawing" && drawStart && drawCurrent) {
      ctx.save(); ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.setLineDash([4, 4]);
      const x = Math.min(drawStart.x, drawCurrent.x), y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x), h = Math.abs(drawCurrent.y - drawStart.y);
      if (activeTool === "rectangle") ctx.strokeRect(x, y, w, h);
      else if (activeTool === "ellipse") { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (activeTool === "diamond") { ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.stroke(); }
      else if (activeTool === "arrow" || activeTool === "line") { ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y); ctx.lineTo(drawCurrent.x, drawCurrent.y); ctx.stroke(); if (activeTool === "arrow") { const angle = Math.atan2(drawCurrent.y - drawStart.y, drawCurrent.x - drawStart.x); ctx.beginPath(); ctx.moveTo(drawCurrent.x, drawCurrent.y); ctx.lineTo(drawCurrent.x - 12 * Math.cos(angle - Math.PI / 6), drawCurrent.y - 12 * Math.sin(angle - Math.PI / 6)); ctx.moveTo(drawCurrent.x, drawCurrent.y); ctx.lineTo(drawCurrent.x - 12 * Math.cos(angle + Math.PI / 6), drawCurrent.y - 12 * Math.sin(angle + Math.PI / 6)); ctx.stroke(); } }
      ctx.restore();
    }
    // Freehand preview
    if (mode === "drawing" && activeTool === "freehand" && freehandPoints.length > 1) {
      ctx.save(); ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(freehandPoints[0].x, freehandPoints[0].y);
      for (let i = 1; i < freehandPoints.length; i++) ctx.lineTo(freehandPoints[i].x, freehandPoints[i].y);
      ctx.stroke(); ctx.restore();
    }

    // Restore pan transform
    ctx.restore();
  }, [elements, selectedIds, canvasSize, dpr, background, hoveredAnchor, marqueeRect, mode, drawStart, drawCurrent, activeTool, strokeColor, strokeWidth, freehandPoints, editingId, panOffset, zoom, hoveredId, guides]);

  useEffect(() => { draw(); }, [draw]);

  function renderElement(ctx: CanvasRenderingContext2D, el: FreehandElement) {
    switch (el.type) {
      case "rectangle":
        if (el.borderRadius) {
          if (el.fillColor && el.fillColor !== "transparent") { roundedRectPath(ctx, el.x, el.y, el.width, el.height, el.borderRadius); ctx.fill(); }
          roundedRectPath(ctx, el.x, el.y, el.width, el.height, el.borderRadius); ctx.stroke();
        } else {
          if (el.fillColor && el.fillColor !== "transparent") ctx.fillRect(el.x, el.y, el.width, el.height);
          ctx.strokeRect(el.x, el.y, el.width, el.height);
        }
        break;
      case "diamond": {
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
        ctx.beginPath(); ctx.moveTo(cx, el.y); ctx.lineTo(el.x + el.width, cy); ctx.lineTo(cx, el.y + el.height); ctx.lineTo(el.x, cy); ctx.closePath();
        if (el.fillColor && el.fillColor !== "transparent") ctx.fill(); ctx.stroke(); break;
      }
      case "ellipse": {
        ctx.beginPath(); ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
        if (el.fillColor && el.fillColor !== "transparent") ctx.fill(); ctx.stroke(); break;
      }
      case "arrow": case "line": {
        const pts = el.points || [{ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height }];
        if (pts.length < 2) break;
        ctx.save();
        if (el.dashed) ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        const drawHead = (tip: FreehandPoint, tail: FreehandPoint) => {
          const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x - 12 * Math.cos(angle - Math.PI / 6), tip.y - 12 * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x - 12 * Math.cos(angle + Math.PI / 6), tip.y - 12 * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        };
        const showStart = !!el.startArrowhead;
        const showEnd = el.type === "arrow" ? el.endArrowhead !== false : !!el.endArrowhead;
        if (showEnd) drawHead(pts[pts.length - 1], pts[pts.length - 2]);
        if (showStart) drawHead(pts[0], pts[1]);
        ctx.restore();
        break;
      }
      case "text": {
        if (el.id === editingId) break; // Don't render text while editing
        ctx.font = `${el.fontSize || 16}px ${el.fontFamily || "sans-serif"}`;
        ctx.fillStyle = el.strokeColor || "#1e1e1e"; ctx.textBaseline = "top";
        (el.text || "").split("\n").forEach((line, i) => ctx.fillText(line, el.x, el.y + i * (el.fontSize || 16) * 1.2));
        break;
      }
      case "freehand": {
        const pts = el.points || []; if (pts.length < 2) break;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke(); break;
      }
    }
    // Draw centered text for shapes that have it (not for "text" type — that renders its own)
    // Skip rendering text if this element is currently being edited (to avoid duplication)
    if (el.type !== "text" && el.text && el.id !== editingId) {
      ctx.save();
      const fs = el.fontSize || 14;
      ctx.font = `${fs}px ${el.fontFamily || "sans-serif"}`;
      ctx.fillStyle = el.strokeColor || "#1e1e1e";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const shapeLines = el.text.split("\n");
      const lineHeight = fs * 1.25;
      const startY = el.y + el.height / 2 - ((shapeLines.length - 1) * lineHeight) / 2;
      shapeLines.forEach((line, i) => ctx.fillText(line, el.x + el.width / 2, startY + i * lineHeight));
      ctx.restore();
    }
  }

  // ─── Mouse position (screen → world with pan + zoom) ───
  const getPos = (e: React.MouseEvent): FreehandPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left - panOffset.x) / zoom, y: (e.clientY - rect.top - panOffset.y) / zoom };
  };
  // Screen position (without pan/zoom, for context menu positioning)
  const getScreenPos = (e: React.MouseEvent): FreehandPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
  };

  // ─── Eraser: remove the element under the cursor (used on click and while dragging) ───
  const eraseAt = (pos: FreehandPoint) => {
    const current = erasingElementsRef.current;
    const hit = [...current].reverse().find((el) => hitTest(pos, el));
    if (!hit) return;
    erasingDidEraseRef.current = true;
    const next = current.filter((el) => el.id !== hit.id && el.startBinding?.elementId !== hit.id && el.endBinding?.elementId !== hit.id);
    erasingElementsRef.current = next;
    setElements(next);
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(hit.id); return s; });
  };

  // ─── Union bounding box of the current selection (world coords) ───
  const getSelectionBBox = (): { x: number; y: number; width: number; height: number } | null => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      if (!selectedIds.has(el.id)) continue;
      minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
    }
    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  // ─── Pointer Down ───
  const handlePointerDown = (e: React.MouseEvent) => {
    // Close context menu on any click
    if (contextMenu) setContextMenu(null);

    // In read-only mode, left-click also pans (view-only)
    if (readOnly) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    // Middle-click, Space+drag, or hand tool pans the canvas
    if (e.button === 1 || spaceDownRef.current || activeTool === "hand") {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const pos = getPos(e);
    setHoveredId(null);
    setGuides([]);

    if (activeTool === "select") {
      // 1) Check endpoint handles on selected arrow/line
      if (selectedIds.size === 1) {
        const selEl = elements.find((el) => selectedIds.has(el.id));
        if (selEl && (selEl.type === "arrow" || selEl.type === "line")) {
          const pts = selEl.points || [{ x: selEl.x, y: selEl.y }, { x: selEl.x + selEl.width, y: selEl.y + selEl.height }];
          // Check start point
          if (Math.hypot(pos.x - pts[0].x, pos.y - pts[0].y) <= 8) {
            setMode("endpoint"); setDraggingEndpointIdx(0);
            // Disconnect start binding
            if (selEl.startBinding) {
              setElements(elements.map((el) => el.id === selEl.id ? { ...el, startBinding: undefined } : el));
            }
            return;
          }
          // Check end point
          if (Math.hypot(pos.x - pts[pts.length - 1].x, pos.y - pts[pts.length - 1].y) <= 8) {
            setMode("endpoint"); setDraggingEndpointIdx(pts.length - 1);
            // Disconnect end binding
            if (selEl.endBinding) {
              setElements(elements.map((el) => el.id === selEl.id ? { ...el, endBinding: undefined } : el));
            }
            return;
          }
        }
        // 2) Rotation handle (shapes & text)
        if (selEl && selEl.type !== "arrow" && selEl.type !== "line" && selEl.type !== "freehand") {
          const cx = selEl.x + selEl.width / 2;
          const cy = selEl.y + selEl.height / 2;
          const rad = ((selEl.rotation || 0) * Math.PI) / 180;
          const handlePos = rotatePoint({ x: cx, y: selEl.y - 18 }, cx, cy, rad);
          if (Math.hypot(pos.x - handlePos.x, pos.y - handlePos.y) <= 10) {
            setMode("rotating");
            rotationStartRef.current = {
              cx,
              cy,
              angle: (Math.atan2(pos.y - cy, pos.x - cx) * 180) / Math.PI,
              rotation: selEl.rotation || 0,
            };
            return;
          }
        }
        // 3) Check resize handles on shapes (not arrows/lines, not rotated)
        if (selEl && selEl.type !== "arrow" && selEl.type !== "line" && !selEl.rotation) {
          const h = getHandle(pos, selEl);
          if (h) {
            setMode("resizing"); setResizeHandle(h);
            setResizeOrigin({ x: pos.x, y: pos.y, elX: selEl.x, elY: selEl.y, elW: selEl.width, elH: selEl.height, elPoints: selEl.points ? [...selEl.points] : undefined });
            return;
          }
        }
      }
      // 4) Check if clicking on an element
      const hit = [...elements].reverse().find((el) => hitTest(pos, el));
      if (hit) {
        if (e.shiftKey) {
          // Toggle in multi-selection
          setSelectedIds((prev) => { const s = new Set(prev); if (s.has(hit.id)) s.delete(hit.id); else s.add(hit.id); return s; });
        } else {
          // Click selects the whole group when the element belongs to one (Excalidraw-style)
          if (hit.groupId) {
            setSelectedIds(new Set(elements.filter((el) => el.groupId === hit.groupId).map((el) => el.id)));
          } else if (!selectedIds.has(hit.id)) {
            setSelectedIds(new Set([hit.id]));
          }
        }
        setMode("dragging"); setDragOffset({ x: pos.x, y: pos.y }); dragBBoxRef.current = null;
      } else {
        // 3) Start marquee on empty space
        if (!e.shiftKey) setSelectedIds(new Set());
        setMode("marquee"); setDrawStart(pos); setMarqueeRect(null);
      }
      return;
    }

    if (activeTool === "eraser") {
      // Eraser works on click and on drag (continuous erase)
      setMode("erasing");
      erasingElementsRef.current = elements;
      eraseAt(pos);
      return;
    }

    if (activeTool === "text") {
      // Create an empty text element and start editing it inline (Excalidraw-style)
      const nel: FreehandElement = { id: generateId(), type: "text", x: pos.x, y: pos.y, width: 120, height: 24, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, text: "", fontSize: 16, fontFamily: "sans-serif" };
      const updated = [...elements, nel];
      // Don't push history for the intermediate creation — only the committed text matters
      skipHistoryRef.current = true;
      setElements(updated); emit(updated);
      skipHistoryRef.current = false;
      setSelectedIds(new Set([nel.id]));
      setEditingId(nel.id);
      setEditingText("");
      editingIsNewRef.current = true;
      editingOriginalRef.current = "";
      return;
    }

    // Drawing tools
    setMode("drawing"); setDrawStart(pos); setDrawCurrent(pos);
    if (activeTool === "freehand") setFreehandPoints([pos]);
  };

  // ─── Pointer Move ───
  const handlePointerMove = (e: React.MouseEvent) => {
    const pos = getPos(e);
    mousePosRef.current = pos;

    // Panning
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    // Eraser drag: delete everything under the cursor while dragging
    if (mode === "erasing") {
      eraseAt(pos);
      return;
    }

    // Hover highlight in select mode (only while idle)
    if (mode === "idle" && activeTool === "select" && !readOnly) {
      const hit = [...elements].reverse().find((el) => hitTest(pos, el));
      setHoveredId(hit ? hit.id : null);
    }

    if (mode === "dragging") {
      // Capture the selection bbox once on the first move (selection is committed by then).
      if (!dragBBoxRef.current) {
        const b = getSelectionBBox();
        dragBBoxRef.current = b ?? { x: dragOffset.x, y: dragOffset.y, width: 0, height: 0 };
      }
      const origin = dragBBoxRef.current;
      // Accumulated pointer delta from the drag start: snapping the accumulated
      // candidate (instead of correcting the per-event delta) lets the element
      // leave a guide once the pointer moves past the snap threshold.
      const totalDx = pos.x - dragOffset.x, totalDy = pos.y - dragOffset.y;
      const cand = { x: origin.x + totalDx, y: origin.y + totalDy, width: origin.width, height: origin.height };
      const res = computeAlignGuides(cand, elements, selectedIds);
      const selBBox = getSelectionBBox();
      const fx = selBBox ? cand.x + res.dx - selBBox.x : totalDx;
      const fy = selBBox ? cand.y + res.dy - selBBox.y : totalDy;
      // Only update state when the visible guides actually change (avoids extra re-renders per mousemove)
      if (!guidesEqual(res.guides, guides)) setGuides(res.guides);
      setElements(moveElements(selectedIds, fx, fy));
      return;
    }

    // Rotation drag for shapes/text
    if (mode === "rotating" && rotationStartRef.current && selectedIds.size === 1) {
      const st = rotationStartRef.current;
      let rot = st.rotation + ((Math.atan2(pos.y - st.cy, pos.x - st.cx) * 180) / Math.PI - st.angle);
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      const elId = [...selectedIds][0];
      setElements((prev) => {
        const next = prev.map((el) => (el.id === elId ? { ...el, rotation: rot } : el));
        // Keep arrows bound to the rotated element attached to its (rotated) anchors
        return updateBoundArrows(next, new Set([elId]));
      });
      return;
    }

    // Endpoint dragging for arrows/lines
    if (mode === "endpoint" && draggingEndpointIdx !== null && selectedIds.size === 1) {
      const elId = [...selectedIds][0];
      setElements(elements.map((el) => {
        if (el.id !== elId) return el;
        const pts = [...(el.points || [])];
        pts[draggingEndpointIdx] = pos;
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        return { ...el, points: pts, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 };
      }));
      // Show anchor hint if near a shape
      const near = [...elements].reverse().find((el) => el.id !== elId && isShape(el) && hitTest(pos, el));
      if (near) setHoveredAnchor({ elementId: near.id, side: closestAnchorSide(near, pos) });
      else setHoveredAnchor(null);
      return;
    }

    if (mode === "resizing" && resizeHandle && resizeOrigin && selectedIds.size === 1) {
      const elId = [...selectedIds][0];
      const dx = pos.x - resizeOrigin.x, dy = pos.y - resizeOrigin.y;
      let nx = resizeOrigin.elX, ny = resizeOrigin.elY, nw = resizeOrigin.elW, nh = resizeOrigin.elH;
      if (resizeHandle.includes("e")) nw = Math.max(10, resizeOrigin.elW + dx);
      if (resizeHandle.includes("w")) { nw = Math.max(10, resizeOrigin.elW - dx); nx = resizeOrigin.elX + resizeOrigin.elW - nw; }
      if (resizeHandle.includes("s")) nh = Math.max(10, resizeOrigin.elH + dy);
      if (resizeHandle.includes("n")) { nh = Math.max(10, resizeOrigin.elH - dy); ny = resizeOrigin.elY + resizeOrigin.elH - nh; }
      const resized = elements.map((el) => {
        if (el.id !== elId) return el;
        const updated = { ...el, x: nx, y: ny, width: nw, height: nh };
        // Scale points proportionally for freehand/line/arrow elements
        if (resizeOrigin.elPoints && resizeOrigin.elPoints.length > 0 && resizeOrigin.elW > 0 && resizeOrigin.elH > 0) {
          const scaleX = nw / resizeOrigin.elW;
          const scaleY = nh / resizeOrigin.elH;
          updated.points = resizeOrigin.elPoints.map((p) => ({
            x: nx + (p.x - resizeOrigin.elX) * scaleX,
            y: ny + (p.y - resizeOrigin.elY) * scaleY,
          }));
        }
        return updated;
      });
      // Keep arrows bound to the resized shape attached to its new anchors.
      setElements(updateBoundArrows(resized, new Set([elId])));
      return;
    }

    if (mode === "marquee" && drawStart) {
      const x = Math.min(drawStart.x, pos.x), y = Math.min(drawStart.y, pos.y);
      setMarqueeRect({ x, y, w: Math.abs(pos.x - drawStart.x), h: Math.abs(pos.y - drawStart.y) });
      return;
    }

    if (mode === "drawing") {
      let cur = pos;
      // Alignment guides while drawing shapes / arrows / lines
      if (activeTool !== "freehand" && drawStart) {
        const bbox = {
          x: Math.min(drawStart.x, cur.x), y: Math.min(drawStart.y, cur.y),
          width: Math.abs(cur.x - drawStart.x), height: Math.abs(cur.y - drawStart.y),
        };
        const res = computeAlignGuides(bbox, elements, new Set());
        cur = { x: cur.x + res.dx, y: cur.y + res.dy };
        if (!guidesEqual(res.guides, guides)) setGuides(res.guides);
      }
      setDrawCurrent(cur);
      if (activeTool === "freehand") setFreehandPoints((prev) => [...prev, pos]);
      // Arrow anchor snapping
      if (activeTool === "arrow" || activeTool === "line") {
        const near = [...elements].reverse().find((el) => isShape(el) && hitTest(cur, el));
        if (near) setHoveredAnchor({ elementId: near.id, side: closestAnchorSide(near, cur) });
        else setHoveredAnchor(null);
      }
    }
  };

  // ─── Pointer Up ───
  const handlePointerUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      // Persist the panned viewport (hand tool / space-drag / middle-drag).
      if (!readOnly) {
        skipHistoryRef.current = true;
        emit(elements);
        skipHistoryRef.current = false;
      }
      return;
    }
    const pos = getPos(e);

    if (mode === "erasing") {
      setMode("idle");
      if (erasingDidEraseRef.current) emit(erasingElementsRef.current);
      erasingElementsRef.current = [];
      erasingDidEraseRef.current = false;
      setGuides([]);
      return;
    }

    if (mode === "rotating") {
      setMode("idle");
      rotationStartRef.current = null;
      setGuides([]);
      emit(elements);
      return;
    }

    if (mode === "marquee") {
      if (marqueeRect && (marqueeRect.w > 5 || marqueeRect.h > 5)) {
        const ids = new Set<string>();
        for (const el of elements) {
          const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
          if (cx >= marqueeRect.x && cx <= marqueeRect.x + marqueeRect.w && cy >= marqueeRect.y && cy <= marqueeRect.y + marqueeRect.h) ids.add(el.id);
        }
        setSelectedIds(ids);
      }
      setMode("idle"); setDrawStart(null); setMarqueeRect(null); return;
    }

    if (mode === "dragging") { setMode("idle"); setGuides([]); dragBBoxRef.current = null; emit(elements); return; }
    if (mode === "resizing") { setMode("idle"); setResizeHandle(null); setResizeOrigin(null); setGuides([]); emit(elements); return; }
    if (mode === "endpoint") {
      // Snap endpoint to anchor if hovering one
      if (hoveredAnchor && draggingEndpointIdx !== null && selectedIds.size === 1) {
        const elId = [...selectedIds][0];
        const targetEl = elements.find((el) => el.id === hoveredAnchor.elementId);
        if (targetEl) {
          const anchorPt = getRotatedAnchor(targetEl, hoveredAnchor.side);
          const snapped = elements.map((el) => {
            if (el.id !== elId) return el;
            const pts = [...(el.points || [])];
            pts[draggingEndpointIdx] = anchorPt;
            const binding: ConnectionBinding = { elementId: hoveredAnchor.elementId, anchorSide: hoveredAnchor.side };
            const updated = { ...el, points: pts };
            if (draggingEndpointIdx === 0) updated.startBinding = binding;
            else updated.endBinding = binding;
            const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
            updated.x = Math.min(...xs); updated.y = Math.min(...ys);
            updated.width = Math.max(...xs) - updated.x || 1; updated.height = Math.max(...ys) - updated.y || 1;
            return updated;
          });
          setElements(snapped);
          setMode("idle"); setDraggingEndpointIdx(null); setHoveredAnchor(null); setGuides([]);
          // Emit the snapped array — the closure's elements predate the snap.
          emit(snapped);
          return;
        }
      }
      setMode("idle"); setDraggingEndpointIdx(null); setHoveredAnchor(null); setGuides([]); emit(elements); return;
    }

    if (mode !== "drawing" || !drawStart) { setMode("idle"); setGuides([]); return; }

    // Finalize drawing
    const endPt = drawCurrent || pos;
    let newEl: FreehandElement | null = null;
    if (activeTool === "freehand") {
      const pts = freehandPoints;
      if (pts.length >= 2) {
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        newEl = { id: generateId(), type: "freehand", x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, points: pts };
      }
    } else if (activeTool === "arrow" || activeTool === "line") {
      let startBinding: ConnectionBinding | undefined, endBinding: ConnectionBinding | undefined;
      let sp = drawStart, ep = endPt;
      const startShape = elements.find((el) => isShape(el) && hitTest(drawStart, el));
      const endShape = hoveredAnchor ? elements.find((el) => el.id === hoveredAnchor.elementId) : elements.find((el) => isShape(el) && hitTest(endPt, el));
      if (startShape) { const side = closestAnchorSide(startShape, drawStart); startBinding = { elementId: startShape.id, anchorSide: side }; sp = getRotatedAnchor(startShape, side); }
      if (endShape && endShape.id !== startShape?.id) { const side = hoveredAnchor?.elementId === endShape.id ? hoveredAnchor.side : closestAnchorSide(endShape, endPt); endBinding = { elementId: endShape.id, anchorSide: side }; ep = getRotatedAnchor(endShape, side); }
      newEl = { id: generateId(), type: activeTool, x: Math.min(sp.x, ep.x), y: Math.min(sp.y, ep.y), width: Math.abs(ep.x - sp.x) || 1, height: Math.abs(ep.y - sp.y) || 1, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, points: [sp, ep], endArrowhead: activeTool === "arrow", startBinding, endBinding };
    } else {
      const x = Math.min(drawStart.x, endPt.x), y = Math.min(drawStart.y, endPt.y);
      const w = Math.abs(endPt.x - drawStart.x), h = Math.abs(endPt.y - drawStart.y);
      if (w > 3 || h > 3) newEl = { id: generateId(), type: activeTool as any, x, y, width: w, height: h, strokeColor, fillColor, strokeWidth, opacity: 1 };
    }

    if (newEl) {
      const updated = [...elements, newEl];
      setElements(updated); emit(updated);
      // Freehand tool stays active for continuous drawing; other tools auto-select the new element
      if (activeTool !== "freehand") {
        setSelectedIds(new Set([newEl.id]));
        setActiveTool("select");
      }
    }
    setMode("idle"); setDrawStart(null); setDrawCurrent(null); setFreehandPoints([]); setHoveredAnchor(null); setGuides([]);
  };

  // ─── Double-click: edit text inside an element, or create a text element on empty canvas ───
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    const pos = getPos(e);
    const hit = [...elements].reverse().find((el) => hitTest(pos, el));
    if (hit) {
      setEditingId(hit.id);
      setEditingText(hit.text || "");
      editingIsNewRef.current = false;
      editingOriginalRef.current = hit.text || "";
    } else if (activeTool === "select") {
      // Double-click on empty canvas creates a text element (Excalidraw-style)
      const nel: FreehandElement = { id: generateId(), type: "text", x: pos.x, y: pos.y, width: 120, height: 24, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, text: "", fontSize: 16, fontFamily: "sans-serif" };
      const updated = [...elements, nel];
      skipHistoryRef.current = true;
      setElements(updated); emit(updated);
      skipHistoryRef.current = false;
      setSelectedIds(new Set([nel.id]));
      setEditingId(nel.id);
      setEditingText("");
      editingIsNewRef.current = true;
      editingOriginalRef.current = "";
    }
  };

  const commitTextEdit = () => {
    if (!editingId) return;
    const el = elements.find((e) => e.id === editingId);
    const text = editingText.replace(/\s+$/, ""); // trim trailing whitespace only
    if (el && !text.trim()) {
      // Empty text: remove the element if it was just created, otherwise revert to original
      if (editingIsNewRef.current) {
        const updated = elements.filter((e) => e.id !== editingId);
        setElements(updated); emit(updated);
        setSelectedIds(new Set());
      } else {
        const updated = elements.map((e) => (e.id === editingId ? { ...e, text: editingOriginalRef.current } : e));
        setElements(updated); emit(updated);
      }
    } else if (el) {
      const fs = el.fontSize || 16;
      const lines = text.split("\n").length;
      const updated = elements.map((e) => {
        if (e.id !== editingId) return e;
        // Only standalone text elements auto-size; shapes keep their real size
        if (el.type === "text") {
          return { ...e, text, width: Math.max(20, measureTextWidth(text, fs, e.fontFamily) + 12), height: lines * fs * 1.25 + 4 };
        }
        return { ...e, text };
      });
      setElements(updated);
      emit(updated);
    }
    setEditingId(null);
    setEditingText("");
    editingIsNewRef.current = false;
  };

  const cancelTextEdit = () => {
    if (!editingId) return;
    const el = elements.find((e) => e.id === editingId);
    if (el && editingIsNewRef.current) {
      const updated = elements.filter((e) => e.id !== editingId);
      setElements(updated); emit(updated);
      setSelectedIds(new Set());
    } else if (el) {
      const updated = elements.map((e) => (e.id === editingId ? { ...e, text: editingOriginalRef.current } : e));
      setElements(updated); emit(updated);
    }
    setEditingId(null);
    setEditingText("");
    editingIsNewRef.current = false;
  };

  // ─── Context Menu ───
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    const screenPos = getScreenPos(e);
    // Select element under cursor if not already selected
    const hit = [...elements].reverse().find((el) => hitTest(pos, el));
    if (hit && !selectedIds.has(hit.id)) {
      setSelectedIds(new Set([hit.id]));
    }
    setContextMenu({ x: screenPos.x, y: screenPos.y });
  };

  // Layer order operations
  const bringToFront = () => {
    if (selectedIds.size === 0) return;
    const sel = elements.filter((el) => selectedIds.has(el.id));
    const rest = elements.filter((el) => !selectedIds.has(el.id));
    const updated = [...rest, ...sel];
    setElements(updated); emit(updated);
  };
  const sendToBack = () => {
    if (selectedIds.size === 0) return;
    const sel = elements.filter((el) => selectedIds.has(el.id));
    const rest = elements.filter((el) => !selectedIds.has(el.id));
    const updated = [...sel, ...rest];
    setElements(updated); emit(updated);
  };
  const bringForward = () => {
    if (selectedIds.size === 0) return;
    const updated = [...elements];
    for (let i = updated.length - 2; i >= 0; i--) {
      if (selectedIds.has(updated[i].id) && !selectedIds.has(updated[i + 1].id)) {
        [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
      }
    }
    setElements(updated); emit(updated);
  };
  const sendBackward = () => {
    if (selectedIds.size === 0) return;
    const updated = [...elements];
    for (let i = 1; i < updated.length; i++) {
      if (selectedIds.has(updated[i].id) && !selectedIds.has(updated[i - 1].id)) {
        [updated[i], updated[i - 1]] = [updated[i - 1], updated[i]];
        i++; // skip the swapped element
      }
    }
    setElements(updated); emit(updated);
  };
  const duplicateSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const newIds = new Set<string>();
    // Duplicated elements keep their grouping, but form a NEW group (so they don't merge with the original)
    const newGroupId = generateId();
    const anyGrouped = elements.some((el) => selectedIds.has(el.id) && el.groupId);
    const duped = elements.filter((el) => selectedIds.has(el.id)).map((el) => {
      const nid = generateId();
      newIds.add(nid);
      return { ...el, id: nid, x: el.x + 20, y: el.y + 20, points: el.points?.map((p) => ({ x: p.x + 20, y: p.y + 20 })), startBinding: undefined, endBinding: undefined, groupId: anyGrouped ? newGroupId : undefined };
    });
    const updated = [...elements, ...duped];
    setElements(updated); emit(updated); setSelectedIds(newIds);
  }, [elements, selectedIds, emit]);

  // ─── Group / ungroup (2+ selected) ───
  const groupSelected = useCallback(() => {
    if (selectedIds.size < 2) return;
    const gid = generateId();
    const updated = elements.map((el) => (selectedIds.has(el.id) ? { ...el, groupId: gid } : el));
    setElements(updated); emit(updated);
  }, [elements, selectedIds, emit]);

  const ungroupSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const updated = elements.map((el) => (selectedIds.has(el.id) ? { ...el, groupId: undefined } : el));
    setElements(updated); emit(updated);
  }, [elements, selectedIds, emit]);

  // True when every selected element belongs to the same group
  const allSameGroup = (() => {
    if (selectedIds.size === 0) return false;
    const ids = elements.filter((el) => selectedIds.has(el.id));
    if (ids.some((el) => !el.groupId)) return false;
    return new Set(ids.map((el) => el.groupId)).size === 1;
  })();

  // ─── Alignment & distribution (2+ selected) ───
  const alignSelected = (axis: "x" | "y", mode: "min" | "center" | "max") => {
    const sel = elements.filter((el) => selectedIds.has(el.id));
    if (sel.length < 2) return;
    const target =
      axis === "x"
        ? mode === "min"
          ? Math.min(...sel.map((el) => el.x))
          : mode === "max"
            ? Math.max(...sel.map((el) => el.x + el.width))
            : sel.reduce((s, el) => s + el.x + el.width / 2, 0) / sel.length
        : mode === "min"
          ? Math.min(...sel.map((el) => el.y))
          : mode === "max"
            ? Math.max(...sel.map((el) => el.y + el.height))
            : sel.reduce((s, el) => s + el.y + el.height / 2, 0) / sel.length;
    const updated = elements.map((el) => {
      if (!selectedIds.has(el.id)) return el;
      const dx = axis === "x" ? target - (mode === "max" ? el.x + el.width : mode === "center" ? el.x + el.width / 2 : el.x) : 0;
      const dy = axis === "y" ? target - (mode === "max" ? el.y + el.height : mode === "center" ? el.y + el.height / 2 : el.y) : 0;
      return shiftElement(el, dx, dy);
    });
    setElements(updated); emit(updated);
  };

  const distributeSelected = (axis: "x" | "y") => {
    const sel = elements.filter((el) => selectedIds.has(el.id));
    if (sel.length < 3) return;
    const center = (el: FreehandElement) => (axis === "x" ? el.x + el.width / 2 : el.y + el.height / 2);
    const sorted = [...sel].sort((a, b) => center(a) - center(b));
    const first = center(sorted[0]);
    const last = center(sorted[sorted.length - 1]);
    const gap = (last - first) / (sorted.length - 1);
    const updated = elements.map((el) => {
      if (!selectedIds.has(el.id)) return el;
      const idx = sorted.findIndex((s) => s.id === el.id);
      const delta = first + gap * idx - center(el);
      return shiftElement(el, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
    });
    setElements(updated); emit(updated);
  };

  // ─── Arrow/line style toggles (single selected) ───
  const toggleArrowProp = (prop: "dashed" | "startArrowhead" | "endArrowhead") => {
    const el = elements.find((e) => selectedIds.has(e.id));
    if (!el || (el.type !== "arrow" && el.type !== "line")) return;
    const next = prop === "dashed" ? !el.dashed : prop === "startArrowhead" ? !el.startArrowhead : !el.endArrowhead;
    const updated = elements.map((e) => (e.id === el.id ? { ...e, [prop]: next } : e));
    setElements(updated); emit(updated);
  };

  // ─── Rectangle border radius (single selected) ───
  const onBorderRadius = (r: number) => {
    const updated = elements.map((el) => (selectedIds.has(el.id) && el.type === "rectangle" ? { ...el, borderRadius: r } : el));
    setElements(updated); emit(updated);
  };

  // ─── Text font size (single selected) ───
  const onFontSize = (fs: number) => {
    const updated = elements.map((el) => {
      if (!selectedIds.has(el.id) || el.type !== "text") return el;
      const lines = (el.text || "").split("\n").length;
      return { ...el, fontSize: fs, width: Math.max(20, measureTextWidth(el.text || "", fs, el.fontFamily) + 12), height: lines * fs * 1.25 + 4 };
    });
    setElements(updated); emit(updated);
  };

  // ─── Delete ───
  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const updated = elements.filter((el) => !selectedIds.has(el.id) && (!el.startBinding || !selectedIds.has(el.startBinding.elementId)) && (!el.endBinding || !selectedIds.has(el.endBinding.elementId)));
    setElements(updated); emit(updated); setSelectedIds(new Set());
  }, [elements, selectedIds, emit]);

  // ─── Fit content to viewport (F) ───
  const fitToContent = useCallback(() => {
    if (elements.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0 || canvasSize.width <= 0 || canvasSize.height <= 0) return;
    const pad = 60;
    const scale = Math.min((canvasSize.width - pad) / contentW, (canvasSize.height - pad) / contentH);
    const fitZoom = Math.max(0.2, Math.min(scale, 1.5));
    // Bypass the anchor-based zoom effect: we set the exact offset ourselves
    prevZoomRef.current = fitZoom;
    zoomAnchorRef.current = null;
    setPanOffset({
      x: (canvasSize.width - contentW * fitZoom) / 2 - minX * fitZoom,
      y: (canvasSize.height - contentH * fitZoom) / 2 - minY * fitZoom,
    });
    onZoomChange?.(fitZoom);
  }, [elements, canvasSize, onZoomChange]);

  // ─── Keyboard ───
  useEffect(() => {
    if (readOnly) return;

    const isTypingTarget = (): boolean => {
      const a = document.activeElement;
      return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable);
    };

    const toolShortcuts: Record<string, FreehandTool> = {
      v: "select", h: "hand", r: "rectangle", d: "diamond", o: "ellipse",
      a: "arrow", l: "line", t: "text", p: "freehand", e: "eraser",
    };

    const onKey = (e: KeyboardEvent) => {
      // Ignore while editing inline text or typing in any input (chat, search, etc.)
      if (editingId || isTypingTarget()) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo / redo
      if (mod && key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && key === "y") { e.preventDefault(); redo(); return; }

      // Duplicate (Excalidraw-style)
      if (mod && key === "d") { e.preventDefault(); duplicateSelected(); return; }

      // Group / ungroup
      if (mod && key === "g") { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); return; }

      // Select all / copy / cut / paste
      if (mod && key === "a" && activeTool === "select") { e.preventDefault(); setSelectedIds(new Set(elements.map((el) => el.id))); return; }
      if (mod && key === "c" && selectedIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = elements.filter((el) => selectedIds.has(el.id)).map((el) => ({ ...el }));
        return;
      }
      if (mod && key === "x" && selectedIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = elements.filter((el) => selectedIds.has(el.id)).map((el) => ({ ...el }));
        handleDelete();
        return;
      }
      if (mod && key === "v" && clipboardRef.current.length > 0) {
        e.preventDefault();
        const copied = clipboardRef.current;
        const cx = copied.reduce((s, el) => s + el.x + el.width / 2, 0) / copied.length;
        const cy = copied.reduce((s, el) => s + el.y + el.height / 2, 0) / copied.length;
        const dx = mousePosRef.current.x - cx;
        const dy = mousePosRef.current.y - cy;
        const newIds = new Set<string>();
        const pasted: FreehandElement[] = copied.map((el) => {
          const newId = generateId();
          newIds.add(newId);
          return {
            ...el,
            id: newId,
            x: el.x + dx,
            y: el.y + dy,
            points: el.points ? el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) : undefined,
            startBinding: undefined,
            endBinding: undefined,
          };
        });
        const updated = [...elements, ...pasted];
        setElements(updated);
        emit(updated);
        setSelectedIds(newIds);
        return;
      }

      // Delete
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) { e.preventDefault(); handleDelete(); return; }

      // Escape: clear selection and return to the select tool
      if (e.key === "Escape") { setSelectedIds(new Set()); setActiveTool("select"); setMode("idle"); setHoveredId(null); setGuides([]); return; }

      // Nudge selected elements with arrow keys (Shift = 10px)
      if (selectedIds.size > 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const moved = moveElements(selectedIds, dx, dy);
        setElements(moved); emit(moved);
        return;
      }

      // Fit content to viewport
      if (key === "f" && !mod && !e.altKey) { e.preventDefault(); fitToContent(); return; }

      // Tool shortcuts (single letters)
      if (!mod && !e.altKey && toolShortcuts[key]) {
        e.preventDefault();
        setActiveTool(toolShortcuts[key]);
        setMode("idle");
        setHoveredId(null);
        setGuides([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, editingId, selectedIds, handleDelete, elements, activeTool, emit, undo, redo, duplicateSelected, moveElements, fitToContent, groupSelected, ungroupSelected]);

  // ─── Space key = temporary pan ───
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && document.activeElement === document.body) {
        spaceDownRef.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") spaceDownRef.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ─── Keep the anchor point fixed when zoom changes ───
  // screen = world * zoom + panOffset  →  panOffset' = anchor - (anchor - panOffset) / prevZoom * zoom
  useEffect(() => {
    const prevZoom = prevZoomRef.current;
    if (prevZoom === zoom) return;
    prevZoomRef.current = zoom;
    // Wheel zoom anchors at the cursor; toolbar buttons anchor at the canvas center
    const anchor = zoomAnchorRef.current ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    zoomAnchorRef.current = null;
    setPanOffset((prev) => ({
      x: anchor.x - ((anchor.x - prev.x) / prevZoom) * zoom,
      y: anchor.y - ((anchor.y - prev.y) / prevZoom) * zoom,
    }));
  }, [zoom, canvasSize.width, canvasSize.height]);

  // ─── Wheel to pan/zoom ───
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && onZoomChange) {
      // Zoom anchored at the cursor — delegated to parent editor
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        zoomAnchorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      onZoomChange(Math.min(5, Math.max(0.2, zoom + delta)));
    } else {
      // Pan
      setPanOffset((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      // Persist wheel pans shortly after the user stops scrolling (no history entry).
      if (!readOnly) {
        if (wheelEmitTimeoutRef.current !== null) window.clearTimeout(wheelEmitTimeoutRef.current);
        wheelEmitTimeoutRef.current = window.setTimeout(() => {
          skipHistoryRef.current = true;
          emit(elements);
          skipHistoryRef.current = false;
        }, 400);
      }
    }
  }, [zoom, onZoomChange, readOnly, emit, elements]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (wheelEmitTimeoutRef.current !== null) window.clearTimeout(wheelEmitTimeoutRef.current);
    };
  }, [handleWheel]);

  const handleClear = () => { setElements([]); emit([]); setSelectedIds(new Set()); };

  // ─── Cursor ───
  const getCursor = (): string => {
    if (isPanning) return "grabbing";
    if (mode === "resizing" && resizeHandle) return resizeCursor[resizeHandle];
    if (mode === "dragging") return "grabbing";
    if (activeTool === "hand") return "grab";
    if (activeTool === "select") return hoveredId ? "move" : "default";
    if (activeTool === "eraser") return "not-allowed";
    return "crosshair";
  };

  // ─── Tools config ───
  const tools: { id: FreehandTool; label: string; shortcut: string; svg: React.ReactNode }[] = [
    { id: "select", label: t("freehand.tools.select"), shortcut: "V", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg> },
    { id: "hand", label: t("freehand.tools.hand"), shortcut: "H", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-6.5v-1a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V13m0-2a1.5 1.5 0 013 0v3a5 5 0 01-5 5h-1a5 5 0 01-4-2l-3-4"/></svg> },
    { id: "rectangle", label: t("freehand.tools.rectangle"), shortcut: "R", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: "diamond", label: t("freehand.tools.diamond"), shortcut: "D", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l10 10-10 10L2 12z"/></svg> },
    { id: "ellipse", label: t("freehand.tools.ellipse"), shortcut: "O", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="8"/></svg> },
    { id: "arrow", label: t("freehand.tools.arrow"), shortcut: "A", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> },
    { id: "line", label: t("freehand.tools.line"), shortcut: "L", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20L20 4"/></svg> },
    { id: "text", label: t("freehand.tools.text"), shortcut: "T", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg> },
    { id: "freehand", label: t("freehand.tools.freehand"), shortcut: "P", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
    { id: "eraser", label: t("freehand.tools.eraser"), shortcut: "E", svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L11 20"/><path d="M6 11l7 7"/></svg> },
  ];

  // Small style buttons used in the context panel
  const iconBtnCls = "w-6 h-6 flex items-center justify-center rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700";
  const iconBtnActiveCls = "w-6 h-6 flex items-center justify-center rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";

  // ─── Render ───
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative">
      {/* Toolbar — hidden in read-only mode */}
      {!readOnly && (
      <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          <button onClick={undo} disabled={!canUndo} title={`${t("freehand.undo")} (${t("freehand.undoShortcut")})`} aria-label={t("freehand.undo")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} title={`${t("freehand.redo")} (${t("freehand.redoShortcut")})`} aria-label={t("freehand.redo")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"/></svg>
          </button>
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
        </div>
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <button key={tool.id} onClick={() => setActiveTool(tool.id)}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${activeTool === tool.id ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title={`${tool.label} (${tool.shortcut})`} aria-label={tool.label}>{tool.svg}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={handleClear} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md" aria-label={t("freehand.clearAll")}>{t("freehand.clearAll")}</button>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{elements.length} {t("freehand.elements")}</span>
      </div>
      )}

      {/* Context panel — appears next to the selection (Excalidraw-style) */}
      {!readOnly && selectedIds.size > 0 && (() => {
        let bminX = Infinity, bminY = Infinity, bmaxX = -Infinity, bmaxY = -Infinity;
        for (const el of elements) {
          if (!selectedIds.has(el.id)) continue;
          bminX = Math.min(bminX, el.x); bminY = Math.min(bminY, el.y);
          bmaxX = Math.max(bmaxX, el.x + el.width); bmaxY = Math.max(bmaxY, el.y + el.height);
        }
        const sx = bminX * zoom + panOffset.x;
        const sy = bminY * zoom + panOffset.y;
        const sh = (bmaxY - bminY) * zoom;
        const sw = (bmaxX - bminX) * zoom;
        const single = selectedIds.size === 1 ? elements.find((el) => selectedIds.has(el.id)) : undefined;
        const isArrowLine = !!single && (single.type === "arrow" || single.type === "line");
        const isTextEl = !!single && single.type === "text";
        const isRect = !!single && single.type === "rectangle";
        const allShapes = elements.filter((el) => selectedIds.has(el.id)).every((el) => isShape(el));
        const showFill = allShapes && selectedIds.size > 0;
        const showWidth = !(selectedIds.size === 1 && isTextEl);
        const PANEL_W = 232;
        // Place the panel to the RIGHT of the selection (or LEFT if there's no room),
        // so it never overlaps the element being edited
        let left = sx + sw + 12;
        if (left + PANEL_W > canvasSize.width - 10) left = sx - PANEL_W - 12;
        left = Math.min(Math.max(left, 10), Math.max(10, canvasSize.width - PANEL_W - 10));
        // Vertically centered on the selection; clamped to the viewport (max-h-[70vh] prevents overflow)
        const EST_H = 280;
        let top = sy + sh / 2 - EST_H / 2;
        top = Math.min(Math.max(top, 10), Math.max(10, canvasSize.height - EST_H - 10));

        const alignActions: { id: string; label: string; run: () => void; svg: React.ReactNode }[] = [
          { id: "al", label: t("freehand.alignLeft"), run: () => alignSelected("x", "min"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h10M4 18h13"/></svg> },
          { id: "ach", label: t("freehand.alignCenterH"), run: () => alignSelected("x", "center"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M4 18h16"/></svg> },
          { id: "ar", label: t("freehand.alignRight"), run: () => alignSelected("x", "max"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M10 12h10M7 18h13"/></svg> },
          { id: "at", label: t("freehand.alignTop"), run: () => alignSelected("y", "min"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16M10 5v15M16 5v10"/></svg> },
          { id: "am", label: t("freehand.alignMiddle"), run: () => alignSelected("y", "center"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M8 4v16M16 8v8"/></svg> },
          { id: "ab", label: t("freehand.alignBottom"), run: () => alignSelected("y", "max"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19h16M10 4v15M16 9v10"/></svg> },
          { id: "dh", label: t("freehand.distributeH"), run: () => distributeSelected("x"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 7v10M12 4v16M19 7v10"/></svg> },
          { id: "dv", label: t("freehand.distributeV"), run: () => distributeSelected("y"), svg: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 5h10M4 12h16M7 19h10"/></svg> },
        ];

        return (
        <div className="absolute z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-h-[70vh] overflow-y-auto" style={{ top, left, width: PANEL_W }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {selectedIds.size > 1 ? `${selectedIds.size} ${t("freehand.elementsSelected")}` : t("freehand.style")}
            </span>
            <button onClick={handleDelete} className="text-xs text-red-600 hover:text-red-700 dark:text-red-400" aria-label={t("common.delete")}>{t("common.delete")}</button>
          </div>

          {/* Alignment & distribution (2+ selected) */}
          {selectedIds.size >= 2 && (
            <div className="mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              <div className="flex gap-1">
                {alignActions.map((a) => (
                  <button key={a.id} onClick={a.run} title={a.label} aria-label={a.label} className={iconBtnCls}>{a.svg}</button>
                ))}
              </div>
            </div>
          )}

          {/* Group / ungroup */}
          {(selectedIds.size >= 2 || allSameGroup) && (
            <div className="mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              {allSameGroup ? (
                <button onClick={ungroupSelected} title={t("freehand.ungroup")} className="w-full flex items-center gap-2 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7M17 14v7"/></svg>
                  {t("freehand.ungroup")}
                </button>
              ) : (
                <button onClick={groupSelected} title={t("freehand.group")} className="w-full flex items-center gap-2 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M8 10v1a3 3 0 003 3h3M16 8v-1a3 3 0 00-3-3h-3"/></svg>
                  {t("freehand.group")}
                </button>
              )}
            </div>
          )}

          {/* Stroke / text color */}
          <div className="mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{isTextEl ? t("freehand.textColor") : t("freehand.stroke")}</span>
            <div className="flex flex-wrap gap-1">
              {FREEHAND_COLORS.map((c) => (
                <button key={c} onClick={() => onStrokeColor(c)}
                  className={`w-5 h-5 rounded-full border-2 ${strokeColor === c ? "border-purple-500 scale-110" : "border-gray-300 dark:border-gray-600"}`}
                  style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
          </div>

          {/* Fill (shapes only) */}
          {showFill && (
            <div className="mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("freehand.fill")}</span>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => onFillColor("transparent")}
                  className={`w-5 h-5 rounded-full border-2 ${fillColor === "transparent" ? "border-purple-500 scale-110" : "border-gray-300 dark:border-gray-600"}`}
                  style={{ background: "repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 8px 8px" }} aria-label={t("freehand.noFill")} />
                {FREEHAND_COLORS.slice(0, 7).map((c) => (
                  <button key={c} onClick={() => onFillColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${fillColor === c ? "border-purple-500 scale-110" : "border-gray-300 dark:border-gray-600"}`}
                    style={{ backgroundColor: c }} aria-label={c} />
                ))}
              </div>
            </div>
          )}

          {/* Width (not for text) */}
          {showWidth && (
            <div className="mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("freehand.width")}</span>
              <div className="flex gap-1">
                {FREEHAND_STROKE_WIDTHS.map((w) => (
                  <button key={w} onClick={() => onStrokeWidth(w)}
                    className={`w-7 h-6 flex items-center justify-center rounded text-xs ${strokeWidth === w ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                    aria-label={`${w}px`}>{w}</button>
                ))}
              </div>
            </div>
          )}

          {/* Arrow / line options */}
          {isArrowLine && (
            <div className="mb-2">
              <div className="flex gap-1">
                <button onClick={() => toggleArrowProp("dashed")} title={t("freehand.dashed")} aria-label={t("freehand.dashed")}
                  className={single.dashed ? iconBtnActiveCls : iconBtnCls}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h5M10 12h5M18 12h4"/></svg>
                </button>
                <button onClick={() => toggleArrowProp("startArrowhead")} title={t("freehand.arrowStart")} aria-label={t("freehand.arrowStart")}
                  className={single.startArrowhead ? iconBtnActiveCls : iconBtnCls}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12H6M13 5l-7 7 7 7"/></svg>
                </button>
                <button onClick={() => toggleArrowProp("endArrowhead")} title={t("freehand.arrowEnd")} aria-label={t("freehand.arrowEnd")}
                  className={(single.type === "arrow" ? single.endArrowhead !== false : single.endArrowhead) ? iconBtnActiveCls : iconBtnCls}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h14M11 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* Rectangle border radius */}
          {isRect && (
            <div className="mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("freehand.borderRadius")}: {single.borderRadius || 0}px</span>
              <input type="range" min={0} max={32} value={single.borderRadius || 0} onChange={(e) => onBorderRadius(Number(e.target.value))} className="w-full accent-purple-600" />
            </div>
          )}

          {/* Text font size */}
          {isTextEl && (
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("freehand.fontSize")}: {single.fontSize || 16}px</span>
              <input type="range" min={10} max={36} value={single.fontSize || 16} onChange={(e) => onFontSize(Number(e.target.value))} className="w-full accent-purple-600" />
            </div>
          )}
        </div>
        );
      })()}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ cursor: getCursor() }}>
        <canvas ref={canvasRef}
          width={canvasSize.width * dpr} height={canvasSize.height * dpr}
          style={{ width: canvasSize.width, height: canvasSize.height }}
          className="absolute inset-0"
          onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onMouseLeave={() => { setHoveredId(null); setGuides([]); if (isPanning) setIsPanning(false); if (mode === "dragging") { setMode("idle"); dragBBoxRef.current = null; emit(elements); } if (mode === "endpoint") { setMode("idle"); setDraggingEndpointIdx(null); emit(elements); } if (mode === "drawing") { setMode("idle"); setDrawStart(null); setDrawCurrent(null); setFreehandPoints([]); } if (mode === "marquee") { setMode("idle"); setMarqueeRect(null); } if (mode === "erasing") { setMode("idle"); if (erasingDidEraseRef.current) emit(erasingElementsRef.current); erasingElementsRef.current = []; erasingDidEraseRef.current = false; } if (mode === "rotating") { setMode("idle"); rotationStartRef.current = null; emit(elements); } }}
        />
        {/* Inline text editor overlay */}
        {editingId && (() => {
          const el = elements.find((e) => e.id === editingId);
          if (!el) return null;
          const fs = el.fontSize || 16;
          const lines = Math.max(1, editingText.split("\n").length);
          const textW = Math.max(20, measureTextWidth(editingText || " ", fs, el.fontFamily) + 12);
          const textH = lines * fs * 1.25 + 4;
          const isTextType = el.type === "text";
          // Standalone text auto-sizes; shapes keep their box and center the editor inside it
          const boxW = isTextType ? textW : el.width;
          const boxH = isTextType ? textH : el.height;
          return (
            <div
              className="absolute flex items-center justify-center"
              style={{ left: el.x * zoom + panOffset.x, top: el.y * zoom + panOffset.y, width: boxW * zoom, height: boxH * zoom, pointerEvents: "none" }}
            >
              <textarea
                autoFocus
                value={editingText}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingText(val);
                  // Only standalone text elements auto-size; shapes keep their real size
                  if (el.type === "text") {
                    const linesN = val.split("\n").length;
                    const w = Math.max(20, measureTextWidth(val, fs, el.fontFamily) + 12);
                    setElements(elements.map((x) => (x.id === el.id ? { ...x, width: w, height: linesN * fs * 1.25 + 4 } : x)));
                  }
                }}
                onBlur={commitTextEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelTextEdit(); }
                }}
                rows={lines}
                className="bg-transparent text-center font-medium border-none outline-none resize-none overflow-hidden pointer-events-auto leading-snug"
                style={{ color: el.strokeColor || "#1e1e1e", fontSize: fs * zoom, width: textW * zoom, height: textH * zoom }}
              />
            </div>
          );
        })()}

        {/* Context Menu */}
        {contextMenu && selectedIds.size > 0 && (
          <div
            className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 w-44"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => { clipboardRef.current = elements.filter((el) => selectedIds.has(el.id)); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              {t("common.copy")}<span className="ml-auto text-[10px] text-gray-400">⌘C</span>
            </button>
            <button onClick={() => { clipboardRef.current = elements.filter((el) => selectedIds.has(el.id)); handleDelete(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M6 3v2M18 3v2M6 19v2M18 19v2M3 6h2M3 18h2M19 6h2M19 18h2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
              {t("common.cut")}<span className="ml-auto text-[10px] text-gray-400">⌘X</span>
            </button>
            <button onClick={() => { duplicateSelected(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>
              {t("freehand.duplicate")}
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button onClick={() => { bringToFront(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M5 11l7-7 7 7M5 19l7-7 7 7"/></svg>
              {t("freehand.bringToFront")}
            </button>
            <button onClick={() => { bringForward(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              {t("freehand.bringForward")}
            </button>
            <button onClick={() => { sendBackward(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
              {t("freehand.sendBackward")}
            </button>
            <button onClick={() => { sendToBack(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M5 13l7 7 7-7M5 5l7 7 7-7"/></svg>
              {t("freehand.sendToBack")}
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button onClick={() => { handleDelete(); setContextMenu(null); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              {t("common.delete")}<span className="ml-auto text-[10px] text-gray-400">Del</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
