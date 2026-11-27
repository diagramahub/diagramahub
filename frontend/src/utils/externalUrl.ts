/**
 * Guards for URLs the API hands back for the browser to open (Stripe Checkout,
 * invoices, OAuth sign-in). The app only follows them when they are https and
 * on the host the integration is known to use, so a tampered or misconfigured
 * response can't send the user to an arbitrary site (open redirect) or run a
 * `javascript:` URL.
 */

/** Stripe-hosted pages: checkout.stripe.com, billing.stripe.com, pay.stripe.com, invoice.stripe.com… */
export const STRIPE_DOMAINS = ['stripe.com'];

/**
 * Authorization endpoints of the OAuth providers the backend supports
 * (`backend/app/api/v1/oauth/providers/`). Add the host here when adding a provider.
 */
export const OAUTH_AUTHORIZE_DOMAINS = ['accounts.google.com'];

/**
 * The URL when it is https, carries no credentials and its host is one of
 * `domains` or a subdomain of one; otherwise null.
 */
export function safeExternalUrl(url: string | null | undefined, domains: readonly string[]): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  const allowed = domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  return allowed ? parsed.href : null;
}
