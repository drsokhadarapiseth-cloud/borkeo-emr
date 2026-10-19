// scripts/verify-contrast.mjs
// Calculates WCAG 2.2 contrast ratios for Borkeo EMR Design System color tokens

function sRgbToLinear(c) {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(ch => ch + ch).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = sRgbToLinear(r);
  const G = sRgbToLinear(g);
  const B = sRgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

const colorPairs = [
  // Core Text & UI on Light Surfaces
  { name: 'Primary Text on White Surface', fg: '#0f172a', bg: '#ffffff', min: 4.5, type: 'text' },
  { name: 'Primary Text on App Background', fg: '#0f172a', bg: '#f3f8fa', min: 4.5, type: 'text' },
  { name: 'Secondary Text on White Surface', fg: '#334155', bg: '#ffffff', min: 4.5, type: 'text' },
  { name: 'Secondary Text on App Background', fg: '#334155', bg: '#f3f8fa', min: 4.5, type: 'text' },
  { name: 'Muted Text on White Surface', fg: '#475569', bg: '#ffffff', min: 4.5, type: 'text' },
  { name: 'White Text on Primary Button', fg: '#ffffff', bg: '#026a8d', min: 4.5, type: 'text' },
  { name: 'Primary Button on White (UI boundary)', fg: '#026a8d', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'Focus Ring against White', fg: '#0284c7', bg: '#ffffff', min: 3.0, type: 'ui' },

  // Semantic: Success
  { name: 'Success Text on Success Bg (Light)', fg: '#14532d', bg: '#f0fdf4', min: 4.5, type: 'text' },
  { name: 'Success Stripe on White (UI)', fg: '#15803d', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'White Text on Success Action', fg: '#ffffff', bg: '#15803d', min: 4.5, type: 'text' },
  { name: 'Success Text on Success Bg (Dark)', fg: '#bbf7d0', bg: '#052e16', min: 4.5, type: 'text' },

  // Semantic: Danger
  { name: 'Danger Text on Danger Bg (Light)', fg: '#7f1d1d', bg: '#fef2f2', min: 4.5, type: 'text' },
  { name: 'Danger Stripe on White (UI)', fg: '#b91c1c', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'White Text on Danger Action', fg: '#ffffff', bg: '#b91c1c', min: 4.5, type: 'text' },
  { name: 'Danger Text on Danger Bg (Dark)', fg: '#fecaca', bg: '#450a0a', min: 4.5, type: 'text' },

  // Semantic: Warning
  { name: 'Warning Text on Warning Bg (Light)', fg: '#78350f', bg: '#fffbeb', min: 4.5, type: 'text' },
  { name: 'Warning Stripe on White (UI)', fg: '#b45309', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'White Text on Warning Action', fg: '#ffffff', bg: '#b45309', min: 4.5, type: 'text' },
  { name: 'Warning Text on Warning Bg (Dark)', fg: '#fde68a', bg: '#451a03', min: 4.5, type: 'text' },

  // Semantic: Info
  { name: 'Info Text on Info Bg (Light)', fg: '#0c4a6e', bg: '#f0f9ff', min: 4.5, type: 'text' },
  { name: 'Info Stripe on White (UI)', fg: '#0369a1', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'White Text on Info Action', fg: '#ffffff', bg: '#0369a1', min: 4.5, type: 'text' },
  { name: 'Info Text on Info Bg (Dark)', fg: '#bae6fd', bg: '#082f49', min: 4.5, type: 'text' },

  // SOAP: S (Subjective - Blue)
  { name: 'SOAP S Text on S Tint (Light)', fg: '#1e3a8a', bg: '#eff6ff', min: 4.5, type: 'text' },
  { name: 'SOAP S Stripe on White (UI)', fg: '#1d4ed8', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'SOAP S Text on S Dark Bg', fg: '#dbeafe', bg: '#172554', min: 4.5, type: 'text' },

  // SOAP: O (Objective - Green)
  { name: 'SOAP O Text on O Tint (Light)', fg: '#14532d', bg: '#f0fdf4', min: 4.5, type: 'text' },
  { name: 'SOAP O Stripe on White (UI)', fg: '#15803d', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'SOAP O Text on O Dark Bg', fg: '#dcfce7', bg: '#052e16', min: 4.5, type: 'text' },

  // SOAP: A (Assessment - Amber)
  { name: 'SOAP A Text on A Tint (Light)', fg: '#78350f', bg: '#fffbeb', min: 4.5, type: 'text' },
  { name: 'SOAP A Stripe on White (UI)', fg: '#b45309', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'SOAP A Text on A Dark Bg', fg: '#fef3c7', bg: '#451a03', min: 4.5, type: 'text' },

  // SOAP: P (Plan - Purple)
  { name: 'SOAP P Text on P Tint (Light)', fg: '#3b0764', bg: '#faf5ff', min: 4.5, type: 'text' },
  { name: 'SOAP P Stripe on White (UI)', fg: '#6d28d9', bg: '#ffffff', min: 3.0, type: 'ui' },
  { name: 'SOAP P Text on P Dark Bg', fg: '#f3e8ff', bg: '#2e1065', min: 4.5, type: 'text' },

  // High Contrast Mode
  { name: 'High Contrast Black on White', fg: '#000000', bg: '#ffffff', min: 7.0, type: 'text' },
  { name: 'High Contrast White on Black', fg: '#ffffff', bg: '#000000', min: 7.0, type: 'text' },
];

let allPassed = true;
const results = [];

for (const pair of colorPairs) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const passed = ratio >= pair.min;
  if (!passed) allPassed = false;
  results.push({
    ...pair,
    ratio: Math.round(ratio * 100) / 100,
    passed,
  });
}

console.log('| Token / Description | Foreground | Background | Ratio | Min Req | Status |');
console.log('|:---|:---:|:---:|:---:|:---:|:---:|');
for (const r of results) {
  console.log(`| ${r.name} | \`${r.fg}\` | \`${r.bg}\` | **${r.ratio}:1** | ${r.min}:1 | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`);
}

if (!allPassed) {
  console.error('\nContrast verification FAILED');
  process.exit(1);
} else {
  console.log('\nAll WCAG 2.2 AA contrast checks PASSED successfully!');
}
