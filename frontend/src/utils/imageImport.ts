/**
 * Images inserted in freehand sketches (pasted, dropped or picked).
 *
 * Before uploading, the browser decodes the image, shrinks it to at most
 * MAX_IMAGE_SIDE pixels on its longest side and re-encodes it (WebP, which
 * keeps transparency; JPEG when that is still too heavy). Re-encoding also
 * drops metadata such as a photo's GPS position.
 */

/** Types the server accepts (it checks the bytes too). Never SVG: it can carry scripts. */
export const INSERTABLE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Longest side of a stored image, in pixels. */
export const MAX_IMAGE_SIDE = 2048;

/** Upload budget: the server's 3 MiB limit with some margin. */
export const MAX_IMAGE_BYTES = 2.9 * 1024 * 1024;

/** Longest side of a freshly inserted image on the canvas (world units). */
export const INSERTED_IMAGE_SIDE = 480;

/** Whether a file (by its declared type) can be inserted as an image. */
export function isInsertableImage(file: { type: string }): boolean {
  return INSERTABLE_IMAGE_TYPES.includes(file.type);
}

/** Size within `max` on the longest side, same aspect ratio, never enlarged. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: max, height: max };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class ImageTooLargeError extends Error {
  constructor() {
    super("image_too_large");
    this.name = "ImageTooLargeError";
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decode, shrink and re-encode an image for upload. Resolves with the bytes
 * and the pixel size of the stored image.
 *
 * Throws when the browser can't decode the file, and ImageTooLargeError when
 * it can't be brought under the upload budget.
 */
export async function prepareImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_SIDE);
    // Shrink further only if even JPEG at this size is over the budget
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no_canvas");
      ctx.drawImage(bitmap, 0, 0, width, height);
      // Browsers without a WebP encoder return PNG instead
      const webp = await encode(canvas, "image/webp", 0.85);
      if (webp && webp.size <= MAX_IMAGE_BYTES) return { blob: webp, width, height };
      const jpeg = await encode(canvas, "image/jpeg", 0.82);
      if (jpeg && jpeg.size <= MAX_IMAGE_BYTES) return { blob: jpeg, width, height };
      width = Math.max(1, Math.round(width * 0.7));
      height = Math.max(1, Math.round(height * 0.7));
    }
    throw new ImageTooLargeError();
  } finally {
    bitmap.close();
  }
}
