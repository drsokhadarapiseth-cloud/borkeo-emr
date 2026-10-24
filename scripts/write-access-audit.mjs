// Read-only source inventory; never reads staff/patient databases or .env.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ROLES, WARDS, roleRequiresWard, roleWardAllowed, roleCanPage } from '../server/access.mjs';
import { accessContexts } from '../tests/helpers/access-audit-contexts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const sandbox = vm.createContext({ URL, URLSearchParams });
vm.runInContext(read('public/nav-config.js'), sandbox);
const nav = sandbox.EmrNavConfig;
const server = read('server/server.mjs');
const pages = [...server.slice(server.indexOf('const protectedPages = new Map'), server.indexOf('const clinicalWriteRoles')).matchAll(/\['(\/[^']+)'\s*,\s*\[/g)].map(m => m[1]);
const roleRows = ROLES.map(role => {
  const wards = roleRequiresWard(role) ? WARDS.filter(w => roleWardAllowed(role, w.code)).map(w => w.code).join(', ') : 'No ward context';
  return `| ${role} | ${wards} |`;
});
const contextRows = accessContexts.map(({ role, ward, landing }) => {
  const user = { activeRole: role, activeWard: ward ? { code: ward } : null };
  const menu = nav.visibleGroups(user).flatMap(group => group.items).map(item => `[${item.labelEn}](${item.href})`).join('; ');
  return `| ${role}@${ward || '-'} | ${landing} | ${menu} |`;
});
const pageRows = pages.map(page => `| ${page} | ${ROLES.filter(role => roleCanPage(role, page)).join(', ')} |`);
const modules = fs.readdirSync(path.join(root, 'server/routes')).filter(f => f.endsWith('.mjs')).sort().map(file => {
  const source = read(`server/routes/${file}`);
  const count = [...source.matchAll(/router\.(?:get|post|put|patch|delete)\(/g)].length;
  const guards = ['requireContext', 'canAccessPatient', 'requireSession', 'sessionRole', 'orderActorAllowed', 'canUseMaternalPatient', 'encounterAccess'].filter(name => source.includes(name));
  return `| server/routes/${file} | ${count} | ${guards.join(', ') || 'Inspect module-specific guards'} |`;
});
const output = `# Role and action access audit

Audit baseline: 42.9.0, ba812ed. First fixes prepared as 43.0.0.
Reproduce the source inventory with: node scripts/write-access-audit.mjs.
Source inventory is not proof that every action works. Test evidence is in
docs/ai-handoff/TEST_RESULTS.md; unfinished work stays in TASKS.md.

## Policy and service boundaries

- Sources: AGENTS.md, master sections 3/3A/7/8, server/access.mjs,
  public/nav-config.js, server/server.mjs, and the modular API guards below.
- Combined Obstetric/Gynecology doctor access was CANCELLED. Assignment to
  multiple wards requires an explicit active context. No account/role grants
  or clinical thresholds changed in this increment.
- Existing patient-access emergency and transfer exceptions are retained.
- The following table lists eligible contexts, not grants to every staff member.
  Actual selectable contexts are intersected with assigned roles and wards.
- Inventory covers built-in roles. Hospital-specific custom role definitions
  and live assignments were not read; do not infer their authorization.

| Role | Eligible ward contexts |
|---|---|
${roleRows.join('\n')}

## Representative landing and menu matrix

Synthetic coverage: all 15 built-in roles in 19 representative contexts.
API tests check each visible menu destination and allow/deny results for user
administration, accounting expenses and NPCA mapping reads. Chromium checks
rendered menus and landing pages separately. This is not a save/reopen audit of
every button on these pages. Query-specific specialist workflows remain below.

| Active context | Server landing | Default visible navigation |
|---|---|---|
${contextRows.join('\n')}

## Protected-page inventory

Role-only source policy below; additional patient/ward guards still apply.
Server special cases: IPD transfer is OPD-doctor only; paraclinic handoff is
OPD-nurse only. Home redirects some roles to their landing. Cashier/accountant
EMR requests redirect to Billing; Triage EMR requests select its triage view.
Patient-linked EMR access additionally uses encounterAccess. Navigation settings
can hide/reorder entries; they cannot grant access. Specialist routes such as
NPCA/ANC/vaccination may be reached from patient actions instead of the sidebar.

| Page | roleCanPage allows |
|---|---|
${pageRows.join('\n')}

## Important action checks and evidence

| Area | Existing authorization and verification |
|---|---|
| Login/context | Prior 42.9 recovery tests; this audit exercises synthetic login/cookies/context/landing with NPCA disabled. |
| User accounts | GET /api/admin/users: ADMIN, DIRECTOR, VICE_DIRECTOR; all other built-in roles denied. |
| Accounting | GET /api/finance/expenses: management and ACCOUNTANT; other roles denied. No calculations changed. |
| NPCA configuration | GET /api/npca/mappings: ADMIN, DIRECTOR; other roles denied; no remote calls/transmissions. |
| Patient/clinical forms | Existing canAccessPatient and encounterAccess; full forms/save/reopen audit remains unfinished. |
| Lab/imaging orders | Ward doctors create/read only accessible patients; nurses do not gain ordering rights. Specialist reads respect modality. |
| Lab/imaging attachments | Same-service ward readers retained; specialist direct downloads respect modality; synthetic file tests verify contents. |
| Prescribing/dispensing | Existing maternal and IPD regression tests retained. Comprehensive QD task remains unfinished. |
| Beds and doctor alerts | Existing workflows inventoried; required new durable Gynecology workflow remains GYN-01/02. |
| Print/download | Synthetic attachment downloads tested. No print/PDF action visually verified by this increment. |
| Other actions | Search/filter/save/reopen, notifications, queue transitions, all-role workflow and print inventory still require audit. |

## Findings

| ID | Reproduction, cause and fix |
|---|---|
| ACCESS-F01 | Obstetric doctor list hides Gynecology order, but GET order/id returned200. Cause: unconditional DOCTOR bypass. Removed it; direct reads use existing patient access. |
| ACCESS-F02 | Obstetric doctor POST order for Gynecology patient returned201. Cause: DOCTOR exempted from patient check. Removed exemption; denied requests have no order side effects. |
| ACCESS-F03 | LAB/IMAGING worklists restrict modality; direct order/attachment fallback used their global patient access. Specialist direct reads now use orderActorAllowed; matched modality retained. |
| ACCESS-O01 | MIDWIFE currently restricted to Obstetric in backend/context UI. Approved Gynecology context still requires ROLE-01 implementation; no silent grants. |
| ACCESS-O02 | Maternal patientFor/referral signer shortcuts need focused service/recipient review under ROLE-01. Do not remove legitimate referred-care access or claim separation complete. |
| ACCESS-O03 | Full page/action save/reopen, per-ward customizations, all prints and remaining API endpoints not yet exhaustively exercised. |

Tests: tests/access-audit.test.mjs, tests/access-audit-browser.mjs and existing
v162/v426 regressions. Current results and revision are recorded in checkpoints.

## API module inventory

Counts are source declarations, not a claim of endpoint-by-endpoint verification.
Main server legacy handlers, generated regex actions and middleware require
additional review. Presence of a guard name alone is not proof of enforcement.

| Module | Route declarations | Guard references to inspect |
|---|---|---|
${modules.join('\n')}
`;
fs.writeFileSync(path.join(root, 'docs/access-audit.md'), output);
console.log(`Wrote inventory: ${ROLES.length} roles, ${pages.length} protected pages, ${accessContexts.length} contexts.`);
