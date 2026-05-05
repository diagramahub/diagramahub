import mermaid from 'mermaid';
import api from '../services/api';

/**
 * Centralized diagram rendering utility.
 *
 * Routes rendering to the correct method based on diagram type:
 * - Mermaid types → client-side rendering via the `mermaid` library
 * - Server-rendered types (plantuml, uml, d2) → backend Render Endpoint via Kroki
 */

export const MERMAID_TYPES = [
  'mermaid',
  'flowchart',
  'sequence',
  'class',
  'state',
  'er',
  'gantt',
  'pie',
  'journey',
  'gitgraph',
];

export const SERVER_RENDERED_TYPES = ['plantuml', 'uml', 'd2', 'dbml'];

export function isMermaidType(diagramType: string): boolean {
  return MERMAID_TYPES.includes(diagramType.toLowerCase());
}

export function isServerRenderedType(diagramType: string): boolean {
  return SERVER_RENDERED_TYPES.includes(diagramType.toLowerCase());
}

export async function renderDiagram(
  source: string,
  diagramType: string
): Promise<{ svg: string } | { error: string }> {
  const type = diagramType?.toLowerCase() || 'mermaid';

  if (!source.trim()) {
    return { error: 'No source code provided' };
  }

  try {
    if (isMermaidType(type)) {
      return await renderMermaid(source);
    } else if (isServerRenderedType(type)) {
      return await renderServerSide(source, type);
    } else {
      return { error: `Unsupported diagram type: ${diagramType}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error rendering diagram' };
  }
}

async function renderMermaid(source: string): Promise<{ svg: string } | { error: string }> {
  mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });
  const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    const { svg } = await mermaid.render(id, source);
    return { svg };
  } catch (err) {
    // Clean up failed render element that mermaid may leave in the DOM
    const failedEl = document.getElementById(id);
    if (failedEl) failedEl.remove();
    return { error: err instanceof Error ? err.message : 'Mermaid rendering error' };
  }
}

async function renderServerSide(
  source: string,
  diagramType: string
): Promise<{ svg: string } | { error: string }> {
  try {
    let svg = await api.renderDiagram(source, diagramType);
    // Strip XML declaration (e.g. <?xml version="1.0" encoding="utf-8"?>) that some
    // Kroki renderers (like D2) prepend. Browsers cannot render SVG via innerHTML
    // when it starts with an XML processing instruction.
    svg = svg.replace(/^<\?xml[^?]*\?>\s*/i, '');
    // Remove DOCTYPE declarations that some renderers include
    svg = svg.replace(/<!DOCTYPE[^>]*>\s*/i, '');
    // Some Kroki renderers (e.g. D2) produce SVGs without explicit width/height
    // attributes on the root <svg> element. Without these, the SVG collapses to
    // 0×0 when injected via innerHTML. Extract dimensions from the viewBox and
    // set them as explicit width/height so the SVG sizes itself correctly.
    // Only check the FIRST <svg> tag (the root), not nested ones.
    const firstSvgTagMatch = svg.match(/^(<svg\b[^>]*>)/i);
    if (firstSvgTagMatch) {
      const svgTag = firstSvgTagMatch[1];
      // If width/height use "pt" units (common in graphviz/DBML), convert to unitless
      // values so the SVG scales properly in the browser viewport
      const ptWidthMatch = svgTag.match(/\bwidth="(\d+(?:\.\d+)?)pt"/i);
      const ptHeightMatch = svgTag.match(/\bheight="(\d+(?:\.\d+)?)pt"/i);
      if (ptWidthMatch && ptHeightMatch) {
        // Replace pt dimensions with 100% width and auto height for responsive scaling
        svg = svg.replace(/^(<svg\b[^>]*)\bwidth="[^"]*"/i, '$1 width="100%"');
        svg = svg.replace(/^(<svg\b[^>]*)\bheight="[^"]*"/i, '$1 height="100%"');
      } else if (!/\bwidth\s*=/i.test(svgTag)) {
        // No width at all — extract from viewBox
        const viewBoxMatch = svgTag.match(/\bviewBox\s*=\s*"([^"]*)"/i);
        if (viewBoxMatch) {
          const parts = viewBoxMatch[1].trim().split(/\s+/);
          if (parts.length === 4) {
            const vbWidth = parts[2];
            const vbHeight = parts[3];
            svg = svg.replace(/^(<svg\b)/i, `$1 width="${vbWidth}" height="${vbHeight}"`);
          }
        }
      }
    }
    return { svg };
  } catch (err: unknown) {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 400) {
        const data = err.response?.data;
        const detail = typeof data === 'object' && data !== null && 'detail' in data
          ? (data as { detail?: string }).detail
          : data;
        return { error: typeof detail === 'string' ? detail : 'Invalid diagram source or type' };
      }
      if (status === 502) {
        return { error: 'Rendering server error. Check the diagram syntax.' };
      }
      if (status === 504) {
        return { error: 'Diagram rendering timed out. Try again.' };
      }
    }
    return { error: 'Could not connect to the rendering server' };
  }
}

function isAxiosError(
  err: unknown
): err is { response?: { status?: number; data?: { detail?: string } | string } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}
