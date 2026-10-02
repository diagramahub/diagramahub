/**
 * Geometry for exporting a freehand sketch as PNG (pure, no DOM).
 *
 * - `exportBounds` measures what is actually painted: rotated shape/text
 *   corners, stroke width, arrow/line/stroke points and arrow labels, so the
 *   offscreen canvas never clips a rotated or wide element.
 * - `fitExportScale` keeps the offscreen canvas inside what browsers can
 *   allocate (elements on the infinite canvas can be far apart, and imported
 *   sketches may carry huge coordinates): the scale is reduced, never the content.
 */

import type { FreehandElement, FreehandPoint } from "../types/freehand";

export interface Bounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** Margin around the content (also absorbs rough strokes' overshoot and arrowheads). */
export const EXPORT_PADDING = 24;
/** Longest side of the PNG, in pixels (well under every browser's canvas limit). */
export const MAX_EXPORT_SIDE = 8192;
/** Total pixels of the PNG (≈ the 16.7 MP canvas limit of Safari/iOS). */
export const MAX_EXPORT_AREA = 16_777_216;

const CHAR_WIDTH_RATIO = 0.6; // rough average glyph width / font size

function rotate(p: FreehandPoint, cx: number, cy: number, rad: number): FreehandPoint {
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos };
}

/** Points that enclose everything an element paints (before stroke/label margins). */
function paintedPoints(el: FreehandElement): FreehandPoint[] {
  if (el.points && el.points.length > 0) return el.points;
  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height },
  ];
  if (!el.rotation) return corners;
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const rad = (el.rotation * Math.PI) / 180;
  return corners.map((c) => rotate(c, cx, cy, rad));
}

/** Bounding box of the painted content, padded; null for an empty sketch. */
export function exportBounds(elements: FreehandElement[], padding = EXPORT_PADDING): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const extend = (x: number, y: number, margin: number) => {
    minX = Math.min(minX, x - margin); minY = Math.min(minY, y - margin);
    maxX = Math.max(maxX, x + margin); maxY = Math.max(maxY, y + margin);
  };
  for (const el of elements) {
    const pts = paintedPoints(el);
    if (pts.length === 0) continue;
    const stroke = (el.strokeWidth || 2) / 2;
    for (const p of pts) {
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) extend(p.x, p.y, stroke);
    }
    // Text can render wider than its stored box (e.g. after a font change).
    if (el.text) {
      const fontSize = el.fontSize || 16;
      const lines = el.text.split("\n");
      const textW = Math.max(...lines.map((l) => l.length)) * fontSize * CHAR_WIDTH_RATIO;
      const textH = lines.length * fontSize * 1.25;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      extend(cx, cy, 0);
      minX = Math.min(minX, cx - textW / 2); maxX = Math.max(maxX, cx + textW / 2);
      minY = Math.min(minY, cy - textH / 2); maxY = Math.max(maxY, cy + textH / 2);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX: minX - padding, minY: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 };
}

/** Largest scale ≤ `requested` that keeps the PNG within the side and area limits. */
export function fitExportScale(width: number, height: number, requested: number): number {
  const w = Math.max(1, width), h = Math.max(1, height);
  return Math.min(requested, MAX_EXPORT_SIDE / w, MAX_EXPORT_SIDE / h, Math.sqrt(MAX_EXPORT_AREA / (w * h)));
}
