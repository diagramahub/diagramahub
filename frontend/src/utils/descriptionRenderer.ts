/**
 * Description renderer for PDF export.
 *
 * Converts Markdown-formatted diagram descriptions into styled HTML elements
 * suitable for PDF capture via html2canvas. Renders outside React's render tree
 * using ReactDOM.createRoot with react-markdown + remark-gfm.
 *
 * All styling is applied inline (not via Tailwind classes) to ensure PDF
 * capture produces correctly styled output regardless of stylesheet availability.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Inline styles applied to rendered Markdown elements for PDF capture compatibility.
 * These replace Tailwind's prose classes since the rendered DOM lives outside
 * the application stylesheet context during capture.
 */
const STYLES = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#1f2937',
    wordWrap: 'break-word' as const,
  },
  h1: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    margin: '16px 0 8px 0',
    lineHeight: '1.3',
    color: '#111827',
  },
  h2: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    margin: '14px 0 6px 0',
    lineHeight: '1.3',
    color: '#111827',
  },
  h3: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    margin: '12px 0 6px 0',
    lineHeight: '1.3',
    color: '#111827',
  },
  h4: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    margin: '10px 0 4px 0',
    lineHeight: '1.3',
    color: '#111827',
  },
  h5: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    margin: '8px 0 4px 0',
    lineHeight: '1.3',
    color: '#111827',
  },
  h6: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    margin: '8px 0 4px 0',
    lineHeight: '1.3',
    color: '#374151',
  },
  paragraph: {
    margin: '0 0 12px 0',
    lineHeight: '1.6',
  },
  strong: {
    fontWeight: 'bold' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  ul: {
    listStyleType: 'disc',
    paddingLeft: '24px',
    margin: '0 0 12px 0',
  },
  ol: {
    listStyleType: 'decimal',
    paddingLeft: '24px',
    margin: '0 0 12px 0',
  },
  li: {
    margin: '4px 0',
    lineHeight: '1.6',
  },
  codeBlock: {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '13px',
    backgroundColor: '#f3f4f6',
    padding: '12px 16px',
    borderRadius: '6px',
    margin: '0 0 12px 0',
    overflowX: 'auto' as const,
    lineHeight: '1.5',
    whiteSpace: 'pre' as const,
  },
  inlineCode: {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '12px',
    backgroundColor: '#f3f4f6',
    padding: '2px 4px',
    borderRadius: '3px',
  },
  blockquote: {
    borderLeft: '4px solid #d1d5db',
    paddingLeft: '16px',
    margin: '0 0 12px 0',
    fontStyle: 'italic' as const,
    color: '#4b5563',
  },
  table: {
    borderCollapse: 'collapse' as const,
    width: '100%',
    margin: '0 0 12px 0',
    fontSize: '13px',
  },
  th: {
    border: '1px solid #d1d5db',
    padding: '8px 12px',
    fontWeight: 'bold' as const,
    backgroundColor: '#f9fafb',
    textAlign: 'left' as const,
  },
  td: {
    border: '1px solid #d1d5db',
    padding: '8px 12px',
    textAlign: 'left' as const,
  },
  del: {
    textDecoration: 'line-through',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid #e5e7eb',
    margin: '16px 0',
  },
} as const;

/**
 * Custom React components for ReactMarkdown that apply inline styles.
 * Each component maps a Markdown element type to a styled HTML element.
 */
function createComponents() {
  return {
    h1: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h1', { style: STYLES.h1 }, children),
    h2: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h2', { style: STYLES.h2 }, children),
    h3: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h3', { style: STYLES.h3 }, children),
    h4: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h4', { style: STYLES.h4 }, children),
    h5: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h5', { style: STYLES.h5 }, children),
    h6: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h6', { style: STYLES.h6 }, children),
    p: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('p', { style: STYLES.paragraph }, children),
    strong: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('strong', { style: STYLES.strong }, children),
    em: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('em', { style: STYLES.em }, children),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      // Display URL inline since PDFs aren't clickable
      const linkText = children;
      const showUrl = href && String(children) !== href;
      return React.createElement(
        'span',
        { style: STYLES.link },
        linkText,
        showUrl ? React.createElement('span', null, ` (${href})`) : null,
      );
    },
    ul: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('ul', { style: STYLES.ul }, children),
    ol: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('ol', { style: STYLES.ol }, children),
    li: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('li', { style: STYLES.li }, children),
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
      // className contains "language-xxx" for fenced code blocks via remark
      const isBlock = className?.startsWith('language-');
      if (isBlock) {
        return React.createElement('code', { style: STYLES.codeBlock }, children);
      }
      return React.createElement('code', { style: STYLES.inlineCode }, children);
    },
    pre: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('pre', { style: { margin: '0 0 12px 0' } }, children),
    blockquote: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('blockquote', { style: STYLES.blockquote }, children),
    table: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('table', { style: STYLES.table }, children),
    thead: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('thead', null, children),
    tbody: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('tbody', null, children),
    tr: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('tr', null, children),
    th: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('th', { style: STYLES.th }, children),
    td: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('td', { style: STYLES.td }, children),
    del: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('del', { style: STYLES.del }, children),
    hr: () => React.createElement('hr', { style: STYLES.hr }),
  };
}

/**
 * Renders Markdown descriptions into styled HTML DOM elements for PDF capture.
 *
 * Uses ReactDOM.createRoot to render a ReactMarkdown component into a detached
 * DOM container. All elements receive inline styles for PDF compatibility since
 * stylesheets are not available during html2canvas capture.
 *
 * @example
 * ```ts
 * const renderer = new DescriptionRenderer();
 * const element = renderer.render('# Hello\n\nSome **bold** text');
 * document.body.appendChild(element); // For capture
 * ```
 */
export class DescriptionRenderer {
  /**
   * Create a DOM element containing the Markdown content rendered as styled HTML.
   *
   * The element is rendered synchronously via ReactDOM flushSync + createRoot,
   * making it immediately available for html2canvas capture.
   *
   * @param markdown - Raw Markdown string to render
   * @returns HTMLElement (div) containing the rendered, styled content
   */
  render(markdown: string): HTMLElement {
    const container = document.createElement('div');
    Object.assign(container.style, STYLES.container);

    // Preserve line breaks within paragraphs by converting single newlines
    // to hard breaks (two trailing spaces + newline) for react-markdown
    const processedMarkdown = this.preserveLineBreaks(markdown);

    // Render into a temporary container using React, then transfer the HTML
    const renderTarget = document.createElement('div');
    const root = createRoot(renderTarget);

    // Use flushSync to render synchronously so the DOM is immediately available
    flushSync(() => {
      root.render(
        React.createElement(ReactMarkdown, {
          remarkPlugins: [remarkGfm],
          components: createComponents(),
          children: processedMarkdown,
        }),
      );
    });

    // Transfer rendered HTML to the styled container before unmounting
    container.innerHTML = renderTarget.innerHTML;

    // Clean up the React root
    root.unmount();

    return container;
  }

  /**
   * Preserve single line breaks within paragraphs for Markdown rendering.
   * Converts single newlines (that are not paragraph breaks) into Markdown
   * hard breaks (two trailing spaces + newline).
   */
  private preserveLineBreaks(markdown: string): string {
    const lines = markdown.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];

      if (
        nextLine !== undefined &&
        currentLine.trim() !== '' &&
        nextLine.trim() !== '' &&
        !this.isBlockStart(nextLine) &&
        !this.isBlockStart(currentLine)
      ) {
        // Add two trailing spaces for a hard break in Markdown
        result.push(currentLine.replace(/\s*$/, '  '));
      } else {
        result.push(currentLine);
      }
    }

    return result.join('\n');
  }

  /**
   * Check if a line starts a Markdown block element (heading, list, blockquote, etc.)
   * These lines should not have hard breaks appended before them.
   */
  private isBlockStart(line: string): boolean {
    const trimmed = line.trimStart();
    return (
      trimmed.startsWith('#') ||
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('+ ') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('```') ||
      /^\d+\.\s/.test(trimmed)
    );
  }
}
