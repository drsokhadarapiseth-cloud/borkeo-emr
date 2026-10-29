import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('Phase 6: Clinical data display assets exist and are registered in server.mjs', () => {
  const css = read('public/clinical-data.css');
  const js = read('public/clinical-data.js');
  const serverCode = read('server/server.mjs');
  const pkg = JSON.parse(read('package.json'));
  const loginHtml = read('public/login.html');

  // Version consistency
  assert.match(pkg.version, /^(?:39\.[5-9]|(?:[4-9][0-9]|[1-9][0-9]{2,})\.[0-9])\.0$/, 'package.json version must be 39.5.0 or above');
  assert.match(serverCode, /Borkeo EMR v(?:39\.[5-9]|(?:[4-9][0-9]|[1-9][0-9]{2,})\.[0-9])/, 'server.mjs must declare v39.5 or above');
  assert.match(serverCode, /'\/public\/clinical-data\.css'/, 'server.mjs must register clinical-data.css');
  assert.match(serverCode, /'\/public\/clinical-data\.js'/, 'server.mjs must register clinical-data.js');
  assert.match(serverCode, /clinical-data\.css\?v=\d+/, 'server.mjs must inject clinical-data.css');
  assert.match(serverCode, /clinical-data\.js\?v=\d+/, 'server.mjs must inject clinical-data.js');
  assert.match(loginHtml, /data-app-version[^>]*>v(?:39\.[5-9]|(?:[4-9][0-9]|[1-9][0-9]{2,})\.[0-9])<\/span>/, 'login.html must display v39.5 or above');

  // CSS contains tabular-nums, lab flag badge styles, sparklines, and print letterhead
  assert.match(css, /tabular-nums/, 'clinical-data.css must define tabular-nums formatting');
  assert.match(css, /\.lab-flag-badge/, 'clinical-data.css must define lab flag badges');
  assert.match(css, /\.emr-sparkline/, 'clinical-data.css must style inline-SVG sparklines');
  assert.match(css, /\.emr-print-letterhead/, 'clinical-data.css must style unified print letterhead');
  assert.match(css, /\.emr-print-patient-grid/, 'clinical-data.css must style print patient grid');
});

test('Phase 6: Lab results table displays multi-modal flags (colour + icon + text, never colour alone) and units', async () => {
  // Load clinical-data.js in isolation to test helper functions
  const jsCode = read('public/clinical-data.js');
  const sandbox = {};
  const runScript = new Function('window', 'global', 'globalThis', jsCode);
  runScript(sandbox, sandbox, sandbox);

  const { EmrLabDisplay } = sandbox;
  assert.ok(EmrLabDisplay, 'EmrLabDisplay must be exported');

  // Multi-modal flags: never rely on colour alone (WCAG 1.4.1)
  const lowLabel = EmrLabDisplay.flagLabel('LOW');
  assert.match(lowLabel, /▼/, 'LOW flag must include downward icon ▼');
  assert.match(lowLabel, /Low/i, 'LOW flag must include text "Low"');

  const highLabel = EmrLabDisplay.flagLabel('HIGH');
  assert.match(highLabel, /▲/, 'HIGH flag must include upward icon ▲');
  assert.match(highLabel, /High/i, 'HIGH flag must include text "High"');

  const critLowLabel = EmrLabDisplay.flagLabel('CRITICAL_LOW');
  assert.match(critLowLabel, /⚠️/, 'CRITICAL_LOW flag must include warning icon ⚠️');
  assert.match(critLowLabel, /Crit/i, 'CRITICAL_LOW flag must include text "Crit"');

  const critHighLabel = EmrLabDisplay.flagLabel('CRITICAL_HIGH');
  assert.match(critHighLabel, /⚠️/, 'CRITICAL_HIGH flag must include warning icon ⚠️');
  assert.match(critHighLabel, /Crit/i, 'CRITICAL_HIGH flag must include text "Crit"');

  assert.equal(EmrLabDisplay.flagLabel(''), '', 'Normal flag returns empty text');

  // HTML badge includes role="status" and accessible label
  const badgeHtml = EmrLabDisplay.flagBadgeHtml('CRITICAL_HIGH');
  assert.match(badgeHtml, /role="status"/, 'Badge must include role="status"');
  assert.match(badgeHtml, /aria-label="[^"]*Critical[^"]*"/, 'Badge must include accessible aria-label');
  assert.match(badgeHtml, /class="lab-flag-badge flag-critical-high CRITICAL_HIGH"/, 'Badge must include flag classes');

  // Verify lab.css unsuppressed flag column
  const labCss = read('public/lab.css');
  assert.match(labCss, /\.result-table td\[data-flag\],\s*\.result-table th:nth-child\(5\)\s*\{\s*display:\s*table-cell!important\s*\}/, 'lab.css must display table flag column');
  assert.match(labCss, /\.lab-print-flag,\s*\.lab-print-results th:nth-child\(3\)\s*\{\s*display:\s*table-cell!important\s*\}/, 'lab.css must display print flag column');

  // Verify lab.js populates flagText
  const labJs = read('public/lab.js');
  assert.match(labJs, /const flagText = flagLabel\(flag\);/, 'lab.js must populate flagText in printable rows');
});

test('Phase 6: Vitals display generates small inline-SVG trend charts when more than one measurement exists', () => {
  const jsCode = read('public/clinical-data.js');
  const sandbox = {};
  const runScript = new Function('window', 'global', 'globalThis', jsCode);
  runScript(sandbox, sandbox, sandbox);

  const { EmrVitalsChart } = sandbox;
  assert.ok(EmrVitalsChart, 'EmrVitalsChart must be exported');

  // Less than 2 measurements returns empty string (no meaningless single-point line)
  assert.equal(EmrVitalsChart.renderSparkline([]), '', 'Empty series returns empty string');
  assert.equal(EmrVitalsChart.renderSparkline([37.0]), '', 'Single measurement returns empty string');

  // 2 or more measurements produces accessible inline SVG sparkline
  const sparklineHtml = EmrVitalsChart.renderSparkline([37.0, 37.8, 38.5, 37.2], { stroke: '#ea580c' });
  assert.match(sparklineHtml, /<svg class="emr-sparkline"/, 'Output must contain svg element');
  assert.match(sparklineHtml, /<polyline[^>]*points="/, 'Output must contain polyline with points');
  assert.match(sparklineHtml, /<circle[^>]*cx="/, 'Output must contain circle endpoint');
  assert.match(sparklineHtml, /role="img"/, 'Sparkline must have role="img"');
  assert.match(sparklineHtml, /aria-label="[^"]*37[^"]*38\.5[^"]*"/, 'Sparkline must have descriptive aria-label');

  // Comprehensive trend panel
  const panelHtml = EmrVitalsChart.renderVitalsTrendPanel([
    { dtVal: '2026-10-18T08:00', temp: '36.8', bp_sys: '120', bp_dia: '80', pulse: '72', resp: '16', spo2: '99' },
    { dtVal: '2026-10-19T08:00', temp: '37.5', bp_sys: '125', bp_dia: '82', pulse: '76', resp: '18', spo2: '98' },
    { dtVal: '2026-10-20T08:00', temp: '38.2', bp_sys: '130', bp_dia: '85', pulse: '84', resp: '20', spo2: '97' }
  ]);
  assert.match(panelHtml, /emr-vitals-history-panel/, 'Panel must include container');
  assert.match(panelHtml, /emr-trend-card/, 'Panel must render trend cards');
  assert.match(panelHtml, /38\.2/, 'Panel must display latest temperature');
  assert.match(panelHtml, /130\/85/, 'Panel must display latest blood pressure');
});

test('Phase 6: Consistent date/time in Asia/Phnom_Penh and KHR/USD number formatting', () => {
  const jsCode = read('public/clinical-data.js');
  const sandbox = {};
  const runScript = new Function('window', 'global', 'globalThis', jsCode);
  runScript(sandbox, sandbox, sandbox);

  const { EmrFormat } = sandbox;
  assert.ok(EmrFormat, 'EmrFormat must be exported');
  assert.equal(EmrFormat.timeZone, 'Asia/Phnom_Penh', 'Timezone must be locked to Asia/Phnom_Penh');

  // Fixed UTC timestamp: 2026-10-20T00:00:00Z is 07:00:00 in Asia/Phnom_Penh (UTC+7)
  const utcDate = new Date('2026-10-20T00:00:00Z');
  const formattedDate = EmrFormat.formatDate(utcDate);
  assert.equal(formattedDate, '2026-10-20', 'Date must be formatted for Phnom Penh');

  const formattedTime = EmrFormat.formatTime(utcDate);
  assert.equal(formattedTime, '07:00', 'Time must be formatted in Phnom Penh timezone (UTC+7)');

  // Currency formatting
  const khrHtml = EmrFormat.formatCurrency(4000, 'KHR');
  assert.match(khrHtml, /4,000 ៛/, 'KHR must be formatted with riel symbol and thousands grouping');
  assert.match(khrHtml, /emr-tabular-num/, 'Currency must have tabular numbers class');

  const usdHtml = EmrFormat.formatCurrency(1.5, 'USD');
  assert.match(usdHtml, /\$1\.50/, 'USD must be formatted with dollar symbol and 2 decimal places');
  assert.match(usdHtml, /emr-tabular-num/, 'USD must have tabular numbers class');
});

test('Phase 6: Unified professional letterhead for printed reports', () => {
  const jsCode = read('public/clinical-data.js');
  const sandbox = {};
  const runScript = new Function('window', 'global', 'globalThis', jsCode);
  runScript(sandbox, sandbox, sandbox);

  const { EmrLetterhead } = sandbox;
  assert.ok(EmrLetterhead, 'EmrLetterhead must be exported');

  // National Heading in Khmer and English
  const khmerHeader = EmrLetterhead.renderLetterhead({ lang: 'km', title: 'របាយការណ៍មន្ទីរពិសោធន៍' });
  assert.match(khmerHeader, /ព្រះរាជាណាចក្រកម្ពុជា/, 'Khmer letterhead must have Kingdom of Cambodia in Khmer');
  assert.match(khmerHeader, /ជាតិ សាសនា ព្រះមហាក្សត្រ/, 'Khmer letterhead must have Nation Religion King in Khmer');
  assert.match(khmerHeader, /មន្ទីរពេទ្យបង្អែក បរកែវ/, 'Khmer letterhead must have hospital name');
  assert.match(khmerHeader, /របាយការណ៍មន្ទីរពិសោធន៍/, 'Khmer letterhead must have report title');

  const enHeader = EmrLetterhead.renderLetterhead({ lang: 'en', title: 'Laboratory Report' });
  assert.match(enHeader, /Kingdom of Cambodia/, 'English letterhead must have Kingdom of Cambodia in English');
  assert.match(enHeader, /Nation Religion King/, 'English letterhead must have Nation Religion King in English');

  // Patient metadata grid
  const patientGrid = EmrLetterhead.renderPatientGrid({
    caseId: 'BK-2026-001',
    fullName: 'សុខ សាន',
    age: '35',
    sex: 'ប្រុស',
    department: 'Medicine',
    diagnosis: 'Gastroenteritis'
  });
  assert.match(patientGrid, /BK-2026-001/, 'Patient grid must contain case ID');
  assert.match(patientGrid, /សុខ សាន/, 'Patient grid must contain patient name');
  assert.match(patientGrid, /Gastroenteritis/, 'Patient grid must contain diagnosis');

  // Signatures block
  const sigs = EmrLetterhead.renderSignatures([
    { role: 'គ្រូពេទ្យព្យាបាល (Doctor)', name: 'Dr. Chanthy', date: '2026-10-20' },
    { role: 'ប្រធានមន្ទីរពិសោធន៍ (Lab Chief)', name: 'Vicheka', date: '2026-10-20' }
  ]);
  assert.match(sigs, /Dr\. Chanthy/, 'Signatures block must contain doctor name');
  assert.match(sigs, /Vicheka/, 'Signatures block must contain lab chief name');
});
