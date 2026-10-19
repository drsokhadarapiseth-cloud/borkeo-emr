import crypto from 'node:crypto';

function text(value,max=300,required=false,label='Field'){
  const result=String(value??'').trim();
  if(required&&!result)throw new Error(`${label} is required.`);
  if(result.length>max||/[\u0000-\u001f\u007f]/.test(result))throw new Error(`${label} is invalid.`);
  return result;
}

export function ensureAppointmentSchema(database){
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS patient_appointments (
    id TEXT PRIMARY KEY, patient_key TEXT NOT NULL DEFAULT '', patient_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '', appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL DEFAULT '',
    department_code TEXT NOT NULL DEFAULT 'opd', reason TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','CALLED','ARRIVED','CANCELLED')),
    created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL REFERENCES users(id), updated_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS patient_appointments_date_idx ON patient_appointments(appointment_date,status,appointment_time);`);
}

function fromRow(row){return row?{id:row.id,patientKey:row.patient_key,patientName:row.patient_name,phone:row.phone,
  appointmentDate:row.appointment_date,appointmentTime:row.appointment_time,departmentCode:row.department_code,
  reason:row.reason,note:row.note,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at}:null;}

export function appointmentWindow(now=Date.now()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  const year=Number(parts.year),month=Number(parts.month)-1,day=Number(parts.day);
  const limit=new Date(Date.UTC(year,month,0));
  const start=new Date(Date.UTC(year,month-1,Math.min(day,limit.getUTCDate()))).toISOString().slice(0,10);
  return {startDate:start,endDate:`${parts.year}-${parts.month}-${parts.day}`};
}

export function listAppointments(database,startDate,endDate,rolling=false){
  const window=appointmentWindow();
  const requestedStart=String(startDate||'').trim(),requestedEnd=String(endDate||'').trim();
  const start=rolling?(!requestedStart||requestedStart<window.startDate?window.startDate:requestedStart):requestedStart;
  const end=rolling?(requestedEnd||window.endDate):requestedEnd;
  let query = 'SELECT * FROM patient_appointments ';
  const params = [];
  if (start && end) {
    query += 'WHERE appointment_date >= ? AND appointment_date <= ? ORDER BY appointment_date DESC, appointment_time DESC';
    params.push(start, end);
  } else if (start) {
    query += 'WHERE appointment_date = ? ORDER BY appointment_time DESC, created_at DESC';
    params.push(start);
  } else {
    query += 'WHERE status IN (\'SCHEDULED\',\'CALLED\') ORDER BY appointment_date, appointment_time LIMIT 300';
  }
  return database.sqlite.prepare(query).all(...params).map(fromRow);
}

export function createAppointment(database,values,actorId,now=Date.now()){
  const date=text(values?.appointmentDate,10,true,'Appointment date');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Appointment date is invalid.');
  const time=text(values?.appointmentTime,5,false,'Appointment time');
  if(time&&!/^\d{2}:\d{2}$/.test(time))throw new Error('Appointment time is invalid.');
  const id=crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO patient_appointments
    (id,patient_key,patient_name,phone,appointment_date,appointment_time,department_code,reason,note,status,created_by,created_at,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,'SCHEDULED',?,?,?,?)`).run(id,text(values?.patientKey,180),text(values?.patientName,180,true,'Patient name'),
    text(values?.phone,80),date,time,text(values?.departmentCode||'opd',80),text(values?.reason,300),text(values?.note,1000),actorId,now,actorId,now);
  return fromRow(database.sqlite.prepare('SELECT * FROM patient_appointments WHERE id=?').get(id));
}

export function updateAppointmentStatus(database,id,status,actorId,now=Date.now()){
  const value=String(status||'').toUpperCase();
  if(!['SCHEDULED','CALLED','ARRIVED','CANCELLED'].includes(value))throw new Error('Appointment status is invalid.');
  const info=database.sqlite.prepare('UPDATE patient_appointments SET status=?,updated_by=?,updated_at=? WHERE id=?').run(value,actorId,now,id);
  if(!info.changes)return null;
  return fromRow(database.sqlite.prepare('SELECT * FROM patient_appointments WHERE id=?').get(id));
}
