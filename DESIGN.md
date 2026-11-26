# DiagramaHub — UI/UX Design Guide

Source of truth for maintaining visual and experience consistency in the frontend.
Every new component or page must follow the rules in this document.

> Scope: `frontend/` (React 19 + TypeScript 6 + Vite 8 + TailwindCSS v3).
> For code architecture and backend, see `AGENTS.md`.

---

## 1. Design principles

1. **Consistency over creativity**: reuse existing patterns before inventing new ones.
2. **Utility first**: the interface serves the create/organize/export diagram flow.
3. **No external UI libraries**: no Ant Design, Material UI, Chakra, etc. Only TailwindCSS + in-house components.
4. **All text via i18n**: never hardcode user-facing strings.
5. **Dark mode everywhere**: every view, modal, and component must work in light and dark.
6. **Accessible by default**: semantic interactive elements, visible focus, AA contrast.

---

## 2. UI stack

| Area | Technology |
|------|-----------|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Styling | TailwindCSS v3 (`darkMode: 'class'`) + `@tailwindcss/typography` plugin |
| Routing | `react-router-dom` v7 |
| HTTP | Axios (via `services/api.ts`) |
| i18n | i18next + react-i18next (Spanish default, English) |
| Code editor | Monaco (`@monaco-editor/react`) |
| Markdown | `react-markdown` + `remark-gfm` (read), `react-simplemde-editor` + `easymde` (WYSIWYG edit) |
| Diagrams | Mermaid (client), PlantUML/D2/DBML (server via Kroki), in-house canvas (freehand) |
| Export | `html2canvas` + `jspdf` |

**Do not** add custom theme tokens in `tailwind.config.js` — `theme.extend` stays empty. Use Tailwind's default utility classes.

---

## 3. Brand identity, colors and controls (design system 0.9)

Since 0.9 the UI is **flat and compact**: solid brand purple without gradients, glow or blur; 36px controls; two corner radii; borders instead of heavy shadows. The component classes live in `index.css` (`@layer components`). **Use them instead of long utility strings** — never copy a button's 15 classes again.

### Colors

Purple is the brand. Never hardcode hex in `style`; use Tailwind classes.

| Purpose | Tailwind class |
|---------|----------------|
| Primary (buttons, active marks) | `bg-purple-600` → hover `bg-purple-700` → active `bg-purple-800` |
| Primary text / links | `text-purple-600` (dark: `dark:text-purple-400`) |
| Soft purple (badges, selected choices) | `bg-purple-50 text-purple-700` (dark: `dark:bg-purple-500/10 dark:text-purple-300`) |
| Danger / destructive | `bg-red-600`, `text-red-600` |
| Success | `bg-green-600`, `text-green-600` |
| Warning | `bg-amber-500`, `text-amber-600` |
| Neutral text | `text-gray-900` (titles), `text-gray-700`, `text-gray-500` (secondary) |
| Borders | `border-gray-200` (dark: `dark:border-gray-800`) |
| Page background | `bg-gray-50` (dark: `dark:bg-gray-950`) |
| Surfaces (cards, panels, modals) | `bg-white` (dark: `dark:bg-gray-900`) |
| Raised/hover inside a surface | `bg-gray-50`/`bg-gray-100` (dark: `dark:bg-gray-800`) |

No gradients on UI chrome: buttons, logos, avatars, banners and page backgrounds are flat. The only exceptions are illustrations (404 page, About hero) and diagram content.

### Buttons

Combine `.btn` with one variant; add `.btn-sm` (32px) for rows, toolbars and inline actions, `.btn-lg` (40px) only for a lone hero CTA. Layout utilities (`w-full`, `flex-1`, `mt-4`…) go next to them.

| Class | Use |
|-------|-----|
| `btn btn-primary` | The main action of a page, form or modal (one per view) |
| `btn btn-secondary` | Cancel, close and neutral actions |
| `btn btn-ghost` | Low-emphasis actions (toolbars, "back to…") |
| `btn btn-danger` | Outlined destructive action in a list or row (revoke, remove) |
| `btn btn-destructive` | Solid red button that confirms a deletion |

```tsx
<div className="flex justify-end gap-2">
  <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
    {t('common.cancel')}
  </button>
  <button type="submit" disabled={loading || !canSubmit} className="btn btn-primary">
    {loading && (
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    )}
    {loading ? t('action.processing') : t('action.label')}
  </button>
</div>
```

Button rules:
- Height comes from the class (`h-9` / `h-8`); never add `py-3 px-6` or `font-semibold`.
- Focus ring only for keyboard users (`focus-visible`), built into `.btn`.
- Disabled state is built in (`opacity-50`, `cursor-not-allowed`); don't swap to `bg-gray-400`.
- Async actions keep the button and show a spinner + "Processing…" label.
- Icon-only buttons: `btn btn-ghost btn-sm !px-2` + `aria-label`.

### Fields, cards, badges

| Class | Use |
|-------|-----|
| `input` | Text inputs, selects and textareas (add `h-auto py-2` on a textarea) |
| `card` | White/gray-900 surface with a 1px border and 12px radius |
| `badge` | Small purple tag (plan, scope, "Default") |
| `page-title` | The page `h1` (`text-xl font-semibold tracking-tight`) |

Checkboxes and radios take the brand color through `accent-color` (set globally in `index.css`).

### Radii and elevation

- `rounded-md` (6px): buttons, inputs, menu items, badges.
- `rounded-xl` (12px): cards, panels, modals.
- Cards: border only (`shadow-sm` at most). Modals: `shadow-lg ring-1 ring-black/5 dark:ring-white/10`. Menus/popovers: `shadow-lg`. No `shadow-2xl`, no colored glows.

### Brand logo

Use `<BrandLogo />` (`components/BrandLogo.tsx`): a flat purple "Dh" mark plus the wordmark. `size="sm" | "md" | "lg"`, `markOnly` for the collapsed sidebar. Never recreate the logo with gradient text.

---

## 4. Dark mode

- Class-based: `darkMode: 'class'`. The `dark` class is applied on `document.documentElement`.
- Managed by `ThemeContext` (`contexts/ThemeContext.tsx`), persisted in `localStorage` under the `theme` key.
- Toggle available via `ThemeToggleButton`.
- **Rule**: every background/border/text color must declare its `dark:` variant. Dark palette (0.9): page `gray-950`, surfaces `gray-900`, raised/hover `gray-800`, borders `gray-800` (inputs `gray-700`). Examples:
  - `bg-white dark:bg-gray-900`
  - `text-gray-700 dark:text-gray-300`
  - `border-gray-200 dark:border-gray-800`

---

## 5. Typography

- UI font: **Inter** (variable, SIL OFL 1.1), bundled in `public/fonts/inter/` and declared in `index.css` (Latin and Latin Extended subsets), with the system stack as fallback. Don't load fonts from a CDN.
- Monospace code: `source-code-pro, Menlo, Monaco, Consolas, ...`.
- Type scale (Tailwind):

| Use | Class |
|-----|-------|
| Page title | `page-title` (`text-xl font-semibold tracking-tight`) |
| Section/modal title | `text-base`–`text-lg font-semibold` (card titles `text-[15px]`) |
| Body | `text-sm` |
| Metadata / minor labels | `text-xs text-gray-500 dark:text-gray-400` |
| Micro (shortcuts, badges) | `text-[10px]`–`text-[11px]` |

- Rendered markdown uses `prose` classes from `@tailwindcss/typography`:
  ```tsx
  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-purple-600">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
  ```

---

## 6. Spacing scale

Use Tailwind's default scale (multiples of 4px).

| Token | Value | Use |
|-------|-------|-----|
| `gap-2` / `p-2` | 8px | Tight spacing within components |
| `gap-3` / `p-3` | 12px | Default spacing between elements |
| `gap-4` / `p-4` | 16px | Section padding |
| `gap-6` / `p-6` | 24px | Page padding, section separation |
| `mb-6` | 24px | Between page header and content |

---

## 7. Iconography

- Icons as **inline Heroicons-style SVG**. Do not add icon libraries (Lucide, Font Awesome, Heroicons packages).
- Standard pattern:
  ```tsx
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
  </svg>
  ```

| Context | Size |
|---------|------|
| Inline / button icon | `w-4 h-4` |
| Section icon | `w-5 h-5` |
| Compact context-menu icon | `w-3.5 h-3.5` |
| Empty state | `w-12 h-12` |

---

## 8. Custom CSS classes (`index.css`)

Add custom CSS **only** when Tailwind utilities are insufficient, following these existing names:

| Class / selector | Purpose |
|------------------|---------|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-destructive`, `.btn-sm`, `.btn-lg` (`@layer components`) | Buttons (see §3) |
| `.input`, `.card`, `.badge`, `.page-title` (`@layer components`) | Fields, surfaces, tags, page headings (see §3) |
| `accent-color` on checkbox/radio (`@layer base`) | Brand purple for native checkboxes and radios |
| `.scrollbar-hide` (`@layer utilities`) | Hide scrollbar while keeping scroll |
| `.chat-markdown` | Compact markdown for AI chat bubbles |
| `.animate-slide-in-right` | Chat panel slide-in animation |
| `.markdown-wysiwyg` | EasyMDE overrides for the description panel |
| `.EasyMDEContainer` | SimpleMDE editor customization (toolbar, CodeMirror, preview) |

Every custom style must include its `.dark` counterpart.

---

## 9. Frontend file structure

```
frontend/src/
├── App.tsx                # Root + routes (react-router v7) + providers
├── main.tsx               # Entry point + Sentry init
├── index.css              # Tailwind directives + @layer components/utilities + overrides
├── components/            # Reusable UI (flat + domain subfolders)
│   ├── admin/             # Admin panel components
│   ├── annotations/       # Presentation mode annotations
│   ├── mfa/               # MFA components
│   └── subscription/      # Billing/plans components
├── pages/                 # Route-level components
│   └── admin/             # Admin subpages
├── contexts/              # AuthContext, ThemeContext, PresentationContext
├── services/api.ts        # Axios instance + ApiService class (auth interceptor)
├── hooks/                 # Custom hooks
├── types/                 # TypeScript types by domain
├── i18n/
│   ├── config.ts          # i18next setup
│   └── locales/           # es.json (default), en.json
└── utils/                 # Utilities
```

### Placement guide

| What you add | Where it goes |
|--------------|---------------|
| New route / page | `pages/` (+ `Route` in `App.tsx`) |
| Reusable UI component | `components/` (feature subfolder if domain-specific) |
| API method | `services/api.ts` (inside `ApiService`) |
| Shared state | `contexts/` (new Context if cross-cutting) |
| Hook | `hooks/` |
| Types/Interfaces | `types/{domain}.ts` |
| Translation strings | `i18n/locales/es.json` + `en.json` |

---

## 10. Routing and providers

Nesting order (see `App.tsx`):

```
ThemeProvider
└── BrowserRouter
    ├── /shared/:token → SharedDiagramPage   (PUBLIC: outside AuthProvider)
    └── * → AuthProvider
            └── InstallationGuard
                ├── Auth pages (login, register, forgot/reset, mfa-verify, oauth/callback) — no sidebar
                ├── /onboarding — PrivateRoute, no sidebar
                ├── Editor: /projects/:projectId[/diagrams/:diagramId]
                │     → PrivateRoute → PresentationProvider → SidebarLayout
                └── Authenticated routes (dashboard, projects-list, profile, settings,
                      subscription, integrations, about, admin/*) → PrivateRoute → SidebarLayout
```

Rules:
- Public routes (like `/shared/:token`) go **outside** `AuthProvider`.
- Protected routes use `PrivateRoute` and are wrapped in `SidebarLayout`.
- The editor adds `PresentationProvider` (presentation mode hides the sidebar).
- `InstallationGuard` enforces the initial installation wizard.

---

## 11. Reusable components (catalog)

Before creating a new one, check if it exists:

| Component | Use |
|-----------|-----|
| `ConfirmModal` | Confirmation dialog (supports `isDangerous`) |
| `Tooltip` | Tooltips with `position: fixed` (avoids overflow clipping) |
| `Tabs` | Tabs |
| `Sidebar` / `SidebarLayout` | Collapsible side navigation + layout |
| `Navbar` | Top bar |
| `PrivateRoute` | Auth-gated route wrapper |
| `InstallationGuard` | Initial setup guard |
| `EmptyState` | Empty state (with `TumbleweedIcon`) |
| `Skeleton` | Loading placeholders |
| `ThemeToggleButton` | Light/dark toggle |
| `LanguageSelector` | Language selector |
| `BottomSheet` / `MobileBottomToolbar` | Mobile patterns |
| `SplitPane` | Resizable panes |
| `PremiumAvatar` / `UserMenu` | User identity |
| `BrandLogo` | DiagramaHub mark + wordmark (sidebar, navbar, auth, shared view) |
| `UsageBadge` / `UpgradePlanModal` | Billing / limits |

Component conventions:
- **Functional** components only (no classes).
- Prefer **named exports** (some existing components use default export; for new ones prefer named except pages).
- Props typed with an `XxxProps` interface.

---

## 12. UI patterns

### Page layout

```tsx
<div className="p-6">
  <div className="flex justify-between items-center mb-6">
    <div>
      <h1 className="page-title">{t('page.title')}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('page.description')}</p>
    </div>
    <button className="btn btn-primary">{t('action.create')}</button>
  </div>
  {/* Content */}
</div>
```

### Modal

Fixed backdrop with semi-transparent overlay, centered panel, and an actions footer. Real pattern (from `ConfirmModal`):

```tsx
{isOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-md w-full">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="px-6 py-4">{/* body */}</div>
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-2 justify-end">
        <button onClick={onClose} className="btn btn-secondary">{t('common.cancel')}</button>
        <button onClick={onConfirm} className="btn btn-primary">{t('common.confirm')}</button>
      </div>
    </div>
  </div>
)}
```

Notes:
- `z-50` for modals; context/floating menus above when needed.
- Destructive confirmation uses `btn btn-destructive`. With three actions, put the destructive one first with `btn-danger sm:mr-auto`.
- Show spinner + "Processing..." state during async actions.

### Form fields

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    {t('field.label')} <span className="text-red-500">*</span>
  </label>
  <input type="text" className="input" placeholder={t('field.placeholder')} />
  {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
</div>
```

### Cards

```tsx
<div className="card p-6">
  <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
  <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
</div>
```

### Notifications (toasts)

Fixed bottom-right toast for async action errors:

```tsx
<div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md shadow-lg max-w-md z-50">
  {/* icon + message */}
</div>
```

### Context menus / dropdowns

- Compact width (`w-44`), `text-xs` items, `w-3.5 h-3.5` icon on the left, `text-[10px] ml-auto` shortcut.
- Close on outside click.
- Separators with `<div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />`.

---

## 13. Internationalization (i18n)

- All visible text uses `t('key')` from react-i18next. **Never** hardcode strings.
- Every new key is added to **both** `es.json` and `en.json`.
- Spanish is the default language; English is secondary.
- Preference persisted in `localStorage` under the `language` key.
- AI-generated content accepts a `language` parameter (`es`/`en`).
- Section structure in locales: `common`, `nav`, `auth`, `validation`, `dashboard`, `project`, `diagram`, `profile`, `settings`, `editor`, `errors`, `conversion`, `freehand`, etc.
- When adding a feature, group its keys under a dedicated section (e.g. `freehand.tools.*`).

---

## 14. Accessibility (mandatory minimums)

- Interactive elements are `<button>` or `<a>` — never `onClick` on a `<div>`.
- Every control without visible text has an `aria-label`.
- Visible focus: built into `.btn`/`.input`; elsewhere `focus-visible:ring-2 focus-visible:ring-purple-500/50` (or `focus:ring-2 focus:ring-purple-500`).
- Minimum WCAG AA contrast (4.5:1 for normal text).
- Keyboard navigation: Tab, Enter, Escape, arrows where applicable.
- Modals close on Escape and trap focus.
- Never nest `<button>` inside `<button>`.

---

## 15. Freehand canvas — specific patterns

The `freehand` diagram type uses an in-house HTML5 canvas (`components/FreehandCanvas.tsx`), not server-side SVG. Established UX rules:

- **Selection model**: `selectedIds: Set<string>` is the single source of truth.
  - Click = select one; Shift+Click = toggle; drag on empty = marquee.
  - Ctrl/Cmd+A = select all; Delete/Backspace = delete; Escape = deselect.
- **Element creation**: on finish, switch to the select tool and keep the new element selected. **Exception**: the freehand tool stays active for continuous strokes.
- **Floating style panel**: appears only when elements are selected and no gesture is in progress (stroke, fill, width). Choosing a drawing tool drops the selection, so the panel never covers the area being drawn. Sticky notes show only **Note color** and font; images only lock/arrange/delete.
- **Arrows/lines**: no bounding box or resize; edited by their two endpoints. They bind to the anchor points (top/bottom/left/right) of shapes, sticky notes and images, and follow when those move. A single selected shape/note/image shows four **connector dots** just outside its sides (`CONNECTOR_OFFSET`); dragging one draws an arrow bound at that side (Miro-style). The rotation knob sits above the top connector, and the style panel keeps clear of them.
- **Resize**: handles on shapes; points scale proportionally from the original state (non-cumulative).
- **Text**: double-click (or Enter) on an element opens a centered input; text persists in the `text` field. Labels of shapes and notes wrap inside their box (`utils/textLayout.ts`); notes also shrink the font to fit.
- **Sticky notes** (`sticky`, tool N): flat paper colour (`STICKY_COLORS`) with a soft shadow, never hand-drawn; a click drops a 200×200 note that opens for typing.
- **Images** (`image`): bytes live in the `diagram_files` backend module, the element keeps only `fileId`. The canvas reads them through the `imageStore` prop (owner, shared link, presentation) and decodes each file once. Resizing keeps the aspect ratio.
- **Copy/Paste/Cut**: through the system clipboard events (`utils/freehandClipboard.ts`, JSON with a type marker; images travel as data URLs and are stored again in the target diagram); paste positions at the cursor. Plain text pastes as a text element, image files as images.
- **Context menu** (right-click): copy, cut, duplicate, bring to front/forward, send backward/to back, delete. Icons `w-3.5 h-3.5`, width `w-44`.
- **Infinite canvas**: scroll = pan; Cmd/Ctrl+scroll (or trackpad pinch) = proportional zoom anchored at the cursor. The canvas zooms locally during the gesture and reports through `onZoomChange` when it settles; the editor toolbar sets it through the `zoom` prop — do not duplicate the control. Pan is reported through `onPanChange` and saved with the diagram's viewport fields, never in the scene JSON.
- **Pointer input**: pointer events with capture (a gesture that leaves the canvas continues). Touch: one finger uses the active tool (pans on empty space with Select), two fingers pinch/pan, double tap = double-click.
- **Rendering**: one paint per animation frame; elements outside the view are skipped (selected ones always painted).
- **High definition**: the canvas draws with `devicePixelRatio` (crisp on Retina displays).
- **Read-only mode** (shared view): hides toolbar, style panel, and menu; pan/zoom only. Auto-fit centers content on load.
- **Persistence**: canvas state is serialized as JSON (`{ version: 1, elements, viewport, background }`) and stored in the diagram's `content` field. Since 0.9.2 `viewport` is written as the default (the view lives in `viewport_zoom/x/y`); a non-zero legacy value is still read once and moved there. The code editor is not mounted for freehand diagrams.

---

## 16. Rules and anti-patterns (quick checklist)

- [ ] No external UI libraries (Ant, MUI, Chakra) or icon libraries.
- [ ] No hex in `style` for colors — use Tailwind classes.
- [ ] Every visible string via `t()` and present in `es.json` + `en.json`.
- [ ] `dark:` variants on all colors.
- [ ] Interactive elements as `<button>`/`<a>` with `aria-label` when text is missing.
- [ ] Visible focus (built into `.btn`/`.input`).
- [ ] Buttons with `.btn` + variant (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-destructive`); fields with `.input`. No gradients, glows or `btn-glass`.
- [ ] Modals with backdrop `fixed inset-0 bg-black bg-opacity-50 ... z-50`.
- [ ] New pages in `pages/` + route in `App.tsx`; reusable UI in `components/`.
- [ ] Custom CSS only in `index.css` (`@layer components`/`utilities`) with its `.dark` variant.
- [ ] Tooltips with `position: fixed`.
