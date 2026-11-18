import type { Diagram, ProjectWithDiagrams } from '../types/project';

export interface PresentationDeck {
  /** Diagrams in presentation order. */
  slides: Diagram[];
  /** Name of the folder being presented, or '' for the whole project. */
  title: string;
}

/**
 * Diagrams to present for a folder (`folderId`) or, with no folder, the whole
 * project: root diagrams first, then each folder's, in the explorer's order.
 * An unknown folder yields an empty deck.
 */
export function presentationSlides(
  project: ProjectWithDiagrams,
  folderId: string | null,
): PresentationDeck {
  if (folderId) {
    const folder = project.folders.find((f) => f.id === folderId);
    return { slides: folder ? folder.diagrams : [], title: folder ? folder.name : '' };
  }
  return {
    slides: [...project.diagrams, ...project.folders.flatMap((f) => f.diagrams)],
    title: '',
  };
}
