/**
 * Mermaid appearance options offered in the editor (Mermaid 12).
 * Labels live in the locales under `mermaidOptions.*`.
 * The backend mirrors the defaults in diagrams/schemas.py (MERMAID_DEFAULT_*).
 */

/** Mermaid 12's own defaults: ELK layout, the redux-color theme and the neo look. */
export const MERMAID_DEFAULTS = {
  theme: 'redux-color',
  layout: 'elk',
  look: 'neo',
  /** '' = Mermaid's default curve (not written to the init block). */
  curve: '',
} as const;

export const MERMAID_THEMES = [
  'redux-color',
  'redux',
  'redux-dark-color',
  'redux-dark',
  'neo',
  'neo-dark',
  'default',
  'base',
  'dark',
  'forest',
  'neutral',
] as const;

export const MERMAID_LAYOUTS = ['elk', 'dagre'] as const;

export const MERMAID_LOOKS = ['neo', 'classic', 'handDrawn'] as const;

export const MERMAID_CURVES = ['', 'basis', 'linear', 'step', 'stepBefore', 'stepAfter'] as const;

export const MERMAID_FONT_SIZES = ['12', '14', '16', '18', '20'] as const;
