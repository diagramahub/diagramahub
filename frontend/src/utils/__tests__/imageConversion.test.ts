import { describe, expect, it } from 'vitest';
import { conversionHint, diagramTypeName, stepState } from '../imageConversion';

describe('image conversion progress', () => {
  it('moves the hint along with the wait, ending with the slow-model notice', () => {
    expect([0, 7, 16, 31, 61].map(conversionHint)).toEqual(['reading', 'elements', 'writing', 'reviewing', 'slow']);
  });

  it('marks earlier steps done, the current one and the rest pending', () => {
    expect(['upload', 'analyze', 'render'].map((s) => stepState(s as never, 'analyze'))).toEqual(['done', 'current', 'pending']);
    expect(stepState('render', 'done')).toBe('done');
  });

  it('names the diagram type', () => {
    expect(diagramTypeName('plantuml')).toBe('PlantUML');
  });
});
