# Navigation investigation (Step 0) — base v39.7.0

Investigation only. No code was changed.

## 1. Where the side navigation lives

| Piece | File | Notes |
|---|---|---|
| Injection | `server/server.mjs:450` | `sendFile` rewrites `</head>` of every protected page and injects `design-system.css`, `components.css`, **`app-shell.css`**, `interface-theme.css` and the scripts **`app-shell.js`**, `components.js`, etc. So the shell is already ONE shared component; no protected HTML file contains its own sidebar. |
| Sidebar + topbar + mobile bottom bar | `public/app-shell.js` (927 lines), `public/app-shell.css` (1071 lines) | Builds `header#emr-topbar`, `aside#emr-sidebar.emr-sidebar`, `nav.emr-mobile-nav`, Ctrl+K palette, shortcuts dialog. |
| Menu rules used by sidebar | `getRoleNavGroups(role, wardCode)` in `app-shell.js:76-296` | Hard-coded per-role groups, labels, icons, Alt+N shortcuts. |
| Older top nav (hidden) | `public/emr-session.js:38` `allowedLinks()` + `:195-280` | Builds `#emr-session-control`, `#emr-main-nav`, `#emr-sub-nav`. Hidden by `app-shell.css:58-62` when `body.has-emr-shell`, but still in the DOM (pages/tests rely on its buttons, e.g. password change). Applies admin "hide/order" prefs from `/api/navigation-settings`. |
| Server copy of rules | `server/navigation-settings.mjs` `allowedLinks()` | Same rules as `emr-session.js`; used only for the admin **Interface → navigation order/hide** catalogue. |
| Real page permission | `server/access.mjs:469` `roleCanPage(role, path)` + extra checks in `server/server.mjs:1993-2033` | Server gate for every protected page. |
| Identity | `/api/auth/me` → `{ user: { roles, activeRole, activeWard, wards, contexts }, csrfToken }` | `buildIdentity()` in `access.mjs:359`. |
| Role/ward switch | `/context` page (`public/context.js`) → `POST /api/auth/context` → full page navigation to landing page | Switch is currently a page reload, not in-place. |
| Icons | `public/icons.svg` sprite (already exists, used via `<use href="/public/icons.svg#icon-…">`) | |
| Branding | `public/organization-branding.js` / `server/organization-branding.mjs` | Sidebar/topbar currently **hard-codes** "មន្ទីរពេទ្យបង្អែក បរកែវ" and `/public/logo-hospital.jpg` instead of using the configurable branding. |

So there are **three copies** of the navigation rules (app-shell, emr-session, navigation-settings) plus the real server permission. They have drifted apart.

## 2. Current behaviour of the sidebar

- Manual collapse button, remembered in `localStorage['borkeo_sidebar_collapsed']` (not wrapped in try/catch).
- Expanded sidebar **pushes** content (`body padding-left`), so content reflows.
- No hover/focus expansion, no pin, no prefers-reduced-motion handling.
- Mobile (≤768px): drawer via `mobile-sidebar-open` + bottom bar. Mobile bottom bar links are hard-coded (`/home`, `/patient-list`, …), and `/home` redirects for many roles.
- Footer shows hard-coded `Borkeo EMR v39.2.0` (stale; package is 39.7.0).
- Topbar contains `onerror="this.style.display='none'"` on the logo: an inline handler, which a strict CSP will block.
- Notification badge exists in the topbar only (mirrors `.emr-notification-bell`). Message/request counts (`request-badges.js`, `messages.js`) are not shown in the sidebar.

## 3. Mismatches: sidebar shows links the server rejects (bugs today)

| Role (ward) | Sidebar link | Server result |
|---|---|---|
| DOCTOR (IPD ward) | `/ipd-transfer` | **403**, OPD doctors only (`server.mjs:2027`) |
| DOCTOR (any) | `/lab`, `/imaging` | **403**, `roleCanPage` allows only LAB / IMAGING |
| LAB, IMAGING, PHARMACY | `/stock` | **404**, no such route. Real pages: `/lab/materials`, `/imaging/films`, `/pharmacy/medicines` |
| CLERK | `/expenses` | **403**, ACCOUNTANT only |
| CHIEF_WARD, WARD_HEAD | Falls through to the **admin** menu (users, organization, finance, …) | Most links **403** |

Links the server allows but the sidebar never offers:
- `/requests` for all non-admin roles (server allows all 12 roles).
- `/opd-paraclinic-nurse` for NURSE in OPD ward.
- `/pmrs-import` for DOCTOR.
- `/record-viewer` for ADMIN/DIRECTOR/VICE_DIRECTOR.
- `/opd-queue` for TRIAGE.
- `/ward-medicines` for CHIEF_WARD/WARD_HEAD (their landing page).

Other drift: `context.js` role labels lack `VICE_DIRECTOR`.

## 4. Server-side protection (hiding is not security)

- **Pages:** every protected page passes `roleCanPage()` plus the ward checks before the HTML is sent. An unauthorised direct URL gets **403 JSON** (or a redirect for `/home`, `/emr`). This is good.
- **APIs:** routed through `server/router.mjs` (CSRF, `requireSession`, role options) plus inline checks in `server.mjs`. During coding I will run a per-page check that each page's main API rejects a role that cannot open the page, and I will **report** any API without a role check. I won't change any permission.

## 5. SOAP titles (item 4)

- `public/soap-note.js:14-60` has a `khmer` and an `english` dictionary. `sTitle/oTitle/aTitle/pTitle` are Khmer in KH mode, so the titles currently change with language.
- `applyLanguage` (`soap-note.js:~430-447`) rewrites `.emr-soap-title` via `innerHTML`.
- The global translator `emr-language.js:715` skips any element inside `[data-language-exclude]`, which is the right hook.
- Plan: fixed English titles + letter badge, `data-language-exclude` on the title, hints still follow the language (pending your answer).

## 6. Phone access over local network

- `server/server.mjs:2089`: default `HOST=127.0.0.1`, so phones cannot connect. With `HOST=0.0.0.0` the server already prints the `Mobile / Phone access (Same Wi-Fi): http://192.168.x.x:3000` URLs.
- **Blocker:** in production mode `config.mjs:73` forces `COOKIE_SECURE=true`. Phones on plain `http://192.168.x.x` will **not** keep a Secure cookie, so login appears to succeed and then bounces back to the login page. Demo and non-production modes use non-secure cookies and work over the LAN.
- Windows Firewall must allow inbound TCP 3000 for Node.
- All protected pages already have a viewport meta (except `print-preview.html`).

## 7. Tooling

- Playwright is **not installed** (no `node_modules`; `npx playwright` would download it). `scripts/capture-screenshots.mjs` uses headless **Microsoft Edge** instead.
- Version strings: `package.json`, `public/login.html`, `server/server.mjs` (`APP_VERSION`), plus the asset `?v=3970` cache keys in `server.mjs:450`.

## 8. Result (v39.8.0)

Implemented after the "go":

- `public/nav-config.js` is the single navigation map (see `docs/nav-roles.md`). `public/app-shell.js` and `public/app-shell.css` remain the one shared shell, injected by the server into every protected page.
- The old `getRoleNavGroups` copy is gone. `emr-session.js` `allowedLinks()` and `server/navigation-settings.mjs` still exist: they drive the hidden legacy top bar and the admin hide/order editor, and older tests pin their contents. The sidebar applies the admin hide/order settings on top of the new map.
- Fixed while building:
  - The shell mounted twice (duplicate breadcrumb).
  - The global button theme (`shared-controls.css`) painted the topbar icons white on white. Shell buttons now sit in a CSS cascade layer.
  - The inline `onerror` on the logo was removed.
  - `server.mjs` used `os` without importing it, so the phone address was never printed.

### API spot-check (signed-in role without page access → status)

| API | Result |
|---|---|
| `/api/admin/users` | 403 for every non-management role |
| `/api/finance/expenses` | 403 except ACCOUNTANT |
| `/api/finance/cashflow` | 403 for all tested non-management roles |
| `/api/finance/patients` | 403 except CLERK, ACCOUNTANT |
| `/api/pharmacy/opd-prescriptions`, `/api/pharmacy/dispensing-board` | 403 except PHARMACY |
| `/api/opd/queue` | 403 for all tested non-OPD roles |
| `/api/triage/queue` | 403 except TRIAGE |

**Reported, not changed.** These return 200 to every signed-in role: `/api/finance/services` (price list), `/api/lab-catalog`, `/api/imaging-catalog` (catalogues used when ordering) and `/api/requests`, which the server deliberately allows for all roles. They appear intentional, but you should confirm. No permission was modified.
