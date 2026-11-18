/** Image types a profile picture can have (no SVG: it can carry scripts). */
export const PROFILE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'];

/** Raster image data URLs (what the profile upload produces) and https URLs. */
const SAFE_IMAGE_SRC = /^(data:image\/(png|jpeg|gif|webp|avif|bmp);base64,[A-Za-z0-9+/]+=*|https:\/\/[^\s"'<>]+)$/;

/** The value when it's safe as an <img> source (no SVG, scripts or other schemes); otherwise undefined. */
export function safeImageSrc(value: string | null | undefined): string | undefined {
  return value && SAFE_IMAGE_SRC.test(value) ? value : undefined;
}
