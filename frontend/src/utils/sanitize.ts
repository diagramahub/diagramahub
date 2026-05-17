/**
 * HTML sanitization utilities for XSS prevention.
 *
 * Uses DOMPurify (already available via mermaid dependency) for SVG sanitization
 * and a lightweight escape for plain text that must be rendered as HTML.
 */

// DOMPurify is used indirectly via mermaid but we import it directly for SVG safety.
// eslint-disable-next-line import/no-extraneous-dependencies
import DOMPurify from 'dompurify';

/**
 * Escape HTML entities in a string for safe innerHTML rendering.
 * Use this for error messages or user-provided text that must appear inside HTML.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (ch) => map[ch] || ch);
}

/**
 * Sanitize an SVG string before injecting it into the DOM via innerHTML.
 *
 * DOMPurify is configured to allow SVG elements and attributes while stripping
 * script tags, event handlers, and other XSS vectors.
 *
 * Mermaid renders text labels inside <foreignObject> elements containing HTML
 * (div, span, p), so we must allow both SVG and HTML profiles.
 *
 * @param svg - Raw SVG string from diagram renderer (Kroki / Mermaid)
 * @returns Sanitized SVG string safe for innerHTML
 */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true, html: true },
    ADD_TAGS: ["use", "foreignObject"],
    ADD_ATTR: ['href', 'xlink:href', 'xmlns', 'xmlns:xlink', 'requiredExtensions'],
  });
}

/**
 * Sanitize a plain HTML fragment.
 * Use for rendering markdown previews or other rich content.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'blockquote',
      'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'target', 'rel'],
  });
}
