/**
 * Copy and paste of sketch elements through the system clipboard, so they
 * travel between diagrams, tabs and windows (as text, like Excalidraw).
 *
 * The payload is JSON with a type marker. Images travel with their bytes (as
 * data URLs) so another diagram can store its own copy; their id is the
 * SHA-256 of the bytes, so storing them again keeps the same id.
 */

import type { FreehandElement, FreehandElementType } from "../types/freehand";

export const CLIPBOARD_TYPE = "diagramahub/freehand";

export interface FreehandClipboard {
  type: typeof CLIPBOARD_TYPE;
  version: 1;
  elements: FreehandElement[];
  /** Image bytes by file id (data URLs), when they were at hand. */
  files?: Record<string, string>;
}

const ELEMENT_TYPES: FreehandElementType[] = [
  "rectangle", "diamond", "ellipse", "arrow", "line", "text", "freehand", "sticky", "image",
];

const FILE_ID = /^[0-9a-f]{64}$/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

export function serializeClipboard(elements: FreehandElement[], files?: Record<string, string>): string {
  const payload: FreehandClipboard = { type: CLIPBOARD_TYPE, version: 1, elements };
  if (files && Object.keys(files).length > 0) payload.files = files;
  return JSON.stringify(payload);
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * The sketch elements in clipboard text, or null when it isn't a copy from
 * the canvas. Elements with an unknown type or broken geometry are dropped,
 * and only well-formed image files are kept.
 */
export function parseClipboard(text: string): FreehandClipboard | null {
  if (!text || !text.startsWith("{") || !text.includes(CLIPBOARD_TYPE)) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const raw = data as Partial<FreehandClipboard>;
  if (raw.type !== CLIPBOARD_TYPE || !Array.isArray(raw.elements)) return null;
  const elements = raw.elements.filter((el): el is FreehandElement =>
    !!el && typeof el === "object"
    && typeof el.id === "string"
    && ELEMENT_TYPES.includes(el.type)
    && finite(el.x) && finite(el.y) && finite(el.width) && finite(el.height)
    && (el.points === undefined || (Array.isArray(el.points) && el.points.every((p) => !!p && finite(p.x) && finite(p.y))))
    && (el.type !== "image" || (typeof el.fileId === "string" && FILE_ID.test(el.fileId))));
  if (elements.length === 0) return null;
  const files: Record<string, string> = {};
  if (raw.files && typeof raw.files === "object") {
    for (const [id, url] of Object.entries(raw.files)) {
      if (FILE_ID.test(id) && typeof url === "string" && IMAGE_DATA_URL.test(url)) files[id] = url;
    }
  }
  return { type: CLIPBOARD_TYPE, version: 1, elements, files };
}

/**
 * Copies of `elements` with new ids, moved by (dx, dy). Groups and arrow
 * bindings are kept among the copies (never pointing at the originals);
 * copies are never locked.
 */
export function cloneForPaste(
  elements: FreehandElement[],
  dx: number,
  dy: number,
  newId: () => string,
): FreehandElement[] {
  const ids = new Map(elements.map((el) => [el.id, newId()]));
  const groups = new Map<string, string>();
  return elements.map((el) => {
    if (el.groupId && !groups.has(el.groupId)) groups.set(el.groupId, newId());
    const rebind = (b: FreehandElement["startBinding"]) => (b && ids.has(b.elementId) ? { ...b, elementId: ids.get(b.elementId)! } : undefined);
    return {
      ...el,
      id: ids.get(el.id)!,
      groupId: el.groupId ? groups.get(el.groupId) : undefined,
      locked: undefined,
      x: el.x + dx,
      y: el.y + dy,
      points: el.points ? el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) : undefined,
      startBinding: rebind(el.startBinding),
      endBinding: rebind(el.endBinding),
    };
  });
}
