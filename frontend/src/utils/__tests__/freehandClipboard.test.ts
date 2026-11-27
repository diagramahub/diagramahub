import { describe, expect, it } from "vitest";
import type { FreehandElement } from "../../types/freehand";
import { cloneForPaste, parseClipboard, serializeClipboard } from "../freehandClipboard";

const el = (over: Partial<FreehandElement>): FreehandElement =>
  ({ id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1, ...over }) as FreehandElement;
const FILE = "a".repeat(64);

describe("freehand clipboard", () => {
  it("round-trips elements and image files", () => {
    const text = serializeClipboard([el({}), el({ id: "i", type: "image", fileId: FILE })], { [FILE]: "data:image/webp;base64,AAAA" });
    const parsed = parseClipboard(text)!;
    expect(parsed.elements.map((e) => e.id)).toEqual(["a", "i"]);
    expect(parsed.files).toEqual({ [FILE]: "data:image/webp;base64,AAAA" });
  });

  it("ignores text that isn't a canvas copy", () => {
    expect(parseClipboard("hello")).toBeNull();
    expect(parseClipboard('{"type":"other","elements":[]}')).toBeNull();
    expect(parseClipboard('{"type":"diagramahub/freehand", broken')).toBeNull();
  });

  it("drops unknown types, broken geometry, bad image ids and unsafe files", () => {
    const text = JSON.stringify({
      type: "diagramahub/freehand",
      version: 1,
      elements: [
        el({ id: "ok" }),
        el({ id: "bad-type", type: "script" as FreehandElement["type"] }),
        el({ id: "nan", x: Number.NaN }),
        el({ id: "img", type: "image", fileId: "../../etc" }),
      ],
      files: { [FILE]: "data:image/svg+xml;base64,PHN2Zz4=", ["b".repeat(64)]: "javascript:alert(1)" },
    });
    const parsed = parseClipboard(text)!;
    expect(parsed.elements.map((e) => e.id)).toEqual(["ok"]);
    expect(parsed.files).toEqual({});
  });

  it("clones with new ids, keeping groups and bindings among the copies", () => {
    let n = 0;
    const newId = () => `n${++n}`;
    const copies = cloneForPaste([
      el({ id: "s1", groupId: "g", locked: true }),
      el({ id: "s2", groupId: "g" }),
      el({ id: "ar", type: "arrow", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], startBinding: { elementId: "s1", anchorSide: "right" }, endBinding: { elementId: "elsewhere", anchorSide: "left" } }),
    ], 100, 50, newId);
    const [c1, c2, arrow] = copies;
    expect(c1.id).not.toBe("s1");
    expect(c1.groupId).toBe(c2.groupId);
    expect(c1.groupId).not.toBe("g");
    expect(c1.locked).toBeUndefined();
    expect(c1.x).toBe(100);
    expect(arrow.points![1]).toEqual({ x: 105, y: 55 });
    expect(arrow.startBinding).toEqual({ elementId: c1.id, anchorSide: "right" });
    expect(arrow.endBinding).toBeUndefined();
  });
});
