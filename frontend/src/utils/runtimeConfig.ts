/**
 * Runtime configuration for the DiagramaHub frontend.
 *
 * Precedence (first non-empty value wins):
 *   1. /config.js (window.__DH_CONFIG__) — injected at container start from
 *      environment variables in the production image; a placeholder with
 *      empty values in development.
 *   2. Vite build-time env vars (import.meta.env.VITE_*).
 *   3. Localhost defaults.
 */

interface RuntimeConfig {
  API_URL: string;
  SENTRY_DSN: string;
  APP_ENV: string;
}

declare global {
  interface Window {
    __DH_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const windowConfig = (typeof window !== 'undefined' ? window.__DH_CONFIG__ : undefined) || {};

export const API_URL: string =
  windowConfig.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:5172';

export const SENTRY_DSN: string =
  windowConfig.SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN || '';

export const APP_ENV: string =
  windowConfig.APP_ENV || import.meta.env.VITE_APP_ENV || import.meta.env.MODE || '';
