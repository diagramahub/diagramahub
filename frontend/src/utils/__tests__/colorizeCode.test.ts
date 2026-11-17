import { describe, expect, it } from 'vitest';
import { splitColorizedHtml } from '../colorizeCode';
import { monacoLanguageFor } from '../monacoSetup';

describe('splitColorizedHtml', () => {
  it('splits Monaco output into one entry per source line', () => {
    const html = '<span class="mtk1">graph</span><br/><span class="mtk6">A</span><br/><span></span><br/>';
    expect(splitColorizedHtml(html, 3)).toEqual([
      '<span class="mtk1">graph</span>',
      '<span class="mtk6">A</span>',
      '<span></span>',
    ]);
  });

  it('pads missing lines and drops extra ones', () => {
    expect(splitColorizedHtml('<span>a</span>', 2)).toEqual(['<span>a</span>', '']);
    expect(splitColorizedHtml('a<br/>b<br/>c', 2)).toEqual(['a', 'b']);
  });
});

describe('monacoLanguageFor', () => {
  it('maps diagram types like the editor does', () => {
    expect(monacoLanguageFor('d2')).toBe('d2');
    expect(monacoLanguageFor('plantuml')).toBe('java');
    expect(monacoLanguageFor('mermaid')).toBe('markdown');
    expect(monacoLanguageFor('dbml')).toBe('markdown');
  });
});
