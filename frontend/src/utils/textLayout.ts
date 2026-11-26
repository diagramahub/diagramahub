/**
 * Text layout for the freehand canvas (pure: the caller passes the width
 * measurement, so it runs without a DOM in tests).
 *
 * - `wrapText` breaks text into lines that fit a width: explicit line breaks
 *   are kept, words wrap greedily and a word longer than the width is split
 *   by characters.
 * - `fitFontSize` picks the largest font size (between a min and a max) at
 *   which the wrapped text fits a box: sticky notes shrink their text as it
 *   grows, like Miro.
 */

/** Width of `text` at `fontSize`, in the same units as the box. */
export type MeasureFn = (text: string, fontSize: number) => number;

/** Lines of `text` at `fontSize` that fit `maxWidth` (at least one line). */
export function wrapText(text: string, maxWidth: number, fontSize: number, measure: MeasureFn): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (maxWidth <= 0 || measure(paragraph, fontSize) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue;
      const candidate = line + word;
      if (measure(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (/^\s+$/.test(word)) {
        // The space that doesn't fit ends the line (and isn't carried over)
        lines.push(line);
        line = "";
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      // A word wider than the box is split by characters
      if (measure(word, fontSize) > maxWidth) {
        for (const ch of word) {
          if (line && measure(line + ch, fontSize) > maxWidth) {
            lines.push(line);
            line = "";
          }
          line += ch;
        }
      } else {
        line = word;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
}

export interface FittedText {
  fontSize: number;
  lines: string[];
}

/**
 * Largest font size in [min, max] whose wrapped lines fit `width` × `height`
 * (with `lineHeight` as a multiple of the font size). When even `min` doesn't
 * fit, `min` is returned and the text overflows the box.
 */
export function fitFontSize(
  text: string,
  width: number,
  height: number,
  measure: MeasureFn,
  { min = 10, max = 28, lineHeight = 1.25 }: { min?: number; max?: number; lineHeight?: number } = {},
): FittedText {
  for (let size = max; size > min; size -= 1) {
    const lines = wrapText(text, width, size, measure);
    const fitsHeight = lines.length * size * lineHeight <= height;
    const fitsWidth = lines.every((l) => measure(l, size) <= width);
    if (fitsHeight && fitsWidth) return { fontSize: size, lines };
  }
  return { fontSize: min, lines: wrapText(text, width, min, measure) };
}
