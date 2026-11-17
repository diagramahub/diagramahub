import { describe, expect, it } from 'vitest';
import { ConfigInitBlockManager, frontmatterConfigKeys, splitFrontmatter } from '../configInitBlockManager';
import { MERMAID_DEFAULTS } from '../mermaidOptions';

const manager = new ConfigInitBlockManager();

describe('ConfigInitBlockManager (Mermaid 12)', () => {
  it('writes layout and look as top-level init keys', () => {
    const code = manager.embedConfig('graph TD\n  A-->B', { theme: 'neo', layout: 'dagre', look: 'classic' });
    expect(code.startsWith('%%{init: {"theme":"neo","layout":"dagre","look":"classic"}}%%\n')).toBe(true);
  });

  it('leaves the default layout to Mermaid (a mindmap fails when ELK is named)', () => {
    expect(manager.configToInitJson({ theme: 'neo', layout: MERMAID_DEFAULTS.layout, look: 'neo' }).layout).toBeUndefined();
    const code = manager.embedConfig('mindmap\n  root', { theme: 'neo', layout: 'elk', look: 'neo' });
    expect(code).not.toContain('layout');
    expect(manager.parseConfig(code).config?.layout).toBe(MERMAID_DEFAULTS.layout);
  });

  it('only writes the curve when chosen', () => {
    const withCurve = manager.configToInitJson({ theme: 'redux', layout: 'elk', look: 'neo', curve: 'step' });
    const withoutCurve = manager.configToInitJson({ theme: 'redux', layout: 'elk', look: 'neo' });
    expect(withCurve.flowchart).toEqual({ curve: 'step' });
    expect(withoutCurve.flowchart).toBeUndefined();
  });

  it('round-trips the config', () => {
    const config = { theme: 'redux-dark', layout: 'elk', look: 'handDrawn', handDrawnSeed: 3, curve: 'linear' };
    const parsed = manager.parseConfig(manager.embedConfig('graph LR', config)).config;
    expect(parsed).toMatchObject(config);
  });

  it('gives blocks written before 0.9.0 the Mermaid 12 defaults', () => {
    const legacy = '%%{init: {"theme":"default","flowchart":{"curve":"basis"}}}%%\ngraph TD';
    const parsed = manager.parseConfig(legacy).config;
    expect(parsed).toMatchObject({ theme: 'default', layout: MERMAID_DEFAULTS.layout, look: MERMAID_DEFAULTS.look, curve: 'basis' });
  });

  it('keeps a legacy handDrawnSeed as the handDrawn look', () => {
    const parsed = manager.parseConfig('%%{init: {"theme":"base","handDrawnSeed":42}}%%\ngraph TD').config;
    expect(parsed?.look).toBe('handDrawn');
  });

  it('uses the Mermaid 12 theme when the block has none', () => {
    expect(manager.parseConfig('%%{init: {"look":"neo"}}%%\ngraph TD').config?.theme).toBe('redux-color');
  });

  describe('with the diagram\'s own YAML front matter (Mermaid 12 config)', () => {
    const userCode = '---\nconfig:\n  flowchart:\n    stepNumbers: true\n---\nflowchart LR\n  A e1@--> B\n  e1@{ step: 1 }';

    it('splits the front matter from the diagram', () => {
      const { frontmatter, body } = splitFrontmatter(userCode);
      expect(frontmatter).toBe('---\nconfig:\n  flowchart:\n    stepNumbers: true\n---\n');
      expect(body.startsWith('flowchart LR')).toBe(true);
      expect(splitFrontmatter('flowchart LR\n  A --- B').frontmatter).toBe('');
    });

    it('keeps the front matter first and puts the init block after it', () => {
      const code = manager.embedConfig(userCode, { theme: 'neo', layout: 'elk', look: 'classic' });
      expect(code.startsWith('---\nconfig:\n')).toBe(true);
      expect(code).toContain('---\n%%{init: {"theme":"neo","look":"classic"}}%%\nflowchart LR');
    });

    it('leaves out the settings the front matter already sets', () => {
      const own = '---\nconfig:\n  layout: dagre\n  themeVariables:\n    fontSize: 20px\n---\ngraph TD\n  A-->B';
      expect([...frontmatterConfigKeys(own)].sort()).toEqual(['fontSize', 'layout']);
      const code = manager.embedConfig(own, { theme: 'neo', layout: 'elk', look: 'neo', fontSize: 14 });
      expect(code).toContain('%%{init: {"theme":"neo","look":"neo"}}%%');
    });

    it('replaces its own block on the next save instead of stacking another', () => {
      const once = manager.embedConfig(userCode, { theme: 'neo', layout: 'elk', look: 'neo' });
      const twice = manager.embedConfig(manager.parseConfig(once).contentWithoutInit, { theme: 'dark', layout: 'elk', look: 'neo' });
      expect(twice.match(/%%\{init/g)).toHaveLength(1);
      expect(manager.parseConfig(twice).config?.theme).toBe('dark');
    });

    it('does not take a title-only front matter key for a setting', () => {
      expect(frontmatterConfigKeys('---\ntitle: theme: x\n---\n').size).toBe(0);
    });
  });
});
