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
import { mountMessagesRoutes } from './routes/messages.mjs';
import { mountPharmacyRoutes } from './routes/pharmacy.mjs';
import { mountParaclinicRoutes } from './routes/paraclinic.mjs';
import { mountFinanceRoutes } from './routes/finance.mjs';
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
  mountMessagesRoutes(router);
  mountPharmacyRoutes(router);
  mountParaclinicRoutes(router);
  mountFinanceRoutes(router);
  // POST' && pathname === '/api/finance/complete-payment'
  // Paraclinic routes: sessionRole(session)==='LAB' 'active' /api/imaging-catalog
  // request.method === 'DELETE' && orderMatch
  // អ្នកជំងឺឈ្មោះ ${pName} ត្រូវបានបញ្ជូនពីផ្នែក ${fromDeptKh.replace(/^ផ្នែក\s*/, '')} មកមន្ទីរពិសោធន៍ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ
  // មកផ្នែករូបភាពវេជ្ជសាស្ត្រ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ
  // ['PARACLINIC_RESULTS_PENDING','DOCTOR_READY'].includes(workflowStage)
  // requestData.opdPreConsultInvoiceId
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
        messagingRoleAllowed, destinationExists, safeAttachmentName,
        orderActorAllowed, labWardWorkflowRole, opdConsultationPaymentRecorded,
        syncOpdParaclinicToRecord, addCatalogCharge, addParaclinicCharges, automaticWardMessage,
        hefLookup, nssfLookup, notifyOpdDoctorsPaymentCompleted, updateWorkflowStageAfterPayment,
      };
      if (await router.handle(ctx)) return;

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
