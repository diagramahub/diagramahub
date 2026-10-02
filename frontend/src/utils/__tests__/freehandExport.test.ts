import { describe, expect, it } from "vitest";
import type { FreehandElement } from "../../types/freehand";
import { EXPORT_PADDING, MAX_EXPORT_AREA, MAX_EXPORT_SIDE, exportBounds, fitExportScale } from "../freehandExport";

const el = (over: Partial<FreehandElement>): FreehandElement =>
  ({ id: "e", type: "rectangle", x: 0, y: 0, width: 100, height: 20, strokeColor: "#000", fillColor: "transparent", strokeWidth: 2, opacity: 1, ...over }) as FreehandElement;

describe("exportBounds", () => {
  it("returns null for an empty sketch", () => {
    expect(exportBounds([])).toBeNull();
  });

  it("pads the box and includes the stroke", () => {
    const b = exportBounds([el({})])!;
    expect(b.minX).toBe(-1 - EXPORT_PADDING);
    expect(b.width).toBe(102 + EXPORT_PADDING * 2);
  });

  it("uses the rotated corners of a shape", () => {
    // A 400x20 bar rotated 90° is 20 wide and 400 tall around its centre (200, 10).
    const b = exportBounds([el({ width: 400, height: 20, rotation: 90 })], 0)!;
    expect(b.height).toBeCloseTo(402, 5);
    expect(b.minY).toBeCloseTo(10 - 200 - 1, 5);
    expect(b.width).toBeCloseTo(22, 5);
  });

  it("covers a 45° rotated square's corners", () => {
    const b = exportBounds([el({ width: 100, height: 100, rotation: 45, strokeWidth: 0.0001 })], 0)!;
    expect(b.width).toBeCloseTo(100 * Math.SQRT2, 1);
  });

  it("uses arrow points and widens for a long label", () => {
    const arrow = el({ type: "arrow", x: 0, y: 0, width: 20, height: 0, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], text: "a fairly long label", fontSize: 20 });
    const b = exportBounds([arrow], 0)!;
    expect(b.width).toBeGreaterThan(19 * 20 * 0.6 - 1);
  });

  it("spans far-apart elements", () => {
    const b = exportBounds([el({}), el({ id: "f", x: 100_000, y: 50_000 })], 0)!;
    expect(b.width).toBeGreaterThan(100_000);
    expect(b.height).toBeGreaterThan(50_000);
  });
});

describe("fitExportScale", () => {
  it("keeps the requested scale for normal sketches", () => {
    expect(fitExportScale(1200, 800, 2)).toBe(2);
  });

  it("caps the longest side", () => {
    const s = fitExportScale(100_000, 100, 3);
    expect(100_000 * s).toBeLessThanOrEqual(MAX_EXPORT_SIDE + 1e-6);
  });

  it("caps the total area (with the canvas' floored pixel size)", () => {
    for (const [w, h] of [[6000, 6000], [60_098, 30_098], [12_345, 6_789]]) {
      const s = fitExportScale(w, h, 3);
      expect(Math.floor(w * s) * Math.floor(h * s)).toBeLessThanOrEqual(MAX_EXPORT_AREA);
    }
  });
});
