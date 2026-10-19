import {USER_ROLES} from './database.mjs';
  function allowedLinks(user) {
    const role = user.activeRole;
    if (role === 'REGISTRATION') return [['/emr', 'ចុះឈ្មោះ'], ['/patient-list', 'បញ្ជីអ្នកជំងឺ'], ['/patient-list?view=appointments', 'បញ្ជីអ្នកជំងឺណាត់ជួប']];
    if (role === 'TRIAGE') return [['/triage', 'បញ្ជីរង់ចាំទ្រីយ៉ា'], ['/queue-display?service=TRIAGE','បើកផ្ទាំងលេខរៀង'], ['/patient-list', 'បញ្ជីអ្នកជំងឺ']];
    // Ward nursing work starts from the department map: choose the waiting
    // admission, assign a bed, then open its Nursing Process from that bed.
    if (['NURSE','MIDWIFE'].includes(role)) return [
      ['/departments','គ្រប់គ្រងផ្នែក និងគ្រែ'], ['/ward-medicines','បញ្ជីឱសថប្រចាំថ្ងៃ'], ['/patient-list','បញ្ជីអ្នកជំងឺ'],
    ];
    const links = [];
    if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))links.push(['/requests','ការស្នើរសុំ']);
    if (!['LAB','IMAGING','CLERK','ACCOUNTANT'].includes(role)) links.push(['/home', 'ទំព័រដើម']);
    const opdDoctor = role === 'DOCTOR' && user.activeWard?.code === 'opd';
    if (!opdDoctor && ['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE'].includes(role)) links.push(['/emr','កំណត់ត្រាវេជ្ជសាស្ត្រ']);
    links.push(['/patient-list','បញ្ជីអ្នកជំងឺ']);
    if (!opdDoctor && ['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE','WARD_HEAD','CHIEF_WARD'].includes(role)) links.push(['/departments','គ្រប់គ្រងផ្នែក និងគ្រែ']);
    if (!opdDoctor && ['ADMIN','VICE_DIRECTOR','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','PHARMACY','DIRECTOR'].includes(role)) links.push(['/ward-medicines','បញ្ជីឱសថប្រចាំថ្ងៃ']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role) || (role === 'DOCTOR' && user.activeWard?.code === 'opd')) links.push(['/opd-queue','បញ្ជីរង់ចាំ OPD']);
    if (role === 'DOCTOR' && user.activeWard?.code === 'opd') links.push(['/queue-display?service=OPD','បើកផ្ទាំងលេខរៀង']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(role)) {links.push(['/pharmacy/opd','ចែកឱសថ']);links.push(['/pharmacy/medicines','បញ្ជីឱសថ']);}
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(role)) links.push(['/pharmacy/display','បើកផ្ទាំងលេខរៀង']);
    if (['LAB','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/lab','មន្ទីរពិសោធន៍']);
    if (['IMAGING','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/imaging','រូបភាពវេជ្ជសាស្ត្រ']);
    if (['ADMIN','DIRECTOR','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) links.push(['/billing','បេឡា']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','ACCOUNTANT'].includes(role)) links.push(['/expenses','ចំណាយ']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/finance','លំហូរសាច់ប្រាក់']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/admin/users','គ្រប់គ្រងគណនី']);
    if (['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)) links.push(['/admin/organization','ឈ្មោះ និងស្លាកសញ្ញា']);
    if (['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)) links.push(['/admin/health-facility','ព័ត៌មានមូលដ្ឋានសុខាភិបាល']);
    if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))return links.filter(([href])=>href!=='/emr' && href!=='/pharmacy/display' && !href.startsWith('/queue-display'));
    return links;
  }


export function navigationCatalog(){return USER_ROLES.map(role=>{const tabs=allowedLinks({activeRole:role,activeWard:{code:'medicine'}});if(role==='DOCTOR')for(const entry of allowedLinks({activeRole:role,activeWard:{code:'opd'}}))if(!tabs.some(t=>t[0]===entry[0]))tabs.push(entry);if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))tabs.push(['/admin/interface','រចនាគេហទំព័រ']);return {role,tabs:tabs.map(([id,label])=>({id,label}))}})}
export function ensureNavigationSchema(db){db.sqlite.exec(`CREATE TABLE IF NOT EXISTS navigation_settings(role TEXT PRIMARY KEY,settings_json TEXT NOT NULL,updated_by TEXT REFERENCES users(id),updated_at INTEGER NOT NULL) STRICT;`)}
export function getNavigationSettings(db){return Object.fromEntries(db.sqlite.prepare('SELECT * FROM navigation_settings').all().map(row=>[row.role,{...JSON.parse(row.settings_json),updatedAt:row.updated_at}]))}
export function updateNavigationSettings(db,body,userId){const catalog=navigationCatalog().find(c=>c.role===body?.role);if(!catalog)throw Error('Choose a valid role.');const ids=new Set(catalog.tabs.map(t=>t.id));for(const key of ['order','hidden']){if(!Array.isArray(body[key])||body[key].some(id=>!ids.has(id))||new Set(body[key]).size!==body[key].length)throw Error('Choose valid, unique tabs.');}const order=[...body.order,...catalog.tabs.map(t=>t.id).filter(id=>!body.order.includes(id))];const hidden=body.hidden.filter(id=>id!=='/admin/interface');db.sqlite.prepare('INSERT INTO navigation_settings VALUES (?,?,?,?) ON CONFLICT(role) DO UPDATE SET settings_json=excluded.settings_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(body.role,JSON.stringify({order,hidden}),userId,Date.now());return getNavigationSettings(db)}
