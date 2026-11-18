import { renderDiagram } from '../../utils/diagramRenderer';
import { sanitizeSvg } from '../../utils/sanitize';

// Rendered, sanitized SVGs by cache key (publication id + updated_at): grids
// re-mount cards when filtering or paging, and the detail page reuses them.
const svgCache = new Map<string, string | null>();

/** Render a publication's diagram once per cache key; null when it can't be rendered. */
export async function loadCommunitySvg(cacheKey: string, content: string, diagramType: string): Promise<string | null> {
  if (svgCache.has(cacheKey)) return svgCache.get(cacheKey) ?? null;
  try {
    const result = await renderDiagram(content, diagramType);
    const svg = 'svg' in result ? sanitizeSvg(result.svg) : null;
    svgCache.set(cacheKey, svg);
    return svg;
  } catch {
    return null;
  }
}
