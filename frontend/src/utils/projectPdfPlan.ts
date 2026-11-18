/** Pure helpers for the project PDF (no DOM, testable in Node). */
import type { Diagram } from '../types/project';

export const MAX_PDF_DIAGRAMS = 100;

/** Diagrams that go into the PDF (text-based ones), and how many sketches are left out. */
export function pdfPages(diagrams: Diagram[]): { included: Diagram[]; skippedSketches: number } {
  const included = diagrams.filter((d) => d.diagram_type !== 'freehand').slice(0, MAX_PDF_DIAGRAMS);
  return { included, skippedSketches: diagrams.filter((d) => d.diagram_type === 'freehand').length };
}

/** File name for the PDF: project (and folder) name, filesystem-safe. */
export function projectPdfFilename(projectName: string, folderName?: string): string {
  const base = [projectName, folderName].filter(Boolean).join(' - ') || 'diagramahub';
  const safe = base.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${safe || 'diagramahub'}.pdf`;
}
