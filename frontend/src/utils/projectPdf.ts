/**
 * Multi-diagram PDF of a project or a folder, generated in the browser.
 *
 * Same capture approach as the single-diagram PDF (pdfGenerator.ts): each page
 * is laid out as HTML off-screen, rasterized with html2canvas at 2x and
 * embedded as JPEG, so fonts, Mermaid styles and accents look exactly like
 * the app. Pages are A4 landscape: a cover with the table of contents, then
 * one diagram per page (with its description when asked). Sketches (freehand)
 * are listed on the cover as not included.
 */

import type { Diagram } from '../types/project';
import { renderDiagram } from './diagramRenderer';
import { sanitizeSvg } from './sanitize';
import { DescriptionRenderer } from './descriptionRenderer';
import { pdfPages } from './projectPdfPlan';

export { MAX_PDF_DIAGRAMS, pdfPages, projectPdfFilename } from './projectPdfPlan';

/** A4 landscape in pt. */
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const CANVAS_SCALE = 2;
/** Width of the off-screen layout, in CSS px (≈ the printable width at 96 dpi). */
const LAYOUT_WIDTH = 1040;
const PER_DIAGRAM_TIMEOUT_MS = 20_000;

export interface ProjectPdfTexts {
  /** e.g. "Exported on {{date}}" already formatted. */
  exportedOn: string;
  contents: string;
  sketchesSkipped: (count: number) => string;
  renderError: string;
  pageLabel: (page: number) => string;
}

export interface ProjectPdfInput {
  projectName: string;
  /** Folder being exported, or undefined for the whole project. */
  folderName?: string;
  diagrams: Diagram[];
  includeDescriptions: boolean;
  texts: ProjectPdfTexts;
  /** Called after each diagram with (done, total). */
  onProgress?: (done: number, total: number) => void;
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

function pageShell(): HTMLDivElement {
  return el('div', {
    position: 'absolute',
    left: '-10000px',
    top: '0',
    width: `${LAYOUT_WIDTH}px`,
    padding: '24px',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontFamily: FONT,
    boxSizing: 'border-box',
  });
}

async function capture(node: HTMLElement): Promise<{ data: string; width: number; height: number }> {
  document.body.appendChild(node);
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(node, {
      scale: CANVAS_SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return {
      data: canvas.toDataURL('image/jpeg', 0.98),
      width: canvas.width / CANVAS_SCALE,
      height: canvas.height / CANVAS_SCALE,
    };
  } finally {
    node.remove();
  }
}

async function svgFor(diagram: Diagram): Promise<string | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PER_DIAGRAM_TIMEOUT_MS));
  const render = renderDiagram(diagram.content, diagram.diagram_type || 'mermaid').then((result) =>
    'svg' in result ? sanitizeSvg(result.svg) : null,
  );
  return Promise.race([render, timeout]).catch(() => null);
}

function coverPage(input: ProjectPdfInput, included: Diagram[], skipped: number): HTMLDivElement {
  const page = pageShell();
  page.style.minHeight = `${Math.round(LAYOUT_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH))}px`;
  page.appendChild(el('div', { fontSize: '13px', fontWeight: '600', color: '#7c3aed', letterSpacing: '0.04em' }, 'DiagramaHub'));
  page.appendChild(el('h1', { fontSize: '34px', margin: '12px 0 4px', color: '#111827' }, input.projectName));
  if (input.folderName) page.appendChild(el('div', { fontSize: '20px', color: '#4b5563' }, input.folderName));
  page.appendChild(el('div', { fontSize: '13px', color: '#6b7280', marginTop: '8px' }, input.texts.exportedOn));
  page.appendChild(el('h2', { fontSize: '18px', margin: '28px 0 8px', color: '#111827' }, input.texts.contents));
  const list = el('ol', { margin: '0', paddingLeft: '22px', fontSize: '14px', lineHeight: '1.7', columns: included.length > 18 ? '2' : '1' });
  included.forEach((d, i) => {
    const item = el('li', {});
    item.appendChild(document.createTextNode(d.title));
    item.appendChild(el('span', { color: '#9ca3af' }, ` · ${input.texts.pageLabel(i + 2)}`));
    list.appendChild(item);
  });
  page.appendChild(list);
  if (skipped > 0) {
    page.appendChild(el('p', { fontSize: '12px', color: '#92400e', marginTop: '16px' }, input.texts.sketchesSkipped(skipped)));
  }
  return page;
}

function diagramPage(diagram: Diagram, svg: string | null, input: ProjectPdfInput, renderer: DescriptionRenderer): HTMLDivElement {
  const page = pageShell();
  page.appendChild(el('h2', { fontSize: '20px', margin: '0 0 14px', color: '#111827' }, diagram.title));
  const figure = el('div', { textAlign: 'center' });
  if (svg) {
    figure.innerHTML = svg;
    const node = figure.querySelector('svg');
    if (node) {
      node.style.maxWidth = '100%';
      node.style.height = 'auto';
      node.style.display = 'block';
      node.style.margin = '0 auto';
    }
  } else {
    figure.appendChild(el('p', { color: '#b45309', fontSize: '14px' }, input.texts.renderError));
  }
  page.appendChild(figure);
  if (input.includeDescriptions && diagram.description?.trim()) {
    const description = renderer.render(diagram.description);
    Object.assign(description.style, { borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '14px' });
    page.appendChild(description);
  }
  return page;
}

/**
 * Build the PDF and return it as a Blob (the caller downloads it).
 */
export async function generateProjectPdf(input: ProjectPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { included, skippedSketches } = pdfPages(input.diagrams);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const renderer = new DescriptionRenderer();

  const place = (image: { data: string; width: number; height: number }) => {
    const maxW = PAGE_WIDTH - MARGIN * 2;
    const maxH = PAGE_HEIGHT - MARGIN * 2;
    const ratio = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * ratio;
    const h = image.height * ratio;
    pdf.addImage(image.data, 'JPEG', (PAGE_WIDTH - w) / 2, MARGIN, w, h);
  };

  place(await capture(coverPage(input, included, skippedSketches)));
  for (let i = 0; i < included.length; i++) {
    const diagram = included[i];
    const svg = await svgFor(diagram);
    pdf.addPage('a4', 'landscape');
    place(await capture(diagramPage(diagram, svg, input, renderer)));
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175);
    pdf.text(input.texts.pageLabel(i + 2), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12, { align: 'right' });
    input.onProgress?.(i + 1, included.length);
  }
  return pdf.output('blob');
}
