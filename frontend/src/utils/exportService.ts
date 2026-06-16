/**
 * Export service module for diagram export operations.
 *
 * Central orchestrator for PDF, PNG, and Markdown exports.
 * Replaces inline export logic previously in DiagramEditorPage.tsx.
 */

import html2canvas from 'html2canvas';
import { PDFGenerator } from './pdfGenerator';
import { MarkdownExporter } from './markdownExporter';
import { MetadataHeader } from './metadataHeader';

// i18n error message keys for export failures
export const EXPORT_ERROR_KEYS = {
  PDF_FAILED: 'export.error.pdfFailed',
  PNG_FAILED: 'export.error.pngFailed',
  TIMEOUT: 'export.error.timeout',
  DOWNLOAD_FAILED: 'export.error.downloadFailed',
} as const;

/** Options controlling what optional sections are included in exports. */
export interface ExportOptions {
  includeDescription: boolean;
  includeProjectInfo: boolean;
}

/** Metadata about the diagram's project context, embedded in exports. */
export interface ExportMetadata {
  projectName: string;
  folderName?: string;
  diagramName: string;
  authorName: string;
}

/** All data needed to perform a diagram export. */
export interface DiagramExportData {
  svgElement: SVGElement | null;
  diagramCode: string;
  diagramType: 'mermaid' | 'plantuml' | 'dbml';
  description?: string;
  metadata?: ExportMetadata;
}

/**
 * Central export service that delegates to format-specific generators.
 *
 * Usage:
 * ```ts
 * const service = new ExportService();
 * await service.exportPDF(data, options);
 * ```
 */
export class ExportService {
  /**
   * Export the diagram as a PDF file with optional metadata header and description.
   * Uses SVG-first embedding via jsPDF; falls back to JPEG rasterization on failure.
   *
   * @param data - Diagram content and context for export
   * @param options - Controls inclusion of description and project info sections
   * @throws Error with EXPORT_ERROR_KEYS.PDF_FAILED on failure
   */
  async exportPDF(data: DiagramExportData, options: ExportOptions): Promise<void> {
    try {
      const generator = new PDFGenerator();
      await generator.generate(data, options);
    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error(EXPORT_ERROR_KEYS.PDF_FAILED);
    }
  }

  /**
   * Export the diagram as a PNG image with optional metadata header.
   * Uses html2canvas to capture the diagram (and metadata header if selected).
   *
   * When includeProjectInfo is true and metadata is present, a temporary container
   * is created with the metadata header above the diagram content, captured as a
   * single image, then cleaned up.
   *
   * @param data - Diagram content and context for export
   * @param options - Controls inclusion of project info metadata header
   * @throws Error with EXPORT_ERROR_KEYS.PNG_FAILED on failure
   */
  async exportPNG(data: DiagramExportData, options: ExportOptions): Promise<void> {
    let tempContainer: HTMLDivElement | null = null;

    try {
      let captureTarget: HTMLElement;

      if (options.includeProjectInfo && data.metadata) {
        // Create a temporary container with metadata header above diagram content
        tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.backgroundColor = '#ffffff';

        // Build the metadata header DOM element
        const metadataHeader = new MetadataHeader();
        const headerElement = metadataHeader.createDOMElement(data.metadata);
        tempContainer.appendChild(headerElement);

        // Clone the SVG parent container (diagram content) and append it
        const diagramContainer = data.svgElement?.parentElement;
        if (diagramContainer) {
          const diagramClone = diagramContainer.cloneNode(true) as HTMLElement;
          diagramClone.style.backgroundColor = '#ffffff';
          tempContainer.appendChild(diagramClone);
        } else if (data.svgElement) {
          // If no parent, wrap the SVG clone directly
          const svgClone = data.svgElement.cloneNode(true) as SVGElement;
          const wrapper = document.createElement('div');
          wrapper.style.backgroundColor = '#ffffff';
          wrapper.appendChild(svgClone);
          tempContainer.appendChild(wrapper);
        }

        document.body.appendChild(tempContainer);
        captureTarget = tempContainer;
      } else {
        // Capture just the SVG element's parent container
        const diagramContainer = data.svgElement?.parentElement;
        if (!diagramContainer) {
          throw new Error('No diagram container found for PNG capture');
        }
        captureTarget = diagramContainer;
      }

      // Capture with html2canvas
      const canvas = await html2canvas(captureTarget, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // Convert canvas to PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png');

      if (!pngDataUrl || pngDataUrl === 'data:,') {
        throw new Error('Canvas produced empty PNG data');
      }

      // Trigger download
      const filename = this.buildPngFilename(data.metadata?.diagramName);
      this.triggerDownload(pngDataUrl, filename);
    } catch (error) {
      console.error('PNG export failed:', error);
      throw new Error(EXPORT_ERROR_KEYS.PNG_FAILED);
    } finally {
      // Clean up temporary container from DOM
      if (tempContainer && tempContainer.parentElement) {
        document.body.removeChild(tempContainer);
      }
    }
  }

  /**
   * Export the diagram as a Markdown file with optional metadata and description.
   * Synchronous operation — generates content and triggers file download.
   *
   * @param data - Diagram content and context for export
   * @param options - Controls inclusion of description and project info sections
   * @throws Error with EXPORT_ERROR_KEYS.DOWNLOAD_FAILED on failure
   */
  exportMarkdown(data: DiagramExportData, options: ExportOptions): void {
    try {
      const exporter = new MarkdownExporter();
      exporter.export(data, options);
    } catch (error) {
      console.error('Markdown export failed:', error);
      throw new Error(EXPORT_ERROR_KEYS.DOWNLOAD_FAILED);
    }
  }

  /**
   * Build the PNG filename from the diagram name.
   * Uses the diagram name if available, otherwise defaults to 'diagram'.
   */
  private buildPngFilename(diagramName?: string): string {
    const name = diagramName?.trim() || 'diagram';
    return `${name}.png`;
  }

  /**
   * Trigger a file download from a data URL.
   */
  private triggerDownload(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
  }
}
