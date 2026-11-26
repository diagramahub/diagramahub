/**
 * What a freehand → diagram conversion covers, and what the canvas can tell
 * the AI about it.
 *
 * - `conversionScope`: the chosen elements, plus their whole groups and the
 *   arrows/lines that connect two of them (a selection rarely includes the
 *   arrows on purpose).
 * - `sketchContext`: the scope as text for the AI (the structural Mermaid
 *   draft plus loose texts and arrow labels), so it copies exact texts and
 *   links instead of reading them from handwriting in the picture.
 */

import type { FreehandElement } from "../types/freehand";
import { elementsToMermaid } from "./sketchToMermaid";

/** Elements a conversion of `ids` covers (all of them when `ids` is empty), in scene order. */
export function conversionScope(elements: FreehandElement[], ids: Iterable<string>): FreehandElement[] {
  const inScope = new Set(ids);
  if (inScope.size === 0) return elements;
  const groups = new Set(elements.filter((el) => inScope.has(el.id) && el.groupId).map((el) => el.groupId));
  for (const el of elements) if (el.groupId && groups.has(el.groupId)) inScope.add(el.id);
  for (const el of elements) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const from = el.startBinding?.elementId, to = el.endBinding?.elementId;
    if (from && to && inScope.has(from) && inScope.has(to)) inScope.add(el.id);
  }
  return elements.filter((el) => inScope.has(el.id));
}

/** Longest context sent to the AI (the API accepts 12,000 characters). */
export const MAX_SKETCH_CONTEXT = 11_000;

const quoted = (text: string) => `"${text.replace(/\s*\n\s*/g, " ").trim()}"`;

/** The scope as text for the AI; empty when the elements carry no text or structure. */
export function sketchContext(elements: FreehandElement[]): string {
  const parts: string[] = [];
  const draft = elementsToMermaid(elements);
  if (draft.nodeCount > 0) parts.push(`Shapes and connected arrows (Mermaid draft):\n${draft.code.trim()}`);
  const loose = elements.filter((el) => el.type === "text" && el.text?.trim()).map((el) => quoted(el.text!));
  if (loose.length > 0) parts.push(`Loose texts: ${loose.join(", ")}`);
  const labels = elements
    .filter((el) => (el.type === "arrow" || el.type === "line") && el.text?.trim() && !(el.startBinding && el.endBinding))
    .map((el) => quoted(el.text!));
  if (labels.length > 0) parts.push(`Labels of unconnected arrows: ${labels.join(", ")}`);
  const unlabelled = elements.filter((el) => (el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse" || el.type === "sticky") && !el.text?.trim()).length;
  if (unlabelled > 0) parts.push(`Shapes without text: ${unlabelled}`);
  const text = parts.join("\n\n");
  return text.length > MAX_SKETCH_CONTEXT ? `${text.slice(0, MAX_SKETCH_CONTEXT)}\n…` : text;
}
