# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-08-15

### Added
- AI-powered diagram type conversion between Mermaid, PlantUML, D2, and DBML formats with side-by-side preview modal and incompatibility warnings.
- New "Freehand" diagram type with an Excalidraw-like whiteboard canvas supporting rectangles, diamonds, circles, arrows, lines, text, and freehand paths.
- Full toolbar for the freehand canvas with color pickers, stroke width controls, eraser, and keyboard shortcuts (Delete, Escape).
- Freehand canvas usability overhaul inspired by Miro and Excalidraw:
  - Undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) with toolbar buttons and a 100-step history.
  - Inline text editing (no browser prompt) with multi-line support, auto-growing text elements, and shape text always centered.
  - Complete tool shortcuts (V/H/R/D/O/A/L/T/P/E), duplicate (Ctrl+D), arrow-key nudging, and fit-to-content (F).
  - Hand tool and Space+drag panning.
  - Hover highlight and move cursor in select mode.
  - Alignment and distribution tools for multi-selection.
  - Grouping/ungrouping (Ctrl+G / Ctrl+Shift+G) with group-aware click selection.
  - Shape and text rotation with Shift snapping to 15°; connected arrows follow rotated anchors.
  - Miro-style red alignment guides with snapping while dragging or drawing.
  - Contextual style panel positioned beside the selection.
  - Drag-to-erase eraser, dashed lines, start/end arrowheads, rounded rectangle corners, and text font size controls.

### Changed
- Migrated frontend package manager from npm to pnpm for faster installs and better disk efficiency.
- Updated frontend Dockerfile to use corepack with pnpm@9.
- Updated all docker-compose files to mount `pnpm-lock.yaml` instead of `package-lock.json`.

### Fixed
- Diagram editor now opens with the folders/files sidebar closed; it only appears when clicking the folder icon next to the diagram title.
- Converted diagrams are automatically re-centered (fit to screen) after accepting an AI type conversion.
- Freehand canvas no longer shows stale content when switching between freehand diagrams.

## [0.5.11] - 2026-07-19

### Added
- Admin user management now shows each user's diagram totals grouped by diagram engine (Mermaid, PlantUML, D2, and DBML).
- The About page now displays the running application version and links directly to the GitHub releases page.
- Added the committed backend `poetry.lock` file for reproducible dependency installation and security scanning.

### Changed
- Backend container now uses Python 3.13 on Alpine 3.23 and installs locked dependencies during image builds.
- Documentation dependencies are pinned to reproducible, updated versions.

### Security
- Updated backend runtime dependencies: `cryptography` to 46.0.7, `gunicorn` to 23.0.0, and `python-multipart` to 0.0.31.

## [0.5.10] - 2026-07-18

### Added
- Persistent, VS Code-inspired project explorer in the diagram editor. It supports creating diagrams directly in a folder, renaming folders, and moving diagrams between the project root and the single available folder level.
- New **About** page with product information, GitHub repository, X account, and contact email.

### Fixed
- Explorer interactions no longer dismiss the panel as outside clicks.
- The fit-to-screen action now calculates against the rendered SVG and correctly centers D2 diagrams.
- Added the missing Monaco language item type in the D2 language registration, keeping the refreshed frontend toolchain type-safe.

### Changed
- Replaced the ambiguous map-pin fit-to-screen icon with a clear framing icon.
- `CLAUDE.md` now delegates project guidance to `AGENTS.md`.

### Security
- Refreshed compatible frontend dependency patches, including `axios 1.18.1`, `dompurify 3.4.12`, `mermaid 11.16.0`, `react-router-dom 7.18.1`, `vite 7.3.6`, `eslint 9.39.5`, `postcss 8.5.19`, and `typescript-eslint 8.64.0`.
- Updated the dependency lockfile to resolve vulnerable transitive packages; `npm audit` reports zero vulnerabilities for production and development dependencies.

## [0.5.9] - 2026-06-19

### Security
- **dompurify** `3.4.2 → 3.4.11` — fixes Snyk-reported Prototype Pollution, XSS, Trust Boundary Violation and Protection Mechanism Failure. Also pinned via `overrides` so the transitive copy bundled by `monaco-editor` (`3.1.7`) resolves to `3.4.11`.
- **react-router-dom** `7.15.0 → 7.18.0` — fixes Snyk-reported CSRF.
- **form-data** `4.0.5 → 4.0.6` (via `overrides`, transitive through axios) — fixes Snyk-reported CRLF Injection.
- Removed hardcoded credentials from the Python test suite (Snyk CWE-798). Sensitive sample values (passwords, tokens, secrets, API keys) are now generated dynamically via `tests/utils/security.py` helpers (`generate_test_password`, `generate_test_token`, `generate_test_secret`, `generate_test_api_key`).

### Changed
- Frontend Docker base image `node:20-alpine → node:24-alpine` (Node 20 reached end-of-life; 24 is Active LTS and aligns with `@types/node` 24).
- Dependency refresh (within current majors, no breaking changes): `axios 1.18.0`, `react`/`react-dom 19.2.7`, `vite 7.3.5`, `@vitejs/plugin-react 5.2.0`, `tailwindcss 3.4.19`, `@tailwindcss/typography 0.5.20`, `postcss 8.5.15`, `autoprefixer 10.5.0`, `i18next 25.10.10`, `react-i18next 16.6.6`, `react-markdown 9.1.0`, `@sentry/react 9.47.1`, `eslint 9.39.4`, `typescript-eslint 8.61.1`, `@types/*` and others.

### Documentation
- Slimmed down the README (~245 → ~130 lines): extracted the detailed architecture into [ARCHITECTURE.md](ARCHITECTURE.md) and the security controls into [SECURITY.md](SECURITY.md), condensed the feature list, and fixed broken header emojis.
- Added a Star History chart to the README.

### Notes
- TailwindCSS intentionally kept on v3 (PostCSS compatibility).
- `codemirror 5.65.21` (ReDoS, transitive via `easymde`) has no fix on the 5.x line; resolving it requires migrating the Markdown editor to CodeMirror 6 — tracked as a separate follow-up.
- Major upgrades deferred for a dedicated effort: `@sentry/react 10`, `i18next 26`/`react-i18next 17`, `react-markdown 10`, `vite 8`, `typescript 6`, `eslint 10`.

## [0.5.8] - 2026-06-18

### Added
- SVG export: download diagrams as clean, standalone scalable vectors (Mermaid, PlantUML, D2, DBML). Ideal for embedding in docs/READMEs or further editing.

### Changed
- Redesigned the export modal: format options laid out as a 2×2 card grid (PNG, SVG, PDF, Markdown), content options grouped into a compact secondary section, and source-code download moved to a subtle footer button — reducing visual clutter.
- Extracted the export modal into a dedicated `ExportDiagramModal` component.

### Security
- **DOM-based XSS (Snyk, Medium)**: sanitize rendered SVG with DOMPurify (`sanitizeSvg`) before injecting it via `innerHTML` in the diagram preview, editor, and shared diagram views. Mermaid output (rendered with `securityLevel: 'loose'`) is now sanitized like server-rendered SVG.
- Sanitize rendered Markdown description HTML (`sanitizeRichHtml`) before `innerHTML` assignment in PDF/PNG description export.
- Frontend Docker image now runs `apk upgrade` to pick up the latest Alpine OpenSSL security patches (CVE-2026-* reported by Snyk Container), matching the backend image.

## [0.5.7] - 2026-06-16

### Added
- Exportación PDF optimizada: tamaño reducido de 150–200 MB a ~1–5 MB con rasterización PNG 2x de alta calidad.
- Exportación Markdown ahora incluye descripción del diagrama y metadatos del proyecto cuando se seleccionan.
- Encabezado corporativo en exportaciones PDF/PNG: título del diagrama (siempre), proyecto/carpeta/autor (opcional), pie de página con fecha y branding.
- Descripciones en PDF renderizan Markdown como HTML formateado en lugar de sintaxis cruda.
- Spinners de carga individuales por formato de exportación.
- Carga bajo demanda (lazy-load) de jsPDF para exportaciones más fluidas.

### Changed
- Lógica de exportación refactorizada de DiagramEditorPage.tsx a módulos utilitarios dedicados.

## [0.5.6] - 2026-05-25

### Security
- **Critical**: fixed bug in `change_password` and `confirm_password_reset` that reverted the new hash because a stale in-memory user copy was saved afterwards. Passwords were not actually changing. `update_password` now updates `hashed_password` and `password_changed_at` atomically.
- Backend Docker base image migrated to `python:3.13-alpine3.22`, removing most Debian packages (`util-linux`, `systemd`, `perl`, `shadow`, `tar`) with CVEs reported by Snyk.

### Changed
- Alpine build uses `apk` with virtual `.build-deps` (gcc, musl-dev, libffi-dev, openssl-dev, cargo) to compile native wheels and purge them at the end.
- `tests/conftest.py` registers all 17 Beanie documents (previously only 6) and resets the `login_rate_limiter` and `account_lockout` state between tests.

### Fixed
- `test_streaming_integration.py` tests: assertions updated from `403` to `401` (current `HTTPBearer` behavior in FastAPI 0.128+).
- `tests/test_openai_models.py`: renamed function `test_model` to `run_model_check` to prevent erroneous pytest discovery.

## [0.5.5] - 2026-05-17

### Security
- Replaced hardcoded test passwords with dynamic generation (`generate_test_password()`).
- Removed `passlib` dependency (uses `crypt`, removed in Python 3.13) in favor of direct `bcrypt`.
- Sanitized examples with hardcoded credentials in documentation.
- Character limit on diagram descriptions (50,000).
- Test API keys changed to non-secret-looking strings.

### Changed
- Python 3.13 support: constraint updated to `>=3.12,<3.14`.
- Backend Docker base image updated to `python:3.13-slim-trixie`.
- `bcrypt` bumped from `4.0.1` to `^4.1`.
- `test-api.sh` script: health check fixed.
- `test-onboarding.sh` script: aligned with wizard flow.
- Tooling (black, ruff, mypy) configured for `py313`.

### Fixed
- `EmailService` mock path in password management tests.
- Resend adapter mocks (were using the wrong method).

### Docs
- Password examples replaced with placeholders.
- Password policy updated in `backend/README.md`.
- Quality standard in `CLAUDE.md`: never hardcode credentials.

## [0.5.4] - 2026-05-14

### Added
- Predefined quick actions in the AI chat: Explain, Improve UI, Improve Process, and Repair.
- Resizable chat panel with per-diagram width persistence (localStorage + user_preferences).
- Admin panel: new columns "License usage", "Connected AI models", and "Last login".
- `last_login_at` tracking on users (normal login and post-MFA).
- Block explanation requests in the improve modal, redirecting to the AI chat.
- Admin Excel export shows "License usage" in human-readable format.
- New i18n keys for chat quick actions and admin panel columns.

### Changed
- Chat panel resize logic moved from `AIChatPanel` to `DiagramEditorPage`.
- Response mode detection (`text` vs `code`) refactored to support preset actions.
- AI response parsing now conditioned by response mode.
- Backend Docker base image updated from `python:3.12-slim-bookworm` to `python:3.12-slim-trixie`.
- Internationalized hardcoded ChatInput strings.

## [0.5.3] - 2026-05-12

### Added
- Real-time AI response streaming via Server-Sent Events (SSE).
- Progressive phase indicators: "Thinking…", "Analyzing your diagram…", "Generating code…", "Validating syntax…".
- Automatic response-mode detection (text vs code) to hide internal content during diagram generation.
- Real-time filtering of `<think>` tags from reasoning models during streaming.
- Automatic stream cancellation when closing the panel or switching diagrams.
- Retry button (max 3 attempts) on streaming errors.
- Automatic fallback to non-streaming flow when the provider doesn't support it.
- `sanitize.ts` module for SVG XSS sanitization (DOMPurify).
- 45 new tests (unit, property-based with Hypothesis, integration).

### Changed
- Python upgraded from 3.11 to 3.12 (Dockerfile, pyproject.toml, tooling).
- FastAPI pin updated to `>=0.115.0,<0.129.0`.
- `python-multipart` updated from `^0.0.12` to `^0.0.18`.
- Backend Docker base image updated to `python:3.12-slim-bookworm` with `dist-upgrade`.
- Structure icon moved to the left of the diagram name.
- Chat `language` parameter uses the user's active language (i18n).
- SVG sanitization applied only to server-rendered diagrams, not local Mermaid.

### Fixed
- Mermaid node text invisible due to incorrect `foreignObject` sanitization.
- `test_change_password_without_auth` updated for HTTP 401.

## [0.5.2] - 2026-05-10

### Changed
- axios updated from 1.12.2 to 1.16.0 (fixes 2 critical, 5 high, and 5 medium vulnerabilities reported by Snyk).
- jspdf updated from 2.5.2 to 4.2.1 (fixes 1 critical, 7 high, and 2 medium vulnerabilities).
- react-router-dom updated from 7.9.4 to 7.15.0 (fixes 2 high and 2 medium vulnerabilities).
- mermaid updated from 11.4.1 to 11.14.0 (fixes vulnerabilities in transitive dependencies: dompurify, lodash-es, dagre-d3-es, uuid).
- easymde updated from 2.18.0 to 2.21.0 (fixes transitive codemirror ReDoS vulnerability).
- Version corrected in `backend/app/core/config.py` (1.0.0 → 0.5.2).

### Added
- Snyk badge in README.md showing known-vulnerability status.
- Integration with the Snyk Secure Developer Program for Open Source.

### Security
- Frontend dependencies updated to resolve 4 critical, 14 high, and 10+ medium vulnerabilities reported by Snyk.

## [0.5.1] - 2026-05-09

### Added
- Reusable `Skeleton` component with variants (`text`, `card`, `chart`, `table`) for loading states.
- Skeleton loading states in Dashboard, ProjectsPage, DiagramEditorPage, and ProfilePage.
- `EmptyState` component with icon, title, description, and suggested action (CTA).
- Guided empty states in Dashboard (no projects), Editor (no diagrams), and Chat (no sessions).
- `MobileEditorLayout`: adaptive layout for the editor on mobile devices (<768px).
- Slide-up bottom sheets for code and description panels on mobile.
- Fixed bottom toolbar on mobile with contextual icons.
- `useTouchZoomPan` hook: pinch zoom and two-finger pan in diagram preview.
- Sidebar auto-hides when entering presentation mode and is restored on exit.

### Changed
- Confirmation dialogs unified under the `ConfirmModal` component (delete project, logout, delete chat message).
- Desktop editor layout untouched; mobile view is a separate wrapper.

### Fixed
- Mobile virtual keyboard no longer hides the chat input (uses `visualViewport` API).
- Tooltips no longer appear on touch devices (prevents accidental activation).
- Export modal is scrollable in small viewports.

## [0.5.0] - 2026-05-05

### Added
- Collapsible sidebar: responsive, with theme toggle, language selector, and navigation.
- Full dark mode across the application (all modals, pages, and components).
- Support for DBML (Database Markup Language) diagrams via Kroki/dbml-renderer.
- Minimax AI provider (BYOL) with MiniMax-M2.7 and MiniMax-M2.5 models.
- Standalone Projects page (`/projects-list`) with table view.
- Redesigned Dashboard: donut chart by diagram type, AI usage widget, recent diagrams.
- AI chat: persistent rolling summary per session, code-first format, extraction fallbacks.
- Editor: project breadcrumb with selector, resizable code panel, Kiro Dark theme for Monaco.
- "Fix with AI" button in the code panel (works on render errors).
- "Community" section in the sidebar (coming soon).
- `/diagrams/recent` endpoint for the user's recent diagrams.
- `/chat-sessions/stats/provider-usage` endpoint for AI usage statistics.
- `SENTRY_ENABLE_LOGS` configurable via `.env`.
- `getEffectiveModel()` for automatic fallback of retired models.
- Kroki rendering context in AI prompts for PlantUML, D2, and DBML.

### Changed
- Updated models: DeepSeek v4-flash/v4-pro, Gemini 3.1-pro-preview, MiniMax M2.7/M2.5.
- `max_tokens` increased from 2048 to 4096 across all AI providers.
- Chat prompt: code first, brief explanation after.
- Auto-retry disabled for PlantUML and DBML (validator false positives).
- Sidebar reduced to 160px when expanded.
- Logout moved from the sidebar to the Profile page.
- "AI" renamed to "Settings" in the sidebar with a gear icon.
- Language selector: full width, dropdown opens upward, chevron on the right.
- Tooltip: uses `position: fixed` to avoid overflow clipping.
- Kroki error messages: parsed into a user-friendly format.

### Fixed
- Monaco Editor didn't render code (ResizeObserver + layout forcing).
- Code toggle closed the description panel (independent click-outside handlers).
- Persisted zoom was overwritten by fit-to-screen on load.
- DBML SVG with `pt` units wasn't displayed (converted to responsive).
- Creating a new diagram didn't reset the previous editor state.
- `last_provider`/`last_model` weren't being saved on the chat session.
- DeepSeek/MiniMax `<think>` tags were leaking into the chat.
- `<<<DIAGRAMA>>>` (Spanish) wasn't being detected as a code marker.

## [0.4.1] - 2026-04-30

### Fixed
- AI JSON response parser for diagram fixes: replaced greedy regex with a brace-balancing parser (`extract_fix_json`), resolving failures on D2/PlantUML code that contains nested braces.
- OpenAI uses `response_format: json_object` to force valid JSON responses in fixes.
- "Fix with AI" button contrast improved in the dark editor.

### Added
- Animated background with floating pink/purple blobs on the login page (`AnimatedBackground` component).
- Glassmorphism effect on the login card.
- User email visible on the MFA verification screen.
- Share-diagram modal fully internationalized (38 i18n keys in `es.json` and `en.json`).

## [0.4.0] - 2026-04-29

### Added
- Kroki integration as a self-hosted server-side rendering engine (Docker `yuzutech/kroki`).
- Support for D2 diagrams: rendering, syntax highlighting, 19 themes, validation, AI fixes, AI chat.
- Public endpoint `POST /api/v1/diagrams/render` for diagram rendering via Kroki.
- PlantUML migrated from client-side (plantuml.com) to server-side rendering via Kroki.
- `KrokiClient` with `IKrokiClient` interface (SOLID), supporting 26 diagram types.
- `KROKI_URL` configurable via environment variable.
- Centralized `diagramRenderer.ts` utility for render routing.
- `d2ConfigManager.ts` for D2 theme management.
- `validate_d2` validator with brace balancing.
- AI prompts with full D2 context.
- Dashboard with personalized greeting and stats cards.
- Redesigned new-diagram modal with horizontal layout.
- Resizable description panel with persisted width.
- Project selector in the editor with search.
- Redesigned diagram panel with search box and quick actions.
- IDE-style code editor with dark theme and status bar.
- Full responsiveness across all views.
- New i18n keys for D2, dashboard, and editor.

### Removed
- `plantuml-encoder` dependency removed from the frontend.

### Changed
- Hardcoded strings replaced with `t()` keys.
- Floating panels become full-screen on mobile.
- `CodeEditor` component extended with D2 support.

## [0.3.1] - 2026-04-23

### Fixed
- TypeScript compilation error `TS2305`: `ChatMode` type wasn't exported from `types/chat.ts`, causing production build failure (Digital Ocean).

## [0.3.0] - 2026-04-23

### Added
- OAuth / Google social login: provider-agnostic architecture (IOAuthProvider + OAuthProviderFactory).
- Automatic linking of OAuth accounts to existing accounts by email.
- Automatic account creation with FREE subscription for new OAuth users.
- MFA bypass for OAuth logins with 5-day JWT.
- CSRF protection with server-side state tokens (10-min TTL, MongoDB auto-cleanup).
- ID token validation (signature, issuer, audience, expiration) for OpenID Connect.
- Rate limiting on the OAuth callback endpoint.
- Audit logging for OAuth events (successful/failed login, account linking).
- Profile page shows linked OAuth providers with date.
- Language selector on the login and registration pages.
- Application version visible on the login page.
- MFA banner hidden for OAuth sessions.
- Free AI description generation in structured Markdown with refinement capability.
- Unified chat with automatic intent detection (talk, generate, improve).

### Fixed
- Description prompts improved for consistent structured Markdown.
- Description generation respects the diagram's preferred provider.
- DeepSeek support added to `_call_with_prompt` for refinement operations.
- Chat session provider correctly propagates to diagram preferences.
- Missing `except` block in `send_message` of the chat service.

### Changed
- Removed dead code from legacy conversation/improvement chat modes.
- Removed the `mode` field from chat messages (data-model simplification).

## [0.2.1] - 2026-04-18

### Added
- Security event audit log with automatic 90-day retention (MongoDB TTL index).
- Session invalidation on password change (`pca` claim in JWT).
- Diagram count per user in the admin panel and Excel export.
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
- Rate limiting on login (10 attempts/IP/minute).
- Account lockout (15 minutes after 5 failed attempts).
- Swagger/OpenAPI disabled in production.
- Stack traces hidden in production.

### Fixed
- MFA banner appeared after enabling MFA (state wasn't restored on reload).
- "Try another method" automatically sent the email instead of showing selection.
- Recovery codes were regenerated unnecessarily when enabling a second MFA method.
- TypeScript compilation errors for Digital Ocean deploy.

## [0.2.0] - 2026-04-16

### Added
- Multi-Factor Authentication (MFA) with email and TOTP (Google Authenticator, Authy).
- Support for both MFA methods simultaneously with a configurable default method.
- Single-use recovery codes (8 codes, XXXXX-XXXXX format).
- MFA verification screen during login with the option to switch method.
- Full MFA management from profile: enable, disable, regenerate codes.
- Banner recommending MFA activation for users without active MFA.
- Differentiated session duration: 2 days without MFA, 5 days with MFA.
- Strengthened password policy: minimum 12 characters + special character.
- Real-time password strength indicator.
- Admin user-management panel with pagination, search, MFA status, and plan.
- Admin MFA disable for account recovery.
- User export to Excel (.xlsx).
- Multi-language MFA emails (Spanish/English).
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
- Rate limiting on login (10 attempts/IP/minute).
- Account lockout (15 minutes after 5 failed attempts).

## [0.1.0] - 2026-04-16

### Added
- Initial DiagramaHub release.
- Mermaid and PlantUML diagram creation and editing.
- Project and folder management.
- Multi-provider AI integration (Gemini, OpenAI, Claude, DeepSeek).
- AI chat for iterative diagram refinement.
- Diagram sharing with public/protected links.
- Stripe-based subscription system.
- Spanish/English internationalization.
