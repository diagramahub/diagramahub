/**
 * Metadata header and footer builder for PDF and PNG diagram exports.
 *
 * Provides a corporate, elegant design with:
 * - Header: diagram name prominently at top, then project (with folder icon) and author (with person icon)
 * - Footer: export date + "Powered by Diagramahub" linking to diagramahub.com
 */

import type { jsPDF } from 'jspdf';
import type { ExportMetadata } from './exportService';

/** Options for metadata header rendering. */
export interface MetadataHeaderOptions {
  /** Maximum characters before truncation with ellipsis. Default: 100 */
  maxFieldLength: number;
}

const DEFAULT_OPTIONS: MetadataHeaderOptions = {
  maxFieldLength: 100,
};

/** Official Diagramahub website */
const DIAGRAMAHUB_URL = 'https://diagramahub.com';

/**
 * Metadata header and footer renderer for diagram exports.
 *
 * Design approach: corporate, clean, elegant.
 * - Diagram name is the primary title (large, bold)
 * - Project path (with folder emoji) and author (with person emoji) below
 * - Footer shows export timestamp and branding
 */
export class MetadataHeader {
  /**
   * Truncate a field value to maxLength characters followed by an ellipsis (U+2026)
   * if the value exceeds the limit. Returns the original string unchanged otherwise.
   */
  truncateField(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength) + '\u2026';
  }

  /**
   * Create a DOM element containing ONLY the diagram title.
   * Used when "include project info" is unchecked — the title always appears.
   */
  createTitleElement(diagramName: string, options?: MetadataHeaderOptions): HTMLElement {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const container = document.createElement('div');
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.padding = '0 0 12px 0';
    container.style.marginBottom = '16px';
    container.style.borderBottom = '2px solid #e5e7eb';

    const title = document.createElement('h1');
    title.style.fontSize = '22px';
    title.style.fontWeight = '700';
    title.style.color = '#111827';
    title.style.margin = '0';
    title.style.letterSpacing = '-0.02em';
    title.textContent = this.truncateField(diagramName, opts.maxFieldLength);
    container.appendChild(title);

    return container;
  }

  /**
   * Create a DOM element containing the formatted metadata header.
   *
   * Layout:
   * - Diagram name as large title
   * - 📁 Project / Folder    👤 Author (with emojis, bigger text)
   * - Thin accent line separator
   */
  createDOMElement(metadata: ExportMetadata, options?: MetadataHeaderOptions): HTMLElement {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const container = document.createElement('div');
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.padding = '0 0 16px 0';
    container.style.marginBottom = '16px';

    // Diagram name — primary title
    const title = document.createElement('h1');
    title.style.fontSize = '24px';
    title.style.fontWeight = '700';
    title.style.color = '#111827';
    title.style.margin = '0 0 10px 0';
    title.style.letterSpacing = '-0.02em';
    title.textContent = this.truncateField(metadata.diagramName, opts.maxFieldLength);
    container.appendChild(title);

    // Secondary metadata row with icons (using Unicode characters for html2canvas compatibility)
    const metaRow = document.createElement('div');
    metaRow.style.fontSize = '14px';
    metaRow.style.color = '#4b5563';
    metaRow.style.display = 'flex';
    metaRow.style.alignItems = 'center';
    metaRow.style.gap = '16px';
    metaRow.style.flexWrap = 'wrap';
    metaRow.style.lineHeight = '1.4';

    // Project / Folder with folder symbol
    let projectPath = this.truncateField(metadata.projectName, opts.maxFieldLength);
    if (metadata.folderName) {
      projectPath += ` / ${this.truncateField(metadata.folderName, opts.maxFieldLength)}`;
    }
    const projectSpan = document.createElement('span');
    projectSpan.textContent = `\u{1F4C1} ${projectPath}`;
    metaRow.appendChild(projectSpan);

    // Author with person symbol
    const authorSpan = document.createElement('span');
    authorSpan.textContent = `\u{1F464} ${metadata.authorName}`;
    metaRow.appendChild(authorSpan);

    container.appendChild(metaRow);

    // Accent line separator (purple gradient)
    const accentLine = document.createElement('div');
    accentLine.style.marginTop = '14px';
    accentLine.style.height = '2px';
    accentLine.style.background = 'linear-gradient(to right, #7c3aed, #a78bfa, transparent)';
    accentLine.style.borderRadius = '1px';
    container.appendChild(accentLine);

    return container;
  }

  /**
   * Create a DOM element for the export footer.
   *
   * Layout:
   * - Thin separator line
   * - Export date on the left
   * - "Powered by Diagramahub" on the right (links to diagramahub.com)
   */
  createFooterElement(): HTMLElement {
    const footer = document.createElement('div');
    footer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    footer.style.marginTop = '20px';
    footer.style.paddingTop = '12px';
    footer.style.borderTop = '1px solid #e5e7eb';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.fontSize = '11px';
    footer.style.color = '#9ca3af';

    // Export date
    const dateSpan = document.createElement('span');
    const now = new Date();
    dateSpan.textContent = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    footer.appendChild(dateSpan);

    // Powered by Diagramahub
    const branding = document.createElement('span');
    branding.style.color = '#7c3aed';
    branding.style.fontWeight = '500';
    branding.textContent = `Powered by Diagramahub`;
    branding.setAttribute('data-href', DIAGRAMAHUB_URL);
    footer.appendChild(branding);

    return footer;
  }

  /**
   * Render metadata header directly into a jsPDF document at the specified Y position.
   * Returns the new Y offset after the header.
   */
  renderToPDF(
    pdf: jsPDF,
    metadata: ExportMetadata,
    startY: number,
    options?: MetadataHeaderOptions,
  ): number {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const marginLeft = 30;

    let currentY = startY;

    // Diagram name — primary title (larger, bold)
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39); // gray-900
    pdf.text(
      this.truncateField(metadata.diagramName, opts.maxFieldLength),
      marginLeft,
      currentY,
    );
    currentY += 20;

    // Secondary metadata: Project/Folder · Author (with text labels as icon substitute)
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99); // gray-600

    // Project path
    let projectPath = this.truncateField(metadata.projectName, opts.maxFieldLength);
    if (metadata.folderName) {
      projectPath += ` / ${this.truncateField(metadata.folderName, opts.maxFieldLength)}`;
    }
    const projectLabel = `📁  ${projectPath}`;
    pdf.text(projectLabel, marginLeft, currentY);

    // Author (positioned after project with spacing)
    const projectWidth = pdf.getTextWidth(projectLabel);
    const authorLabel = `👤  ${metadata.authorName}`;
    pdf.text(authorLabel, marginLeft + projectWidth + 20, currentY);
    currentY += 16;

    // Accent line (purple)
    pdf.setDrawColor(124, 58, 237); // purple-600
    pdf.setLineWidth(1.5);
    pdf.line(marginLeft, currentY, marginLeft + 80, currentY);

    // Fade effect
    pdf.setDrawColor(167, 139, 250); // purple-400
    pdf.setLineWidth(1);
    pdf.line(marginLeft + 80, currentY, marginLeft + 140, currentY);

    currentY += 18;

    // Reset text color
    pdf.setTextColor(0, 0, 0);

    return currentY;
  }

  /**
   * Render footer directly into a jsPDF document at the bottom of the page.
   * "Powered by Diagramahub" links to diagramahub.com.
   */
  renderFooterToPDF(pdf: jsPDF): void {
    const marginLeft = 30;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const footerY = pageHeight - 20;

    // Separator line
    pdf.setDrawColor(229, 231, 235); // gray-200
    pdf.setLineWidth(0.5);
    pdf.line(marginLeft, footerY - 8, pageWidth - marginLeft, footerY - 8);

    // Export date (left)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(156, 163, 175); // gray-400
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    pdf.text(dateStr, marginLeft, footerY);

    // "Powered by Diagramahub" (right, purple, clickable)
    pdf.setTextColor(124, 58, 237); // purple-600
    pdf.setFont('helvetica', 'bold');
    const brandText = 'Powered by Diagramahub';
    const brandWidth = pdf.getTextWidth(brandText);
    pdf.text(brandText, pageWidth - marginLeft - brandWidth, footerY);

    // Clickable link → diagramahub.com
    pdf.link(
      pageWidth - marginLeft - brandWidth,
      footerY - 8,
      brandWidth,
      10,
      { url: DIAGRAMAHUB_URL },
    );

    // Reset
    pdf.setTextColor(0, 0, 0);
  }
}
