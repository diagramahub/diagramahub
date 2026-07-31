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
type InteractionMode = "idle" | "drawing" | "dragging" | "resizing" | "marquee" | "endpoint";

export default function FreehandCanvas({ initialState, onChange, zoom = 1, onZoomChange, readOnly = false }: FreehandCanvasProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Core state
  const [elements, setElements] = useState<FreehandElement[]>(() => parseCanvasState(initialState).elements);
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

  // ─── Emit changes ───
  const emit = useCallback((els: FreehandElement[]) => {
    onChange?.(JSON.stringify({ version: 1, elements: els, viewport: { zoom: 1, scrollX: 0, scrollY: 0 }, background }));
  }, [onChange, background]);

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
    let moved = elements.map((e) => {
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
    // Update arrows connected to moved elements
    moved = moved.map((e) => {
      if (e.type !== "arrow" && e.type !== "line") return e;
      if (ids.has(e.id)) return e; // already moved
      let changed = false;
      const pts = [...(e.points || [])];
      if (e.startBinding && ids.has(e.startBinding.elementId)) {
        const target = moved.find((t) => t.id === e.startBinding!.elementId)!;
        pts[0] = getAnchorPoint(target, e.startBinding!.anchorSide);
        changed = true;
      }
      if (e.endBinding && ids.has(e.endBinding.elementId)) {
        const target = moved.find((t) => t.id === e.endBinding!.elementId)!;
        pts[pts.length - 1] = getAnchorPoint(target, e.endBinding!.anchorSide);
        changed = true;
      }
      if (!changed) return e;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      return { ...e, points: pts, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 };
    });
    return moved;
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
          // Resize handles (only single-select)
          if (selectedIds.size === 1) {
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
          // Anchor points for shapes
          if (isShape(el)) {
            for (const side of ["top", "bottom", "left", "right"] as ConnectionBinding["anchorSide"][]) {
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
      else if (activeTool === "arrow" || activeTool === "line") { ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y); ctx.lineTo(drawCurrent.x, drawCurrent.y); ctx.stroke(); }
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
  }, [elements, selectedIds, canvasSize, dpr, background, hoveredAnchor, marqueeRect, mode, drawStart, drawCurrent, activeTool, strokeColor, strokeWidth, freehandPoints, editingId, panOffset, zoom]);

  useEffect(() => { draw(); }, [draw]);

  function renderElement(ctx: CanvasRenderingContext2D, el: FreehandElement) {
    switch (el.type) {
      case "rectangle":
        if (el.fillColor && el.fillColor !== "transparent") ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeRect(el.x, el.y, el.width, el.height); break;
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
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        if (el.type === "arrow") {
          const last = pts[pts.length - 1], prev = pts[pts.length - 2];
          const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
          ctx.beginPath();
          ctx.moveTo(last.x, last.y); ctx.lineTo(last.x - 12 * Math.cos(angle - Math.PI / 6), last.y - 12 * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(last.x, last.y); ctx.lineTo(last.x - 12 * Math.cos(angle + Math.PI / 6), last.y - 12 * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
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
      ctx.fillText(el.text, el.x + el.width / 2, el.y + el.height / 2);
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

    // Middle-click or Space+click for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const pos = getPos(e);

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
        // 2) Check resize handles on shapes (not arrows)
        if (selEl && selEl.type !== "arrow" && selEl.type !== "line") {
          const h = getHandle(pos, selEl);
          if (h) {
            setMode("resizing"); setResizeHandle(h);
            setResizeOrigin({ x: pos.x, y: pos.y, elX: selEl.x, elY: selEl.y, elW: selEl.width, elH: selEl.height, elPoints: selEl.points ? [...selEl.points] : undefined });
            return;
          }
        }
      }
      // 2) Check if clicking on an element
      const hit = [...elements].reverse().find((el) => hitTest(pos, el));
      if (hit) {
        if (e.shiftKey) {
          // Toggle in multi-selection
          setSelectedIds((prev) => { const s = new Set(prev); if (s.has(hit.id)) s.delete(hit.id); else s.add(hit.id); return s; });
        } else {
          if (!selectedIds.has(hit.id)) setSelectedIds(new Set([hit.id]));
        }
        setMode("dragging"); setDragOffset({ x: pos.x, y: pos.y });
      } else {
        // 3) Start marquee on empty space
        if (!e.shiftKey) setSelectedIds(new Set());
        setMode("marquee"); setDrawStart(pos); setMarqueeRect(null);
      }
      return;
    }

    if (activeTool === "eraser") {
      const hit = [...elements].reverse().find((el) => hitTest(pos, el));
      if (hit) {
        const updated = elements.filter((el) => el.id !== hit.id && el.startBinding?.elementId !== hit.id && el.endBinding?.elementId !== hit.id);
        setElements(updated); emit(updated);
        setSelectedIds((prev) => { const s = new Set(prev); s.delete(hit.id); return s; });
      }
      return;
    }

    if (activeTool === "text") {
      const text = prompt(t("freehand.enterText") || "Enter text:");
      if (text) {
        const nel: FreehandElement = { id: generateId(), type: "text", x: pos.x, y: pos.y, width: text.length * 9, height: 20, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, text, fontSize: 16, fontFamily: "sans-serif" };
        const updated = [...elements, nel];
        setElements(updated); emit(updated);
        setSelectedIds(new Set([nel.id])); setActiveTool("select");
      }
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

    if (mode === "dragging") {
      const dx = pos.x - dragOffset.x, dy = pos.y - dragOffset.y;
      const moved = moveElements(selectedIds, dx, dy);
      setElements(moved); setDragOffset({ x: pos.x, y: pos.y });
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
      setElements(elements.map((el) => {
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
      }));
      return;
    }

    if (mode === "marquee" && drawStart) {
      const x = Math.min(drawStart.x, pos.x), y = Math.min(drawStart.y, pos.y);
      setMarqueeRect({ x, y, w: Math.abs(pos.x - drawStart.x), h: Math.abs(pos.y - drawStart.y) });
      return;
    }

    if (mode === "drawing") {
      setDrawCurrent(pos);
      if (activeTool === "freehand") setFreehandPoints((prev) => [...prev, pos]);
      // Arrow anchor snapping
      if (activeTool === "arrow" || activeTool === "line") {
        const near = [...elements].reverse().find((el) => isShape(el) && hitTest(pos, el));
        if (near) setHoveredAnchor({ elementId: near.id, side: closestAnchorSide(near, pos) });
        else setHoveredAnchor(null);
      }
    }
  };

  // ─── Pointer Up ───
  const handlePointerUp = (e: React.MouseEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    const pos = getPos(e);

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

    if (mode === "dragging") { setMode("idle"); emit(elements); return; }
    if (mode === "resizing") { setMode("idle"); setResizeHandle(null); setResizeOrigin(null); emit(elements); return; }
    if (mode === "endpoint") {
      // Snap endpoint to anchor if hovering one
      if (hoveredAnchor && draggingEndpointIdx !== null && selectedIds.size === 1) {
        const elId = [...selectedIds][0];
        const targetEl = elements.find((el) => el.id === hoveredAnchor.elementId);
        if (targetEl) {
          const anchorPt = getAnchorPoint(targetEl, hoveredAnchor.side);
          setElements(elements.map((el) => {
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
          }));
        }
      }
      setMode("idle"); setDraggingEndpointIdx(null); setHoveredAnchor(null); emit(elements); return;
    }

    if (mode !== "drawing" || !drawStart) { setMode("idle"); return; }

    // Finalize drawing
    let newEl: FreehandElement | null = null;
    if (activeTool === "freehand") {
      const pts = freehandPoints;
      if (pts.length >= 2) {
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        newEl = { id: generateId(), type: "freehand", x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, points: pts };
      }
    } else if (activeTool === "arrow" || activeTool === "line") {
      let startBinding: ConnectionBinding | undefined, endBinding: ConnectionBinding | undefined;
      let sp = drawStart, ep = pos;
      const startShape = elements.find((el) => isShape(el) && hitTest(drawStart, el));
      const endShape = hoveredAnchor ? elements.find((el) => el.id === hoveredAnchor.elementId) : elements.find((el) => isShape(el) && hitTest(pos, el));
      if (startShape) { const side = closestAnchorSide(startShape, drawStart); startBinding = { elementId: startShape.id, anchorSide: side }; sp = getAnchorPoint(startShape, side); }
      if (endShape && endShape.id !== startShape?.id) { const side = hoveredAnchor?.elementId === endShape.id ? hoveredAnchor.side : closestAnchorSide(endShape, pos); endBinding = { elementId: endShape.id, anchorSide: side }; ep = getAnchorPoint(endShape, side); }
      newEl = { id: generateId(), type: activeTool, x: Math.min(sp.x, ep.x), y: Math.min(sp.y, ep.y), width: Math.abs(ep.x - sp.x) || 1, height: Math.abs(ep.y - sp.y) || 1, strokeColor, fillColor: "transparent", strokeWidth, opacity: 1, points: [sp, ep], endArrowhead: activeTool === "arrow", startBinding, endBinding };
    } else {
      const x = Math.min(drawStart.x, pos.x), y = Math.min(drawStart.y, pos.y);
      const w = Math.abs(pos.x - drawStart.x), h = Math.abs(pos.y - drawStart.y);
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
    setMode("idle"); setDrawStart(null); setDrawCurrent(null); setFreehandPoints([]); setHoveredAnchor(null);
  };

  // ─── Double-click to edit text inside elements ───
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool !== "select") return;
    const pos = getPos(e);
    const hit = [...elements].reverse().find((el) => hitTest(pos, el));
    if (hit) {
      setEditingId(hit.id);
      setEditingText(hit.text || "");
    }
  };

  const commitTextEdit = () => {
    if (!editingId) return;
    const updated = elements.map((el) =>
      el.id === editingId ? { ...el, text: editingText || undefined } : el,
    );
    setElements(updated);
    emit(updated);
    setEditingId(null);
    setEditingText("");
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
  const duplicateSelected = () => {
    if (selectedIds.size === 0) return;
    const newIds = new Set<string>();
    const duped = elements.filter((el) => selectedIds.has(el.id)).map((el) => {
      const nid = generateId();
      newIds.add(nid);
      return { ...el, id: nid, x: el.x + 20, y: el.y + 20, points: el.points?.map((p) => ({ x: p.x + 20, y: p.y + 20 })), startBinding: undefined, endBinding: undefined };
    });
    const updated = [...elements, ...duped];
    setElements(updated); emit(updated); setSelectedIds(newIds);
  };

  // ─── Delete ───
  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const updated = elements.filter((el) => !selectedIds.has(el.id) && (!el.startBinding || !selectedIds.has(el.startBinding.elementId)) && (!el.endBinding || !selectedIds.has(el.endBinding.elementId)));
    setElements(updated); emit(updated); setSelectedIds(new Set());
  }, [elements, selectedIds, emit]);

  // ─── Keyboard ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0 && document.activeElement === document.body) { e.preventDefault(); handleDelete(); }
      if (e.key === "Escape") { setSelectedIds(new Set()); setActiveTool("select"); setMode("idle"); }
      // Ctrl/Cmd+A select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && activeTool === "select") { e.preventDefault(); setSelectedIds(new Set(elements.map((el) => el.id))); }
      // Ctrl/Cmd+C copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = elements.filter((el) => selectedIds.has(el.id)).map((el) => ({ ...el }));
      }
      // Ctrl/Cmd+X cut
      if ((e.ctrlKey || e.metaKey) && e.key === "x" && selectedIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = elements.filter((el) => selectedIds.has(el.id)).map((el) => ({ ...el }));
        handleDelete();
      }
      // Ctrl/Cmd+V paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboardRef.current.length > 0) {
        e.preventDefault();
        const copied = clipboardRef.current;
        // Calculate centroid of copied elements
        const cx = copied.reduce((s, el) => s + el.x + el.width / 2, 0) / copied.length;
        const cy = copied.reduce((s, el) => s + el.y + el.height / 2, 0) / copied.length;
        // Offset to paste at cursor position
        const dx = mousePosRef.current.x - cx;
        const dy = mousePosRef.current.y - cy;
        const newIds = new Set<string>();
        const idMap = new Map<string, string>(); // old id -> new id
        const pasted: FreehandElement[] = copied.map((el) => {
          const newId = generateId();
          idMap.set(el.id, newId);
          const pEl: FreehandElement = {
            ...el,
            id: newId,
            x: el.x + dx,
            y: el.y + dy,
            points: el.points ? el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) : undefined,
            // Clear bindings (pasted arrows are disconnected)
            startBinding: undefined,
            endBinding: undefined,
          };
          newIds.add(newId);
          return pEl;
        });
        const updated = [...elements, ...pasted];
        setElements(updated);
        emit(updated);
        setSelectedIds(newIds);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, handleDelete, elements, activeTool, emit]);

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
    }
  }, [zoom, onZoomChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleClear = () => { setElements([]); emit([]); setSelectedIds(new Set()); };

  // ─── Cursor ───
  const getCursor = (): string => {
    if (isPanning) return "grabbing";
    if (mode === "resizing" && resizeHandle) return resizeCursor[resizeHandle];
    if (mode === "dragging") return "grabbing";
    if (activeTool === "select") return "default";
    if (activeTool === "eraser") return "not-allowed";
    return "crosshair";
  };

  // ─── Tools config ───
  const tools: { id: FreehandTool; label: string; svg: React.ReactNode }[] = [
    { id: "select", label: t("freehand.tools.select"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg> },
    { id: "rectangle", label: t("freehand.tools.rectangle"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: "diamond", label: t("freehand.tools.diamond"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l10 10-10 10L2 12z"/></svg> },
    { id: "ellipse", label: t("freehand.tools.ellipse"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="8"/></svg> },
    { id: "arrow", label: t("freehand.tools.arrow"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> },
    { id: "line", label: t("freehand.tools.line"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20L20 4"/></svg> },
    { id: "text", label: t("freehand.tools.text"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg> },
    { id: "freehand", label: t("freehand.tools.freehand"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
    { id: "eraser", label: t("freehand.tools.eraser"), svg: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L11 20"/><path d="M6 11l7 7"/></svg> },
  ];

  // ─── Render ───
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative">
      {/* Toolbar — hidden in read-only mode */}
      {!readOnly && (
      <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <button key={tool.id} onClick={() => setActiveTool(tool.id)}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${activeTool === tool.id ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title={tool.label} aria-label={tool.label}>{tool.svg}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={handleClear} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md" aria-label={t("freehand.clearAll")}>{t("freehand.clearAll")}</button>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{elements.length} {t("freehand.elements")}</span>
      </div>
      )}

      {/* Floating style panel */}
      {!readOnly && selectedIds.size > 0 && (
        <div className="absolute top-14 left-4 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {selectedIds.size > 1 ? `${selectedIds.size} ${t("freehand.elementsSelected")}` : t("freehand.style")}
            </span>
            <button onClick={handleDelete} className="text-xs text-red-600 hover:text-red-700 dark:text-red-400" aria-label={t("common.delete")}>{t("common.delete")}</button>
          </div>
          {/* Stroke */}
          <div className="mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("freehand.stroke")}</span>
            <div className="flex flex-wrap gap-1">
              {FREEHAND_COLORS.map((c) => (
                <button key={c} onClick={() => onStrokeColor(c)}
                  className={`w-5 h-5 rounded-full border-2 ${strokeColor === c ? "border-purple-500 scale-110" : "border-gray-300 dark:border-gray-600"}`}
                  style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
          </div>
          {/* Fill */}
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
          {/* Width */}
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("freehand.width")}</span>
            <div className="flex gap-1">
              {FREEHAND_STROKE_WIDTHS.map((w) => (
                <button key={w} onClick={() => onStrokeWidth(w)}
                  className={`w-7 h-6 flex items-center justify-center rounded text-xs ${strokeWidth === w ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  aria-label={`${w}px`}>{w}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ cursor: getCursor() }}>
        <canvas ref={canvasRef}
          width={canvasSize.width * dpr} height={canvasSize.height * dpr}
          style={{ width: canvasSize.width, height: canvasSize.height }}
          className="absolute inset-0"
          onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onMouseLeave={() => { if (isPanning) setIsPanning(false); if (mode === "dragging") { setMode("idle"); emit(elements); } if (mode === "endpoint") { setMode("idle"); setDraggingEndpointIdx(null); emit(elements); } if (mode === "drawing") { setMode("idle"); setDrawStart(null); setDrawCurrent(null); setFreehandPoints([]); } if (mode === "marquee") { setMode("idle"); setMarqueeRect(null); } }}
        />
        {/* Inline text editor overlay */}
        {editingId && (() => {
          const el = elements.find((e) => e.id === editingId);
          if (!el) return null;
          return (
            <div
              className="absolute flex items-center justify-center"
              style={{ left: el.x * zoom + panOffset.x, top: el.y * zoom + panOffset.y, width: el.width * zoom, height: el.height * zoom, pointerEvents: "none" }}
            >
              <input
                type="text"
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={commitTextEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitTextEdit(); if (e.key === "Escape") { setEditingId(null); setEditingText(""); } }}
                className="bg-transparent text-center text-sm font-medium border-none outline-none w-full px-1 pointer-events-auto"
                style={{ color: el.strokeColor || "#1e1e1e", fontSize: el.fontSize || 14 }}
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
