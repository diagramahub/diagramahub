import { describe, expect, it } from 'vitest';
import { safeImageSrc } from '../imageSrc';

describe('safeImageSrc', () => {
  it('keeps raster data URLs and https URLs', () => {
    expect(safeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(safeImageSrc('data:image/jpeg;base64,/9j/4AAQ')).toBe('data:image/jpeg;base64,/9j/4AAQ');
    expect(safeImageSrc('https://example.com/a.png')).toBe('https://example.com/a.png');
  });

  it('drops anything else', () => {
    for (const value of [
      undefined,
      null,
      '',
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'http://example.com/a.png',
      'https://example.com/a.png" onerror="x',
    ]) {
      expect(safeImageSrc(value)).toBeUndefined();
    }
  });
});
