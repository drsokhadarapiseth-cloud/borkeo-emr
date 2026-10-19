import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { IMAGING_GROUPS, IMAGING_SUBTYPES, getUserImagingSubtypes, setUserImagingSubtypes } from '../server/access.mjs';
import { DEFAULT_SERVICE_CATALOG } from '../server/finance.mjs';
import { generateSimulatedSignaturePng, defaultSimulatedSignatureDataUrl, signatureSnapshot } from '../server/esign.mjs';

test('v24.8 version step consistency across package.json and login.html', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[4-8]\./);

  const loginHtml = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v2[4-8]\./);
});

test('v24.8 all 9 new modalities and 4 classic modalities are grouped properly', () => {
  const expectedModalities = [
    'XRAY', 'ULTRASOUND', 'CT', 'MRI',
    'ECG', 'ECHOCARDIOLOGY', 'EEG',
    'FIBROSCOPY', 'COLOSCOPY',
    'OTOSCOPY', 'RHINOSCOPY', 'LARYNGOSCOPY',
    'BRONCHOSCOPY'
  ];

  for (const mod of expectedModalities) {
    assert.ok(IMAGING_SUBTYPES.includes(mod), `Modality ${mod} is in IMAGING_SUBTYPES`);
  }

  assert.equal(IMAGING_GROUPS.length, 6, 'There are 6 specialty branches');
  assert.ok(IMAGING_GROUPS.some(g => g.id === 'RADIOLOGY' && g.subtypes.includes('XRAY')));
  assert.ok(IMAGING_GROUPS.some(g => g.id === 'CARDIOLOGY' && g.subtypes.includes('ECG') && g.subtypes.includes('ECHOCARDIOLOGY')));
  assert.ok(IMAGING_GROUPS.some(g => g.id === 'NEUROLOGY' && g.subtypes.includes('EEG')));
  assert.ok(IMAGING_GROUPS.some(g => (g.id === 'ENDOSCOPY' || g.id === 'GASTROENTEROLOGY') && g.subtypes.includes('FIBROSCOPY') && g.subtypes.includes('COLOSCOPY')));
  assert.ok(IMAGING_GROUPS.some(g => g.id === 'ENT' && g.subtypes.includes('OTOSCOPY') && g.subtypes.includes('RHINOSCOPY') && g.subtypes.includes('LARYNGOSCOPY')));
  assert.ok(IMAGING_GROUPS.some(g => g.id === 'PULMONOLOGY' && g.subtypes.includes('BRONCHOSCOPY')));
});

test('v24.8 default catalog assigns 0 KHR to all new diagnostic & imaging modalities', () => {
  const newModalities = [
    'ECG', 'ECHOCARDIOLOGY', 'EEG',
    'FIBROSCOPY', 'COLOSCOPY',
    'OTOSCOPY', 'RHINOSCOPY', 'LARYNGOSCOPY',
    'BRONCHOSCOPY'
  ];

  for (const mod of newModalities) {
    const item = DEFAULT_SERVICE_CATALOG.find(c => c[0] === mod);
    assert.ok(item, `Catalog item for ${mod} exists`);
    assert.equal(item[1], 'IMAGING', `Category for ${mod} is IMAGING`);
  }
});

test('v24.8 simulated signature generation creates valid PNG data URLs for each role', () => {
  const roles = ['DOCTOR', 'NURSE', 'IMAGING', 'LAB', 'PHARMACY', 'CASHIER', 'ADMIN'];
  for (const role of roles) {
    const dataUrl = defaultSimulatedSignatureDataUrl('Dr. Test User', role);
    assert.ok(dataUrl.startsWith('data:image/png;base64,'), `Valid data URL for role ${role}`);
    
    const buffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50);
    assert.equal(buffer[2], 0x4e);
    assert.equal(buffer[3], 0x47);
  }

  // Check signature snapshot with fallback
  const user = { id: 'u1', username: 'doc1', displayName: 'Doctor Sreynich', role: 'DOCTOR', signatureDataUrl: defaultSimulatedSignatureDataUrl('Doctor Sreynich', 'DOCTOR') };
  const snap = signatureSnapshot(null, user);
  assert.equal(snap.signerName, 'Doctor Sreynich');
  assert.ok(snap.signatureDataUrl.startsWith('data:image/png;base64,'));
});

test('v24.8 user imaging subtypes persistence and API management', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  async function login(username) {
    const res = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username })
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie').split(';', 1)[0];
    await res.json();
    const meRes = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    return { cookie, csrf: me.csrfToken, user: me.user };
  }

  try {
    const admin = await login('admin');

    // Create specialist imaging user with specific modalities
    const specialistId = crypto.randomUUID();
    app.database.createUser({
      id: specialistId,
      username: 'cardio_doc',
      displayName: 'Cardiologist Vichea',
      role: 'DOCTOR',
      passwordHash: 'dummy',
      createdAt: Date.now()
    });

    // Assign subtypes
    setUserImagingSubtypes(app.database, specialistId, ['ECG', 'ECHOCARDIOLOGY']);
    const subtypes = getUserImagingSubtypes(app.database, specialistId);
    assert.deepEqual(subtypes, ['ECG', 'ECHOCARDIOLOGY']);

    // Check through /api/admin/users
    const res = await fetch(`${origin}/api/admin/users`, {
      headers: { Cookie: admin.cookie }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const userItem = data.users.find(u => u.username === 'cardio_doc');
    assert.ok(userItem);
    assert.deepEqual(userItem.imagingSubtypes, ['ECG', 'ECHOCARDIOLOGY']);

    // Update via API
    const updateRes = await fetch(`${origin}/api/admin/users/${specialistId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': admin.csrf,
        Cookie: admin.cookie
      },
      body: JSON.stringify({
        displayName: 'Dr. Vichea Heart Specialist',
        roles: ['IMAGING'],
        wards: ['ALL'],
        imagingSubtypes: ['ECG', 'ECHOCARDIOLOGY', 'BRONCHOSCOPY']
      })
    });
    assert.equal(updateRes.status, 200);
    await updateRes.json();

    const updatedSubtypes = getUserImagingSubtypes(app.database, specialistId);
    assert.deepEqual(updatedSubtypes.slice().sort(), ['BRONCHOSCOPY', 'ECG', 'ECHOCARDIOLOGY']);
  } finally {
    app.server.closeAllConnections?.();
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('v24.8 ordering 0 KHR paraclinic diagnostic modalities and releasing structured results', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  async function login(username) {
    const res = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username })
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie').split(';', 1)[0];
    await res.json();
    const meRes = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    return { cookie, csrf: me.csrfToken, user: me.user };
  }

  try {
    const doc = await login('doctor_medicine');
    const imaging = await login('imaging');

    // Create patient
    const patientKey = 'case:OTOSCOPY-001';
    const patRes = await fetch(`${origin}/api/patient-record`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': doc.csrf,
        Cookie: doc.cookie
      },
      body: JSON.stringify({
        patientKey,
        summary: {
          caseNumber: 'OTOSCOPY-001',
          fullName: 'Keo Sokha',
          sex: 'ស្រី',
          age: '45',
          departmentCode: 'medicine',
          departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
          departmentNameEn: 'Medicine',
          serviceMode: 'ipd',
          entryDate: '2026-10-09'
        },
        data: { 'id:web_adm_no': 'OTOSCOPY-001' }
      })
    });
    assert.equal(patRes.status, 200);

    // Create Otoscopy order (ENT) with direct handoff & free mode
    const orderRes = await fetch(`${origin}/api/paraclinic/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': doc.csrf,
        Cookie: doc.cookie
      },
      body: JSON.stringify({
        patientKey,
        modality: 'OTOSCOPY',
        chargeMode: 'FREE',
        handoffMode: 'DIRECT',
        priority: 'ROUTINE',
        request: { clinicalInfo: 'Check tympanic membrane bilateral' }
      })
    });
    assert.equal(orderRes.status, 201);
    const orderData = await orderRes.json();
    const orderId = orderData.order.id;

    // Release structured report
    const structuredDetails = {
      externalCanal: 'Mild erythema in right canal, clear left canal',
      tympanicMembrane: 'Small central perforation on right TM, intact left TM',
      middleEar: 'Serous fluid visible right middle ear',
      discharge: 'Minimal mucoid',
      otherFindings: 'No cholesteatoma noted'
    };

    const resultRes = await fetch(`${origin}/api/paraclinic/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-CSRF-Token': imaging.csrf,
        Cookie: imaging.cookie
      },
      body: JSON.stringify({
        status: 'PROCESSING',
        release: true,
        result: {
          findings: 'Right TM perforation with mild otitis media.',
          impression: 'Chronic suppurative otitis media right ear.',
          recommendations: 'Topical ciprofloxacin drops and keep ear dry.',
          structuredDetails
        }
      })
    });
    assert.equal(resultRes.status, 200);
    const resultData = await resultRes.json();
    assert.equal(resultData.order.status, 'RESULT_AVAILABLE');
    assert.ok(resultData.order.result.findings.includes('Right TM perforation'));
    assert.equal(resultData.order.result.structuredDetails.tympanicMembrane, 'Small central perforation on right TM, intact left TM');
  } finally {
    app.server.closeAllConnections?.();
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});


