import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, imageProblem, providerReadsImages } from '../imageInput';

describe('imageInput', () => {
  it('accepts PNG, JPEG and WebP up to the limit', () => {
    expect(imageProblem({ type: 'image/png', size: 10 })).toBeNull();
    expect(imageProblem({ type: 'image/jpeg', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(imageProblem({ type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects other types and bigger files', () => {
    expect(imageProblem({ type: 'image/gif', size: 10 })).toBe('notImage');
    expect(imageProblem({ type: 'application/pdf', size: 10 })).toBe('notImage');
    expect(imageProblem({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('tooLarge');
  });

  it('knows which providers read images', () => {
    expect(providerReadsImages('gemini')).toBe(true);
    expect(providerReadsImages('openai')).toBe(true);
    expect(providerReadsImages('claude')).toBe(true);
    expect(providerReadsImages('deepseek')).toBe(false);
    expect(providerReadsImages('minimax')).toBe(false);
    expect(providerReadsImages(null)).toBe(false);
  });
});
