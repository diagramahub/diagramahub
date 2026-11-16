/** Detect failed loads of a route chunk (dynamic import), across browsers. */

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chromium
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
  'Unable to preload CSS', // Vite preload helper
];

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/** sessionStorage key: when we last reloaded because of a chunk error. */
export const CHUNK_RELOAD_KEY = 'dh-chunk-reload-at';
/** Don't reload again within this window (avoids reload loops). */
export const CHUNK_RELOAD_WINDOW_MS = 30_000;

/** Whether an automatic reload is allowed now (none in the last window). */
export function shouldAutoReload(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > CHUNK_RELOAD_WINDOW_MS;
}
