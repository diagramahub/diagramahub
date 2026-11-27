import { describe, expect, it } from "vitest";
import type { FreehandElement } from "../../types/freehand";
import { MAX_SKETCH_CONTEXT, conversionScope, sketchContext } from "../sketchScope";

const el = (over: Partial<FreehandElement>): FreehandElement =>
  ({ id: "x", type: "rectangle", x: 0, y: 0, width: 100, height: 50, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1, ...over }) as FreehandElement;
const arrow = (id: string, from: string, to: string, over: Partial<FreehandElement> = {}) =>
  el({ id, type: "arrow", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], startBinding: { elementId: from, anchorSide: "right" }, endBinding: { elementId: to, anchorSide: "left" }, ...over });

const scene = [
  el({ id: "a", text: "Pago" }),
  el({ id: "b", text: "Envío", x: 300 }),
  el({ id: "c", text: "Factura", x: 600 }),
  arrow("ab", "a", "b"),
  arrow("bc", "b", "c"),
  el({ id: "g1", text: "G1", groupId: "g" }),
  el({ id: "g2", text: "G2", groupId: "g" }),
];

describe("conversionScope", () => {
  it("covers everything when nothing is chosen", () => {
    expect(conversionScope(scene, [])).toHaveLength(scene.length);
  });

  it("adds the arrows between chosen elements, not the ones leaving the selection", () => {
    expect(conversionScope(scene, ["a", "b"]).map((e) => e.id)).toEqual(["a", "b", "ab"]);
  });

  it("brings in the rest of a group", () => {
    expect(conversionScope(scene, ["g1"]).map((e) => e.id)).toEqual(["g1", "g2"]);
  });
});

describe("sketchContext", () => {
  it("lists the structural draft and loose texts", () => {
    const ctx = sketchContext([...conversionScope(scene, ["a", "b"]), el({ id: "t", type: "text", text: "nota\nsuelta" }), el({ id: "e", type: "ellipse" })]);
    expect(ctx).toContain("Mermaid draft");
    expect(ctx).toContain('Pago["Pago"]');
    expect(ctx).toContain("Pago --> ");
    expect(ctx).toContain('Loose texts: "nota suelta"');
    expect(ctx).toContain("Shapes without text: 1");
  });

  it("is empty for strokes only, and bounded in size", () => {
    expect(sketchContext([el({ type: "freehand", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] })])).toBe("");
    const many = Array.from({ length: 2000 }, (_, i) => el({ id: `t${i}`, type: "text", text: `texto número ${i}` }));
    expect(sketchContext(many).length).toBeLessThanOrEqual(MAX_SKETCH_CONTEXT + 2);
  });
});
