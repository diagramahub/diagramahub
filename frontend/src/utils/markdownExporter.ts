/**
 * Markdown exporter for diagram exports.
 *
 * Generates Markdown files with optional project metadata and description sections.
 * Section ordering follows the design specification:
 * - Both options: project header → code block → description
 * - Only description: code block → description
 * - Only project info: project header → code block
 * - Neither option: code block only
 */

import type { ExportOptions, ExportMetadata, DiagramExportData } from './exportService';

/**
 * Generates and downloads Markdown files containing diagram source code
 * with optional metadata header and description sections.
 */
export class MarkdownExporter {
  /**
   * Generate the full Markdown content and trigger a file download.
   *
   * @param data - Diagram content and context for export
   * @param options - Controls inclusion of description and project info sections
   */
  export(data: DiagramExportData, options: ExportOptions): void {
    const sections: string[] = [];

    if (options.includeProjectInfo && data.metadata) {
      sections.push(this.buildProjectHeader(data.metadata));
    }

    sections.push(this.buildCodeBlock(data.diagramCode, data.diagramType));

    if (options.includeDescription && this.hasContent(data.description)) {
      sections.push(this.buildDescriptionSection(data.description!));
    }

    const content = sections.join('\n');
    const filename = this.generateFilename(data.metadata?.diagramName ?? 'diagram');

    this.triggerDownload(content, filename);
  }

  /**
   * Build the project header section with a level-1 heading and metadata lines.
   *
   * @param metadata - Project context metadata
   * @returns Formatted project header string
   */
  buildProjectHeader(metadata: ExportMetadata): string {
    const lines: string[] = [];

    lines.push(`# ${metadata.projectName}\n`);

    if (metadata.folderName) {
      lines.push(`**Carpeta:** ${metadata.folderName}`);
    }

    lines.push(`**Diagrama:** ${metadata.diagramName}`);
    lines.push(`**Autor:** ${metadata.authorName}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build a fenced code block with the correct language identifier.
   *
   * @param code - Diagram source code
   * @param diagramType - Type of diagram (mermaid, plantuml, dbml)
   * @returns Fenced code block string
   */
  buildCodeBlock(code: string, diagramType: string): string {
    const language = this.getLanguageIdentifier(diagramType);
    return `\`\`\`${language}\n${code}\n\`\`\`\n`;
  }

  /**
   * Build the description section with a level-2 heading.
   *
   * @param description - Diagram description text
   * @returns Formatted description section string
   */
  buildDescriptionSection(description: string): string {
    return `## Descripción\n\n${description}\n`;
  }

  /**
   * Generate a filename from the diagram name.
   * Replaces spaces with underscores and appends `.md` extension.
   *
   * @param diagramName - Name of the diagram
   * @returns Sanitized filename with .md extension
   */
  generateFilename(diagramName: string): string {
    return `${diagramName.replace(/ /g, '_')}.md`;
  }

  /**
   * Map diagram type to the correct fenced code block language identifier.
   */
  private getLanguageIdentifier(diagramType: string): string {
    switch (diagramType) {
      case 'mermaid':
        return 'mermaid';
      case 'plantuml':
        return 'plantuml';
      case 'dbml':
        return 'dbml';
      default:
        return diagramType;
    }
  }

  /**
   * Check if a description string has meaningful content (not empty/null/whitespace-only).
   */
  private hasContent(value: string | undefined | null): boolean {
    return value != null && value.trim().length > 0;
  }

  /**
   * Trigger a file download using Blob + URL.createObjectURL + click.
   */
  private triggerDownload(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
