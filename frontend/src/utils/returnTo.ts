/**
 * Where to go back after signing in or creating an account (e.g. the community
 * page where a visitor tried to star a diagram). Kept in sessionStorage so it
 * survives the MFA step and the OAuth round trip.
 */
const KEY = 'dh_return_to';

/** Only same-app paths: "/x", never "//host" or "/\\host" (open redirect). */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  return path;
}

export function rememberReturnTo(path: string | null | undefined): void {
  const safe = safeReturnPath(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe);
  } catch {
    /* storage blocked: the user lands on the default page */
  }
}

/** The remembered path (cleared once read), or `fallback`. */
export function takeReturnTo(fallback: string): string {
  try {
    const saved = safeReturnPath(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}
