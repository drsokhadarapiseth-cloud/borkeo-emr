import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve('.');


test('v35.6 - Triage dropdown has contraception "ពន្យាកំណើត" with HEF code RH-LARFP in protected and legacy EMR.html', () => {
  for (const relativePath of ['protected/EMR.html', 'legacy-html/EMR.html']) {
    const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(
      html,
      /<option\s+value="spacing"\s+data-key="opt_family_planning"\s+data-hef-code="RH-LARFP">\s*ពន្យាកំណើត\s*<\/option>/
    );
  }

  const protectedHtml = fs.readFileSync(path.join(ROOT, 'protected/EMR.html'), 'utf8');
  assert.match(protectedHtml, /opt_family_planning:\s*["']ពន្យាកំណើត["']/);
});

test('v35.6 - emr-patient-record.js defines spacing as "ពន្យាកំណើត" with hefCode RH-LARFP and resolves PMRS code', () => {
  const jsContent = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');
  assert.match(jsContent, /spacing:\s*\{\s*code:\s*['"]family-planning['"],\s*kh:\s*['"]ពន្យាកំណើត['"],\s*en:\s*['"]Family Planning \/ Contraception['"],\s*mode:\s*['"]opd['"],\s*module:\s*['"]spacing['"],\s*hefCode:\s*['"]RH-LARFP['"]\s*\}/);

  // Extract resolvePmrServiceCode function directly
  const fnStartIndex = jsContent.indexOf('function resolvePmrServiceCode()');
  assert.ok(fnStartIndex !== -1, 'function resolvePmrServiceCode() must exist');
  const fnEndIndex = jsContent.indexOf('function syncServiceCode()', fnStartIndex);
  assert.ok(fnEndIndex !== -1, 'function syncServiceCode() must follow resolvePmrServiceCode()');
  const fnCode = jsContent.slice(fnStartIndex, fnEndIndex).trim();

  const selectedOpt = {
    value: 'spacing',
    dataset: { hefCode: 'RH-LARFP' }
  };

  const context = {
    document: {
      getElementById: (id) => {
        if (id === 'web_equity') return { value: 'EQ-12345' };
        if (id === 'p2_other_dept') {
          return {
            value: 'spacing',
            selectedIndex: 0,
            options: [selectedOpt]
          };
        }
        return null;
      },
      querySelector: () => null
    },
    loadedPatient: null,
    otherDefinitions: {
      spacing: { hefCode: 'RH-LARFP' }
    }
  };

  vm.createContext(context);
  vm.runInContext(fnCode, context);

  const resolved = context.resolvePmrServiceCode();
  assert.equal(resolved, 'RH-LARFP');
});
