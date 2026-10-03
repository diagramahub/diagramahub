/**
 * Deterministic conversion of a freehand sketch into a Mermaid flowchart.
 *
 * No AI involved: shapes with text become nodes (rectangle `[ ]`, diamond
 * `{ }`, ellipse `( )`), and arrows bound to two shapes become edges, with
 * the arrow's own text as the edge label and dashed arrows as `-.->`.
 * Lines without heads become `---`, double-headed arrows `<-->`, and an
 * arrow bound twice to the same shape is a self-loop.
 * Anything that has no structural meaning (free strokes, unbound arrows,
 * loose text, shapes without text that nothing points to) is left out and
 * reported, so the caller can tell the user what was not converted.
 */

import type { FreehandElement } from "../types/freehand";

export interface SketchConversion {
  /** Mermaid source (`flowchart TD` …); empty string when nothing converts. */
  code: string;
  nodeCount: number;
  edgeCount: number;
  /** Machine-readable reasons, e.g. `skipped_freehand: 3`. */
  skipped: Record<string, number>;
}

type Shape = Extract<FreehandElement["type"], "rectangle" | "diamond" | "ellipse">;

const SHAPE_BRACKETS: Record<Shape, [string, string]> = {
  rectangle: ["[", "]"],
  diamond: ["{", "}"],
  ellipse: ["(", ")"],
};

/**
 * Words Mermaid reads as keywords when used as a node id (`end` closes a
 * subgraph, `style`/`class`/`click` start statements…): ids that match are
 * prefixed. Compared case-insensitively to be safe across Mermaid versions.
 */
const RESERVED_IDS = new Set([
  "end", "graph", "flowchart", "subgraph", "direction", "style", "linkstyle", "class", "classdef",
  "click", "call", "callback", "href", "default", "interpolate", "td", "tb", "bt", "lr", "rl",
]);

/** Mermaid node ids: letters/digits/underscore, not starting with a digit, not a keyword. */
function makeIdFactory(): (hint: string) => string {
  const used = new Set<string>();
  return (hint: string) => {
    let base = hint
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24);
    if (!base || /^\d/.test(base)) base = `n${base}`;
    if (RESERVED_IDS.has(base.toLowerCase())) base = `n_${base}`;
    let id = base;
    let counter = 2;
    while (used.has(id)) id = `${base}_${counter++}`;
    used.add(id);
    return id;
  };
}

/** Node/edge labels go in quotes so punctuation and line breaks survive. */
function quote(text: string): string {
  const oneLine = text.replace(/\s*\n\s*/g, "<br/>").trim();
  return `"${oneLine.replace(/"/g, "#quot;")}"`;
}

function parseSketch(content: string): FreehandElement[] {
  try {
    const data = JSON.parse(content) as { elements?: unknown };
    return Array.isArray(data.elements) ? (data.elements as FreehandElement[]) : [];
  } catch {
    return [];
  }
}

/** Reading order: top to bottom, then left to right (rows of ~40px). */
function readingOrder(a: FreehandElement, b: FreehandElement): number {
  const rowA = Math.round(a.y / 40);
  const rowB = Math.round(b.y / 40);
  return rowA === rowB ? a.x - b.x : rowA - rowB;
}

/** Pick the flow direction from the dominant orientation of the edges. */
function direction(edges: { from: FreehandElement; to: FreehandElement }[]): "TD" | "LR" {
  let horizontal = 0;
  let vertical = 0;
  for (const { from, to } of edges) {
    const dx = Math.abs(to.x + to.width / 2 - (from.x + from.width / 2));
    const dy = Math.abs(to.y + to.height / 2 - (from.y + from.height / 2));
    if (dx > dy) horizontal++;
    else vertical++;
  }
  return horizontal > vertical ? "LR" : "TD";
}

export function sketchToMermaid(content: string): SketchConversion {
  const elements = parseSketch(content);
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  const shapesById = new Map<string, FreehandElement>();
  for (const el of elements) {
    if (el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse") {
      shapesById.set(el.id, el);
    } else if (el.type === "freehand") skip("skipped_freehand");
    else if (el.type === "text") skip("skipped_text");
  }

  // Edges: arrows (or lines) bound at both ends to known shapes (a shape to
  // itself is a valid self-loop). Arrowheads follow the canvas renderer's
  // defaults: an arrow shows its end head unless `endArrowhead === false`,
  // a line shows a head only when explicitly set.
  const edges: { from: FreehandElement; to: FreehandElement; label?: string; dashed: boolean; heads: "one" | "both" | "none" }[] = [];
  for (const el of elements) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const from = el.startBinding && shapesById.get(el.startBinding.elementId);
    const to = el.endBinding && shapesById.get(el.endBinding.elementId);
    if (!from || !to) {
      skip("skipped_unbound_arrow");
      continue;
    }
    const startHead = !!el.startArrowhead;
    const endHead = el.type === "arrow" ? el.endArrowhead !== false : !!el.endArrowhead;
    // Only a start head: the edge points the other way.
    const reversed = startHead && !endHead;
    edges.push({
      from: reversed ? to : from,
      to: reversed ? from : to,
      label: el.text?.trim() || undefined,
      dashed: !!el.dashed,
      heads: startHead && endHead ? "both" : startHead || endHead ? "one" : "none",
    });
  }

  // Nodes: shapes with text, plus untitled shapes that take part in an edge.
  const connected = new Set(edges.flatMap((e) => [e.from.id, e.to.id]));
  const nodes = [...shapesById.values()]
    .filter((shape) => {
      if (shape.text?.trim() || connected.has(shape.id)) return true;
      skip("skipped_untitled_shape");
      return false;
    })
    .sort(readingOrder);

  if (nodes.length === 0) {
    return { code: "", nodeCount: 0, edgeCount: 0, skipped };
  }

  const makeId = makeIdFactory();
  const ids = new Map<string, string>();
  const lines: string[] = [`flowchart ${direction(edges)}`];
  for (const node of nodes) {
    const label = node.text?.trim() || "";
    const id = makeId(label || "node");
    ids.set(node.id, id);
    const [open, close] = SHAPE_BRACKETS[node.type as Shape];
    // An untitled shape that takes part in an edge is drawn without text
    lines.push(`    ${id}${open}${label ? quote(label) : '" "'}${close}`);
  }
  if (edges.length > 0) lines.push("");
  for (const edge of edges) {
    const arrow = {
      one: edge.dashed ? "-.->" : "-->",
      both: edge.dashed ? "<-.->" : "<-->",
      none: edge.dashed ? "-.-" : "---",
    }[edge.heads];
    const label = edge.label ? `|${quote(edge.label)}|` : "";
    lines.push(`    ${ids.get(edge.from.id)} ${arrow}${label} ${ids.get(edge.to.id)}`);
  }

  return { code: lines.join("\n") + "\n", nodeCount: nodes.length, edgeCount: edges.length, skipped };
}
