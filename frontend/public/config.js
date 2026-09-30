// Runtime configuration placeholder for the DiagramaHub frontend.
//
// Production: the container entrypoint regenerates this file from environment
// variables (VITE_API_URL, VITE_SENTRY_DSN, VITE_APP_ENV) before Nginx starts,
// so configuration changes never require a rebuild.
//
// Development: Vite serves this file as-is with empty values, so the build-time
// env vars from frontend/.env keep precedence. Empty values also keep a plain
// `dist/` build (outside Docker) working with its baked defaults.
window.__DH_CONFIG__ = {
  API_URL: "",
  SENTRY_DSN: "",
  APP_ENV: "",
};
