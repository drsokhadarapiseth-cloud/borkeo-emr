import crypto from 'node:crypto';

export function ensureEditorHistorySchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS patient_editor_history (
    id TEXT PRIMARY KEY,
    patient_key TEXT NOT NULL,
    scope TEXT NOT NULL CHECK(scope IN ('medical','nursing')),
    day TEXT NOT NULL,
    editor_id TEXT NOT NULL,
    editor_name TEXT NOT NULL,
    editor_role TEXT NOT NULL,
    saved_at INTEGER NOT NULL,
    notes_json TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS patient_editor_history_lookup ON patient_editor_history(patient_key,scope,day,saved_at);`);
}

export function normalizedEditorDay(raw, savedAt) {
  const fallback = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Phnom_Penh', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(savedAt));
  const value = String(raw || '').trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
  const day = iso ? iso[1] : local ? `${local[3]}-${local[2].padStart(2,'0')}-${local[1].padStart(2,'0')}` : fallback;
  return !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? day : fallback;
}

export function saveEditorHistory(database, { patientKey, role, editorScope, userId, editorName, savedAt, existingData, data, nursingDays, nursingLabels }) {
  const scope = role === 'DOCTOR' || (['ADMIN','VICE_DIRECTOR'].includes(role) && editorScope === 'medical') ? 'medical' :
    ['NURSE','MIDWIFE'].includes(role) || (['ADMIN','VICE_DIRECTOR'].includes(role) && editorScope === 'nursing') ? 'nursing' : '';
  if (!scope) return;
  const defaultDay = normalizedEditorDay('', savedAt);
  const changesByDay = new Map();
  if (scope === 'nursing') {
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith('scope:nursing:') || value === existingData[key] || typeof value !== 'string') continue;
      const day = normalizedEditorDay(nursingDays?.[key], savedAt);
      if (!changesByDay.has(day)) changesByDay.set(day, []);
      if (changesByDay.get(day).length < 150) changesByDay.get(day).push({ field:key,
        label:typeof nursingLabels?.[key] === 'string' ? nursingLabels[key].slice(0,100) : 'កំណត់ត្រាថែទាំ', text:value.slice(0,4000) });
    }
  }
  if (scope === 'medical') {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string' || value === existingData?.[key] || key.startsWith('system:signature') || key.startsWith('system:lock') || key.startsWith('system:workflowStage')) continue;
      if (!changesByDay.has(defaultDay)) changesByDay.set(defaultDay, []);
      if (changesByDay.get(defaultDay).length < 150) {
        changesByDay.get(defaultDay).push({ field: key, label: key, text: value.slice(0, 4000) });
      }
    }
  }
  if (!changesByDay.size) changesByDay.set(defaultDay, []);
  const insert = database.sqlite.prepare(`INSERT INTO patient_editor_history
    (id,patient_key,scope,day,editor_id,editor_name,editor_role,saved_at,notes_json) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const [day, notes] of changesByDay) insert.run(crypto.randomUUID(),patientKey,scope,day,userId,editorName,role,savedAt,JSON.stringify(notes));
}

// Server-computed differences: never trust browser-supplied audit descriptions.
export function patientRecordChangeNotes(before, after) {
  const notes=[];
  const fields={case_number:'លេខករណី / Case number',health_id:'លេខអ្នកជំងឺ / Patient ID',first_name:'នាម / First name',last_name:'នាមត្រកូល / Last name',full_name:'ឈ្មោះ / Full name',sex:'ភេទ / Sex',age:'អាយុ / Age',date_of_birth:'ថ្ងៃកំណើត / Date of birth',phone:'ទូរស័ព្ទ / Phone',equity_card:'ប័ណ្ណសមធម៌ / Equity card',payment_type:'ប្រភេទបង់ប្រាក់ / Payment type',department_code:'ផ្នែក / Department',service_mode:'ប្រភេទសេវា / Service mode',entry_date:'ថ្ងៃចូល / Entry date',discharge_date:'ថ្ងៃចេញ / Discharge date'};
  const display=(value,key)=>{
    if (/photo/i.test(key)) return value ? '[Patient photo present]' : '[No patient photo]';
    const text=value==null?'':typeof value==='string'?value:JSON.stringify(value);
    return text.length>1000?text.slice(0,1000)+' [truncated]':text;
  };
  const add=(field,label,oldValue,newValue)=>{
    if (JSON.stringify(oldValue??'')===JSON.stringify(newValue??'')) return;
    notes.push({field,label,before:display(oldValue,field),after:display(newValue,field),text:display(newValue,field)});
  };
  for (const [key,label] of Object.entries(fields)) add('summary:'+key,label,before?.[key],after?.[key]);
  let oldData={},newData={};
  try {oldData=JSON.parse(before?.record_json||'{}')} catch {}
  try {newData=JSON.parse(after?.record_json||'{}')} catch {}
  for (const key of new Set([...Object.keys(oldData),...Object.keys(newData)])) {
    if (/^system:(signature|lock)/.test(key)) continue;
    if (!/^scope:|^system:(dailyMonitoringRecords|initialIpdMedications|opdMedications|medicalRecordCompleted|patientPhoto)$/.test(key)) continue;
    add(key,key,oldData[key],newData[key]);
  }
  return notes;
}

export function listEditorHistory(database, patientKey, {includeFieldChanges=false} = {}) {
  const recorded=database.sqlite.prepare(`SELECT id,scope,day,editor_name,editor_role,saved_at,notes_json
    FROM patient_editor_history WHERE patient_key=? ORDER BY saved_at DESC,id DESC LIMIT 2000`).all(patientKey).reverse().map(row => ({
    id:row.id,scope:row.scope,day:row.day,editorName:row.editor_name,role:row.editor_role,
    savedAt:row.saved_at,notes:JSON.parse(row.notes_json),
  }));
  // v11.03 did not label administrator saves with a form section. Surface their
  // authenticated audit trail as an explicitly unclassified earlier edit.
  const legacy=database.sqlite.prepare(`SELECT a.id,a.occurred_at,u.display_name,a.subject_username
    FROM audit_events a LEFT JOIN users u ON u.id=a.user_id
    WHERE a.action='PATIENT_RECORD_SAVED'
      AND json_extract(a.details_json,'$.patientKey')=?
      AND json_extract(a.details_json,'$.activeRole')='ADMIN'
      AND json_extract(a.details_json,'$.editorScope') IS NULL
    ORDER BY a.occurred_at DESC LIMIT 100`).all(patientKey).map(row=>({
      id:row.id,scope:'legacy',day:normalizedEditorDay('',row.occurred_at),
      editorName:row.display_name || row.subject_username || 'admin',role:'ADMIN',
      savedAt:row.occurred_at,notes:[],
    }));
  const audits = database.sqlite.prepare(`SELECT a.id, a.action, a.occurred_at, a.details_json,
    u.display_name, u.username, a.subject_username
    FROM audit_events a LEFT JOIN users u ON u.id = a.user_id
    WHERE json_extract(a.details_json, '$.patientKey') = ?
       OR a.subject_username = ?
    ORDER BY a.occurred_at DESC LIMIT 100`).all(patientKey, patientKey).map(row => {
      let details = {};
      try { details = JSON.parse(row.details_json || '{}'); } catch {}
      const actionMap = {
        'PATIENT_RECORD_SAVED': 'រក្សាទុកកំណត់ត្រាវេជ្ជសាស្ត្រ (Saved clinical record)',
        'PATIENT_UPDATED': 'កែប្រែព័ត៌មានអ្នកជំងឺ (Updated patient registration)',
        'PATIENT_REGISTERED': 'ចុះឈ្មោះអ្នកជំងឺ (Registered patient)',
        'TRIAGE_ASSESSMENT_SAVED': 'រក្សាទុកការត្រួតពិនិត្យ Triage (Saved triage assessment)',
        'FINANCE_PAYMENT_COMPLETED': 'បានបង់ប្រាក់វិក្កយបត្រ (Payment completed)',
        'FINANCE_PAYMENT_RECEIVED': 'ទទួលការបង់ប្រាក់ (Payment received)',
        'FINANCE_CHARGE_ADDED': 'បន្ថែមថ្លៃសេវា (Added fee/charge)',
        'STAFF_INVOICE_CREATED': 'បង្កើតវិក្កយបត្រ (Created invoice)',
        'WORKFLOW_REQUEST_UPDATED': 'ធ្វើបច្ចុប្បន្នភាពសំណើ (Workflow request updated)'
      };
      return {
        id: row.id,
        scope: 'audit',
        day: normalizedEditorDay('', row.occurred_at),
        editorName: row.display_name || row.username || row.subject_username || 'បុគ្គលិក (Staff)',
        role: details.activeRole || 'STAFF',
        savedAt: row.occurred_at,
        notes: [{ field: row.action, label: 'សកម្មភាព (Action)', text: actionMap[row.action] || row.action },
          ...(includeFieldChanges && Array.isArray(details.changedFields) ? details.changedFields : [])]
      };
    });
  const seen = new Set();
  const all = [...recorded, ...legacy, ...audits].filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return all.sort((a,b)=>a.savedAt-b.savedAt || a.id.localeCompare(b.id));
}
