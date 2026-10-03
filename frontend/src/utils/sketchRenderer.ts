/**
 * Hand-drawn rendering for the freehand canvas.
 *
 * - Shapes, lines and arrows use roughjs (MIT). Each element is turned ONCE
 *   into native Path2D objects (from `generator.toPaths`) in its LOCAL
 *   coordinates (origin = el.x, el.y) and cached: painting a frame is then a
 *   few ctx.stroke/fill calls per element instead of replaying roughjs
 *   operations, and moving an element (pan, drag, nudge) reuses its entry
 *   because the position is not part of the key. A per-element `seed` keeps
 *   the strokes stable.
 * - Freehand strokes use perfect-freehand (MIT): the raw pointer points
 *   (with pen pressure when available) become a filled outline polygon with
 *   variable width, also cached as a Path2D in local coordinates.
 *
 * Elements without `roughness` are not handled here: the canvas renders them
 * with clean geometry, exactly as before 0.8.0.
 */

import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import { getStroke } from "perfect-freehand";
import type { FreehandElement, FreehandPoint } from "../types/freehand";

const generator = rough.generator();

interface SketchPath {
  path: Path2D;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  /** Outline strokes of dashed elements (never hachure fill lines or arrowheads) */
  dashed: boolean;
}

const cache = new Map<string, SketchPath[]>();
const strokeCache = new Map<string, Path2D>();
const CACHE_LIMIT = 4000;

/** Arrowhead length, in world units (matches the clean renderer). */
const HEAD_LENGTH = 12;

/** Insert into a bounded cache: drop the oldest tenth instead of clearing it all. */
function remember<T>(store: Map<string, T>, key: string, value: T): T {
  if (store.size >= CACHE_LIMIT) {
    let toDrop = Math.ceil(CACHE_LIMIT / 10);
    for (const oldKey of store.keys()) {
      store.delete(oldKey);
      if (--toDrop === 0) break;
    }
  }
  store.set(key, value);
  return value;
}

function roughOptions(el: FreehandElement): Options {
  const fill = el.fillColor && el.fillColor !== "transparent" ? el.fillColor : undefined;
  const strokeWidth = el.strokeWidth || 2;
  const roughness = el.roughness ?? 1;
  return {
    seed: el.seed ?? 1,
    roughness,
    bowing: roughness === 0 ? 0 : 1,
    stroke: el.strokeColor || "#1e1e1e",
    strokeWidth,
    fill,
    fillStyle: el.fillStyle ?? "hachure",
    fillWeight: strokeWidth / 2,
    hachureGap: strokeWidth * 4,
    hachureAngle: -41,
    // Architect style draws each line once; the rougher styles double-stroke.
    disableMultiStroke: roughness === 0,
    preserveVertices: true,
  };
}

/** Points of a line/arrow relative to the element origin. */
function localPoints(el: FreehandElement): FreehandPoint[] {
  const pts = el.points || [{ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height }];
  return pts.map((p) => ({ x: p.x - el.x, y: p.y - el.y }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function cacheKey(el: FreehandElement): string {
  const pts = el.type === "arrow" || el.type === "line"
    ? localPoints(el).map((p) => `${round2(p.x)},${round2(p.y)}`).join(";")
    : "";
  return [
    el.type, el.width, el.height, el.strokeColor, el.fillColor, el.strokeWidth,
    el.roughness, el.fillStyle, el.seed, el.dashed ? 1 : 0, el.borderRadius ?? 0,
    el.startArrowhead ? 1 : 0, el.endArrowhead === false ? 0 : 1, pts,
  ].join("|");
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`, `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h - radius}`, `Q ${x + w} ${y + h} ${x + w - radius} ${y + h}`,
    `L ${x + radius} ${y + h}`, `Q ${x} ${y + h} ${x} ${y + h - radius}`,
    `L ${x} ${y + radius}`, `Q ${x} ${y} ${x + radius} ${y}`,
    "Z",
  ].join(" ");
}

function arrowHead(tip: FreehandPoint, tail: FreehandPoint, options: Options): Drawable {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const left: [number, number] = [tip.x - HEAD_LENGTH * Math.cos(angle - Math.PI / 6), tip.y - HEAD_LENGTH * Math.sin(angle - Math.PI / 6)];
  const right: [number, number] = [tip.x - HEAD_LENGTH * Math.cos(angle + Math.PI / 6), tip.y - HEAD_LENGTH * Math.sin(angle + Math.PI / 6)];
  return generator.linearPath([left, [tip.x, tip.y], right], { ...options, fill: undefined });
}

/** roughjs drawables for an element, in local coordinates (origin = el.x, el.y). */
function localDrawables(el: FreehandElement, options: Options): { drawable: Drawable; outline: boolean }[] {
  const w = el.width, h = el.height;
  switch (el.type) {
    case "rectangle":
      return [{
        drawable: el.borderRadius
          ? generator.path(roundedRectPath(0, 0, w, h, el.borderRadius), options)
          : generator.rectangle(0, 0, w, h, options),
        outline: true,
      }];
    case "diamond":
      return [{ drawable: generator.polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]], options), outline: true }];
    case "ellipse":
      return [{ drawable: generator.ellipse(w / 2, h / 2, w, h, options), outline: true }];
    case "arrow":
    case "line": {
      const pts = localPoints(el);
      if (pts.length < 2) return [];
      const lineOptions: Options = { ...options, fill: undefined };
      const out = [{ drawable: generator.linearPath(pts.map((p) => [p.x, p.y] as [number, number]), lineOptions), outline: true }];
      const showStart = !!el.startArrowhead;
      const showEnd = el.type === "arrow" ? el.endArrowhead !== false : !!el.endArrowhead;
      if (showEnd) out.push({ drawable: arrowHead(pts[pts.length - 1], pts[pts.length - 2], lineOptions), outline: false });
      if (showStart) out.push({ drawable: arrowHead(pts[0], pts[1], lineOptions), outline: false });
      return out;
    }
    default:
      return [];
  }
}

/** Build (or reuse) the paths of a sketchy shape, line or arrow (local coordinates). */
export function sketchPaths(el: FreehandElement): SketchPath[] {
  const key = cacheKey(el);
  const hit = cache.get(key);
  if (hit) return hit;
  const options = roughOptions(el);
  const paths: SketchPath[] = [];
  for (const { drawable, outline } of localDrawables(el, options)) {
    for (const info of generator.toPaths(drawable)) {
      const isFill = !!info.fill && info.fill !== "none";
      paths.push({
        path: new Path2D(info.d),
        stroke: info.stroke && info.stroke !== "none" ? info.stroke : undefined,
        strokeWidth: info.strokeWidth,
        fill: isFill ? info.fill : undefined,
        // Only the outline itself is dashed (hachure lines are drawn in the fill colour)
        dashed: !!el.dashed && outline && !isFill && info.stroke === options.stroke,
      });
    }
  }
  return remember(cache, key, paths);
}

/** Paint a sketchy shape/line/arrow on the context's current transform. */
export function drawSketchy(ctx: CanvasRenderingContext2D, el: FreehandElement): void {
  const paths = sketchPaths(el);
  if (paths.length === 0) return;
  const width = el.strokeWidth || 2;
  ctx.save();
  ctx.translate(el.x, el.y);
  for (const p of paths) {
    if (p.fill) {
      ctx.fillStyle = p.fill;
      ctx.fill(p.path);
    }
    if (p.stroke) {
      ctx.strokeStyle = p.stroke;
      ctx.lineWidth = p.strokeWidth ?? 1;
      ctx.setLineDash(p.dashed ? [width * 3, width * 3] : []);
      ctx.stroke(p.path);
    }
  }
  ctx.restore();
}

/**
 * Outline polygon of a freehand stroke (perfect-freehand). Pen pressure is
 * used when the points carry it; mouse input gets simulated pressure.
 */
export function strokeOutline(points: FreehandPoint[], strokeWidth: number): number[][] {
  const hasPressure = points.some((p) => typeof p.pressure === "number");
  return getStroke(
    points.map((p) => [p.x, p.y, p.pressure ?? 0.5]),
    {
      size: Math.max(1, strokeWidth) * 2.2,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure: !hasPressure,
      last: true,
    },
  );
}

function outlinePath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length < 2) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    // Quadratic midpoints give a smooth outline without visible corners.
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

/** Fill a perfect-freehand outline on the canvas (live preview while drawing). */
export function drawStrokeOutline(ctx: CanvasRenderingContext2D, outline: number[][], color: string): void {
  if (outline.length < 2) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill(outlinePath(outline));
  ctx.restore();
}

/** Paint a committed freehand stroke: its outline is computed once and reused. */
export function drawStrokeElement(ctx: CanvasRenderingContext2D, el: FreehandElement): void {
  const pts = el.points || [];
  if (pts.length < 2) return;
  const width = el.strokeWidth || 2;
  const rel = (p: FreehandPoint) => `${round2(p.x - el.x)},${round2(p.y - el.y)},${p.pressure ?? ""}`;
  const key = [el.id, width, pts.length, rel(pts[0]), rel(pts[pts.length >> 1]), rel(pts[pts.length - 1]), el.width, el.height].join("|");
  let path = strokeCache.get(key);
  if (!path) {
    const local = pts.map((p) => ({ ...p, x: p.x - el.x, y: p.y - el.y }));
    path = remember(strokeCache, key, outlinePath(strokeOutline(local, width)));
  }
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.fillStyle = el.strokeColor || "#1e1e1e";
  ctx.fill(path);
  ctx.restore();
}

/** Preview drawable for a shape being drawn (fixed seed so it doesn't flicker). */
export const PREVIEW_SEED = 7;

/** Test hook: number of cached sketch entries. */
export function sketchCacheSize(): number {
  return cache.size;
}
