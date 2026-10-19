import {createHefLookup,HEF_LOOKUP_ROLES} from './hef-lookup.mjs';
import {createNssfLookup,NSSF_LOOKUP_ROLES} from './nssf-lookup.mjs';
import {ensureSymptomSchema,listSymptoms,addCustomSymptom,SYMPTOM_CREATE_ROLES} from './symptoms.mjs';
import { FACILITY_ROLES,ensureFacilitySchema,getFacility,saveFacility,uploadFacilityDocument,facilityDocument,removeFacilityDocument } from './health-facility.mjs';
import { createDiagnosisSearch } from './icd10.mjs';
// Borkeo EMR v38.3 - Electronic Medical Record System
import { generateTotpSecret, generateTotpUri, verifyTotpCode } from './totp.mjs';
import {validateAddressHierarchy} from './gazetteer.mjs';
import {validateCambodianPhone} from './cambodia-phone.mjs';
import {PATIENT_PHOTO_FIELDS, validPatientPhoto} from './patient-photo.mjs';
import {ensureNavigationSchema,navigationCatalog,getNavigationSettings,updateNavigationSettings} from './navigation-settings.mjs';
import {legacyReviewHistory,recordLegacyReview} from './requests.mjs';
import {mergeBedState,validateBedState,roomMatchesWard} from './bed-management.mjs';
import {MANAGEMENT,ensureRequestSchema,seedExistingRequests,listWorkflowRequests,getWorkflowRequest,submitWorkflowRequest,reviewWorkflowRequest,syncClinicalRequests,applyServiceConcession,signedBy,bulkReviewWorkflowRequests} from './requests.mjs';
import {resetAndSeedThirtyTriagePatients} from '../scripts/seed-v301-thirty-triage-patients.mjs';
import {ensureInterfaceThemeSchema,getInterfaceTheme,updateInterfaceTheme,INTERFACE_PRESETS} from './interface-theme.mjs';
import {PAYMENT_CATEGORIES,NSSF_SUBTYPES,FACILITY_LEVELS,majorPaymentCategory,paymentSettings,setPaymentSettings,payerTariffCatalog,setPayerTariff,listConcessions,requestConcession,reviewConcession} from './payment-policy.mjs';
import {ensureInvoiceEditSchema,invoiceHistory,invoiceEditRequests,cashierPaymentAlerts,requestInvoiceEdit,reviewInvoiceEdit,applyInvoiceEdit,assertCashierInvoiceWritable,queueCashierPayment,isPatientDischarged,applyDirectInvoiceEdit} from './invoice-edits.mjs';
import { prepareOpdPrescription, submitOpdPrescription, prescriptionForMessage,
  listOpdPrescriptions, opdPrescriptionForPharmacy, markOpdPrescriptionReceived, ensureOpdReceiptDischarges } from './pharmacy-prescriptions.mjs';
import {encounterAccess,assertEncounterWrite,consumeCorrection,RECORD_MANAGEMENT} from './encounter-access.mjs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, projectRoot } from './config.mjs';
import { CLINICAL_FORM_TYPES, openDatabase } from './database.mjs';
import { Router } from './router.mjs';
import { mountAuthRoutes } from './routes/auth.mjs';
import { mountAdminRoutes } from './routes/admin.mjs';
import { mountQueueRoutes } from './routes/queue.mjs';
import {
  hashPassword, normalizeUsername, randomToken, safeTokenEqual, tokenHash, validatePassword, validateUsername, verifyPassword,
} from './password.mjs';
import {
  applySecurityHeaders, clearSessionCookie, parseCookies,
  serializeSessionCookie, SESSION_COOKIE,
} from './security.mjs';
import {
  ROLES, WARDS, buildIdentity, canAccessPatient, defaultContext, ensureAccessSchema, getUserAccess,
  listUsers, roleCanPage, roleRequiresWard, roleWardAllowed, sessionRole, sessionWard, patientWorkWard,
  setSessionContext, setUserAccess, updateUserProfile, validContexts, wardInfo, readSessionContext,
  listAllRoles, allRoleLabels, listAllWards, createCustomRole, createCustomWard,
  IMAGING_SUBTYPES, IMAGING_GROUPS, IMAGING_SUBTYPE_DETAILS, getUserImagingSubtypes, setUserImagingSubtypes,
} from './access.mjs';
// /api/admin/users payload: imagingSubtypeDetails: IMAGING_SUBTYPE_DETAILS
import {
  acknowledgeCritical, addAttachment, addParaclinicExtraFee, cancelOrder, createLabTest, createOrder, deleteLabTest, ensureParaclinicSchema, getAttachment, getOrder, imagingCatalog, labCatalog, listOrders,
  listParaclinicExtraFees, markReviewed, markResultViewed, releasePaidOpdParaclinicOrders, updateImagingModality, updateLabTest, updateOrder, updateParaclinicExtraFee,
} from './paraclinic.mjs';
import {
  PAYMENT_TYPES, DIRECT_PAYMENT_TYPES, HEF_TYPES, PAYMENT_PURPOSES, FINANCE_CURRENCIES, SERVICE_CATEGORIES, FINANCE_DEPARTMENTS,
  addCharge, addExpense, addPayment, addPaymentAttachment,
  cashflowDayDetails, cashflowMonth, cashflowRange, monthlyServiceRevenue, serviceRevenueRange, ensureFinanceSchema, financePatientSearch, getFinancePayment, getPaymentAttachment,
  listExpenses, listPatientInvoices, patientBill, patientPaymentHistory, paymentStatusForPatient, serviceCatalog, setFinanceProfile, setServiceCatalogItem, voidFinanceItem, startPatientInvoice,
  exchangeRateState, proposeExchangeRate, reviewExchangeRate, voidChargeBySource,
} from './finance.mjs';
import {
  dailyHospitalReport, ensureAdmissionMovement, ensureDailyReportSchema, recordBedAssignment, recordMovement,
} from './daily-report.mjs';
import { medicineReportWards, wardMedicineReport, ordersForDate } from './ward-medicines.mjs';
import { ensureStockSchema, listStock, addStockItem, receiveStock, syncMedicineStock, useLabMaterials, manualMaterialUsage, manualFilmUsage, stockHistory } from './stock.mjs';
import { wardMedicineRequestKeys, ensureWardMedicineApprovalSchema, reviewedWardMedicineReport,
  approveWardMedicineReport, signWardMedicineReport, markPharmacyAlerted, queueLateWardMedicineOrder, directorWardMedicineInbox, rejectWardMedicineReport } from './ward-medicine-approvals.mjs';
import {
  addStaffMessageAttachment, canViewStaffMessage, createStaffMessage, createSystemMessage,
  ensureMessagingSchema, getStaffMessage, getStaffMessageAttachment, listStaffMessages, pendingStaffMessageCount, markStaffMessageRead, completeStaffMessage, completePatientMessages,
} from './messages.mjs';
import {
  ensureESignSchema, listESignatures, setESignature, signatureSnapshot,
} from './esign.mjs';
import { ensureDefaultWardUsers } from './default-ward-users.mjs';
import { disabledDemoPasswordHash, ensureDemoAccounts } from './demo-accounts.mjs';
import { createDailyBackup, preparePersistentDatabase, recoverLegacyPatientData } from './persistent-data.mjs';
import { pmrs2Preview } from './pmrs2-mapping.mjs';
import { buildPmrs2TransferPackage, pmrs2ReviewIssues } from './pmrs2-transfer.mjs';
import { normalizePmrsId, preparePmrsMedicineImport, applyPmrsMedicineImport } from './pmrs2-medicine-import.mjs';
import { ensureEditorHistorySchema, saveEditorHistory, listEditorHistory, patientRecordChangeNotes } from './editor-history.mjs';
import { ensureOpdQueueSchema, referToOpd, listOpdQueue, getOpdQueueEntry,
  updateOpdQueueStatus, opdLocalDate } from './opd-queue.mjs';
import { recentPatientTransfers } from './patient-transfers.mjs';
import { ensureAdmissionApprovalSchema, admissionApprovalFor, listPendingAdmissionApprovals, approveAdmission } from './admission-approvals.mjs';
import { ensureQueueBoardSchema, callQueuePatient, getActiveQueueCall, listActiveQueueCalls, clearQueueCall, skipQueuePatient, clearQueueSkip, listSkippedQueue, getQueueDisplayRows } from './queue-board.mjs';
import { ensureAppointmentSchema, listAppointments, createAppointment, updateAppointmentStatus } from './appointments.mjs';
import { ensurePharmacyDischargeSchema, listDischargeMedicationOrders, markDischargeMedicationReceived } from './pharmacy-discharge.mjs';
import { ensureOrganizationBrandingSchema, getOrganizationBranding, getOrganizationLogo, updateOrganizationBranding } from './organization-branding.mjs';

const currentFile = fileURLToPath(import.meta.url);
const dummyPasswordHash = 'scrypt$32768$8$1$MDAwMDAwMDAwMDAwMDAwMA$qM8HKw2pZpspPRTL7ogxHkbKyCS16wfj9nXQEvqHjsqDxIZAFCPmi5VMUNk7uHaRY_xUAyguLh4k6j8W3mimNQ';
const pharmacySettledCodes=new Set(['INSURANCE','NGO','PAID','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER']);

const publicFiles = new Map([
  ['/public/health-facility.js',['health-facility.js','text/javascript; charset=utf-8']],
  ['/public/health-facility.css',['health-facility.css','text/css; charset=utf-8']],
  ['/public/hef-lookup.js', ['hef-lookup.js', 'text/javascript; charset=utf-8']],
  ['/public/hef-lookup.css', ['hef-lookup.css', 'text/css; charset=utf-8']],
  ['/public/nssf-lookup.js', ['nssf-lookup.js', 'text/javascript; charset=utf-8']],
  ['/public/nssf-lookup.css', ['nssf-lookup.css', 'text/css; charset=utf-8']],
  ['/public/patient-card-print.js', ['patient-card-print.js', 'text/javascript; charset=utf-8']],
  ['/public/patient-card-print.css', ['patient-card-print.css', 'text/css; charset=utf-8']],
  ['/public/qrcode.min.js', ['qrcode.min.js', 'text/javascript; charset=utf-8']],
  ['/public/chief-complaint-tags.js', ['chief-complaint-tags.js', 'text/javascript; charset=utf-8']],
  ['/public/chief-complaint-tags.css', ['chief-complaint-tags.css', 'text/css; charset=utf-8']],
  ['/public/emr-icd10.js', ['emr-icd10.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-icd10.css', ['emr-icd10.css', 'text/css; charset=utf-8']],
  ['/public/cambodia-address.js', ['cambodia-address.js', 'text/javascript; charset=utf-8']],
  ['/public/cambodia-address.css', ['cambodia-address.css', 'text/css; charset=utf-8']],
  ['/public/appointment-list.js', ['appointment-list.js', 'text/javascript; charset=utf-8']],
  ['/public/service-list.css', ['service-list.css', 'text/css; charset=utf-8']],
  ['/public/payment-policy.css', ['payment-policy.css', 'text/css; charset=utf-8']],
  ['/public/payment-prices.js', ['payment-prices.js', 'text/javascript; charset=utf-8']],
  ['/public/payment-approvals.js', ['payment-approvals.js', 'text/javascript; charset=utf-8']],
  ['/public/login.css', ['login.css', 'text/css; charset=utf-8']],
  ['/public/login.js', ['login.js', 'text/javascript; charset=utf-8']],
  ['/public/interface-theme.css',['interface-theme.css','text/css; charset=utf-8']],
  ['/public/interface-theme.js',['interface-theme.js','text/javascript; charset=utf-8']],
  ['/public/emr-session.css', ['emr-session.css', 'text/css; charset=utf-8']],
  ['/public/emr-session.js', ['emr-session.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-language.css', ['emr-language.css', 'text/css; charset=utf-8']],
  ['/public/emr-language-data.js', ['emr-language-data.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-language.js', ['emr-language.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-encounter-editor.js', ['emr-encounter-editor.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-encounter-editor.css', ['emr-encounter-editor.css', 'text/css; charset=utf-8']],
  ['/public/record-viewer.js', ['record-viewer.js', 'text/javascript; charset=utf-8']],
  ['/public/record-viewer.css', ['record-viewer.css', 'text/css; charset=utf-8']],
  ['/public/emr-language-lock.js', ['emr-language-lock.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-required-fields.js', ['emr-required-fields.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-required-fields.css', ['emr-required-fields.css', 'text/css; charset=utf-8']],
  ['/public/emr-diagnoses.js', ['emr-diagnoses.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-diagnoses.css', ['emr-diagnoses.css', 'text/css; charset=utf-8']],
  ['/public/ocean-theme.css', ['ocean-theme.css', 'text/css; charset=utf-8']],
  ['/public/responsive-layout.css', ['responsive-layout.css', 'text/css; charset=utf-8']],
  ['/public/home.css', ['home.css', 'text/css; charset=utf-8']],
  ['/public/opd-specialty-theme.js', ['opd-specialty-theme.js', 'text/javascript; charset=utf-8']],
  ['/public/clinical-form-layout.js', ['clinical-form-layout.js', 'text/javascript; charset=utf-8']],
  ['/public/opd-clinical-storage.js', ['opd-clinical-storage.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-patient-record.js', ['emr-patient-record.js', 'text/javascript; charset=utf-8']],
  ['/public/cambodia-phone.js', ['cambodia-phone.js', 'text/javascript; charset=utf-8']],
  ['/public/appointments.js', ['appointments.js', 'text/javascript; charset=utf-8']],
  ['/public/ward-services.js', ['ward-services.js', 'text/javascript; charset=utf-8']],
  ['/public/patient-photo.js', ['patient-photo.js', 'text/javascript; charset=utf-8']],
  ['/public/patient-photo.css', ['patient-photo.css', 'text/css; charset=utf-8']],
  ['/public/clinical-fees.css', ['clinical-fees.css', 'text/css; charset=utf-8']],
  ['/public/editor-history.css', ['editor-history.css', 'text/css; charset=utf-8']],
  ['/public/pmrs2-exam-normal.js', ['pmrs2-exam-normal.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-inpatient-workflow.js', ['emr-inpatient-workflow.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-inpatient-workflow.css', ['emr-inpatient-workflow.css', 'text/css; charset=utf-8']],
  ['/public/patient-list.css', ['patient-list.css', 'text/css; charset=utf-8']],
  ['/public/patient-list.js', ['patient-list.js', 'text/javascript; charset=utf-8']],
  ['/public/departments.css', ['departments.css', 'text/css; charset=utf-8']],
  ['/public/departments.js', ['departments.js', 'text/javascript; charset=utf-8']],
  ['/public/triage.css', ['triage.css', 'text/css; charset=utf-8']],
  ['/public/triage.js', ['triage.js', 'text/javascript; charset=utf-8']],
  ['/public/context.css', ['context.css', 'text/css; charset=utf-8']],
  ['/public/context.js', ['context.js', 'text/javascript; charset=utf-8']],
  ['/public/admin-users.css', ['admin-users.css', 'text/css; charset=utf-8']],
  ['/public/admin-users.js', ['admin-users.js', 'text/javascript; charset=utf-8']],
  ['/public/organization-branding.js', ['organization-branding.js', 'text/javascript; charset=utf-8']],
  ['/public/organization-branding-admin.js', ['organization-branding-admin.js', 'text/javascript; charset=utf-8']],
  ['/public/organization-branding.css', ['organization-branding.css', 'text/css; charset=utf-8']],
  ['/public/home.js', ['home.js', 'text/javascript; charset=utf-8']],
  ['/public/emr-permissions.js', ['emr-permissions.js', 'text/javascript; charset=utf-8']],
  ['/public/paraclinic.css', ['paraclinic.css', 'text/css; charset=utf-8']],
  ['/public/paraclinic-workspace.css', ['paraclinic-workspace.css', 'text/css; charset=utf-8']],
  ['/public/report-print.js', ['report-print.js', 'text/javascript; charset=utf-8']],
  ['/public/report-print.css', ['report-print.css', 'text/css; charset=utf-8']],
  ['/public/paraclinic-print.css', ['paraclinic-print.css', 'text/css; charset=utf-8']],
  ['/public/paraclinic.js', ['paraclinic.js', 'text/javascript; charset=utf-8']],
  ['/public/opd-paraclinic-nurse.css', ['opd-paraclinic-nurse.css', 'text/css; charset=utf-8']],
  ['/public/opd-paraclinic-nurse.js', ['opd-paraclinic-nurse.js', 'text/javascript; charset=utf-8']],
  ['/public/lab.css', ['lab.css', 'text/css; charset=utf-8']],
  ['/public/lab-reference.mjs',['lab-reference.mjs','text/javascript; charset=utf-8']],
  ['/public/lab.js', ['lab.js', 'text/javascript; charset=utf-8']],
  ['/public/imaging.css', ['imaging.css', 'text/css; charset=utf-8']],
  ['/public/imaging.js', ['imaging.js', 'text/javascript; charset=utf-8']],
  ['/public/billing.css', ['billing.css', 'text/css; charset=utf-8']],
  ['/public/receipt.css', ['receipt.css', 'text/css; charset=utf-8']],
  ['/public/fonts/Battambang-Regular.ttf', ['fonts/Battambang-Regular.ttf', 'font/ttf']],
  ['/public/fonts/Moul-Khmer.woff2', ['fonts/Moul-Khmer.woff2', 'font/woff2']],
  ['/public/fonts/Moul-Latin.woff2', ['fonts/Moul-Latin.woff2', 'font/woff2']],
  ['/public/billing.js', ['billing.js', 'text/javascript; charset=utf-8']],
  ['/public/staff-invoices.js', ['staff-invoices.js', 'text/javascript; charset=utf-8']],
  ['/public/staff-invoices.css', ['staff-invoices.css', 'text/css; charset=utf-8']],
  ['/public/cashier-notifications.js', ['cashier-notifications.js', 'text/javascript; charset=utf-8']],
  ['/public/cashier-notifications.css', ['cashier-notifications.css', 'text/css; charset=utf-8']],
  ['/public/pmrs-import.js', ['pmrs-import.js', 'text/javascript; charset=utf-8']],
  ['/public/requests.js', ['requests.js', 'text/javascript; charset=utf-8']],
  ['/public/request-badges.js', ['request-badges.js', 'text/javascript; charset=utf-8']],
  ['/public/requests.css', ['requests.css', 'text/css; charset=utf-8']],
  ['/public/shared-controls.css', ['shared-controls.css', 'text/css; charset=utf-8']],
  ['/public/ward-medicines.js', ['ward-medicines.js', 'text/javascript; charset=utf-8']],
  ['/public/ward-medicine-table.js', ['ward-medicine-table.js', 'text/javascript; charset=utf-8']],
  ['/public/ward-medicines.css', ['ward-medicines.css', 'text/css; charset=utf-8']],
  ['/public/expenses.css', ['expenses.css', 'text/css; charset=utf-8']],
  ['/public/expenses.js', ['expenses.js', 'text/javascript; charset=utf-8']],
  ['/public/finance.css', ['finance.css', 'text/css; charset=utf-8']],
  ['/public/finance.js', ['finance.js', 'text/javascript; charset=utf-8']],
  ['/public/messages.css', ['messages.css', 'text/css; charset=utf-8']],
  ['/public/messages.js', ['messages.js', 'text/javascript; charset=utf-8']],
  ['/public/opd-queue.css', ['opd-queue.css', 'text/css; charset=utf-8']],
  ['/public/opd-queue.js', ['opd-queue.js', 'text/javascript; charset=utf-8']],
  ['/public/pharmacy-opd.css', ['pharmacy-opd.css', 'text/css; charset=utf-8']],
  ['/public/pharmacy-opd.js', ['pharmacy-opd.js', 'text/javascript; charset=utf-8']],
  ['/public/pharmacy-display.js', ['pharmacy-display.js', 'text/javascript; charset=utf-8']],
  ['/public/pharmacy-display.css', ['pharmacy-display.css', 'text/css; charset=utf-8']],
  ['/public/queue-display.js', ['queue-display.js', 'text/javascript; charset=utf-8']],
  ['/public/queue-display.css', ['queue-display.css', 'text/css; charset=utf-8']],
  ['/public/stock.js', ['stock.js', 'text/javascript; charset=utf-8']],
  ['/public/stock.css', ['stock.css', 'text/css; charset=utf-8']],
  ['/public/patient-photo.css', ['patient-photo.css', 'text/css; charset=utf-8']],
  ['/public/patient-photo.js', ['patient-photo.js', 'text/javascript; charset=utf-8']],
  ['/public/logo-hospital.jpg', ['logo-hospital.jpg', 'image/jpeg']],
  ['/public/hospital-image.png', ['hospital-image.png', 'image/png']],
  ['/public/anatomy-position.png', ['anatomy-position.png', 'image/png']],
]);
const emrAssets = new Map([
  ['LOGO-HOSPITAL.jpg', ['LOGO-HOSPITAL.jpg', 'image/jpeg']],
  ['LOGO-MOH.jpg', ['LOGO-MOH.jpg', 'image/jpeg']],
  ['Tacteing-6.png', ['Tacteing-6.png', 'image/png']],
]);
// Read the release label from the package; retain the incomplete-folder launcher fallback.
const APP_VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8')).version.match(/^\d+\.\d+/)?.[0] || '22.2'; }
  catch { return '22.2'; }
})();
const protectedPages = new Map([
  ['/admin/health-facility',['health-facility.html',false]],
  ['/admin/interface',['interface-theme.html',false]],
  ['/home', ['home.html', false]],
  ['/emr', ['EMR.html', true]],
  ['/print-preview', ['print-preview.html', true]],
  ['/pmrs-import', ['pmrs-import.html', false]],
  ['/ward-medicines', ['ward-medicines.html', false]],
  ['/requests', ['requests.html', false]],
  ['/opd-queue', ['opd-queue.html', false]],
  ['/opd-paraclinic-nurse', ['opd-paraclinic-nurse.html', false]],
  ['/ipd-transfer', ['ipd-transfer.html', false]],
  ['/pharmacy/opd', ['pharmacy-opd.html', false]],
  ['/pharmacy/display', ['pharmacy-display.html', false]],
  ['/pharmacy/medicines', ['stock.html', false]],
  ['/lab/materials', ['stock.html', false]],
  ['/queue-display', ['queue-display.html', false]],
  ['/patient-list', ['patient-list.html', true]],
  ['/record-viewer', ['record-viewer.html', true]],
  ['/departments', ['departments.html', true]],
  ['/triage', ['triage.html', false]],
  ['/context', ['context.html', false]],
  ['/admin/users', ['admin-users.html', false]],
  ['/admin/organization', ['organization-branding.html', false]],
  ['/lab', ['lab.html', false]],
  ['/imaging', ['imaging.html', false]],
  ['/imaging/films', ['stock.html', false]],
  ['/billing', ['billing.html', false]],
  ['/expenses', ['expenses.html', false]],
  ['/finance', ['finance.html', false]],
]);
const clinicalFormTypes = new Set(CLINICAL_FORM_TYPES);
const clinicalWriteRoles = new Set(['ADMIN','VICE_DIRECTOR','DIRECTOR', 'DOCTOR','CHIEF_WARD', 'NURSE', 'MIDWIFE']);
const clinicalFormReadRoles = new Set(['ADMIN','VICE_DIRECTOR', 'DIRECTOR', 'REGISTRATION', 'TRIAGE', 'DOCTOR','CHIEF_WARD', 'NURSE', 'MIDWIFE']);
const clinicalFormWriteRoles = new Set(['ADMIN','VICE_DIRECTOR','DIRECTOR', 'DOCTOR','CHIEF_WARD']);

function landingPathForRole(role, wardCode = '') {
  role = String(role || '').toUpperCase();
  if (['CLERK','ACCOUNTANT','VICE_DIRECTOR'].includes(role)) return '/billing';
  if (role === 'LAB') return '/lab';
  if (role === 'IMAGING') return '/imaging';
  if (role === 'TRIAGE') return '/triage';
  if (role === 'REGISTRATION') return '/emr?view=register';
  if (role === 'NURSE' && String(wardCode || '').toLowerCase() === 'opd') return '/opd-paraclinic-nurse';
  if (role === 'WARD_HEAD' || role === 'CHIEF_WARD') return '/ward-medicines';
  if (role === 'NURSE' || role === 'MIDWIFE') return '/departments';
  return '/home';
}

function messagingVisibility(session) {
  return { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
}

function messagingRoleAllowed(role) {
  return new Set(['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','CLERK','ACCOUNTANT','LAB','IMAGING','PHARMACY']).has(String(role || '').toUpperCase());
}

function destinationExists(type, code='') {
  type = String(type || '').toUpperCase();
  if (['LAB','IMAGING','PHARMACY','ADMIN','VICE_DIRECTOR','DIRECTOR','TRIAGE','REGISTRATION','CLERK','ACCOUNTANT'].includes(type)) return true;
  if (type !== 'WARD') return false;
  return WARDS.some(ward => ward.code === String(code || '').toLowerCase());
}

function automaticWardMessage(database, actor, patient, subject, body, options = {}) {
  const wardCode = String(options.wardCode || patientWorkWard(patient) || '').toLowerCase();
  if (!wardCode) return null;
  return createSystemMessage(database, {
    senderUserId: actor.userId,
    senderRole: actor.role,
    senderWardCode: actor.wardCode || '',
    destinationType: 'WARD',
    destinationCode: wardCode,
    destinationRole: options.destinationRole || '',
    subject,
    body,
    patientKey: patient.patient_key,
  });
}

function notifyOpdDoctorsPaymentCompleted(database, session, patient, bill, payments = []) {
  if (String(patient?.service_mode || '').toLowerCase() !== 'opd') return null;
  const money = (amount, currency) => currency === 'USD'
    ? `$${Number(amount || 0).toFixed(2)}`
    : `${Math.round(Number(amount || 0)).toLocaleString('en-US')} ៛`;
  const paid = ['KHR','USD'].map(currency => {
    const amount = Number(bill?.summary?.[currency]?.paid || 0);
    return amount > 0 ? money(amount, currency) : '';
  }).filter(Boolean).join(' + ') || payments.map(item => money(item.amount, item.currency)).join(' + ');
  const waived = ['KHR','USD'].map(currency => {
    const amount = Number(bill?.summary?.[currency]?.waived || 0);
    return amount > 0 ? money(amount, currency) : '';
  }).filter(Boolean).join(' + ');
  const settlement = paid || (waived ? `Fully waived: ${waived}` : 'Invoice settled');
  const name = patient.full_name || patient.case_number || patient.patient_key;
  const invoice = bill?.invoice?.invoiceNo || bill?.invoice?.id || '—';
  return automaticWardMessage(database,
    { userId:session.user_id, role:sessionRole(session), wardCode:sessionWard(session) },
    patient,
    'Cashier payment completed',
    `${name} · invoice ${invoice} · ${settlement}. The OPD invoice is settled; the patient may continue with the OPD doctor.`,
    { wardCode:'opd', destinationRole:'DOCTOR' });
}

function admissionWardCode(update) {
  const room = String(update?.roomCode || '').toLowerCase();
  const department = String(update?.departmentCode || '').toLowerCase();
  if (room === 'medical') return 'medicine';
  if (room === 'surgical') return 'surgery';
  if (['emergency','pediatric','gynecology','obstetric','tb','icu','ncu'].includes(room)) return room;
  if (department === 'gyneco-obstetric') return room === 'obstetric' ? 'obstetric' : 'gynecology';
  return department;
}

function notifyTriageReferral(database, session, patient) {
  const department = String(patient.department_code || '').toLowerCase();
  const name = patient.full_name || patient.case_number || patient.patient_key;
  const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
  const getWardKh = (code) => {
    try {
      const w = database.findWard?.(code);
      if (w?.nameKh) return w.nameKh;
    } catch (_) {}
    const map = {
      medicine: 'ផ្នែកជំងឺទូទៅ',
      surgery: 'ផ្នែកវះកាត់',
      pediatric: 'ផ្នែកជំងឺកុមារ',
      pediatrics: 'ផ្នែកជំងឺកុមារ',
      maternity: 'ផ្នែកសម្ភព',
      obstetric: 'ផ្នែកសម្ភព',
      gynecology: 'ផ្នែករោគស្ត្រី',
      emergency: 'ផ្នែកសង្គ្រោះបន្ទាន់',
      tb: 'ផ្នែកជំងឺរបេង',
      dental: 'ផ្នែកធ្មេញ',
      mental: 'ផ្នែកសុខភាពផ្លូវចិត្ត',
      opd: 'ផ្នែកពិគ្រោះក្រៅ'
    };
    return map[code] || (code ? `ផ្នែក ${code}` : 'ផ្នែកសម្រាកពេទ្យ');
  };
  const send = (wardCode, destinationRole) => {
    const targetDept = getWardKh(wardCode);
    const msg = `អ្នកជំងឺឈ្មោះ ${name} ត្រូវបានបញ្ជូនពីផ្នែកទ្រីយ៉ាមកផ្នែក ${targetDept.replace(/^ផ្នែក\s*/, '')} សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
    return automaticWardMessage(
      database, actor, patient,
      msg,
      msg,
      { wardCode, destinationRole },
    );
  };
  if (department === 'gyneco-obstetric') {
    send('gynecology', 'NURSE');
    send('obstetric', 'MIDWIFE');
    return;
  }
  const wardCode = patientWorkWard(patient) || department;
  if (!wardCode || wardCode === 'opd') return;
  send(wardCode, wardCode === 'obstetric' ? 'MIDWIFE' : 'NURSE');
}

function requestIp(request) {
  return request.socket.remoteAddress ?? 'unknown';
}

const htmlTemplateCache = new Map();
const staticFileCache = new Map();
const staticCompressedCache = new Map();

function compressIfNeeded(request, response, buffer, contentType) {
  if (!buffer || buffer.length < 512) return buffer;
  const isCompressible = /^(text\/|application\/json|application\/javascript|font\/ttf|image\/svg\+xml)/i.test(contentType);
  if (!isCompressible) return buffer;

  const accept = String(request?.headers?.['accept-encoding'] || '');
  if (/\bgzip\b/i.test(accept)) {
    response.setHeader('Content-Encoding', 'gzip');
    response.setHeader('Vary', 'Accept-Encoding');
    return zlib.gzipSync(buffer, { level: 6 });
  }
  if (/\bdeflate\b/i.test(accept)) {
    response.setHeader('Content-Encoding', 'deflate');
    response.setHeader('Vary', 'Accept-Encoding');
    return zlib.deflateSync(buffer, { level: 6 });
  }
  return buffer;
}

function getProcessedHtml(filePath, contentType, security, APP_VERSION) {
  const stat = fs.statSync(filePath);
  const cacheKey = `${filePath}:${stat.mtimeMs}:${APP_VERSION}:${security?.requestPath || ''}`;
  const cached = htmlTemplateCache.get(filePath);
  if (cached && cached.cacheKey === cacheKey) {
    return cached.bytes;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/(<span\b[^>]*\bdata-app-version\b[^>]*>)[^<]*(<\/span>)/g, (_, open, close) => `${open}v${APP_VERSION}${close}`);
  html = html.replace(/Borkeo EMR v\d+\.\d+/g, `Borkeo EMR v${APP_VERSION}`);
  html = html.replace(/<head\b[^>]*>/i, head => head + '<style>.emr-language-switch, [data-emr-language], #langBtn, .lang-btn, body #emr-site-banner .portal-account-actions .emr-language-switch, #emr-session-control .portal-account-actions .emr-language-switch, .portal-account-actions .emr-language-switch { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; width: 0 !important; height: 0 !important; max-width: 0 !important; max-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; position: absolute !important; left: -9999px !important; clip: rect(0,0,0,0) !important; }</style><script src="/public/emr-language-lock.js?v=3760"></script><link rel="stylesheet" href="/public/emr-required-fields.css?v=3770"><script src="/public/emr-required-fields.js?v=3770"></script>');
  html = html.replace('</head>', '<link rel="stylesheet" href="/public/interface-theme.css?v=1970"><script src="/public/interface-theme.js?v=1970" defer></script></head>');
  html = html.replace('</head>', '<link rel="stylesheet" href="/public/shared-controls.css?v=1970"><script src="/public/request-badges.js?v=1970" defer></script></head>');
  if(path.basename(filePath)==='EMR.html')html=html.replace('</head>','<link rel="stylesheet" href="/public/emr-encounter-editor.css?v=3800"><script src="/public/emr-encounter-editor.js?v=3800" defer></script></head>');
  html = html.replace('</head>', `<meta name="borkeo-version" content="${APP_VERSION}"></head>`);
  if (!html.includes('/public/emr-language.js')) {
    const langVersion = APP_VERSION.split('.').slice(0, 2).join('') + '0';
    const languageAssets = `<link rel="stylesheet" href="/public/emr-language.css?v=${langVersion}"><script src="/public/emr-language-data.js?v=1750" defer></script><script src="/public/emr-language.js?v=${langVersion}" defer></script>`;
    html = html.replace('</head>', `${languageAssets}</head>`);
  }
  html = html.replace(/(\/public\/[^"'\s<>]+\?v=[^"'\s<>]+)/g, asset => `${asset}&build=${APP_VERSION}`);
  if (path.basename(filePath) === 'stock.html') {
    const reqPath = String(security?.requestPath || '');
    if (reqPath.startsWith('/lab')) {
      html = html.replace(/<section class="imaging-toolbar[\s\S]*?<\/section>/g, '');
      html = html.replace(/<link[^>]*imaging\.css[^>]*>/g, '');
    } else if (reqPath.startsWith('/imaging')) {
      html = html.replace(/<section class="lab-toolbar[\s\S]*?<\/section>/g, '');
      html = html.replace(/<link[^>]*lab\.css[^>]*>/g, '');
    }
  }
  const bytes = Buffer.from(html, 'utf8');
  htmlTemplateCache.set(filePath, { cacheKey, bytes });
  return bytes;
}

function sendJson(response, status, body, security = {}) {
  applySecurityHeaders(response, security);
  const rawBytes = Buffer.from(JSON.stringify(body));
  const req = response.req;
  const compressedBytes = compressIfNeeded(req, response, rawBytes, 'application/json');
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': compressedBytes.length,
    'Cache-Control': 'no-store',
  });
  response.end(compressedBytes);
}

function redirect(response, location, security = {}) {
  applySecurityHeaders(response, security);
  response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

function sendFile(response, filePath, contentType, security = {}, cache = false) {
  try {
    const req = response.req;
    const stat = fs.statSync(filePath);
    const mtimeMs = stat.mtimeMs;
    const isHtml = path.basename(filePath) !== 'print-preview.html' && contentType.startsWith('text/html;') &&
        (filePath.includes(`${path.sep}protected${path.sep}`) || path.basename(filePath) === 'login.html');

    let bodyBytes = null;
    if (isHtml) {
      bodyBytes = getProcessedHtml(filePath, contentType, security, APP_VERSION);
    }

    const etag = `W/"${stat.size.toString(16)}-${Math.floor(mtimeMs).toString(16)}${isHtml ? `-${APP_VERSION}` : ''}"`;
    const ifNoneMatch = req?.headers?.['if-none-match'];

    if (ifNoneMatch && ifNoneMatch === etag) {
      applySecurityHeaders(response, security);
      response.writeHead(304, {
        'ETag': etag,
        'Cache-Control': cache ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache',
      });
      return response.end();
    }

    if (!bodyBytes) {
      const cached = staticFileCache.get(filePath);
      if (cached && cached.mtimeMs === mtimeMs) {
        bodyBytes = cached.bytes;
      } else if (stat.size <= 2 * 1024 * 1024) {
        bodyBytes = fs.readFileSync(filePath);
        staticFileCache.set(filePath, { mtimeMs, bytes: bodyBytes });
      }
    }

    applySecurityHeaders(response, security);
    response.setHeader('ETag', etag);

    const reqUrl = req?.url || '';
    const hasVersionQuery = reqUrl.includes('?v=') || reqUrl.includes('&build=');
    const isAsset = filePath.includes(`${path.sep}public${path.sep}`) && !isHtml;
    const cacheControlHeader = (cache || (isAsset && hasVersionQuery))
      ? 'public, max-age=86400, stale-while-revalidate=604800'
      : (cache ? 'private, max-age=3600' : 'no-cache');

    response.setHeader('Cache-Control', cacheControlHeader);
    response.setHeader('Content-Type', contentType);

    if (bodyBytes) {
      const accept = String(req?.headers?.['accept-encoding'] || '');
      const enc = /\bgzip\b/i.test(accept) ? 'gzip' : (/\bdeflate\b/i.test(accept) ? 'deflate' : '');
      let finalBytes = bodyBytes;
      if (enc && isAsset && bodyBytes.length >= 512) {
        const cacheKey = `${filePath}:${mtimeMs}:${enc}`;
        let cachedCompressed = staticCompressedCache.get(cacheKey);
        if (!cachedCompressed) {
          cachedCompressed = enc === 'gzip' ? zlib.gzipSync(bodyBytes, { level: 6 }) : zlib.deflateSync(bodyBytes, { level: 6 });
          staticCompressedCache.set(cacheKey, cachedCompressed);
        }
        response.setHeader('Content-Encoding', enc);
        response.setHeader('Vary', 'Accept-Encoding');
        finalBytes = cachedCompressed;
      } else {
        finalBytes = compressIfNeeded(req, response, bodyBytes, contentType);
      }
      response.setHeader('Content-Length', finalBytes.length);
      response.writeHead(200);
      return response.end(finalBytes);
    }

    response.setHeader('Content-Length', stat.size);
    response.writeHead(200);
    fs.createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'Not found.' }, security);
  }
}

function sendBuffer(response, bytes, contentType, security = {}) {
  applySecurityHeaders(response, security);
  const req = response.req;
  const finalBytes = compressIfNeeded(req, response, bytes, contentType);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': finalBytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(finalBytes);
}

async function readJson(request, maximumBytes) {
  const contentType = String(request.headers['content-type'] ?? '').split(';')[0].trim();
  if (contentType !== 'application/json') {
    const error = new Error('Content-Type must be application/json.');
    error.status = 415;
    throw error;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch {
    const error = new Error('Request body is not valid JSON.');
    error.status = 400;
    throw error;
  }
}

async function readBinary(request, maximumBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error('Attachment is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeAttachmentName(value) {
  const name = String(value || 'attachment').replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim().slice(0, 180);
  return name || 'attachment';
}

function requireContext(session) {
  const role = sessionRole(session);
  if (!role) {
    const error = new Error('Choose a working role and ward first.');
    error.status = 409;
    throw error;
  }
  return role;
}

function orderActorAllowed(role, modality) {
  if (['ADMIN','VICE_DIRECTOR'].includes(role)) return true;
  if (modality === 'LAB') return role === 'LAB';
  return role === 'IMAGING';
}

function labWardWorkflowRole(role) {
  return ['NURSE','MIDWIFE','DOCTOR'].includes(String(role || '').toUpperCase());
}

function sessionFor(request, database) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const hash = tokenHash(token);
  const session = database.findSession(hash);
  const now = Date.now();
  if (!session || session.expires_at <= now || session.is_active !== 1) {
    if (session) database.deleteSession(hash);
    return null;
  }
  if (now - session.last_seen_at > 60_000) database.touchSession(hash, now);
  const context = readSessionContext(database, hash);
  return { ...session, ...context, rawToken: token, tokenHash: hash };
}

function sameOrigin(request, config) {
  if (!request.headers.origin) return true;
  if (request.headers.origin === config.appOrigin) return true;
  try {
    const originHost = new URL(request.headers.origin).host;
    const reqHost = request.headers.host;
    if (originHost && reqHost && originHost.toLowerCase() === reqHost.toLowerCase()) return true;
  } catch {}
  return false;
}

function audit(database, request, action, values = {}) {
  let activeRole = '';
  let activeWard = '';
  try {
    const raw = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (raw) {
      const context = readSessionContext(database, tokenHash(raw));
      activeRole = context?.active_role || '';
      activeWard = context?.active_ward_code || '';
    }
  } catch {}
  database.audit({
    id: crypto.randomUUID(),
    userId: values.userId,
    subjectUsername: values.subjectUsername,
    action,
    ipAddress: requestIp(request),
    userAgent: String(request.headers['user-agent'] ?? '').slice(0, 500),
    details: { ...(values.details || {}), activeRole, activeWard },
    occurredAt: Date.now(),
  });
}

function genericLoginFailure(response, config, retryAfterSeconds) {
  if (retryAfterSeconds) response.setHeader('Retry-After', String(retryAfterSeconds));
  sendJson(response, retryAfterSeconds ? 429 : 401, {
    error: retryAfterSeconds
      ? 'Too many login attempts. Please wait and try again.'
      : 'Invalid username or password.',
  }, { secure: config.cookieSecure });
}

function clinicalFormType(pathname) {
  const match = /^\/api\/clinical-forms\/([a-z]+)$/.exec(pathname);
  return match && clinicalFormTypes.has(match[1]) ? match[1] : null;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function boundedText(value, maximumLength, fieldName, required = false) {
  if (value === undefined || value === null) {
    if (required) badRequest(`${fieldName} is required.`);
    return '';
  }
  if (typeof value !== 'string') badRequest(`${fieldName} must be text.`);
  const text = value.trim();
  if (required && !text) badRequest(`${fieldName} is required.`);
  if (text.length > maximumLength || /[\u0000-\u001f\u007f]/.test(text)) {
    badRequest(`${fieldName} is invalid.`);
  }
  return text;
}

function clinicalPatientKey(value) {
  const key = boundedText(value, 160, 'Patient key', true);
  if (key.length < 3) badRequest('Patient key is invalid.');
  return key;
}

function sanitizePatientSnapshot(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Patient information is invalid.');
  }
  const allowedFields = new Map([
    ['caseNumber', 120], ['healthId', 120], ['firstName', 160], ['lastName', 160],
    ['age', 30], ['sex', 40], ['dateOfBirth', 40],
  ]);
  const patient = {};
  for (const [field, maximumLength] of allowedFields) {
    if (value[field] !== undefined && value[field] !== null && value[field] !== '') {
      patient[field] = boundedText(value[field], maximumLength, `Patient ${field}`);
    }
  }
  return patient;
}

function sanitizeClinicalFormData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Clinical form data must be an object.');
  }
  const entries = Object.entries(value);
  if (entries.length > 512) badRequest('Clinical form contains too many fields.');
  const data = Object.create(null);
  for (const [key, fieldValue] of entries) {
    if (!key || key.length > 160 || /[\u0000-\u001f\u007f]/.test(key) ||
        ['__proto__', 'prototype', 'constructor'].includes(key)) {
      badRequest('Clinical form contains an invalid field name.');
    }
    if (fieldValue === null || typeof fieldValue === 'boolean') {
      data[key] = fieldValue;
    } else if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
      data[key] = fieldValue;
    } else if (typeof fieldValue === 'string' && fieldValue.length <= 10_000 &&
               !fieldValue.includes('\u0000')) {
      data[key] = fieldValue;
    } else if (Array.isArray(fieldValue) && fieldValue.length <= 100 &&
               fieldValue.every(item => typeof item === 'string' && item.length <= 2_000 &&
                 !item.includes('\u0000'))) {
      data[key] = [...fieldValue];
    } else {
      badRequest(`Clinical form field ${key} has an invalid value.`);
    }
  }
  return data;
}

function parseStoredJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const newWardMedicineSubject = 'អ្នកជំងឺថ្មីក្នុងបញ្ជីឱសថ';

function medicineRows(value) {
  try {
    const rows = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(rows) ? rows.filter(item => item && typeof item.name === 'string' && item.name.trim()) : [];
  } catch { return []; }
}

function wardMedicineOrderDates(data, entryDate) {
  const dates = new Set();
  if (medicineRows(data['system:initialIpdMedications']).length) {
    dates.add(/^\d{4}-\d{2}-\d{2}$/.test(data['scope:medical:id:ipd_first_exam_date'] || '')
      ? data['scope:medical:id:ipd_first_exam_date'] : entryDate);
  }
  try {
    const records = JSON.parse(data['system:dailyMonitoringRecords'] || '[]');
    if (Array.isArray(records)) for (const record of records) {
      if (medicineRows(record?.medications).length && /^\d{4}-\d{2}-\d{2}/.test(record.dtVal || '')) dates.add(record.dtVal.slice(0,10));
    }
  } catch { /* Malformed follow-ups cannot create ward orders. */ }
  return [...dates].sort().reverse();
}

function notifyPharmacyOfNewWardPatient(database, patient, actor, previousData, pendingDate = '') {
  if (patient.service_mode !== 'ipd' || !['DOCTOR','NURSE','MIDWIFE'].includes(actor.role)) return null;
  if (wardMedicineOrderDates(previousData, patient.entry_date).length) return null;
  const prior = database.sqlite.prepare(`SELECT id FROM staff_messages WHERE patient_key=? AND destination_type='PHARMACY'
    AND subject LIKE ? LIMIT 1`).get(patient.patient_key, `${newWardMedicineSubject}%`);
  if (prior) return null;
  const wardCode = patientWorkWard(patient);
  if (!WARDS.some(ward => ward.code === wardCode && wardCode !== 'opd')) return null;
  const data = parseStoredJson(patient.record_json);
  for (const date of pendingDate ? [pendingDate] : wardMedicineOrderDates(data, patient.entry_date)) {
    let report;
    try { report = reviewedWardMedicineReport(database, date, wardCode); }
    catch { continue; }
    if (!report.patients.some(item => item.patientKey === patient.patient_key && item.medications.length)) continue;
    return createStaffMessage(database, {
      senderUserId:actor.userId, senderRole:actor.role, senderWardCode:wardCode,
      destinationType:'PHARMACY', patientKey:patient.patient_key,
      subject:`${newWardMedicineSubject} · ${date}`,
      body:`${patient.full_name} · ${patient.case_number || patient.patient_key} ត្រូវបានបញ្ចូលក្នុងបញ្ជីឱសថ ${report.wardNameKh} ថ្ងៃទី ${date}។ ចុច «បើកបញ្ជីឱសថ» ដើម្បីពិនិត្យ។`,
    });
  }
  return null;
}

function clinicalRecordResponse(row) {
  return {
    id: row.id,
    patientKey: row.patient_key,
    formType: row.form_type,
    patient: parseStoredJson(row.patient_json),
    data: parseStoredJson(row.form_data_json),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Patient record data must be an object.');
  }
  const entries = Object.entries(value);
  if (entries.length > 6_000) badRequest('Patient record contains too many fields.');
  const data = Object.create(null);
  for (const [key, fieldValue] of entries) {
    if (!key || key.length > 220 || /[\u0000-\u001f\u007f]/.test(key) ||
        ['__proto__', 'prototype', 'constructor'].includes(key)) {
      badRequest('Patient record contains an invalid field name.');
    }
    if (PATIENT_PHOTO_FIELDS.has(key)) {
      if (!validPatientPhoto(fieldValue)) badRequest(`Patient photo ${key} must be a JPEG, PNG or WebP data URL under 512,000 characters.`);
      data[key] = fieldValue;
    } else if (fieldValue === null || typeof fieldValue === 'boolean') {
      data[key] = fieldValue;
    } else if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
      data[key] = fieldValue;
    } else if (typeof fieldValue === 'string' &&
               fieldValue.length <= (key === 'system:dailyMonitoringRecords' ? 500_000 :
                 key === 'system:initialIpdMedications' || key === 'system:opdMedications' ? 150_000 : 20_000) &&
               !fieldValue.includes('\u0000')) {
      data[key] = fieldValue;
    } else if (Array.isArray(fieldValue) && fieldValue.length <= 300 &&
               fieldValue.every(item => typeof item === 'string' && item.length <= 4_000 &&
                 !item.includes('\u0000'))) {
      data[key] = [...fieldValue];
    } else {
      badRequest(`Patient record field ${key} has an invalid value.`);
    }
  }
  const pCode = data['scope:registration:id:web_province_code'] || data['id:web_province_code'];
  const dCode = data['scope:registration:id:web_district_code'] || data['id:web_district_code'];
  const cCode = data['scope:registration:id:web_commune_code'] || data['id:web_commune_code'];
  const vCode = data['scope:registration:id:web_village_code'] || data['id:web_village_code'];
  if (pCode || dCode || cCode || vCode) {
    const check = validateAddressHierarchy({ provinceCode: pCode, districtCode: dCode, communeCode: cCode, villageCode: vCode });
    if (!check.valid) {
      badRequest(`Invalid patient address hierarchy: ${check.error}`);
    }
  }
  const cPhone = data['scope:registration:id:web_caregiver_phone'] || data['web_caregiver_phone'];
  if (cPhone) {
    const cgCheck = validateCambodianPhone(cPhone, 'km');
    if (!cgCheck.valid) {
      badRequest(`Invalid caregiver phone number: ${cgCheck.error}`);
    }
    if (data['scope:registration:id:web_caregiver_phone']) data['scope:registration:id:web_caregiver_phone'] = cgCheck.normalized;
    if (data['web_caregiver_phone']) data['web_caregiver_phone'] = cgCheck.normalized;
  }
  const pPhone = data['scope:registration:id:web_phone'] || data['web_phone'];
  if (pPhone) {
    const pCheck = validateCambodianPhone(pPhone, 'km');
    if (!pCheck.valid) {
      badRequest(`Invalid patient phone number: ${pCheck.error}`);
    }
    if (data['scope:registration:id:web_phone']) data['scope:registration:id:web_phone'] = pCheck.normalized;
    if (data['web_phone']) data['web_phone'] = pCheck.normalized;
  }
  return data;
}

function calendarDate(value, fieldName) {
  const date = boundedText(value, 10, fieldName);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) badRequest(`${fieldName} is invalid.`);
  return date;
}

function sanitizePatientSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Patient summary is invalid.');
  }
  const text = (field, maximumLength = 160) => boundedText(value[field], maximumLength, field);
  const serviceMode = text('serviceMode', 8);
  if (serviceMode && !['opd', 'ipd'].includes(serviceMode)) badRequest('Service mode is invalid.');
  const firstName = text('firstName');
  const lastName = text('lastName');
  return {
    caseNumber: text('caseNumber', 120),
    healthId: text('healthId', 120),
    firstName,
    lastName,
    fullName: text('fullName', 320) || [lastName, firstName].filter(Boolean).join(' '),
    sex: text('sex', 40),
    age: text('age', 80),
    dateOfBirth: calendarDate(value.dateOfBirth, 'dateOfBirth'),
    phone: (() => {
      let p = text('phone', 80);
      if (p) {
        const check = validateCambodianPhone(p, 'km');
        if (!check.valid) badRequest(`Invalid phone number: ${check.error}`);
        return check.normalized;
      }
      return p;
    })(),
    equityCard: text('equityCard', 120),
    paymentType: text('paymentType', 120),
    departmentCode: text('departmentCode', 80),
    departmentNameKh: text('departmentNameKh', 240),
    departmentNameEn: text('departmentNameEn', 240),
    serviceMode,
    entryDate: calendarDate(value.entryDate, 'entryDate'),
    dischargeDate: calendarDate(value.dischargeDate, 'dischargeDate'),
    triageId: text('triageId', 120),
    serviceCode: text('serviceCode', 120),
    encounterId: text('encounterId', 120),
  };
}

function triageVitalsFromData(data) {
  const read = (...keys) => {
    for (const key of keys) {
      const value = data?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };
  return {
    temperature: read('scope:triage:id:p2_temp', 'id:p2_temp'),
    systolic: read('scope:triage:id:p2_bp_sys', 'id:p2_bp_sys'),
    diastolic: read('scope:triage:id:p2_bp_dia', 'id:p2_bp_dia'),
    pulse: read('scope:triage:id:p2_pulse', 'id:p2_pulse'),
    respiratoryRate: read('scope:triage:id:p2_resp', 'id:p2_resp'),
    oxygenSaturation: read('scope:triage:id:p2_spo2', 'id:p2_spo2'),
    weight: read('scope:triage:id:p2_weight', 'id:p2_weight'),
    height: read('scope:triage:id:p2_height', 'id:p2_height'),
    bloodGlucose: read('scope:triage:id:p2_glucose', 'id:p2_glucose'),
    glucoseTiming: read('scope:triage:id:p2_glucose_before_meal', 'id:p2_glucose_before_meal') === true
      ? 'before_meal'
      : read('scope:triage:id:p2_glucose_after_meal', 'id:p2_glucose_after_meal') === true
        ? 'after_meal'
        : '',
  };
}

// HEF clinical imports depend on payer membership, independently of invoice review.
function pmrsPaymentCategoryStatus(database,patientKey){
 const profile=patientBill(database,patientKey)?.profile;
 if(majorPaymentCategory(profile?.paymentType)==='HEF'){
  if(profile.paymentType==='HEF_POOR')return 'HEF_POOR';if(profile.paymentType==='HEF_VULNERABLE')return 'HEF_VULNERABLE_FAMILY';
  return profile.hefType==='VULNERABLE'?'HEF_VULNERABLE':'HEF_EQUITY';
 }
 return paymentStatusForPatient(database,patientKey)?.code||'';
}
function patientRecordResponse(row, includeData = true, preParsedData = null) {
  const data = preParsedData || (row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json)));
  const storedDischarge = data['system:discharge'] && typeof data['system:discharge'] === 'object'
    ? data['system:discharge'] : null;
  const isFormallyDischarged = data['system:admissionStatus'] === 'discharged' && Boolean(storedDischarge);
  const isOpdDischarged = row.service_mode === 'opd' && Boolean(data['system:opdDischarge']?.dispensedAt);
  const admissionStatus = data['system:admissionStatus'] === 'discharged' && !isFormallyDischarged
    ? '' : (data['system:admissionStatus'] || '');
  const response = {
    id: row.id,
    patientKey: row.patient_key,
    caseNumber: row.case_number,
    healthId: row.health_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    sex: String(row.sex || '').toUpperCase() === 'M' || row.sex === 'ប្រុស' ? 'ប្រុស' : (String(row.sex || '').toUpperCase() === 'F' || row.sex === 'ស្រី' ? 'ស្រី' : (row.sex || '')),
    age: row.age,
    dateOfBirth: row.date_of_birth,
    phone: row.phone,
    equityCard: row.equity_card,
    paymentType: row.payment_type,
    departmentCode: row.department_code,
    departmentNameKh: row.department_name_kh,
    departmentNameEn: row.department_name_en,
    serviceMode: row.service_mode,
    entryDate: row.entry_date,
    // Publish dates only after the IPD discharge form or OPD pharmacy receipt.
    // This also masks legacy registration dates that were accidentally saved
    // in the discharge column by older builds.
    dischargeDate: isFormallyDischarged || isOpdDischarged ? row.discharge_date : '',
    dischargeAt: isOpdDischarged ? data['system:opdDischarge'].dispensedAt : (isFormallyDischarged ? storedDischarge.dischargeAt : null),
    entryTime: data['scope:registration:id:web_time'] || data['id:web_time'] || '',
    medicalRecordCompleted: data['system:medicalRecordCompleted'] === true ||
      data['system:medicalRecordCompleted'] === 'true',
    admissionStatus,
    careType: data['system:careType'] || '',
    currentWardCode: data['system:currentWardCode'] || '',
    currentRoomId: data['system:currentRoomId'] || '',
    currentRoomNameKh: data['system:currentRoomNameKh'] || '',
    currentRoomNameEn: data['system:currentRoomNameEn'] || '',
    currentBedId: data['system:currentBedId'] || '',
    currentBedLabel: data['system:currentBedLabel'] || '',
    discharge: isFormallyDischarged ? storedDischarge : null,
    workflowStage: data['system:workflowStage'] || '',
    triageStatus: data['system:triageStatus'] || '',
    triageId: data['system:triageId'] || data['scope:triage:id:web_triage_id'] || data['triageId'] || '',
    serviceCode: data['system:serviceCode'] || data['scope:triage:id:web_service_code'] || data['serviceCode'] || '',
    encounterId: data['system:encounterId'] || data['scope:triage:id:web_encounter_id'] || data['encounterId'] || '',
    registeredAt: Number(data['system:registeredAt'] || 0) || row.created_at,
    triageCompletedAt: Number(data['system:triageCompletedAt'] || 0) || null,
    triageReferredWardCode: data['system:triageReferredWardCode'] || '',
    triageVitals: triageVitalsFromData(data),
    diagnosis: data['scope:registration:id:web_diag_in'] || data['scope:medical:id:diag_input'] || '',
    diagnosisIcd10: data['scope:medical:id:diag_input'] || '',
    photo: data['scope:registration:id:web_patient_photo'] ?? data['scope:registration:id:patient_photo'] ?? data['system:patientPhoto'] ?? '',
    address: [
      data['scope:registration:id:web_street_address'] || data['id:web_street_address'],
      data['scope:registration:id:web_village'] || data['id:web_village'],
      data['scope:registration:id:web_commune'] || data['id:web_commune'],
      data['scope:registration:id:web_district'] || data['id:web_district'],
      data['scope:registration:id:web_province'] || data['id:web_province'],
    ].filter(Boolean).join(', '),
    province: data['scope:registration:id:web_province'] || data['id:web_province'] || '',
    provinceCode: data['scope:registration:id:web_province_code'] || data['id:web_province_code'] || '',
    district: data['scope:registration:id:web_district'] || data['id:web_district'] || '',
    districtCode: data['scope:registration:id:web_district_code'] || data['id:web_district_code'] || '',
    commune: data['scope:registration:id:web_commune'] || data['id:web_commune'] || '',
    communeCode: data['scope:registration:id:web_commune_code'] || data['id:web_commune_code'] || '',
    village: data['scope:registration:id:web_village'] || data['id:web_village'] || '',
    villageCode: data['scope:registration:id:web_village_code'] || data['id:web_village_code'] || '',
    streetAddress: data['scope:registration:id:web_street_address'] || data['id:web_street_address'] || '',
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeData) response.data = data;
  return response;
}

function patientDataVisibleForRole(data, role) {
  const normalizedRole = String(role || '').toUpperCase();
  if (normalizedRole !== 'TRIAGE') return data;
  const allowed = new Set(['system:caseType','system:triageStatus','system:workflowStage','system:registeredAt','system:triageCompletedAt','system:triageReferredWardCode','system:signature:triage']);
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key) || key.startsWith('scope:registration:') || key.startsWith('scope:triage:')));
}

function localDateTime(value, fieldName, required = false) {
  const dateTime = boundedText(value, 30, fieldName, required);
  if (dateTime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(dateTime)) {
    badRequest(`${fieldName} is invalid.`);
  }
  return dateTime;
}

function boundedMultilineText(value, maximumLength, fieldName, required = false) {
  if (value === undefined || value === null) {
    if (required) badRequest(`${fieldName} is required.`);
    return '';
  }
  if (typeof value !== 'string') badRequest(`${fieldName} must be text.`);
  const text = value.trim();
  if (required && !text) badRequest(`${fieldName} is required.`);
  if (text.length > maximumLength || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    badRequest(`${fieldName} is invalid.`);
  }
  return text;
}


function followupDatePolicy(database) {
  const row = database.findHospitalState('settings');
  const state = row ? parseStoredJson(row.state_json) : null;
  return { allowFuture: state?.followupDatePolicy?.allowFuture === true };
}


function registrationQueueNumberFromData(data) {
  const raw = data?.['system:registrationQueueNumber'] ?? data?.['scope:registration:id:registration_queue_number'] ?? '';
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^\d{1,4}$/.test(text)) badRequest('Queue number must be a number from 1 to 9999.');
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > 9999) badRequest('Queue number must be a number from 1 to 9999.');
  return String(value);
}

function ensureUniqueRegistrationQueueNumber(database, patientKey, entryDate, queueNumber) {
  if (!queueNumber) return;
  const duplicate = database.sqlite.prepare(`SELECT p.patient_key, p.full_name FROM patient_records p
    WHERE p.patient_key<>? AND p.entry_date=?`).all(patientKey || '', entryDate || '');
  for (const row of duplicate) {
    try {
      const data = JSON.parse(row.record_json || '{}');
      const value = String(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || '').trim();
      if (value && Number(value) === Number(queueNumber)) badRequest(`Queue number ${queueNumber} is already used by ${row.full_name || row.patient_key} on ${entryDate}.`);
    } catch {}
  }
}

function nextRegistrationQueueNumber(database, patientKey, entryDate) {
  let highest = 0;
  const rows = database.sqlite.prepare(`SELECT patient_key, record_json FROM patient_records
    WHERE patient_key<>? AND entry_date=? ORDER BY created_at, patient_key`).all(patientKey || '', entryDate || '');
  for (const row of rows) {
    try {
      const value = Number(registrationQueueNumberFromData(JSON.parse(row.record_json || '{}')) || 0);
      if (Number.isInteger(value) && value > highest) highest = value;
    } catch {}
  }
  if (highest >= 9999) badRequest('The daily registration queue has reached its limit.');
  return String(highest + 1);
}

function patientClinicalClosed(database, row, dispensedKeys = null, preParsedData = null) {
  if (!row) return false;
  const data = preParsedData || (row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json)));
  if (row.service_mode === 'ipd' && data['system:admissionStatus'] === 'discharged') return true;
  if (row.service_mode === 'opd') {
    if (dispensedKeys) return dispensedKeys.has(row.patient_key);
    const latest = database.sqlite.prepare(`SELECT dispensed_at FROM pharmacy_prescriptions WHERE patient_key=? ORDER BY rowid DESC LIMIT 1`).get(row.patient_key);
    if (latest?.dispensed_at) return true;
  }
  return false;
}

function updateWorkflowStageAfterPayment(database, patientKey, actor = {}) {
  const row = database.findPatient(patientKey);
  if (!row) return;
  const invoiceId = String(actor.invoiceId || '');
  const status = paymentStatusForPatient(database, patientKey, invoiceId);
  const data = parseStoredJson(row.record_json);
  const paidEnough = ['PAID','INSURANCE','NGO','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER'].includes(status?.code);
  const bill = patientBill(database, patientKey, invoiceId);
  const invoiceSettled = paidEnough && (Boolean(bill?.invoice?.coverageAt) || Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0) <= 0);
  const queueRequest = data['system:cashierQueueRequest'];
  if (invoiceSettled && queueRequest && (!invoiceId || !queueRequest.invoiceId || queueRequest.invoiceId === invoiceId)) {
    delete data['system:cashierQueueRequest'];
  }
  let releasedOrders = [];
  if (row.service_mode === 'opd') {
    const hasConsultationCharge = invoiceId && database.sqlite.prepare(`SELECT 1 FROM finance_charges
      WHERE patient_key=? AND invoice_id=? AND service_code IN ('OPD_CONSULT','RH-OPDSPEC','HC-GEN') AND voided_at IS NULL LIMIT 1`).get(patientKey,invoiceId);
    if (invoiceSettled && hasConsultationCharge) {
      data['system:opdConsultationPaidAt'] = Date.now();
      data['system:opdConsultationInvoiceId'] = invoiceId;
    }
    if (data['system:triageStatus'] === 'COMPLETED') {
      try {
        if (invoiceId && invoiceSettled) {
          releasedOrders = releasePaidOpdParaclinicOrders(database, patientKey, invoiceId);
        } else if (!invoiceId && paidEnough && (data['system:triageParaclinic'] === true || data['system:triageParaclinic'] === 'true')) {
          // Compatibility for older triage requests that predate invoice-linked release.
          releasedOrders = releasePaidOpdParaclinicOrders(database, patientKey);
        }
      } catch {}
      const stillWaitingForCashier = database.sqlite.prepare(`SELECT 1 FROM paraclinic_orders
        WHERE patient_key=? AND status='PAYMENT_PENDING' LIMIT 1`).get(patientKey);
      if (invoiceSettled) {
        if (stillWaitingForCashier) data['system:workflowStage'] = 'CASHIER_PENDING_PARACLINIC';
        else if (data['system:opdPreConsultParaclinicAt'] && !data['system:opdConsultedAt']) data['system:workflowStage'] = 'PARACLINIC_RESULTS_PENDING';
        else data['system:workflowStage'] = 'DOCTOR_READY';
      }
      for (const order of releasedOrders) {
        try {
          if (order.request?.opdHandoff?.method === 'NURSE') {
            const task=order.modality==='LAB'?'collect the specimen and send it to Laboratory':'coordinate the patient and send the request to Imaging';
            automaticWardMessage(database,{userId:actor.userId||'',role:actor.role||'ACCOUNTANT',wardCode:'opd'},row,
              `OPD ${order.modality==='LAB'?'sample collection':'imaging coordination'} required • ${order.accessionNumber}`,
              `Cashier confirmed payment. Please ${task}.`,{wardCode:'opd',destinationRole:'NURSE'});
          } else {
            const destinationType = order.modality === 'LAB' ? 'LAB' : 'IMAGING';
            const destinationCode = order.modality === 'LAB' ? 'lab' : 'imaging';
            createSystemMessage(database, {
              senderUserId:actor.userId||'', senderRole:actor.role||'ACCOUNTANT', senderWardCode:'opd',
              destinationType, destinationCode,
              subject:`New ${order.modality} request • ${order.accessionNumber}`,
              body:`Cashier confirmed payment/eligible coverage. ${order.modality === 'LAB' ? 'Laboratory order' : 'Imaging request'} ${order.accessionNumber} is ready for processing.`,
              patientKey,
            });
          }
        } catch {}
      }
    }
  } else if (row.service_mode === 'ipd') {
    // Financial settlement never blocks bed admission or moves an admitted patient back to waiting.
    if (data['system:triageStatus'] === 'COMPLETED' && !data['system:currentBedId']
        && !['admitted','discharged'].includes(data['system:admissionStatus'])
        && !['ADMITTED','DISCHARGED'].includes(data['system:workflowStage'])) data['system:workflowStage'] = 'WARD_WAITING';
  }
  database.sqlite.prepare('UPDATE patient_records SET record_json=?, updated_at=? WHERE patient_key=?').run(JSON.stringify(data), Date.now(), patientKey);
}

function opdConsultationPaymentConfirmed(database, patientOrKey) {
  const patient = typeof patientOrKey === 'string' ? database.findPatient(patientOrKey) : patientOrKey;
  if (!patient || String(patient.service_mode || '').toLowerCase() !== 'opd') return false;
  const data = parseStoredJson(patient.record_json);
  const consultationInvoiceId = String(data['system:opdConsultationInvoiceId'] || '');
  const bill = patientBill(database,patient.patient_key,consultationInvoiceId || undefined);
  if (!bill?.invoice?.id) return false;
  const balance = Number(bill.summary?.KHR?.balance || 0) + Number(bill.summary?.USD?.balance || 0);
  if (balance > 0) return false;
  const consultationCharge = database.sqlite.prepare(`SELECT 1 FROM finance_charges
    WHERE patient_key=? AND invoice_id=? AND service_code IN ('OPD_CONSULT','RH-OPDSPEC','HC-GEN') AND voided_at IS NULL LIMIT 1`)
    .get(patient.patient_key,bill.invoice.id);
  return Boolean(Number(data['system:opdConsultationPaidAt'] || 0) || consultationCharge);
}

function opdConsultationPaymentRecorded(database, patientOrKey) {
  const patient = typeof patientOrKey === 'string' ? database.findPatient(patientOrKey) : patientOrKey;
  if (!patient || String(patient.service_mode || '').toLowerCase() !== 'opd') return false;
  const data = parseStoredJson(patient.record_json);
  return Boolean(Number(data['system:opdConsultationPaidAt'] || 0) || opdConsultationPaymentConfirmed(database,patient));
}

function paidOpdQueuePatients(database, date) {
  return listOpdQueue(database,date).filter(patient =>
    (['DOCTOR_READY','IN_CONSULTATION'].includes(patient.workflowStage) && opdConsultationPaymentConfirmed(database,patient.patientKey)) ||
    patient.workflowStage === 'OPD_PARACLINIC_ORDERING');
}

function visibleOpdQueuePatients(database, date) {
  const queued = listOpdQueue(database,date);
  const visibleKeys = new Set(paidOpdQueuePatients(database,date).map(patient => patient.patientKey));
  for (const item of queued) {
    if (!item.transferredToIpdAt) continue;
    const patient = database.findPatient(item.patientKey);
    const data = parseStoredJson(patient?.record_json);
    if (Number(data['system:opdConsultationPaidAt'] || 0) > 0) visibleKeys.add(item.patientKey);
  }
  for (const item of queued) {
    if (item.workflowStage === 'OPD_PARACLINIC_ORDERING' || item.workflowStage === 'CASHIER_PENDING_PARACLINIC' || item.workflowStage === 'PARACLINIC_RESULTS_PENDING') {
      visibleKeys.add(item.patientKey);
    }
  }
  return queued.filter(patient => visibleKeys.has(patient.patientKey));
}

const OPD_INVESTIGATION_KEY = 'scope:medical:id:inv_list';
const OPD_PARACLINIC_BASE_KEY = 'system:opdParaclinicBaseInvestigation';
const OPD_PARACLINIC_GENERATED_KEY = 'system:opdParaclinicGeneratedLines';

function opdParaclinicOrderLine(database, order) {
  const modality = String(order?.modality || '').toUpperCase();
  const request = order?.request || {};
  if (modality === 'LAB') {
    const names = new Map(labCatalog(database).map(test => [String(test.code || '').toUpperCase(), test.name || test.code]));
    const tests = (request.items || []).map(item => {
      const code = String(item?.code || '').toUpperCase();
      const name = names.get(code) || code;
      return name && code && name !== code ? `${name} (${code})` : (name || code);
    }).filter(Boolean);
    return tests.length ? `- Laboratory: ${tests.join(', ')}` : '';
  }
  const label = ({ ULTRASOUND:'Ultrasound', XRAY:'X-ray', CT:'CT', MRI:'MRI' })[modality] || modality;
  const details = [request.examination, modality === 'XRAY' ? request.projection : '',
    ['CT','MRI'].includes(modality) && request.contrast !== 'Radiology to decide' ? request.contrast : '']
    .filter(Boolean).join(' · ');
  return label && details ? `- ${label}: ${details}` : '';
}

function storedGeneratedOpdParaclinicLines(data) {
  const stored = data?.[OPD_PARACLINIC_GENERATED_KEY];
  if (Array.isArray(stored)) return stored.map(line => String(line).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(String(stored || '[]'));
    return Array.isArray(parsed) ? parsed.map(line => String(line).trim()).filter(Boolean) : [];
  } catch { return []; }
}

function syncOpdParaclinicToRecord(database, patientKey, sourceText) {
  const patient = database.findPatient(patientKey);
  if (!patient || patient.service_mode !== 'opd') return '';
  const data = parseStoredJson(patient.record_json);
  const allOrders = listOrders(database, { patientKey });
  const activeOrders = allOrders.filter(order => order.status !== 'CANCELLED');
  const generatedLines = activeOrders.flatMap(order => [
    opdParaclinicOrderLine(database, order),
  ]).map(line => String(line || '').trim()).filter(Boolean);
  const uniqueGeneratedLines = [...new Set(generatedLines)];
  const previousGenerated = storedGeneratedOpdParaclinicLines(data);
  const currentText = typeof sourceText === 'string'
    ? sourceText.trimEnd()
    : String(data[OPD_INVESTIGATION_KEY] || '').trimEnd();
  const automaticLines = new Set([...previousGenerated, ...uniqueGeneratedLines]);
  let baseLines = currentText.split(/\r?\n/).map(line => line.trimEnd())
    .filter(line => line.trim() && !automaticLines.has(line.trim()));
  let base = baseLines.join('\n').trim();
  const hasGeneratedMetadata = Object.prototype.hasOwnProperty.call(data, OPD_PARACLINIC_GENERATED_KEY);
  if (typeof sourceText !== 'string' && !hasGeneratedMetadata &&
      Object.prototype.hasOwnProperty.call(data, OPD_PARACLINIC_BASE_KEY)) {
    // Older triage-review records saved the original clinician text separately.
    base = String(data[OPD_PARACLINIC_BASE_KEY] || '').trim();
  }
  if (!activeOrders.length && !previousGenerated.length && !Object.prototype.hasOwnProperty.call(data, OPD_PARACLINIC_BASE_KEY)) {
    return currentText;
  }
  const investigationText = [base, ...uniqueGeneratedLines].filter(Boolean).join('\n');
  data[OPD_PARACLINIC_BASE_KEY] = base;
  data[OPD_PARACLINIC_GENERATED_KEY] = JSON.stringify(uniqueGeneratedLines);
  data[OPD_INVESTIGATION_KEY] = investigationText;
  database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?')
    .run(JSON.stringify(data), Date.now(), patientKey);
  return investigationText;
}

function addCatalogCharge(database, patientKey, serviceCode, actorId, sourceKey, note='', quantity=1, newInvoiceId='') {
  const service=serviceCatalog(database,{includeInactive:true}).find(item=>item.code===String(serviceCode||'').toUpperCase()&&item.active!==false);
  if(!service)return null;
  if(service.currency==='USD') {
    const rate=exchangeRateState(database).active?.khrPerUsd;
    if(!rate) throw new Error('An approved USD to KHR exchange rate is required for this service.');
    const conversion=`US$${Number(service.defaultAmount).toFixed(2)} × ${Number(rate).toLocaleString()} KHR/USD`;
    return addCharge(database,patientKey,{serviceCode:service.code,sourceKey,quantity,currency:'KHR',unitAmount:Number(service.defaultAmount)*Number(rate),note:[note,conversion].filter(Boolean).join(' · ')},actorId,Date.now(),{newInvoiceId});
  }
  return addCharge(database,patientKey,{serviceCode:service.code,sourceKey,quantity,note},actorId,Date.now(),{newInvoiceId});
}

function addParaclinicCharges(database, patientKey, order, actorId, { strict = false } = {}) {
  const prefix=`PARACLINIC:${order.id}:`;
  if(order.modality==='LAB') {
    const feeAliases={GLU:'GLUCOSE',TG:'TRIGLYCERIDE',UA:'URINE_TEST',MALARIA_RDT:'MALARIA',DENGUE_NS1:'DENGUE_NS1'};
    return (order.request?.items||[]).map(item=>{
      const testCode=String(item.code||'').toUpperCase();
      const serviceCode=feeAliases[testCode]||testCode;
      if(strict) {
        const service=serviceCatalog(database).find(entry=>entry.code===serviceCode);
        if(!service || Number(service.defaultAmount)<=0) throw new Error(`No active cashier fee is configured for laboratory test ${testCode}. Ask Admin/Director to add its fee, or mark the request as free.`);
      }
      const charge=addCatalogCharge(database,patientKey,serviceCode,actorId,`${prefix}${testCode}`);
      if(strict&&!charge) throw new Error(`Unable to add the cashier fee for laboratory test ${testCode}.`);
      return charge;
    }).filter(Boolean);
  }
  const serviceCode=({
    ULTRASOUND:'ULTRASOUND',
    XRAY:'XRAY_SINGLE_PLATE',
    CT:'CT_SCAN',
    MRI:'MRI',
    ECG:'ECG',
    EEG:'EEG',
    ECHOCARDIOLOGY:'ECHOCARDIOLOGY',
    FIBROSCOPY:'FIBROSCOPY',
    COLOSCOPY:'COLOSCOPY',
    OTOSCOPY:'OTOSCOPY',
    RHINOSCOPY:'RHINOSCOPY',
    BRONCHOSCOPY:'BRONCHOSCOPY',
    LARYNGOSCOPY:'LARYNGOSCOPY'
  })[order.modality];
  if(strict) {
    const service=serviceCatalog(database).find(entry=>entry.code===serviceCode);
    if(!service || Number(service.defaultAmount)<=0) throw new Error(`No active cashier fee is configured for ${order.modality}. Ask Admin/Director to add its fee, or mark the request as free.`);
  }
  const charge=serviceCode?addCatalogCharge(database,patientKey,serviceCode,actorId,`${prefix}${serviceCode}`):null;
  if(strict&&!charge) throw new Error(`Unable to add the cashier fee for ${order.modality}.`);
  return charge?[charge]:[];
}

function validateDailyMonitoringDates(database, submittedData) {
  if (!Object.prototype.hasOwnProperty.call(submittedData || {}, 'system:dailyMonitoringRecords')) return;
  const raw = submittedData['system:dailyMonitoringRecords'];
  let records = [];
  try { records = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { records = []; }
  if (!Array.isArray(records)) return;
  const policy = followupDatePolicy(database);
  if (policy.allowFuture) return;
  const now = Date.now();
  const future = records.find(record => {
    if (!record || typeof record !== 'object') return false;
    const rawDate = String(record.dtVal || '').trim();
    if (!rawDate) return false;
    const ms = new Date(rawDate).getTime();
    return Number.isFinite(ms) && ms > now + 5000;
  });
  if (future) badRequest('Daily follow-up date/time cannot be later than the current date and time. Ask the administrator to enable future follow-up dates for testing.');
}

function cleanSummaryText(value, limit = 2000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function summaryMedicationEntries(raw) {
  let rows = [];
  try { rows = Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { rows = []; }
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    const name = cleanSummaryText(row?.name || row?.medicine || row?.medication || row?.drug, 200);
    if (!name) return '';
    const dose = cleanSummaryText(row?.doseAmount || row?.dose || row?.strength || '', 80);
    const unit = cleanSummaryText(row?.unit || '', 40);
    const route = cleanSummaryText(row?.route || '', 60);
    const schedule = cleanSummaryText(row?.scheduleType || row?.schedule || row?.frequency || '', 80);
    const days = cleanSummaryText(row?.d || row?.days || row?.duration || '', 40);
    return [name, dose && unit ? `${dose} ${unit}` : dose, route, schedule, days ? `${days} day(s)` : ''].filter(Boolean).join(' · ');
  }).filter(Boolean);
}

function buildIpdDischargeSummary(database, patient, data, discharge) {
  const read = (...keys) => keys.map(key => data?.[key]).find(value => value !== undefined && value !== null && cleanSummaryText(value)) || '';
  const daily = (() => {
    try { const parsed = JSON.parse(data?.['system:dailyMonitoringRecords'] || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  })();
  const initialMedications = summaryMedicationEntries(data?.['system:initialIpdMedications']);
  const dailyMedicationRows = [];
  const evolution = daily.map((row, index) => {
    const meds = summaryMedicationEntries(row?.medications);
    dailyMedicationRows.push(...meds.map(item => `Day ${index + 1}: ${item}`));
    const date = cleanSummaryText(row?.dtVal, 80);
    const vitals = [
      row?.bp_sys || row?.bp_dia ? `BP ${cleanSummaryText(row?.bp_sys)}/${cleanSummaryText(row?.bp_dia)}` : '',
      row?.pulse ? `Pulse ${cleanSummaryText(row.pulse)}` : '',
      row?.temp ? `Temp ${cleanSummaryText(row.temp)}` : '',
      row?.resp ? `RR ${cleanSummaryText(row.resp)}` : '',
      row?.spo2 ? `SpO₂ ${cleanSummaryText(row.spo2)}%` : '',
    ].filter(Boolean).join(', ');
    const progress = cleanSummaryText(row?.evol || row?.assessment || row?.progress, 1500);
    const conclusion = cleanSummaryText(row?.conclusion || row?.plan, 1200);
    return { date, vitals, progress, conclusion, medications: meds };
  });

  let paraclinic = [];
  try {
    paraclinic = listOrders(database, { patientKey: patient.patient_key || patient.patientKey })
      .filter(order => order && order.result && Object.keys(order.result).length)
      .map(order => ({
        modality: order.modality,
        status: order.status,
        requested: cleanSummaryText(order.request?.examination || order.request?.testName || order.request?.clinicalIndication || '', 500),
        findings: cleanSummaryText(order.result?.findings || order.result?.impression || order.result?.conclusion || '', 1500),
        recommendation: cleanSummaryText(order.result?.recommendation || '', 1000),
        items: Array.isArray(order.result?.items) ? order.result.items.map(item => ({
          name: cleanSummaryText(item?.name || item?.code || '', 140),
          value: cleanSummaryText(item?.value, 80), unit: cleanSummaryText(item?.unit, 40), flag: cleanSummaryText(item?.flag, 40), comment: cleanSummaryText(item?.comment, 300),
        })).filter(item => item.name || item.value) : [],
      }));
  } catch {}

  const admissionDate = cleanSummaryText(patient?.entry_date || read('scope:registration:id:web_date'), 40);
  const admissionTime = cleanSummaryText(read('scope:registration:id:web_time'), 20);
  const admissionAt = cleanSummaryText(discharge?.admissionAt || (admissionDate && admissionTime ? `${admissionDate}T${admissionTime}` : admissionDate), 80);
  const admissionDiagnosis = cleanSummaryText(discharge?.admissionDiagnosis || read('scope:medical:id:emr_pmrs_ipd_diagnosis', 'scope:medical:id:diag_input'), 2000);
  const chiefComplaint = cleanSummaryText(read('scope:triage:id:pmrs_chief_complaint'), 1200);
  const admissionVitals = {
    temperature: cleanSummaryText(read('scope:triage:id:p2_temp'), 40),
    bp: [cleanSummaryText(read('scope:triage:id:p2_bp_sys'), 20), cleanSummaryText(read('scope:triage:id:p2_bp_dia'), 20)].filter(Boolean).join('/'),
    pulse: cleanSummaryText(read('scope:triage:id:p2_pulse'), 40),
    resp: cleanSummaryText(read('scope:triage:id:p2_resp'), 40),
    spo2: cleanSummaryText(read('scope:triage:id:p2_spo2'), 40),
    weight: cleanSummaryText(read('scope:triage:id:p2_weight'), 40),
    height: cleanSummaryText(read('scope:triage:id:p2_height'), 40),
    glucose: cleanSummaryText(read('scope:triage:id:p2_glucose'), 40),
    glucoseTiming: read('scope:triage:id:p2_glucose_before_meal') === true ? 'before_meal' : read('scope:triage:id:p2_glucose_after_meal') === true ? 'after_meal' : '',
  };
  const treatment = [...new Set([...initialMedications, ...dailyMedicationRows, ...summaryMedicationEntries(discharge?.medications)])];
  const paraclinicText = paraclinic.map(item => {
    const tests = item.items.map(result => `${result.name}: ${[result.value, result.unit].filter(Boolean).join(' ')}${result.flag ? ` [${result.flag}]` : ''}${result.comment ? ` (${result.comment})` : ''}`).join('; ');
    return `${item.modality}${item.requested ? ` — ${item.requested}` : ''}: ${[item.findings, tests, item.recommendation].filter(Boolean).join(' | ')}`;
  }).filter(Boolean);
  const evolutionText = evolution.map((entry, index) => {
    const heading = entry.date || `Day ${index + 1}`;
    return `${heading}: ${[entry.vitals, entry.progress, entry.conclusion, entry.medications.length ? `Treatment: ${entry.medications.join('; ')}` : ''].filter(Boolean).join(' | ')}`;
  });
  const text = [
    `Admission ${admissionAt || '—'}: ${admissionDiagnosis || '—'}`,
    chiefComplaint ? `Chief complaint: ${chiefComplaint}` : '',
    Object.values(admissionVitals).some(Boolean) ? `Initial vital signs: ${[
      admissionVitals.temperature && `Temp ${admissionVitals.temperature}`,
      admissionVitals.bp && `BP ${admissionVitals.bp}`,
      admissionVitals.pulse && `Pulse ${admissionVitals.pulse}`,
      admissionVitals.resp && `RR ${admissionVitals.resp}`,
      admissionVitals.spo2 && `SpO₂ ${admissionVitals.spo2}%`,
      admissionVitals.weight && `Weight ${admissionVitals.weight} kg`,
      admissionVitals.height && `Height ${admissionVitals.height} cm`,
    ].filter(Boolean).join(', ')}` : '',
    paraclinicText.length ? `Paraclinic findings: ${paraclinicText.join(' || ')}` : '',
    treatment.length ? `Treatment: ${treatment.join('; ')}` : '',
    evolutionText.length ? `Evolution: ${evolutionText.join(' || ')}` : '',
    `Discharge ${cleanSummaryText(discharge?.dischargeAt, 80) || '—'}: ${cleanSummaryText(discharge?.dischargeDiagnosis, 2000) || '—'}; Outcome: ${cleanSummaryText(discharge?.outcome, 160) || '—'}; Status: ${cleanSummaryText(discharge?.status, 160) || '—'}`,
  ].filter(Boolean).join('\n');

  return {
    generatedAt: Date.now(), generatedBy: 'RULE_BASED_EMR_SUMMARY', version: '12.0',
    patientKey: patient.patient_key || patient.patientKey || '',
    admission: { at: admissionAt, diagnosis: admissionDiagnosis, chiefComplaint, vitals: admissionVitals },
    paraclinic,
    treatment: { initial: initialMedications, daily: dailyMedicationRows, discharge: summaryMedicationEntries(discharge?.medications), all: treatment },
    evolution,
    discharge: { at: cleanSummaryText(discharge?.dischargeAt, 80), diagnosis: cleanSummaryText(discharge?.dischargeDiagnosis, 2000), icd10: cleanSummaryText(discharge?.dischargeIcd10, 80), outcome: cleanSummaryText(discharge?.outcome, 160), status: cleanSummaryText(discharge?.status, 160), followUpDate: cleanSummaryText(discharge?.followUpDate, 80) },
    text,
  };
}

function sanitizeAdmissionAction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Admission update is invalid.');
  }
  const action = boundedText(value.action, 20, 'Admission action', true);
  if (!['assign', 'transfer', 'discharge'].includes(action)) {
    badRequest('Admission action is invalid.');
  }
  const text = (field, maximumLength = 240, required = false) =>
    boundedText(value[field], maximumLength, field, required);
  const departmentCode = text('departmentCode', 80, action !== 'discharge');
  const dischargeDate = action === 'discharge'
    ? calendarDate(value.dischargeDate, 'dischargeDate') : '';
  if (action === 'discharge' && !dischargeDate) badRequest('Discharge date is required.');
  const medications = value.medications === undefined ? null : value.medications;
  if (action === 'discharge' && medications !== null &&
    (!Array.isArray(medications) || medications.length > 150)) {
    badRequest('Discharge prescription is invalid.');
  }
  const dischargeMedications = action === 'discharge' && medications !== null ? medications.map((medication, index) => {
    if (!medication || typeof medication !== 'object' || Array.isArray(medication)) {
      badRequest(`Discharge medicine ${index + 1} is invalid.`);
    }
    const read = (key, length = 100) => boundedText(medication[key], length, `Discharge medicine ${key}`);
    return {
      name: read('name', 240), route: read('route', 80), unit: read('unit', 40),
      scheduleType: read('scheduleType', 40), doseAmount: read('doseAmount', 40),
      m: read('m', 40), a: read('a', 40), e: read('e', 40), n: read('n', 40),
      d: read('d', 40), total: read('total', 40), note: read('note', 1_000),
      timingMode: read('timingMode', 40), effectiveAt: read('effectiveAt', 40),
      qHours: read('qHours', 40), protocolDose: read('protocolDose', 120),
      protocolIntervals: read('protocolIntervals', 500),
      protocolRepeatValue: read('protocolRepeatValue', 40),
      protocolRepeatUnit: read('protocolRepeatUnit', 40),
      protocolMaxDoses: read('protocolMaxDoses', 40),
      protocolStopAt: read('protocolStopAt', 40),
    };
  }) : null;
  const discharge = action === 'discharge' ? {
    department: text('dischargeDepartment'),
    admissionDiagnosis: boundedMultilineText(value.admissionDiagnosis, 2_000, 'admissionDiagnosis'),
    admissionIcd10: text('admissionIcd10', 80),
    admissionAt: localDateTime(value.admissionAt, 'admissionAt'),
    dischargeDiagnosis: boundedMultilineText(value.dischargeDiagnosis, 2_000, 'dischargeDiagnosis', true),
    dischargeIcd10: text('dischargeIcd10', 80),
    dischargeAt: localDateTime(value.dischargeAt, 'dischargeAt', true),
    outcome: text('outcome', 160, true),
    status: text('status', 160, true),
    followUpDate: calendarDate(value.followUpDate, 'followUpDate'),
    deceased: value.deceased === true,
    referralDestinationType: text('referralDestinationType', 40),
    referralDestinationName: text('referralDestinationName', 240),
    referralTransport: text('referralTransport', 40),
    ...(dischargeMedications ? { medications: dischargeMedications } : {}),
  } : null;
  if (discharge?.status === 'referred') {
    if (!['PROVINCIAL_HOSPITAL','OTHER'].includes(discharge.referralDestinationType)) {
      badRequest('Referral destination is required.');
    }
    if (discharge.referralDestinationType === 'OTHER' && !discharge.referralDestinationName) {
      badRequest('Referral destination name is required.');
    }
    if (discharge.referralTransport && !['AMBULANCE','OTHER'].includes(discharge.referralTransport)) {
      badRequest('Referral transport is invalid.');
    }
  }
  return {
    action,
    departmentCode,
    departmentNameKh: text('departmentNameKh'),
    departmentNameEn: text('departmentNameEn'),
    roomCode: text('roomCode', 80),
    roomId: text('roomId', 160),
    roomNameKh: text('roomNameKh'),
    roomNameEn: text('roomNameEn'),
    bedId: text('bedId', 160),
    bedLabel: text('bedLabel', 80),
    careType: text('careType', 40),
    dischargeDate,
    discharge,
  };
}

function releasePatientFromHospitalMap(database, patientKey, userId, savedAt) {
  const row = database.findHospitalState('main');
  if (!row) return false;
  const state = parseStoredJson(row.state_json);
  let changed = false;
  if (Array.isArray(state.departments)) {
    state.departments.forEach(department => {
      if (!Array.isArray(department.rooms)) return;
      department.rooms.forEach(room => {
        if (!Array.isArray(room.beds)) return;
        room.beds.forEach(bed => {
          if (bed.patientKey === patientKey) {
            bed.patientKey = '';
            changed = true;
          }
        });
      });
    });
  }
  if (changed) database.upsertHospitalState({ stateKey: 'main', state, userId, savedAt });
  return changed;
}


function hospitalRoomMatchesWard(department,room,wardCode){return roomMatchesWard(department,room,String(wardCode||'').toLowerCase());}

function hospitalStateForSession(state, session) {
  if (!state || typeof state !== 'object') return state;
  if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(sessionRole(session))) return state;
  const ward = sessionWard(session);
  if (!ward) return state;
  const scoped = JSON.parse(JSON.stringify(state));
  if (!Array.isArray(scoped.departments)) return scoped;
  scoped.departments.forEach(department => {
    if (!Array.isArray(department.rooms)) return;
    department.rooms.forEach(room => {
      if (hospitalRoomMatchesWard(department, room, ward)) return;
      if (!Array.isArray(room.beds)) return;
      room.beds.forEach(bed => { bed.patientKey = ''; });
    });
  });
  return scoped;
}

function mergeHospitalStateForSession(existingState,incomingState,session,database){
  return validateBedState(existingState,mergeBedState(existingState,incomingState,{role:sessionRole(session),wardCode:sessionWard(session)}),key=>database.findPatient(key));
}

function recordScopeFromKey(key) {
  const match = /^scope:([a-z-]+):/.exec(String(key || ''));
  return match ? match[1] : '';
}

function nurseVitalRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const clean = {};
  for (const key of ['dtVal','temp','bp_sys','bp_dia','pulse','resp','spo2']) {
    const value = record[key];
    clean[key] = value === null || value === undefined ? '' : String(value).slice(0, 120);
  }
  if (!clean.dtVal) return null;
  return clean;
}

function mergeNurseDailyMonitoring(existingValue, submittedValue) {
  let existing = [];
  let submitted = [];
  try { existing = JSON.parse(existingValue || '[]'); } catch {}
  try { submitted = JSON.parse(submittedValue || '[]'); } catch {}
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(submitted)) submitted = [];

  const existingByDate = new Map();
  existing.forEach(record => {
    const key = record && typeof record === 'object' ? String(record.dtVal || '') : '';
    if (key) existingByDate.set(key, record);
  });

  const seen = new Set();
  const merged = [];
  submitted.forEach(record => {
    const vital = nurseVitalRecord(record);
    if (!vital || seen.has(vital.dtVal)) return;
    seen.add(vital.dtVal);
    const prior = existingByDate.get(vital.dtVal);
    merged.push(prior
      ? { ...prior, ...vital }
      : { ...vital, evol: '', conclusion: '', medications: [] });
  });
  existing.forEach(record => {
    const key = record && typeof record === 'object' ? String(record.dtVal || '') : '';
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(record);
  });
  return JSON.stringify(merged.slice(0, 500));
}

function mergeRecordDataForRole(existingData, submittedData, role, hasExistingPatient) {
  role = String(role || '').toUpperCase();
  if (['ADMIN','VICE_DIRECTOR'].includes(role) || !hasExistingPatient) return { ...existingData, ...submittedData };
  const scopesByRole = {
    REGISTRATION: new Set(['registration']),
    TRIAGE: new Set(['triage']),
    DOCTOR: new Set(['medical']),
    NURSE: new Set(['nursing']),
    MIDWIFE: new Set(['nursing']),
  };
  const allowedScopes = scopesByRole[role] || new Set();
  const merged = { ...existingData };
  Object.entries(submittedData).forEach(([key, value]) => {
    const scope = recordScopeFromKey(key);
    if (scope && allowedScopes.has(scope)) merged[key] = value;
  });
  if (['TRIAGE', 'REGISTRATION'].includes(role)) {
    if (submittedData['system:triageId']) merged['system:triageId'] = submittedData['system:triageId'];
    if (submittedData['triageId']) merged['triageId'] = submittedData['triageId'];
    if (submittedData['system:serviceCode']) merged['system:serviceCode'] = submittedData['system:serviceCode'];
    if (submittedData['serviceCode']) merged['serviceCode'] = submittedData['serviceCode'];
    if (submittedData['system:encounterId']) merged['system:encounterId'] = submittedData['system:encounterId'];
    if (submittedData['encounterId']) merged['encounterId'] = submittedData['encounterId'];
  }
  if (role === 'DOCTOR') {
    for (const key of ['system:dailyMonitoringRecords', 'system:initialIpdMedications', 'system:opdMedications', 'system:medicalRecordCompleted']) {
      if (Object.prototype.hasOwnProperty.call(submittedData, key)) merged[key] = submittedData[key];
    }
  }
  if ((role === 'NURSE' || role === 'MIDWIFE') && Object.prototype.hasOwnProperty.call(submittedData, 'system:dailyMonitoringRecords')) {
    merged['system:dailyMonitoringRecords'] = mergeNurseDailyMonitoring(
      existingData['system:dailyMonitoringRecords'],
      submittedData['system:dailyMonitoringRecords'],
    );
  }
  return merged;
}

function mergePatientSummaryForRole(existing, submitted, role) {
  if (!existing || ['ADMIN','VICE_DIRECTOR'].includes(String(role || '').toUpperCase())) return submitted;
  const existingSummary = {
    caseNumber: existing.case_number, healthId: existing.health_id, firstName: existing.first_name,
    lastName: existing.last_name, fullName: existing.full_name, sex: existing.sex, age: existing.age,
    dateOfBirth: existing.date_of_birth, phone: existing.phone, equityCard: existing.equity_card,
    paymentType: existing.payment_type, departmentCode: existing.department_code,
    departmentNameKh: existing.department_name_kh, departmentNameEn: existing.department_name_en,
    serviceMode: existing.service_mode, entryDate: existing.entry_date, dischargeDate: existing.discharge_date,
  };
  role = String(role || '').toUpperCase();
  if (role === 'REGISTRATION') {
    const fields = ['caseNumber','healthId','firstName','lastName','fullName','sex','age','dateOfBirth','phone','equityCard','paymentType','entryDate'];
    fields.forEach(field => { existingSummary[field] = submitted[field]; });
  } else if (role === 'TRIAGE') {
    const fields = ['departmentCode','departmentNameKh','departmentNameEn','serviceMode'];
    fields.forEach(field => { existingSummary[field] = submitted[field]; });
  }
  // Doctor, Nurse and Midwife demographics/ward assignment are read-only here.
  return existingSummary;
}

function sanitizeHospitalState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest('Hospital map state is invalid.');
  }
  const encoded = JSON.stringify(value);
  if (encoded.length > 500_000 || encoded.includes('"__proto__"') ||
      encoded.includes('"constructor"') || encoded.includes('"prototype"')) {
    badRequest('Hospital map state is invalid.');
  }
  return JSON.parse(encoded);
}

export function createEmrServer(configOverrides = {}) {
  const config = loadConfig(configOverrides);
  const hefLookup = createHefLookup({fetchImpl:configOverrides.hefFetch || fetch});
  const nssfLookup = createNssfLookup({fetchImpl:configOverrides.nssfFetch || fetch});
  const persistence = config.autoDatabase
    ? preparePersistentDatabase({ projectRoot: config.projectRoot || path.resolve(path.dirname(currentFile), '..'), targetPath: config.databasePath })
    : { created: false, sourcePath: '', candidates: [] };
  const database = openDatabase(config.databasePath);
  ensureFacilitySchema(database);
  ensureSymptomSchema(database);
  const diagnosisSearch = createDiagnosisSearch();
  ensureAccessSchema(database);
  ensureESignSchema(database);
  if (config.demoMode) ensureDemoAccounts(database);
  else ensureDefaultWardUsers(database);
  ensureParaclinicSchema(database);
  ensureFinanceSchema(database);
  ensureInvoiceEditSchema(database);
  ensureDailyReportSchema(database);
  ensureMessagingSchema(database);
  ensurePharmacyDischargeSchema(database);
  ensureOpdQueueSchema(database);
  ensureWardMedicineApprovalSchema(database);
  ensureAdmissionApprovalSchema(database);
  ensureQueueBoardSchema(database);
  ensureOrganizationBrandingSchema(database);
  ensureInterfaceThemeSchema(database);
  ensureNavigationSchema(database);
  ensureEditorHistorySchema(database);
  if (config.demoMode) {
    const existingCount = database.sqlite.prepare('SELECT COUNT(*) count FROM patient_records').get()?.count || 0;
    // Seed a new demo only; never reset existing patients when restarting.
    if (existingCount === 0) {
      resetAndSeedThirtyTriagePatients(database);
    }
  }
  ensureAppointmentSchema(database);
  ensureStockSchema(database);
  ensureRequestSchema(database);
  const recovery = config.autoDatabase
    ? recoverLegacyPatientData(database, { projectRoot: path.resolve(path.dirname(currentFile), '..'), targetPath: config.databasePath, candidates: persistence.candidates })
    : { patients: 0, forms: 0, sources: 0 };
  if (recovery.patients) ensureOpdQueueSchema(database);
  ensureOpdReceiptDischarges(database);
  seedExistingRequests(database);
  if (config.autoDatabase) createDailyBackup(database, config.databasePath);
  database.deleteExpiredSessions(Date.now());

  const router = new Router('emr');
  mountAuthRoutes(router);
  mountAdminRoutes(router);
  mountQueueRoutes(router);
  // Queue board endpoints: /api/queue/tts (translate_tts), /api/queue/display (activeCalls)
  // pathname === '/api/queue/skip'
  // if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role) && !(role==='DOCTOR' && sessionWard(session)==='opd'))
  // const allPatients = database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', config.appOrigin);
      const pathname = decodeURIComponent(url.pathname);
      const session = sessionFor(request, database);
      if (session && session.must_change_password === 1 && !['/api/auth/change-password', '/api/auth/logout', '/api/auth/me', '/api/auth/context'].includes(pathname)) {
        if (pathname.startsWith('/api/')) {
          return sendJson(response, 403, { error: 'Password change is required before accessing the system.', mustChangePassword: true }, { secure: config.cookieSecure });
        }
        if (pathname !== '/login' && !publicFiles.has(pathname)) {
          return redirect(response, '/login?passwordChange=1', { secure: config.cookieSecure });
        }
      }
      const ctx = {
        request, response, url, pathname, session, database, config,
        sendJson, sendBuffer, readJson, readBinary, audit, sameOrigin, safeTokenEqual,
        sessionRole, sessionWard, requireContext, redirect, sendFile,
        listUsers, buildIdentity, requestIp, genericLoginFailure,
        serializeSessionCookie, clearSessionCookie,
        parseStoredJson, boundedText,
        opdConsultationPaymentConfirmed, patientClinicalClosed, clinicalPatientKey,
        patientRecordResponse, canAccessPatient, messagingVisibility,
        paymentStatusForPatient, encounterAccess,
      };
      if (await router.handle(ctx)) return;

      if (pathname === '/api/hef/lookup') {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if(!HEF_LOOKUP_ROLES.has(sessionRole(session)))return sendJson(response,403,{error:'Registration access required.'},{secure:config.cookieSecure});
        if(request.method!=='POST')return sendJson(response,405,{error:'Method not allowed.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        try {
          const body=await readJson(request,4096),result=await hefLookup(body.cardNumber,session.user_id);
          if(result.found){try{result.address.canImport=Boolean(result.address.villageCode)&&validateAddressHierarchy(result.address).valid;}catch{result.address.canImport=false;}}
          audit(database,request,'HEF_LOOKUP',{userId:session.user_id,subjectUsername:session.username,details:{found:result.found,cardSuffix:result.requestedCard.slice(-4),memberCount:result.members?.length||0}});
          response.setHeader('Cache-Control','no-store');return sendJson(response,200,result,{secure:config.cookieSecure});
        }catch(error){if(error.status===429)response.setHeader('Retry-After','60');return sendJson(response,error.status||503,{error:error.message},{secure:config.cookieSecure});}
      }
      if (pathname === '/api/nssf/verify') {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if(!NSSF_LOOKUP_ROLES.has(sessionRole(session)))return sendJson(response,403,{error:'Registration access required.'},{secure:config.cookieSecure});
        if(request.method!=='POST')return sendJson(response,405,{error:'Method not allowed.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        try {
          const body=await readJson(request,4096),result=await nssfLookup(body.cardNumber,session.user_id);
          audit(database,request,'NSSF_VERIFY',{userId:session.user_id,subjectUsername:session.username,details:{found:result.found,cardSuffix:result.requestedCard.slice(-4),status:result.card?.status}});
          response.setHeader('Cache-Control','no-store');return sendJson(response,200,result,{secure:config.cookieSecure});
        }catch(error){if(error.status===429)response.setHeader('Retry-After','60');return sendJson(response,error.status||503,{error:error.message},{secure:config.cookieSecure});}
      }
      if (pathname === '/api/symptoms') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=sessionRole(session),canCreate=SYMPTOM_CREATE_ROLES.has(role);
        if (request.method === 'GET') return sendJson(response,200,{items:listSymptoms(database),canCreate},{secure:config.cookieSecure});
        if (request.method !== 'POST') return sendJson(response,405,{error:'Method not allowed.'},{secure:config.cookieSecure});
        if (!canCreate) return sendJson(response,403,{error:'A clinical or management role is required to add symptoms.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        try {
          const result=addCustomSymptom(database,await readJson(request,8192),session.user_id);
          if(result.created)audit(database,request,'SYMPTOM_CREATED',{userId:session.user_id,subjectUsername:session.username,details:{symptomId:result.item.id,nameKh:result.item.nameKh,nameEn:result.item.nameEn,activeRole:role}});
          return sendJson(response,result.created?201:200,result,{secure:config.cookieSecure});
        }catch(error){return sendJson(response,error.status||400,{error:error.message},{secure:config.cookieSecure});}
      }
      if (request.method === 'GET' && pathname === '/api/icd10/search') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        try { return sendJson(response, 200, diagnosisSearch.search(url.searchParams.get('q'), 40), { secure: config.cookieSecure }); }
        catch { return sendJson(response, 503, { error: 'Diagnosis catalogue unavailable.' }, { secure: config.cookieSecure }); }
      }

      if (config.demoMode && (pathname.startsWith('/api/pmrs2/') || pathname === '/pmrs-import')) {
        return sendJson(response, 403, { error: 'PMRS2 transfer is unavailable in the username-only demo.' }, { secure: config.cookieSecure });
      }

      if (request.method === 'GET' && pathname === '/') {
        if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
        const identity = buildIdentity(database, session);
        return redirect(response, identity.needsContext ? '/context' : landingPathForRole(identity.activeRole, identity.activeWard?.code), { secure: config.cookieSecure });
      }


      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { status: 'ok' }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/login') {
        if (session) {
          const identity = buildIdentity(database, session);
          return redirect(response, identity.needsContext ? '/context' : landingPathForRole(identity.activeRole, identity.activeWard?.code), { secure: config.cookieSecure });
        }
        return sendFile(response, path.join(config.publicDirectory, 'login.html'), 'text/html; charset=utf-8', {
          secure: config.cookieSecure,
        });
      }
      if (request.method === 'GET' && publicFiles.has(pathname)) {
        const [filename, contentType] = publicFiles.get(pathname);
        const isStaticFontOrImage = contentType.startsWith('font/') || contentType.startsWith('image/');
        return sendFile(response, path.join(config.publicDirectory, filename), contentType, {
          secure: config.cookieSecure,
        }, isStaticFontOrImage);
      }
      if (request.method === 'GET' && (pathname.startsWith('/data/gazetteer/') || pathname.startsWith('/public/data/gazetteer/'))) {
        const prefix = pathname.startsWith('/public/data/gazetteer/') ? '/public/data/gazetteer/' : '/data/gazetteer/';
        const relative = pathname.slice(prefix.length);
        if (!relative || relative.includes('..')) {
          return sendJson(response, 400, { error: 'Invalid path.' }, { secure: config.cookieSecure });
        }
        const filePath = path.join(projectRoot, 'data', 'gazetteer', relative);
        if (fs.existsSync(filePath)) {
          const contentType = relative.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
          return sendFile(response, filePath, contentType, {
            secure: config.cookieSecure,
          }, true);
        }
        return sendJson(response, 404, { error: 'Gazetteer data not found.' }, { secure: config.cookieSecure });
      }
      const requestActor=session?{userId:session.user_id,role:sessionRole(session),wardCode:sessionWard(session)}:null;
      const requestMatch=/^\/api\/requests\/([0-9a-f-]+)(?:\/(review|resubmit|apply|correct))?$/.exec(pathname);
      if(pathname==='/api/requests'||pathname==='/api/requests/invoices'||pathname==='/api/requests/bulk-review'||requestMatch){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const actor=requestActor;
        if(!roleCanPage(actor.role,'/requests'))return sendJson(response,403,{error:'Request access required.'},{secure:config.cookieSecure});
        if(request.method==='GET'&&pathname==='/api/requests/invoices'){
          const p=database.findPatient(String(url.searchParams.get('patientKey')||''));if(!p||(!['CLERK','ACCOUNTANT'].includes(actor.role)&&!canAccessPatient(database,session,p)))return sendJson(response,403,{error:'This patient is outside your ward.'},{secure:config.cookieSecure});
          const invoices=listPatientInvoices(database,p.patient_key);return sendJson(response,200,{invoices:invoices.map(i=>({...i,bill:patientBill(database,p.patient_key,i.id)}))},{secure:config.cookieSecure});
        }
        if(request.method==='GET'&&pathname==='/api/requests/counts'){
          const counts = { ADMISSION: 0, DISCHARGE: 0, MEDICINE: 0, FEE: 0 };
          const isMgmt = MANAGEMENT.includes(actor.role);
          const isCashier = ['CLERK', 'ACCOUNTANT'].includes(actor.role);
          const isPharmacy = actor.role === 'PHARMACY';

          if (!isCashier && !isPharmacy) {
            if (isMgmt) {
              const rows = database.sqlite.prepare(`
                SELECT kind, COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind IN ('ADMISSION', 'DISCHARGE')
                GROUP BY kind
              `).all();
              for (const r of rows) counts[r.kind] = r.c;
            } else {
              const rows = database.sqlite.prepare(`
                SELECT kind, COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind IN ('ADMISSION', 'DISCHARGE')
                  AND (submitted_by = ? OR (? != '' AND source_ward = ?))
                GROUP BY kind
              `).all(actor.userId, actor.wardCode || '', actor.wardCode || '');
              for (const r of rows) counts[r.kind] = r.c;
            }
          }

          if (!isPharmacy) {
            if (isMgmt) {
              const feeRow = database.sqlite.prepare(`
                SELECT COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind = 'FEE'
              `).get();
              let feeCount = feeRow?.c || 0;

              const extraFees = database.sqlite.prepare(`
                SELECT COUNT(*) as c FROM paraclinic_extra_fees
                WHERE waiver_status = 'PENDING'
              `).get();
              feeCount += (extraFees?.c || 0);

              const concessions = database.sqlite.prepare(`
                SELECT COUNT(*) as c FROM finance_concession_requests
                WHERE status = 'PENDING'
              `).get();
              feeCount += (concessions?.c || 0);

              counts.FEE = feeCount;
            } else if (!isCashier) {
              const feeRow = database.sqlite.prepare(`
                SELECT COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind = 'FEE'
                  AND (submitted_by = ? OR (? != '' AND source_ward = ?))
              `).get(actor.userId, actor.wardCode || '', actor.wardCode || '');
              counts.FEE = feeRow?.c || 0;
            }
          }

          if (isMgmt || isPharmacy || actor.wardCode) {
            const keys = wardMedicineRequestKeys(database);
            let medCount = 0;
            for (const x of keys) {
              if (!isMgmt && !isPharmacy && actor.wardCode !== x.ward_code) continue;
              const approval = approvalFor(database, x.ward_code, x.report_date);
              const st = stage(approval);
              if (st.status === 'chief_signed') {
                if (!isPharmacy) medCount++;
              }
            }
            counts.MEDICINE = medCount;
          }

          return sendJson(response, 200, { counts }, { secure: config.cookieSecure });
        }
        if(request.method==='GET'&&pathname==='/api/requests'){
          const items=listWorkflowRequests(database,actor);
          if(MANAGEMENT.includes(actor.role)){
            for(const fee of listParaclinicExtraFees(database).filter(f=>['PENDING','APPROVED','REJECTED'].includes(f.waiverStatus))){const p=database.findPatient(fee.patientKey),history=legacyReviewHistory(database,'legacy-fee:'+fee.id);items.push({history,signature:history.at(-1)?.signature||(fee.reviewerName?{name:fee.reviewerName,signedAt:fee.reviewedAt}:{}),reviewNote:fee.reviewNote,id:'legacy-fee:'+fee.id,kind:'FEE',status:fee.waiverStatus,patientKey:fee.patientKey,patientName:p?.full_name||'',reason:fee.waiverReason,sourceWard:p?.department_code||'',payload:{percent:100,mode:'PERCENT',items:[{description:fee.description,currency:fee.currency,originalMinor:fee.amountMinor,amountMinor:fee.amountMinor}]},revision:1,submittedAt:fee.waiverRequestedAt})}
            for(const inv of database.sqlite.prepare('SELECT DISTINCT invoice_id FROM finance_concession_requests').all())for(const fee of listConcessions(database,actor,{invoiceId:inv.invoice_id})){const history=legacyReviewHistory(database,'legacy-cash:'+fee.id);items.push({...fee,history,signature:history.at(-1)?.signature||(fee.reviewedByName?{name:fee.reviewedByName,signedAt:fee.reviewedAt}:{}),id:'legacy-cash:'+fee.id,kind:'FEE',revision:1,submittedAt:fee.requestedAt})}
          }
          const medicineRows=wardMedicineRequestKeys(database).sort((a,b)=>b.report_date.localeCompare(a.report_date));
          for(const x of medicineRows){if(!MANAGEMENT.includes(actor.role)&&actor.role!=='PHARMACY'&&actor.wardCode!==x.ward_code)continue;const report=reviewedWardMedicineReport(database,x.report_date,x.ward_code);if(!report.matrix.patientCount)continue;if(actor.role==='PHARMACY'&&!report.approval.director)continue;const status=report.approval.status==='chief_signed'?'PENDING':report.approval.status==='rejected'?'REJECTED':report.approval.director?'APPROVED':'PREPARING';items.push({id:'medicine:'+x.ward_code+':'+x.report_date,kind:'MEDICINE',status,sourceWard:x.ward_code,patientName:report.wardNameKh,submittedAt:new Date(x.report_date).getTime(),date:x.report_date,ward:x.ward_code,stage:report.approval.status})}
          const counts=Object.fromEntries(['ADMISSION','DISCHARGE','MEDICINE','FEE'].map(kind=>[kind,items.filter(x=>x.kind===kind&&x.status==='PENDING').length]));
          return sendJson(response,200,{items,counts},{secure:config.cookieSecure});
        }
        if(request.method==='GET'&&requestMatch){try{const d=getWorkflowRequest(database,requestMatch[1],actor);const cashier=['CLERK','ACCOUNTANT'].includes(actor.role);if(cashier){d.snapshot={full_name:d.snapshot.full_name,health_id:d.snapshot.health_id};d.history=d.history.map(h=>({...h,signature_json:undefined}));}if(actor.role==='TRIAGE')d.snapshot={...d.snapshot,record_json:JSON.stringify(patientDataVisibleForRole(parseStoredJson(d.snapshot.record_json),actor.role))};return sendJson(response,200,{request:{...d,row:undefined},editorHistory:cashier?[]:listEditorHistory(database,d.patientKey).filter(h=>actor.role!=='TRIAGE'||['triage','registration'].includes(h.scope)),clinicalForms:cashier||actor.role==='TRIAGE'?[]:d.snapshot._clinicalForms||[]},{secure:config.cookieSecure})}catch(e){return sendJson(response,e.status||400,{error:e.message},{secure:config.cookieSecure})}}
        if(request.method==='POST'){
          if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
          const body=await readJson(request,200000);database.sqlite.exec('BEGIN IMMEDIATE');
          try{
            if(pathname==='/api/requests/bulk-review'){
              if(!MANAGEMENT.includes(actor.role))throw Object.assign(Error('Management access required.'),{status:403});
              const reviews=Array.isArray(body?.reviews)?body.reviews:[];
              if(!reviews.length)throw Object.assign(Error('No requests selected.'),{status:400});
              const results=[];
              for(const item of reviews){
                try{
                  results.push(reviewWorkflowRequest(database,item.id,{approved:true,note:'',revision:item.revision},actor));
                }catch(err){console.warn('bulk review error:',item.id,err.message);}
              }
              audit(database,request,'WORKFLOW_REQUESTS_BULK_APPROVED',{userId:actor.userId,details:{count:results.length}});
              database.sqlite.exec('COMMIT');
              return sendJson(response,200,{approvedCount:results.length,requests:results},{secure:config.cookieSecure});
            }
            let result;if(requestMatch){const id=requestMatch[1],action=requestMatch[2];if(action==='review')result=reviewWorkflowRequest(database,id,body,actor);else if(action==='apply')result=applyServiceConcession(database,id,actor);else if(action==='correct'){
 const old=getWorkflowRequest(database,id,actor);if(actor.role!=='DOCTOR'||old.kind!=='DISCHARGE'||old.status!=='REJECTED')throw Object.assign(Error('The ward doctor may correct a rejected discharge letter.'),{status:403});
 const p=database.findPatient(old.patientKey);if(!p?.discharge_date||!canAccessPatient(database,session,p))throw Object.assign(Error('This discharged patient is outside your ward.'),{status:403});
 const data=parseStoredJson(p.record_json),stored=typeof data['system:discharge']==='string'?parseStoredJson(data['system:discharge']):data['system:discharge']||{};
 const correction={...stored};for(const field of ['dischargeDiagnosis','dischargeIcd10','outcome','followUpDate'])if(Object.hasOwn(body,field))correction[field]=body[field];
 if(body.revision!==old.revision)throw Object.assign(Error('This letter was updated. Refresh before correcting it.'),{status:409});
 const validated=sanitizeAdmissionAction({action:'discharge',dischargeDate:p.discharge_date,...correction,dischargeDepartment:stored.department});if(Array.isArray(stored.medications))validated.discharge.medications=stored.medications;
 data['system:discharge']=validated.discharge;data['system:ipdDischargeSummary']=JSON.stringify(buildIpdDischargeSummary(database,p,data,validated.discharge));data['system:signature:discharge']=JSON.stringify(signatureSnapshot(database,session,Date.now()));
 database.updatePatientAdmission({patientKey:p.patient_key,departmentCode:p.department_code,departmentNameKh:p.department_name_kh,departmentNameEn:p.department_name_en,serviceMode:p.service_mode,dischargeDate:p.discharge_date,data,userId:actor.userId,savedAt:Date.now()});
 result=submitWorkflowRequest(database,{kind:'DISCHARGE',patientKey:p.patient_key,reason:old.reason},actor);
 audit(database,request,'DISCHARGE_LETTER_CORRECTED',{userId:actor.userId,details:{patientKey:p.patient_key,requestId:id}});
 }else if(action==='resubmit'){const old=getWorkflowRequest(database,id,actor);if(old.status!=='REJECTED')throw Error('Only rejected requests may be resubmitted.');result=submitWorkflowRequest(database,{kind:old.kind,patientKey:old.patientKey,payload:body.payload||old.payload,reason:body.reason||old.reason},actor)}else throw Error('Choose a request action.')}else{const patient=database.findPatient(String(body.patientKey||''));if(!patient||(!['CLERK','ACCOUNTANT'].includes(actor.role)&&!canAccessPatient(database,session,patient)))throw Object.assign(Error('This patient is outside your ward.'),{status:403});result=submitWorkflowRequest(database,body,actor)}audit(database,request,'WORKFLOW_REQUEST_UPDATED',{userId:actor.userId,details:{id:result.id,kind:result.kind,status:result.status}});database.sqlite.exec('COMMIT');return sendJson(response,200,{request:result},{secure:config.cookieSecure})}catch(e){database.sqlite.exec('ROLLBACK');return sendJson(response,e.status||400,{error:e.message},{secure:config.cookieSecure})}
        }
      }
      if(request.method==='POST'&&pathname==='/api/reports/ward-medicines/reject'){
        if(!session||!MANAGEMENT.includes(sessionRole(session)))return sendJson(response,403,{error:'Management access required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10000);database.sqlite.exec('BEGIN IMMEDIATE');try{const report=rejectWardMedicineReport(database,body.date,body.ward,session.user_id,body.note,body.revision,body.fingerprint);createStaffMessage(database,{senderUserId:session.user_id,senderRole:sessionRole(session),destinationType:'WARD',destinationCode:body.ward,subject:'បណ្ណស្នើរសុំឱសថត្រូវកែតម្រូវ',body:body.note});audit(database,request,'MEDICINE_REQUEST_REJECTED',{userId:session.user_id,details:{ward:body.ward,date:body.date}});database.sqlite.exec('COMMIT');return sendJson(response,200,{report},{secure:config.cookieSecure})}catch(e){database.sqlite.exec('ROLLBACK');return sendJson(response,400,{error:e.message},{secure:config.cookieSecure})}
      }
      const replyMatch=/^\/api\/messages\/([0-9a-f-]+)\/reply$/.exec(pathname);
      if(request.method==='POST'&&replyMatch){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const original=getStaffMessage(database,replyMatch[1],session.user_id);if(!original||!canViewStaffMessage(original,messagingVisibility(session)))return sendJson(response,404,{error:'Message not found.'},{secure:config.cookieSecure});
        const body=await readJson(request,10000);if(!String(body.body||'').trim())return sendJson(response,400,{error:'Reply text is required.'},{secure:config.cookieSecure});const type=original.senderWardCode?'WARD':MANAGEMENT.includes(original.senderRole)?'ADMIN':original.senderRole;
        if(!destinationExists(type,original.senderWardCode||''))return sendJson(response,400,{error:'This message has no reply destination.'},{secure:config.cookieSecure});
        try{const message=createStaffMessage(database,{senderUserId:session.user_id,senderRole:sessionRole(session),senderWardCode:sessionWard(session),destinationType:type,destinationCode:original.senderWardCode||'',patientKey:original.patientKey,subject:'ឆ្លើយតប៖ '+String(original.subject||'').slice(0,140),body:String(body.body||'').trim()});audit(database,request,'WARD_MESSAGE_REPLY',{userId:session.user_id,details:{originalId:original.id,messageId:message.id}});return sendJson(response,201,{message},{secure:config.cookieSecure})}catch(e){return sendJson(response,400,{error:e.message},{secure:config.cookieSecure})}
      }
      if (request.method === 'GET' && pathname === '/api/messages/destinations') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
        const destinations = [
          { type:'ADMIN', code:'admin', nameKh:'អ្នកគ្រប់គ្រងប្រព័ន្ធ', nameEn:'Administrator' },
          { type:'DIRECTOR', code:'director', nameKh:'នាយកមន្ទីរពេទ្យ', nameEn:'Director' },
          ...WARDS.map(ward => ({ type:'WARD', code:ward.code, nameKh:ward.nameKh, nameEn:ward.nameEn })),
          { type:'PHARMACY', code:'pharmacy', nameKh:'ឱសថស្ថាន', nameEn:'Pharmacy' },
          { type:'LAB', code:'lab', nameKh:'មន្ទីរពិសោធន៍', nameEn:'Laboratory' },
          { type:'IMAGING', code:'imaging', nameKh:'រូបភាពវេជ្ជសាស្ត្រ', nameEn:'Imaging' },
        ];
        return sendJson(response, 200, { destinations }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/messages') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
        const box = ['sent','direct'].includes(url.searchParams.get('box')) ? url.searchParams.get('box') : 'inbox';
        const limit = Number(url.searchParams.get('limit') || 30);
        const messages = listStaffMessages(database, messagingVisibility(session), { box, limit, state: url.searchParams.get('state') });
        return sendJson(response, 200, { messages, pendingCount:pendingStaffMessageCount(database,messagingVisibility(session)) }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/messages') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxClinicalBodyBytes);
        if (!destinationExists(body?.destinationType, body?.destinationCode)) return sendJson(response, 400, { error:'Message destination is invalid.' }, { secure: config.cookieSecure });
        try {
          const message = createStaffMessage(database, {
            senderUserId: session.user_id, senderRole: role, senderWardCode: sessionWard(session),
            destinationType: body?.destinationType, destinationCode: body?.destinationCode,
            subject: body?.subject, body: body?.body, patientKey: body?.patientKey,
          });
          audit(database, request, 'STAFF_MESSAGE_SENT', { userId:session.user_id, subjectUsername:session.username, details:{ messageId:message.id, destinationType:message.destinationType, destinationCode:message.destinationCode, patientKey:message.patientKey } });
          return sendJson(response, 201, { message }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, 400, { error:error.message }, { secure: config.cookieSecure });
        }
      }
      const pharmacyMessageMatch = /^\/api\/messages\/([0-9a-f-]+)\/prescription$/.exec(pathname);
      if (request.method === 'GET' && pharmacyMessageMatch) {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        requireContext(session);
        const message=getStaffMessage(database,pharmacyMessageMatch[1],session.user_id);
        if (!message || !canViewStaffMessage(message,messagingVisibility(session))) return sendJson(response,404,{error:'Prescription not found.'},{secure:config.cookieSecure});
        const prescription=prescriptionForMessage(database,message.id);
        if (!prescription) return sendJson(response,404,{error:'Prescription not found.'},{secure:config.cookieSecure});
        return sendJson(response,200,{prescription},{secure:config.cookieSecure});
      }
      const messageCompleteMatch = /^\/api\/messages\/([0-9a-f-]+)\/complete$/.exec(pathname);
      if (request.method === 'POST' && messageCompleteMatch) {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response,403,{error:'Messaging is not available for this role.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const completion=completeStaffMessage(database,messageCompleteMatch[1],messagingVisibility(session));
        if (!completion) return sendJson(response,404,{error:'Message is outside your recipient group.'},{secure:config.cookieSecure});
        audit(database,request,'STAFF_MESSAGE_COMPLETED',{userId:session.user_id,details:{messageId:messageCompleteMatch[1],role,ward:sessionWard(session)}});
        return sendJson(response,200,{completion},{secure:config.cookieSecure});
      }
      const messageReadMatch = /^\/api\/messages\/([0-9a-f-]+)\/read$/.exec(pathname);
      if (request.method === 'POST' && messageReadMatch) {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure:config.cookieSecure });
        const role = requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error:'Messaging is not available for this role.' }, { secure:config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error:'Security token is invalid.' }, { secure:config.cookieSecure });
        const message = getStaffMessage(database, messageReadMatch[1], session.user_id);
        if (!message || !canViewStaffMessage(message, messagingVisibility(session))) return sendJson(response, 404, { error:'Message not found.' }, { secure:config.cookieSecure });
        const readAt = markStaffMessageRead(database, message.id, session.user_id);
        return sendJson(response, 200, { readAt }, { secure:config.cookieSecure });
      }
      const messageAttachmentUpload = /^\/api\/messages\/([0-9a-f-]+)\/attachments$/.exec(pathname);
      if (request.method === 'POST' && messageAttachmentUpload) {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure:config.cookieSecure });
        const role = requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error:'Messaging is not available for this role.' }, { secure:config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error:'Security token is invalid.' }, { secure:config.cookieSecure });
        const message = getStaffMessage(database, messageAttachmentUpload[1], session.user_id);
        if (!message || message.senderUserId !== session.user_id) return sendJson(response, 403, { error:'Only the sender can attach files to this message.' }, { secure:config.cookieSecure });
        const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const extensionByType = {
          'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png','text/plain':'.txt',
          'application/msword':'.doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx',
        };
        const extension = extensionByType[contentType];
        if (!extension) return sendJson(response, 415, { error:'Allowed attachments: PDF, JPG, PNG, TXT, DOC and DOCX.' }, { secure:config.cookieSecure });
        const bytes = await readBinary(request, 12 * 1024 * 1024);
        if (!bytes.length) return sendJson(response, 400, { error:'Attachment is empty.' }, { secure:config.cookieSecure });
        const uploadRoot = path.join(path.dirname(config.databasePath), 'uploads', 'messages', message.id);
        fs.mkdirSync(uploadRoot, { recursive:true });
        const storagePath = path.join(uploadRoot, `${crypto.randomUUID()}${extension}`);
        fs.writeFileSync(storagePath, bytes, { flag:'wx' });
        const attachment = addStaffMessageAttachment(database, message.id, { filename:safeAttachmentName(request.headers['x-file-name']), contentType, storagePath, userId:session.user_id });
        audit(database, request, 'STAFF_MESSAGE_ATTACHMENT_ADDED', { userId:session.user_id, subjectUsername:session.username, details:{ messageId:message.id, attachmentId:attachment.id } });
        return sendJson(response, 201, { attachment }, { secure:config.cookieSecure });
      }
      const messageAttachmentGet = /^\/api\/messages\/attachments\/([0-9a-f-]+)$/.exec(pathname);
      if (request.method === 'GET' && messageAttachmentGet) {
        if (!session) return redirect(response, '/login', { secure:config.cookieSecure });
        const role = requireContext(session);
        if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error:'Messaging is not available for this role.' }, { secure:config.cookieSecure });
        const attachment = getStaffMessageAttachment(database, messageAttachmentGet[1]);
        if (!attachment) return sendJson(response, 404, { error:'Attachment not found.' }, { secure:config.cookieSecure });
        const message = getStaffMessage(database, attachment.message_id, session.user_id);
        if (!canViewStaffMessage(message, messagingVisibility(session))) return sendJson(response, 403, { error:'You cannot view this attachment.' }, { secure:config.cookieSecure });
        return sendFile(response, attachment.storage_path, attachment.content_type, { secure:config.cookieSecure }, false);
      }
      if(['/api/finance/payment-settings','/api/finance/payer-tariffs','/api/finance/concessions'].includes(pathname)||/^\/api\/finance\/concessions\/[0-9a-f-]+\/review$/.test(pathname)){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session),actor={role,userId:session.user_id};
        if(!ROLES.includes(role))return sendJson(response,403,{error:'Staff access is required.'},{secure:config.cookieSecure});
        if(request.method!=='GET'&&(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        try{
          if(pathname==='/api/finance/payment-settings'){
            if(request.method==='GET')return sendJson(response,200,{settings:paymentSettings(database),paymentCategories:PAYMENT_CATEGORIES,nssfSubtypes:NSSF_SUBTYPES,facilityLevels:FACILITY_LEVELS},{secure:config.cookieSecure});
            if(request.method==='POST'){const settings=setPaymentSettings(database,await readJson(request,10000),actor);audit(database,request,'PAYMENT_FACILITY_LEVEL_UPDATED',{userId:actor.userId,subjectUsername:session.username,details:settings});return sendJson(response,200,{settings},{secure:config.cookieSecure});}
          }
          if(pathname==='/api/finance/payer-tariffs'){
            if(request.method==='GET')return sendJson(response,200,{settings:paymentSettings(database),services:payerTariffCatalog(database,url.searchParams.get('paymentType')||'HEF',{includeInactive:['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role),includeUnavailable:['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)})},{secure:config.cookieSecure});
            if(request.method==='POST'){const service=setPayerTariff(database,await readJson(request,config.maxBodyBytes),actor);audit(database,request,'PAYER_TARIFF_UPDATED',{userId:actor.userId,subjectUsername:session.username,details:{paymentType:service.paymentType,code:service.code,amount:service.defaultAmount,facilityLevel:service.facilityLevel}});return sendJson(response,200,{service},{secure:config.cookieSecure});}
            if(request.method==='DELETE'){
              if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
              const type=url.searchParams.get('paymentType'), facility=url.searchParams.get('facilityLevel'), code=url.searchParams.get('code');
              try {
                database.sqlite.prepare('DELETE FROM finance_payer_tariffs WHERE payer_type=? AND facility_level=? AND service_code=?').run(type,facility,code);
                audit(database,request,'PAYER_TARIFF_DELETED',{userId:actor.userId,subjectUsername:session.username,details:{paymentType:type,code,facilityLevel:facility}});
                return sendJson(response,200,{success:true},{secure:config.cookieSecure});
              } catch (error) { return sendJson(response, 400, { error:error.message }, { secure: config.cookieSecure }); }
            }
          }
          if(request.method==='GET'&&pathname==='/api/finance/concessions')return sendJson(response,200,{requests:listConcessions(database,actor,{invoiceId:url.searchParams.get('invoiceId')||''})},{secure:config.cookieSecure});
          if(request.method==='POST'){
            const body=await readJson(request,10000),match=/^\/api\/finance\/concessions\/([0-9a-f-]+)\/review$/.exec(pathname);
            if(match&&body.approved===false&&!String(body.note||'').trim())return sendJson(response,400,{error:'Rejection feedback is required.'},{secure:config.cookieSecure});
            const concession=match?reviewConcession(database,match[1],body,actor):requestConcession(database,body,actor);
            if(match)recordLegacyReview(database,'legacy-cash:'+concession.id,concession,actor);
            audit(database,request,match?'CASH_EXEMPTION_REVIEWED':'CASH_EXEMPTION_REQUESTED',{userId:actor.userId,subjectUsername:session.username,details:{id:concession.id,invoiceId:concession.invoiceId,status:concession.status}});
            return sendJson(response,match?200:201,{request:concession},{secure:config.cookieSecure});
          }
          return sendJson(response,405,{error:'Method not allowed.'},{secure:config.cookieSecure});
        }catch(error){return sendJson(response,error.status||400,{error:error.message},{secure:config.cookieSecure});}
      }
      if (request.method === 'GET' && pathname === '/api/finance/services') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
        const paymentType=majorPaymentCategory(url.searchParams.get('paymentType')||'DIRECT');
        const services=paymentType==='DIRECT'?serviceCatalog(database,{includeInactive:['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)}):payerTariffCatalog(database,paymentType);
        return sendJson(response,200,{categories:SERVICE_CATEGORIES,departments:FINANCE_DEPARTMENTS,services,settings:paymentSettings(database),paymentCategories:PAYMENT_CATEGORIES,nssfSubtypes:NSSF_SUBTYPES},{secure:config.cookieSecure});
      }
      if (request.method === 'GET' && pathname === '/api/appointments') {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);if(!['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION'].includes(role))return sendJson(response,403,{error:'Registration access is required.'},{secure:config.cookieSecure});
        return sendJson(response,200,{appointments:listAppointments(database,url.searchParams.get('startDate')||url.searchParams.get('date')||'',url.searchParams.get('endDate')||'',url.searchParams.get('rolling')==='1')},{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/appointments') {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);if(!['ADMIN','VICE_DIRECTOR','REGISTRATION'].includes(role))return sendJson(response,403,{error:'Registration access is required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes);try{const appointment=createAppointment(database,body||{},session.user_id);audit(database,request,'APPOINTMENT_CREATED',{userId:session.user_id,subjectUsername:session.username,details:{appointmentId:appointment.id,date:appointment.appointmentDate}});return sendJson(response,201,{appointment},{secure:config.cookieSecure});}catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      const appointmentStatus=/^\/api\/appointments\/([0-9a-f-]+)\/status$/.exec(pathname);
      if(request.method==='POST'&&appointmentStatus){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});const role=requireContext(session);
        if(!['ADMIN','VICE_DIRECTOR','REGISTRATION'].includes(role))return sendJson(response,403,{error:'Registration access is required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);try{const appointment=updateAppointmentStatus(database,appointmentStatus[1],body?.status,session.user_id);if(!appointment)return sendJson(response,404,{error:'Appointment was not found.'},{secure:config.cookieSecure});audit(database,request,'APPOINTMENT_STATUS_UPDATED',{userId:session.user_id,subjectUsername:session.username,details:{appointmentId:appointment.id,status:appointment.status}});return sendJson(response,200,{appointment},{secure:config.cookieSecure});}catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      if (request.method === 'POST' && pathname === '/api/finance/services') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxBodyBytes);
        try {
          const service = setServiceCatalogItem(database, body || {});
          audit(database, request, 'FINANCE_SERVICE_CATALOG_UPDATED', { userId:session.user_id, subjectUsername:session.username, details:{ code:service.code, categoryCode:service.categoryCode } });
          return sendJson(response, 200, { service }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error:error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'DELETE' && pathname === '/api/finance/services') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const code = url.searchParams.get('code');
        try {
          database.sqlite.prepare('DELETE FROM finance_service_catalog WHERE code=?').run(code);
          audit(database, request, 'FINANCE_SERVICE_CATALOG_DELETED', { userId:session.user_id, subjectUsername:session.username, details:{ code } });
          return sendJson(response, 200, { success: true }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error:error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'GET' && pathname === '/api/finance/ward-services') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','NURSE','MIDWIFE'].includes(role)) return sendJson(response,403,{error:'Ward service access is required.'},{secure:config.cookieSecure});
        const ward=['ADMIN','VICE_DIRECTOR'].includes(role)||role==='DIRECTOR' ? String(url.searchParams.get('ward')||'').toLowerCase() : sessionWard(session);
        // Ward staff need the full configured price list; billing still records
        // the selected service's real code, category, description and price.
        const services=serviceCatalog(database);
        return sendJson(response,200,{ward,services,categories:SERVICE_CATEGORIES},{secure:config.cookieSecure});
      }
      if (request.method === 'GET' && pathname === '/api/finance/ward-charges') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','NURSE','MIDWIFE'].includes(role)) return sendJson(response,403,{error:'Nurse or Midwife access is required.'},{secure:config.cookieSecure});
        const patientKey=clinicalPatientKey(url.searchParams.get('patientKey'));
        const patient=database.findPatient(patientKey);
        if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if(patient.service_mode!=='ipd')return sendJson(response,400,{error:'Ward service fees are available for admitted IPD patients only.'},{secure:config.cookieSecure});
        if(!['ADMIN','VICE_DIRECTOR'].includes(role)&&!canAccessPatient(database,session,patient))return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const openInvoice=database.sqlite.prepare('SELECT id FROM finance_invoices WHERE patient_key=? AND closed_at IS NULL ORDER BY created_at DESC,rowid DESC LIMIT 1').get(patientKey);
        const bill=openInvoice?patientBill(database,patientKey,openInvoice.id):null;
        const record=parseStoredJson(patient.record_json);
        const balance=Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0);
        return sendJson(response,200,{invoice:bill?.invoice||null,charges:(bill?.charges||[]).filter(item=>!item.voidedAt),summary:bill?.summary||{},balance,cashierQueueRequested:Boolean(record['system:cashierQueueRequest']?.invoiceId===bill?.invoice?.id)},{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/finance/ward-charges') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','NURSE','MIDWIFE'].includes(role)) return sendJson(response,403,{error:'Nurse or Midwife access is required.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes);const patientKey=clinicalPatientKey(body?.patientKey);const patient=database.findPatient(patientKey);
        if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if(patient.service_mode!=='ipd')return sendJson(response,400,{error:'Ward service fees are available for admitted IPD patients only.'},{secure:config.cookieSecure});
        if(!['ADMIN','VICE_DIRECTOR'].includes(role)&&!canAccessPatient(database,session,patient))return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const service=serviceCatalog(database).find(item=>item.code===String(body?.serviceCode||'').toUpperCase());
        if(!service)return sendJson(response,400,{error:'Service was not found.'},{secure:config.cookieSecure});
        const ward=['ADMIN','VICE_DIRECTOR'].includes(role)?String(patient.department_code||'').toLowerCase():sessionWard(session);
        try{const charge=addCatalogCharge(database,patientKey,service.code,session.user_id,body?.sourceKey||'',body?.note||'',body?.quantity||1);audit(database,request,'WARD_SERVICE_CHARGED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,serviceCode:service.code,ward,chargeId:charge.id}});return sendJson(response,201,{charge,bill:patientBill(database,patientKey)},{secure:config.cookieSecure});}catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      if (request.method === 'POST' && pathname === '/api/finance/ward-charge-void') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','NURSE','MIDWIFE'].includes(role)) return sendJson(response,403,{error:'Nurse or Midwife access is required.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes);const patientKey=clinicalPatientKey(body?.patientKey);const patient=database.findPatient(patientKey);
        if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if(patient.service_mode!=='ipd')return sendJson(response,400,{error:'Ward service fees are available for admitted IPD patients only.'},{secure:config.cookieSecure});
        if(!['ADMIN','VICE_DIRECTOR'].includes(role)&&!canAccessPatient(database,session,patient))return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const reason=String(body?.reason||'').trim();if(!reason)return sendJson(response,400,{error:'A reason is required to remove a service fee.'},{secure:config.cookieSecure});
        const openInvoice=database.sqlite.prepare('SELECT id FROM finance_invoices WHERE patient_key=? AND closed_at IS NULL ORDER BY created_at DESC,rowid DESC LIMIT 1').get(patientKey);
        const bill=openInvoice?patientBill(database,patientKey,openInvoice.id):null;const charge=(bill?.charges||[]).find(item=>item.id===String(body?.chargeId||''));
        if(!charge||charge.voidedAt)return sendJson(response,404,{error:'Active service fee was not found on the current invoice.'},{secure:config.cookieSecure});
        if((bill?.payments||[]).some(item=>!item.voidedAt))return sendJson(response,409,{error:'This invoice already has a payment. Ask the Cashier or Accountant to correct it so payment history remains auditable.'},{secure:config.cookieSecure});
        try{voidFinanceItem(database,'charge',charge.id,reason,session.user_id);audit(database,request,'WARD_SERVICE_FEE_VOIDED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,chargeId:charge.id,serviceCode:charge.serviceCode,reason,ward:sessionWard(session)}});const updated=patientBill(database,patientKey);return sendJson(response,200,{ok:true,invoice:updated?.invoice||null,charges:(updated?.charges||[]).filter(item=>!item.voidedAt),summary:updated?.summary||{}},{secure:config.cookieSecure});}catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      if(request.method==='POST'&&pathname==='/api/finance/invoices'){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if(!ROLES.includes(role))return sendJson(response,403,{error:'Staff access is required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes),patientKey=clinicalPatientKey(body?.patientKey),patient=database.findPatient(patientKey);
        if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        try{
          const requestId=String(body?.requestId||'');
          if(!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('Invoice request identifier is invalid.');
          const prefix=`STAFF_INVOICE:${session.user_id}:${requestId}:`;
          const existing=database.sqlite.prepare('SELECT invoice_id,patient_key FROM finance_charges WHERE source_key=?').get(prefix+'0');
          if(existing){if(existing.patient_key!==patientKey)throw new Error('Invoice request belongs to another patient.');return sendJson(response,200,{bill:patientBill(database,patientKey,existing.invoice_id),invoiceId:existing.invoice_id},{secure:config.cookieSecure});}
          const items=Array.isArray(body?.items)?body.items:[];
          if(!items.length||items.length>100)throw new Error('Select between 1 and 100 services for this invoice.');
          const paymentType=majorPaymentCategory(body?.paymentType||'DIRECT');
          if(body?.paymentType&&!PAYMENT_CATEGORIES.some(x=>x.code===body.paymentType))throw Error('Select a valid payment category.');
          const catalog=paymentType==='DIRECT'?serviceCatalog(database):payerTariffCatalog(database,paymentType);
          for(const item of items){const service=catalog.find(s=>s.code===String(item.serviceCode||'').toUpperCase());if(!service||Number(service.defaultAmount)<=0)throw new Error('Select an active service with a configured fee.');if(!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||Number(item.quantity)>100000)throw new Error('Quantity is invalid.');if(item.unitAmount!==undefined&&(Number(item.unitAmount)!==Number(service.defaultAmount)||item.currency!==service.currency))throw new Error('Service price changed. Reload the price list before sending.');if(item.revision!==undefined&&Number(item.revision)!==Number(service.revision))throw new Error('Payer tariff changed. Reload the price list before sending.');}
          let bill;
          database.sqlite.exec('BEGIN IMMEDIATE');
          try{
            const invoice=startPatientInvoice(database,patientKey,session.user_id);
            setFinanceProfile(database,patientKey,{paymentType,paymentSubtype:'FULL',nssfSubtype:body?.nssfSubtype||'',payerName:body?.payerName||'',payerReference:body?.payerReference||''},session.user_id,Date.now(),invoice.id);
            // Carry forward any earlier single-record handoff before creating another one.
            const data=parseStoredJson(patient.record_json);queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
            items.forEach((item,index)=>paymentType==='DIRECT'?addCatalogCharge(database,patientKey,item.serviceCode,session.user_id,prefix+index,String(body?.note||'').slice(0,1000),Number(item.quantity),invoice.id):addCharge(database,patientKey,{tariffPaymentType:paymentType,serviceCode:item.serviceCode,quantity:Number(item.quantity),sourceKey:prefix+index,note:String(body?.note||'').slice(0,1000)},session.user_id,Date.now(),{newInvoiceId:invoice.id}));
            bill=patientBill(database,patientKey,invoice.id);
            const queue={invoiceId:invoice.id,sentAt:Date.now(),sentBy:session.user_id,wardCode:sessionWard(session)||patient.department_code||'',source:'STAFF_INVOICE'};
            queueCashierPayment(database,patientKey,queue);data['system:cashierQueueRequest']=queue;
            database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),Date.now(),patientKey);
            audit(database,request,'STAFF_INVOICE_CREATED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,invoiceId:invoice.id,requestId}});
            database.sqlite.exec('COMMIT');
          }catch(error){database.sqlite.exec('ROLLBACK');throw error;}
          return sendJson(response,201,{bill,invoiceId:bill.invoice.id},{secure:config.cookieSecure});
        }catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      if(request.method==='POST'&&pathname==='/api/finance/send-to-cashier'){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if(!ROLES.includes(role))return sendJson(response,403,{error:'Staff access is required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000),patientKey=clinicalPatientKey(body?.patientKey),patient=database.findPatient(patientKey);
        if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        const data=parseStoredJson(patient.record_json);
        const bill=patientBill(database,patientKey,String(body?.invoiceId||'')),balance=Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0);
        if(!bill?.invoice?.id||balance<=0)return sendJson(response,409,{error:'There is no outstanding balance on the current invoice to send to Cashier.'},{secure:config.cookieSecure});
        const sentAt=Date.now();
        data['system:cashierQueueRequest']={invoiceId:bill.invoice.id,sentAt,sentBy:session.user_id,wardCode:sessionWard(session)||patient.department_code||'',source:'WARD'};
        queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
        database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),sentAt,patientKey);
        audit(database,request,'PATIENT_INVOICE_SENT_TO_CASHIER',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,invoiceId:bill.invoice.id,ward:data['system:cashierQueueRequest'].wardCode}});
        return sendJson(response,200,{ok:true,invoice:bill.invoice, balance, sentAt, queueRequested:true},{secure:config.cookieSecure});
      }
      if (request.method === 'GET' && pathname === '/api/finance/exchange-rates') {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);if(!['ADMIN','DIRECTOR','ACCOUNTANT','CLERK','VICE_DIRECTOR'].includes(role))return sendJson(response,403,{error:'Billing access is required.'},{secure:config.cookieSecure});
        return sendJson(response,200,exchangeRateState(database),{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/finance/exchange-rates') {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);if(!['ACCOUNTANT','CLERK'].includes(role))return sendJson(response,403,{error:'Only Cashier can propose an exchange rate.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);try{const rate=proposeExchangeRate(database,body?.khrPerUsd,session.user_id);audit(database,request,'EXCHANGE_RATE_PROPOSED',{userId:session.user_id,subjectUsername:session.username,details:{rateId:rate.id,khrPerUsd:rate.khrPerUsd}});return sendJson(response,201,{rate,state:exchangeRateState(database)},{secure:config.cookieSecure});}catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      const rateReview=/^\/api\/finance\/exchange-rates\/([0-9a-f-]+)\/review$/.exec(pathname);
      if (request.method === 'POST' && rateReview) {
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});const role=requireContext(session);
        if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))return sendJson(response,403,{error:'Admin or Director approval is required.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);try{const state=reviewExchangeRate(database,rateReview[1],body?.approved===true,body?.note||'',session.user_id);audit(database,request,body?.approved===true?'EXCHANGE_RATE_APPROVED':'EXCHANGE_RATE_REJECTED',{userId:session.user_id,subjectUsername:session.username,details:{rateId:rateReview[1]}});return sendJson(response,200,state,{secure:config.cookieSecure});}catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      if(['/api/finance/cashier-alerts','/api/finance/invoice-history','/api/finance/invoice-edit-requests','/api/finance/invoice-direct-edit'].includes(pathname)||/^\/api\/finance\/(invoice-edit-requests\/[0-9a-f-]+\/(review|apply)|invoices\/[0-9a-f-]+\/direct-edit)$/.test(pathname)){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session),actor={userId:session.user_id,role};
        if(!['CLERK','ACCOUNTANT','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))return sendJson(response,403,{error:'Billing access is required.'},{secure:config.cookieSecure});
        try{
          if(request.method==='GET'&&pathname==='/api/finance/cashier-alerts')return sendJson(response,200,{payments:['CLERK','ACCOUNTANT'].includes(role)?cashierPaymentAlerts(database):[],requests:invoiceEditRequests(database,actor)},{secure:config.cookieSecure});
          if(request.method==='GET'&&pathname==='/api/finance/invoice-history'){
            const patientKey=clinicalPatientKey(url.searchParams.get('patientKey'));
            const discharged=isPatientDischarged(database,patientKey);
            return sendJson(response,200,{invoices:invoiceHistory(database,patientKey,{paidOnly:['CLERK','ACCOUNTANT'].includes(role)}),discharged,requests:invoiceEditRequests(database,actor,patientKey)},{secure:config.cookieSecure});
          }
          if(request.method==='GET'&&pathname==='/api/finance/invoice-edit-requests')return sendJson(response,200,{requests:invoiceEditRequests(database,actor)},{secure:config.cookieSecure});
          if(request.method!=='POST')return sendJson(response,405,{error:'Method not allowed.'},{secure:config.cookieSecure});
          if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
          const body=await readJson(request,config.maxBodyBytes);
          if(pathname==='/api/finance/invoice-direct-edit'||/^\/api\/finance\/invoices\/[0-9a-f-]+\/direct-edit$/.test(pathname)){
            const match=/^\/api\/finance\/invoices\/([0-9a-f-]+)\/direct-edit$/.exec(pathname);
            const invoiceId=match?match[1]:String(body?.invoiceId||'');
            const patientKey=clinicalPatientKey(body?.patientKey);
            const result=applyDirectInvoiceEdit(database,actor,patientKey,invoiceId,body);
            if(result.balance>0){
              const patient=database.findPatient(result.patientKey),data=parseStoredJson(patient.record_json);
              const correctionQueue={invoiceId:result.invoiceId,sentAt:Date.now(),sentBy:session.user_id,wardCode:patient.department_code,source:'DIRECT_CORRECTION'};
              queueCashierPayment(database,result.patientKey,correctionQueue);
              if(!data['system:cashierQueueRequest']||data['system:cashierQueueRequest'].invoiceId===result.invoiceId){
                data['system:cashierQueueRequest']=correctionQueue;
                database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data),result.patientKey);
              }
            }
            audit(database,request,'INVOICE_DIRECT_EDIT_APPLIED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey:result.patientKey,invoiceId:result.invoiceId}});
            return sendJson(response,200,result,{secure:config.cookieSecure});
          }
          if(pathname==='/api/finance/invoice-edit-requests'){
            const patientKey=clinicalPatientKey(body?.patientKey),invoiceId=String(body?.invoiceId||'');
            const id=requestInvoiceEdit(database,actor,patientKey,invoiceId,body?.reason,body?.operation||'CORRECT');
            audit(database,request,'INVOICE_EDIT_REQUESTED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,invoiceId,requestId:id}});
            return sendJson(response,201,{id},{secure:config.cookieSecure});
          }
          const match=/^\/api\/finance\/invoice-edit-requests\/([0-9a-f-]+)\/(review|apply)$/.exec(pathname);
          if(!match)return sendJson(response,404,{error:'Not found.'},{secure:config.cookieSecure});
          if(match[2]==='review'){
            if(typeof body?.approved!=='boolean')return sendJson(response,400,{error:'Choose approve or reject.'},{secure:config.cookieSecure});
            reviewInvoiceEdit(database,actor,match[1],body.approved,body.note);
            audit(database,request,body.approved?'INVOICE_EDIT_APPROVED':'INVOICE_EDIT_REJECTED',{userId:session.user_id,subjectUsername:session.username,details:{requestId:match[1]}});
            return sendJson(response,200,{ok:true},{secure:config.cookieSecure});
          }
          const result=applyInvoiceEdit(database,actor,match[1],body);
          if(result.balance>0){
            const patient=database.findPatient(result.patientKey),data=parseStoredJson(patient.record_json);
            const correctionQueue={invoiceId:result.invoiceId,sentAt:Date.now(),sentBy:session.user_id,wardCode:patient.department_code,source:'APPROVED_CORRECTION'};
            queueCashierPayment(database,result.patientKey,correctionQueue);
            // Keep the legacy latest handoff intact; the per-invoice queue retains both.
            if(!data['system:cashierQueueRequest']||data['system:cashierQueueRequest'].invoiceId===result.invoiceId){
              data['system:cashierQueueRequest']=correctionQueue;
              database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data),result.patientKey);
            }
          }
          audit(database,request,'INVOICE_EDIT_APPLIED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey:result.patientKey,invoiceId:result.invoiceId,requestId:match[1]}});
          return sendJson(response,200,result,{secure:config.cookieSecure});
        }catch(error){return sendJson(response,error.status||400,{error:error.message},{secure:config.cookieSecure});}
      }
      if (request.method === 'GET' && pathname === '/api/finance/patients') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','DIRECTOR','ACCOUNTANT','CLERK','VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
        const view=String(url.searchParams.get('view')||'all').toLowerCase();
        return sendJson(response, 200, { patients: financePatientSearch(database, url.searchParams.get('q') || '', {view}) }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/finance/patient') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','DIRECTOR','ACCOUNTANT','CLERK','VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        const invoiceId=String(url.searchParams.get('invoiceId')||'');
        const bill = patientBill(database, patientKey,invoiceId);
        if (!bill) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        return sendJson(response, 200, {
          bill, paymentStatus:paymentStatusForPatient(database,patientKey,invoiceId), paymentTypes: PAYMENT_TYPES, directPaymentTypes: DIRECT_PAYMENT_TYPES, hefTypes: HEF_TYPES, paymentPurposes: PAYMENT_PURPOSES,
          currencies: FINANCE_CURRENCIES, invoices:listPatientInvoices(database,patientKey), paymentHistory:patientPaymentHistory(database,patientKey),
        }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/finance/payment-status') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        const patient = database.findPatient(patientKey);
        if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        const financeWideAccess = ['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK','DIRECTOR','LAB','IMAGING','PHARMACY'].includes(role);
        if (!financeWideAccess && !canAccessPatient(database, session, patient)) {
          return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        }
        return sendJson(response, 200, { status: paymentStatusForPatient(database, patientKey) }, { secure: config.cookieSecure });
      }
      if (request.method === 'PATCH' && pathname === '/api/finance/patient') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        if (!database.findPatient(patientKey)) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        try {
          const invoiceId=String(body?.invoiceId||'');
          assertCashierInvoiceWritable(database,patientKey,invoiceId,role);
          const profile = setFinanceProfile(database, patientKey, body || {}, session.user_id,Date.now(),invoiceId);
          updateWorkflowStageAfterPayment(database, patientKey, { userId:session.user_id, role, invoiceId });
          audit(database, request, 'PATIENT_PAYMENT_TYPE_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, paymentType: profile.paymentType, paymentSubtype:profile.paymentSubtype, discountAmount:profile.discountAmount, discountCurrency:profile.discountCurrency } });
          return sendJson(response, 200, { bill: patientBill(database, patientKey,invoiceId), paymentStatus: paymentStatusForPatient(database, patientKey,invoiceId),invoices:listPatientInvoices(database,patientKey) }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'POST' && pathname === '/api/finance/charges') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        if (!database.findPatient(patientKey)) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        try {
          let charge;database.sqlite.exec('BEGIN IMMEDIATE');
          try{
          const catalogService=serviceCatalog(database,{includeInactive:true}).find(item=>item.code===String(body?.serviceCode||'').toUpperCase());
          charge = majorPaymentCategory(body?.tariffPaymentType||'DIRECT')==='DIRECT'&&catalogService?.currency==='USD'
            ? addCatalogCharge(database,patientKey,catalogService.code,session.user_id,body?.sourceKey||'',body?.note||'',body?.quantity||1)
            : addCharge(database, patientKey, body || {}, session.user_id);
          const selectedPayer=majorPaymentCategory(body?.tariffPaymentType||'DIRECT');
          if(body?.tariffPaymentType){const active=patientBill(database,patientKey,charge.invoiceId).charges.filter(c=>!c.voidedAt);if(active.some(c=>majorPaymentCategory(c.tariffPayer)!==selectedPayer))throw Error('This invoice uses another payment category. Create a new invoice with the correct price list.');setFinanceProfile(database,patientKey,{paymentType:selectedPayer,paymentSubtype:'FULL',nssfSubtype:body.nssfSubtype||'',payerName:body.payerName||'',payerReference:body.payerReference||''},session.user_id,Date.now(),charge.invoiceId);}
          database.sqlite.exec('COMMIT');
          }catch(error){database.sqlite.exec('ROLLBACK');throw error;}
          audit(database, request, 'FINANCE_CHARGE_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, chargeId: charge.id, amount: charge.amount, currency: charge.currency } });
          const bill=patientBill(database,patientKey);
          return sendJson(response, 201, { charge, bill,invoices:listPatientInvoices(database,patientKey) }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'POST' && pathname === '/api/finance/payments') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        if (!database.findPatient(patientKey)) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        try {
          assertCashierInvoiceWritable(database,patientKey,String(body?.invoiceId||''),role);
          const payment = addPayment(database, patientKey, body || {}, session.user_id);
          const bill=patientBill(database,patientKey,payment.invoiceId);
          const settled=Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0)<=0&&Number(bill?.summary?.KHR?.gross||0)+Number(bill?.summary?.USD?.gross||0)>0;
          if(settled)database.sqlite.prepare('UPDATE finance_invoices SET closed_at=COALESCE(closed_at,?) WHERE id=?').run(Date.now(),payment.invoiceId);
          updateWorkflowStageAfterPayment(database, patientKey, { userId:session.user_id, role, invoiceId:payment.invoiceId });
          if(settled){try{notifyOpdDoctorsPaymentCompleted(database,session,database.findPatient(patientKey),bill,[payment]);}catch{}}
          audit(database, request, 'FINANCE_PAYMENT_RECEIVED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, paymentId: payment.id, amount: payment.amount, currency: payment.currency, source: payment.source, purpose: payment.purpose } });
          return sendJson(response, 201, { payment, bill:patientBill(database,patientKey,payment.invoiceId), paymentStatus:paymentStatusForPatient(database,patientKey,payment.invoiceId),invoices:listPatientInvoices(database,patientKey) }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'POST' && pathname === '/api/finance/complete-payment') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) return sendJson(response,403,{error:'Billing access is required.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes);
        const patientKey=clinicalPatientKey(body?.patientKey);
        const patient=database.findPatient(patientKey);
        if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        try{
          database.sqlite.exec('BEGIN IMMEDIATE');
          let result;
          try{
            const invoiceId=String(body?.invoiceId||'');
            assertCashierInvoiceWritable(database,patientKey,invoiceId,role);
            const paymentType=majorPaymentCategory(body?.paymentType||'DIRECT');
            const profile=setFinanceProfile(database,patientKey,{paymentType,paymentSubtype:body?.paymentSubtype||'FULL',discountAmount:body?.discountAmount??0,discountPercent:body?.discountPercent??0,discountCurrency:body?.discountCurrency||'KHR',payerReference:body?.payerReference||'',note:body?.note||'',nssfSubtype:body?.nssfSubtype||'',payerName:body?.payerName||'',approvalId:body?.approvalId||''},session.user_id,Date.now(),invoiceId);
            const before=patientBill(database,patientKey,invoiceId);
            const payments=[];
            const activeCharges=before.charges.filter(c=>!c.voidedAt);
            if(!activeCharges.length)throw Error('Add services before completing payment.');
            if(activeCharges.some(c=>majorPaymentCategory(c.tariffPayer)!==paymentType))throw Error('Invoice services use another payment price list. Remove incorrect unpaid services and choose the correct payer list.');
            if(paymentType==='NSSF'&&!profile.nssfSubtype)throw Error('Select the NSSF subtype.');
            if(paymentType!=='DIRECT')database.sqlite.prepare('UPDATE finance_invoices SET coverage_at=?,coverage_by=?,closed_at=? WHERE id=?').run(Date.now(),session.user_id,Date.now(),before.invoice.id);
            for(const currency of ['KHR','USD']){
              const amount=Number(before.summary?.[currency]?.balance||0);
              if(amount<=0||paymentType!=='DIRECT')continue;
              payments.push(addPayment(database,patientKey,{invoiceId:before.invoice?.id,source:'CASH',purpose:body?.purpose||'PATIENT_CARE',categoryCode:body?.categoryCode||'',serviceCode:body?.serviceCode||'',amount,currency,reference:body?.reference||'',note:body?.paymentNote||'',receivedAt:body?.receivedAt},session.user_id));
            }
            const bill=patientBill(database,patientKey,before.invoice?.id||invoiceId);
            const settled=Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0)<=0&&Number(bill?.summary?.KHR?.gross||0)+Number(bill?.summary?.USD?.gross||0)>0;
            if(settled&&bill.invoice?.id)database.sqlite.prepare('UPDATE finance_invoices SET closed_at=COALESCE(closed_at,?) WHERE id=?').run(Date.now(),bill.invoice.id);
            result={profile,payments,bill,paymentStatus:paymentStatusForPatient(database,patientKey,bill.invoice?.id||invoiceId),invoices:listPatientInvoices(database,patientKey)};
            database.sqlite.exec('COMMIT');
          }catch(error){try{database.sqlite.exec('ROLLBACK')}catch{}throw error}
          updateWorkflowStageAfterPayment(database,patientKey,{userId:session.user_id,role,invoiceId:result.bill?.invoice?.id||String(body?.invoiceId||'')});
          const settled=Boolean(result.bill?.invoice?.coverageAt)||Number(result.bill?.summary?.KHR?.balance||0)+Number(result.bill?.summary?.USD?.balance||0)<=0&&Number(result.bill?.summary?.KHR?.gross||0)+Number(result.bill?.summary?.USD?.gross||0)>0;
          if(settled){try{notifyOpdDoctorsPaymentCompleted(database,session,patient,result.bill,result.payments);}catch{}}
          audit(database,request,'FINANCE_PAYMENT_COMPLETED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,paymentIds:result.payments.map(item=>item.id),paymentStatus:result.paymentStatus?.code||''}});
          return sendJson(response,201,result,{secure:config.cookieSecure});
        }catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      const financeAttachmentUpload = /^\/api\/finance\/payments\/([0-9a-f-]+)\/attachments$/.exec(pathname);
      if (request.method === 'POST' && financeAttachmentUpload) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const payment = getFinancePayment(database, financeAttachmentUpload[1]);
        if (!payment) return sendJson(response, 404, { error:'Payment not found.' }, { secure: config.cookieSecure });
        const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const extensionByType = { 'application/pdf':'.pdf', 'image/jpeg':'.jpg', 'image/png':'.png' };
        const extension = extensionByType[contentType];
        if (!extension) return sendJson(response, 415, { error:'Only PDF, JPEG and PNG attachments are allowed.' }, { secure: config.cookieSecure });
        const bytes = await readBinary(request, 12 * 1024 * 1024);
        if (!bytes.length) return sendJson(response, 400, { error:'Attachment is empty.' }, { secure: config.cookieSecure });
        const uploadRoot = path.join(path.dirname(config.databasePath), 'uploads', 'finance', payment.id);
        fs.mkdirSync(uploadRoot, { recursive:true });
        const storagePath = path.join(uploadRoot, `${crypto.randomUUID()}${extension}`);
        fs.writeFileSync(storagePath, bytes, { flag:'wx' });
        const attachment = addPaymentAttachment(database, payment.id, { filename:safeAttachmentName(request.headers['x-file-name']), contentType, storagePath, userId:session.user_id });
        audit(database, request, 'FINANCE_PAYMENT_ATTACHMENT_ADDED', { userId:session.user_id, subjectUsername:session.username, details:{ paymentId:payment.id, attachmentId:attachment.id, patientKey:payment.patient_key } });
        return sendJson(response, 201, { attachment }, { secure: config.cookieSecure });
      }
      const financeAttachmentGet = /^\/api\/finance\/payment-attachments\/([0-9a-f-]+)$/.exec(pathname);
      if (request.method === 'GET' && financeAttachmentGet) {
        if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','ACCOUNTANT','CLERK','DIRECTOR','VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error:'Finance access is required.' }, { secure: config.cookieSecure });
        const attachment = getPaymentAttachment(database, financeAttachmentGet[1]);
        if (!attachment) return sendJson(response, 404, { error:'Attachment not found.' }, { secure: config.cookieSecure });
        return sendFile(response, attachment.storage_path, attachment.content_type, { secure:config.cookieSecure }, false);
      }
      if (request.method === 'GET' && pathname === '/api/finance/expenses') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','ACCOUNTANT'].includes(role)) return sendJson(response, 403, { error: 'Accounting access is required.' }, { secure: config.cookieSecure });
        return sendJson(response, 200, { expenses: listExpenses(database) }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/finance/expenses') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT'].includes(role)) return sendJson(response, 403, { error: 'Accounting access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxBodyBytes);
        try {
          const expense = addExpense(database, body || {}, session.user_id);
          audit(database, request, 'FINANCE_EXPENSE_RECORDED', { userId: session.user_id, subjectUsername: session.username, details: { expenseId: expense.id, amount: expense.amount, currency: expense.currency, category: expense.category } });
          return sendJson(response, 201, { expense }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'POST' && pathname === '/api/finance/void') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) return sendJson(response, 403, { error: 'Accounting access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxBodyBytes);
        if(role==='CLERK'&&body?.kind!=='charge')return sendJson(response,403,{error:'Cashiers can delete unpaid service fees only.'},{secure:config.cookieSecure});
        try {
          if(body?.kind==='payment'){const payment=getFinancePayment(database,String(body?.id||''));if(payment)assertCashierInvoiceWritable(database,payment.patient_key||payment.patientKey,payment.invoice_id||payment.invoiceId,role);}
          const ok = voidFinanceItem(database, String(body?.kind || ''), String(body?.id || ''), body?.reason, session.user_id, Date.now(), {unpaidOnly:true});
          if (!ok) return sendJson(response, 404, { error: 'Finance item was not found or is already void.' }, { secure: config.cookieSecure });
          audit(database, request, 'FINANCE_ITEM_VOIDED', { userId: session.user_id, subjectUsername: session.username, details: { kind: String(body?.kind||''), id: body?.id } });
          return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'GET' && pathname === '/api/finance/cashflow') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Hospital Director or Administrator access is required.' }, { secure: config.cookieSecure });
        try {
          const month = url.searchParams.get('month');
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');
          return sendJson(response, 200, cashflowRange(database, { month, startDate, endDate }), { secure: config.cookieSecure });
        }
        catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'GET' && pathname === '/api/finance/monthly-service-report') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Hospital Director or Administrator access is required.' }, { secure: config.cookieSecure });
        try {
          const month = url.searchParams.get('month');
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');
          return sendJson(response, 200, serviceRevenueRange(database, { month, startDate, endDate }), { secure: config.cookieSecure });
        }
        catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      if (request.method === 'GET' && pathname === '/api/finance/cashflow-day') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Hospital Director or Administrator access is required.' }, { secure: config.cookieSecure });
        try { return sendJson(response, 200, cashflowDayDetails(database, url.searchParams.get('date')), { secure: config.cookieSecure }); }
        catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
      }
      const stockMatch = /^\/api\/stock\/(medicine|material|film)(?:\/(receipt|use|history))?$/.exec(pathname);
      if (stockMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        const kind = stockMatch[1];
        const sub = stockMatch[2] || '';
        if (request.method === 'GET' && !sub) {
          const allowed = kind === 'medicine'
            ? ['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY','DOCTOR'].includes(role)
            : kind === 'material'
              ? ['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB'].includes(role)
              : ['ADMIN','VICE_DIRECTOR','DIRECTOR','IMAGING','DOCTOR'].includes(role);
          if (!allowed) return sendJson(response, 403, { error: 'Your role cannot view this stock list.' }, { secure: config.cookieSecure });
          return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
        }
        if (request.method === 'GET' && sub === 'history') {
          const allowed = kind === 'medicine'
            ? ['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY','DOCTOR'].includes(role)
            : kind === 'material'
              ? ['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB'].includes(role)
              : ['ADMIN','VICE_DIRECTOR','DIRECTOR','IMAGING','DOCTOR'].includes(role);
          if (!allowed) return sendJson(response, 403, { error: 'Your role cannot view stock history.' }, { secure: config.cookieSecure });
          return sendJson(response, 200, { history: stockHistory(database, kind) }, { secure: config.cookieSecure });
        }
        if (request.method === 'POST') {
          if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
            return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
          }
          const body = await readJson(request, config.maxBodyBytes);
          if (!sub) {
            const allowed = kind === 'medicine'
              ? ['ADMIN','VICE_DIRECTOR','PHARMACY'].includes(role)
              : kind === 'material'
                ? ['ADMIN','VICE_DIRECTOR','LAB'].includes(role)
                : ['ADMIN','VICE_DIRECTOR','IMAGING'].includes(role);
            if (!allowed) return sendJson(response, 403, { error: 'Your role cannot add new items.' }, { secure: config.cookieSecure });
            try {
              const id = addStockItem(database, kind, body || {}, session.user_id);
              audit(database, request, `STOCK_${kind.toUpperCase()}_ADDED`, { userId: session.user_id, subjectUsername: session.username, details: { id, name: body?.name, unit: body?.unit } });
              return sendJson(response, 200, { id, items: listStock(database, kind) }, { secure: config.cookieSecure });
            } catch (error) { return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure }); }
          }
          if (sub === 'receipt') {
            const allowed = kind === 'medicine'
              ? ['ADMIN','VICE_DIRECTOR','PHARMACY'].includes(role)
              : kind === 'material'
                ? ['ADMIN','VICE_DIRECTOR','LAB'].includes(role)
                : ['ADMIN','VICE_DIRECTOR','IMAGING'].includes(role);
            if (!allowed) return sendJson(response, 403, { error: 'Your role cannot receive stock.' }, { secure: config.cookieSecure });
            try {
              receiveStock(database, body?.id, body?.quantity, session.user_id);
              audit(database, request, `STOCK_${kind.toUpperCase()}_RECEIVED`, { userId: session.user_id, subjectUsername: session.username, details: { id: body?.id, quantity: body?.quantity } });
              return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
            } catch (error) { return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure }); }
          }
          if (sub === 'use') {
            if (kind === 'material') {
              if (!['ADMIN','VICE_DIRECTOR','LAB'].includes(role)) return sendJson(response, 403, { error: 'Your role cannot record material usage.' }, { secure: config.cookieSecure });
              try {
                manualMaterialUsage(database, body?.id, body?.quantity, body?.reference, session.user_id);
                audit(database, request, 'STOCK_MATERIAL_USED', { userId: session.user_id, subjectUsername: session.username, details: { id: body?.id, quantity: body?.quantity, reference: body?.reference } });
                return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
              } catch (error) { return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure }); }
            }
            if (kind === 'film') {
              if (!['ADMIN','VICE_DIRECTOR','IMAGING'].includes(role)) return sendJson(response, 403, { error: 'Your role cannot record film usage.' }, { secure: config.cookieSecure });
              try {
                manualFilmUsage(database, body?.id, body?.quantity, body?.reference, session.user_id);
                audit(database, request, 'STOCK_FILM_USED', { userId: session.user_id, subjectUsername: session.username, details: { id: body?.id, quantity: body?.quantity, reference: body?.reference } });
                return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
              } catch (error) { return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure }); }
            }
          }
        }
      }
      if (request.method === 'GET' && pathname === '/api/reports/ward-medicines') {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure:config.cookieSecure });
        const role=requireContext(session);
        const wards=medicineReportWards(role,sessionWard(session));
        if (!wards.length) return sendJson(response, 403, { error:'Your active role cannot view ward medicine orders.' }, { secure:config.cookieSecure });
        const wardCode=String(url.searchParams.get('ward') || '').trim().toLowerCase();
        if (!wards.some(item=>item.code===wardCode)) {
          return sendJson(response, 403, { error:'This medicine report is outside your assigned ward.' }, { secure:config.cookieSecure });
        }
        try {
          const report=reviewedWardMedicineReport(database,url.searchParams.get('date'),wardCode);
          if(role==='PHARMACY'&&!report.approval?.director) return sendJson(response,403,{error:'Management approval is required before Pharmacy can view this request.'},{secure:config.cookieSecure});
          return sendJson(response,200,{...report,wards},{secure:config.cookieSecure});
        } catch (error) {
          return sendJson(response, 400, { error:error.message }, { secure:config.cookieSecure });
        }
      }
      if (request.method === 'GET' && pathname === '/api/reports/ward-medicines/pending') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!MANAGEMENT.includes(requireContext(session))) return sendJson(response,403,{error:'Director access is required.'},{secure:config.cookieSecure});
        return sendJson(response,200,{items:directorWardMedicineInbox(database)},{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/reports/ward-medicines/sign') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['NURSE','MIDWIFE','WARD_HEAD','CHIEF_WARD','DOCTOR','ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(role)) return sendJson(response,403,{error:'Your role cannot sign the ward medicine list.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes);
        const ward=String(body?.ward || '').toLowerCase();
        const allowed=medicineReportWards(role,sessionWard(session));
        if (!allowed.some(item=>item.code===ward)) return sendJson(response,403,{error:'This medicine report is outside your assigned ward.'},{secure:config.cookieSecure});
        if (role==='CHIEF_WARD' && sessionWard(session)!==ward) return sendJson(response,403,{error:'Chief of Ward can sign only the active ward.'},{secure:config.cookieSecure});
        if (['NURSE','MIDWIFE'].includes(role) && sessionWard(session)!==ward) return sendJson(response,403,{error:'Nursing staff can sign only the active ward.'},{secure:config.cookieSecure});
        let report;
        database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          report=signWardMedicineReport(database,body?.date,ward,role,session.user_id,signatureSnapshot(database,session,Date.now()),body.step,body.revision,body.fingerprint);
          audit(database,request,'WARD_MEDICINE_SIGNED',{userId:session.user_id,subjectUsername:session.username,details:{ward,date:report.date,role,status:report.approval?.status}});
          if (MANAGEMENT.includes(role) && report.approval?.status==='director_signed' && !report.approval?.pharmacyAlertedAt) {
            const wardName=report.wardNameKh || ward;
            createSystemMessage(database,{senderUserId:session.user_id,senderRole:role,destinationType:'PHARMACY',destinationCode:'pharmacy',subject:`បញ្ជីឱសថផ្នែករួចរាល់ · ${ward} · ${report.date}`,body:`បញ្ជីឱសថប្រចាំថ្ងៃពី ${wardName} សម្រាប់ថ្ងៃទី ${report.date} បានចុះហត្ថលេខាដោយនាយក។ សូមឱសថស្ថានពិនិត្យ និងចុះហត្ថលេខាប្រគល់ថ្នាំទៅផ្នែក។`});
            markPharmacyAlerted(database,report.date,ward);
            report=reviewedWardMedicineReport(database,report.date,ward);
          }
          database.sqlite.exec('COMMIT');
        } catch(error) { database.sqlite.exec('ROLLBACK'); return sendJson(response,error.status||400,{error:error.message},{secure:config.cookieSecure}); }
        return sendJson(response,200,{report},{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/reports/ward-medicines/approve') {
        // Legacy endpoint retained for existing clients; it still follows the full sequence.
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!MANAGEMENT.includes(requireContext(session))) return sendJson(response,403,{error:'Only the hospital director can complete the director signature stage.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes);
        const ward=String(body?.ward || '').toLowerCase();
        try {database.sqlite.exec('BEGIN IMMEDIATE');let report=signWardMedicineReport(database,body?.date,ward,sessionRole(session),session.user_id,signatureSnapshot(database,session,Date.now()),3);if(!report.approval?.pharmacyAlertedAt){createSystemMessage(database,{senderUserId:session.user_id,senderRole:sessionRole(session),destinationType:'PHARMACY',destinationCode:'pharmacy',subject:`បញ្ជីឱសថផ្នែករួចរាល់ · ${ward} · ${report.date}`,body:'បញ្ជីឱសថបានអនុម័តរួចរាល់។'});markPharmacyAlerted(database,report.date,ward);report=reviewedWardMedicineReport(database,report.date,ward);}audit(database,request,'WARD_MEDICINE_SIGNED',{userId:session.user_id,details:{ward,date:report.date,role:sessionRole(session),step:3}});database.sqlite.exec('COMMIT');return sendJson(response,200,{report},{secure:config.cookieSecure}); }
        catch(error) {try{database.sqlite.exec('ROLLBACK')}catch{}return sendJson(response,400,{error:error.message},{secure:config.cookieSecure}); }
      }

      if (request.method === 'GET' && pathname === '/api/reports/daily') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        try {
          const role = sessionRole(session);
          const ward = sessionWard(session);
          const isManagement = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'CASHIER', 'REGISTRATION'].includes(role) || !ward;
          const filterWard = isManagement ? (url.searchParams.get('ward') || '') : ward;
          return sendJson(response, 200, dailyHospitalReport(database, url.searchParams.get('date'), filterWard), { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
      if (request.method === 'GET' && ['/api/encounter-access','/api/record-viewer'].includes(pathname)) {
        if(!session)return sendJson(response,401,{error:'សូមចូលគណនីជាមុន។'},{secure:config.cookieSecure});
        const row=database.findPatient(clinicalPatientKey(url.searchParams.get('patientKey')));
        if(!row)return sendJson(response,404,{error:'រកមិនឃើញកំណត់ត្រាអ្នកជំងឺ។'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if(pathname==='/api/encounter-access')return sendJson(response,200,{access:encounterAccess(database,session,row,url.searchParams.get('scope')||'')},{secure:config.cookieSecure});
        if(!RECORD_MANAGEMENT.includes(role))return sendJson(response,403,{error:'ទំព័រនេះសម្រាប់គណៈគ្រប់គ្រងប៉ុណ្ណោះ។'},{secure:config.cookieSecure});
        const rows=row.health_id?database.sqlite.prepare('SELECT * FROM patient_records WHERE health_id=? COLLATE NOCASE ORDER BY entry_date DESC,created_at DESC').all(row.health_id):[row];
        const encounters=rows.map(record=>{
          const data=parseStoredJson(record.record_json);
          return {patient:patientRecordResponse(record,true),orders:listOrders(database,{patientKey:record.patient_key}),
            resume:record.service_mode==='ipd'?buildIpdDischargeSummary(database,record,data,data['system:discharge']||{}):null};
        });
        return sendJson(response,200,{encounters},{secure:config.cookieSecure});
      }
      if (request.method === 'GET' && pathname === '/api/patients') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const includePayment = url.searchParams.get('includePayment') === '1';
        const dispensedKeys = new Set(database.sqlite.prepare(`SELECT DISTINCT patient_key FROM pharmacy_prescriptions WHERE dispensed_at IS NOT NULL`).all().map(r => r.patient_key));
        const role = requireContext(session);
        return sendJson(response, 200, {
          patients: database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {
            const data = row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json));
            const patient = patientRecordResponse(row, false, data);
            patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
            patient.triageStatus = row.triage_status || '';
            patient.admissionStatus = row.admission_status || '';
            if (includePayment || ['DOCTOR','PHARMACY'].includes(role)) patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
            patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys, data);
            patient.canOpenRecord = canAccessPatient(database, session, row) && roleCanPage(role, '/emr');
            patient.recordAccess = encounterAccess(database,session,row);
            patient.canEditClinical = patient.recordAccess.canEdit;
            return patient;
          }),
        }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/patient-record') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        let patient = database.findPatient(patientKey);
        if (patient && !canAccessPatient(database, session, patient)) {
          return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        }
        const role = sessionRole(session);
        if (patient?.service_mode === 'opd' && ['DOCTOR','CHIEF_WARD','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role) && url.searchParams.get('readOnly')!=='1' && encounterAccess(database,session,patient).canEdit) {
          syncOpdParaclinicToRecord(database, patientKey);
          patient = database.findPatient(patientKey);
        }
        const limitedIdentityRole = ['LAB','IMAGING','PHARMACY'].includes(role);
        const patientView = patient ? patientRecordResponse(patient, !limitedIdentityRole) : null;
        if (patientView) {
          const data = parseStoredJson(patient.record_json);
          patientView.queueNumber = Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0) || null;
          patientView.paymentStatus = paymentStatusForPatient(database, patient.patient_key);
          patientView.clinicalClosed = patientClinicalClosed(database, patient);
          patientView.recordAccess = encounterAccess(database,session,patient);
        }
        if (patientView && role === 'TRIAGE' && patientView.data) patientView.data = patientDataVisibleForRole(patientView.data, role);
        return sendJson(response, 200, { patient: patientView,
          opdQueue: patient?.service_mode === 'opd' ? getOpdQueueEntry(database,patientKey) : null }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/opd/ipd-transfer-candidates') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (role!=='DOCTOR' || sessionWard(session)!=='opd') return sendJson(response,403,{error:'Only an OPD doctor can transfer patients into IPD.'},{secure:config.cookieSecure});
        const date=opdLocalDate();
        const patients=paidOpdQueuePatients(database,date).filter(item=>{
          if(item.transferredToIpdAt)return false;
          const patient=database.findPatient(item.patientKey);
          return patient&&String(patient.service_mode||'').toLowerCase()==='opd';
        });
        return sendJson(response,200,{date,patients},{secure:config.cookieSecure});
      }
      if (request.method === 'GET' && pathname === '/api/opd/ipd-wards') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (role!=='DOCTOR' || sessionWard(session)!=='opd') return sendJson(response,403,{error:'Only an OPD doctor can choose an IPD ward.'},{secure:config.cookieSecure});
        return sendJson(response,200,{wards:WARDS.filter(ward=>ward.code!=='opd')},{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/opd/transfer-to-ipd') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (role!=='DOCTOR' || sessionWard(session)!=='opd') return sendJson(response,403,{error:'Only an OPD doctor can transfer a patient into IPD.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,20_000);
        const patientKey=clinicalPatientKey(body?.patientKey);
        const wardCode=String(body?.wardCode||'').trim().toLowerCase();
        const ward=WARDS.find(item=>item.code===wardCode && item.code!=='opd');
        if (!ward) return sendJson(response,400,{error:'Choose a valid inpatient ward.'},{secure:config.cookieSecure});
        const existing=database.findPatient(patientKey);
        if (!existing) return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if (String(existing.service_mode||'').toLowerCase()!=='opd') return sendJson(response,409,{error:'Only a current OPD patient can be transferred with this action.'},{secure:config.cookieSecure});
        if (!canAccessPatient(database,session,existing)) return sendJson(response,403,{error:'This patient is outside the OPD.'},{secure:config.cookieSecure});
        if(!opdConsultationPaymentConfirmed(database,existing))return sendJson(response,409,{error:'Confirm the OPD consultation fee with Cashier before transferring this patient.'},{secure:config.cookieSecure});
        const savedAt=Date.now();
        const data=parseStoredJson(existing.record_json);
        data['system:admissionStatus']='waiting-transfer';
        data['system:workflowStage']='WARD_WAITING';
        data['system:currentWardCode']='';
        data['system:currentRoomId']='';
        data['system:currentRoomNameKh']='';
        data['system:currentRoomNameEn']='';
        data['system:currentBedId']='';
        data['system:currentBedLabel']='';
        data['system:careType']=ward.code==='obstetric'?'obstetric':'nurse';
        data['system:currentDepartmentCode']=ward.code;
        data['system:currentDepartmentNameKh']=ward.nameKh;
        data['system:currentDepartmentNameEn']=ward.nameEn;
        data['system:opdTransferredToIpdAt']=savedAt;
        data['system:opdTransferredToIpdWardCode']=ward.code;
        try {
          database.sqlite.exec('BEGIN IMMEDIATE');
          try {
            releasePatientFromHospitalMap(database,patientKey,session.user_id,savedAt);
            const patient=database.updatePatientAdmission({patientKey,departmentCode:ward.code,departmentNameKh:ward.nameKh,
              departmentNameEn:ward.nameEn,serviceMode:'ipd',dischargeDate:'',data,userId:session.user_id,savedAt});
            const invoice=startPatientInvoice(database,patientKey,session.user_id,savedAt);
            recordMovement(database,{patientKey,eventType:'ADMISSION',fromWardCode:'opd',toWardCode:ward.code,
              fromDepartmentCode:'opd',toDepartmentCode:ward.code,eventAt:savedAt,createdBy:session.user_id,
              details:{source:'OPD',reason:'doctor-transfer-to-ipd'}});
            const patientName = patient.full_name || patient.case_number;
            const targetWardKh = (ward.nameKh || ward.nameEn || '').replace(/^ផ្នែក\s*/, '');
            const transferMsg = `អ្នកជំងឺឈ្មោះ ${patientName} ត្រូវបានបញ្ជូនពីផ្នែកពិគ្រោះក្រៅមកផ្នែក ${targetWardKh} សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
            automaticWardMessage(database,{userId:session.user_id,role,wardCode:'opd'},patient,
              transferMsg, transferMsg,
              {wardCode:ward.code});
            syncClinicalRequests(database,patient,{userId:session.user_id,role,wardCode:'opd'});
            audit(database,request,'OPD_PATIENT_TRANSFERRED_TO_IPD',{userId:session.user_id,subjectUsername:session.username,
              details:{patientKey,fromWardCode:'opd',toWardCode:ward.code,invoiceId:invoice.id,invoiceNo:invoice.invoiceNo}});
            database.sqlite.exec('COMMIT');
            return sendJson(response,200,{patient:patientRecordResponse(patient),ward,invoice},{secure:config.cookieSecure});
          } catch(error) { database.sqlite.exec('ROLLBACK'); throw error; }
        } catch(error) { return sendJson(response,400,{error:error.message},{secure:config.cookieSecure}); }
      }
      if (request.method === 'GET' && pathname === '/api/pharmacy/opd-prescriptions') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(requireContext(session)))
          return sendJson(response,403,{error:'Pharmacy access is required.'},{secure:config.cookieSecure});
        const patients=listOpdPrescriptions(database).map(item=>{ const paymentStatus=paymentStatusForPatient(database,item.patientKey);const row=database.findPatient(item.patientKey);const data=parseStoredJson(row?.record_json);return {...item,queueNumber:Number(data['system:registrationQueueNumber']||data['scope:registration:id:registration_queue_number']||0)||null,paymentStatus,canDispense:['PAID','INSURANCE','NGO','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER'].includes(paymentStatus?.code)}; });
        return sendJson(response,200,{patients},{secure:config.cookieSecure});
      }
      if (request.method==='GET' && pathname==='/api/pharmacy/discharge-medications') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(requireContext(session))) return sendJson(response,403,{error:'Pharmacy access is required.'},{secure:config.cookieSecure});
        const patients=listDischargeMedicationOrders(database).map(item=>{const paymentStatus=paymentStatusForPatient(database,item.patientKey);return {...item,paymentStatus,canDispense:pharmacySettledCodes.has(paymentStatus?.code)}});
        return sendJson(response,200,{patients},{secure:config.cookieSecure});
      }
      if (request.method==='GET' && pathname==='/api/pharmacy/dispensing-board') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(requireContext(session))) return sendJson(response,403,{error:'Pharmacy access is required.'},{secure:config.cookieSecure});
        const opd=listOpdPrescriptions(database).map(item=>{const paymentStatus=paymentStatusForPatient(database,item.patientKey);const row=database.findPatient(item.patientKey);const data=parseStoredJson(row?.record_json);return {...item,queueNumber:Number(data['system:registrationQueueNumber']||data['scope:registration:id:registration_queue_number']||0)||null,canDispense:pharmacySettledCodes.has(paymentStatus?.code)}}).filter(item=>!item.dispensedAt&&item.canDispense);
        const ipd=listDischargeMedicationOrders(database).map(item=>{const paymentStatus=paymentStatusForPatient(database,item.patientKey);return {...item,paymentStatus,canDispense:pharmacySettledCodes.has(paymentStatus?.code)}}).filter(item=>!item.dispensedAt&&item.canDispense);
        return sendJson(response,200,{opd,ipd,updatedAt:Date.now()},{secure:config.cookieSecure});
      }
      if (request.method==='POST' && pathname==='/api/pharmacy/discharge-medications/received') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!['ADMIN','VICE_DIRECTOR','PHARMACY'].includes(requireContext(session))) return sendJson(response,403,{error:'Pharmacy access is required.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxClinicalBodyBytes);
        try {
          const patientKey=clinicalPatientKey(body?.patientKey);
          if(!pharmacySettledCodes.has(paymentStatusForPatient(database,patientKey)?.code))throw new Error('សូមបញ្ចប់ការបង់ប្រាក់ ឬការធានារ៉ាប់រង មុនពេលផ្ដល់ថ្នាំ។');
          const patient=markDischargeMedicationReceived(database,{patientKey,dischargeAt:body?.dischargeAt,userId:session.user_id});
          audit(database,request,'IPD_DISCHARGE_MEDICATIONS_RECEIVED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,dischargeAt:patient.dischargeAt,medicineCount:patient.medicineCount}});
          return sendJson(response,200,{patient},{secure:config.cookieSecure});
        } catch(error) { return sendJson(response,409,{error:error.message},{secure:config.cookieSecure}); }
      }
      const pharmacyOpdMatch=/^\/api\/pharmacy\/opd-prescriptions\/([0-9a-f-]+)$/.exec(pathname);
      if (request.method==='GET' && pharmacyOpdMatch) {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(requireContext(session)))
          return sendJson(response,403,{error:'Pharmacy access is required.'},{secure:config.cookieSecure});
        const prescription=opdPrescriptionForPharmacy(database,pharmacyOpdMatch[1]);
        if (!prescription) return sendJson(response,404,{error:'Prescription not found.'},{secure:config.cookieSecure});
        const paymentStatus=paymentStatusForPatient(database,prescription.patientKey);
        prescription.paymentStatus=paymentStatus;
        prescription.canDispense=['PAID','INSURANCE','NGO','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER'].includes(paymentStatus?.code);
        return sendJson(response,200,{prescription},{secure:config.cookieSecure});
      }
      const receiptMatch=/^\/api\/pharmacy\/opd-prescriptions\/([0-9a-f-]+)\/received$/.exec(pathname);
      if (request.method==='POST' && receiptMatch) {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        if (!['ADMIN','VICE_DIRECTOR','PHARMACY'].includes(requireContext(session))) return sendJson(response,403,{error:'Pharmacy access is required.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          const row = database.sqlite.prepare('SELECT patient_key FROM pharmacy_prescriptions WHERE id=?').get(receiptMatch[1]);
          if (!row) throw new Error('Prescription was not found.');
          const paymentStatus = paymentStatusForPatient(database, row.patient_key);
          const allowedPaidCodes = new Set(['PAID','INSURANCE','NGO','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER']);
          if (!allowedPaidCodes.has(paymentStatus?.code)) throw new Error('Pharmacy cannot confirm medicine delivery until the patient payment is completed.');
          const prescription=markOpdPrescriptionReceived(database,receiptMatch[1],session.user_id);
          updateOpdQueueStatus(database,prescription.patientKey,'RECEIVED',prescription.dispensedAt);
          audit(database,request,'OPD_PRESCRIPTION_RECEIVED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey:prescription.patientKey,prescriptionId:prescription.id}});
          database.sqlite.exec('COMMIT');
          return sendJson(response,200,{prescription},{secure:config.cookieSecure});
        } catch(error) { database.sqlite.exec('ROLLBACK');return sendJson(response,409,{error:error.message},{secure:config.cookieSecure}); }
      }


      if (request.method === 'GET' && pathname === '/api/patient-editor-history') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!clinicalFormReadRoles.has(sessionRole(session))) return sendJson(response, 403, { error: 'Clinical access is required.' }, { secure: config.cookieSecure });
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        const patient = database.findPatient(patientKey);
        if (!patient || !canAccessPatient(database, session, patient)) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
        return sendJson(response, 200, { entries: listEditorHistory(database, patientKey, {includeFieldChanges:['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(sessionRole(session))}) }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/pmrs2/preview') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','REGISTRATION','DOCTOR','NURSE','MIDWIFE'].includes(role)) {
          return sendJson(response, 403, { error: 'Clinical access is required.' }, { secure: config.cookieSecure });
        }
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        const patient = database.findPatient(patientKey);
        if (!patient) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
        if (!canAccessPatient(database, session, patient)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        const preview = pmrs2Preview(patientRecordResponse(patient, true));
        return sendJson(response, 200, { preview, reviewIssues: pmrs2ReviewIssues(preview, preview.triage) }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/pmrs2/prepare-export') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DOCTOR'].includes(requireContext(session))) return sendJson(response, 403, { error: 'Doctor or administrator access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        const body = await readJson(request, 10_000);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const row = database.findPatient(patientKey);
        if (!row) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
        if (!canAccessPatient(database, session, row)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        const patient = patientRecordResponse(row, true);
        if (!Number.isInteger(body.reviewedVersion) || body.reviewedVersion !== patient.version) return sendJson(response, 409, { error: 'The record changed. Open a fresh PMRS2 review.' }, { secure: config.cookieSecure });
        const identifier = boundedText(body.confirmedIdentifier, 160, 'Confirmed patient identifier', true);
        if (!identifier || ![patient.healthId, patient.caseNumber].filter(Boolean).includes(identifier)) return sendJson(response, 400, { error: 'Patient identifier does not match the saved record.' }, { secure: config.cookieSecure });
        if (body.reviewed !== true) return sendJson(response, 400, { error: 'Review the patient and all clinical sections first.' }, { secure: config.cookieSecure });
        const transferPackage = buildPmrs2TransferPackage(patient, new Date().toISOString());
        const checksum = crypto.createHash('sha256').update(JSON.stringify(transferPackage)).digest('hex');
        audit(database, request, 'PMRS2_EXPORT_PREPARED', { userId: session.user_id, subjectUsername: session.username,
          details: { patientKey, patientVersion: patient.version, warningCount: transferPackage.reviewIssues.length, checksum } });
        return sendJson(response, 200, { transferPackage, checksum }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/pmrs2/import-candidates') {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure:config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DOCTOR'].includes(requireContext(session))) return sendJson(response, 403, { error:'Doctor or administrator access is required.' }, { secure:config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error:'Security token is invalid.' }, { secure:config.cookieSecure });
        const body = await readJson(request, 2_000);
        const pid = normalizePmrsId(body?.sourcePid);
        if (pid.length < 4 || pid.length > 120) return sendJson(response, 400, { error:'PMRS2 patient ID is invalid.' }, { secure:config.cookieSecure });
        const patients = database.listPatients().filter(row => normalizePmrsId(row.health_id) === pid && canAccessPatient(database, session, row)).map(row => {
          const p = patientRecordResponse(row, false);
          return { patientKey:p.patientKey,healthId:p.healthId,fullName:p.fullName,caseNumber:p.caseNumber,
            version:p.version,serviceMode:p.serviceMode,entryDate:p.entryDate,departmentNameKh:p.departmentNameKh,
            paymentStatus:pmrsPaymentCategoryStatus(database,p.patientKey) };
        });
        return sendJson(response, 200, { patients }, { secure:config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/pmrs2/import-medicines') {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure:config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DOCTOR'].includes(requireContext(session))) return sendJson(response, 403, { error:'Doctor or administrator access is required.' }, { secure:config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) return sendJson(response, 403, { error:'Security token is invalid.' }, { secure:config.cookieSecure });
        const body = await readJson(request, 70_000);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const row = database.findPatient(patientKey);
        if (!row) return sendJson(response, 404, { error:'EMR patient was not found.' }, { secure:config.cookieSecure });
        if (!canAccessPatient(database, session, row)) return sendJson(response, 403, { error:'This patient is outside your active ward.' }, { secure:config.cookieSecure });
        const payment = pmrsPaymentCategoryStatus(database,patientKey);
        if (!['HEF_EQUITY','HEF_VULNERABLE','HEF_POOR','HEF_VULNERABLE_FAMILY'].includes(payment)) return sendJson(response, 403, { error:'This patient is not recorded as HEF in the EMR payment profile.' }, { secure:config.cookieSecure });
        if (body.reviewed !== true) return sendJson(response, 400, { error:'Review the patient, date, route, and every medicine before saving.' }, { secure:config.cookieSecure });
        if (!Number.isInteger(body.reviewedVersion) || body.reviewedVersion !== row.version) return sendJson(response, 409, { error:'The EMR record changed. Reload the patient and review again.' }, { secure:config.cookieSecure });
        try {
          const prepared = preparePmrsMedicineImport(body);
          const previous = patientRecordResponse(row, true);
          const imported = applyPmrsMedicineImport(previous.data, prepared, previous);
          if (!imported.added) return sendJson(response, 200, { added:0,skipped:imported.skipped,patientVersion:row.version }, { secure:config.cookieSecure });
          const summary = { caseNumber:previous.caseNumber,healthId:previous.healthId,firstName:previous.firstName,lastName:previous.lastName,
            fullName:previous.fullName,sex:previous.sex,age:previous.age,dateOfBirth:previous.dateOfBirth,phone:previous.phone,equityCard:previous.equityCard,
            paymentType:previous.paymentType,departmentCode:previous.departmentCode,departmentNameKh:previous.departmentNameKh,departmentNameEn:previous.departmentNameEn,
            serviceMode:previous.serviceMode,entryDate:previous.entryDate,dischargeDate:previous.dischargeDate };
          const saved = database.upsertPatient({ id:crypto.randomUUID(),patientKey,summary,data:imported.data,userId:session.user_id,savedAt:Date.now() });
          audit(database, request, 'PMRS2_MEDICINES_IMPORTED', { userId:session.user_id,subjectUsername:session.username,
            details:{patientKey,visitHash:crypto.createHash('sha256').update(prepared.sourceVisit).digest('hex'),target:prepared.target,recordAt:prepared.recordAt,added:imported.added,skipped:imported.skipped} });
          return sendJson(response, 200, { added:imported.added,skipped:imported.skipped,patientVersion:saved.version }, { secure:config.cookieSecure });
        } catch (error) { return sendJson(response, 400, { error:error.message }, { secure:config.cookieSecure }); }
      }
      if (request.method === 'GET' && pathname === '/api/admission-approvals') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD'].includes(role)) return sendJson(response,403,{error:'Clinical access is required.'},{secure:config.cookieSecure});
        const patientKey=clinicalPatientKey(url.searchParams.get('patientKey'));
        const patient=database.findPatient(patientKey);
        if (!patient) return sendJson(response,404,{error:'Patient not found.'},{secure:config.cookieSecure});
        if (!canAccessPatient(database,session,patient)) return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        return sendJson(response,200,{approval:admissionApprovalFor(database,patientKey)},{secure:config.cookieSecure});
      }
      if (request.method === 'GET' && pathname === '/api/admission-approvals/pending') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response,403,{error:'Only Admin or Director can view the approval list.'},{secure:config.cookieSecure});
        return sendJson(response,200,{items:listPendingAdmissionApprovals(database,role)},{secure:config.cookieSecure});
      }
      if (request.method === 'POST' && pathname === '/api/admission-approvals') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return sendJson(response,403,{error:'Only Admin or Director can approve an admission.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);
        const patientKey=clinicalPatientKey(body?.patientKey);
        const patient=database.findPatient(patientKey);
        if (!patient) return sendJson(response,404,{error:'Patient not found.'},{secure:config.cookieSecure});
        if (!canAccessPatient(database,session,patient) && !['ADMIN','VICE_DIRECTOR'].includes(role)) return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        try {
          database.sqlite.exec('BEGIN IMMEDIATE');
          const reviewRole=role;
          syncClinicalRequests(database,patient,{userId:session.user_id,role,wardCode:sessionWard(session)});
          const workflow=database.sqlite.prepare("SELECT id,status,revision FROM workflow_requests WHERE source_key=?").get('ADMISSION:'+patientKey);
          if(workflow?.status==='PENDING')reviewWorkflowRequest(database,workflow.id,{approved:true,revision:workflow.revision},{userId:session.user_id,role,wardCode:sessionWard(session)});
          else if(workflow?.status==='REJECTED')throw Error('Correct and resubmit the rejected request first.');
          const approval=admissionApprovalFor(database,patientKey);
          completePatientMessages(database,patientKey,messagingVisibility(session),{subjectPattern:/admission|ចូលសម្រាក/i});
          audit(database,request,'ADMISSION_APPROVED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,approverRole:reviewRole}});
          database.sqlite.exec('COMMIT');
          return sendJson(response,200,{approval},{secure:config.cookieSecure});
        } catch(error) {
          database.sqlite.exec('ROLLBACK');
          return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});
        }
      }
      if (request.method === 'GET' && pathname === '/api/patient-history') {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure:config.cookieSecure });
        const role = requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','CHIEF_WARD','NURSE','MIDWIFE'].includes(role)) return sendJson(response, 403, { error:'Clinical access is required.' }, { secure:config.cookieSecure });
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        const current = database.findPatient(patientKey);
        if (!current) return sendJson(response, 404, { error:'Patient not found.' }, { secure:config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR'].includes(role) && !canAccessPatient(database, session, current)) return sendJson(response, 403, { error:'This patient is outside your active ward.' }, { secure:config.cookieSecure });
        let rows;
        if (current.health_id) {
          rows = database.sqlite.prepare(`SELECT * FROM patient_records WHERE health_id=? ORDER BY CASE WHEN entry_date='' THEN 1 ELSE 0 END, entry_date DESC, created_at DESC`).all(current.health_id);
        } else {
          rows = [current];
        }
        const history = rows.map(row => { const item = patientRecordResponse(row, true); if (role === 'TRIAGE' && item.data) item.data = patientDataVisibleForRole(item.data, role); return item; });
        return sendJson(response, 200, { history }, { secure:config.cookieSecure });
      }
      if (request.method === 'DELETE' && pathname === '/api/patient-record') {
        return sendJson(response,403,{error:'សូមផ្ញើសំណើលុបទៅគណៈគ្រប់គ្រង។ មិនអាចលុបដោយផ្ទាល់បានទេ។'},{secure:config.cookieSecure});
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['ADMIN','VICE_DIRECTOR','REGISTRATION'].includes(role)) return sendJson(response,403,{error:'Only Admin or Registration can delete patient records.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);
        const patientKey=clinicalPatientKey(body?.patientKey);
        const patient=database.findPatient(patientKey);
        if (!patient) return sendJson(response,404,{error:'Patient not found.'},{secure:config.cookieSecure});
        const data=parseStoredJson(patient.record_json);
        const triageStarted = data['system:triageStatus']==='COMPLETED' || Boolean(data['system:triageCompletedAt']);
        const clinicalStarted = triageStarted || Boolean(patient.service_mode);
        const financialStarted = Number(database.sqlite.prepare('SELECT COUNT(*) AS n FROM finance_charges WHERE patient_key=?').get(patientKey)?.n || 0) > 0 ||
          Number(database.sqlite.prepare('SELECT COUNT(*) AS n FROM finance_payments WHERE patient_key=?').get(patientKey)?.n || 0) > 0 ||
          Number(database.sqlite.prepare('SELECT COUNT(*) AS n FROM pharmacy_prescriptions WHERE patient_key=?').get(patientKey)?.n || 0) > 0;
        if (clinicalStarted || financialStarted) return sendJson(response,409,{error:'This patient cannot be deleted because the clinical or cashier workflow has already started.'},{secure:config.cookieSecure});
        database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          database.sqlite.prepare('DELETE FROM queue_board_calls WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM opd_queue_entries WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM admission_approvals WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM clinical_form_records WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM patient_editor_history WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM patient_records WHERE patient_key=?').run(patientKey);
          database.sqlite.exec('COMMIT');
        } catch(error){database.sqlite.exec('ROLLBACK');throw error;}
        audit(database,request,'PATIENT_RECORD_DELETED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,fullName:patient.full_name,caseNumber:patient.case_number}});
        return sendJson(response,200,{ok:true,message:'Patient record deleted.'},{secure:config.cookieSecure});
      }
      if ((request.method === 'DELETE' || request.method === 'POST') && pathname === '/api/patient-triage') {
        return sendJson(response,403,{error:'ការលុបត្រូវការសំណើ និងការអនុម័តពីគណៈគ្រប់គ្រង។'},{secure:config.cookieSecure});
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = sessionRole(session);
        if (!['TRIAGE', 'ADMIN', 'VICE_DIRECTOR'].includes(role)) {
          return sendJson(response, 403, { error: 'Only Triage or Admin can delete triage records.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, 10_000);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const patient = database.findPatient(patientKey);
        if (!patient) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
        if (!canAccessPatient(database, session, patient)) {
          return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        }
        const hasPayments = Number(database.sqlite.prepare('SELECT COUNT(*) AS n FROM finance_payments WHERE patient_key=?').get(patientKey)?.n || 0) > 0;
        const hasPrescriptions = Number(database.sqlite.prepare('SELECT COUNT(*) AS n FROM pharmacy_prescriptions WHERE patient_key=?').get(patientKey)?.n || 0) > 0;
        if (hasPayments || hasPrescriptions) {
          return sendJson(response, 409, { error: 'Triage cannot be deleted because pharmacy or cashier processing has already occurred for this patient.' }, { secure: config.cookieSecure });
        }
        const data = parseStoredJson(patient.record_json);
        for (const key of Object.keys(data)) {
          if (key.startsWith('scope:triage:') || key.startsWith('scope:triage_')) {
            delete data[key];
          }
        }
        data['system:triageStatus'] = 'WAITING';
        data['system:workflowStage'] = 'TRIAGE_WAITING';
        delete data['system:triageCompletedAt'];
        delete data['system:triageReferredWardCode'];
        delete data['system:signature:triage'];
        delete data['system:triageParaclinic'];
        delete data['system:triageSaved'];
        delete data['system:triageTransferred'];
        delete data['system:opdEncounterAt'];
        delete data['system:opdPreConsultParaclinicAt'];
        delete data['system:encounterId'];
        delete data['system:triageId'];

        const updatedAt = Date.now();
        database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          database.sqlite.prepare('DELETE FROM opd_queue_entries WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM queue_board_calls WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare('DELETE FROM admission_approvals WHERE patient_key=?').run(patientKey);
          database.sqlite.prepare(
            "UPDATE patient_records SET record_json=?, service_mode='', department_code='', version=version+1, updated_at=? WHERE patient_key=?"
          ).run(JSON.stringify(data), updatedAt, patientKey);
          database.sqlite.exec('COMMIT');
        } catch (error) {
          database.sqlite.exec('ROLLBACK');
          throw error;
        }
        paymentStatusCache.delete(patientKey);
        audit(database, request, 'PATIENT_TRIAGE_DELETED', {
          userId: session.user_id,
          subjectUsername: session.username,
          details: { patientKey, fullName: patient.full_name, activeRole: role }
        });
        return sendJson(response, 200, { ok: true, message: 'Triage record deleted successfully.' }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/patient-photo') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = sessionRole(session);
        if (!clinicalWriteRoles.has(role) && !['REGISTRATION', 'TRIAGE', 'ADMIN', 'VICE_DIRECTOR', 'DOCTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
          return sendJson(response, 403, { error: 'Your role cannot update patient photos.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxPatientBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const photo = String(body?.photo || '');
        if (!validPatientPhoto(photo)) return sendJson(response, 400, { error: 'Invalid patient photo data.' }, { secure: config.cookieSecure });
        const existing = database.findPatient(patientKey);
        if (!existing) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
        if (body.expectedVersion !== undefined && (!Number.isInteger(body.expectedVersion) || body.expectedVersion !== existing.version)) return sendJson(response,409,{error:'The patient record changed. Reload the patient before uploading the photo.'},{secure:config.cookieSecure});
        if (!canAccessPatient(database,session,existing)) return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const data = parseStoredJson(existing.record_json);
        data['scope:registration:id:web_patient_photo'] = photo;
        data['scope:registration:id:patient_photo'] = photo;
        data['system:patientPhoto'] = photo;
        const updatedAt = Date.now();
        const changedPhoto = database.sqlite.prepare('UPDATE patient_records SET record_json=?, version=version+1, updated_at=? WHERE patient_key=? AND version=?').run(JSON.stringify(data), updatedAt, patientKey, existing.version);
        if (!changedPhoto.changes) return sendJson(response,409,{error:'The patient record changed. Reload before uploading the photo.'},{secure:config.cookieSecure});
        const updated = database.findPatient(patientKey);
        audit(database, request, 'PATIENT_PHOTO_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, activeRole:role, changedFields:patientRecordChangeNotes(existing, updated) } });
        return sendJson(response, 200, { ok: true, patientKey, patientVersion:updated.version, updatedAt }, { secure: config.cookieSecure });
      }
      if (request.method === 'PUT' && pathname === '/api/patient-record') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!clinicalWriteRoles.has(sessionRole(session)) && !['REGISTRATION', 'TRIAGE'].includes(sessionRole(session))) {
          return sendJson(response, 403, { error: 'Your role cannot update patient records.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) ||
            !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxPatientBodyBytes);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return sendJson(response, 400, { error: 'Patient record information is invalid.' }, { secure: config.cookieSecure });
        }
        const patientKey = clinicalPatientKey(body.patientKey);
        const submittedSummary = sanitizePatientSummary(body.summary);
        const submittedData = recordData(body.data);
        validateDailyMonitoringDates(database, submittedData);
        let summary = submittedSummary;
        if (!summary.caseNumber && !summary.healthId) badRequest('Case number or Health ID is required.');
        if (!summary.fullName) badRequest('Patient name is required.');
        // Registration and clinical saves may change the entry date, but only
        // the IPD discharge form or OPD pharmacy receipt creates a discharge. Keep
        // server-owned admission fields from the existing record so a browser
        // cannot forge or accidentally erase them.
        const existingPatient = database.findPatient(patientKey);
        const activeRoleBeforeSave = sessionRole(session)==='CHIEF_WARD'?'DOCTOR':sessionRole(session);
        const visitSourceKey = body.newVisitFrom ? clinicalPatientKey(body.newVisitFrom) : '';
        if (visitSourceKey) {
          if (!['REGISTRATION','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(activeRoleBeforeSave)) return sendJson(response,403,{error:'Only Registration can start a new visit from an existing patient.'},{secure:config.cookieSecure});
          if (!database.findPatient(visitSourceKey)) return sendJson(response,404,{error:'The previous patient record was not found.'},{secure:config.cookieSecure});
          if (existingPatient || patientKey === visitSourceKey) return sendJson(response,409,{error:'Use a new case number for this visit. The previous record must remain unchanged.'},{secure:config.cookieSecure});
        }
        const registrationSave=activeRoleBeforeSave==='REGISTRATION' || (RECORD_MANAGEMENT.includes(activeRoleBeforeSave) && body.editorScope==='registration');
        if (activeRoleBeforeSave === 'TRIAGE' && !existingPatient) {
          return sendJson(response, 400, { error: 'This patient must be registered first. Triage cannot create a new patient record.' }, { secure: config.cookieSecure });
        }
        if (existingPatient && !canAccessPatient(database, session, existingPatient)) {
          return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        }
        if (existingPatient && Number.isInteger(body.expectedVersion) && body.expectedVersion !== existingPatient.version) {
          return sendJson(response,409,{error:'This patient record changed. Reopen the latest record before saving so earlier clinical notes are preserved.'},{secure:config.cookieSecure});
        }
        if (body.submitOpdPrescription === true && existingPatient && body.expectedVersion !== existingPatient.version) {
          return sendJson(response,409,{error:'This patient record changed. Reopen the latest record before sending the prescription.'},{secure:config.cookieSecure});
        }
        const existingData = existingPatient ? parseStoredJson(existingPatient.record_json) : Object.create(null);
        if((body.triageSave===true||body.triageEdit===true)&&!['TRIAGE',...RECORD_MANAGEMENT].includes(sessionRole(session)))return sendJson(response,403,{error:'គណនីនេះមិនអាចរក្សាទុកទ្រីយ៉ាបានទេ។'},{secure:config.cookieSecure});
        if(body.transferToTriage===true&&!['REGISTRATION',...RECORD_MANAGEMENT].includes(sessionRole(session)))return sendJson(response,403,{error:'គណនីនេះមិនអាចបញ្ជូនពីការចុះឈ្មោះបានទេ។'},{secure:config.cookieSecure});
        let editAccess=null;
        if(existingPatient){try{editAccess=assertEncounterWrite(database,session,existingPatient,body.editorScope||undefined);}catch(error){return sendJson(response,error.status||403,{error:error.message},{secure:config.cookieSecure});}}
        if(body.editOnly===true && existingPatient && body.editorScope==='triage' &&
          (submittedSummary.departmentCode!==existingPatient.department_code || submittedSummary.serviceMode!==existingPatient.service_mode))
          return sendJson(response,409,{error:'ការប្តូរផ្នែកត្រូវប្រើសកម្មភាពបញ្ជូន។ រក្សាទុកនេះកែតែព័ត៌មានទ្រីយ៉ា។'},{secure:config.cookieSecure});
        if (existingPatient && activeRoleBeforeSave === 'DOCTOR' && existingPatient.service_mode === 'opd') {
          const workflowStage = String(existingData['system:workflowStage'] || '');
          const isOpdClinicalSave = body.editorScope === 'medical' || body.editorScope === 'opd' || body.submitOpdPrescription === true || body.markMedicalComplete === true || Object.keys(submittedData).some(key => key.startsWith('scope:medical:') || key.startsWith('system:opdMedications')) || submittedData['system:medicalRecordCompleted'] === true;
          if (isOpdClinicalSave && (!['DOCTOR_READY','IN_CONSULTATION'].includes(workflowStage) || !opdConsultationPaymentConfirmed(database,existingPatient))) {
            return sendJson(response, 409, { error: 'The OPD consultation fee must be confirmed by Cashier before the patient can meet the doctor.' }, { secure: config.cookieSecure });
          }
        }
        const isTriageSaveOrEdit = body.triageSave === true || body.triageEdit === true || body.editorScope === 'triage';
        if (activeRoleBeforeSave === 'TRIAGE' && existingPatient && existingData['system:triageStatus'] === 'COMPLETED' && !isTriageSaveOrEdit) {
          return sendJson(response, 409, { error: 'Triage is already completed for this patient. Use the patient record to view the completed triage.' }, { secure: config.cookieSecure });
        }
        const caseTypeFromData = dataValue => {
          const hasNew = dataValue?.['scope:registration:id:emr_pmrs_case_new'] === true || dataValue?.['scope:registration:id:emr_pmrs_case_new'] === 'true';
          const hasOld = dataValue?.['scope:registration:id:emr_pmrs_case_old'] === true || dataValue?.['scope:registration:id:emr_pmrs_case_old'] === 'true';
          if (hasNew === hasOld) return '';
          return hasNew ? 'new' : 'old';
        };
        if (registrationSave) {
          const source=visitSourceKey?database.findPatient(visitSourceKey):null;
          if(existingData['system:previousPatientKey']) {
            if(String(summary.healthId||'').trim()!==String(existingPatient.health_id||'').trim()) return sendJson(response,409,{error:'A returning visit must keep the existing Patient ID.'},{secure:config.cookieSecure});
            if(caseTypeFromData(submittedData)==='new') return sendJson(response,409,{error:'An existing patient must keep Old Case for this visit.'},{secure:config.cookieSecure});
          }
          if(source && String(summary.healthId||'').trim()!==String(source.health_id||'').trim()) return sendJson(response,409,{error:'A returning visit must keep the existing Patient ID.'},{secure:config.cookieSecure});
          if(source && caseTypeFromData(submittedData)!=='old') return sendJson(response,409,{error:'An existing patient must use Old Case for a new visit.'},{secure:config.cookieSecure});
          const knownId=summary.healthId && database.sqlite.prepare('SELECT patient_key FROM patient_records WHERE health_id=? COLLATE NOCASE LIMIT 1').get(summary.healthId);
          if(!existingPatient && knownId && caseTypeFromData(submittedData)==='new') return sendJson(response,409,{error:'This Patient ID already exists. Add a new Old Case record from the Patient ID in the patient list.'},{secure:config.cookieSecure});
          if(body.transferToTriage && existingData['system:triageStatus']==='COMPLETED') return sendJson(response,409,{error:'Start a new visit from Patient ID; do not overwrite a completed visit.'},{secure:config.cookieSecure});
          const selectedCaseType = caseTypeFromData(submittedData) || String(existingData['system:caseType'] || '').toLowerCase();
          if (!['new','old'].includes(selectedCaseType)) return sendJson(response, 400, { error: 'Select New Case or Old Case during registration before continuing.' }, { secure: config.cookieSecure });
        }
        if (activeRoleBeforeSave === 'TRIAGE' && !caseTypeFromData(existingData) && !['new','old'].includes(String(existingData['system:caseType'] || '').toLowerCase())) {
          return sendJson(response, 400, { error: 'Registration is incomplete. Select New Case or Old Case in Registration first.' }, { secure: config.cookieSecure });
        }
        const activeClinicalRole = sessionRole(session)==='CHIEF_WARD'?'DOCTOR':sessionRole(session);
        const editorScope = RECORD_MANAGEMENT.includes(activeClinicalRole) && ['registration','triage','medical','nursing'].includes(body.editorScope)
          ? body.editorScope : '';
        const triageSave = !(body.editOnly===true && existingData['system:triageStatus']==='COMPLETED') && (body.triageSave === true || activeClinicalRole === 'TRIAGE' || editorScope === 'triage');
        const effectiveRoleForMerge = registrationSave ? 'REGISTRATION' : (activeRoleBeforeSave==='TRIAGE'||triageSave||editorScope==='triage' ? 'TRIAGE' : RECORD_MANAGEMENT.includes(activeRoleBeforeSave)?(body.editorScope==='nursing'?'NURSE':'DOCTOR'):activeRoleBeforeSave);
        summary = mergePatientSummaryForRole(existingPatient, submittedSummary, effectiveRoleForMerge);
        const data = mergeRecordDataForRole(existingData, submittedData, effectiveRoleForMerge, Boolean(existingPatient));
        if (registrationSave) {
          data['system:caseType'] = caseTypeFromData(data);
          const sameArrivalDay = existingPatient && existingPatient.entry_date === summary.entryDate;
          const existingQueueNumber = sameArrivalDay ? registrationQueueNumberFromData(existingData) : '';
          const queueNumber = existingQueueNumber || nextRegistrationQueueNumber(database, patientKey, summary.entryDate);
          ensureUniqueRegistrationQueueNumber(database, patientKey, summary.entryDate, queueNumber);
          data['system:registrationQueueNumber'] = queueNumber;
        }
        if (activeRoleBeforeSave === 'DOCTOR' && Object.prototype.hasOwnProperty.call(submittedData,'system:dailyMonitoringRecords')) {
          let doctorDaily = [];
          try {
            const rawDaily = submittedData['system:dailyMonitoringRecords'];
            const parsedDaily = typeof rawDaily === 'string' ? JSON.parse(rawDaily) : rawDaily;
            if (Array.isArray(parsedDaily)) doctorDaily = parsedDaily;
          } catch { /* Malformed follow-ups cannot replace the doctor's report source. */ }
          data['system:doctorDailyMedicineOrders'] = JSON.stringify(doctorDaily.slice(0,500));
        }
        if (existingPatient?.service_mode === 'opd') {
          const latestRx = database.sqlite.prepare(`SELECT dispensed_at FROM pharmacy_prescriptions
            WHERE patient_key=? ORDER BY rowid DESC LIMIT 1`).get(patientKey);
          if (latestRx?.dispensed_at) {
            let before = existingData['system:opdMedications'] || '[]';
            let after = data['system:opdMedications'] || '[]';
            try { before = JSON.stringify(JSON.parse(before)); after = JSON.stringify(JSON.parse(after)); } catch {}
            if (body.submitOpdPrescription === true || before !== after) {
              return sendJson(response, 409, { error:'ឱសថស្ថានបានបញ្ជាក់ថាអ្នកជំងឺបានទទួលឱសថរួចហើយ។ មិនអាចកែវេជ្ជបញ្ជានេះបានទេ។' }, { secure:config.cookieSecure });
            }
          }
        }
        const admissionKeys = [
          'system:admissionStatus', 'system:careType',
          'system:currentDepartmentCode', 'system:currentDepartmentNameKh',
          'system:currentDepartmentNameEn', 'system:currentWardCode', 'system:currentRoomId',
          'system:currentRoomNameKh', 'system:currentRoomNameEn',
          'system:currentBedId', 'system:currentBedLabel', 'system:discharge', 'system:opdDischarge',
        ];
        admissionKeys.forEach(key => {
          if (Object.prototype.hasOwnProperty.call(existingData, key)) data[key] = existingData[key];
          else delete data[key];
        });
        const existingDischarge = existingData['system:discharge'];
        const hasFormalDischarge = existingData['system:admissionStatus'] === 'discharged' &&
          existingDischarge && typeof existingDischarge === 'object';
        const hasOpdDischarge = existingPatient?.service_mode === 'opd' && Boolean(existingData['system:opdDischarge']?.dispensedAt);
        summary.dischargeDate = hasFormalDischarge || hasOpdDischarge ? existingPatient.discharge_date : '';
        const savedAt = Date.now();
// (activeClinicalRole, editorScope, triageSave declared earlier)
        if (registrationSave) {
          if (visitSourceKey) data['system:previousPatientKey'] = visitSourceKey;
          // Registration is hospital-wide and must feed Triage before any ward bed list.
          if (!existingPatient) {
            summary.departmentCode = '';
            summary.departmentNameKh = '';
            summary.departmentNameEn = '';
            summary.serviceMode = '';
          }
          if (!existingData['system:triageStatus']) {
            data['system:triageStatus'] = 'WAITING';
            data['system:workflowStage'] = 'TRIAGE_WAITING';
            data['system:registeredAt'] = existingData['system:registeredAt'] || savedAt;
          }
        } else if (triageSave) {
          if (!summary.departmentCode || !summary.serviceMode) badRequest('Select a receiving ward/service before completing triage.');
          data['system:signature:triage'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
          data['system:triageStatus'] = 'COMPLETED';
          const paraclinicRequested = submittedData['scope:triage:id:triage_paraclinic'] === true || submittedData['scope:triage:id:triage_paraclinic'] === 'true';
          data['system:triageParaclinic'] = paraclinicRequested;
          const wasTriageTransferred = Boolean(
            existingPatient && (
              existingData['system:triageStatus'] === 'COMPLETED' ||
              existingData['system:triageTransferred'] ||
              existingData['system:triageCompletedAt'] ||
              existingData['system:triageSaved']
            )
          );
          if (!wasTriageTransferred) {
            data['system:workflowStage'] = summary.serviceMode === 'ipd' ? 'WARD_WAITING'
              : paraclinicRequested ? 'OPD_PARACLINIC_ORDERING' : 'CASHIER_PENDING_OPD';
            data['system:triageCompletedAt'] = savedAt;
            data['system:triageReferredWardCode'] = summary.departmentCode;
            if (summary.serviceMode === 'opd') {
              data['system:opdEncounterAt'] = savedAt;
              if (paraclinicRequested) data['system:opdPreConsultParaclinicAt'] = savedAt;
              else delete data['system:opdPreConsultParaclinicAt'];
              delete data['system:opdConsultedAt'];
              delete data['system:opdConsultationPaidAt'];
              delete data['system:opdConsultationInvoiceId'];
            }
          } else {
            // Post-transfer correction: preserve existing downstream workflow stage and timestamps
            if (existingData['system:workflowStage']) data['system:workflowStage'] = existingData['system:workflowStage'];
            if (existingData['system:triageCompletedAt']) data['system:triageCompletedAt'] = existingData['system:triageCompletedAt'];
            data['system:triageUpdatedAt'] = savedAt;
          }
        } else if (activeClinicalRole === 'DOCTOR' || editorScope === 'medical') {
          const doctorSig = JSON.stringify(signatureSnapshot(database, session, savedAt));
          data['system:signature:medical'] = doctorSig;
          const subTab = String(body.clinicalSubTab || '').toLowerCase();
          const svcMode = String(summary.serviceMode || existingPatient?.service_mode || '').toLowerCase();
          if (subTab === 'opd' || svcMode === 'opd') {
            data['system:signature:opdDoctor'] = doctorSig;
          } else if (subTab === 'ipd' || svcMode === 'ipd') {
            data['system:signature:ipdDoctor'] = doctorSig;
          } else {
            if (svcMode === 'opd') data['system:signature:opdDoctor'] = doctorSig;
            else data['system:signature:ipdDoctor'] = doctorSig;
          }
          if (activeClinicalRole === 'DOCTOR' && svcMode === 'opd') {
            data['system:opdConsultedAt'] = data['system:opdConsultedAt'] || savedAt;
          }
        } else if (activeClinicalRole === 'NURSE' || activeClinicalRole === 'MIDWIFE' || editorScope === 'nursing') {
          data['system:signature:nursing'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
        }
        if (activeClinicalRole === 'DOCTOR' && existingPatient?.service_mode === 'opd' && data['system:opdConsultedAt']) {
          const currentBill = patientBill(database, patientKey);
          const outstanding = Number(currentBill?.summary?.KHR?.balance || 0) + Number(currentBill?.summary?.USD?.balance || 0);
          if (outstanding > 0 && currentBill?.invoice?.id) {
            data['system:cashierQueueRequest'] = {
              invoiceId:currentBill.invoice.id, sentAt:savedAt, sentBy:session.user_id,
              wardCode:'opd', source:'OPD_CONSULT',
            };
            queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
          }
        }
        let prescriptionSnapshot=null;
        if (body.submitOpdPrescription === true) {
          if (activeClinicalRole !== 'DOCTOR') return sendJson(response,403,{error:'Only the prescribing doctor can submit an OPD prescription.'},{secure:config.cookieSecure});
          try { prescriptionSnapshot=prepareOpdPrescription(data,summary,JSON.parse(data['system:signature:medical'])); }
          catch(error) { return sendJson(response,400,{error:error.message},{secure:config.cookieSecure}); }
        }
        let patient, pharmacySubmission=null, wardMedicineNotification=null, opdReferral=null;
        database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          patient = database.upsertPatient({
            id: crypto.randomUUID(), patientKey, summary, data,
            userId: session.user_id, savedAt,
          });
          saveEditorHistory(database, { patientKey, role: activeClinicalRole, editorScope, userId: session.user_id,
            editorName: String(session.display_name || session.username || ''), savedAt,
            existingData, data, nursingDays: body.nursingDays, nursingLabels: body.nursingLabels });
          ensureAdmissionMovement(database, patient, session.user_id, savedAt);
          const wasTransferredBefore = Boolean(
            existingPatient && (
              existingData['system:triageStatus'] === 'COMPLETED' ||
              existingData['system:triageTransferred'] ||
              existingData['system:triageCompletedAt'] ||
              existingData['system:triageSaved']
            )
          );
          if (triageSave && !wasTransferredBefore && patient.service_mode==='opd') {
            const consultationCharge=addCatalogCharge(database,patientKey,'OPD_CONSULT',session.user_id,`CARE_ROUTE:${patientKey}:OPD`,'Automatically added when Triage selected OPD');
            const consultationBill=patientBill(database,patientKey,consultationCharge.invoiceId);
            const balance=Number(consultationBill?.summary?.KHR?.balance||0)+Number(consultationBill?.summary?.USD?.balance||0);
            data['system:opdConsultationInvoiceId']=consultationCharge.invoiceId;
            if(balance>0){
              if(data['system:triageParaclinic']===true||data['system:triageParaclinic']==='true'){
                data['system:workflowStage']='OPD_PARACLINIC_ORDERING';
                delete data['system:cashierQueueRequest'];
              }else{
                data['system:workflowStage']='CASHIER_PENDING_OPD';
                data['system:cashierQueueRequest']={invoiceId:consultationCharge.invoiceId,sentAt:savedAt,sentBy:session.user_id,wardCode:'opd',source:'TRIAGE_OPD_CONSULTATION'};
                queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
              }
            }else{
              data['system:opdConsultationPaidAt']=savedAt;
              data['system:workflowStage']=(data['system:triageParaclinic']===true||data['system:triageParaclinic']==='true')?'OPD_PARACLINIC_ORDERING':'DOCTOR_READY';
              delete data['system:cashierQueueRequest'];
            }
            database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),savedAt,patientKey);
            patient=database.findPatient(patientKey);
          }
          if (triageSave && !wasTransferredBefore && patient.service_mode==='opd') {
            opdReferral=referToOpd(database,patientKey,savedAt);
          } else if (patient.service_mode==='opd' && (activeClinicalRole==='DOCTOR' || editorScope==='medical')) {
            updateOpdQueueStatus(database,patientKey,'IN_CONSULTATION',savedAt);
            if (!data['system:encounterId']) {
              const now = new Date(savedAt);
              const pad = (n, l = 2) => String(n).padStart(l, '0');
              const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
              const counterRow = database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?").get(`OPD-${datePart}-%`);
              const seq = (counterRow?.c || 0) + 1;
              const encId = `OPD-${datePart}-${pad(seq, 4)}`;
              data['system:encounterId'] = encId;
              data['encounterId'] = encId;
              data['scope:triage:id:web_encounter_id'] = encId;
              database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),savedAt,patientKey);
            }
          }
          const pendingDate=patient.service_mode === 'ipd' && ['DOCTOR','NURSE','MIDWIFE'].includes(activeClinicalRole)
            ? queueLateWardMedicineOrder(database,patient,patientWorkWard(patient),
              [...new Set([...wardMedicineOrderDates(data,patient.entry_date),
                ...wardMedicineOrderDates(existingData,patient.entry_date)])]) : '';
          // IPD medicine delivery alerts are issued only after Nurse/Midwife → Chief of Ward → Director signatures.
          // Do not alert Pharmacy merely because an order was saved.
          wardMedicineNotification=null;
          if (['DOCTOR','NURSE','MIDWIFE'].includes(activeClinicalRole)) completePatientMessages(database,patientKey,messagingVisibility(session),{before:savedAt});
          audit(database, request, 'PATIENT_RECORD_SAVED', {
            userId: session.user_id,
            subjectUsername: session.username,
            details: { patientId: patient.id, patientKey, version: patient.version, editorScope, activeRole: activeClinicalRole,
              changedFields: patientRecordChangeNotes(existingPatient, database.findPatient(patientKey)) },
          });
          if (patient.service_mode === 'ipd' && ['DOCTOR','NURSE','MIDWIFE'].includes(activeClinicalRole)) {
            const ward = patientWorkWard(patient);
            for (const date of wardMedicineOrderDates(data, patient.entry_date)) {
              syncMedicineStock(database, `IPD_DAILY:${patientKey}:${ward}:${date}`, ordersForDate(data, patient.entry_date, date).medications, session.user_id);
            }
          }
          if (prescriptionSnapshot) {
            pharmacySubmission=submitOpdPrescription(database,patient,prescriptionSnapshot,{userId:session.user_id,role:activeClinicalRole,wardCode:sessionWard(session)});
            if (!pharmacySubmission.duplicate) {
              updateOpdQueueStatus(database,patientKey,'SENT_TO_PHARMACY',savedAt);
              syncMedicineStock(database, `OPD_RX:${pharmacySubmission.id}`, prescriptionSnapshot.medications || [], session.user_id);
            }
            audit(database,request,'OPD_PRESCRIPTION_SUBMITTED',{userId:session.user_id,subjectUsername:session.username,
              details:{patientKey,prescriptionId:pharmacySubmission.id,duplicate:pharmacySubmission.duplicate}});
          }
          consumeCorrection(database,editAccess);
          syncClinicalRequests(database,patient,{userId:session.user_id,role:activeClinicalRole,wardCode:sessionWard(session)});
          database.sqlite.exec('COMMIT');
        } catch(error) { database.sqlite.exec('ROLLBACK'); throw error; }
        if (triageSave) {
          data['system:triageSaved'] = true;
          data['system:triageTransferred'] = true;
          const previousDept = (body.previousWard || existingPatient?.department_code || '').toLowerCase();
          const newDept = (patient.department_code || '').toLowerCase();
          const wardChanged = Boolean(body.triageWardChanged || (previousDept && newDept && previousDept !== newDept));

          const wasTransferredAtStart = Boolean(
            existingPatient && (
              existingData['system:triageStatus'] === 'COMPLETED' ||
              existingData['system:triageTransferred'] ||
              existingData['system:triageCompletedAt'] ||
              existingData['system:triageSaved']
            )
          );

          if (!wasTransferredAtStart) {
            if (wardChanged) {
              releasePatientFromHospitalMap(database, patientKey, session.user_id, savedAt);
              completePatientMessages(database, patientKey, messagingVisibility(session), {
                before: savedAt,
                subjectPattern: /^(New patient transferred from OPD|មានអ្នកជំងឺថ្មីពីតម្រៀប|អ្នកជំងឺឈ្មោះ.*ត្រូវបានបញ្ជូន)/
              });
              if (summary.serviceMode === 'ipd') {
                try { notifyTriageReferral(database, session, patient); } catch {}
              }
            } else if (!existingPatient?.department_code && summary.serviceMode === 'ipd') {
              try { notifyTriageReferral(database, session, patient); } catch {}
            }
          }
        }
        const responsePatient = patientRecordResponse(patient);
        responsePatient.recordAccess=encounterAccess(database,session,patient);
        if (activeClinicalRole === 'TRIAGE' && responsePatient.data) responsePatient.data = patientDataVisibleForRole(responsePatient.data, activeClinicalRole);
        return sendJson(response, 200, { patient: responsePatient, pharmacySubmission,
          opdQueue: patient.service_mode==='opd' ? getOpdQueueEntry(database,patientKey) : null,
          wardMedicineNotification:wardMedicineNotification ? {id:wardMedicineNotification.id} : null }, {
          secure: config.cookieSecure,
        });
      }
      if (request.method === 'PATCH' && pathname === '/api/patient-admission') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!clinicalWriteRoles.has(sessionRole(session))) {
          return sendJson(response, 403, { error: 'Your role cannot update admissions.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) ||
            !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxPatientBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const existing = database.findPatient(patientKey);
        if (!existing) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        if (!canAccessPatient(database, session, existing)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        const update = sanitizeAdmissionAction(body);
        try{const policy=encounterAccess(database,session,existing,'medical');if(policy.discharged || policy.received && existing.service_mode==='opd')return sendJson(response,403,{error:'កំណត់ត្រាត្រូវបានបិទ។ ការកែប្រែក្រោយចេញពីពេទ្យត្រូវធ្វើតាមសំណើអនុម័ត។'},{secure:config.cookieSecure});}catch(error){return sendJson(response,403,{error:error.message},{secure:config.cookieSecure});}
        if (update.action === 'discharge' && !['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','CHIEF_WARD'].includes(sessionRole(session))) {
          return sendJson(response, 403, { error: 'Only a doctor or administrator can discharge a patient.' }, { secure: config.cookieSecure });
        }
        const mapRow=database.findHospitalState('main'),assignmentMap=mapRow?parseStoredJson(mapRow.state_json):null;
        let assignmentBed=null;
        if(update.action==='assign'){
          for(const d of assignmentMap?.departments||[])for(const r of d.rooms||[])for(const b of r.beds||[])if(b.id===update.bedId){if(d.code!==update.departmentCode||r.id!==update.roomId)badRequest('Choose a bed inside the receiving room.');assignmentBed=b;}
          if(assignmentBed?.patientKey&&assignmentBed.patientKey!==patientKey){const occ=database.findPatient(assignmentBed.patientKey);if(occ&&!occ.discharge_date&&occ.department_code===update.departmentCode)badRequest('This bed is already occupied. Refresh the map.');else assignmentBed.patientKey='';}
          if(database.sqlite.prepare("SELECT 1 FROM patient_records WHERE patient_key<>? AND COALESCE(discharge_date,'')='' AND json_extract(record_json,'$.\"system:currentBedId\"')=?").get(patientKey,update.bedId))badRequest('This bed is already occupied.');
        }
        database.sqlite.exec('SAVEPOINT admission_request196');
        try {
        const savedAt = Date.now();
        const data = parseStoredJson(existing.record_json);
        const previousWardCode = data['system:currentWardCode'] || existing.department_code || '';
        const previousDepartmentCode = existing.department_code || '';
        const previousAdmissionStatus = data['system:admissionStatus'] || '';
        ensureAdmissionMovement(database, existing, session.user_id, savedAt);

        if (update.action === 'assign') {
          if (existing.department_code && existing.department_code !== update.departmentCode) {
            badRequest('Patient must be assigned inside the receiving department.');
          }
          data['system:admissionStatus'] = 'admitted';
          data['system:currentWardCode'] = update.roomCode || (update.careType === 'obstetric' ? 'obstetric' : update.departmentCode);
          data['system:currentRoomId'] = update.roomId;
          data['system:currentRoomNameKh'] = update.roomNameKh;
          data['system:currentRoomNameEn'] = update.roomNameEn;
          data['system:currentBedId'] = update.bedId;
          data['system:currentBedLabel'] = update.bedLabel;
          data['system:careType'] = update.careType || 'nurse';
          data['system:workflowStage'] = 'ADMITTED';
          if (!data['system:encounterId']) {
            const rawCode = (update.departmentCode || update.roomCode || 'ipd').toLowerCase();
            let prefix = 'IPD';
            if (rawCode.includes('emerg') || rawCode === 'er') prefix = 'EMG';
            else if (rawCode.includes('surg')) prefix = 'SURG';
            else if (rawCode.includes('mat') || rawCode.includes('obst') || rawCode.includes('deliv')) prefix = 'MAT';
            else if (rawCode.includes('med')) prefix = 'MED';
            else if (rawCode.includes('ped')) prefix = 'PED';
            else if (rawCode.includes('tb')) prefix = 'TB';
            else if (rawCode.includes('art')) prefix = 'ART';
            const now = new Date(savedAt);
            const pad = (n, l = 2) => String(n).padStart(l, '0');
            const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
            const counterRow = database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?").get(`${prefix}-${datePart}-%`);
            const seq = (counterRow?.c || 0) + 1;
            const encId = `${prefix}-${datePart}-${pad(seq, 4)}`;
            data['system:encounterId'] = encId;
            data['encounterId'] = encId;
            data['scope:triage:id:web_encounter_id'] = encId;
          }
        } else if (update.action === 'transfer') {
          data['system:admissionStatus'] = 'waiting-transfer';
          data['system:workflowStage'] = 'WARD_WAITING';
          data['system:currentWardCode'] = '';
          data['system:currentRoomId'] = '';
          data['system:currentRoomNameKh'] = '';
          data['system:currentRoomNameEn'] = '';
          data['system:currentBedId'] = '';
          data['system:currentBedLabel'] = '';
          data['system:careType'] = update.careType || '';
        } else {
          data['system:admissionStatus'] = 'discharged';
          data['system:workflowStage'] = 'DISCHARGED';
          data['system:currentWardCode'] = '';
          data['system:currentRoomId'] = '';
          data['system:currentRoomNameKh'] = '';
          data['system:currentRoomNameEn'] = '';
          data['system:currentBedId'] = '';
          data['system:currentBedLabel'] = '';
          data['system:discharge'] = update.discharge;
          data['system:ipdDischargeSummary'] = JSON.stringify(buildIpdDischargeSummary(database, existing, data, update.discharge));
          data['system:signature:discharge'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
        }

        if (update.action !== 'discharge') {
          data['system:currentDepartmentCode'] = update.departmentCode;
          data['system:currentDepartmentNameKh'] = update.departmentNameKh;
          data['system:currentDepartmentNameEn'] = update.departmentNameEn;
        }

        if (update.action === 'assign') {
          const prefixMap = {
            emergency: 'EMG', surgery: 'SURG', gynecology: 'GYN', obstetric: 'MAT',
            maternity: 'MAT', pediatric: 'PED', pediatrics: 'PED', tb: 'TB',
            icu: 'ICU', medicine: 'MED', medical: 'MED', opd: 'OPD'
          };
          const deptCode = String(update.departmentCode || update.roomCode || '').toLowerCase();
          const newPrefix = prefixMap[deptCode] || 'IPD';
          const currentEnc = String(data['system:encounterId'] || data['encounterId'] || '');
          if (!currentEnc.startsWith(`${newPrefix}-`)) {
            const now = new Date(savedAt);
            const pad = (n, l = 2) => String(n).padStart(l, '0');
            const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
            const counterRow = database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?").get(`${newPrefix}-${datePart}-%`);
            const seq = (counterRow?.c || 0) + 1;
            const newEncId = `${newPrefix}-${datePart}-${pad(seq, 4)}`;
            data['system:encounterId'] = newEncId;
            data['encounterId'] = newEncId;
            data['scope:triage:id:web_encounter_id'] = newEncId;
          }

          const serviceCodeMap = {
            emergency: 'RH-EMG', surgery: 'RH-IPDSurg', gynecology: 'RH-IPDGen',
            obstetric: 'RH-Del', maternity: 'RH-Del', pediatric: 'RH-IPDGen',
            pediatrics: 'RH-IPDGen', tb: 'RH-TB1', icu: 'RH-EMG', medicine: 'RH-IPDGen',
            medical: 'RH-IPDGen', opd: 'RH-OPDSpec'
          };
          if (serviceCodeMap[deptCode]) {
            const newServiceCode = serviceCodeMap[deptCode];
            data['system:serviceCode'] = newServiceCode;
            data['serviceCode'] = newServiceCode;
            data['scope:triage:id:web_service_code'] = newServiceCode;
          }
        }

        if (update.action !== 'assign') {
          releasePatientFromHospitalMap(database, patientKey, session.user_id, savedAt);
        }
        let patient;
        database.sqlite.exec('SAVEPOINT admission_stock');
        try {
          patient = database.updatePatientAdmission({
            patientKey,
            departmentCode: update.action === 'discharge' ? existing.department_code : update.departmentCode,
            departmentNameKh: update.action === 'discharge' ? existing.department_name_kh : update.departmentNameKh,
            departmentNameEn: update.action === 'discharge' ? existing.department_name_en : update.departmentNameEn,
            serviceMode: update.action === 'discharge' ? (existing.service_mode || 'ipd') : 'ipd',
            dischargeDate: update.dischargeDate,
            data,
            userId: session.user_id,
            savedAt,
          });
          if (update.action === 'discharge') {
            syncMedicineStock(database, `IPD_DISCHARGE:${patientKey}`, update.discharge?.medications || [], session.user_id);
          }
          database.sqlite.exec('RELEASE admission_stock');
        } catch (error) {
          database.sqlite.exec('ROLLBACK TO admission_stock');
          database.sqlite.exec('RELEASE admission_stock');
          throw error;
        }
        if (update.action === 'assign') {
          if(assignmentBed){for(const d of assignmentMap.departments)for(const r of d.rooms)for(const b of r.beds)if(b.patientKey===patientKey)b.patientKey='';assignmentBed.patientKey=patientKey;database.upsertHospitalState({stateKey:'main',state:assignmentMap,userId:session.user_id,savedAt});}
          completePatientMessages(database,patientKey,messagingVisibility(session),{before:savedAt,subjectPattern:/^(New patient transferred from OPD|មានអ្នកជំងឺថ្មីពីតម្រៀប|អ្នកជំងឺឈ្មោះ.*ត្រូវបានបញ្ជូន)/});
          recordBedAssignment(database, {
            patientKey,
            fromWardCode: previousAdmissionStatus === 'waiting-transfer' ? '' : previousWardCode,
            toWardCode: update.roomCode || update.departmentCode,
            fromDepartmentCode: previousDepartmentCode,
            toDepartmentCode: update.departmentCode,
            eventAt: savedAt,
            createdBy: session.user_id,
            details: { roomId: update.roomId, bedId: update.bedId, bedLabel: update.bedLabel, transferAssignment: previousAdmissionStatus === 'waiting-transfer' },
          });
          try {
            const wardCode = admissionWardCode(update);
            automaticWardMessage(
              database,
              { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) },
              patient,
              'មានអ្នកជំងឺចូលសម្រាកថ្មី',
              `អ្នកជំងឺ ${patient.full_name || patient.case_number || patient.patient_key} ត្រូវបានដាក់លើគ្រែ ${update.bedLabel || ''}។ សូមវេជ្ជបណ្ឌិតពិនិត្យ និងបំពេញកំណត់ត្រាវេជ្ជសាស្ត្រ។`,
              { wardCode, destinationRole: 'DOCTOR' },
            );
          } catch {}
        } else if (update.action === 'transfer') {
          recordMovement(database, {
            patientKey, eventType: 'INTERNAL_TRANSFER', fromWardCode: previousWardCode,
            toWardCode: update.departmentCode, fromDepartmentCode: previousDepartmentCode,
            toDepartmentCode: update.departmentCode, eventAt: savedAt, createdBy: session.user_id,
            details: { reason: 'internal-transfer' },
          });
        } else if (update.action === 'discharge') {
          const externalProvincial = update.discharge?.status === 'referred' &&
            update.discharge?.referralDestinationType === 'PROVINCIAL_HOSPITAL';
          const dischargeAtMs = update.discharge?.dischargeAt ? new Date(update.discharge.dischargeAt).getTime() : savedAt;
          recordMovement(database, {
            patientKey, eventType: externalProvincial ? 'EXTERNAL_TRANSFER' : 'DISCHARGE',
            fromWardCode: previousWardCode, toWardCode: '', fromDepartmentCode: previousDepartmentCode,
            toDepartmentCode: '', eventAt: Number.isFinite(dischargeAtMs) ? dischargeAtMs : savedAt,
            createdBy: session.user_id, details: update.discharge || {},
          });
        }
        syncClinicalRequests(database,patient,{userId:session.user_id,role:sessionRole(session),wardCode:sessionWard(session)});
        audit(database, request, `PATIENT_${update.action.toUpperCase()}`, {
          userId: session.user_id,
          subjectUsername: session.username,
          details: { patientKey, departmentCode: patient.department_code, bedId: update.bedId },
        });
        database.sqlite.exec('RELEASE admission_request196');
        return sendJson(response, 200, { patient: patientRecordResponse(patient) }, {
          secure: config.cookieSecure,
        });
        }catch(error){database.sqlite.exec('ROLLBACK TO admission_request196');database.sqlite.exec('RELEASE admission_request196');throw error;}
      }
      if (request.method === 'PATCH' && pathname === '/api/patient-dates') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!clinicalWriteRoles.has(sessionRole(session)) && !['REGISTRATION', 'TRIAGE'].includes(sessionRole(session))) {
          return sendJson(response, 403, { error: 'Your role cannot update patient dates.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) ||
            !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const entryDate = calendarDate(body?.entryDate, 'entryDate');
        const existingPatient = database.findPatient(patientKey);
        if (!existingPatient) {
          return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        }
        if (!canAccessPatient(database, session, existingPatient)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        const existingData = parseStoredJson(existingPatient.record_json);
        const storedDischarge = existingData['system:discharge'];
        const hasFormalDischarge = existingData['system:admissionStatus'] === 'discharged' &&
          storedDischarge && typeof storedDischarge === 'object';
        // Patient List can edit only the entry date. The discharge date stays
        // blank until an IPD discharge or OPD pharmacy receipt is recorded.
        const hasOpdDischarge = existingPatient.service_mode === 'opd' && Boolean(existingData['system:opdDischarge']?.dispensedAt);
        const dischargeDate = hasFormalDischarge || hasOpdDischarge ? existingPatient.discharge_date : '';
        const savedAt = Date.now();
        const patient = database.updatePatientDates({
          patientKey, entryDate, dischargeDate, userId: session.user_id, savedAt,
        });
        audit(database, request, 'PATIENT_DATES_UPDATED', {
          userId: session.user_id,
          subjectUsername: session.username,
          details: { patientKey, entryDate, dischargeDate },
        });
        return sendJson(response, 200, { patient: patientRecordResponse(patient) }, {
          secure: config.cookieSecure,
        });
      }
      if (request.method === 'GET' && pathname === '/api/system-settings/followup') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        return sendJson(response, 200, { allowFutureFollowup: followupDatePolicy(database).allowFuture }, { secure: config.cookieSecure });
      }
      if (request.method === 'PUT' && pathname === '/api/system-settings/followup') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, 20_000);
        const allowFuture = body?.allowFutureFollowup === true;
        const existingRow = database.findHospitalState('settings');
        const existingState = existingRow ? parseStoredJson(existingRow.state_json) : {};
        const state = existingState && typeof existingState === 'object' ? { ...existingState } : {};
        state.followupDatePolicy = { allowFuture };
        const savedAt = Date.now();
        const row = database.upsertHospitalState({ stateKey: 'settings', state, userId: session.user_id, savedAt });
        audit(database, request, 'FOLLOWUP_DATE_POLICY_CHANGED', { userId: session.user_id, subjectUsername: session.username, details: { allowFuture } });
        return sendJson(response, 200, { allowFutureFollowup: allowFuture, version: row.version }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/hospital-state') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const row = database.findHospitalState('main');
        const fullState = row ? parseStoredJson(row.state_json) : null;
        return sendJson(response, 200, {
          state: hospitalStateForSession(fullState, session),
          version: row?.version ?? 0,
        }, { secure: config.cookieSecure });
      }
      if (request.method === 'PUT' && pathname === '/api/hospital-state') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE','WARD_HEAD','CHIEF_WARD'].includes(requireContext(session))) {
          return sendJson(response, 403, { error: 'Your role cannot update the hospital map.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) ||
            !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxHospitalStateBytes);
        const submittedState = sanitizeHospitalState(body?.state);
        const existingRow = database.findHospitalState('main');
        if(body.expectedVersion!==undefined&&body.expectedVersion!==(existingRow?.version||0))return sendJson(response,409,{error:'The bed map changed. Refresh before saving your edits.'},{secure:config.cookieSecure});
        const existingState = existingRow ? parseStoredJson(existingRow.state_json) : null;
        const state = mergeHospitalStateForSession(existingState, submittedState, session, database);
        const savedAt = Date.now();
        const row = database.upsertHospitalState({
          stateKey: 'main', state, userId: session.user_id, savedAt,
        });
        audit(database, request, 'HOSPITAL_MAP_SAVED', {
          userId: session.user_id,
          subjectUsername: session.username,
          details: { version: row.version },
        });
        return sendJson(response, 200, {
          state: hospitalStateForSession(parseStoredJson(row.state_json),session), version: row.version,
        }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/lab-catalog') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        requireContext(session);
        return sendJson(response, 200, { tests: labCatalog(database, ['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(sessionRole(session))) }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/lab-catalog') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxClinicalBodyBytes);
        try {
          const test = createLabTest(database, body || {});
          audit(database, request, 'LAB_CATALOG_CREATED', { userId: session.user_id, subjectUsername: session.username, details: { code: test.code } });
          return sendJson(response, 201, { test }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
      const catalogMatch = /^\/api\/lab-catalog\/([A-Z0-9_]+)$/.exec(pathname);
      if (request.method === 'PATCH' && catalogMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxClinicalBodyBytes);
        if(sessionRole(session)==='LAB'){const allowed=new Set(['baseUnit','units','referenceLow','referenceHigh','criticalLow','criticalHigh','referenceNote','referenceRules','criticalRules','criticalInclusive','referenceHighExclusive','referenceLowExclusive','locallyReviewed','active']);if(Object.keys(body||{}).some(k=>!allowed.has(k)))return sendJson(response,403,{error:'Laboratory staff may edit ranges, units and active status only.'},{secure:config.cookieSecure});}
        try {
          const test = updateLabTest(database, catalogMatch[1], body || {});
          if (!test) return sendJson(response, 404, { error: 'Laboratory test not found.' }, { secure: config.cookieSecure });
          audit(database, request, 'LAB_CATALOG_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { code: test.code, active: test.active } });
          return sendJson(response, 200, { test }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
      if (request.method === 'DELETE' && catalogMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const deleted = deleteLabTest(database, catalogMatch[1]);
        if (!deleted) return sendJson(response, 404, { error: 'Laboratory test not found.' }, { secure: config.cookieSecure });
        audit(database, request, 'LAB_CATALOG_DELETED', { userId: session.user_id, subjectUsername: session.username, details: { code: catalogMatch[1] } });
        return sendJson(response, 200, { ok: true, code: catalogMatch[1] }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/imaging-catalog') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        requireContext(session);
        const includeInactive = ['ADMIN','VICE_DIRECTOR','DIRECTOR','IMAGING'].includes(sessionRole(session));
        return sendJson(response, 200, { modalities: imagingCatalog(database, includeInactive) }, { secure: config.cookieSecure });
      }
      const imagingCatalogMatch = /^\/api\/imaging-catalog\/([A-Z0-9_]+)$/.exec(pathname);
      if (request.method === 'PATCH' && imagingCatalogMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','IMAGING'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Imaging or administrator access is required.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxClinicalBodyBytes);
        try {
          const modality = updateImagingModality(database, imagingCatalogMatch[1], body || {});
          if (!modality) return sendJson(response, 404, { error: 'Imaging modality not found.' }, { secure: config.cookieSecure });
          audit(database, request, 'IMAGING_CATALOG_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { code: modality.code, active: modality.active } });
          return sendJson(response, 200, { modality }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
      if (request.method === 'GET' && pathname === '/api/paraclinic/orders') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        const patientKeyParam = url.searchParams.get('patientKey');
        const modalityParam = String(url.searchParams.get('modality') || '').toUpperCase();
        const statusParam = String(url.searchParams.get('status') || '').toUpperCase();
        let filters = {};
        if (patientKeyParam) filters.patientKey = clinicalPatientKey(patientKeyParam);
        if (modalityParam) filters.modality = modalityParam;
        if (statusParam) filters.status = statusParam;
        if (role === 'LAB') filters.modality = 'LAB';
        if (role === 'IMAGING' && filters.modality === 'LAB') return sendJson(response, 403, { error: 'Imaging users cannot view laboratory worklists.' }, { secure: config.cookieSecure });
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB','IMAGING','DOCTOR','NURSE','MIDWIFE'].includes(role)) {
          return sendJson(response, 403, { error: 'Your role cannot view paraclinic orders.' }, { secure: config.cookieSecure });
        }
        let orders = listOrders(database, filters);
        if (role === 'LAB') {
          // IPD laboratory requests remain in the ward until nursing dispatch. OPD direct orders are released by Cashier; nurse-routed OPD orders stay hidden until the OPD nurse completes collection and handoff.
          orders = orders.filter(item => {
            const row = database.findPatient(item.patientKey);
            if (row?.service_mode === 'opd') {
              const handoff=item.request?.opdHandoff||{};
              if(handoff.method==='NURSE'&&handoff.stage!=='SENT_TO_DEPARTMENT')return false;
              return ['ORDERED','SENT_TO_LAB','RECEIVED','PROCESSING','RESULT_AVAILABLE','WARD_SEEN','REJECTED'].includes(item.status);
            }
            return ['SENT_TO_LAB','RECEIVED','PROCESSING','RESULT_AVAILABLE','WARD_SEEN','REJECTED'].includes(item.status);
          });
        }
        if (role === 'IMAGING') orders = orders.filter(item => {
          if(item.modality==='LAB'||item.status==='PAYMENT_PENDING')return false;
          // Released reports remain available to their department for reprinting after ward review.
          if(['RESULT_AVAILABLE','WARD_SEEN'].includes(item.status))return true;
          const row=database.findPatient(item.patientKey);
          if(String(row?.service_mode||'').toLowerCase()==='ipd')return ['PATIENT_SENT_TO_IMAGING','IMAGING_RECEIVED'].includes(String(item.request?.wardWorkflow?.stage||'').toUpperCase());
          if(String(row?.service_mode||'').toLowerCase()==='opd'){
            const handoff=item.request?.opdHandoff||{};
            if(handoff.method==='NURSE'&&handoff.stage!=='SENT_TO_DEPARTMENT')return false;
            return ['ORDERED','SCHEDULED','PERFORMED','PROCESSING','RESULT_AVAILABLE'].includes(item.status);
          }
          return true;
        });
        if (!['ADMIN','VICE_DIRECTOR','DIRECTOR','LAB','IMAGING'].includes(role)) {
          orders = orders.filter(item => {
            const row = database.findPatient(item.patientKey);
            return row && canAccessPatient(database, session, row);
          });
        }
        return sendJson(response, 200, { orders }, { secure: config.cookieSecure });
      }
      if (request.method === 'GET' && pathname === '/api/opd/nurse-paraclinic-orders') {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if(role!=='NURSE'||sessionWard(session)!=='opd')return sendJson(response,403,{error:'This queue is available to OPD nurses only.'},{secure:config.cookieSecure});
        const orders=listOrders(database).filter(order=>{
          const row=database.findPatient(order.patientKey);
          if(row?.service_mode!=='opd'||order.status!=='ORDERED'||order.request?.opdHandoff?.method!=='NURSE'||!['WAITING_NURSE','NURSE_RECEIVED','SAMPLE_COLLECTED'].includes(order.request?.opdHandoff?.stage))return false;
          const data=parseStoredJson(row.record_json);
          if(!data['system:opdConsultedAt']&&order.request?.opdPreConsult!==true)return false;
          const encounterAt=Number(data['system:opdEncounterAt']||data['system:triageCompletedAt']||order.createdAt||0);
          return !database.sqlite.prepare('SELECT 1 FROM pharmacy_prescriptions WHERE patient_key=? AND submitted_at>=? LIMIT 1').get(order.patientKey,encounterAt);
        }).map(order=>{
          const row=database.findPatient(order.patientKey);
          return {order,patient:{patientKey:row.patient_key,fullName:row.full_name||'',caseNumber:row.case_number||'',healthId:row.health_id||'',sex:row.sex||'',age:row.age||'',entryDate:row.entry_date||''}};
        });
        return sendJson(response,200,{orders},{secure:config.cookieSecure});
      }
      const opdNurseActionMatch=/^\/api\/opd\/nurse-paraclinic-orders\/([0-9a-f-]+)\/action$/.exec(pathname);
      if(request.method==='POST'&&opdNurseActionMatch){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if(role!=='NURSE'||sessionWard(session)!=='opd')return sendJson(response,403,{error:'Only OPD nurses can process these handoffs.'},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);
        const order=getOrder(database,opdNurseActionMatch[1]);
        if(!order)return sendJson(response,404,{error:'Paraclinic request was not found.'},{secure:config.cookieSecure});
        const patient=database.findPatient(order.patientKey);
        const handoff=order.request?.opdHandoff||{};
        if(patient?.service_mode!=='opd'||handoff.method!=='NURSE'||order.status!=='ORDERED')return sendJson(response,409,{error:'This request is not waiting for an OPD nurse handoff.'},{secure:config.cookieSecure});
        const patientData=parseStoredJson(patient.record_json);
        if(!patientData['system:opdConsultedAt']&&order.request?.opdPreConsult!==true)return sendJson(response,409,{error:'This request is no longer available in the OPD nurse queue.'},{secure:config.cookieSecure});
        const encounterAt=Number(patientData['system:opdEncounterAt']||patientData['system:triageCompletedAt']||order.createdAt||0);
        if(database.sqlite.prepare('SELECT 1 FROM pharmacy_prescriptions WHERE patient_key=? AND submitted_at>=? LIMIT 1').get(order.patientKey,encounterAt))return sendJson(response,409,{error:'This patient has a submitted prescription and no longer belongs on the OPD nurse sample queue.'},{secure:config.cookieSecure});
        const action=String(body?.action||'').toUpperCase();
        const stage=String(handoff.stage||'').toUpperCase();
        const chargeMode=String(order.request?.chargeMode||'PAID').toUpperCase();
        const next={...handoff};
        const now=Date.now();
        if(action==='COLLECT'&&order.modality==='LAB'&&stage==='WAITING_NURSE'){
          next.stage='SAMPLE_COLLECTED';next.collectedBy=session.user_id;next.collectedAt=now;
        }else if(action==='SEND'&&((order.modality==='LAB'&&stage==='SAMPLE_COLLECTED')||(order.modality!=='LAB'&&stage==='WAITING_NURSE'))){
          next.stage='SENT_TO_DEPARTMENT';next.sentBy=session.user_id;next.sentAt=now;
        }else{
          return sendJson(response,409,{error:'Complete the displayed nurse steps in order before sending this request.'},{secure:config.cookieSecure});
        }
        const updatedRequest={...order.request,opdHandoff:next};
        const nextStatus=next.stage==='SENT_TO_DEPARTMENT'&&order.modality==='LAB'?'SENT_TO_LAB':'ORDERED';
        try{
          database.sqlite.exec('BEGIN IMMEDIATE');
          try{
            database.sqlite.prepare('UPDATE paraclinic_orders SET status=?,request_json=?,collected_by=CASE WHEN ? THEN ? ELSE collected_by END,collected_at=CASE WHEN ? THEN ? ELSE collected_at END,updated_at=? WHERE id=?')
              .run(nextStatus,JSON.stringify(updatedRequest),action==='COLLECT'?1:0,session.user_id,action==='COLLECT'?1:0,action==='COLLECT'?now:null,now,order.id);
            database.sqlite.exec('COMMIT');
          }catch(error){try{database.sqlite.exec('ROLLBACK');}catch{}throw error;}
        }catch(error){return sendJson(response,409,{error:error.message||'Unable to save the nurse handoff.'},{secure:config.cookieSecure});}
        const updated=getOrder(database,order.id);
        audit(database,request,`OPD_PARACLINIC_NURSE_${action}`,{userId:session.user_id,subjectUsername:session.username,details:{orderId:order.id,patientKey:order.patientKey,stage:next.stage}});
        if(next.stage==='SENT_TO_DEPARTMENT'){
          const destinationType=order.modality==='LAB'?'LAB':'IMAGING';
          const destinationCode=order.modality==='LAB'?'lab':'imaging';
          const modalityName=order.modality==='LAB'?'Laboratory':'Imaging';
          createSystemMessage(database,{senderUserId:session.user_id,senderRole:role,senderWardCode:'opd',destinationType,destinationCode,subject:`New ${modalityName} request • ${order.accessionNumber}`,body:`The OPD nurse completed the handoff for ${patient.full_name||patient.case_number||patient.patient_key}. The ${chargeMode==='FREE'?'free':'paid'} request is ready for the department.`,patientKey:order.patientKey});
        }
        return sendJson(response,200,{order:updated,stage:next.stage,cashierPaymentRequired:false},{secure:config.cookieSecure});
      }
      if(request.method==='GET'&&pathname==='/api/paraclinic/fee-services'){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session),modality=String(url.searchParams.get('modality')||'').toUpperCase();
        if(!['ADMIN','VICE_DIRECTOR','LAB','IMAGING'].includes(role))return sendJson(response,403,{error:'Laboratory or Imaging access is required.'},{secure:config.cookieSecure});
        if(!['LAB','IMAGING'].includes(modality))return sendJson(response,400,{error:'Select Laboratory or Imaging.'},{secure:config.cookieSecure});
        if(role==='LAB'&&modality!=='LAB'||role==='IMAGING'&&modality!=='IMAGING')return sendJson(response,403,{error:'You cannot add fees for this department.'},{secure:config.cookieSecure});
        const category=modality==='LAB'?'LAB':'IMAGING';
        const services=serviceCatalog(database).filter(item=>item.categoryCode===category&&Number(item.defaultAmount)>0);
        return sendJson(response,200,{services},{secure:config.cookieSecure});
      }
      if(request.method==='GET'&&pathname==='/api/paraclinic/fees'){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if(!['ADMIN','VICE_DIRECTOR','NURSE','MIDWIFE'].includes(role))return sendJson(response,403,{error:'Ward staff access is required.'},{secure:config.cookieSecure});
        const patientKey=clinicalPatientKey(url.searchParams.get('patientKey'));
        const patient=database.findPatient(patientKey);if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if(!['ADMIN','VICE_DIRECTOR'].includes(role)&&!canAccessPatient(database,session,patient))return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const fees=listParaclinicExtraFees(database,{patientKey}).map(fee=>{
          const bill=patientBill(database,patientKey,fee.invoiceId);
          const summary=bill?.summary||{};const paid=Number(summary.KHR?.balance||0)+Number(summary.USD?.balance||0)<=0;
          return {...fee,paymentState:fee.chargeVoidedAt||fee.waiverStatus==='APPROVED'?'FREE':paid?'PAID':'NOT_PAID'};
        });
        return sendJson(response,200,{fees},{secure:config.cookieSecure});
      }
      if(request.method==='GET'&&pathname==='/api/paraclinic/fee-waivers'){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))return sendJson(response,403,{error:'Administrator or Director access is required.'},{secure:config.cookieSecure});
        const fees=listParaclinicExtraFees(database,{waiverStatus:'PENDING'}).map(fee=>{const patient=database.findPatient(fee.patientKey);return {...fee,patientName:patient?.full_name||patient?.case_number||fee.patientKey,ward:patient?.department_code||''};});
        return sendJson(response,200,{fees},{secure:config.cookieSecure});
      }
      const extraFeeOrderMatch=/^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/fees$/.exec(pathname);
      if(request.method==='POST'&&extraFeeOrderMatch){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session),order=getOrder(database,extraFeeOrderMatch[1]);
        if(!order)return sendJson(response,404,{error:'Request not found.'},{secure:config.cookieSecure});
        const expectedRole=order.modality==='LAB'?'LAB':'IMAGING';
        if(!['ADMIN',expectedRole].includes(role))return sendJson(response,403,{error:`${expectedRole} access is required to add this fee.`},{secure:config.cookieSecure});
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const patient=database.findPatient(order.patientKey);
        if(!patient||String(patient.service_mode||'').toLowerCase()!=='ipd')return sendJson(response,400,{error:'Extra paraclinic fees are available for IPD orders only.'},{secure:config.cookieSecure});
        const body=await readJson(request,config.maxBodyBytes),category=order.modality==='LAB'?'LAB':'IMAGING';
        const service=serviceCatalog(database).find(item=>item.code===String(body?.serviceCode||'').toUpperCase()&&item.categoryCode===category&&Number(item.defaultAmount)>0);
        if(!service)return sendJson(response,400,{error:`Choose an active ${category} service fee.`},{secure:config.cookieSecure});
        const feeSource=`PARACLINIC_EXTRA:${order.id}:${crypto.randomUUID()}`;
        try{
          database.sqlite.exec('BEGIN IMMEDIATE');
          let charge,fee;
          try{charge=addCatalogCharge(database,patient.patient_key,service.code,session.user_id,feeSource,`Extra ${category} fee for ${order.accessionNumber}`,Number(body?.quantity||1));fee=addParaclinicExtraFee(database,{orderId:order.id,patientKey:patient.patient_key,chargeId:charge.id,invoiceId:charge.invoiceId,serviceCode:service.code,userId:session.user_id});database.sqlite.exec('COMMIT');}
          catch(error){try{database.sqlite.exec('ROLLBACK')}catch{}throw error;}
          automaticWardMessage(database,{userId:session.user_id,role,wardCode:sessionWard(session)},patient,`Extra ${category} fee added • ${order.accessionNumber}`,`${service.nameKh||service.nameEn}: ${charge.amount} ${charge.currency}. Please discuss the optional charge with the patient.`,{});
          audit(database,request,'PARACLINIC_EXTRA_FEE_ADDED',{userId:session.user_id,subjectUsername:session.username,details:{patientKey:patient.patient_key,orderId:order.id,feeId:fee.id,serviceCode:service.code,chargeId:charge.id}});
          return sendJson(response,201,{fee:{...fee,amount:charge.amount,currency:charge.currency},charge},{secure:config.cookieSecure});
        }catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      const extraFeeActionMatch=/^\/api\/paraclinic\/fees\/([0-9a-f-]+)\/(patient-informed|waiver-request|waiver-review)$/.exec(pathname);
      if(request.method==='POST'&&extraFeeActionMatch){
        if(!session)return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session),body=await readJson(request,10_000);
        if(!sameOrigin(request,config)||!safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token))return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const fee=listParaclinicExtraFees(database).find(item=>item.id===extraFeeActionMatch[1]);if(!fee)return sendJson(response,404,{error:'Paraclinic fee request was not found.'},{secure:config.cookieSecure});
        const patient=database.findPatient(fee.patientKey);if(!patient)return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if(['NURSE','MIDWIFE'].includes(role)&&!canAccessPatient(database,session,patient))return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const action=extraFeeActionMatch[2],actionName=action==='patient-informed'?'PATIENT_INFORMED':action==='waiver-request'?'REQUEST_WAIVER':'REVIEW_WAIVER';
        try{
          if(actionName==='PATIENT_INFORMED'||actionName==='REQUEST_WAIVER'){
            const feeBill=patientBill(database,fee.patientKey,fee.invoiceId),summary=feeBill?.summary||{};
            if(Number(summary.KHR?.balance||0)+Number(summary.USD?.balance||0)<=0&&!fee.chargeVoidedAt)return sendJson(response,409,{error:'This invoice is already paid.'},{secure:config.cookieSecure});
          }
          if(actionName==='REVIEW_WAIVER'&&body?.approved===true){
            const bill=patientBill(database,fee.patientKey,fee.invoiceId);
            const summary=bill?.summary||{};
            if(Number(summary.KHR?.balance||0)+Number(summary.USD?.balance||0)<=0)return sendJson(response,409,{error:'This invoice is already settled. Keep the payment record and ask Cashier to handle any correction.'},{secure:config.cookieSecure});
            database.sqlite.exec('BEGIN IMMEDIATE');
            try{voidFinanceItem(database,'charge',fee.chargeId,`Free-charge request approved by ${role}${body?.note?`: ${String(body.note).slice(0,250)}`:''}`,session.user_id);updateParaclinicExtraFee(database,fee.id,{action:actionName,approved:true,note:body?.note},{role,userId:session.user_id});database.sqlite.exec('COMMIT');}
            catch(error){try{database.sqlite.exec('ROLLBACK')}catch{}throw error;}
          }else updateParaclinicExtraFee(database,fee.id,{action:actionName,approved:body?.approved===true,reason:body?.reason,note:body?.note},{role,userId:session.user_id});
          const updated=listParaclinicExtraFees(database,{patientKey:fee.patientKey}).find(item=>item.id===fee.id);
          if(actionName==='REQUEST_WAIVER'){
            const message={senderUserId:session.user_id,senderRole:role,senderWardCode:sessionWard(session),subject:`Free paraclinic fee approval requested • ${fee.accessionNumber}`,body:`${patient.full_name||patient.case_number}: ${fee.description} (${fee.serviceCode}). Amount: ${fee.amountMinor/100} ${fee.currency}. Reason: ${updated.waiverReason}`,patientKey:fee.patientKey};
            createSystemMessage(database,{...message,destinationType:'ADMIN',destinationCode:'admin'});
          }
          if(actionName==='REVIEW_WAIVER'){recordLegacyReview(database,'legacy-fee:'+fee.id,updated,{userId:session.user_id,role,wardCode:sessionWard(session)});if(updated.waiverStatus==='REJECTED'){const ward=patientWorkWard(patient);if(WARDS.some(w=>w.code===ward))createStaffMessage(database,{senderUserId:session.user_id,senderRole:role,destinationType:'WARD',destinationCode:ward,subject:'មតិកែតម្រូវសំណើលើកលែងសេវា',body:updated.reviewNote,patientKey:fee.patientKey});}}
          if(actionName==='REVIEW_WAIVER')completePatientMessages(database,fee.patientKey,messagingVisibility(session),{subjectIncludes:`Free paraclinic fee approval requested • ${fee.accessionNumber}`});
          if(actionName==='REVIEW_WAIVER')automaticWardMessage(database,{userId:session.user_id,role,wardCode:sessionWard(session)},patient,`Free paraclinic fee ${body?.approved===true?'approved':'declined'} • ${fee.accessionNumber}`,`${fee.description}: ${body?.approved===true?'Fee waived by Admin/Director.':`Payment is still required.${body?.note?` Note: ${String(body.note).slice(0,250)}`:''}`}`);
          audit(database,request,`PARACLINIC_EXTRA_FEE_${actionName}`,{userId:session.user_id,subjectUsername:session.username,details:{feeId:fee.id,patientKey:fee.patientKey,approved:body?.approved===true}});
          return sendJson(response,200,{fee:updated},{secure:config.cookieSecure});
        }catch(error){return sendJson(response,400,{error:error.message},{secure:config.cookieSecure});}
      }
      if (request.method === 'POST' && pathname === '/api/paraclinic/orders') {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only a doctor or administrator can create paraclinic requests.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxClinicalBodyBytes);
        const patientKey = clinicalPatientKey(body?.patientKey);
        const patient = database.findPatient(patientKey);
        if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
        if (!canAccessPatient(database, session, patient) && !['ADMIN','VICE_DIRECTOR','DOCTOR'].includes(role)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        if(['DOCTOR','CHIEF_WARD',...RECORD_MANAGEMENT].includes(role)){
          const access=encounterAccess(database,session,patient,'medical');
          if(access.received&&patient.service_mode==='opd'||access.discharged)return sendJson(response,403,{error:'កំណត់ត្រាត្រូវបានបិទ។ មិនអាចបង្កើតសំណើពិនិត្យថ្មីបានទេ។'},{secure:config.cookieSecure});
        }
        const patientData = parseStoredJson(patient.record_json);
        const workflowStage = String(patientData['system:workflowStage'] || '');
        const triageParaclinic = patientData['system:triageParaclinic'] === true || patientData['system:triageParaclinic'] === 'true';
        const payment = paymentStatusForPatient(database, patientKey);
        const paidEnough = ['PAID','INSURANCE','NGO','NSSF','HEF_EQUITY','HEF_VULNERABLE','EXEMPT','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE_FAMILY','FULL_WAIVER'].includes(payment?.code);
        const consultationPaymentRecorded=opdConsultationPaymentRecorded(database,patient);
        const prePaymentReview = role === 'DOCTOR' && patient.service_mode === 'opd' && triageParaclinic && workflowStage === 'PARACLINIC_REVIEW_PENDING' && consultationPaymentRecorded;
        const preConsultOpd = role === 'DOCTOR' && patient.service_mode === 'opd' && triageParaclinic &&
          Boolean(patientData['system:opdPreConsultParaclinicAt']) && !patientData['system:opdConsultedAt'] && ['OPD_PARACLINIC_ORDERING','CASHIER_PENDING_PARACLINIC','PARACLINIC_RESULTS_PENDING','DOCTOR_READY'].includes(workflowStage);
        const postConsultOpd = ['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(role) && patient.service_mode === 'opd' && consultationPaymentRecorded && !preConsultOpd && !prePaymentReview;
        const opdParaclinicFlow = preConsultOpd || prePaymentReview || postConsultOpd;
        if(patient.service_mode==='opd'&&!opdParaclinicFlow&&!consultationPaymentRecorded)return sendJson(response,409,{error:'Cashier confirmation of the OPD consultation fee is required before ordering paraclinic services.'},{secure:config.cookieSecure});
        if (patient.service_mode === 'opd' && !paidEnough && !opdParaclinicFlow) return sendJson(response, 409, { error:'The OPD consultation must be paid and saved before requesting additional paraclinic tests.' }, { secure: config.cookieSecure });
        const modality = String(body?.modality || '').toUpperCase();
        if (!['LAB', ...IMAGING_SUBTYPES].includes(modality)) return sendJson(response, 400, { error: 'Paraclinic modality is invalid.' }, { secure: config.cookieSecure });
        if (modality !== 'LAB' && !imagingCatalog(database).some(item => item.code === modality)) return sendJson(response,400,{error:'This Imaging service is inactive. Reload the catalog before sending.'},{secure:config.cookieSecure});
        let priority = String(body?.priority || 'ROUTINE').toUpperCase() === 'URGENT' ? 'URGENT' : 'ROUTINE';
        const requestData = body?.request && typeof body.request === 'object' && !Array.isArray(body.request) ? body.request : {};
        const ipdOrder = String(patient.service_mode || '').toLowerCase() === 'ipd';
        const chargeMode = ipdOrder ? 'FREE' : opdParaclinicFlow ? String(body?.chargeMode || 'PAID').toUpperCase() : 'PAID';
        if (opdParaclinicFlow && !['PAID','FREE'].includes(chargeMode)) return sendJson(response, 400, { error:'Select whether this OPD paraclinic request requires payment or is free of charge.' }, { secure: config.cookieSecure });
        const handoffMode=opdParaclinicFlow?String(body?.handoffMode||'DIRECT').toUpperCase():'DIRECT';
        if(opdParaclinicFlow&&!['DIRECT','NURSE'].includes(handoffMode))return sendJson(response,400,{error:'Select direct Cashier-to-department or OPD nurse handoff.'},{secure:config.cookieSecure});
        if (modality === 'LAB') {
          const items = Array.isArray(requestData.items) ? requestData.items : [];
          if (!items.length) return sendJson(response, 400, { error: 'Select at least one laboratory test.' }, { secure: config.cookieSecure });
          const catalogCodes = new Set(labCatalog(database).map(item => item.code));
          requestData.items = items.slice(0,150).map(item => ({ code: String(item.code || '').toUpperCase(), urgent: item.urgent === true })).filter(item => catalogCodes.has(item.code));
          if (!requestData.items.length) return sendJson(response, 400, { error: 'No valid laboratory tests were selected.' }, { secure: config.cookieSecure });
          if (requestData.items.length !== items.length) return sendJson(response, 400, {error:'A selected laboratory test is inactive, unavailable or exceeds the order limit. Reload the catalog before sending.'},{secure:config.cookieSecure});
          // An individually marked STAT test promotes the whole laboratory request on the worklist,
          // while the request JSON preserves exactly which tests were marked urgent.
          if (requestData.items.some(item => item.urgent)) priority = 'URGENT';
        }
        const requestedPatient = patientRecordResponse(patient, false);
        requestData.patientSnapshot = Object.fromEntries(['patientKey','fullName','sex','age','dateOfBirth','healthId','caseNumber','phone','village','commune','district','province','departmentNameKh','departmentNameEn','currentWardCode','departmentCode'].map(key => [key, requestedPatient[key] || '']));
        requestData.patientSnapshot.diagnosis = String(requestData.clinicalInfo || requestData.diagnosis || requestedPatient.diagnosis || '');
        requestData.requesterSignature = signatureSnapshot(database, session, Date.now());
        if (opdParaclinicFlow || ipdOrder) requestData.chargeMode = chargeMode;
        if(opdParaclinicFlow){
          requestData.opdHandoff={method:handoffMode,stage:handoffMode==='NURSE'?'WAITING_NURSE':chargeMode==='PAID'?'DIRECT_TO_CASHIER':'SENT_TO_DEPARTMENT'};
          if(preConsultOpd){
            requestData.opdPreConsult=true;
            requestData.opdPreConsultInvoiceId=String(patientData['system:opdConsultationInvoiceId']||'');
          }
        }
        const consultationSettled=patient.service_mode==='opd'&&opdConsultationPaymentConfirmed(database,patient);
        const paymentPending = prePaymentReview ||
          (preConsultOpd && (chargeMode==='PAID' || !consultationSettled)) ||
          (postConsultOpd && chargeMode === 'PAID');
        let order;
        let investigationText = '';
        try {
          database.sqlite.exec('BEGIN IMMEDIATE');
          try {
            order = createOrder(database, {
              patientKey, modality, priority, request: requestData,
              userId: session.user_id, role, ward: sessionWard(session), paymentPending,
            });
            if (ipdOrder || (opdParaclinicFlow && chargeMode === 'FREE')) {
              // No invoice charge is created; the signed request itself records the doctor's free-of-charge decision.
            } else {
              // A paid OPD laboratory order must create one real cashier charge
              // for every test the doctor selected. Never silently drop an
              // unpriced test from the invoice.
              addParaclinicCharges(database,patientKey,order,session.user_id,{strict:!ipdOrder});
            }
            if (paymentPending && opdParaclinicFlow) {
              const currentData=parseStoredJson(database.findPatient(patientKey)?.record_json);
              currentData['system:workflowStage']='CASHIER_PENDING_PARACLINIC';
              const currentBill=patientBill(database,patientKey);
              if(Number(currentBill?.summary?.KHR?.balance||0)+Number(currentBill?.summary?.USD?.balance||0)>0&&currentBill?.invoice?.id){
                currentData['system:cashierQueueRequest']={invoiceId:currentBill.invoice.id,sentAt:Date.now(),sentBy:session.user_id,wardCode:'opd',source:'PARACLINIC'};
                queueCashierPayment(database,patientKey,currentData['system:cashierQueueRequest']);
              }
              database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(currentData),Date.now(),patientKey);
            } else if(preConsultOpd) {
              const currentData=parseStoredJson(database.findPatient(patientKey)?.record_json);
              currentData['system:workflowStage']='PARACLINIC_RESULTS_PENDING';
              database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(currentData),Date.now(),patientKey);
            }
            if (patient.service_mode === 'opd') investigationText = syncOpdParaclinicToRecord(database, patientKey, body?.opdInvestigationText);
            database.sqlite.exec('COMMIT');
          } catch (error) { try { database.sqlite.exec('ROLLBACK'); } catch {} throw error; }
        } catch (error) { return sendJson(response, 400, { error:error.message }, { secure:config.cookieSecure }); }
        audit(database, request, 'PARACLINIC_ORDER_CREATED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, patientKey, modality, priority, paymentPending, chargeMode:opdParaclinicFlow?chargeMode:'', handoffMode:opdParaclinicFlow?handoffMode:'', cashierInvoiceRequired:paymentPending } });
        try {
          const pName = patient.full_name || patient.case_number || patient.patient_key;
          const fromWardCode = opdParaclinicFlow ? 'opd' : (sessionWard(session) || 'ipd');
          const fromDeptKh = fromWardCode === 'opd' ? 'ផ្នែកពិគ្រោះក្រៅ' : (database.findWard?.(fromWardCode)?.nameKh || `ផ្នែក ${fromWardCode}`);
          const labMsg = `អ្នកជំងឺឈ្មោះ ${pName} ត្រូវបានបញ្ជូនពីផ្នែក ${fromDeptKh.replace(/^ផ្នែក\s*/, '')} មកមន្ទីរពិសោធន៍ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
          const imagingMsg = `អ្នកជំងឺឈ្មោះ ${pName} ត្រូវបានបញ្ជូនពីផ្នែក ${fromDeptKh.replace(/^ផ្នែក\s*/, '')} មកផ្នែករូបភាពវេជ្ជសាស្ត្រ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
          if(opdParaclinicFlow&&handoffMode==='NURSE'&&!paymentPending){
            automaticWardMessage(database,{userId:session.user_id,role,wardCode:'opd'},patient,
              modality==='LAB'?labMsg:imagingMsg, modality==='LAB'?labMsg:imagingMsg,
              {wardCode:'opd',destinationRole:'NURSE'});
          } else if (!paymentPending && ipdOrder) {
            automaticWardMessage(database, { userId:session.user_id, role, wardCode:sessionWard(session) }, patient,
              modality==='LAB'?labMsg:imagingMsg, modality==='LAB'?labMsg:imagingMsg);
          } else if (!paymentPending && modality !== 'LAB') {
            createSystemMessage(database, { senderUserId:session.user_id, senderRole:role, senderWardCode:sessionWard(session), destinationType:'IMAGING', destinationCode:'imaging', subject:imagingMsg, body:imagingMsg, patientKey });
          } else if (!paymentPending && opdParaclinicFlow && handoffMode==='DIRECT' && modality==='LAB') {
            createSystemMessage(database,{senderUserId:session.user_id,senderRole:role,senderWardCode:'opd',destinationType:'LAB',destinationCode:'lab',subject:labMsg,body:labMsg,patientKey});
          }
        } catch {}
        return sendJson(response, 201, { order, investigationText, cashierPaymentRequired:paymentPending, nurseHandoffRequired:opdParaclinicFlow&&handoffMode==='NURSE', handoffMode:opdParaclinicFlow?handoffMode:'', chargeMode:opdParaclinicFlow?chargeMode:'' }, { secure: config.cookieSecure });
      }
      if (request.method === 'POST' && pathname === '/api/paraclinic/send-to-cashier') {
        if (!session) return sendJson(response, 401, { error:'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (role !== 'DOCTOR') return sendJson(response,403,{error:'Only the OPD doctor can send paraclinic requests to Cashier.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const body=await readJson(request,10_000);
        const patientKey=clinicalPatientKey(body?.patientKey);
        const patient=database.findPatient(patientKey);
        if (!patient) return sendJson(response,404,{error:'Patient was not found.'},{secure:config.cookieSecure});
        if (!canAccessPatient(database,session,patient)) return sendJson(response,403,{error:'This patient is outside your active ward.'},{secure:config.cookieSecure});
        const data=parseStoredJson(patient.record_json);
        if (patient.service_mode !== 'opd' || data['system:workflowStage'] !== 'PARACLINIC_REVIEW_PENDING') return sendJson(response,409,{error:'This patient is not waiting for pre-payment paraclinic review.'},{secure:config.cookieSecure});
        const orders=listOrders(database,{patientKey}).filter(order=>order.status==='PAYMENT_PENDING');
        if (!orders.length) return sendJson(response,400,{error:'Select at least one paraclinic test before sending to Cashier.'},{secure:config.cookieSecure});
        data['system:workflowStage']='CASHIER_PENDING_PARACLINIC';
        const bill=patientBill(database,patientKey);
        if(Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0)>0&&bill?.invoice?.id){
          data['system:cashierQueueRequest']={invoiceId:bill.invoice.id,sentAt:Date.now(),sentBy:session.user_id,wardCode:'opd',source:'PARACLINIC'};
          queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
        }
        database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),Date.now(),patientKey);
        audit(database,request,'PARACLINIC_SENT_TO_CASHIER',{userId:session.user_id,subjectUsername:session.username,details:{patientKey,orderIds:orders.map(order=>order.id)}});
        return sendJson(response,200,{orders,workflowStage:'CASHIER_PENDING_PARACLINIC'},{secure:config.cookieSecure});
      }
      const orderMatch = /^\/api\/paraclinic\/orders\/([0-9a-f-]+)$/.exec(pathname);
      const orderResultMatch = /^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/result$/.exec(pathname);
      if (request.method === 'GET' && orderMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        const order = getOrder(database, orderMatch[1]);
        if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
        const patient = database.findPatient(order.patientKey);
        const allowed = orderActorAllowed(role, order.modality) || role === 'DOCTOR' || (patient && canAccessPatient(database, session, patient));
        if (!allowed) return sendJson(response, 403, { error: 'You cannot view this request.' }, { secure: config.cookieSecure });
        return sendJson(response, 200, { order }, { secure: config.cookieSecure });
      }
      if (request.method === 'DELETE' && orderMatch) {
        if (!session) return sendJson(response,401,{error:'Authentication required.'},{secure:config.cookieSecure});
        const role=requireContext(session);
        if (!['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(role)) return sendJson(response,403,{error:'Only the ordering doctor or administrator can delete this request.'},{secure:config.cookieSecure});
        if (!sameOrigin(request,config) || !safeTokenEqual(request.headers['x-csrf-token'],session.csrf_token)) return sendJson(response,403,{error:'Security token is invalid.'},{secure:config.cookieSecure});
        const hasDeleteBody=Number(request.headers['content-length']||0)>0||Boolean(request.headers['transfer-encoding']);
        const deleteBody=hasDeleteBody?await readJson(request,10_000):{};
        const order=getOrder(database,orderMatch[1]);
        if (!order) return sendJson(response,404,{error:'Request not found.'},{secure:config.cookieSecure});
        const patient=database.findPatient(order.patientKey);
        if (!patient || (!canAccessPatient(database,session,patient) && !['ADMIN','VICE_DIRECTOR'].includes(role))) return sendJson(response,403,{error:'You cannot modify this request.'},{secure:config.cookieSecure});
        try {
          const wasPendingPayment=order.status==='PAYMENT_PENDING';
          const cancelled=cancelOrder(database,order.id,{role,userId:session.user_id});
          voidChargeBySource(database,`PARACLINIC:${order.id}:`,session.user_id,'Paraclinic request cancelled');
          const investigationText=patient.service_mode==='opd' ? syncOpdParaclinicToRecord(database,order.patientKey,deleteBody?.opdInvestigationText) : '';
          if(wasPendingPayment&&patient.service_mode==='opd'&&!database.sqlite.prepare("SELECT 1 FROM paraclinic_orders WHERE patient_key=? AND status='PAYMENT_PENDING' LIMIT 1").get(order.patientKey)){
            const record=parseStoredJson(database.findPatient(order.patientKey)?.record_json);
            if(record['system:workflowStage']==='CASHIER_PENDING_PARACLINIC'){
              record['system:workflowStage']='DOCTOR_READY';
              database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(record),Date.now(),order.patientKey);
            }
          }
          audit(database,request,'PARACLINIC_ORDER_CANCELLED',{userId:session.user_id,subjectUsername:session.username,details:{orderId:order.id,patientKey:order.patientKey,modality:order.modality}});
          return sendJson(response,200,{order:cancelled,investigationText},{secure:config.cookieSecure});
        } catch(error) { return sendJson(response,409,{error:error.message},{secure:config.cookieSecure}); }
      }
      if ((request.method === 'PATCH' && orderMatch) || (request.method === 'POST' && orderResultMatch)) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        const targetOrderId = (orderMatch || orderResultMatch)[1];
        const order = getOrder(database, targetOrderId);
        if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
        const patient = database.findPatient(order.patientKey);
        const labWardAllowed = order.modality === 'LAB' && labWardWorkflowRole(role) && patient && canAccessPatient(database, session, patient);
        const imagingWardAllowed = order.modality !== 'LAB' && ['NURSE','MIDWIFE'].includes(role) && String(patient?.service_mode||'').toLowerCase()==='ipd' && patient && canAccessPatient(database,session,patient);
        if (!orderActorAllowed(role, order.modality) && !labWardAllowed && !imagingWardAllowed) {
          return sendJson(response, 403, { error: 'Your role cannot update this paraclinic workflow.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const rawBody = await readJson(request, config.maxPatientBodyBytes);
        const body = orderResultMatch ? { result: rawBody?.result || rawBody, release: true } : (rawBody || {});
        let updated, investigationText = '';
        try {
          database.sqlite.exec('BEGIN IMMEDIATE');
          try {
            updated = updateOrder(database, order.id, body || {}, { userId: session.user_id, role });
            completePatientMessages(database,order.patientKey,messagingVisibility(session),{subjectIncludes:order.accessionNumber});
            if (body?.release === true) {
              if (order.modality === 'LAB' && !order.releasedAt) {
                useLabMaterials(database, updated, session.user_id);
              }
              // Released findings stay in the report; the request field remains order-only.
              if(patient?.service_mode==='opd'){
                const current=database.findPatient(patient.patient_key);
                const record=parseStoredJson(current?.record_json);
                const preConsultAt=Number(record['system:opdPreConsultParaclinicAt']||0);
                if(preConsultAt&&!record['system:opdConsultedAt']){
                  const required=listOrders(database,{patientKey:patient.patient_key}).filter(item=>item.request?.opdPreConsult===true&&Number(item.createdAt||0)>=preConsultAt&&item.status!=='CANCELLED');
                  if(required.length&&required.every(item=>Boolean(item.releasedAt))) {
                    record['system:workflowStage']='DOCTOR_READY';
                    record['system:opdPreConsultResultsAt']=Date.now();
                    database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(record),Date.now(),patient.patient_key);
                  }
                }
              }
            }
            database.sqlite.exec('COMMIT');
          } catch (error) {
            try { database.sqlite.exec('ROLLBACK'); } catch {}
            throw error;
          }
        } catch (error) {
          return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
        }
        let auditAction = body?.release ? 'PARACLINIC_RESULT_RELEASED' : 'PARACLINIC_RESULT_SAVED';
        const requestedStatus = String(body?.status || '').toUpperCase();
        if (!body?.release && requestedStatus) auditAction = `PARACLINIC_${requestedStatus}`;
        audit(database, request, auditAction, { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, modality: order.modality, accessionNumber: updated.accessionNumber } });
        try {
          if (order.modality === 'LAB' && requestedStatus === 'SENT_TO_LAB') {
            createSystemMessage(database, { senderUserId:session.user_id, senderRole:role, senderWardCode:sessionWard(session), destinationType:'LAB', destinationCode:'lab', subject:`Sample sent • ${updated.accessionNumber}`, body:`Ward sent a laboratory specimen for ${patient?.full_name || patient?.case_number || updated.patientKey}.`, patientKey:updated.patientKey });
          }
          const workflowStage=String(updated.request?.wardWorkflow?.stage||'').toUpperCase();
          if(imagingWardAllowed&&workflowStage==='PATIENT_SENT_TO_IMAGING'){
            const modalityName=({ULTRASOUND:'Ultrasound',XRAY:'X-ray',CT:'CT',MRI:'MRI'})[order.modality]||order.modality;
            createSystemMessage(database,{senderUserId:session.user_id,senderRole:role,senderWardCode:sessionWard(session),destinationType:'IMAGING',destinationCode:'imaging',subject:`Patient sent for ${modalityName} • ${updated.accessionNumber}`,body:`Ward nurse sent ${patient?.full_name||patient?.case_number||updated.patientKey} for ${modalityName}. Please receive the patient.`,patientKey:updated.patientKey});
          }
          if (order.modality === 'LAB' && requestedStatus === 'REJECTED') {
            automaticWardMessage(database, { userId:session.user_id, role, wardCode:sessionWard(session) }, patient,
              `⚠ Laboratory sample rejected • ${updated.accessionNumber}`, `Reason: ${updated.rejectionReason || 'Specimen rejected by laboratory.'} Please collect a replacement sample.`);
          }
          if (order.modality === 'LAB' && body?.release === true) {
            const isOpdPatient = String(patient?.service_mode || '').toLowerCase() === 'opd';
            automaticWardMessage(database, { userId:session.user_id, role, wardCode:sessionWard(session) }, patient,
              isOpdPatient ? `Laboratory result ready for OPD doctor • ${updated.accessionNumber}` : `Laboratory result returned • ${updated.accessionNumber}`,
              isOpdPatient
                ? `Laboratory completed the OPD test. The result for ${patient?.full_name || patient?.case_number || updated.patientKey} is ready for the OPD doctor.`
                : `Laboratory result is available for ${patient?.full_name || patient?.case_number || updated.patientKey}. Please review and mark seen.`,
              isOpdPatient ? { wardCode:'opd', destinationRole:'DOCTOR' } : {});
          }
          if (order.modality !== 'LAB' && body?.release === true) {
            automaticWardMessage(database, { userId:session.user_id, role, wardCode:sessionWard(session) }, patient,
              `${order.modality} report returned • ${updated.accessionNumber}`, `Imaging report is available for ${patient?.full_name || patient?.case_number || updated.patientKey}.`);
          }
        } catch {}
        return sendJson(response, 200, { order: updated, investigationText }, { secure: config.cookieSecure });
      }
      const criticalAckMatch = /^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/critical-ack$/.exec(pathname);
      if (request.method === 'POST' && criticalAckMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only a doctor can acknowledge a critical result.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const order = getOrder(database, criticalAckMatch[1]);
        if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
        const patient = database.findPatient(order.patientKey);
        if (!['ADMIN','VICE_DIRECTOR'].includes(role) && (!patient || !canAccessPatient(database, session, patient))) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        const body = await readJson(request, config.maxClinicalBodyBytes);
        try {
          const updated = acknowledgeCritical(database, order.id, session.user_id, body?.note);
          audit(database, request, 'PARACLINIC_CRITICAL_ACKNOWLEDGED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, accessionNumber: updated.accessionNumber } });
          return sendJson(response, 200, { order: updated }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
      const reviewMatch = /^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/(review|view)$/.exec(pathname);
      if (request.method === 'POST' && reviewMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        if (!['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only a doctor can acknowledge a result.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const order = getOrder(database, reviewMatch[1]);
        if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
        const patient = database.findPatient(order.patientKey);
        const orderWard = order.ward || patientWorkWard(patient);
        const userWard = sessionWard(session);
        if (!['ADMIN','VICE_DIRECTOR'].includes(role) && (!patient || !canAccessPatient(database, session, patient) || (userWard && orderWard && userWard !== orderWard))) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        let updated;
        try {
          updated = reviewMatch[2] === 'view' ? markResultViewed(database, order.id, session.user_id)
            : markReviewed(database, order.id, session.user_id);
        } catch(error) { return sendJson(response,409,{error:error.message},{secure:config.cookieSecure}); }
        completePatientMessages(database,order.patientKey,messagingVisibility(session),{subjectIncludes:order.accessionNumber});
        audit(database, request, reviewMatch[2] === 'view' ? 'PARACLINIC_RESULT_VIEWED' : 'PARACLINIC_RESULT_REVIEWED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id } });
        return sendJson(response, 200, { order: updated }, { secure: config.cookieSecure });
      }
      const attachmentUploadMatch = /^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/attachments$/.exec(pathname);
      if (request.method === 'POST' && attachmentUploadMatch) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const role = requireContext(session);
        const order = getOrder(database, attachmentUploadMatch[1]);
        if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
        if (!orderActorAllowed(role, order.modality)) return sendJson(response, 403, { error: 'Your role cannot attach files to this request.' }, { secure: config.cookieSecure });
        if (!sameOrigin(request, config) || !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const extensionByType = { 'application/pdf':'.pdf', 'image/jpeg':'.jpg', 'image/png':'.png' };
        const extension = extensionByType[contentType];
        if (!extension) return sendJson(response, 415, { error: 'Only PDF, JPEG and PNG attachments are allowed.' }, { secure: config.cookieSecure });
        const bytes = await readBinary(request, 12 * 1024 * 1024);
        if (!bytes.length) return sendJson(response, 400, { error: 'Attachment is empty.' }, { secure: config.cookieSecure });
        const uploadRoot = path.join(path.dirname(config.databasePath), 'uploads', order.id);
        fs.mkdirSync(uploadRoot, { recursive: true });
        const storedName = `${crypto.randomUUID()}${extension}`;
        const storagePath = path.join(uploadRoot, storedName);
        fs.writeFileSync(storagePath, bytes, { flag: 'wx' });
        const attachment = addAttachment(database, order.id, {
          filename: safeAttachmentName(request.headers['x-file-name']), contentType, storagePath, userId: session.user_id,
        });
        audit(database, request, 'PARACLINIC_ATTACHMENT_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, attachmentId: attachment.id } });
        return sendJson(response, 201, { attachment }, { secure: config.cookieSecure });
      }
      const attachmentGetMatch = /^\/api\/paraclinic\/attachments\/([0-9a-f-]+)$/.exec(pathname);
      if (request.method === 'GET' && attachmentGetMatch) {
        if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
        const role = requireContext(session);
        const attachment = getAttachment(database, attachmentGetMatch[1]);
        if (!attachment) return sendJson(response, 404, { error: 'Attachment not found.' }, { secure: config.cookieSecure });
        const patient = database.findPatient(attachment.patient_key);
        const allowed = orderActorAllowed(role, attachment.modality) || (patient && canAccessPatient(database, session, patient));
        if (!allowed) return sendJson(response, 403, { error: 'You cannot view this attachment.' }, { secure: config.cookieSecure });
        return sendFile(response, attachment.storage_path, attachment.content_type, { secure: config.cookieSecure }, false);
      }
      const formType = clinicalFormType(pathname);
      if (request.method === 'GET' && formType) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!clinicalFormReadRoles.has(sessionRole(session))) return sendJson(response, 403, { error: 'Your role cannot view clinical forms.' }, { secure: config.cookieSecure });
        const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
        const patientRow = database.findPatient(patientKey);
        if (patientRow && !canAccessPatient(database, session, patientRow)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        const record = database.findClinicalForm(patientKey, formType);
        return sendJson(response, 200, {
          record: record ? clinicalRecordResponse(record) : null,
        }, { secure: config.cookieSecure });
      }
      if (request.method === 'PUT' && formType) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        if (!clinicalFormWriteRoles.has(sessionRole(session))) {
          return sendJson(response, 403, { error: 'Your role cannot update clinical forms.' }, { secure: config.cookieSecure });
        }
        if (!sameOrigin(request, config) ||
            !safeTokenEqual(request.headers['x-csrf-token'], session.csrf_token)) {
          return sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
        }
        const body = await readJson(request, config.maxClinicalBodyBytes);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return sendJson(response, 400, { error: 'Clinical form information is invalid.' }, { secure: config.cookieSecure });
        }
        const patientKey = clinicalPatientKey(body.patientKey);
        const patientRow = database.findPatient(patientKey);
        if (patientRow && !canAccessPatient(database, session, patientRow)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
        try{assertEncounterWrite(database,session,patientRow,'medical');}catch(error){return sendJson(response,error.status||403,{error:error.message},{secure:config.cookieSecure});}
        const patient = sanitizePatientSnapshot(body.patient);
        const data = sanitizeClinicalFormData(body.data);
        const savedAt = Date.now();
        const record = database.upsertClinicalForm({
          id: crypto.randomUUID(), patientKey, formType, patient, data,
          userId: session.user_id, savedAt,
        });
        audit(database, request, 'CLINICAL_FORM_SAVED', {
          userId: session.user_id,
          subjectUsername: session.username,
          details: { recordId: record.id, formType, version: record.version },
        });
        return sendJson(response, 200, { record: clinicalRecordResponse(record) }, {
          secure: config.cookieSecure,
        });
      }
      if (request.method === 'GET' && protectedPages.has(pathname)) {
        if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
        const identity = buildIdentity(database, session);
        if (identity.needsContext && pathname !== '/context') {
          return redirect(response, '/context', { secure: config.cookieSecure });
        }
        if (pathname === '/home' && ['LAB','IMAGING','TRIAGE','REGISTRATION','NURSE','MIDWIFE','CLERK','ACCOUNTANT'].includes(String(identity.activeRole || '').toUpperCase())) {
          return redirect(response, landingPathForRole(identity.activeRole, identity.activeWard?.code), { secure: config.cookieSecure });
        }
        if (pathname === '/emr' && ['CLERK', 'ACCOUNTANT'].includes(String(identity.activeRole || '').toUpperCase())) {
          const patientKey = url.searchParams.get('patient') || url.searchParams.get('patientKey') || '';
          const target = patientKey ? `/billing?patientKey=${encodeURIComponent(patientKey)}&history=1` : '/billing';
          return redirect(response, target, { secure: config.cookieSecure });
        }
        if (pathname === '/emr' && String(identity.activeRole || '').toUpperCase() === 'TRIAGE') {
          const requestedView = url.searchParams.get('view');
          if (requestedView !== 'triage') {
            url.searchParams.set('view', 'triage');
            return redirect(response, `${url.pathname}?${url.searchParams.toString()}`, { secure: config.cookieSecure });
          }
        }
        if(pathname==='/emr' && url.searchParams.get('patient') && !RECORD_MANAGEMENT.includes(identity.activeRole)){
          const row=database.findPatient(url.searchParams.get('patient'));
          if(row){
            const policy=encounterAccess(database,session,row);
            if(!policy.canView)return sendJson(response,403,{error:'អ្នកមិនមានសិទ្ធិមើលកំណត់ត្រានេះទេ។'},{secure:config.cookieSecure});
            const requested=url.searchParams.get('view')||'';
            const allowed=requested===policy.view || policy.view==='medical'&&['daily','discharge'].includes(requested) || policy.view==='opd'&&requested==='opd-paraclinic';
            if(!allowed){url.searchParams.set('view',policy.view);return redirect(response,url.pathname+'?'+url.searchParams.toString(),{secure:config.cookieSecure});}
          }
        }
        if (pathname !== '/context' && !roleCanPage(identity.activeRole, pathname)) {
          return sendJson(response, 403, { error: 'Your active role cannot open this page.' }, { secure: config.cookieSecure });
        }
        if (pathname === '/ipd-transfer' && (identity.activeRole !== 'DOCTOR' || identity.activeWard?.code !== 'opd')) {
          return sendJson(response, 403, { error: 'The IPD transfer workspace is available to OPD doctors only.' }, { secure: config.cookieSecure });
        }
        if (pathname === '/opd-paraclinic-nurse' && (identity.activeRole !== 'NURSE' || identity.activeWard?.code !== 'opd')) {
          return sendJson(response, 403, { error: 'The OPD paraclinic handoff queue is available to OPD nurses only.' }, { secure: config.cookieSecure });
        }
        const [filename, legacy] = protectedPages.get(pathname);
        return sendFile(response, path.join(config.protectedDirectory, filename), 'text/html; charset=utf-8', {
          legacy,
          secure: config.cookieSecure,
          requestPath: pathname,
        });
      }
      if (request.method === 'GET' && pathname.startsWith('/emr-assets/')) {
        if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        const assetName = pathname.slice('/emr-assets/'.length);
        if (!emrAssets.has(assetName)) return sendJson(response, 404, { error: 'Not found.' }, { secure: config.cookieSecure });
        const [filename, contentType] = emrAssets.get(assetName);
        return sendFile(response, path.join(config.protectedDirectory, 'assets', filename), contentType, {
          legacy: true,
          secure: config.cookieSecure,
        }, true);
      }
      if (request.method === 'GET' && pathname === '/favicon.ico') {
        applySecurityHeaders(response, { secure: config.cookieSecure });
        response.writeHead(204);
        return response.end();
      }
      return sendJson(response, 404, { error: 'Not found.' }, { secure: config.cookieSecure });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status === 500) console.error(error);
      return sendJson(response, status, {
        error: status === 500 ? 'The server could not complete the request.' : error.message,
      }, { secure: config.cookieSecure });
    }
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.on('close', () => diagnosisSearch.close());
  return {
    server,
    database,
    config,
    persistence,
    recovery,
    access: {
      getUserImagingSubtypes: (userId) => getUserImagingSubtypes(database, userId),
      setUserImagingSubtypes: (userId, subtypes, actorId) => setUserImagingSubtypes(database, userId, subtypes, actorId),
    }
  };
}

export async function startServer() {
  const emrMode = (process.env.EMR_MODE || '').toLowerCase();
  const demoMode = emrMode === 'demo';
  const host = process.env.HOST || '127.0.0.1';
  const application = createEmrServer({ demoMode, host });
  await new Promise((resolve, reject) => {
    application.server.once('error', reject);
    application.server.listen(application.config.port, application.config.host, resolve);
  });
  const modeLabel = application.config.demoMode ? 'DEMO (username-only)' : 'PRODUCTION (password required)';
  console.log(`Borkeo EMR v38.3 [${modeLabel}] listening on http://${application.config.host}:${application.config.port}`);
  if (application.config.host === '0.0.0.0') {
    try {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
            console.log(`Mobile / Phone access (Same Wi-Fi): http://${net.address}:${application.config.port}`);
          }
        }
      }
    } catch {}
  } else {
    console.log(`Listening on local loopback address ${application.config.host} only (not exposed to network).`);
  }
  if (application.config.demoMode) {
    console.log(`DEMO: username-only accounts, localhost only. Demo data: ${application.config.databasePath}`);
    console.log('Demo usernames: admin, registration, triage, doctor_medicine, pharmacy.');
  }
  if (application.config.autoDatabase) {
    console.log(`Persistent EMR data: ${application.config.databasePath}`);
    if (application.persistence.sourcePath) console.log(`Initial database recovered from: ${application.persistence.sourcePath}`);
    if (application.recovery.patients || application.recovery.forms) console.log(`Recovered ${application.recovery.patients} patient record(s) and ${application.recovery.forms} clinical form(s) from ${application.recovery.sources} older database(s).`);
  }

  const cleanup = setInterval(() => application.database.deleteExpiredSessions(Date.now()), 30 * 60_000);
  cleanup.unref();
  const stop = () => application.server.close(() => {
    application.database.close();
    process.exit(0);
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return application;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  startServer().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
