import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { setFinanceProfile } from '../server/finance.mjs';

test('v15.0 adds a two-column Pharmacy dispensing board and audits IPD discharge medicine handoff',async()=>{
  const origin='http://127.0.0.1:32350';
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32350,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(32350,'127.0.0.1',resolve));
  try{
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200,username);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'X-CSRF-Token':me.csrfToken,'Content-Type':'application/json'};
    };
    const pharmacy=await login('pharmacy');
    const key='case:IPD-DISCHARGE-PHARMACY';
    const user=app.database.findUser('pharmacy');
    const dischargeAt='2026-09-29T10:30';
    const now=Date.now();
    app.database.sqlite.prepare(`INSERT INTO patient_records
      (id,patient_key,case_number,health_id,first_name,last_name,full_name,sex,age,entry_date,discharge_date,service_mode,department_code,department_name_kh,record_json,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('ipd-pharmacy-v150',key,'IPD-150','H-150','Test','Discharged','Test Discharged','ប្រុស','40','2026-09-25','2026-09-29','ipd','medicine','ផ្នែកជំងឺទូទៅ',JSON.stringify({'system:admissionStatus':'discharged','system:registrationQueueNumber':21,'system:discharge':{dischargeAt,medications:[{name:'Amoxicillin',doseAmount:'1',unit:'គ្រាប់',d:'5'}]}}),user.id,user.id,now,now);
    // Legacy saved exemptions still permit discharge dispensing; new ones require approval.
    app.database.sqlite.prepare("INSERT INTO patient_finance_profiles (patient_key,payment_type,payment_subtype,updated_by,created_at,updated_at) VALUES (?,'DIRECT','FULL_WAIVER',?,?,?)").run(key,user.id,now,now);

    assert.equal((await fetch(origin+'/pharmacy/display',{headers:pharmacy})).status,200);
    assert.equal((await fetch(origin+'/pharmacy/display',{headers:await login('doctor_opd')})).status,403);
    const list=await(await fetch(origin+'/api/pharmacy/discharge-medications',{headers:pharmacy})).json();
    assert.equal(list.patients.length,1);
    assert.equal(list.patients[0].medicineCount,1);
    assert.equal(list.patients[0].canDispense,true);
    const board=await(await fetch(origin+'/api/pharmacy/dispensing-board',{headers:pharmacy})).json();
    assert.equal(board.ipd.length,1);
    assert.equal(board.ipd[0].fullName,'Test Discharged');

    const handoff=await fetch(origin+'/api/pharmacy/discharge-medications/received',{method:'POST',headers:pharmacy,body:JSON.stringify({patientKey:key,dischargeAt})});
    assert.equal(handoff.status,200,await handoff.text());
    const after=await(await fetch(origin+'/api/pharmacy/discharge-medications',{headers:pharmacy})).json();
    assert.ok(after.patients[0].dispensedAt);
    assert.equal(after.patients[0].dispensedByName,user.display_name);
    assert.equal(await(await fetch(origin+'/api/pharmacy/dispensing-board',{headers:pharmacy})).json().then(data=>data.ipd.length),0);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});

test('TV queue entry points use the short Khmer check-number name and Pharmacy has two patient groups',async()=>{
  const {readFileSync}=await import('node:fs');
  const {join}=await import('node:path');
  const {projectRoot}=await import('../server/config.mjs');
  const read=file=>readFileSync(join(projectRoot,file),'utf8');
  const session=read('public/emr-session.js');
  const queue=read('public/queue-display.js');
  const opd=read('protected/opd-queue.html');
  const pharmacy=read('protected/pharmacy-opd.html');
  const screen=read('protected/pharmacy-display.html');
  assert.match(session,/queue-display\?service=TRIAGE','បើកផ្ទាំងលេខរៀង/);
  assert.match(session,/queue-display\?service=OPD','បើកផ្ទាំងលេខរៀង/);
  assert.match(queue,/title:'ពិនិត្យលេខរៀង'/);
  assert.match(pharmacy,/href="\/pharmacy\/display"[^>]*>បើកផ្ទាំងលេខរៀង/);
  assert.match(pharmacy,/id="pharmacy-opd-count"/);
  assert.match(pharmacy,/id="pharmacy-ipd-count"/);
  assert.match(screen,/id="opd-dispensing-rows"/);
  assert.match(screen,/id="ipd-dispensing-rows"/);
  assert.match(opd,/\.opd-heading\+#emr-main-nav\{display:none!important\}/);
});
