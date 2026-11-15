import { describe, expect, it } from 'vitest';
import type { Diagram, ProjectWithDiagrams } from '../../types/project';
import { presentationSlides } from '../presentation';

const diagram = (id: string, folder_id: string | null = null): Diagram =>
  ({ id, title: id, content: 'graph TD\n A-->B', diagram_type: 'mermaid', folder_id }) as Diagram;

const project = {
  id: 'p1',
  name: 'Project',
  diagrams: [diagram('root-1'), diagram('root-2')],
  folders: [
    { id: 'f1', name: 'Architecture', diagrams: [diagram('a-1', 'f1'), diagram('a-2', 'f1')] },
    { id: 'f2', name: 'Empty', diagrams: [] },
  ],
} as unknown as ProjectWithDiagrams;

describe('presentationSlides', () => {
  it('presents one folder with its name', () => {
    const deck = presentationSlides(project, 'f1');
    expect(deck.title).toBe('Architecture');
    expect(deck.slides.map((d) => d.id)).toEqual(['a-1', 'a-2']);
  });

  it('presents the whole project: root first, then folders', () => {
    const deck = presentationSlides(project, null);
    expect(deck.title).toBe('');
    expect(deck.slides.map((d) => d.id)).toEqual(['root-1', 'root-2', 'a-1', 'a-2']);
  });

  it('yields an empty deck for an empty or unknown folder', () => {
    expect(presentationSlides(project, 'f2').slides).toEqual([]);
    expect(presentationSlides(project, 'missing')).toEqual({ slides: [], title: '' });
  });
});
