# DiagramaHub — UI/UX Design Guide

Source of truth for maintaining visual and experience consistency in the frontend.
Every new component or page must follow the rules in this document.

> Scope: `frontend/` (React 19 + TypeScript + Vite 7 + TailwindCSS v3).
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
| Build | Vite 7 |
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

## 3. Brand identity and colors

Purple is the primary identity. Never hardcode hex in `style`; use Tailwind classes.

| Purpose | Tailwind class |
|---------|----------------|
| Primary gradient | `bg-gradient-to-r from-purple-600 via-purple-400 to-purple-700` |
| Primary solid | `bg-purple-600`, `text-purple-600` |
| Primary hover | `bg-purple-700` |
| Primary active/selected (soft backgrounds) | `bg-purple-100 text-purple-700` (dark: `dark:bg-purple-900/40 dark:text-purple-300`) |
| Danger / destructive | `bg-red-600`, `text-red-600` |
| Success | `bg-green-600`, `text-green-600` |
| Warning | `bg-amber-500`, `text-amber-600` |
| Info | `bg-blue-600`, `text-blue-600` |
| Neutral text | `text-gray-700`, `text-gray-500` |
| Borders | `border-gray-200` (dark: `dark:border-gray-700`) |
| Base background | `bg-white` (dark: `dark:bg-gray-800` / `dark:bg-gray-900`) |

### Primary "glass" button

Primary actions use the `.btn-glass` class (defined in `index.css` under `@layer components`), which provides a glassmorphism effect with purple shadow:

```tsx
<button className="btn-glass bg-purple-600 text-white rounded-lg px-4 py-2">
  {t('action.label')}
</button>
```

---

## 4. Dark mode

- Class-based: `darkMode: 'class'`. The `dark` class is applied on `document.documentElement`.
- Managed by `ThemeContext` (`contexts/ThemeContext.tsx`), persisted in `localStorage` under the `theme` key.
- Toggle available via `ThemeToggleButton`.
- **Rule**: every background/border/text color must declare its `dark:` variant. Examples:
  - `bg-white dark:bg-gray-800`
  - `text-gray-700 dark:text-gray-300`
  - `border-gray-200 dark:border-gray-700`

---

## 5. Typography

- System font (defined in `index.css` on `body`): stack `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', ...`.
- Monospace code: `source-code-pro, Menlo, Monaco, Consolas, ...`.
- Type scale (Tailwind):

| Use | Class |
|-----|-------|
| Page title | `text-2xl font-bold text-gray-900 dark:text-gray-100` |
| Section/modal title | `text-lg font-semibold` |
| Body | `text-sm` |
| Metadata / minor labels | `text-xs text-gray-500 dark:text-gray-400` |
| Micro (shortcuts, badges) | `text-[10px]` |

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
| `.btn-glass` (`@layer components`) | Glassmorphism button with purple shadow (includes dark, hover, active variants) |
| `.scrollbar-hide` (`@layer utilities`) | Hide scrollbar while keeping scroll |
| `.chat-markdown` | Compact markdown for AI chat bubbles |
| `.animate-slide-in-right` | Chat panel slide-in animation |
| `.markdown-wysiwyg` | EasyMDE overrides for the description panel |
| `.EasyMDEContainer` | SimpleMDE editor customization (toolbar, CodeMirror, preview) |
| `@keyframes float-1..5` | Animated background blobs on auth pages (`AnimatedBackground`) |

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
    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('page.title')}</h1>
    <button className="btn-glass bg-purple-600 text-white rounded-lg px-4 py-2">
      {t('action.create')}
    </button>
  </div>
  {/* Content */}
</div>
```

### Modal

Fixed backdrop with semi-transparent overlay, centered panel, and an actions footer. Real pattern (from `ConfirmModal`):

```tsx
{isOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="px-6 py-4">{/* body */}</div>
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg flex gap-3 justify-end">
        <button onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">
          {t('common.cancel')}
        </button>
        <button onClick={onConfirm}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 btn-glass rounded-lg">
          {t('common.confirm')}
        </button>
      </div>
    </div>
  </div>
)}
```

Notes:
- `z-50` for modals; context/floating menus above when needed.
- Destructive panel uses `bg-red-600 hover:bg-red-700` (no `btn-glass`).
- Show spinner + "Processing..." state during async actions.

### Form fields

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    {t('field.label')} <span className="text-red-500">*</span>
  </label>
  <input
    type="text"
    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
               focus:ring-2 focus:ring-purple-500 focus:border-transparent
               dark:bg-gray-700 dark:text-gray-100"
    placeholder={t('field.placeholder')}
  />
  {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
</div>
```

### Cards

```tsx
<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
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
- Separators with `<div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />`.

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
- Visible focus: `focus:ring-2 focus:ring-purple-500`.
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
- **Floating style panel**: appears only when elements are selected (stroke, fill, width). Follows the editor's floating panel standard.
- **Arrows/lines**: no bounding box or resize; edited by their two endpoints. They bind to shape anchor points (top/bottom/left/right) and follow when the shape moves.
- **Resize**: handles on shapes; points scale proportionally from the original state (non-cumulative).
- **Text**: double-click on an element opens a centered input; text persists in the `text` field.
- **Copy/Paste/Cut**: Ctrl+C/X/V; paste positions at the cursor.
- **Context menu** (right-click): copy, cut, duplicate, bring to front/forward, send backward/to back, delete. Icons `w-3.5 h-3.5`, width `w-44`.
- **Infinite canvas**: scroll = pan; Cmd/Ctrl+scroll = zoom anchored at the cursor. Zoom is controlled from the editor toolbar (`zoom`/`onZoomChange` props) — do not duplicate the control.
- **High definition**: the canvas draws with `devicePixelRatio` (crisp on Retina displays).
- **Read-only mode** (shared view): hides toolbar, style panel, and menu; pan/zoom only. Auto-fit centers content on load.
- **Persistence**: canvas state is serialized as JSON (`{ version: 1, elements, viewport, background }`) and stored in the diagram's `content` field.

---

## 16. Rules and anti-patterns (quick checklist)

- [ ] No external UI libraries (Ant, MUI, Chakra) or icon libraries.
- [ ] No hex in `style` for colors — use Tailwind classes.
- [ ] Every visible string via `t()` and present in `es.json` + `en.json`.
- [ ] `dark:` variants on all colors.
- [ ] Interactive elements as `<button>`/`<a>` with `aria-label` when text is missing.
- [ ] Visible focus `focus:ring-2 focus:ring-purple-500`.
- [ ] Primary actions with `btn-glass bg-purple-600`; destructive with `bg-red-600`.
- [ ] Modals with backdrop `fixed inset-0 bg-black bg-opacity-50 ... z-50`.
- [ ] New pages in `pages/` + route in `App.tsx`; reusable UI in `components/`.
- [ ] Custom CSS only in `index.css` (`@layer components`/`utilities`) with its `.dark` variant.
- [ ] Tooltips with `position: fixed`.
