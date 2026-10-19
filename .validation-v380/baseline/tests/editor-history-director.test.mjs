import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess, WARDS, ROLES } from '../server/access.mjs';
import { renderMedicineSheets } from '../public/ward-medicine-table.js';

test('demo admin can switch wards, director can review without editing, and revisions retain both staff names and nursing notes', async () => {
  const origin = 'http://127.0.0.1:32242';
  const app = createEmrServer({ demoMode:true, databasePath:':memory:', autoDatabase:false,
    host:'127.0.0.1', port:32242, appOrigin:origin, nodeEnv:'test' });
  for (const [username, role] of [['doctor_second','DOCTOR'],['nurse_second','NURSE']]) {
    const id = crypto.randomUUID();
    app.database.createUser({ id, username, displayName:username, role,
      passwordHash:'demo-disabled', createdAt:Date.now() });
    setUserAccess(app.database,id,[role],['medicine']);
  }
  await new Promise(resolve => app.server.listen(32242,'127.0.0.1',resolve));
  try {
    const login = async username => {
      const result = await fetch(`${origin}/api/auth/login`, { method:'POST',
        headers:{ Origin:origin,'Content-Type':'application/json' }, body:JSON.stringify({ username }) });
      assert.equal(result.status,200,username);
      const Cookie = result.headers.get('set-cookie').split(';')[0];
      const identity = await (await fetch(`${origin}/api/auth/me`, { headers:{ Cookie } })).json();
      return { Cookie, Origin:origin, 'X-CSRF-Token':identity.csrfToken,
        'Content-Type':'application/json', identity };
    };
    const admin=await login('admin');
    assert.equal(admin.identity.user.activeRole,'ADMIN');
    assert.deepEqual(new Set(admin.identity.user.roles),new Set(ROLES));
    assert.equal(admin.identity.user.contexts.filter(context=>context.role==='DOCTOR').length,WARDS.length);
    const switchContext=await fetch(`${origin}/api/auth/context`, {method:'POST',headers:admin,
      body:JSON.stringify({role:'NURSE',wardCode:'medicine'})});
    assert.equal(switchContext.status,200);
    assert.equal((await switchContext.json()).user.activeRole,'NURSE');

    const director=await login('director');
    for (const page of ['/emr','/patient-list','/departments','/lab','/imaging','/billing','/expenses','/admin/users']) {
      assert.equal((await fetch(origin+page,{headers:director})).status,200,page);
    }
    assert.equal((await fetch(`${origin}/api/admin/users`,{headers:director})).status,200);
    assert.equal((await fetch(`${origin}/api/admin/users`,{method:'POST',headers:director,
      body:JSON.stringify({username:'not-allowed'})})).status,403);

    const doctors=[await login('doctor_medicine'),await login('doctor_second')];
    const nurses=[await login('nurse_medicine'),await login('nurse_second')];
    const patientKey='case:EDITOR-TEST';
    const summary={caseNumber:'EDITOR-TEST',firstName:'History',lastName:'Patient',fullName:'History Patient',
      sex:'ប្រុស',age:'39',departmentCode:'medicine',departmentNameKh:'ផ្នែកជំងឺទូទៅ',
      departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-09-17'};
    let version;
    const save=async(headers,data,extra={})=>{
      const response=await fetch(`${origin}/api/patient-record`,{method:'PUT',headers,
        body:JSON.stringify({patientKey,summary,data,expectedVersion:version,...extra})});
      const payload=await response.json();
      assert.equal(response.status,200,JSON.stringify(payload));
      version=payload.patient.version;
      return payload.patient;
    };
    await save(doctors[0],{'scope:medical:id:ipd_history':'First doctor assessment'});
    await save(doctors[1],{'scope:medical:id:ipd_history':'Second doctor assessment'});
    const note='scope:nursing:id:progress-note';
    const extra={nursingDays:{[note]:'17/09/2026 at 08:00'},nursingLabels:{[note]:'ការវិវត្តន៍'}};
    await save(nurses[0],{[note]:'First daily nursing note'},extra);
    const record=await save(nurses[1],{[note]:'Later daily nursing note'},extra);
    assert.equal(record.data[note],'Later daily nursing note');
    assert.equal(JSON.parse(record.data['system:signature:medical']).signerName,'doctor_second');
    const response=await fetch(`${origin}/api/patient-editor-history?patientKey=${encodeURIComponent(patientKey)}`,
      {headers:director});
    assert.equal(response.status,200);
    const history=(await response.json()).entries;
    assert.deepEqual(history.filter(entry=>entry.scope==='medical').map(entry=>entry.editorName),
      [doctors[0].identity.user.displayName,doctors[1].identity.user.displayName]);
    const nursing=history.filter(entry=>entry.scope==='nursing');
    assert.deepEqual(nursing.map(entry=>entry.day),['2026-09-17','2026-09-17']);
    assert.deepEqual(nursing.map(entry=>entry.notes[0].text),['First daily nursing note','Later daily nursing note']);
    assert.equal(nursing.at(-1).editorName,nurses[1].identity.user.displayName);

    const stale=await fetch(`${origin}/api/patient-record`,{method:'PUT',headers:doctors[0],body:JSON.stringify({
      patientKey,summary,data:{'scope:medical:id:ipd_history':'Stale overwrite'},expectedVersion:1})});
    assert.equal(stale.status,409);
  } finally {
    await new Promise(resolve=>app.server.close(resolve));
    app.database.close();
  }
});

test('ward sheet widens the name cell and moves excess drug columns to another page', () => {
  const columns=Array.from({length:25},(_,i)=>({label:`Drug ${i+1}`,unit:'tablet'}));
  const cells=columns.map(()=>({quantity:1,incomplete:false}));
  const base={date:'2026-09-17',wardNameKh:'Medicine',matrix:{columns,rows:[{fullName:'Short',cells}],totals:cells,patientCount:1,unresolvedCount:0}};
  const short=renderMedicineSheets(base);
  const long=renderMedicineSheets({...base,matrix:{...base.matrix,rows:[{fullName:'A very long patient name that must stay completely inside the patient name box',cells}]}});
  const width=html=>Number(/<col data-column-width="4"><col data-column-width="([\d.]+)">/.exec(html)?.[1]);
  assert.ok(width(long)>width(short));
  assert.match(long, /class="patient-name"/);
  assert.doesNotMatch(long, /class="patient-name" style="font-size:/);
  assert.ok((long.match(/class="report-sheet"/g)||[]).length>1);
  assert.ok((long.match(/class="vertical drug-heading"/g)||[]).length>=25);
  for (const column of columns) assert.ok(long.includes(column.label));
});
