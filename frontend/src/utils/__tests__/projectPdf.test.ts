import { describe, expect, it } from 'vitest';
import type { Diagram } from '../../types/project';
import { MAX_PDF_DIAGRAMS, pdfPages, projectPdfFilename } from '../projectPdfPlan';

const diagram = (id: string, diagram_type = 'mermaid'): Diagram =>
  ({ id, title: id, content: '', diagram_type }) as Diagram;

describe('pdfPages', () => {
  it('keeps text diagrams and counts the sketches left out', () => {
    const { included, skippedSketches } = pdfPages([
      diagram('a'),
      diagram('s1', 'freehand'),
      diagram('b', 'plantuml'),
      diagram('s2', 'freehand'),
    ]);
    expect(included.map((d) => d.id)).toEqual(['a', 'b']);
    expect(skippedSketches).toBe(2);
  });

  it('caps the number of pages', () => {
    const many = Array.from({ length: MAX_PDF_DIAGRAMS + 5 }, (_, i) => diagram(`d${i}`));
    expect(pdfPages(many).included).toHaveLength(MAX_PDF_DIAGRAMS);
  });
});

describe('projectPdfFilename', () => {
  it('joins project and folder and drops unsafe characters', () => {
    expect(projectPdfFilename('Pagos: v2', 'Arquitectura/Core')).toBe('Pagos v2 - ArquitecturaCore.pdf');
  });

  it('falls back to a default name', () => {
    expect(projectPdfFilename('', undefined)).toBe('diagramahub.pdf');
  });
});
