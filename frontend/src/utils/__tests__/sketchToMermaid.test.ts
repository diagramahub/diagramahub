import { describe, expect, it } from "vitest";
import { sketchToMermaid } from "../sketchToMermaid";

const shape = (id: string, type: "rectangle" | "diamond" | "ellipse", x: number, y: number, text?: string) => ({
  id, type, x, y, width: 120, height: 60, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1, text,
});
const arrow = (id: string, from: string, to: string, extra: Record<string, unknown> = {}) => ({
  id, type: "arrow", x: 0, y: 0, width: 1, height: 1, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1,
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], endArrowhead: true,
  startBinding: { elementId: from, anchorSide: "right" }, endBinding: { elementId: to, anchorSide: "left" }, ...extra,
});
const sketch = (elements: unknown[]) => JSON.stringify({ version: 1, elements, viewport: { zoom: 1, scrollX: 0, scrollY: 0 }, background: "#fff" });

describe("sketchToMermaid", () => {
  it("maps shapes to node brackets and bound arrows to edges, top-down", () => {
    const result = sketchToMermaid(sketch([
      shape("a", "ellipse", 0, 0, "Inicio"),
      shape("b", "diamond", 0, 100, "¿Pago ok?"),
      shape("c", "rectangle", 0, 200, "Enviar pedido"),
      arrow("e1", "a", "b"),
      arrow("e2", "b", "c", { text: "sí", dashed: true }),
    ]));
    expect(result.code).toBe([
      "flowchart TD",
      '    Inicio("Inicio")',
      '    Pago_ok{"¿Pago ok?"}',
      '    Enviar_pedido["Enviar pedido"]',
      "",
      "    Inicio --> Pago_ok",
      '    Pago_ok -.->|"sí"| Enviar_pedido',
      "",
    ].join("\n"));
    expect(result.nodeCount).toBe(3);
    expect(result.edgeCount).toBe(2);
    expect(result.skipped).toEqual({});
  });

  it("uses LR when the edges run mostly sideways and keeps untitled connected shapes", () => {
    const result = sketchToMermaid(sketch([
      shape("a", "rectangle", 0, 0, "A"),
      shape("b", "rectangle", 300, 0),
      arrow("e", "a", "b"),
    ]));
    expect(result.code.startsWith("flowchart LR\n")).toBe(true);
    expect(result.code).toContain('    node[" "]');
    expect(result.code).toContain("    A --> node");
  });

  it("skips strokes, loose text, unbound arrows and untitled isolated shapes, and reports them", () => {
    const result = sketchToMermaid(sketch([
      shape("a", "rectangle", 0, 0, "Solo"),
      shape("lonely", "ellipse", 0, 300),
      { id: "s", type: "freehand", x: 0, y: 0, width: 1, height: 1, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1, points: [] },
      { id: "t", type: "text", x: 0, y: 0, width: 1, height: 1, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1, text: "nota" },
      { ...arrow("free", "a", "nowhere"), endBinding: undefined },
    ]));
    expect(result.code).toBe('flowchart TD\n    Solo["Solo"]\n');
    expect(result.skipped).toEqual({ skipped_freehand: 1, skipped_text: 1, skipped_unbound_arrow: 1, skipped_untitled_shape: 1 });
  });

  it("reverses an edge whose arrowhead is only at the start, and de-duplicates ids", () => {
    const result = sketchToMermaid(sketch([
      shape("a", "rectangle", 0, 0, "Paso"),
      shape("b", "rectangle", 0, 100, "Paso"),
      shape("c", "rectangle", 0, 200, "123 go!"),
      arrow("e", "a", "b", { startArrowhead: true, endArrowhead: false }),
    ]));
    expect(result.code).toContain('    Paso["Paso"]\n    Paso_2["Paso"]\n    n123_go["123 go!"]');
    expect(result.code).toContain("    Paso_2 --> Paso");
  });

  it("escapes quotes and line breaks in labels", () => {
    const result = sketchToMermaid(sketch([shape("a", "rectangle", 0, 0, 'Say "hi"\nnow')]));
    expect(result.code).toContain('["Say #quot;hi#quot;<br/>now"]');
  });

  it("returns an empty conversion for invalid or empty sketches", () => {
    expect(sketchToMermaid("not json")).toEqual({ code: "", nodeCount: 0, edgeCount: 0, skipped: {} });
    expect(sketchToMermaid(sketch([])).code).toBe("");
  });

  it("prefixes ids that are Mermaid keywords (end, style, class…)", () => {
    const result = sketchToMermaid(sketch([
      shape("a", "ellipse", 0, 0, "start"),
      shape("b", "ellipse", 0, 100, "end"),
      shape("c", "rectangle", 0, 200, "Style"),
      shape("d", "rectangle", 0, 300, "click"),
      arrow("e1", "a", "b"),
    ]));
    expect(result.code).toContain('    n_end("end")');
    expect(result.code).toContain('    n_Style["Style"]');
    expect(result.code).toContain('    n_click["click"]');
    expect(result.code).toContain("    start --> n_end");
    expect(result.code).not.toMatch(/^\s+end[[({ ]/m);
  });

  it("maps lines to ---, double-headed arrows to <-->, keeps self-loops and the default end head", () => {
    const line = { ...arrow("l", "a", "b"), type: "line", endArrowhead: undefined };
    const both = arrow("both", "b", "c", { startArrowhead: true });
    const legacy = { ...arrow("legacy", "c", "a"), endArrowhead: undefined }; // arrow: end head by default
    const self = arrow("self", "a", "a", { text: "reintentar" });
    const dashedLine = { ...arrow("dl", "a", "c"), type: "line", endArrowhead: undefined, dashed: true };
    const result = sketchToMermaid(sketch([
      shape("a", "rectangle", 0, 0, "A"),
      shape("b", "rectangle", 0, 100, "B"),
      shape("c", "rectangle", 0, 200, "C"),
      line, both, legacy, self, dashedLine,
    ]));
    expect(result.code).toContain("    A --- B");
    expect(result.code).toContain("    B <--> C");
    expect(result.code).toContain("    C --> A");
    expect(result.code).toContain('    A -->|"reintentar"| A');
    expect(result.code).toContain("    A -.- C");
    expect(result.edgeCount).toBe(5);
    expect(result.skipped).toEqual({});
  });
});
