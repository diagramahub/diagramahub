import { describe, expect, it } from "vitest";
import { fitFontSize, wrapText } from "../textLayout";

// Monospace stand-in: every character is 0.5 × the font size wide.
const measure = (text: string, fontSize: number) => text.length * fontSize * 0.5;

describe("wrapText", () => {
  it("keeps text that fits on one line", () => {
    expect(wrapText("hello", 100, 10, measure)).toEqual(["hello"]);
  });

  it("wraps words greedily without leading or trailing spaces", () => {
    // 10px font → 5px per char → 30px fits 6 chars
    expect(wrapText("one two three", 30, 10, measure)).toEqual(["one", "two", "three"]);
    expect(wrapText("ab cd ef gh", 30, 10, measure)).toEqual(["ab cd", "ef gh"]);
  });

  it("keeps explicit line breaks and empty lines", () => {
    expect(wrapText("a\n\nb", 100, 10, measure)).toEqual(["a", "", "b"]);
  });

  it("splits a word wider than the box by characters", () => {
    expect(wrapText("abcdefghij", 20, 10, measure)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("returns a single empty line for empty text", () => {
    expect(wrapText("", 50, 10, measure)).toEqual([""]);
  });
});

describe("fitFontSize", () => {
  it("uses the largest size when the text is short", () => {
    const fit = fitFontSize("Hi", 160, 160, measure, { min: 10, max: 28 });
    expect(fit.fontSize).toBe(28);
    expect(fit.lines).toEqual(["Hi"]);
  });

  it("shrinks long text until it fits the box", () => {
    const text = "This sticky note has quite a lot of words written on it to force shrinking";
    const fit = fitFontSize(text, 160, 160, measure, { min: 10, max: 28 });
    expect(fit.fontSize).toBeLessThan(28);
    expect(fit.lines.length * fit.fontSize * 1.25).toBeLessThanOrEqual(160);
    expect(fit.lines.every((l) => measure(l, fit.fontSize) <= 160)).toBe(true);
  });

  it("returns the minimum size when nothing fits", () => {
    const fit = fitFontSize("x ".repeat(500), 40, 40, measure, { min: 10, max: 20 });
    expect(fit.fontSize).toBe(10);
  });
});
