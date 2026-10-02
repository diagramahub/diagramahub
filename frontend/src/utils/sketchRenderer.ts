/**
 * Hand-drawn rendering for the freehand canvas.
 *
 * - Shapes, lines and arrows use roughjs (MIT): each element becomes a
 *   `Drawable` (a list of stroke/fill operations) generated once and cached,
 *   so redraws only replay operations instead of re-randomising the sketch.
 *   A per-element `seed` keeps the strokes stable between redraws.
 * - Freehand strokes use perfect-freehand (MIT): the raw pointer points
 *   (with pen pressure when available) become a filled outline polygon with
 *   variable width, instead of a plain polyline.
 *
 * Elements without `roughness` are not handled here: the canvas renders them
 * with clean geometry, exactly as before 0.8.0.
 */

import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { getStroke } from "perfect-freehand";
import type { FreehandElement, FreehandPoint } from "../types/freehand";

const generator = rough.generator();

// Drawable cache: key -> drawables (a shape plus optional arrowheads).
const cache = new Map<string, Drawable[]>();
const CACHE_LIMIT = 4000;

/** Arrowhead length, in world units (matches the clean renderer). */
const HEAD_LENGTH = 12;

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
    strokeLineDash: el.dashed ? [strokeWidth * 3, strokeWidth * 3] : undefined,
    preserveVertices: true,
  };
}

function cacheKey(el: FreehandElement): string {
  const pts = el.points ? el.points.map((p) => `${p.x},${p.y}`).join(";") : "";
  return [
    el.id, el.type, el.x, el.y, el.width, el.height, el.strokeColor, el.fillColor, el.strokeWidth,
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
  return generator.linearPath([left, [tip.x, tip.y], right], { ...options, fill: undefined, strokeLineDash: undefined });
}

/** Build (or reuse) the rough drawables for a sketchy shape, line or arrow. */
export function sketchDrawables(el: FreehandElement): Drawable[] {
  const key = cacheKey(el);
  const hit = cache.get(key);
  if (hit) return hit;

  const options = roughOptions(el);
  let drawables: Drawable[] = [];
  switch (el.type) {
    case "rectangle":
      drawables = [
        el.borderRadius
          ? generator.path(roundedRectPath(el.x, el.y, el.width, el.height, el.borderRadius), options)
          : generator.rectangle(el.x, el.y, el.width, el.height, options),
      ];
      break;
    case "diamond": {
      const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
      drawables = [generator.polygon([[cx, el.y], [el.x + el.width, cy], [cx, el.y + el.height], [el.x, cy]], options)];
      break;
    }
    case "ellipse":
      drawables = [generator.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, options)];
      break;
    case "arrow":
    case "line": {
      const pts = el.points || [{ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height }];
      if (pts.length < 2) break;
      const lineOptions: Options = { ...options, fill: undefined };
      drawables = [generator.linearPath(pts.map((p) => [p.x, p.y] as [number, number]), lineOptions)];
      const showStart = !!el.startArrowhead;
      const showEnd = el.type === "arrow" ? el.endArrowhead !== false : !!el.endArrowhead;
      if (showEnd) drawables.push(arrowHead(pts[pts.length - 1], pts[pts.length - 2], lineOptions));
      if (showStart) drawables.push(arrowHead(pts[0], pts[1], lineOptions));
      break;
    }
    default:
      break;
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, drawables);
  return drawables;
}

/** Draw a sketchy element with roughjs on the canvas' current transform. */
export function drawSketchy(rc: RoughCanvas, el: FreehandElement): void {
  for (const drawable of sketchDrawables(el)) rc.draw(drawable);
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

/** Fill a perfect-freehand outline on the canvas. */
export function drawStrokeOutline(ctx: CanvasRenderingContext2D, outline: number[][], color: string): void {
  if (outline.length < 2) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    // Quadratic midpoints give a smooth outline without visible corners.
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A rough canvas bound to the element (cheap; rough draws with the ctx's transform). */
export function roughCanvasFor(canvas: HTMLCanvasElement): RoughCanvas {
  return rough.canvas(canvas);
}

/** Preview drawable for a shape being drawn (fixed seed so it doesn't flicker). */
export const PREVIEW_SEED = 7;

/** Test hook: number of cached drawables. */
export function sketchCacheSize(): number {
  return cache.size;
}
