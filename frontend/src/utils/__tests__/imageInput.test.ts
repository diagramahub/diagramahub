import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, imageProblem, modelReadsImages, providerReadsImages } from '../imageInput';

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

describe('modelReadsImages', () => {
  it('follows the catalog for listed models and the provider for others', () => {
    expect(modelReadsImages('gemini', 'gemini-3.8-flash')).toBe(true);
    expect(modelReadsImages('claude', 'claude-sonnet-5-5')).toBe(true);
    expect(modelReadsImages('deepseek', 'deepseek-flash')).toBe(false);
    expect(modelReadsImages('openai', 'gpt-typed-by-hand')).toBe(true);
    expect(modelReadsImages('minimax', 'MiniMax-M3')).toBe(false);
    expect(modelReadsImages(null, null)).toBe(false);
  });
});
