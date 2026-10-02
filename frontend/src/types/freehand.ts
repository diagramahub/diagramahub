/**
 * TypeScript types for freehand/whiteboard diagram canvas.
 * Elements are serialized as JSON and stored in the diagram content field.
 */

export type FreehandElementType =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "text"
  | "freehand";

export interface FreehandPoint {
  x: number;
  y: number;
  /** Pen/stylus pressure 0..1 for freehand strokes (absent for mouse input). */
  pressure?: number;
}

/**
 * Hand-drawn look. Elements without `roughness` render with clean geometry
 * (every drawing made before 0.8.0); new elements get the sketchy style.
 * 0 = architect (precise), 1 = artist, 2 = cartoonist.
 */
export type SketchRoughness = 0 | 1 | 2;
export type SketchFillStyle = "solid" | "hachure" | "cross-hatch";
export type FreehandFontFamily = "hand" | "sans-serif" | "monospace";

export interface FreehandElement {
  id: string;
  type: FreehandElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  points?: FreehandPoint[]; // For arrows, lines, and freehand paths
  startArrowhead?: boolean;
  endArrowhead?: boolean;
  dashed?: boolean;
  borderRadius?: number;
  rotation?: number;
  groupId?: string;
  // Hand-drawn style (see SketchRoughness); undefined = clean rendering
  roughness?: SketchRoughness;
  fillStyle?: SketchFillStyle;
  /** Stable seed so the sketchy strokes don't change on every redraw. */
  seed?: number;
  // Connection bindings (for arrows/lines)
  startBinding?: ConnectionBinding;
  endBinding?: ConnectionBinding;
}

/** Describes how an arrow endpoint is attached to a shape. */
export interface ConnectionBinding {
  elementId: string; // ID of the shape this endpoint is connected to
  anchorSide: "top" | "bottom" | "left" | "right" | "center";
}

export interface FreehandCanvasState {
  version: 1;
  elements: FreehandElement[];
  viewport: {
    zoom: number;
    scrollX: number;
    scrollY: number;
  };
  background: string;
}

export type FreehandTool =
  | "select"
  | "hand"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "text"
  | "freehand"
  | "eraser";

export const DEFAULT_CANVAS_STATE: FreehandCanvasState = {
  version: 1,
  elements: [],
  viewport: {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  },
  background: "#ffffff",
};

export const FREEHAND_COLORS = [
  "#1e1e1e", // Black
  "#e03131", // Red
  "#2f9e44", // Green
  "#1971c2", // Blue
  "#f08c00", // Orange
  "#6741d9", // Purple
  "#0c8599", // Teal
  "#e8590c", // Deep Orange
  "#ffffff", // White
];

export const FREEHAND_STROKE_WIDTHS = [1, 2, 3, 5, 8];

/** CSS font stacks for the text font selector. "hand" is the bundled handwriting font. */
export const FREEHAND_FONT_FAMILIES: Record<FreehandFontFamily, string> = {
  hand: '"Caveat", "Segoe Print", "Bradley Hand", cursive',
  "sans-serif": "sans-serif",
  monospace: '"Source Code Pro", Menlo, Consolas, monospace',
};

/** Resolve a stored fontFamily (new key or legacy CSS value) to a CSS font stack. */
export function fontStackFor(fontFamily: string | undefined): string {
  if (!fontFamily) return FREEHAND_FONT_FAMILIES["sans-serif"];
  return (FREEHAND_FONT_FAMILIES as Record<string, string>)[fontFamily] ?? fontFamily;
}

/** Default style of newly created elements (existing drawings keep their look). */
export const DEFAULT_SKETCH_STYLE = { roughness: 1 as SketchRoughness, fillStyle: "hachure" as SketchFillStyle };

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
