/** "Diagram from image" progress: the steps the user sees and the hint for the wait. */

export type ConversionPhase = 'upload' | 'analyze' | 'render' | 'done';

export const CONVERSION_STEPS: Exclude<ConversionPhase, 'done'>[] = ['upload', 'analyze', 'render'];

export type ConversionHint = 'reading' | 'elements' | 'writing' | 'reviewing' | 'slow';

/**
 * What to say while the AI works (the API doesn't report progress, so the hint
 * follows typical timings: most conversions take 5-30 s, reasoning models longer).
 */
export function conversionHint(seconds: number): ConversionHint {
  if (seconds < 6) return 'reading';
  if (seconds < 15) return 'elements';
  if (seconds < 30) return 'writing';
  if (seconds < 60) return 'reviewing';
  return 'slow';
}

/** How a step looks in the stepper for the current phase. */
export function stepState(step: ConversionPhase, phase: ConversionPhase): 'done' | 'current' | 'pending' {
  const order: ConversionPhase[] = ['upload', 'analyze', 'render', 'done'];
  const [s, p] = [order.indexOf(step), order.indexOf(phase)];
  return s < p ? 'done' : s === p ? 'current' : 'pending';
}

const TYPE_NAMES: Record<string, string> = { mermaid: 'Mermaid', plantuml: 'PlantUML', d2: 'D2', dbml: 'DBML' };

export function diagramTypeName(type: string): string {
  return TYPE_NAMES[type] ?? type;
}
