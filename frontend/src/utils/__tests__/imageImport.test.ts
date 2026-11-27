import { describe, expect, it } from "vitest";
import { fitWithin, isInsertableImage } from "../imageImport";

describe("fitWithin", () => {
  it("keeps small images as they are", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("shrinks the longest side to the maximum, keeping the ratio", () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(1000, 5000, 480)).toEqual({ width: 96, height: 480 });
  });

  it("never returns a zero side", () => {
    expect(fitWithin(10_000, 1, 100)).toEqual({ width: 100, height: 1 });
    expect(fitWithin(0, 0, 100)).toEqual({ width: 100, height: 100 });
  });
});

describe("isInsertableImage", () => {
  it("accepts raster types and refuses SVG and others", () => {
    expect(isInsertableImage({ type: "image/png" })).toBe(true);
    expect(isInsertableImage({ type: "image/webp" })).toBe(true);
    expect(isInsertableImage({ type: "image/svg+xml" })).toBe(false);
    expect(isInsertableImage({ type: "text/plain" })).toBe(false);
  });
});
