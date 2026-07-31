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
}

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
  borderRadius?: number;
  rotation?: number;
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
