import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createEmrServer } from '../server/server.mjs';

test('clinician can fill a normal cardiovascular examination without overwriting an edited finding', async () => {
  const controls = new Map();
  const saved = { value: 'irregular rhythm', events: 0, dispatchEvent() { this.events += 1; } };
  controls.set('ipd_exam_cvs_auscultation', saved);
  globalThis.window = {};
  globalThis.document = {
    getElementById(id) {
      if (!controls.has(id)) controls.set(id, { value: '', events: 0, dispatchEvent() { this.events += 1; } });
      return controls.get(id);
    },
    querySelectorAll() { return []; },
  };
  try {
    const { NORMAL_EXAM, normalExamText } = await import('../public/pmrs2-exam-normal.js?frontend-test=1');
    window.fillClinicalExamNormal('cardiovascular');
    assert.equal(saved.value, 'irregular rhythm');
    for (const [id, [, normal]] of Object.entries(NORMAL_EXAM.cardiovascular.fields)) {
      if (id !== 'ipd_exam_cvs_auscultation') assert.equal(controls.get(id).value, normal);
    }
    for (const language of ['en', 'fr', 'kh']) {
      controls.get('ipd_exam_normal_language').value = language;
      window.fillClinicalExamNormal('cardiovascular');
      assert.equal(saved.value, 'irregular rhythm');
      for (const [id, [, normal]] of Object.entries(NORMAL_EXAM.cardiovascular.fields)) {
        if (id !== 'ipd_exam_cvs_auscultation') assert.equal(controls.get(id).value, normalExamText(normal, language));
      }
    }
    const source = await readFile(new URL('../protected/EMR.html', import.meta.url), 'utf8');
    assert.match(source, /onclick="fillClinicalExamNormal\('all'\)"/);
    for (const id of Object.keys(NORMAL_EXAM.cardiovascular.fields)) {
      assert.match(source, new RegExp(`id="${id}" data-emr-migrate-auto-key`));
    }
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('examination module is available to the authenticated EMR page', async () => {
  const app = createEmrServer({ demoMode: false, databasePath: ':memory:', host: '127.0.0.1' });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    const response = await fetch(origin + '/public/pmrs2-exam-normal.js?v=1');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(await response.text(), /fillClinicalExamNormal/);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
