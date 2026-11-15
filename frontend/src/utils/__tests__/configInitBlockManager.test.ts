import { describe, expect, it } from 'vitest';
import { ConfigInitBlockManager } from '../configInitBlockManager';
import { MERMAID_DEFAULTS } from '../mermaidOptions';

const manager = new ConfigInitBlockManager();

describe('ConfigInitBlockManager (Mermaid 12)', () => {
  it('writes layout and look as top-level init keys', () => {
    const code = manager.embedConfig('graph TD\n  A-->B', { theme: 'neo', layout: 'dagre', look: 'classic' });
    expect(code.startsWith('%%{init: {"theme":"neo","layout":"dagre","look":"classic"}}%%\n')).toBe(true);
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
});
