export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Split `text` into parts, marking every case-insensitive occurrence of
 * `needle` (matched literally). Rendered as text nodes, so nothing is parsed
 * as HTML.
 */
export function highlightParts(text: string, needle: string): HighlightPart[] {
  const target = needle.trim().toLowerCase();
  if (!target) return [{ text, match: false }];
  const parts: HighlightPart[] = [];
  const lower = text.toLowerCase();
  let from = 0;
  for (let at = lower.indexOf(target); at >= 0; at = lower.indexOf(target, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + target.length), match: true });
    from = at + target.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
