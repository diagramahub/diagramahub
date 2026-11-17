import type { Monaco } from '@monaco-editor/react';
import { registerD2Language } from './d2Language';

/** Monaco theme used in dark mode, matching the app's dark palette. */
export const MONACO_DARK_THEME = 'kiro-dark';
export const MONACO_LIGHT_THEME = 'vs';

/**
 * Monaco language for a diagram type. Monaco has no Mermaid, PlantUML or DBML
 * grammar, so those use the closest built-in one; D2 has its own tokenizer.
 */
export function monacoLanguageFor(diagramType: string): string {
  if (diagramType === 'd2') return 'd2';
  if (diagramType === 'plantuml') return 'java';
  return 'markdown';
}

/** Register the custom languages and themes. Safe to call more than once. */
export function setupMonaco(monaco: Monaco) {
  registerD2Language(monaco);
  monaco.editor.defineTheme(MONACO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c084fc' },
      { token: 'string', foreground: 'a78bfa' },
      { token: 'number', foreground: 'e879f9' },
      { token: 'type', foreground: '818cf8' },
      { token: 'variable', foreground: 'e2e8f0' },
      { token: 'function', foreground: 'c4b5fd' },
      { token: 'operator', foreground: 'a5b4fc' },
      { token: 'delimiter', foreground: '94a3b8' },
    ],
    colors: {
      'editor.background': '#111827',
      'editor.foreground': '#e2e8f0',
      'editor.lineHighlightBackground': '#1f2937',
      'editor.selectionBackground': '#7c3aed40',
      'editor.inactiveSelectionBackground': '#7c3aed20',
      'editorCursor.foreground': '#a78bfa',
      'editorLineNumber.foreground': '#4b5563',
      'editorLineNumber.activeForeground': '#a78bfa',
      'editor.selectionHighlightBackground': '#7c3aed30',
      'editorIndentGuide.background1': '#1f2937',
      'editorIndentGuide.activeBackground1': '#7c3aed50',
      'editorBracketMatch.background': '#7c3aed30',
      'editorBracketMatch.border': '#7c3aed',
      'scrollbarSlider.background': '#7c3aed30',
      'scrollbarSlider.hoverBackground': '#7c3aed50',
      'scrollbarSlider.activeBackground': '#7c3aed70',
    },
  });
}
