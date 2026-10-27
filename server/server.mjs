import { ensureSuperuser, countDefaultPasswordAccounts } from './superuser.mjs';
import {createHefLookup,HEF_LOOKUP_ROLES} from './hef-lookup.mjs';
import {createNssfLookup,NSSF_LOOKUP_ROLES} from './nssf-lookup.mjs';
import {ensureSymptomSchema,listSymptoms,addCustomSymptom,SYMPTOM_CREATE_ROLES} from './symptoms.mjs';
import { FACILITY_ROLES,ensureFacilitySchema,getFacility,saveFacility,uploadFacilityDocument,facilityDocument,removeFacilityDocument } from './health-facility.mjs';
import { createDiagnosisSearch } from './icd10.mjs';
// Borkeo EMR v48.7 - Electronic Medical Record System
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
import os from 'node:os';
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
import { mountPatientsRoutes } from './routes/patients.mjs';
import { mountClinicalRoutes } from './routes/clinical.mjs';
import { mountClinicalSummaryRoutes } from './routes/clinical-summary.mjs';
import { mountMedicationSafetyRoutes } from './routes/medication-safety.mjs';
import { mountMaternalRoutes } from './routes/maternal.mjs';
import { NpcaIntegration } from './npca/integration.mjs';
import { NpcaClient } from './npca/client.mjs';
import { assertNpcaPracticeAllowed, createPracticeFetch, practiceHefLookup, practiceNssfLookup } from './npca/practice.mjs';
import { ensureNpcaSchema } from './npca/storage.mjs';
import { mountNpcaRoutes } from './routes/npca.mjs';
import { ensureMaternalSchema } from './maternal.mjs';
import { mountPeriopFormRoutes } from './routes/periop-forms.mjs';
import { mountRecordAccessRoutes } from './routes/record-access.mjs';
import { ensureRecordAccessSchema } from './record-access.mjs';
import { ensureCriticalEscalationSchema, escalateCriticalResults } from './critical-escalation.mjs';
import { ensurePeriopSchema } from './periop-forms.mjs';
import { ensureMedicationSafetySchema } from './medication-safety.mjs';
import { ensureClinicalSummarySchema, clinicalOptions } from './clinical-summary.mjs';
import {
  hashPassword, normalizeUsername, randomToken, safeTokenEqual, tokenHash, validatePassword, validateUsername, verifyPassword,
} from './password.mjs';
import {
  applySecurityHeaders, clearSessionCookie, parseCookies,
  serializeSessionCookie, SESSION_COOKIE,
} from './security.mjs';
import { Logger, defaultLogger } from './logger.mjs';
import { startBackupScheduler, checkDatabaseIntegrity } from './backup.mjs';
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
  ['/public/npca-registration.js', ['npca-registration.js', 'text/javascript; charset=utf-8']],
  ['/public/npca-forms.js', ['npca-forms.js', 'text/javascript; charset=utf-8']],
  ['/public/npca-widget.js', ['npca-widget.js', 'text/javascript; charset=utf-8']],
  ['/public/npca.js', ['npca.js', 'text/javascript; charset=utf-8']],
  ['/public/npca.css', ['npca.css', 'text/css; charset=utf-8']],
  ['/public/escape-html.js', ['escape-html.js', 'text/javascript; charset=utf-8']],
  ['/public/ipd-transfer.js', ['ipd-transfer.js', 'text/javascript; charset=utf-8']],
  ['/public/ipd-transfer.css', ['ipd-transfer.css', 'text/css; charset=utf-8']],
  ['/public/nationalities.js', ['nationalities.js', 'text/javascript; charset=utf-8']],
  ['/public/nationalities.css', ['nationalities.css', 'text/css; charset=utf-8']],
  ['/public/new-text.js', ['new-text.js', 'text/javascript; charset=utf-8']],
  ['/public/new-text-data.js', ['new-text-data.js', 'text/javascript; charset=utf-8']],
  ['/public/new-text.css', ['new-text.css', 'text/css; charset=utf-8']],
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
  ['/public/design-system.css', ['design-system.css', 'text/css; charset=utf-8']],
  ['/public/icons.svg', ['icons.svg', 'image/svg+xml']],
  ['/public/components.css', ['components.css', 'text/css; charset=utf-8']],
  ['/public/components.js', ['components.js', 'text/javascript; charset=utf-8']],
  ['/public/app-shell.css', ['app-shell.css', 'text/css; charset=utf-8']],
  ['/public/app-shell.js', ['app-shell.js', 'text/javascript; charset=utf-8']],
  ['/public/nav-config.js', ['nav-config.js', 'text/javascript; charset=utf-8']],
  ['/public/patient-banner.css', ['patient-banner.css', 'text/css; charset=utf-8']],
  ['/public/patient-banner.js', ['patient-banner.js', 'text/javascript; charset=utf-8']],
  // v42.3: medicine search (Cambodia Essential Medicines List) and medication units.
  ['/public/medicine-autocomplete.js', ['medicine-autocomplete.js', 'text/javascript; charset=utf-8']],
  ['/public/medicine-autocomplete.css', ['medicine-autocomplete.css', 'text/css; charset=utf-8']],
  ['/public/medicine-units.js', ['medicine-units.js', 'text/javascript; charset=utf-8']],
  ['/public/medication-routes.js', ['medication-routes.js', 'text/javascript; charset=utf-8']],
  ['/public/anc-engine.mjs', ['anc-engine.mjs', 'text/javascript; charset=utf-8']],
  ['/public/anc-required-fields.mjs', ['anc-required-fields.mjs', 'text/javascript; charset=utf-8']],
  ['/public/anc-referral-letter.mjs', ['anc-referral-letter.mjs', 'text/javascript; charset=utf-8']],
  ['/public/maternal.js', ['maternal.js', 'text/javascript; charset=utf-8']],
  ['/public/maternal.css', ['maternal.css', 'text/css; charset=utf-8']],
  ['/public/anc-record.js', ['anc-record.js', 'text/javascript; charset=utf-8']],
  ['/public/anc-record.css', ['anc-record.css', 'text/css; charset=utf-8']],
  ['/public/vaccination.js', ['vaccination.js', 'text/javascript; charset=utf-8']],
  ['/public/maternal-emr.js', ['maternal-emr.js', 'text/javascript; charset=utf-8']],
  ['/public/medicine-dose-check.js', ['medicine-dose-check.js', 'text/javascript; charset=utf-8']],
  ['/public/clinical-summary.css', ['clinical-summary.css', 'text/css; charset=utf-8']],
  ['/public/clinical-summary.js', ['clinical-summary.js', 'text/javascript; charset=utf-8']],
  ['/public/display-rules.css', ['display-rules.css', 'text/css; charset=utf-8']],
  ['/public/display-rules.js', ['display-rules.js', 'text/javascript; charset=utf-8']],
  ['/public/medication-safety.css', ['medication-safety.css', 'text/css; charset=utf-8']],
  ['/public/medication-safety.js', ['medication-safety.js', 'text/javascript; charset=utf-8']],
  ['/public/drug-safety.css', ['drug-safety.css', 'text/css; charset=utf-8']],
  ['/public/drug-safety.js', ['drug-safety.js', 'text/javascript; charset=utf-8']],
  ['/public/periop-forms.css', ['periop-forms.css', 'text/css; charset=utf-8']],
  ['/public/periop-forms.js', ['periop-forms.js', 'text/javascript; charset=utf-8']],
  ['/public/patient-documents.css', ['patient-documents.css', 'text/css; charset=utf-8']],
  ['/public/patient-documents.js', ['patient-documents.js', 'text/javascript; charset=utf-8']],
  ['/public/record-log.js', ['record-log.js', 'text/javascript; charset=utf-8']],
  ['/public/record-access.js', ['record-access.js', 'text/javascript; charset=utf-8']],
  ['/public/fluid-balance.js', ['fluid-balance.js', 'text/javascript; charset=utf-8']],
  ['/public/early-warning.js', ['early-warning.js', 'text/javascript; charset=utf-8']],
  ['/public/soap-note.css', ['soap-note.css', 'text/css; charset=utf-8']],
  ['/public/soap-note.js', ['soap-note.js', 'text/javascript; charset=utf-8']],
  ['/public/clinical-data.css', ['clinical-data.css', 'text/css; charset=utf-8']],
  ['/public/clinical-data.js', ['clinical-data.js', 'text/javascript; charset=utf-8']],
  ['/public/worklists-feedback.css', ['worklists-feedback.css', 'text/css; charset=utf-8']],
  ['/public/worklists-feedback.js', ['worklists-feedback.js', 'text/javascript; charset=utf-8']],
  ['/public/styleguide.js', ['styleguide.js', 'text/javascript; charset=utf-8']],
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
  ['/public/emr-consultation-workspace.css', ['emr-consultation-workspace.css', 'text/css; charset=utf-8']],
  ['/public/emr-consultation-workspace.js', ['emr-consultation-workspace.js', 'text/javascript; charset=utf-8']],
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
  ['/public/emr-shared-encounter.js', ['emr-shared-encounter.js', 'text/javascript; charset=utf-8']],
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
  ['/admin/npca', ['npca.html',false]],
  ['/npca', ['npca.html',false]],
  ['/admin/health-facility',['health-facility.html',false]],
  ['/admin/drug-safety',['drug-safety.html',false]],
  // v42.6: maternal services (midwife queue, official ANC record, vaccination).
  ['/maternal',['maternal.html',false]],
  ['/anc-record',['anc-record.html',false]],
  ['/vaccination',['vaccination.html',false]],
  ['/admin/record-log',['record-log.html',false]],
  ['/admin/interface',['interface-theme.html',false]],
  ['/styleguide', ['styleguide.html', false]],
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
  return { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session), username: session.username };
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
  if (['emergency','pediatric','gynecology','obstetric','tb','infectious','icu','ncu'].includes(room)) return room;
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
      infectious: 'ផ្នែកជំងឺឆ្លង',
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

// v42.4: behind a hosting proxy (TRUST_PROXY=true) the client address is the
// last address in X-Forwarded-For (added by the proxy itself; earlier entries
// can be sent by the client). Login lockout, the audit log and the record view
// log all use this address. Without TRUST_PROXY the header is ignored.
function requestIp(request) {
  if (request.borkeoTrustProxy) {
    const forwarded = String(request.headers['x-forwarded-for'] || '').split(',').map(part => part.trim()).filter(Boolean);
    if (forwarded.length) return forwarded[forwarded.length - 1];
  }
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
  html = html.replace('</head>', '<link rel="stylesheet" href="/public/design-system.css?v=3970"><link rel="stylesheet" href="/public/components.css?v=3970"><link rel="stylesheet" href="/public/app-shell.css?v=3980"><link rel="stylesheet" href="/public/patient-banner.css?v=4100"><link rel="stylesheet" href="/public/soap-note.css?v=3970"><link rel="stylesheet" href="/public/clinical-data.css?v=3970"><link rel="stylesheet" href="/public/worklists-feedback.css?v=3970"><link rel="stylesheet" href="/public/interface-theme.css?v=1970"><link rel="stylesheet" href="/public/npca.css?v=4280"><script src="/public/npca-widget.js?v=4280" defer></script><script src="/public/npca-forms.js?v=4280" defer></script><script src="/public/components.js?v=3970" defer></script><script src="/public/nav-config.js?v=3980" defer></script><script src="/public/app-shell.js?v=3980" defer></script><script src="/public/patient-banner.js?v=4170" defer></script><script src="/public/soap-note.js?v=3970" defer></script><script src="/public/clinical-data.js?v=3970" defer></script><script src="/public/worklists-feedback.js?v=3970" defer></script><script src="/public/interface-theme.js?v=1970" defer></script></head>');
  html = html.replace('</head>', '<link rel="stylesheet" href="/public/shared-controls.css?v=1970"><script src="/public/request-badges.js?v=1970" defer></script></head>');
  // v42.3: one medication unit table for every page (old Khmer unit labels shown as mg, mL, mcg, g, IU).
  html = html.replace('</head>', '<script src="/public/record-access.js?v=4570" defer></script></head>');
  html = html.replace('</head>', '<script src="/public/medicine-units.js?v=4230"></script></head>');
  // v42.5: one medication route table for every page (new lines: IV, IM, SC and the simple routes).
  html = html.replace('</head>', '<script src="/public/medication-routes.js?v=4250"></script></head>');
  // v42.3: medicine name search in the prescription forms (medical record page only).
  if(path.basename(filePath)==='EMR.html')html=html.replace('</head>','<link rel="stylesheet" href="/public/medicine-autocomplete.css?v=4250"><script src="/public/medicine-autocomplete.js?v=4250" defer></script><script src="/public/medicine-dose-check.js?v=4250" defer></script><link rel="stylesheet" href="/public/maternal.css?v=4260"><script src="/public/maternal-emr.js?v=4260" defer></script></head>');
  if(path.basename(filePath)==='EMR.html')html=html.replace('</head>','<link rel="stylesheet" href="/public/emr-encounter-editor.css?v=3800"><script src="/public/emr-encounter-editor.js?v=3800" defer></script></head>');
  // v41.0: structured allergy record, problem list and nursing demographics (medical record page only).
  if(path.basename(filePath)==='EMR.html')html=html.replace('</head>','<link rel="stylesheet" href="/public/clinical-summary.css?v=4100"><script src="/public/clinical-summary.js?v=4100" defer></script><link rel="stylesheet" href="/public/display-rules.css?v=4110"><script src="/public/display-rules.js?v=4110" defer></script><link rel="stylesheet" href="/public/medication-safety.css?v=4120"><script src="/public/medication-safety.js?v=4120" defer></script><link rel="stylesheet" href="/public/periop-forms.css?v=4160"><script src="/public/periop-forms.js?v=4160" defer></script><script src="/public/fluid-balance.js?v=4160" defer></script><script src="/public/early-warning.js?v=4160" defer></script><link rel="stylesheet" href="/public/patient-documents.css?v=4170"><script src="/public/patient-documents.js?v=4170" defer></script></head>');
  // v43.3: modern clinical consultation workspace and integrated patient record (EMR.html only).
  if(path.basename(filePath)==='EMR.html')html=html.replace('</head>','<link rel="stylesheet" href="/public/emr-consultation-workspace.css?v=4330"><script src="/public/emr-consultation-workspace.js?v=4330" defer></script><script src="/public/emr-shared-encounter.js?v=4700" defer></script></head>');
  html = html.replace('</head>', `<meta name="borkeo-version" content="${APP_VERSION}"></head>`);
  // New text without approved Khmer is highlighted unless SHOW_UNTRANSLATED=0 (public/new-text.js).
  const showUntranslated = globalThis.process?.env?.SHOW_UNTRANSLATED === '0' ? '0' : '1';
  html = html.replace('</head>', `<meta name="borkeo-show-untranslated" content="${showUntranslated}"><link rel="stylesheet" href="/public/new-text.css?v=4060"><script src="/public/new-text-data.js?v=4060"></script><script src="/public/new-text.js?v=4060"></script></head>`);
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
  const details = { ...(values.details || {}), activeRole, activeWard };
  database.audit({
    id: crypto.randomUUID(),
    userId: values.userId,
    subjectUsername: values.subjectUsername,
    action,
    ipAddress: requestIp(request),
    userAgent: String(request.headers['user-agent'] ?? '').slice(0, 500),
    details,
    occurredAt: Date.now(),
  });
  defaultLogger.info(`Audit: ${action}`, {
    action,
    userId: values.userId,
    subjectUsername: values.subjectUsername,
    ip: requestIp(request),
    details,
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
      // v42.3: names chosen from the Essential Medicines List can be up to 515 characters.
      name: read('name', 600), route: read('route', 80), unit: read('unit', 40),
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
      // v42.3: CMS code of a medicine chosen from the Essential Medicines List (additive).
      ...(read('cmsCode', 40) ? { cmsCode: read('cmsCode', 40) } : {}),
      // v42.5: reason written to continue above a maximum dose (additive).
      ...(read('doseOverrideReason', 1_000) ? { doseOverrideReason: read('doseOverrideReason', 1_000) } : {}),
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
    // v41.6: main / secondary ICD-10 list (main first) and patient instructions.
    dischargeDiagnoses: dischargeDiagnosisList(value.dischargeDiagnoses),
    patientInstructions: boundedMultilineText(value.patientInstructions, 4_000, 'patientInstructions'),
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

// v41.6: discharge ICD-10 list from the main / secondary editor; one main, main first.
function dischargeDiagnosisList(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) badRequest('Discharge diagnoses are invalid.');
  const list = value.map((item, index) => {
    const icd10 = boundedText(item?.icd10, 20, `Discharge diagnosis ${index + 1}`, true).toUpperCase();
    if (!/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/.test(icd10)) badRequest(`Discharge diagnosis ${index + 1} is invalid.`);
    return { icd10, text: boundedText(item?.text, 300, `Discharge diagnosis ${index + 1}`), main: item?.main === true };
  });
  const mainIndex = Math.max(0, list.findIndex((item) => item.main));
  return list.length ? [list[mainIndex], ...list.filter((_, index) => index !== mainIndex)].map((item, index) => ({ ...item, main: index === 0 })) : [];
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
  // v48.1: in NPCA practice mode the card checks answer from the test patients.
  const hefLookup = config.npcaPractice ? async (card) => practiceHefLookup(database, card) : createHefLookup({fetchImpl:configOverrides.hefFetch || fetch});
  const nssfLookup = config.npcaPractice ? async (card) => practiceNssfLookup(database, card) : createNssfLookup({fetchImpl:configOverrides.nssfFetch || fetch});
  const persistence = config.autoDatabase
    ? preparePersistentDatabase({ projectRoot: config.projectRoot || path.resolve(path.dirname(currentFile), '..'), targetPath: config.databasePath })
    : { created: false, sourcePath: '', candidates: [] };
  const database = openDatabase(config.databasePath);
  const integrity = checkDatabaseIntegrity(database);
  if (!integrity.ok) {
    defaultLogger.error('Database integrity check reported issues on startup', { errors: integrity.errors });
  }
  ensureFacilitySchema(database);
  ensureSymptomSchema(database);
  const diagnosisSearch = createDiagnosisSearch();
  ensureAccessSchema(database);
  ensureESignSchema(database);
  if (config.demoMode) ensureDemoAccounts(database);
  // v42.4: an online server never creates the shared-password (1234) ward accounts;
  // the Superuser (SUPERUSER_PASSWORD) creates the real staff accounts.
  else if (!config.isProduction) ensureDefaultWardUsers(database);
  ensureSuperuser(database, Date.now(), { production: config.isProduction, password: config.superuserPassword });
  if (config.isProduction) {
    const defaults = countDefaultPasswordAccounts(database);
    if (defaults) defaultLogger.warn(`${defaults} active account(s) still use the default password. Change them before staff use this server.`);
  }
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
  ensureClinicalSummarySchema(database);
  ensureMedicationSafetySchema(database);
  ensureMaternalSchema(database);
  ensureNpcaSchema(database);
  ensurePeriopSchema(database);
  ensureCriticalEscalationSchema(database);
  ensureRecordAccessSchema(database);
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
  if (config.autoDatabase || config.dataDirectory) createDailyBackup(database, config.databasePath, 14, config.backupDirectory);
  database.deleteExpiredSessions(Date.now());

  if (config.npcaPractice) assertNpcaPracticeAllowed(database);
  const npca = new NpcaIntegration(config.npca, database, config.npcaPractice
    ? { client: new NpcaClient(config.npca, database, { fetchImpl: createPracticeFetch(database) }) } : {});
  const router = new Router('emr');
  mountAuthRoutes(router);
  mountAdminRoutes(router);
  mountQueueRoutes(router);
  mountMessagesRoutes(router);
  mountPharmacyRoutes(router);
  mountParaclinicRoutes(router);
  mountFinanceRoutes(router);
  mountPatientsRoutes(router);
  mountClinicalRoutes(router);
  mountClinicalSummaryRoutes(router);
  mountMedicationSafetyRoutes(router);
  mountMaternalRoutes(router);
  mountNpcaRoutes(router);
  mountPeriopFormRoutes(router);
  mountRecordAccessRoutes(router);
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
  // triageWardChanged
  // pathname === '/api/patient-triage'
  // ['TRIAGE', 'ADMIN', 'VICE_DIRECTOR'].includes(role)
  // data['system:triageStatus'] = 'WAITING'
  // PATIENT_TRIAGE_DELETED
  // const isTriageSaveOrEdit = body.triageSave === true || body.triageEdit === true || body.editorScope === 'triage'
  // !isTriageSaveOrEdit
  // effectiveRoleForMerge = registrationSave ? 'REGISTRATION' : 'TRIAGE'
  // summary = mergePatientSummaryForRole(existingPatient, submittedSummary, effectiveRoleForMerge);
  // const data = mergeRecordDataForRole(existingData, submittedData, effectiveRoleForMerge, Boolean(existingPatient));
  // data['system:encounterId'] = encId;
  // assignmentBed?.patientKey&&assignmentBed.patientKey!==patientKey
  // assignmentBed.patientKey=''
  // database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {
  // if (update.action === 'assign') {
  //   prefixMap
  //   serviceCodeMap
  // }
  // data['system:signature:opdDoctor'] = doctorSig;
  // data['system:signature:ipdDoctor'] = doctorSig;
  // អ្នកជំងឺឈ្មោះ ${name} ត្រូវបានបញ្ជូនពីផ្នែកទ្រីយ៉ាមកផ្នែក ${targetDept.replace
  // អ្នកជំងឺឈ្មោះ ${patientName} ត្រូវបានបញ្ជូនពីផ្នែកពិគ្រោះក្រៅមកផ្នែក ${targetWardKh} សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ
  // database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?")
  // database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?")
  // database.sqlite.exec('BEGIN IMMEDIATE')
  // startPatientInvoice(database,patientKey,session.user_id,savedAt)
  // pathname === '/api/system-settings/followup'
  // !['ADMIN','VICE_DIRECTOR'].includes(sessionRole(session))
  // OPD_PATIENT_TRANSFERRED_TO_IPD
  // system:ipdDischargeSummary

  const server = http.createServer(async (request, response) => {
    request.borkeoTrustProxy = config.trustProxy === true;
    const requestId = crypto.randomUUID();
    response.setHeader('X-Request-ID', requestId);
    const reqLogger = defaultLogger.child({ requestId });
    try {
      const url = new URL(request.url ?? '/', config.appOrigin);
      const pathname = decodeURIComponent(url.pathname);
      // v42.4: health check for the hosting platform (no login, no patient data).
      if (request.method === 'GET' && pathname === '/api/health') {
        return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
      }
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
        requestId, logger: reqLogger, npca,
        sendJson, sendBuffer, readJson, readBinary, audit, sameOrigin, safeTokenEqual,
        sessionRole, sessionWard, requireContext, redirect, sendFile,
        listUsers, buildIdentity, requestIp, genericLoginFailure, landingPathForRole,
        serializeSessionCookie, clearSessionCookie,
        parseStoredJson, boundedText,
        opdConsultationPaymentConfirmed, patientClinicalClosed, clinicalPatientKey,
        patientRecordResponse, canAccessPatient, messagingVisibility,
        paymentStatusForPatient, encounterAccess,
        messagingRoleAllowed, destinationExists, safeAttachmentName,
        orderActorAllowed, labWardWorkflowRole, opdConsultationPaymentRecorded,
        syncOpdParaclinicToRecord, addCatalogCharge, addParaclinicCharges, automaticWardMessage,
        hefLookup, nssfLookup, notifyOpdDoctorsPaymentCompleted, updateWorkflowStageAfterPayment,
        badRequest, recordData, calendarDate, sanitizePatientSummary,
        patientDataVisibleForRole, validateDailyMonitoringDates,
        buildIpdDischargeSummary, sanitizeAdmissionAction,
        mergeRecordDataForRole, mergePatientSummaryForRole,
        clinicalWriteRoles, clinicalFormReadRoles,
        admissionWardCode, notifyTriageReferral, releasePatientFromHospitalMap,
        nextRegistrationQueueNumber, ensureUniqueRegistrationQueueNumber,
        registrationQueueNumberFromData, wardMedicineOrderDates, patientWorkWard,
        diagnosisSearch, followupDatePolicy, hospitalStateForSession,
        sanitizeHospitalState, mergeHospitalStateForSession,
        clinicalFormTypes, clinicalFormWriteRoles, clinicalRecordResponse,
        sanitizePatientSnapshot, sanitizeClinicalFormData,
        pmrsPaymentCategoryStatus, paidOpdQueuePatients,
      };
      if (await router.handle(ctx)) return;

      if (config.demoMode && pathname === '/pmrs-import') {
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
        // An account that must change its password stays on /login, where the
        // change-password form is shown; redirecting it would loop (v39.9).
        if (session && session.must_change_password !== 1) {
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
      if (status >= 500) {
        reqLogger.error(`Unhandled error on ${request.method} ${pathname}: ${error.message}`, { error, status });
      } else if (status >= 400) {
        reqLogger.warn(`Client error on ${request.method} ${pathname}: ${error.message}`, { status });
      }
      return sendJson(response, status, {
        error: status === 500 ? 'The server could not complete the request.' : error.message,
      }, { secure: config.cookieSecure });
    }
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.once('listening', () => npca.start());
  server.on('close', () => npca.stop());
  server.on('close', () => diagnosisSearch.close());
  return {
    server,
    database,
    config,
    persistence,
    recovery,
    npca,
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
  console.log(`Borkeo EMR v${APP_VERSION} [${modeLabel}] listening on http://${application.config.host}:${application.config.port}`);
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
  if (application.config.dataDirectory) console.log(`Persistent EMR data (DATA_DIR): ${application.config.dataDirectory}`);
  if (application.config.autoDatabase) {
    console.log(`Persistent EMR data: ${application.config.databasePath}`);
    if (application.persistence.sourcePath) console.log(`Initial database recovered from: ${application.persistence.sourcePath}`);
    if (application.recovery.patients || application.recovery.forms) console.log(`Recovered ${application.recovery.patients} patient record(s) and ${application.recovery.forms} clinical form(s) from ${application.recovery.sources} older database(s).`);
  }

  const cleanup = setInterval(() => application.database.deleteExpiredSessions(Date.now()), 30 * 60_000);
  cleanup.unref();
  // v41.6: unacknowledged critical results go to the ward doctors and ward head (every minute).
  const escalation = setInterval(() => {
    try { escalateCriticalResults(application.database, clinicalOptions().criticalEscalation); } catch (error) { console.error('Critical result escalation failed:', error.message); }
  }, 60_000);
  escalation.unref();
  const backupScheduler = startBackupScheduler(application.database, application.config, { backupDirectory: application.config.backupDirectory || undefined });
  const stop = () => application.server.close(() => {
    backupScheduler.stop();
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

export { Logger, defaultLogger, checkDatabaseIntegrity, startBackupScheduler };

