import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

let application;
let baseUrl;
let temporaryDirectory;
const passwords = {
  doctor: 'Doctor integration password 2026!',
  lab: 'Laboratory integration password 2026!',
  imaging: 'Imaging integration password 2026!',
  nurse: 'Nurse integration password 2026!',
  pediatricnurse: 'Pediatric nurse integration password 2026!',
  admin: 'Admin integration password 2026!',
  accountant: 'Accountant integration password 2026!',
  clerk: 'Clerk integration password 2026!',
  director: 'Director integration password 2026!',
  registration: 'Registration integration password 2026!',
  triage: 'Triage integration password 2026!',
};

async function addUser(username, displayName, role, wards = []) {
  const id = crypto.randomUUID();
  application.database.createUser({
    id, username, displayName, role,
    passwordHash: await hashPassword(passwords[username]),
    createdAt: Date.now(),
  });
  setUserAccess(application.database, id, [role], wards);
  return id;
}

async function login(username, password = passwords[username]) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  const cookie = response.headers.get('set-cookie').split(';', 1)[0];
  const meResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(meResponse.status, 200);
  const me = await meResponse.json();
  return { cookie, csrf: me.csrfToken, user: me.user };
}

function mutationHeaders(session, contentType = 'application/json') {
  return {
    Cookie: session.cookie,
    Origin: baseUrl,
    'X-CSRF-Token': session.csrf,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

test.before(async () => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-workflow-test-'));
  application = createEmrServer({ demoMode: false,
    host: '127.0.0.1',
    port: 32198,
    appOrigin: 'http://127.0.0.1:32198',
    databasePath: path.join(temporaryDirectory, 'test.sqlite'),
  });
  await addUser('doctor', 'Integration Doctor', 'DOCTOR', ['medicine']);
  await addUser('lab', 'Integration Laboratory', 'LAB');
  await addUser('imaging', 'Integration Imaging', 'IMAGING');
  await addUser('nurse', 'Integration Nurse', 'NURSE', ['medicine']);
  await addUser('pediatricnurse', 'Integration Pediatric Nurse', 'NURSE', ['pediatric']);
  await addUser('admin', 'Integration Administrator', 'ADMIN');
  await addUser('accountant', 'Integration Accountant', 'ACCOUNTANT');
  await addUser('clerk', 'Integration Clerk', 'CLERK');
  await addUser('director', 'Integration Director', 'DIRECTOR');
  await addUser('registration', 'Integration Registration Clerk', 'REGISTRATION');
  await addUser('triage', 'Integration Triage Nurse', 'TRIAGE');
  await new Promise((resolve, reject) => {
    application.server.once('error', reject);
    application.server.listen(32198, '127.0.0.1', resolve);
  });
  baseUrl = 'http://127.0.0.1:32198';
});

test.after(async () => {
  await new Promise(resolve => application.server.close(resolve));
  application.database.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('admin creates an account with multiple roles and wards', async () => {
  const admin = await login('admin');
  assert.equal(admin.user.activeRole, 'ADMIN');
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: mutationHeaders(admin),
    body: JSON.stringify({
      displayName: 'Multi Context Staff',
      username: 'multi.staff',
      password: 'Multi staff temporary 2026!',
      roles: ['DOCTOR', 'NURSE'],
      wards: ['medicine', 'emergency'],
    }),
  });
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  assert.deepEqual(result.user.roles, ['DOCTOR', 'NURSE']);
  assert.deepEqual(result.user.wards, ['emergency', 'medicine']);

  const staff = await login('multi.staff', 'Multi staff temporary 2026!');
  assert.equal(staff.user.needsContext, true);
  assert.equal(staff.user.contexts.length, 4);
  const choose = await fetch(`${baseUrl}/api/auth/context`, {
    method: 'POST',
    headers: mutationHeaders(staff),
    body: JSON.stringify({ role: 'NURSE', wardCode: 'emergency' }),
  });
  assert.equal(choose.status, 200);
  const chosen = (await choose.json()).user;
  assert.equal(chosen.activeRole, 'NURSE');
  assert.equal(chosen.activeWard.code, 'emergency');
});

test('direct Triage → IPD supports unpaid bed admission, then payment preserves the bed and triage e-sign', async () => {
  const registration = await login('registration');
  assert.equal(registration.user.activeRole, 'REGISTRATION');
  assert.equal(registration.user.activeWard, null);

  const patientKey = 'case:TRIAGE-FLOW-001';
  const registered = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(registration),
    body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'TRIAGE-FLOW-001', healthId: 'HC-TRIAGE-001', firstName: 'Sok', lastName: 'Queue',
        fullName: 'Queue Sok', sex: 'ស្រី', age: '28 ឆ្នាំ', dateOfBirth: '', phone: '', equityCard: '', paymentType: '',
        departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: '2026-09-16', dischargeDate: '',
      },
      data: { 'scope:registration:id:web_adm_no': 'TRIAGE-FLOW-001', 'scope:registration:id:web_diag_in': 'R50.9', 'scope:registration:id:emr_pmrs_case_new': true },
    }),
  });
  assert.equal(registered.status, 200);
  const registeredPatient = (await registered.json()).patient;
  assert.equal(registeredPatient.triageStatus, 'WAITING');
  assert.equal(registeredPatient.workflowStage, 'TRIAGE_WAITING');

  const triage = await login('triage');
  assert.equal(triage.user.activeRole, 'TRIAGE');
  assert.equal(triage.user.activeWard, null);
  const queueResponse = await fetch(`${baseUrl}/api/triage/queue`, { headers: { Cookie: triage.cookie } });
  assert.equal(queueResponse.status, 200);
  const queuePayload = await queueResponse.json();
  const queue = queuePayload.patients;
  assert.ok(queue.some(patient => patient.patientKey === patientKey));
  assert.ok(Array.isArray(queuePayload.waiting));
  assert.ok(Array.isArray(queuePayload.completed));
  assert.ok(!queuePayload.completed.some(patient => patient.patientKey === patientKey));

  const completed = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(triage),
    body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'TRIAGE-FLOW-001', healthId: 'HC-TRIAGE-001', firstName: 'Sok', lastName: 'Queue', fullName: 'Queue Sok',
        sex: 'ស្រី', age: '28 ឆ្នាំ', dateOfBirth: '', phone: '', equityCard: '', paymentType: '',
        departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
        serviceMode: 'ipd', entryDate: '2026-09-16', dischargeDate: '',
      },
      data: { 'scope:triage:id:p2_temp': '38.2' },
    }),
  });
  assert.equal(completed.status, 200);
  const triagedPatient = (await completed.json()).patient;
  assert.equal(triagedPatient.triageStatus, 'COMPLETED');
  assert.equal(triagedPatient.workflowStage, 'WARD_WAITING');

  const signature = JSON.parse(triagedPatient.data['system:signature:triage']);
  assert.equal(signature.username, 'triage');
  assert.equal(signature.signerName, 'Integration Triage Nurse');
  const queueAfter = await (await fetch(`${baseUrl}/api/triage/queue`, { headers: { Cookie: triage.cookie } })).json();
  assert.ok(queueAfter.completed.some(patient => patient.patientKey === patientKey));
  assert.ok(!queueAfter.waiting.some(patient => patient.patientKey === patientKey));
  const retryTriage = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(triage),
    body: JSON.stringify({ patientKey, expectedVersion: triagedPatient.version,
      summary: { caseNumber: 'TRIAGE-FLOW-001', healthId: 'HC-TRIAGE-001', firstName: 'Sok', lastName: 'Queue', fullName: 'Queue Sok',
        sex: 'ស្រី', age: '28 ឆ្នាំ', departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-09-16' },
      data: { 'scope:triage:id:p2_temp': '38.3' },
    }),
  });
  assert.equal(retryTriage.status, 409);

  const nurse = await login('nurse');
  const paidPatient = await (await fetch(`${baseUrl}/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`, { headers: { Cookie: nurse.cookie } })).json();
  assert.equal(paidPatient.patient.workflowStage, 'WARD_WAITING');
  const wardPatients = await fetch(`${baseUrl}/api/patients?includePayment=1`, { headers: { Cookie: nurse.cookie } });
  assert.equal(wardPatients.status, 200);
  const wardPatient = (await wardPatients.json()).patients.find(patient => patient.patientKey === patientKey);
  assert.ok(wardPatient);
  assert.equal(wardPatient.workflowStage, 'WARD_WAITING');
  assert.equal(wardPatient.departmentCode, 'medicine');

  const nurseInbox = (await (await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:nurse.cookie } })).json()).messages;
  const triageAlert = nurseInbox.find(message => message.patientKey === patientKey && (message.subject.includes('ទ្រីយ៉ា') || message.subject.includes('អ្នកជំងឺថ្មីពីតម្រៀប')));
  assert.ok(triageAlert);
  assert.equal(triageAlert.destinationRole, 'NURSE');

  const assignResponse = await fetch(`${baseUrl}/api/patient-admission`, {
    method:'PATCH', headers:mutationHeaders(nurse), body:JSON.stringify({
      patientKey, action:'assign', departmentCode:'medicine', departmentNameKh:'ផ្នែកជំងឺទូទៅ', departmentNameEn:'Medicine',
      roomCode:'medical', roomId:'room-medicine-medical', roomNameKh:'បន្ទប់វេជ្ជសាស្ត្រ', roomNameEn:'Medical Ward',
      bedId:'bed-medicine-medical-1', bedLabel:'1', careType:'nurse',
    }),
  });
  assert.equal(assignResponse.status, 200, JSON.stringify(await assignResponse.json().catch(()=>({}))));

  const clerk = await login('clerk');
  const chargeResponse = await fetch(`${baseUrl}/api/finance/charges`, {
    method: 'POST', headers: mutationHeaders(clerk),
    body: JSON.stringify({ patientKey, description: 'IPD Admission', quantity: 1, unitAmount: 100000, currency: 'KHR' }),
  });
  assert.equal(chargeResponse.status, 201, JSON.stringify(await chargeResponse.json().catch(() => ({}))));
  const paymentResponse = await fetch(`${baseUrl}/api/finance/payments`, {
    method: 'POST', headers: mutationHeaders(clerk),
    body: JSON.stringify({ patientKey, source: 'CASH', amount: 100000, currency: 'KHR' }),
  });
  assert.equal(paymentResponse.status, 201, JSON.stringify(await paymentResponse.json().catch(() => ({}))));
  const admittedAfterPayment = await (await fetch(`${baseUrl}/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`, { headers: { Cookie: nurse.cookie } })).json();
  assert.equal(admittedAfterPayment.patient.workflowStage, 'ADMITTED', 'payment preserves the assigned bed and admission');
  assert.equal(admittedAfterPayment.patient.currentBedId, 'bed-medicine-medical-1');

  const doctor = await login('doctor');
  const doctorInbox = (await (await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:doctor.cookie } })).json()).messages;
  const admissionAlert = doctorInbox.find(message => message.patientKey === patientKey && message.subject.includes('អ្នកជំងឺចូលសម្រាកថ្មី'));
  assert.ok(admissionAlert);
  assert.equal(admissionAlert.destinationRole, 'DOCTOR');
  const nurseInboxAfterAssign = (await (await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:nurse.cookie } })).json()).messages;
  assert.ok(!nurseInboxAfterAssign.some(message => message.id === admissionAlert.id));
  assert.ok(!nurseInboxAfterAssign.some(message => message.id === triageAlert.id),'assignment completes the nursing admission task');
  const nurseHistory=(await(await fetch(`${baseUrl}/api/messages?state=completed`,{headers:{Cookie:nurse.cookie}})).json()).messages;
  assert.ok(nurseHistory.some(message=>message.id===triageAlert.id&&message.completedBy===nurse.user.id));
});

test('doctor-to-lab request, unit conversion, release and review round-trip', async () => {
  const doctor = await login('doctor');
  assert.equal(doctor.user.activeRole, 'DOCTOR');
  assert.equal(doctor.user.activeWard.code, 'medicine');
  const patientKey = 'case:PARA-001';
  const savePatient = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT',
    headers: mutationHeaders(doctor),
    body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'PARA-001', healthId: '', firstName: 'Dara', lastName: 'Patient',
        fullName: 'Patient Dara', sex: 'ប្រុស', age: '45 ឆ្នាំ', dateOfBirth: '', phone: '',
        equityCard: '', paymentType: '', departmentCode: 'medicine',
        departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
        serviceMode: 'ipd', entryDate: '2026-09-15', dischargeDate: '',
      },
      data: { 'id:web_adm_no': 'PARA-001' },
    }),
  });
  assert.equal(savePatient.status, 200);

  const create = await fetch(`${baseUrl}/api/paraclinic/orders`, {
    method: 'POST',
    headers: mutationHeaders(doctor),
    body: JSON.stringify({
      patientKey,
      modality: 'LAB',
      priority: 'ROUTINE',
      request: {
        clinicalInfo: 'Weakness and arrhythmia',
        items: [{ code: 'K', urgent: true }, { code: 'CREAT', urgent: false }],
      },
    }),
  });
  const created = await create.json();
  assert.equal(create.status, 201, JSON.stringify(created));
  assert.equal(created.order.priority, 'URGENT');
  assert.equal(created.order.request.items[0].urgent, true);

  const lab = await login('lab');
  const beforeWardDispatch = await fetch(`${baseUrl}/api/paraclinic/orders`, { headers: { Cookie: lab.cookie } });
  assert.equal(beforeWardDispatch.status, 200);
  assert.equal((await beforeWardDispatch.json()).orders.length, 0);

  const nurse = await login('nurse');
  const nurseOrdersResponse = await fetch(`${baseUrl}/api/paraclinic/orders?patientKey=${encodeURIComponent(patientKey)}`, { headers: { Cookie: nurse.cookie } });
  assert.equal(nurseOrdersResponse.status, 200);
  const nurseOrder = (await nurseOrdersResponse.json()).orders[0];
  assert.equal(nurseOrder.status, 'ORDERED');

  for (const body of [
    { status: 'WARD_RECEIVED' },
    { status: 'COLLECTED', collectedAt: Date.now() - 30_000 },
    { status: 'SENT_TO_LAB' },
  ]) {
    const step = await fetch(`${baseUrl}/api/paraclinic/orders/${created.order.id}`, {
      method: 'PATCH', headers: mutationHeaders(nurse), body: JSON.stringify(body),
    });
    assert.equal(step.status, 200, JSON.stringify(await step.json().catch(() => ({}))));
  }

  const worklist = await fetch(`${baseUrl}/api/paraclinic/orders`, { headers: { Cookie: lab.cookie } });
  assert.equal(worklist.status, 200);
  const labOrders = (await worklist.json()).orders;
  assert.equal(labOrders.length, 1);
  assert.equal(labOrders[0].id, created.order.id);
  assert.equal(labOrders[0].status, 'SENT_TO_LAB');

  const labReceive = await fetch(`${baseUrl}/api/paraclinic/orders/${created.order.id}`, {
    method: 'PATCH', headers: mutationHeaders(lab), body: JSON.stringify({ status: 'RECEIVED' }),
  });
  assert.equal(labReceive.status, 200, JSON.stringify(await labReceive.json().catch(() => ({}))));

  const release = await fetch(`${baseUrl}/api/paraclinic/orders/${created.order.id}`, {
    method: 'PATCH',
    headers: mutationHeaders(lab),
    body: JSON.stringify({
      status: 'PROCESSING',
      performed: true,
      release: true,
      result: { items: [
        { code: 'K', value: 2.8, unit: 'mmol/L', comment: 'Verified' },
        { code: 'CREAT', value: 1.0, unit: 'mg/dL', comment: '' },
      ] },
    }),
  });
  const released = await release.json();
  assert.equal(release.status, 200, JSON.stringify(released));
  assert.equal(released.order.status, 'RESULT_AVAILABLE');
  assert.ok(released.order.releasedAt);
  const potassium = released.order.result.items.find(item => item.code === 'K');
  const creatinine = released.order.result.items.find(item => item.code === 'CREAT');
  assert.equal(potassium.flag, 'LOW');
  assert.equal(potassium.referenceLow, 3.7);
  assert.equal(creatinine.baseValue, 88.4);
  assert.ok(Math.abs(creatinine.referenceLow - (53 / 88.4)) < 0.00001);

  const patientOrders = await fetch(`${baseUrl}/api/paraclinic/orders?patientKey=${encodeURIComponent(patientKey)}`, {
    headers: { Cookie: doctor.cookie },
  });
  assert.equal(patientOrders.status, 200);
  const returned = (await patientOrders.json()).orders[0];
  assert.equal(returned.status, 'RESULT_AVAILABLE');
  assert.equal(returned.reviewedAt, null);
  assert.equal(returned.wardSeenAt, null);

  const wardSeen = await fetch(`${baseUrl}/api/paraclinic/orders/${returned.id}`, {
    method: 'PATCH', headers: mutationHeaders(nurse), body: JSON.stringify({ status: 'WARD_SEEN' }),
  });
  const wardSeenBody = await wardSeen.json();
  assert.equal(wardSeen.status, 200, JSON.stringify(wardSeenBody));
  assert.equal(wardSeenBody.order.status, 'WARD_SEEN');
  assert.ok(wardSeenBody.order.wardSeenAt);

  const reviewedResponse = await fetch(`${baseUrl}/api/paraclinic/orders/${returned.id}/review`, {
    method: 'POST',
    headers: mutationHeaders(doctor, null),
  });
  assert.equal(reviewedResponse.status, 200);
  const reviewed = (await reviewedResponse.json()).order;
  assert.ok(reviewed.reviewedAt);
  assert.equal(reviewed.reviewerName, 'Integration Doctor');
  const printableWorklist=await(await fetch(`${baseUrl}/api/paraclinic/orders?modality=LAB`,{headers:{Cookie:lab.cookie}})).json();
  assert.ok(printableWorklist.orders.some(order=>order.id===returned.id&&order.status==='WARD_SEEN'),'Lab can reopen reviewed reports for printing');
});

test('doctor-to-imaging request is released back to the patient record', async () => {
  const doctor = await login('doctor');
  const patientKey = 'case:PARA-001';
  const create = await fetch(`${baseUrl}/api/paraclinic/orders`, {
    method: 'POST',
    headers: mutationHeaders(doctor),
    body: JSON.stringify({
      patientKey,
      modality: 'ULTRASOUND',
      priority: 'ROUTINE',
      request: { examination: 'Abdomen', clinicalIndication: 'Right upper quadrant pain', history: '' },
    }),
  });
  const created = await create.json();
  assert.equal(create.status, 201, JSON.stringify(created));
  assert.equal(created.order.request.chargeMode, 'FREE');

  const imaging = await login('imaging');
  const worklist = await fetch(`${baseUrl}/api/paraclinic/orders`, { headers: { Cookie: imaging.cookie } });
  assert.equal(worklist.status, 200);
  assert.ok(!(await worklist.json()).orders.some(item => item.id === created.order.id), 'IPD imaging must wait for ward handoff');
  const nurse = await login('nurse');
  const received = await fetch(`${baseUrl}/api/paraclinic/orders/${created.order.id}`, {
    method:'PATCH', headers:mutationHeaders(nurse), body:JSON.stringify({request:{wardWorkflow:{stage:'RECEIVED_ORDER'}}}),
  });
  assert.equal(received.status,200,await received.clone().text());
  const sent = await fetch(`${baseUrl}/api/paraclinic/orders/${created.order.id}`, {
    method:'PATCH', headers:mutationHeaders(nurse), body:JSON.stringify({request:{wardWorkflow:{stage:'PATIENT_SENT_TO_IMAGING'}}}),
  });
  assert.equal(sent.status,200,await sent.clone().text());
  const handedOffWorklist=await fetch(`${baseUrl}/api/paraclinic/orders`,{headers:{Cookie:imaging.cookie}});
  const imageOrders = (await handedOffWorklist.json()).orders;
  assert.ok(imageOrders.some(item => item.id === created.order.id && item.modality === 'ULTRASOUND'));

  const release = await fetch(`${baseUrl}/api/paraclinic/orders/${created.order.id}`, {
    method: 'PATCH',
    headers: mutationHeaders(imaging),
    body: JSON.stringify({
      status: 'PROCESSING', performed: true, release: true,
      result: { findings: 'No focal hepatic lesion.', conclusion: 'No acute sonographic abnormality.', recommendation: '' },
    }),
  });
  const released = await release.json();
  assert.equal(release.status, 200, JSON.stringify(released));
  assert.equal(released.order.status, 'RESULT_AVAILABLE');
  assert.equal(released.order.result.conclusion, 'No acute sonographic abnormality.');

  const doctorOrders = await fetch(`${baseUrl}/api/paraclinic/orders?patientKey=${encodeURIComponent(patientKey)}`, {
    headers: { Cookie: doctor.cookie },
  });
  const orders = (await doctorOrders.json()).orders;
  assert.ok(orders.some(item => item.id === created.order.id && item.releasedAt));
  const printableImaging=await(await fetch(`${baseUrl}/api/paraclinic/orders`,{headers:{Cookie:imaging.cookie}})).json();
  assert.ok(printableImaging.orders.some(order=>order.id===created.order.id&&order.releasedAt),'Imaging retains released reports for printing');
});


test('server keeps medical data read-only for a Nurse while allowing Nursing Process data', async () => {
  const doctor = await login('doctor');
  const patientKey = 'case:PARA-001';
  const doctorSave = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(doctor), body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'PARA-001', healthId: '', firstName: 'Dara', lastName: 'Patient', fullName: 'Patient Dara',
        sex: 'ប្រុស', age: '45 ឆ្នាំ', dateOfBirth: '', phone: '', equityCard: '', paymentType: '',
        departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
        serviceMode: 'ipd', entryDate: '2026-09-15', dischargeDate: '',
      },
      data: { 'scope:medical:id:doctor-diagnosis': 'Doctor diagnosis' },
    }),
  });
  assert.equal(doctorSave.status, 200);

  const nurse = await login('nurse');
  const nurseSave = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(nurse), body: JSON.stringify({
      patientKey,
      summary: {
        caseNumber: 'PARA-001', healthId: '', firstName: 'Changed', lastName: 'Name', fullName: 'Changed Name',
        sex: 'ស្រី', age: '10 ឆ្នាំ', dateOfBirth: '', phone: '', equityCard: '', paymentType: '',
        departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
        serviceMode: 'ipd', entryDate: '2026-09-15', dischargeDate: '',
      },
      data: {
        'scope:medical:id:doctor-diagnosis': 'Nurse attempted overwrite',
        'scope:nursing:auto:1': 'Nursing assessment saved',
      },
    }),
  });
  assert.equal(nurseSave.status, 200);

  const reload = await fetch(`${baseUrl}/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`, { headers: { Cookie: doctor.cookie } });
  const patient = (await reload.json()).patient;
  assert.equal(patient.fullName, 'Patient Dara');
  assert.equal(patient.sex, 'ប្រុស');
  assert.equal(patient.data['scope:medical:id:doctor-diagnosis'], 'Doctor diagnosis');
  assert.equal(patient.data['scope:nursing:auto:1'], 'Nursing assessment saved');

  const discharge = await fetch(`${baseUrl}/api/patient-admission`, {
    method: 'PATCH', headers: mutationHeaders(nurse), body: JSON.stringify({
      patientKey, action: 'discharge', dischargeDate: '2026-09-16', dischargeDepartment: 'Medicine',
      dischargeDiagnosis: 'Attempted nurse discharge', dischargeAt: '2026-09-16T09:00', outcome: 'improved', status: 'ordered',
    }),
  });
  assert.equal(discharge.status, 403);
});

test('administrator manages the lab catalog and can review audited actions', async () => {
  const admin = await login('admin');
  const create = await fetch(`${baseUrl}/api/lab-catalog`, {
    method: 'POST', headers: mutationHeaders(admin), body: JSON.stringify({
      code: 'TEST_FERRITIN', name: 'Ferritin', category: 'Clinical Chemistry', specimen: 'Serum',
      baseUnit: 'ng/mL', units: [{ unit: 'ng/mL', factorToBase: 1, offsetToBase: 0 }],
      referenceLow: 20, referenceHigh: 250, criticalLow: 5, criticalHigh: 1000,
      referenceNote: 'Integration-test locally verified interval.', active: true,
    }),
  });
  const created = await create.json();
  assert.equal(create.status, 201, JSON.stringify(created));
  assert.equal(created.test.code, 'TEST_FERRITIN');

  const invalidUpdate = await fetch(`${baseUrl}/api/lab-catalog/TEST_FERRITIN`, {
    method: 'PATCH', headers: mutationHeaders(admin), body: JSON.stringify({ referenceLow: 300, referenceHigh: 200 }),
  });
  assert.equal(invalidUpdate.status, 400);

  const catalog = await fetch(`${baseUrl}/api/lab-catalog`, { headers: { Cookie: admin.cookie } });
  const tests = (await catalog.json()).tests;
  assert.ok(tests.some(item => item.code === 'TEST_FERRITIN'));

  const deleteRes = await fetch(`${baseUrl}/api/lab-catalog/TEST_FERRITIN`, {
    method: 'DELETE', headers: mutationHeaders(admin),
  });
  assert.equal(deleteRes.status, 200);

  const catalogAfter = await fetch(`${baseUrl}/api/lab-catalog`, { headers: { Cookie: admin.cookie } });
  const testsAfter = (await catalogAfter.json()).tests;
  assert.ok(!testsAfter.some(item => item.code === 'TEST_FERRITIN'));

  const auditResponse = await fetch(`${baseUrl}/api/admin/audit`, { headers: { Cookie: admin.cookie } });
  assert.equal(auditResponse.status, 200);
  const events = (await auditResponse.json()).events;
  assert.ok(events.some(item => item.action === 'LAB_CATALOG_CREATED' && item.details?.code === 'TEST_FERRITIN'));
  assert.ok(events.some(item => item.action === 'LAB_CATALOG_DELETED' && item.details?.code === 'TEST_FERRITIN'));
});

test('laboratory and imaging roles receive patient identity/ward summary without full clinical record data', async () => {
  const lab = await login('lab');
  const patientKey = 'case:PARA-001';
  const response = await fetch(`${baseUrl}/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`, {
    headers: { Cookie: lab.cookie },
  });
  assert.equal(response.status, 200);
  const patient = (await response.json()).patient;
  assert.equal(patient.fullName, 'Patient Dara');
  assert.equal(patient.departmentCode, 'medicine');
  assert.equal(Object.hasOwn(patient, 'data'), false);
});

test('users can change their own password and must sign in again', async () => {
  const doctor = await login('doctor');
  const newPassword = 'Doctor changed password 2026!';
  const change = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: mutationHeaders(doctor),
    body: JSON.stringify({
      currentPassword: passwords.doctor,
      newPassword,
      confirmation: newPassword,
    }),
  });
  assert.equal(change.status, 200);
  assert.equal((await change.json()).reauthenticate, true);

  const expired = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: doctor.cookie } });
  assert.equal(expired.status, 401);

  const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor', password: passwords.doctor }),
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'doctor', password: newPassword }),
  });
  assert.equal(newLogin.status, 200);
  passwords.doctor = newPassword;
});


test('finance roles enforce billing, expense and director cash-flow boundaries', async () => {
  const admin = await login('admin');
  const patientKey = 'case:FIN-001';
  const save = await fetch(`${baseUrl}/api/patient-record`, {
    method:'PUT', headers:mutationHeaders(admin), body:JSON.stringify({
      patientKey,
      summary:{caseNumber:'FIN-001',healthId:'',firstName:'Finance',lastName:'Patient',fullName:'Patient Finance',sex:'',age:'30 ឆ្នាំ',dateOfBirth:'',phone:'',equityCard:'',paymentType:'',departmentCode:'medicine',departmentNameKh:'',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-09-15',dischargeDate:''},
      data:{},
    }),
  });
  assert.equal(save.status,200,await save.text());

  const clerk=await login('clerk');
  const services=await fetch(`${baseUrl}/api/finance/services`,{headers:{Cookie:clerk.cookie}});
  const serviceBody=await services.json();
  assert.equal(services.status,200,JSON.stringify(serviceBody));
  assert.ok(serviceBody.services.some(item=>item.code==='OPD_CONSULT'));
  const profile=await fetch(`${baseUrl}/api/finance/patient`,{method:'PATCH',headers:mutationHeaders(clerk),body:JSON.stringify({patientKey,paymentType:'DISCOUNT',discountPercent:20})});
  assert.equal(profile.status,400,await profile.text());
  const charge=await fetch(`${baseUrl}/api/finance/charges`,{method:'POST',headers:mutationHeaders(clerk),body:JSON.stringify({patientKey,description:'Hospital service',quantity:1,unitAmount:100000,currency:'KHR'})});
  assert.equal(charge.status,201,await charge.text());
  const clerkExpense=await fetch(`${baseUrl}/api/finance/expenses`,{method:'POST',headers:mutationHeaders(clerk),body:JSON.stringify({category:'Supplies',description:'Gloves',amount:10000,currency:'KHR'})});
  assert.equal(clerkExpense.status,403);
  const clerkDashboard=await fetch(`${baseUrl}/api/finance/cashflow?month=2026-09`,{headers:{Cookie:clerk.cookie}});
  assert.equal(clerkDashboard.status,403);
  const clerkDailyReport=await fetch(`${baseUrl}/api/reports/daily?date=2026-09-15`,{headers:{Cookie:clerk.cookie}});
  assert.equal(clerkDailyReport.status,200);

  const accountant=await login('accountant');
  const spendingPage=await fetch(`${baseUrl}/expenses`,{headers:{Cookie:accountant.cookie}});
  assert.equal(spendingPage.status,200,await spendingPage.text());
  const expense=await fetch(`${baseUrl}/api/finance/expenses`,{method:'POST',headers:mutationHeaders(accountant),body:JSON.stringify({category:'Supplies',description:'Gloves',amount:10000,currency:'KHR'})});
  assert.equal(expense.status,201,await expense.text());
  const accountantDashboard=await fetch(`${baseUrl}/api/finance/cashflow?month=2026-09`,{headers:{Cookie:accountant.cookie}});
  assert.equal(accountantDashboard.status,403);
  const accountantDailyReport=await fetch(`${baseUrl}/api/reports/daily?date=2026-09-15`,{headers:{Cookie:accountant.cookie}});
  assert.equal(accountantDailyReport.status,200);

  const nurse=await login('nurse');
  const nurseStatus=await fetch(`${baseUrl}/api/finance/payment-status?patientKey=${encodeURIComponent(patientKey)}`,{headers:{Cookie:nurse.cookie}});
  const nurseStatusBody=await nurseStatus.json();
  assert.equal(nurseStatus.status,200,JSON.stringify(nurseStatusBody));
  assert.equal(nurseStatusBody.status.code,'NOT_PAID');

  const director=await login('director');
  const dashboard=await fetch(`${baseUrl}/api/finance/cashflow?month=2026-09`,{headers:{Cookie:director.cookie}});
  assert.equal(dashboard.status,200,await dashboard.text());
  const directorDailyReport=await fetch(`${baseUrl}/api/reports/daily?date=2026-09-15`,{headers:{Cookie:director.cookie}});
  assert.equal(directorDailyReport.status,200,await directorDailyReport.text());

  const adminDailyReport=await fetch(`${baseUrl}/api/reports/daily?date=2026-09-15`,{headers:{Cookie:admin.cookie}});
  assert.equal(adminDailyReport.status,200,await adminDailyReport.text());
});


test('ward and paraclinic staff can exchange messages with attachments and read status', async () => {
  const nurse = await login('nurse');
  const sentResponse = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: mutationHeaders(nurse),
    body: JSON.stringify({ destinationType:'LAB', destinationCode:'lab', subject:'Specimen note', body:'Please check the attached specimen note.', patientKey:'case:PARA-001' }),
  });
  const sent = await sentResponse.json();
  assert.equal(sentResponse.status, 201, JSON.stringify(sent));

  const attachmentResponse = await fetch(`${baseUrl}/api/messages/${sent.message.id}/attachments`, {
    method:'POST', headers:mutationHeaders(nurse, 'text/plain'), body:'Sample note',
  });
  assert.equal(attachmentResponse.status, 201, JSON.stringify(await attachmentResponse.json().catch(() => ({}))));

  const lab = await login('lab');
  const inboxResponse = await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:lab.cookie } });
  assert.equal(inboxResponse.status, 200);
  const inbox = (await inboxResponse.json()).messages;
  const received = inbox.find(item => item.id === sent.message.id);
  assert.ok(received);
  assert.equal(received.readAt, null);
  assert.equal(received.attachments.length, 1);

  const readResponse = await fetch(`${baseUrl}/api/messages/${sent.message.id}/read`, {
    method:'POST', headers:mutationHeaders(lab, null),
  });
  assert.equal(readResponse.status, 200);
  assert.ok((await readResponse.json()).readAt);
});

test('patient history groups multiple OPD/IPD encounters by the same health card', async () => {
  const doctor = await login('doctor');
  const healthId = 'HC-HISTORY-001';
  for (const encounter of [
    { key:'case:HIST-001', caseNumber:'HIST-001', mode:'opd', date:'2026-08-12' },
    { key:'case:HIST-002', caseNumber:'HIST-002', mode:'ipd', date:'2026-09-10' },
  ]) {
    const response = await fetch(`${baseUrl}/api/patient-record`, {
      method:'PUT', headers:mutationHeaders(doctor), body:JSON.stringify({
        patientKey:encounter.key,
        summary:{ caseNumber:encounter.caseNumber, healthId, firstName:'Sok', lastName:'History', fullName:'History Sok', sex:'ប្រុស', age:'50 ឆ្នាំ', dateOfBirth:'', phone:'', equityCard:'', paymentType:'', departmentCode:'medicine', departmentNameKh:'ផ្នែកជំងឺទូទៅ', departmentNameEn:'Medicine', serviceMode:encounter.mode, entryDate:encounter.date, dischargeDate:'' },
        data:{ 'scope:medical:id:diag_input': encounter.mode === 'ipd' ? 'Pneumonia' : 'Follow-up' },
      }),
    });
    assert.equal(response.status, 200, JSON.stringify(await response.json().catch(() => ({}))));
  }
  const historyResponse = await fetch(`${baseUrl}/api/patient-history?patientKey=${encodeURIComponent('case:HIST-002')}`, { headers:{ Cookie:doctor.cookie } });
  assert.equal(historyResponse.status, 200);
  const history = (await historyResponse.json()).history;
  assert.equal(history.length, 2);
  assert.equal(history[0].caseNumber, 'HIST-002');
  assert.equal(history[1].caseNumber, 'HIST-001');
});


test('ward inboxes receive messages from any ward while admin stays limited to ward→admin messages', async () => {
  const medicine = await login('nurse');
  const pediatric = await login('pediatricnurse');
  const admin = await login('admin');

  const toPediatricResponse = await fetch(`${baseUrl}/api/messages`, {
    method:'POST', headers:mutationHeaders(medicine),
    body:JSON.stringify({ destinationType:'WARD', destinationCode:'pediatric', subject:'Transfer coordination', body:'Patient transfer information from Medicine.' }),
  });
  const toPediatric = await toPediatricResponse.json();
  assert.equal(toPediatricResponse.status, 201, JSON.stringify(toPediatric));

  const pediatricInboxResponse = await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:pediatric.cookie } });
  assert.equal(pediatricInboxResponse.status, 200);
  const pediatricInbox = (await pediatricInboxResponse.json()).messages;
  assert.ok(pediatricInbox.some(item => item.id === toPediatric.message.id));

  const medicineInboxResponse = await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:medicine.cookie } });
  assert.equal(medicineInboxResponse.status, 200);
  const medicineInbox = (await medicineInboxResponse.json()).messages;
  assert.ok(!medicineInbox.some(item => item.id === toPediatric.message.id));

  const toMedicineResponse = await fetch(`${baseUrl}/api/messages`, {
    method:'POST', headers:mutationHeaders(pediatric),
    body:JSON.stringify({ destinationType:'WARD', destinationCode:'medicine', subject:'Reply from Pediatric', body:'Information sent back to Medicine.' }),
  });
  const toMedicine = await toMedicineResponse.json();
  assert.equal(toMedicineResponse.status, 201, JSON.stringify(toMedicine));

  const medicineInbox2 = (await (await fetch(`${baseUrl}/api/messages?box=inbox&limit=50`, { headers:{ Cookie:medicine.cookie } })).json()).messages;
  assert.ok(medicineInbox2.some(item => item.id === toMedicine.message.id));
  assert.ok(!medicineInbox2.some(item => item.id === toPediatric.message.id));

  const adminInboxResponse = await fetch(`${baseUrl}/api/messages?box=inbox&limit=100`, { headers:{ Cookie:admin.cookie } });
  assert.equal(adminInboxResponse.status, 200);
  const adminInbox = (await adminInboxResponse.json()).messages;
  assert.ok(!adminInbox.some(item => item.id === toPediatric.message.id));
  assert.ok(!adminInbox.some(item => item.id === toMedicine.message.id));
});

test('PMRS2 preview is limited to authorized clinical users and their ward', async () => {
  const doctor = await login('doctor');
  const key = 'case:PMRS2-PREVIEW-001';
  const savedResponse = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(doctor),
    body: JSON.stringify({
      patientKey: key,
      summary: {
        caseNumber: 'PMRS2-PREVIEW-001', healthId: 'HC-PMRS2-001',
        firstName: 'Sample', lastName: 'Patient', fullName: 'Patient Sample',
        sex: 'ស្រី', age: '30 ឆ្នាំ', dateOfBirth: '', phone: '', equityCard: '', paymentType: '',
        departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
        serviceMode: 'ipd', entryDate: '2026-09-16', dischargeDate: '',
      },
      data: {
        'scope:medical:id:emr_pmrs_case_new': true,
        'scope:medical:id:emr_pmrs_case_old': false,
        'scope:registration:id:web_time': '07:30',
        'scope:triage:id:pmrs_chief_complaint': 'fever',
        'scope:triage:id:p2_temp': '37',
        'scope:triage:id:p2_bp_sys': '120',
        'scope:triage:id:p2_bp_dia': '80',
        'scope:triage:id:p2_pulse': '80',
        'scope:triage:id:p2_resp': '20',
        'scope:triage:id:p2_spo2': '98',
        'scope:medical:id:emr_pmrs_ipd_diagnosis': 'Dengue fever',
        'scope:medical:id:emr_pmrs_ipd_icd10': 'A90',
      },
    }),
  });
  const saved = await savedResponse.json();
  assert.equal(savedResponse.status, 200, JSON.stringify(saved));
  const initialMedication = JSON.stringify([
    { name: 'Sample medicine', unit: 'គ្រាប់', route: 'po', scheduleType: 'bid', doseAmount: '2', m: '2', a: '0', e: '2', n: '0' },
  ]);
  const updateResponse = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(doctor),
    body: JSON.stringify({ patientKey: key, summary: { ...saved.patient, dischargeDate: '' }, data: {
      ...saved.patient.data,
      'scope:medical:id:ipd_history_present_illness': 'Fever for two days',
      'system:initialIpdMedications': initialMedication,
    } }),
  });
  assert.equal(updateResponse.status, 200, JSON.stringify(await updateResponse.json()));
  const url = `${baseUrl}/api/pmrs2/preview?patientKey=${encodeURIComponent(key)}`;
  assert.equal((await fetch(url)).status, 401);
  const lab = await login('lab');
  assert.equal((await fetch(url, { headers: { Cookie: lab.cookie } })).status, 403);
  const otherWard = await login('pediatricnurse');
  assert.equal((await fetch(url, { headers: { Cookie: otherWard.cookie } })).status, 403);
  const previewResponse = await fetch(url, { headers: { Cookie: doctor.cookie } });
  assert.equal(previewResponse.status, 200);
  const { preview } = await previewResponse.json();
  assert.equal(preview.receivingWard, 'ផ្នែកសម្រាកពេទ្យ');
  assert.equal(preview.caseType, 'ករណីថ្មី');
  assert.equal(preview.diagnosisIcd10, 'A90');
  assert.equal(preview.fieldsComplete, true);
  assert.equal(preview.followUps[0].dateTime, '2026-09-16T07:30');
  assert.equal(preview.followUps[0].medications[0].morning, '2');
  assert.equal(preview.followUps[0].medications[0].evening, '2');
});

test('saved OPD treatment and a doctor-edited IPD discharge appear in PMRS2 review', async () => {
  const doctor = await login('doctor');
  const summary = (code, mode) => ({
    caseNumber: code, healthId: `HC-${code}`, firstName: 'Sample', lastName: 'Patient',
    fullName: 'Patient Sample', sex: 'ស្រី', age: '30 ឆ្នាំ', dateOfBirth: '', phone: '',
    equityCard: '', paymentType: '', departmentCode: 'medicine',
    departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine',
    serviceMode: mode, entryDate: '2026-09-17', dischargeDate: '',
  });
  const opdKey = 'case:PMRS2-OPD-RX-001';
  const opdResponse = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(doctor),
    body: JSON.stringify({ patientKey: opdKey, summary: summary('PMRS2-OPD-RX-001', 'opd'), data: {
      'system:opdMedications': JSON.stringify([{ name: 'Outpatient tablet', route: 'po',
        unit: 'គ្រាប់', scheduleType: 'bid', doseAmount: '2', m: '2', a: '0', e: '2', n: '0' }]),
    } }),
  });
  assert.equal(opdResponse.status, 200, JSON.stringify(await opdResponse.json()));
  const opdPreviewResponse = await fetch(`${baseUrl}/api/pmrs2/preview?patientKey=${encodeURIComponent(opdKey)}`,
    { headers: { Cookie: doctor.cookie } });
  const opd = (await opdPreviewResponse.json()).preview;
  assert.equal(opdPreviewResponse.status, 200);
  assert.equal(opd.followUps.length, 0);
  assert.equal(opd.discharge, null);
  assert.equal(opd.prescription.medications[0].name, 'Outpatient tablet');
  assert.deepEqual(['morning', 'afternoon', 'evening', 'night'].map(key => opd.prescription.medications[0][key]),
    ['2', '0', '2', '0']);

  const ipdKey = 'case:PMRS2-IPD-DC-001';
  const ipdSave = await fetch(`${baseUrl}/api/patient-record`, {
    method: 'PUT', headers: mutationHeaders(doctor),
    body: JSON.stringify({ patientKey: ipdKey, summary: summary('PMRS2-IPD-DC-001', 'ipd'), data: {
      'scope:registration:id:web_time': '09:00',
      'scope:medical:id:emr_pmrs_ipd_diagnosis': 'Diagnosis',
      'scope:medical:id:emr_pmrs_ipd_icd10': 'A90',
      'system:dailyMonitoringRecords': JSON.stringify([
        { dtVal: '2026-09-18T09:00', temp: '37', bp_sys: '120', bp_dia: '80',
          pulse: '75', resp: '17', spo2: '99', evol: 'Recovering', conclusion: 'Diagnosis', medications: [
            { name: 'Last inpatient medicine', route: 'antibiotic_iv', unit: 'អំពូល',
              scheduleType: 'tid', doseAmount: '1' },
          ] },
      ]),
    } }),
  });
  assert.equal(ipdSave.status, 200, JSON.stringify(await ipdSave.json()));
  const dischargeResponse = await fetch(`${baseUrl}/api/patient-admission`, {
    method: 'PATCH', headers: mutationHeaders(doctor), body: JSON.stringify({
      patientKey: ipdKey, action: 'discharge', dischargeDate: '2026-09-19',
      dischargeDepartment: 'ផ្នែកជំងឺទូទៅ', admissionAt: '2026-09-17T09:00',
      admissionDiagnosis: 'Diagnosis', admissionIcd10: 'A90',
      dischargeAt: '2026-09-19T10:30', dischargeDiagnosis: 'Dengue recovery',
      dischargeIcd10: 'A90', outcome: 'improved', status: 'ordered',
      medications: [{ name: 'Edited take-home tablet', route: 'po', unit: 'គ្រាប់',
        scheduleType: 'qid', doseAmount: '1', m: '1', a: '1', e: '1', n: '1', d: '3' }],
    }),
  });
  const dischargeResult = await dischargeResponse.json();
  assert.equal(dischargeResponse.status, 200, JSON.stringify(dischargeResult));
  assert.equal(dischargeResult.patient.discharge.medications[0].name, 'Edited take-home tablet');
  const ipdPreviewResponse = await fetch(`${baseUrl}/api/pmrs2/preview?patientKey=${encodeURIComponent(ipdKey)}`,
    { headers: { Cookie: doctor.cookie } });
  assert.equal(ipdPreviewResponse.status, 200);
  const ipd = (await ipdPreviewResponse.json()).preview;
  assert.equal(ipd.followUps.find(record => record.source === 'daily').medications[0].name, 'Last inpatient medicine');
  assert.equal(ipd.prescription.medications[0].name, 'Edited take-home tablet');
  assert.equal(ipd.prescription.medications[0].night, '1');
  assert.equal(ipd.discharge.dischargeWard, 'ផ្នែកសម្រាកពេទ្យ');
  assert.equal(ipd.discharge.dischargeAt, '2026-09-19T10:30');

  const exportUrl = `${baseUrl}/api/pmrs2/prepare-export`;
  const confirmed = { patientKey: ipdKey, reviewedVersion: dischargeResult.patient.version,
    confirmedIdentifier: 'HC-PMRS2-IPD-DC-001', reviewed: true };
  assert.equal((await fetch(exportUrl, { method: 'POST', headers: mutationHeaders(await login('lab')),
    body: JSON.stringify(confirmed) })).status, 403);
  assert.equal((await fetch(exportUrl, { method: 'POST', headers: mutationHeaders(await login('nurse')),
    body: JSON.stringify(confirmed) })).status, 403);
  assert.equal((await fetch(exportUrl, { method: 'POST', headers: mutationHeaders(doctor),
    body: JSON.stringify({ ...confirmed, reviewedVersion: confirmed.reviewedVersion - 1 }) })).status, 409);
  assert.equal((await fetch(exportUrl, { method: 'POST', headers: mutationHeaders(doctor),
    body: JSON.stringify({ ...confirmed, confirmedIdentifier: 'WRONG-PATIENT' }) })).status, 400);
  assert.equal((await fetch(exportUrl, { method: 'POST', headers: mutationHeaders(doctor),
    body: JSON.stringify({ ...confirmed, reviewed: false }) })).status, 400);
  const exportResponse = await fetch(exportUrl, {
    method: 'POST', headers: mutationHeaders(doctor), body: JSON.stringify(confirmed),
  });
  assert.equal(exportResponse.status, 200);
  assert.equal(exportResponse.headers.get('cache-control'), 'no-store');
  const exported = await exportResponse.json();
  assert.match(exported.checksum, /^[0-9a-f]{64}$/);
  assert.equal(exported.transferPackage.source.patientVersion, dischargeResult.patient.version);
  assert.equal(exported.transferPackage.identity.healthId, 'HC-PMRS2-IPD-DC-001');
  assert.equal(exported.transferPackage.followUps.find(record => record.source === 'daily').medications[0].name,
    'Last inpatient medicine');
  assert.equal(exported.transferPackage.prescription.medications[0].name, 'Edited take-home tablet');
  assert.equal(exported.transferPackage.discharge.dischargeIcd10, 'A90');
});

 test('authenticated print preview is blank and script-free, with all local print assets available',async()=>{
  const unsigned=await fetch(`${baseUrl}/print-preview`,{redirect:'manual'});assert.equal(unsigned.status,302);
  for(const username of ['lab','imaging','nurse','doctor','clerk','director']){
    const session=await login(username);const response=await fetch(`${baseUrl}/print-preview`,{headers:{Cookie:session.cookie}});
    assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'self'/);
    const html=await response.text();assert.doesNotMatch(html,/<script|emr-language|patient/i);
  }
  for(const asset of ['report-print.js','report-print.css','responsive-layout.css','editor-history.css','fonts/Moul-Khmer.woff2','fonts/Moul-Latin.woff2']){
    const response=await fetch(`${baseUrl}/public/${asset}`);assert.equal(response.status,200,asset);
  }
});
