import type { Monaco } from '@monaco-editor/react';

/**
 * Register the D2 diagramming language in Monaco Editor
 * with basic syntax highlighting support.
 */
export function registerD2Language(monaco: Monaco) {
  // Only register if not already registered
  const languages = monaco.languages.getLanguages();
  if (languages.some((language: { id: string }) => language.id === 'd2')) {
    return;
  }

  monaco.languages.register({ id: 'd2' });
  monaco.languages.setMonarchTokensProvider('d2', {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/->|<->|--|<-/, 'keyword'],
        [/"[^"]*"/, 'string'],
        [/\b(shape|style|label|icon|near|tooltip|link|constraint)\b/, 'keyword'],
        [/\{/, 'delimiter.bracket'],
        [/\}/, 'delimiter.bracket'],
        [/:/, 'delimiter'],
      ],
    },
  });
}
