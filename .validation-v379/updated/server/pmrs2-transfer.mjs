// A reviewed, local transfer package. No code in this module contacts PMRS2.
import { pmrs2Preview } from './pmrs2-mapping.mjs';

export function pmrs2ReviewIssues(preview, triage) {
  const issues = [];
  const include = (path, warnings) => {
    for (const code of warnings || []) issues.push({ path, code });
  };
  include('treatment', preview.warnings);
  if (!triage.weight) issues.push({ path: 'triage.weight', code: 'TRIAGE_WEIGHT_REQUIRED' });
  if (!triage.height) issues.push({ path: 'triage.height', code: 'TRIAGE_HEIGHT_REQUIRED' });
  if (!triage.dateTime) issues.push({ path: 'triage.dateTime', code: 'TRIAGE_DATE_TIME_REQUIRED' });
  if (['temperature', 'systolic', 'diastolic', 'pulse', 'respiratoryRate', 'oxygenSaturation']
    .some(key => !triage[key])) issues.push({ path: 'triage.vitals', code: 'TRIAGE_VITALS_INCOMPLETE' });
  (preview.followUps || []).forEach((record, index) => {
    include(`followUps[${index}]`, record.warnings);
    (record.medications || []).forEach((med, medIndex) =>
      include(`followUps[${index}].medications[${medIndex}]`, med.warnings));
  });
  include('prescription', preview.prescription?.warnings);
  (preview.prescription?.medications || []).forEach((med, index) =>
    include(`prescription.medications[${index}]`, med.warnings));
  include('discharge', preview.discharge?.warnings);
  return issues;
}

export function buildPmrs2TransferPackage(patient, reviewedAt) {
  const preview = pmrs2Preview(patient);
  const triage = preview.triage;
  const reviewIssues = pmrs2ReviewIssues(preview, triage);
  return {
    format: 'borkeo.pmrs2.reviewed-transfer.v1',
    target: 'PMRS2',
    reviewedAt,
    source: { system: 'Borkeo EMR', patientVersion: patient.version, updatedAt: patient.updatedAt },
    identity: {
      patientKey: preview.patientKey,
      healthId: preview.healthId,
      caseNumber: preview.caseNumber,
      fullName: preview.patientName,
      sex: patient.sex || '', age: patient.age || '', dateOfBirth: patient.dateOfBirth || '',
    },
    triage,
    treatment: {
      caseType: preview.caseType, chiefComplaint: preview.chiefComplaint,
      diagnosisText: preview.diagnosisText, diagnosisIcd10: preview.diagnosisIcd10,
      ancillaryService: preview.ancillaryService,
    },
    followUps: preview.followUps,
    prescription: preview.prescription,
    discharge: preview.discharge,
    reviewIssues,
    readyWithoutWarnings: reviewIssues.length === 0,
  };
}
