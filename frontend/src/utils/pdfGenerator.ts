/**
 * PDF generator for diagram exports.
 *
 * Strategy: High-quality rasterization with PNG format.
 *
 * Why not pure SVG embedding?
 * jsPDF's addSvgAsImage has known limitations with complex SVGs (Mermaid/PlantUML):
 * - Drops CSS styles, custom fonts, and gradients
 * - Text positioning can break
 * - Results in illegible diagrams for complex charts
 *
 * Our approach:
 * - Use html2canvas at 2x scale for crisp, readable output
 * - Use PNG format (lossless) to preserve text clarity
 * - Fit page dimensions to content (no wasted whitespace)
 * - Result: ~1-5 MB PDFs (down from 150-200 MB) with full visual fidelity
 *
 * The original 150-200 MB files were caused by html2canvas at device pixel ratio
 * (often 3-4x) with uncompressed raw bitmap data. Our optimization:
 * - Fixed 2x scale (not device pixel ratio)
 * - PNG compression (lossless but efficient for diagrams with flat colors)
 * - Page dimensions matched to content (no full-page captures)
 */

import html2canvas from 'html2canvas';
import type { DiagramExportData, ExportOptions } from './exportService';
import { EXPORT_ERROR_KEYS } from './exportService';
import { MetadataHeader } from './metadataHeader';
import { DescriptionRenderer } from './descriptionRenderer';

/** Padding applied to each side of the content for PDF page layout (in pt). */
const PAGE_PADDING = 30;

/** Maximum time allowed for PDF generation before aborting. */
const TIMEOUT_MS = 15_000;

/**
 * Canvas scale factor for rasterization.
 * 2x gives sharp, readable text on all screens while keeping file size reasonable.
 * (The original issue was using window.devicePixelRatio which could be 3-4x)
 */
const CANVAS_SCALE = 2;

/**
 * Generates PDF documents from diagram export data.
 *
 * Orchestrates the full PDF creation workflow: builds a composite export
 * container with optional metadata header + diagram + optional description,
 * captures it as a high-quality PNG via html2canvas, then embeds it in jsPDF.
 */
export class PDFGenerator {
  private metadataHeader = new MetadataHeader();
  private descriptionRenderer = new DescriptionRenderer();

  /**
   * Generate and download a PDF from the given diagram data and options.
   * Wrapped in a timeout to prevent hanging on large diagrams.
   */
  async generate(data: DiagramExportData, options: ExportOptions): Promise<void> {
    const result = await Promise.race([
      this.generateInternal(data, options),
      this.createTimeout(),
    ]);

    if (result === 'timeout') {
      throw new Error(EXPORT_ERROR_KEYS.TIMEOUT);
    }
  }

  private async generateInternal(
    data: DiagramExportData,
    options: ExportOptions,
  ): Promise<void> {
    // 1. Build the composite container immediately (fast, no network)
    const exportContainer = this.buildExportContainer(data, options);

    // Temporarily add to DOM for html2canvas to measure and render
    document.body.appendChild(exportContainer);

    try {
      // 2. Start html2canvas and jsPDF import in parallel
      const [canvas, { jsPDF }] = await Promise.all([
        html2canvas(exportContainer, {
          scale: CANVAS_SCALE,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        }),
        import('jspdf'),
      ]);

      // 3. Get PNG data (lossless — preserves text clarity)
      const imgData = canvas.toDataURL('image/png');

      // 4. Calculate PDF page dimensions from canvas
      const contentWidthPx = canvas.width / CANVAS_SCALE;
      const contentHeightPx = canvas.height / CANVAS_SCALE;

      // PDF page = content + padding on all sides
      const pageWidth = contentWidthPx + PAGE_PADDING * 2;
      const pageHeight = contentHeightPx + PAGE_PADDING * 2;

      const orientation = pageWidth >= pageHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [pageWidth, pageHeight],
        hotfixes: ['px_scaling'],
      });

      // 5. Add the captured image to fill the content area
      pdf.addImage(
        imgData,
        'PNG',
        PAGE_PADDING,
        PAGE_PADDING,
        contentWidthPx,
        contentHeightPx,
      );

      // 6. Save and trigger download
      const filename = this.buildFilename(data.metadata?.diagramName);
      pdf.save(filename);
    } finally {
      // Always clean up the temporary container
      document.body.removeChild(exportContainer);
    }
  }

  /**
   * Build a composite HTML container with all export sections arranged vertically:
   * - Metadata header (if includeProjectInfo)
   * - Diagram (cloned SVG)
   * - Description (rendered Markdown, if includeDescription)
   *
   * The container is styled for clean capture: white background, controlled width,
   * consistent fonts.
   */
  private buildExportContainer(
    data: DiagramExportData,
    options: ExportOptions,
  ): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = `${PAGE_PADDING}px`;
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.color = '#1f2937';

    // Set a reasonable max width for the export (prevents overly wide diagrams)
    // but allow the diagram to dictate width if smaller
    const diagramWidth = this.getContentWidth(data.svgElement);
    container.style.width = `${Math.max(diagramWidth, 600)}px`;

    // Section 1: Always show title; full metadata only if checkbox is on
    if (options.includeProjectInfo && data.metadata) {
      const headerElement = this.metadataHeader.createDOMElement(data.metadata);
      headerElement.style.marginBottom = '20px';
      container.appendChild(headerElement);
    } else if (data.metadata?.diagramName) {
      const titleElement = this.metadataHeader.createTitleElement(data.metadata.diagramName);
      titleElement.style.marginBottom = '20px';
      container.appendChild(titleElement);
    }

    // Section 2: Diagram SVG (cloned to avoid modifying the live DOM)
    if (data.svgElement) {
      const diagramWrapper = document.createElement('div');
      diagramWrapper.style.textAlign = 'center';
      diagramWrapper.style.marginBottom = '20px';

      const svgClone = data.svgElement.cloneNode(true) as SVGElement;
      // Ensure the SVG fills its container properly
      svgClone.style.maxWidth = '100%';
      svgClone.style.height = 'auto';
      svgClone.style.display = 'block';
      svgClone.style.margin = '0 auto';

      // Copy computed styles that might be needed for rendering
      this.inlineComputedStyles(data.svgElement, svgClone);

      diagramWrapper.appendChild(svgClone);
      container.appendChild(diagramWrapper);
    }

    // Section 3: Description (rendered Markdown)
    if (options.includeDescription && data.description?.trim()) {
      const descriptionElement = this.descriptionRenderer.render(data.description);
      descriptionElement.style.borderTop = '1px solid #e5e7eb';
      descriptionElement.style.paddingTop = '16px';
      descriptionElement.style.marginTop = '10px';
      container.appendChild(descriptionElement);
    }

    // Section 4: Footer (always shown — export date + branding)
    const footerElement = this.metadataHeader.createFooterElement();
    container.appendChild(footerElement);

    return container;
  }

  /**
   * Inline critical computed styles from the live SVG to the clone.
   * This ensures fonts, colors, and other styles are preserved during capture
   * even when the clone is placed off-screen.
   */
  private inlineComputedStyles(source: SVGElement, target: SVGElement): void {
    try {
      // Copy all <style> elements inside the SVG
      const sourceStyles = source.querySelectorAll('style');
      const targetStyles = target.querySelectorAll('style');

      // If the source has style elements, ensure they're in the clone
      if (sourceStyles.length > 0 && targetStyles.length === 0) {
        sourceStyles.forEach((styleEl) => {
          target.insertBefore(styleEl.cloneNode(true), target.firstChild);
        });
      }

      // Ensure foreignObject content (used by Mermaid for labels) retains styles
      const foreignObjects = target.querySelectorAll('foreignObject *');
      foreignObjects.forEach((el) => {
        if (el instanceof HTMLElement) {
          const sourceEl = source.querySelector(`[data-id="${el.getAttribute('data-id')}"]`);
          if (sourceEl && sourceEl instanceof HTMLElement) {
            const computed = window.getComputedStyle(sourceEl);
            el.style.fontFamily = computed.fontFamily;
            el.style.fontSize = computed.fontSize;
            el.style.fontWeight = computed.fontWeight;
            el.style.color = computed.color;
          }
        }
      });
    } catch {
      // Non-critical — styles might still render correctly via <style> tags
    }
  }

  /**
   * Get the appropriate content width based on the SVG dimensions.
   * Returns the SVG width or a sensible default.
   */
  private getContentWidth(svg: SVGElement | null): number {
    if (!svg) return 800;

    const dims = this.getSvgDimensions(svg);
    // Cap at a reasonable max to prevent extremely wide PDFs
    return Math.min(dims.width, 1200);
  }

  /**
   * Get SVG dimensions from viewBox attribute, width/height attributes,
   * or getBoundingClientRect() as fallback.
   */
  private getSvgDimensions(svg: SVGElement): { width: number; height: number } {
    // Try viewBox first (most reliable for SVGs)
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/);
      if (parts.length === 4) {
        const w = parseFloat(parts[2]);
        const h = parseFloat(parts[3]);
        if (w > 0 && h > 0) {
          return { width: w, height: h };
        }
      }
    }

    // Try explicit width/height attributes
    const widthAttr = svg.getAttribute('width');
    const heightAttr = svg.getAttribute('height');
    if (widthAttr && heightAttr) {
      const w = parseFloat(widthAttr);
      const h = parseFloat(heightAttr);
      if (w > 0 && h > 0) {
        return { width: w, height: h };
      }
    }

    // Fall back to getBoundingClientRect (requires element to be in DOM)
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }

    return { width: 800, height: 600 };
  }

  /**
   * Build the PDF filename from the diagram name.
   */
  private buildFilename(diagramName?: string): string {
    const name = diagramName?.trim() || 'diagram';
    return `${name}.pdf`;
  }

  /**
   * Create a timeout promise that resolves with 'timeout' after TIMEOUT_MS.
   */
  private createTimeout(): Promise<'timeout'> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), TIMEOUT_MS);
    });
  }
}
