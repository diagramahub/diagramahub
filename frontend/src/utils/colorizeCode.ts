import { loader } from '@monaco-editor/react';
import DOMPurify from 'dompurify';
import { MONACO_DARK_THEME, MONACO_LIGHT_THEME, monacoLanguageFor, setupMonaco } from './monacoSetup';

/** Split colorized HTML (lines joined by `<br/>`) into exactly `lineCount` lines. */
export function splitColorizedHtml(html: string, lineCount: number): string[] {
  const lines = html.split(/<br\s*\/?>/i).slice(0, lineCount);
  while (lines.length < lineCount) lines.push('');
  return lines;
}

/**
 * Syntax-highlight diagram code with the same grammar and theme as the editor,
 * without mounting one. Resolves to one HTML string per line.
 */
export async function colorizeDiagramCode(code: string, diagramType: string, dark: boolean): Promise<string[]> {
  const monaco = await loader.init();
  setupMonaco(monaco);
  monaco.editor.setTheme(dark ? MONACO_DARK_THEME : MONACO_LIGHT_THEME);
  const html = await monaco.editor.colorize(code, monacoLanguageFor(diagramType), { tabSize: 2 });
  // Monaco escapes the source text; keep only its token spans regardless.
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span', 'br'], ALLOWED_ATTR: ['class'] });
  return splitColorizedHtml(clean, code.split('\n').length);
}
