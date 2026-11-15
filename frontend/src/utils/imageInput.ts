/** Client-side checks for the "diagram from image" upload (the server checks again). */

/** Same limit as the backend (ai_providers/services.py MAX_IMAGE_BYTES). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

/** Providers whose API the app calls with image input. */
const PROVIDERS_WITH_IMAGES = new Set(['gemini', 'openai', 'claude']);

export function providerReadsImages(provider: string | null | undefined): boolean {
  return !!provider && PROVIDERS_WITH_IMAGES.has(provider);
}

/** Why a file can't be sent ('notImage' | 'tooLarge'), or null when it can. */
export function imageProblem(file: { type: string; size: number }): 'notImage' | 'tooLarge' | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'notImage';
  if (file.size > MAX_IMAGE_BYTES) return 'tooLarge';
  return null;
}
