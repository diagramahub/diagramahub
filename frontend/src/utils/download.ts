/**
 * Browser download helpers shared by the export dialogs and the editor.
 */

/**
 * Save a Blob as a file. The object URL is revoked a moment later: revoking
 * it right after `click()` can cancel the download in Firefox/Safari,
 * especially for large files.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Seconds from a 429 response's `Retry-After` header, or null when absent/invalid. */
export function retryAfterSeconds(error: unknown): number | null {
  const headers = (error as { response?: { headers?: Record<string, unknown> } })?.response?.headers;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}
