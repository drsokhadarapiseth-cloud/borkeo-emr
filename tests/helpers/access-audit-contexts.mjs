// Source-backed existing permissions, not a proposal to grant new access.
export const accessContexts = [
  ['ADMIN', '', '/home'], ['DIRECTOR', '', '/home'], ['VICE_DIRECTOR', '', '/billing'],
  ['REGISTRATION', '', '/emr?view=register'], ['TRIAGE', '', '/triage'],
  ['DOCTOR', 'opd', '/home'], ['DOCTOR', 'medicine', '/home'],
  ['DOCTOR', 'obstetric', '/home'], ['DOCTOR', 'gynecology', '/home'],
  ['NURSE', 'opd', '/opd-paraclinic-nurse'], ['NURSE', 'medicine', '/departments'],
  ['MIDWIFE', 'obstetric', '/departments'], ['CHIEF_WARD', 'medicine', '/ward-medicines'],
  ['WARD_HEAD', 'medicine', '/ward-medicines'], ['LAB', '', '/lab'], ['IMAGING', '', '/imaging'],
  ['PHARMACY', '', '/home'], ['ACCOUNTANT', '', '/billing'], ['CLERK', '', '/billing'],
].map(([role, ward, landing], index) => ({ role, ward, landing, id: `synthetic-access-${index}` }));
