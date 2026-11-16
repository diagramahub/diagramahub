import { describe, expect, it } from 'vitest';
import { CHUNK_RELOAD_WINDOW_MS, isChunkLoadError, shouldAutoReload } from '../chunkError';

describe('chunkError', () => {
  it('recognizes chunk load failures from every browser', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: http://x/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('reloads automatically at most once per window', () => {
    expect(shouldAutoReload(null, 1000)).toBe(true);
    expect(shouldAutoReload(1000, 1000 + CHUNK_RELOAD_WINDOW_MS)).toBe(false);
    expect(shouldAutoReload(1000, 1001 + CHUNK_RELOAD_WINDOW_MS)).toBe(true);
  });
});
