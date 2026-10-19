# Borkeo EMR — WCAG 2.2 AA Contrast Verification Report

**Standard**: WCAG 2.2 Level AA / Level AAA  
**Guidance**: IEC 62366-1 (Medical Device Usability)  
**Evaluated by**: `scripts/verify-contrast.mjs`  
**Date**: October 2026  
**Status**: **100% Passed (38/38 checks)**

---

## 1. Summary of Requirements

- **Normal Text** (body, labels, table cells, hints): Minimum contrast ratio **4.5:1** (Level AA) or **7.0:1** (Level AAA).
- **Large Text** ($\ge$ 18pt or 14pt bold): Minimum contrast ratio **3.0:1** (Level AA).
- **Graphical Objects & User Interface Components** (borders, buttons, icons, focus rings, status stripes): Minimum contrast ratio **3.0:1** (Level AA).

---

## 2. Complete Token Contrast Table

| Token / Usage Description | Foreground Hex | Background Hex | Contrast Ratio | Minimum Required | Level Achieved | Result |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Primary Text on White Surface** | `#0f172a` | `#ffffff` | **17.85:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Primary Text on App Background** | `#0f172a` | `#f3f8fa` | **16.68:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Secondary Text on White Surface** | `#334155` | `#ffffff` | **10.35:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Secondary Text on App Background** | `#334155` | `#f3f8fa` | **9.67:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Muted Text on White Surface** | `#475569` | `#ffffff` | **7.58:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **White Text on Primary Action** | `#ffffff` | `#026a8d` | **6.09:1** | 4.5:1 | AA ($\ge$ 4.5:1) | ✅ PASS |
| **Primary Button Boundary on White** | `#026a8d` | `#ffffff` | **6.09:1** | 3.0:1 | UI AA ($\ge$ 3.0:1) | ✅ PASS |
| **Focus Ring Indicator against White** | `#0284c7` | `#ffffff` | **4.10:1** | 3.0:1 | UI AA ($\ge$ 3.0:1) | ✅ PASS |
| **Success Text on Light Tint** | `#14532d` | `#f0fdf4` | **8.70:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Success Stripe Indicator on White** | `#15803d` | `#ffffff` | **5.02:1** | 3.0:1 | UI AA ($\ge$ 3.0:1) | ✅ PASS |
| **White Text on Success Action** | `#ffffff` | `#15803d` | **5.02:1** | 4.5:1 | AA ($\ge$ 4.5:1) | ✅ PASS |
| **Success Text on Dark Background** | `#bbf7d0` | `#052e16` | **12.30:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Danger Text on Light Tint** | `#7f1d1d` | `#fef2f2` | **9.16:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Danger Stripe Indicator on White** | `#b91c1c` | `#ffffff` | **6.47:1** | 3.0:1 | UI AA ($\ge$ 3.0:1) | ✅ PASS |
| **White Text on Danger Action** | `#ffffff` | `#b91c1c` | **6.47:1** | 4.5:1 | AA ($\ge$ 4.5:1) | ✅ PASS |
| **Danger Text on Dark Background** | `#fecaca` | `#450a0a` | **11.16:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Warning Text on Light Tint** | `#78350f` | `#fffbeb` | **8.75:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Warning Stripe Indicator on White** | `#b45309` | `#ffffff` | **5.02:1** | 3.0:1 | UI AA ($\ge$ 3.0:1) | ✅ PASS |
| **White Text on Warning Action** | `#ffffff` | `#b45309` | **5.02:1** | 4.5:1 | AA ($\ge$ 4.5:1) | ✅ PASS |
| **Warning Text on Dark Background** | `#fde68a` | `#451a03` | **12.03:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Info Text on Light Tint** | `#0c4a6e` | `#f0f9ff` | **8.87:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |
| **Info Stripe Indicator on White** | `#0369a1` | `#ffffff` | **5.93:1** | 3.0:1 | UI AA ($\ge$ 3.0:1) | ✅ PASS |
| **White Text on Info Action** | `#ffffff` | `#0369a1` | **5.93:1** | 4.5:1 | AA ($\ge$ 4.5:1) | ✅ PASS |
| **Info Text on Dark Background** | `#bae6fd` | `#082f49` | **10.46:1** | 4.5:1 | AAA ($\ge$ 7.0:1) | ✅ PASS |

---

## 3. Four Dedicated Clinical SOAP Families

Clinical notes require instant visual scanning while ensuring patients and clinical staff under varying lighting conditions (night duty, direct sunlight) experience zero legibility fatigue:

| SOAP Section | Stripe Color | Tinted Background | Text Color | Contrast Ratio | Minimum | Status |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **S (Subjective - Blue)** Light | `#1d4ed8` | `#eff6ff` | `#1e3a8a` | **9.52:1** | 4.5:1 | ✅ PASS (AAA) |
| **S (Subjective - Blue)** Dark | `#3b82f6` | `#172554` | `#dbeafe` | **12.04:1** | 4.5:1 | ✅ PASS (AAA) |
| **O (Objective - Green)** Light | `#15803d` | `#f0fdf4` | `#14532d` | **8.70:1** | 4.5:1 | ✅ PASS (AAA) |
| **O (Objective - Green)** Dark | `#22c55e` | `#052e16` | `#dcfce7` | **13.57:1** | 4.5:1 | ✅ PASS (AAA) |
| **A (Assessment - Amber)** Light | `#b45309` | `#fffbeb` | `#78350f` | **8.75:1** | 4.5:1 | ✅ PASS (AAA) |
| **A (Assessment - Amber)** Dark | `#f59e0b` | `#451a03` | `#fef3c7` | **13.45:1** | 4.5:1 | ✅ PASS (AAA) |
| **P (Plan - Purple)** Light | `#6d28d9` | `#faf5ff` | `#3b0764` | **13.97:1** | 4.5:1 | ✅ PASS (AAA) |
| **P (Plan - Purple)** Dark | `#a855f7` | `#2e1065` | `#f3e8ff` | **12.91:1** | 4.5:1 | ✅ PASS (AAA) |

---

## 4. High-Contrast Accessibility Theme

For users with low vision or high-glare ward terminals:
- **Black on White**: `21.00:1` (Max contrast)
- **White on Black**: `21.00:1` (Max contrast)
- Focus rings feature a mandatory `3px solid #000000` (on light) or `3px solid #ffff00` (on dark) with a `2px` offset.
