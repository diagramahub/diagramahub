/**
 * The Mermaid syntax reference the AI prompts use (backend/app/api/v1/ai_providers/
 * mermaid_reference.json) must stay valid for the mermaid version the app bundles:
 * every example goes through the real parser, and every "invalid" sample must fail.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Mermaid } from 'mermaid';

interface TypeEntry {
  keyword: string;
  use_for: string;
  rules: string[];
  example: string;
  invalid?: string[];
}

const REFERENCE_PATH = resolve(__dirname, '../../../../backend/app/api/v1/ai_providers/mermaid_reference.json');
interface FeatureEntry extends Omit<TypeEntry, 'keyword'> {
  name: string;
  applies_to: string[];
}

const reference = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8')) as { types: TypeEntry[]; features: FeatureEntry[] };

let mermaid: Mermaid;
beforeAll(async () => {
  // Some diagram parsers register a DOMPurify hook, which needs a DOM. Parsing doesn't
  // sanitize, so the shared instance (the one mermaid's bundle imports) gets no-op stubs.
  const purify = (await import('dompurify')).default as unknown as Record<string, unknown>;
  Object.assign(purify, { sanitize: (text: string) => text, addHook: () => {}, removeHook: () => {}, removeHooks: () => {}, removeAllHooks: () => {} });
  mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
});

async function parseError(code: string): Promise<string> {
  try {
    await mermaid.parse(code);
    return '';
  } catch (error) {
    return String((error as Error).message || error).split('\n').slice(0, 3).join(' ');
  }
}

/** The diagram's first line after front matter and %% lines. */
function header(code: string): string {
  const body = code.replace(/^\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, '');
  return body.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('%%')) ?? '';
}

describe('Mermaid reference for the AI prompts', () => {
  it('lists each diagram type once, with guidance', () => {
    const keywords = reference.types.map((t) => t.keyword);
    expect(new Set(keywords).size).toBe(keywords.length);
    for (const entry of reference.types) {
      expect(entry.use_for.length, entry.keyword).toBeGreaterThan(10);
      expect(entry.rules.length, entry.keyword).toBeGreaterThan(0);
    }
  });

  for (const feature of reference.features) {
    it(`${feature.name}: the example parses`, async () => {
      expect(feature.applies_to).toContain(header(feature.example).split(/\s/)[0]);
      expect(feature.rules.length).toBeGreaterThan(0);
      expect(await parseError(feature.example)).toBe('');
    });

    for (const [i, bad] of (feature.invalid ?? []).entries()) {
      it(`${feature.name}: invalid sample ${i + 1} fails`, async () => {
        const error = await parseError(bad);
        expect(error).not.toBe('');
        expect(error).not.toMatch(/DOMPurify|is not a function|document is not defined/);
      });
    }
  }

  for (const entry of reference.types) {
    it(`${entry.keyword}: the example parses`, async () => {
      expect(header(entry.example).split(/\s/)[0]).toBe(entry.keyword);
      expect(await parseError(entry.example)).toBe('');
    });

    for (const [i, bad] of (entry.invalid ?? []).entries()) {
      it(`${entry.keyword}: invalid sample ${i + 1} fails`, async () => {
        const error = await parseError(bad);
        expect(error).not.toBe('');
        // A real syntax error, not the test environment failing.
        expect(error).not.toMatch(/DOMPurify|is not a function|document is not defined/);
      });
    }
  }
});
