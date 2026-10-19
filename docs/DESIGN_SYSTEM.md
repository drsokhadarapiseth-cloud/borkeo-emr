# Borkeo EMR — Unified Design System Specification

**Version**: `39.0.0` (Phase 1: Design System)  
**Standard**: WCAG 2.2 Level AA / AAA Compliant & IEC 62366-1 Usability Guidance  
**Primary Stylesheet**: [public/design-system.css](file:///d:/EMR/Borkeo_EMR_v37.1/public/design-system.css)  
**Contrast Verification**: [docs/contrast-report.md](file:///d:/EMR/Borkeo_EMR_v37.1/docs/contrast-report.md)

---

## 1. Architectural Philosophy & Usability Standards

Borkeo EMR operates in high-intensity hospital environments across outpatient consult rooms, emergency units, operating theatres, and inpatient wards. The presentation architecture adheres to three foundational tenets:

1. **IEC 62366-1 Medical Safety & Error Prevention**:
   - Critical clinical information (vital signs, allergy alerts, prescription routes, abnormal laboratory flags) must **never rely solely on colour** to convey meaning. Colour is paired with text indicators, iconic symbols, and explicit layout positioning.
   - Interactive targets maintain a minimum dimension of $42 \times 42\,\text{px}$ to prevent accidental activation on touchscreen devices.

2. **WCAG 2.2 Level AA & AAA Accessibility**:
   - All body text, input labels, hints, and table data exceed the standard $4.5:1$ contrast requirement (averaging $>8:1$ to $>17:1$).
   - Interactive components, status stripes, and input borders maintain at least $3:1$ contrast against adjacent surfaces.
   - A high-visibility focus ring (`3px solid var(--focus-ring-color)` with `2px` offset) guarantees unambiguous keyboard navigation without layout shift.

3. **Strict Content-Security-Policy (CSP) & Zero External CDN Dependencies**:
   - No external CDNs (Google Fonts, Tailwind CDN, Cloudflare) are permitted under strict production security headers.
   - All font files (`Battambang-Regular.ttf`, `Moul-Khmer.woff2`, `Moul-Latin.woff2`) and icons are served strictly from the local origin (`/public/fonts`).

---

## 2. Color Token Architecture

The colour palette uses an HSL-derived perceptual scale tuned for high legibility under ward artificial lighting and outdoor glare.

### 2.1 Primary Brand (Clinical Ocean)
| Token | Hex Value | Usage Description |
|:---|:---:|:---|
| `--color-primary-50` | `#e6f4f8` | Subtle hover backgrounds and selected table row tint |
| `--color-primary-100` | `#cce9f1` | Inactive chip backgrounds and active secondary tabs |
| `--color-primary-500` | `#087fa8` | Core brand identity and primary interaction elements |
| `--color-primary-600` | `#026a8d` | Primary action button background (**6.09:1** against white) |
| `--color-primary-700` | `#014d68` | Section titles and high-emphasis labels |
| `--color-primary-900` | `#00222f` | Deep text contrast elements |

### 2.2 Neutral Scale & Surfaces
| Token | Light Theme | Dark Theme | High Contrast | Role |
|:---|:---:|:---:|:---:|:---|
| `--surface-app` | `#f3f8fa` | `#090d16` | `#ffffff` | Viewport / main window background |
| `--surface-card` | `#ffffff` | `#0f172a` | `#ffffff` | Content cards, data-entry forms, and tables |
| `--surface-panel` | `#ffffff` | `#131d33` | `#ffffff` | Sidebar navigation and modal containers |
| `--surface-hover` | `#f1f7fa` | `#1e293b` | `#f1f5f9` | Interactive element hover state |
| `--text-primary` | `#0f172a` | `#f8fafc` | `#000000` | Headings, primary clinical notes (**17.85:1**) |
| `--text-secondary`| `#334155` | `#cbd5e1` | `#000000` | Secondary labels, metadata chips (**10.35:1**) |
| `--text-muted` | `#475569` | `#94a3b8` | `#1e293b` | Helper hints, timestamps (**7.58:1**) |
| `--border-default`| `#cbd5e1` | `#334155` | `#000000` | Standard inputs, panel dividers |
| `--border-strong` | `#94a3b8` | `#475569` | `#000000` | Interactive card and button borders |

### 2.3 Semantic Status Families
| Semantic Role | Stripe | Light Background | Text | Dark Background | Dark Text |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Success** (Active/Confirmed) | `#15803d` | `#f0fdf4` | `#14532d` | `#052e16` | `#bbf7d0` |
| **Danger** (Allergy/Critical/Void) | `#b91c1c` | `#fef2f2` | `#7f1d1d` | `#450a0a` | `#fecaca` |
| **Warning** (Pending/Alert) | `#b45309` | `#fffbeb` | `#78350f` | `#451a03` | `#fde68a` |
| **Info** (Handoff/Notification) | `#0369a1` | `#f0f9ff` | `#0c4a6e` | `#082f49` | `#bae6fd` |

---

## 3. Four Dedicated Clinical SOAP Color Families

Physician clinical documentation uses colour-coded SOAP cards to maximize scan speed during ward rounds:

```
+---+-------------------------------------------------------------+
| S | ពាក្យបណ្តឹង និងប្រវត្តិ (Subjective) - Blue stripe & tint    |
+---+-------------------------------------------------------------+
| O | ការពិនិត្យ និងលទ្ធផល (Objective) - Green stripe & tint      |
+---+-------------------------------------------------------------+
| A | ការវាយតម្លៃ និងរោគវិនិច្ឆ័យ (Assessment) - Amber stripe & tint |
+---+-------------------------------------------------------------+
| P | ផែនការព្យាបាល (Plan) - Purple stripe & tint                  |
+---+-------------------------------------------------------------+
```

| SOAP Section | Stripe Token | Tint Background Token | Text Token | Badge Token | Ratio |
|:---|:---|:---|:---|:---|:---:|
| **S (Subjective)** | `--soap-s-stripe` (`#1d4ed8`) | `--soap-s-bg` (`#eff6ff`) | `--soap-s-text` (`#1e3a8a`) | `--soap-s-badge` (`#2563eb`) | **9.52:1** |
| **O (Objective)** | `--soap-o-stripe` (`#15803d`) | `--soap-o-bg` (`#f0fdf4`) | `--soap-o-text` (`#14532d`) | `--soap-o-badge` (`#16a34a`) | **8.70:1** |
| **A (Assessment)** | `--soap-a-stripe` (`#b45309`) | `--soap-a-bg` (`#fffbeb`) | `--soap-a-text` (`#78350f`) | `--soap-a-badge` (`#d97706`) | **8.75:1** |
| **P (Plan)** | `--soap-p-stripe` (`#6d28d9`) | `--soap-p-bg` (`#faf5ff`) | `--soap-p-text` (`#3b0764`) | `--soap-p-badge` (`#7c3aed`) | **13.97:1** |

---

## 4. Typography System

| Category | Font Family | Size | Line Height | Usage Context |
|:---|:---|:---:|:---:|:---|
| **Body & UI** | `'BorkeoInterface', 'Khmer OS Battambang', sans-serif` | `16px` (`--font-size-base`) | `1.5` | Standard clinical data, forms, buttons |
| **Small / Metadata** | `'BorkeoInterface', sans-serif` | `14px` (`--font-size-sm`) | `1.4` | Helper hints, secondary table columns |
| **Caption / Badge** | `'BorkeoInterface', sans-serif` | `12px` (`--font-size-xs`) | `1.3` | Status pill badges, timestamp markers |
| **Subheadings** | `'BorkeoInterface', sans-serif` | `18px` – `20px` | `1.3` | Card headers, form section titles |
| **Official Titles** | `'BorkeoBannerTitle', 'Khmer OS Moul Light', serif` | `24px` – `28px` | `1.4` | **Hospital brand title strictly** |
| **Numeric Clinical** | `font-variant-numeric: tabular-nums` | Inherited | Inherited | Prices, lab test results, vitals, dates |

---

## 5. Spacing, Elevation & Focus Rings

### Spacing Scale
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`
- `--space-10`: `40px`
- `--space-12`: `48px`

### Border Radius
- `--radius-xs`: `4px`
- `--radius-sm`: `6px`
- `--radius-md`: `8px` (Inputs, buttons)
- `--radius-lg`: `12px` (Cards, sub-panels)
- `--radius-xl`: `16px` – `18px` (Main application panels)
- `--radius-full`: `9999px` (Status badges, pill filters)

### Focus Ring Indicator
- `--focus-ring-width`: `3px`
- `--focus-ring-color`: `#0284c7` (Light theme) / `#38bdf8` (Dark theme) / `#000000` (High contrast)
- `--focus-ring-offset`: `2px`

---

## 6. Theme Reconciliation Architecture

The legacy stylesheets interface seamlessly with `design-system.css`:
- `ocean-theme.css` maps its legacy `--ocean-*` variables directly to `var(--surface-app)`, `var(--color-primary-500)`, etc.
- `interface-theme.css` maps `--emr-primary`, `--emr-background`, `--emr-surface`, `--emr-text`, and `--emr-radius` to the new token architecture while preserving the administrator's preset chooser (`data-emr-preset="01"` to `"10"`).
- `shared-controls.css` utilizes the unified focus ring and typography tokens while honoring existing button capsule rules.
- `responsive-layout.css` utilizes `--space-6` for dynamic shell bounds.
