/**
 * Diagram code accumulator for streamed AI responses.
 *
 * Buffers streamed content and extracts diagram code from marker delimiters.
 * Handles marker normalization (Spanish variants), fenced code block cleanup,
 * truncated streams, and fallback detection.
 */

/** Result of diagram code extraction from accumulated text. */
export interface AccumulatorResult {
  /** Text to display in the chat bubble (without diagram markers). */
  displayText: string;
  /** Extracted diagram code, or null if none detected. */
  diagramCode: string | null;
}

// Marker constants
const DIAGRAM_START = '<<<DIAGRAM>>>';
const DIAGRAM_END = '<<<END_DIAGRAM>>>';

/**
 * Extract diagram code from the full accumulated response text.
 *
 * Handles:
 * 1. Complete markers (<<<DIAGRAM>>> ... <<<END_DIAGRAM>>>)
 * 2. Spanish marker variants (<<<DIAGRAMA>>>, <<<FIN_DIAGRAMA>>>, <<<END_DIAGRAMA>>>)
 * 3. Fenced code blocks inside markers (removes them)
 * 4. Truncated streams (start marker only, no end marker)
 * 5. Fallback: fenced code blocks matching the diagram type (>20 chars)
 *
 * @param fullText - The complete accumulated text from the stream
 * @param diagramType - The current diagram type (mermaid, plantuml, d2, dbml)
 * @returns Object with displayText and extracted diagramCode (or null)
 */
export function extractDiagramCode(
  fullText: string,
  diagramType: string,
): AccumulatorResult {
  // Normalize Spanish marker variants to English
  let normalized = fullText;
  normalized = normalized.replace(/<<<DIAGRAMA>>>/g, DIAGRAM_START);
  normalized = normalized.replace(/<<<FIN_DIAGRAMA>>>/g, DIAGRAM_END);
  normalized = normalized.replace(/<<<END_DIAGRAMA>>>/g, DIAGRAM_END);

  // Remove fenced code block syntax inside markers
  normalized = normalized.replace(
    /<<<DIAGRAM>>>\s*\n?```\w*\s*\n?/g,
    '<<<DIAGRAM>>>\n',
  );
  normalized = normalized.replace(
    /\n?```\s*\n?<<<END_DIAGRAM>>>/g,
    '\n<<<END_DIAGRAM>>>',
  );

  const startIdx = normalized.indexOf(DIAGRAM_START);
  const endIdx = normalized.indexOf(DIAGRAM_END);

  // Case 1: Both markers present — extract code between them
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const code = normalized
      .slice(startIdx + DIAGRAM_START.length, endIdx)
      .trim();
    const before = normalized.slice(0, startIdx).trim();
    const after = normalized.slice(endIdx + DIAGRAM_END.length).trim();

    const parts = [before, after].filter((p) => p.length > 3);
    const displayText =
      parts.length > 0
        ? parts.join('\n\n')
        : '';

    return { displayText, diagramCode: code || null };
  }

  // Case 2: Only start marker (truncated stream) — treat rest as code
  if (startIdx !== -1 && endIdx === -1) {
    const code = normalized.slice(startIdx + DIAGRAM_START.length).trim();
    const before = normalized.slice(0, startIdx).trim();
    const displayText = before || '';
    return { displayText, diagramCode: code || null };
  }

  // Case 3: Fallback — detect fenced code blocks matching diagram type
  const typePattern = [diagramType, 'mermaid', 'plantuml', 'd2', 'dbml']
    .filter((t, i, arr) => arr.indexOf(t) === i) // deduplicate
    .join('|');
  const codeBlockRegex = new RegExp(
    '```(?:' + typePattern + ')?\\s*\\n([\\s\\S]*?)```',
  );
  const match = normalized.match(codeBlockRegex);
  if (match && match[1].trim().length > 20) {
    return { displayText: normalized, diagramCode: match[1].trim() };
  }

  // No diagram code detected
  return { displayText: normalized, diagramCode: null };
}

/**
 * Check if the accumulated text contains a complete diagram code block.
 * Useful during streaming to know when extraction can be performed.
 *
 * @param accumulatedText - The text accumulated so far
 * @returns true if both start and end markers are present
 */
export function hasDiagramMarkers(accumulatedText: string): boolean {
  const normalized = accumulatedText
    .replace(/<<<DIAGRAMA>>>/g, DIAGRAM_START)
    .replace(/<<<FIN_DIAGRAMA>>>/g, DIAGRAM_END)
    .replace(/<<<END_DIAGRAMA>>>/g, DIAGRAM_END);

  return (
    normalized.includes(DIAGRAM_START) && normalized.includes(DIAGRAM_END)
  );
}

/**
 * Check if the accumulated text has started a diagram block but not finished it.
 * Useful for showing a "Generating code…" phase indicator.
 *
 * @param accumulatedText - The text accumulated so far
 * @returns true if start marker is present but end marker is not
 */
export function isDiagramInProgress(accumulatedText: string): boolean {
  const normalized = accumulatedText
    .replace(/<<<DIAGRAMA>>>/g, DIAGRAM_START)
    .replace(/<<<FIN_DIAGRAMA>>>/g, DIAGRAM_END)
    .replace(/<<<END_DIAGRAMA>>>/g, DIAGRAM_END);

  return (
    normalized.includes(DIAGRAM_START) && !normalized.includes(DIAGRAM_END)
  );
}
