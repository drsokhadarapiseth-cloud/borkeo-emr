import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HEF_LOOKUP_ROLES } from '../hef-lookup.mjs';
import { NSSF_LOOKUP_ROLES } from '../nssf-lookup.mjs';
import { validateAddressHierarchy } from '../gazetteer.mjs';
import { recordLegacyReview } from '../requests.mjs';
import {
  PAYMENT_CATEGORIES, NSSF_SUBTYPES, FACILITY_LEVELS, majorPaymentCategory,
  paymentSettings, setPaymentSettings, payerTariffCatalog, setPayerTariff,
  listConcessions, requestConcession, reviewConcession,
} from '../payment-policy.mjs';
import {
  invoiceHistory, invoiceEditRequests, cashierPaymentAlerts,
  requestInvoiceEdit, reviewInvoiceEdit, applyInvoiceEdit,
  assertCashierInvoiceWritable, queueCashierPayment, isPatientDischarged,
  applyDirectInvoiceEdit,
} from '../invoice-edits.mjs';
import { ROLES, sessionRole, sessionWard } from '../access.mjs';
import {
  PAYMENT_TYPES, DIRECT_PAYMENT_TYPES, HEF_TYPES, PAYMENT_PURPOSES, FINANCE_CURRENCIES,
  SERVICE_CATEGORIES, FINANCE_DEPARTMENTS,
  addCharge, addExpense, addPayment, addPaymentAttachment,
  cashflowDayDetails, cashflowRange, serviceRevenueRange,
  financePatientSearch, getFinancePayment, getPaymentAttachment,
  listExpenses, listPatientInvoices, patientBill, patientPaymentHistory,
  serviceCatalog, setFinanceProfile, setServiceCatalogItem, voidFinanceItem,
  startPatientInvoice, exchangeRateState, proposeExchangeRate, reviewExchangeRate,
} from '../finance.mjs';
import { validate, Schemas } from '../validation.mjs';

export function mountFinanceRoutes(router) {
  router.post('/api/hef/lookup', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, hefLookup } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!HEF_LOOKUP_ROLES.has(sessionRole(session))) return sendJson(response, 403, { error: 'Registration access required.' }, { secure: config.cookieSecure });
    try {
      const body = await readJson(request, 4096);
      const result = await hefLookup(body.cardNumber, session.user_id);
      if (result.found) {
        try {
          result.address.canImport = Boolean(result.address.villageCode) && validateAddressHierarchy(result.address).valid;
        } catch {
          result.address.canImport = false;
        }
      }
      audit(database, request, 'HEF_LOOKUP', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { found: result.found, cardSuffix: result.requestedCard.slice(-4), memberCount: result.members?.length || 0 },
      });
      response.setHeader('Cache-Control', 'no-store');
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      if (error.status === 429) response.setHeader('Retry-After', '60');
      return sendJson(response, error.status || 503, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/hef/lookup', async (ctx) => {
    const { response, session, config, sendJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!HEF_LOOKUP_ROLES.has(sessionRole(session))) return sendJson(response, 403, { error: 'Registration access required.' }, { secure: config.cookieSecure });
    return sendJson(response, 405, { error: 'Method not allowed.' }, { secure: config.cookieSecure });
  });

  router.post('/api/nssf/verify', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, nssfLookup } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!NSSF_LOOKUP_ROLES.has(sessionRole(session))) return sendJson(response, 403, { error: 'Registration access required.' }, { secure: config.cookieSecure });
    try {
      const body = await readJson(request, 4096);
      const result = await nssfLookup(body.cardNumber, session.user_id);
      audit(database, request, 'NSSF_VERIFY', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { found: result.found, cardSuffix: result.requestedCard.slice(-4), status: result.card?.status },
      });
      response.setHeader('Cache-Control', 'no-store');
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      if (error.status === 429) response.setHeader('Retry-After', '60');
      return sendJson(response, error.status || 503, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/nssf/verify', async (ctx) => {
    const { response, session, config, sendJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!NSSF_LOOKUP_ROLES.has(sessionRole(session))) return sendJson(response, 403, { error: 'Registration access required.' }, { secure: config.cookieSecure });
    return sendJson(response, 405, { error: 'Method not allowed.' }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/payment-settings', async (ctx) => {
    const { response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, {
      settings: paymentSettings(database),
      paymentCategories: PAYMENT_CATEGORIES,
      nssfSubtypes: NSSF_SUBTYPES,
      facilityLevels: FACILITY_LEVELS,
    }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/payment-settings', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const actor = { role, userId: session.user_id };
    try {
      const settings = setPaymentSettings(database, await readJson(request, 10000), actor);
      audit(database, request, 'PAYMENT_FACILITY_LEVEL_UPDATED', { userId: actor.userId, subjectUsername: session.username, details: settings });
      return sendJson(response, 200, { settings }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/payer-tariffs', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, {
      settings: paymentSettings(database),
      services: payerTariffCatalog(database, url.searchParams.get('paymentType') || 'HEF', {
        includeInactive: ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role),
        includeUnavailable: ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role),
      }),
    }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/payer-tariffs', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const actor = { role, userId: session.user_id };
    try {
      const service = setPayerTariff(database, await readJson(request, config.maxBodyBytes), actor);
      audit(database, request, 'PAYER_TARIFF_UPDATED', {
        userId: actor.userId,
        subjectUsername: session.username,
        details: { paymentType: service.paymentType, code: service.code, amount: service.defaultAmount, facilityLevel: service.facilityLevel },
      });
      return sendJson(response, 200, { service }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.delete('/api/finance/payer-tariffs', async (ctx) => {
    const { request, url, response, session, config, database, sendJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { role, userId: session.user_id };
    const type = url.searchParams.get('paymentType');
    const facility = url.searchParams.get('facilityLevel');
    const code = url.searchParams.get('code');
    try {
      database.sqlite.prepare('DELETE FROM finance_payer_tariffs WHERE payer_type=? AND facility_level=? AND service_code=?').run(type, facility, code);
      audit(database, request, 'PAYER_TARIFF_DELETED', { userId: actor.userId, subjectUsername: session.username, details: { paymentType: type, code, facilityLevel: facility } });
      return sendJson(response, 200, { success: true }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/concessions', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const actor = { role, userId: session.user_id };
    return sendJson(response, 200, { requests: listConcessions(database, actor, { invoiceId: url.searchParams.get('invoiceId') || '' }) }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/concessions', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const actor = { role, userId: session.user_id };
    try {
      const body = await readJson(request, 10000);
      const concession = requestConcession(database, body, actor);
      audit(database, request, 'CASH_EXEMPTION_REQUESTED', { userId: actor.userId, subjectUsername: session.username, details: { id: concession.id, invoiceId: concession.invoiceId, status: concession.status } });
      return sendJson(response, 201, { request: concession }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post(/^\/api\/finance\/concessions\/([0-9a-f-]+)\/review$/, async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, routeParams } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const actor = { role, userId: session.user_id };
    const concessionId = routeParams[1];
    try {
      const body = await readJson(request, 10000);
      if (body.approved === false && !String(body.note || '').trim()) {
        return sendJson(response, 400, { error: 'Rejection feedback is required.' }, { secure: config.cookieSecure });
      }
      const concession = reviewConcession(database, concessionId, body, actor);
      recordLegacyReview(database, 'legacy-cash:' + concession.id, concession, actor);
      audit(database, request, 'CASH_EXEMPTION_REVIEWED', { userId: actor.userId, subjectUsername: session.username, details: { id: concession.id, invoiceId: concession.invoiceId, status: concession.status } });
      return sendJson(response, 200, { request: concession }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/services', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const paymentType = majorPaymentCategory(url.searchParams.get('paymentType') || 'DIRECT');
    const services = paymentType === 'DIRECT'
      ? serviceCatalog(database, { includeInactive: ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role) })
      : payerTariffCatalog(database, paymentType);
    return sendJson(response, 200, {
      categories: SERVICE_CATEGORIES,
      departments: FINANCE_DEPARTMENTS,
      services,
      settings: paymentSettings(database),
      paymentCategories: PAYMENT_CATEGORIES,
      nssfSubtypes: NSSF_SUBTYPES,
    }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/services', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    try {
      const service = setServiceCatalogItem(database, body || {});
      audit(database, request, 'FINANCE_SERVICE_CATALOG_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { code: service.code, categoryCode: service.categoryCode } });
      return sendJson(response, 200, { service }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.delete('/api/finance/services', async (ctx) => {
    const { request, url, response, session, config, database, sendJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
    }
    const code = url.searchParams.get('code');
    try {
      database.sqlite.prepare('DELETE FROM finance_service_catalog WHERE code=?').run(code);
      audit(database, request, 'FINANCE_SERVICE_CATALOG_DELETED', { userId: session.user_id, subjectUsername: session.username, details: { code } });
      return sendJson(response, 200, { success: true }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/ward-services', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Ward service access is required.' }, { secure: config.cookieSecure });
    }
    const ward = ['ADMIN', 'VICE_DIRECTOR'].includes(role) || role === 'DIRECTOR'
      ? String(url.searchParams.get('ward') || '').toLowerCase()
      : sessionWard(session);
    const services = serviceCatalog(database);
    return sendJson(response, 200, { ward, services, categories: SERVICE_CATEGORIES }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/ward-charges', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext, clinicalPatientKey, canAccessPatient, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Nurse or Midwife access is required.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (patient.service_mode !== 'ipd') return sendJson(response, 400, { error: 'Ward service fees are available for admitted IPD patients only.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && !canAccessPatient(database, session, patient)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    const openInvoice = database.sqlite.prepare('SELECT id FROM finance_invoices WHERE patient_key=? AND closed_at IS NULL ORDER BY created_at DESC,rowid DESC LIMIT 1').get(patientKey);
    const bill = openInvoice ? patientBill(database, patientKey, openInvoice.id) : null;
    const record = parseStoredJson(patient.record_json);
    const balance = Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0);
    return sendJson(response, 200, {
      invoice: bill?.invoice || null,
      charges: (bill?.charges || []).filter(item => !item.voidedAt),
      summary: bill?.summary || {},
      balance,
      cashierQueueRequested: Boolean(record['system:cashierQueueRequest']?.invoiceId === bill?.invoice?.id),
    }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/ward-charges', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, canAccessPatient, addCatalogCharge } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Nurse or Midwife access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (patient.service_mode !== 'ipd') return sendJson(response, 400, { error: 'Ward service fees are available for admitted IPD patients only.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && !canAccessPatient(database, session, patient)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    const service = serviceCatalog(database).find(item => item.code === String(body?.serviceCode || '').toUpperCase());
    if (!service) return sendJson(response, 400, { error: 'Service was not found.' }, { secure: config.cookieSecure });
    const ward = ['ADMIN', 'VICE_DIRECTOR'].includes(role) ? String(patient.department_code || '').toLowerCase() : sessionWard(session);
    try {
      const charge = addCatalogCharge(database, patientKey, service.code, session.user_id, body?.sourceKey || '', body?.note || '', body?.quantity || 1);
      audit(database, request, 'WARD_SERVICE_CHARGED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, serviceCode: service.code, ward, chargeId: charge.id } });
      return sendJson(response, 201, { charge, bill: patientBill(database, patientKey) }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/ward-charge-void', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Nurse or Midwife access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (patient.service_mode !== 'ipd') return sendJson(response, 400, { error: 'Ward service fees are available for admitted IPD patients only.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && !canAccessPatient(database, session, patient)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    const reason = String(body?.reason || '').trim();
    if (!reason) return sendJson(response, 400, { error: 'A reason is required to remove a service fee.' }, { secure: config.cookieSecure });
    const openInvoice = database.sqlite.prepare('SELECT id FROM finance_invoices WHERE patient_key=? AND closed_at IS NULL ORDER BY created_at DESC,rowid DESC LIMIT 1').get(patientKey);
    const bill = openInvoice ? patientBill(database, patientKey, openInvoice.id) : null;
    const charge = (bill?.charges || []).find(item => item.id === String(body?.chargeId || ''));
    if (!charge || charge.voidedAt) return sendJson(response, 404, { error: 'Active service fee was not found on the current invoice.' }, { secure: config.cookieSecure });
    if ((bill?.payments || []).some(item => !item.voidedAt)) {
      return sendJson(response, 409, { error: 'This invoice already has a payment. Ask the Cashier or Accountant to correct it so payment history remains auditable.' }, { secure: config.cookieSecure });
    }
    try {
      voidFinanceItem(database, 'charge', charge.id, reason, session.user_id);
      audit(database, request, 'WARD_SERVICE_FEE_VOIDED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, chargeId: charge.id, serviceCode: charge.serviceCode, reason, ward: sessionWard(session) } });
      const updated = patientBill(database, patientKey);
      return sendJson(response, 200, { ok: true, invoice: updated?.invoice || null, charges: (updated?.charges || []).filter(item => !item.voidedAt), summary: updated?.summary || {} }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/invoices', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, parseStoredJson, addCatalogCharge } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    try {
      const requestId = String(body?.requestId || '');
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error('Invoice request identifier is invalid.');
      const prefix = `STAFF_INVOICE:${session.user_id}:${requestId}:`;
      const existing = database.sqlite.prepare('SELECT invoice_id,patient_key FROM finance_charges WHERE source_key=?').get(prefix + '0');
      if (existing) {
        if (existing.patient_key !== patientKey) throw new Error('Invoice request belongs to another patient.');
        return sendJson(response, 200, { bill: patientBill(database, patientKey, existing.invoice_id), invoiceId: existing.invoice_id }, { secure: config.cookieSecure });
      }
      const items = Array.isArray(body?.items) ? body.items : [];
      if (!items.length || items.length > 100) throw new Error('Select between 1 and 100 services for this invoice.');
      const paymentType = majorPaymentCategory(body?.paymentType || 'DIRECT');
      if (body?.paymentType && !PAYMENT_CATEGORIES.some(x => x.code === body.paymentType)) throw Error('Select a valid payment category.');
      const catalog = paymentType === 'DIRECT' ? serviceCatalog(database) : payerTariffCatalog(database, paymentType);
      for (const item of items) {
        const service = catalog.find(s => s.code === String(item.serviceCode || '').toUpperCase());
        if (!service || Number(service.defaultAmount) <= 0) throw new Error('Select an active service with a configured fee.');
        if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || Number(item.quantity) > 100000) throw new Error('Quantity is invalid.');
        if (item.unitAmount !== undefined && (Number(item.unitAmount) !== Number(service.defaultAmount) || item.currency !== service.currency)) throw new Error('Service price changed. Reload the price list before sending.');
        if (item.revision !== undefined && Number(item.revision) !== Number(service.revision)) throw new Error('Payer tariff changed. Reload the price list before sending.');
      }
      let bill;
      database.sqlite.exec('BEGIN IMMEDIATE');
      try {
        const invoice = startPatientInvoice(database, patientKey, session.user_id);
        setFinanceProfile(database, patientKey, { paymentType, paymentSubtype: 'FULL', nssfSubtype: body?.nssfSubtype || '', payerName: body?.payerName || '', payerReference: body?.payerReference || '' }, session.user_id, Date.now(), invoice.id);
        const data = parseStoredJson(patient.record_json);
        queueCashierPayment(database, patientKey, data['system:cashierQueueRequest']);
        items.forEach((item, index) => paymentType === 'DIRECT'
          ? addCatalogCharge(database, patientKey, item.serviceCode, session.user_id, prefix + index, String(body?.note || '').slice(0, 1000), Number(item.quantity), invoice.id)
          : addCharge(database, patientKey, { tariffPaymentType: paymentType, serviceCode: item.serviceCode, quantity: Number(item.quantity), sourceKey: prefix + index, note: String(body?.note || '').slice(0, 1000) }, session.user_id, Date.now(), { newInvoiceId: invoice.id }));
        bill = patientBill(database, patientKey, invoice.id);
        const queue = { invoiceId: invoice.id, sentAt: Date.now(), sentBy: session.user_id, wardCode: sessionWard(session) || patient.department_code || '', source: 'STAFF_INVOICE' };
        queueCashierPayment(database, patientKey, queue);
        data['system:cashierQueueRequest'] = queue;
        database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data), Date.now(), patientKey);
        audit(database, request, 'STAFF_INVOICE_CREATED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, invoiceId: invoice.id, requestId } });
        database.sqlite.exec('COMMIT');
      } catch (error) {
        database.sqlite.exec('ROLLBACK');
        throw error;
      }
      return sendJson(response, 201, { bill, invoiceId: bill.invoice.id }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/send-to-cashier', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!ROLES.includes(role)) return sendJson(response, 403, { error: 'Staff access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 10_000);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    const data = parseStoredJson(patient.record_json);
    const bill = patientBill(database, patientKey, String(body?.invoiceId || ''));
    const balance = Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0);
    if (!bill?.invoice?.id || balance <= 0) return sendJson(response, 409, { error: 'There is no outstanding balance on the current invoice to send to Cashier.' }, { secure: config.cookieSecure });
    const sentAt = Date.now();
    data['system:cashierQueueRequest'] = { invoiceId: bill.invoice.id, sentAt, sentBy: session.user_id, wardCode: sessionWard(session) || patient.department_code || '', source: 'WARD' };
    queueCashierPayment(database, patientKey, data['system:cashierQueueRequest']);
    database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data), sentAt, patientKey);
    audit(database, request, 'PATIENT_INVOICE_SENT_TO_CASHIER', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, invoiceId: bill.invoice.id, ward: data['system:cashierQueueRequest'].wardCode } });
    return sendJson(response, 200, { ok: true, invoice: bill.invoice, balance, sentAt, queueRequested: true }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/exchange-rates', async (ctx) => {
    const { response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'CLERK', 'VICE_DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, exchangeRateState(database), { secure: config.cookieSecure });
  });

  router.post('/api/finance/exchange-rates', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ACCOUNTANT', 'CLERK'].includes(role)) return sendJson(response, 403, { error: 'Only Cashier can propose an exchange rate.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 10_000);
    try {
      const rate = proposeExchangeRate(database, body?.khrPerUsd, session.user_id);
      audit(database, request, 'EXCHANGE_RATE_PROPOSED', { userId: session.user_id, subjectUsername: session.username, details: { rateId: rate.id, khrPerUsd: rate.khrPerUsd } });
      return sendJson(response, 201, { rate, state: exchangeRateState(database) }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post(/^\/api\/finance\/exchange-rates\/([0-9a-f-]+)\/review$/, async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, routeParams } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Admin or Director approval is required.' }, { secure: config.cookieSecure });
    }
    const rateId = routeParams[1];
    const body = await readJson(request, 10_000);
    try {
      const state = reviewExchangeRate(database, rateId, body?.approved === true, body?.note || '', session.user_id);
      audit(database, request, body?.approved === true ? 'EXCHANGE_RATE_APPROVED' : 'EXCHANGE_RATE_REJECTED', { userId: session.user_id, subjectUsername: session.username, details: { rateId } });
      return sendJson(response, 200, state, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/cashier-alerts', async (ctx) => {
    const { response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    return sendJson(response, 200, {
      payments: ['CLERK', 'ACCOUNTANT'].includes(role) ? cashierPaymentAlerts(database) : [],
      requests: invoiceEditRequests(database, actor),
    }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/invoice-history', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext, clinicalPatientKey } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const discharged = isPatientDischarged(database, patientKey);
    return sendJson(response, 200, {
      invoices: invoiceHistory(database, patientKey, { paidOnly: ['CLERK', 'ACCOUNTANT'].includes(role) }),
      discharged,
      requests: invoiceEditRequests(database, actor, patientKey),
    }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/invoice-edit-requests', async (ctx) => {
    const { response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    return sendJson(response, 200, { requests: invoiceEditRequests(database, actor) }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/invoice-direct-edit', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    try {
      const body = await readJson(request, config.maxBodyBytes);
      const invoiceId = String(body?.invoiceId || '');
      const patientKey = clinicalPatientKey(body?.patientKey);
      const result = applyDirectInvoiceEdit(database, actor, patientKey, invoiceId, body);
      if (result.balance > 0) {
        const patient = database.findPatient(result.patientKey);
        const data = parseStoredJson(patient.record_json);
        const correctionQueue = { invoiceId: result.invoiceId, sentAt: Date.now(), sentBy: session.user_id, wardCode: patient.department_code, source: 'DIRECT_CORRECTION' };
        queueCashierPayment(database, result.patientKey, correctionQueue);
        if (!data['system:cashierQueueRequest'] || data['system:cashierQueueRequest'].invoiceId === result.invoiceId) {
          data['system:cashierQueueRequest'] = correctionQueue;
          database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data), result.patientKey);
        }
      }
      audit(database, request, 'INVOICE_DIRECT_EDIT_APPLIED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: result.patientKey, invoiceId: result.invoiceId } });
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post(/^\/api\/finance\/invoices\/([0-9a-f-]+)\/direct-edit$/, async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, parseStoredJson, routeParams } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    const invoiceId = routeParams[1];
    try {
      const body = await readJson(request, config.maxBodyBytes);
      const patientKey = clinicalPatientKey(body?.patientKey);
      const result = applyDirectInvoiceEdit(database, actor, patientKey, invoiceId, body);
      if (result.balance > 0) {
        const patient = database.findPatient(result.patientKey);
        const data = parseStoredJson(patient.record_json);
        const correctionQueue = { invoiceId: result.invoiceId, sentAt: Date.now(), sentBy: session.user_id, wardCode: patient.department_code, source: 'DIRECT_CORRECTION' };
        queueCashierPayment(database, result.patientKey, correctionQueue);
        if (!data['system:cashierQueueRequest'] || data['system:cashierQueueRequest'].invoiceId === result.invoiceId) {
          data['system:cashierQueueRequest'] = correctionQueue;
          database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data), result.patientKey);
        }
      }
      audit(database, request, 'INVOICE_DIRECT_EDIT_APPLIED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: result.patientKey, invoiceId: result.invoiceId } });
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/invoice-edit-requests', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    try {
      const body = await readJson(request, config.maxBodyBytes);
      const patientKey = clinicalPatientKey(body?.patientKey);
      const invoiceId = String(body?.invoiceId || '');
      const id = requestInvoiceEdit(database, actor, patientKey, invoiceId, body?.reason, body?.operation || 'CORRECT');
      audit(database, request, 'INVOICE_EDIT_REQUESTED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, invoiceId, requestId: id } });
      return sendJson(response, 201, { id }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post(/^\/api\/finance\/invoice-edit-requests\/([0-9a-f-]+)\/(review|apply)$/, async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, parseStoredJson, routeParams } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['CLERK', 'ACCOUNTANT', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const actor = { userId: session.user_id, role };
    const requestId = routeParams[1];
    const action = routeParams[2];
    try {
      const body = await readJson(request, config.maxBodyBytes);
      if (action === 'review') {
        if (typeof body?.approved !== 'boolean') return sendJson(response, 400, { error: 'Choose approve or reject.' }, { secure: config.cookieSecure });
        reviewInvoiceEdit(database, actor, requestId, body.approved, body.note);
        audit(database, request, body.approved ? 'INVOICE_EDIT_APPROVED' : 'INVOICE_EDIT_REJECTED', { userId: session.user_id, subjectUsername: session.username, details: { requestId } });
        return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
      }
      const result = applyInvoiceEdit(database, actor, requestId, body);
      if (result.balance > 0) {
        const patient = database.findPatient(result.patientKey);
        const data = parseStoredJson(patient.record_json);
        const correctionQueue = { invoiceId: result.invoiceId, sentAt: Date.now(), sentBy: session.user_id, wardCode: patient.department_code, source: 'APPROVED_CORRECTION' };
        queueCashierPayment(database, result.patientKey, correctionQueue);
        if (!data['system:cashierQueueRequest'] || data['system:cashierQueueRequest'].invoiceId === result.invoiceId) {
          data['system:cashierQueueRequest'] = correctionQueue;
          database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data), result.patientKey);
        }
      }
      audit(database, request, 'INVOICE_EDIT_APPLIED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: result.patientKey, invoiceId: result.invoiceId, requestId } });
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/patients', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'CLERK', 'VICE_DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const view = String(url.searchParams.get('view') || 'all').toLowerCase();
    return sendJson(response, 200, { patients: financePatientSearch(database, url.searchParams.get('q') || '', { view }) }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/patient', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext, clinicalPatientKey, paymentStatusForPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'CLERK', 'VICE_DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const invoiceId = String(url.searchParams.get('invoiceId') || '');
    const bill = patientBill(database, patientKey, invoiceId);
    if (!bill) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, {
      bill,
      paymentStatus: paymentStatusForPatient(database, patientKey, invoiceId),
      paymentTypes: PAYMENT_TYPES,
      directPaymentTypes: DIRECT_PAYMENT_TYPES,
      hefTypes: HEF_TYPES,
      paymentPurposes: PAYMENT_PURPOSES,
      currencies: FINANCE_CURRENCIES,
      invoices: listPatientInvoices(database, patientKey),
      paymentHistory: patientPaymentHistory(database, patientKey),
    }, { secure: config.cookieSecure });
  });

  router.get('/api/finance/payment-status', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext, clinicalPatientKey, canAccessPatient, paymentStatusForPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    const financeWideAccess = ['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK', 'DIRECTOR', 'LAB', 'IMAGING', 'PHARMACY'].includes(role);
    if (!financeWideAccess && !canAccessPatient(database, session, patient)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, { status: paymentStatusForPatient(database, patientKey) }, { secure: config.cookieSecure });
  });

  router.patch('/api/finance/patient', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, paymentStatusForPatient, updateWorkflowStageAfterPayment } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    if (!database.findPatient(patientKey)) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    try {
      const invoiceId = String(body?.invoiceId || '');
      assertCashierInvoiceWritable(database, patientKey, invoiceId, role);
      const profile = setFinanceProfile(database, patientKey, body || {}, session.user_id, Date.now(), invoiceId);
      updateWorkflowStageAfterPayment(database, patientKey, { userId: session.user_id, role, invoiceId });
      audit(database, request, 'PATIENT_PAYMENT_TYPE_UPDATED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { patientKey, paymentType: profile.paymentType, paymentSubtype: profile.paymentSubtype, discountAmount: profile.discountAmount, discountCurrency: profile.discountCurrency },
      });
      return sendJson(response, 200, {
        bill: patientBill(database, patientKey, invoiceId),
        paymentStatus: paymentStatusForPatient(database, patientKey, invoiceId),
        invoices: listPatientInvoices(database, patientKey),
      }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/charges', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, addCatalogCharge } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    if (!database.findPatient(patientKey)) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    try {
      let charge;
      database.sqlite.exec('BEGIN IMMEDIATE');
      try {
        const catalogService = serviceCatalog(database, { includeInactive: true }).find(item => item.code === String(body?.serviceCode || '').toUpperCase());
        charge = majorPaymentCategory(body?.tariffPaymentType || 'DIRECT') === 'DIRECT' && catalogService?.currency === 'USD'
          ? addCatalogCharge(database, patientKey, catalogService.code, session.user_id, body?.sourceKey || '', body?.note || '', body?.quantity || 1)
          : addCharge(database, patientKey, body || {}, session.user_id);
        const selectedPayer = majorPaymentCategory(body?.tariffPaymentType || 'DIRECT');
        if (body?.tariffPaymentType) {
          const active = patientBill(database, patientKey, charge.invoiceId).charges.filter(c => !c.voidedAt);
          if (active.some(c => majorPaymentCategory(c.tariffPayer) !== selectedPayer)) {
            throw Error('This invoice uses another payment category. Create a new invoice with the correct price list.');
          }
          setFinanceProfile(database, patientKey, { paymentType: selectedPayer, paymentSubtype: 'FULL', nssfSubtype: body.nssfSubtype || '', payerName: body.payerName || '', payerReference: body.payerReference || '' }, session.user_id, Date.now(), charge.invoiceId);
        }
        database.sqlite.exec('COMMIT');
      } catch (error) {
        database.sqlite.exec('ROLLBACK');
        throw error;
      }
      audit(database, request, 'FINANCE_CHARGE_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, chargeId: charge.id, amount: charge.amount, currency: charge.currency } });
      const bill = patientBill(database, patientKey);
      return sendJson(response, 201, { charge, bill, invoices: listPatientInvoices(database, patientKey) }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/payments', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, paymentStatusForPatient, updateWorkflowStageAfterPayment, notifyOpdDoctorsPaymentCompleted } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    if (!database.findPatient(patientKey)) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    try {
      assertCashierInvoiceWritable(database, patientKey, String(body?.invoiceId || ''), role);
      const payment = addPayment(database, patientKey, body || {}, session.user_id);
      const bill = patientBill(database, patientKey, payment.invoiceId);
      const settled = Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0) <= 0 && Number(bill?.summary?.KHR?.gross || 0) + Number(bill?.summary?.USD?.gross || 0) > 0;
      if (settled) database.sqlite.prepare('UPDATE finance_invoices SET closed_at=COALESCE(closed_at,?) WHERE id=?').run(Date.now(), payment.invoiceId);
      updateWorkflowStageAfterPayment(database, patientKey, { userId: session.user_id, role, invoiceId: payment.invoiceId });
      if (settled) {
        try { notifyOpdDoctorsPaymentCompleted(database, session, database.findPatient(patientKey), bill, [payment]); } catch {}
      }
      audit(database, request, 'FINANCE_PAYMENT_RECEIVED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, paymentId: payment.id, amount: payment.amount, currency: payment.currency, source: payment.source, purpose: payment.purpose } });
      return sendJson(response, 201, {
        payment,
        bill: patientBill(database, patientKey, payment.invoiceId),
        paymentStatus: paymentStatusForPatient(database, patientKey, payment.invoiceId),
        invoices: listPatientInvoices(database, patientKey),
      }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/complete-payment', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext, clinicalPatientKey, paymentStatusForPatient, updateWorkflowStageAfterPayment, notifyOpdDoctorsPaymentCompleted } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      let result;
      try {
        const invoiceId = String(body?.invoiceId || '');
        assertCashierInvoiceWritable(database, patientKey, invoiceId, role);
        const paymentType = majorPaymentCategory(body?.paymentType || 'DIRECT');
        const profile = setFinanceProfile(database, patientKey, {
          paymentType,
          paymentSubtype: body?.paymentSubtype || 'FULL',
          discountAmount: body?.discountAmount ?? 0,
          discountPercent: body?.discountPercent ?? 0,
          discountCurrency: body?.discountCurrency || 'KHR',
          payerReference: body?.payerReference || '',
          note: body?.note || '',
          nssfSubtype: body?.nssfSubtype || '',
          payerName: body?.payerName || '',
          approvalId: body?.approvalId || '',
        }, session.user_id, Date.now(), invoiceId);
        const before = patientBill(database, patientKey, invoiceId);
        const payments = [];
        const activeCharges = before.charges.filter(c => !c.voidedAt);
        if (!activeCharges.length) throw Error('Add services before completing payment.');
        if (activeCharges.some(c => majorPaymentCategory(c.tariffPayer) !== paymentType)) {
          throw Error('Invoice services use another payment price list. Remove incorrect unpaid services and choose the correct payer list.');
        }
        if (paymentType === 'NSSF' && !profile.nssfSubtype) throw Error('Select the NSSF subtype.');
        if (paymentType !== 'DIRECT') {
          database.sqlite.prepare('UPDATE finance_invoices SET coverage_at=?,coverage_by=?,closed_at=? WHERE id=?').run(Date.now(), session.user_id, Date.now(), before.invoice.id);
        }
        for (const currency of ['KHR', 'USD']) {
          const amount = Number(before.summary?.[currency]?.balance || 0);
          if (amount <= 0 || paymentType !== 'DIRECT') continue;
          payments.push(addPayment(database, patientKey, {
            invoiceId: before.invoice?.id,
            source: 'CASH',
            purpose: body?.purpose || 'PATIENT_CARE',
            categoryCode: body?.categoryCode || '',
            serviceCode: body?.serviceCode || '',
            amount,
            currency,
            reference: body?.reference || '',
            note: body?.paymentNote || '',
            receivedAt: body?.receivedAt,
          }, session.user_id));
        }
        const bill = patientBill(database, patientKey, before.invoice?.id || invoiceId);
        const settled = Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0) <= 0 && Number(bill?.summary?.KHR?.gross || 0) + Number(bill?.summary?.USD?.gross || 0) > 0;
        if (settled && bill.invoice?.id) {
          database.sqlite.prepare('UPDATE finance_invoices SET closed_at=COALESCE(closed_at,?) WHERE id=?').run(Date.now(), bill.invoice.id);
        }
        result = { profile, payments, bill, paymentStatus: paymentStatusForPatient(database, patientKey, bill.invoice?.id || invoiceId), invoices: listPatientInvoices(database, patientKey) };
        database.sqlite.exec('COMMIT');
      } catch (error) {
        try { database.sqlite.exec('ROLLBACK'); } catch {}
        throw error;
      }
      updateWorkflowStageAfterPayment(database, patientKey, { userId: session.user_id, role, invoiceId: result.bill?.invoice?.id || String(body?.invoiceId || '') });
      const settled = Boolean(result.bill?.invoice?.coverageAt) || Number(result.bill?.summary?.KHR?.balance || 0) + Number(result.bill?.summary?.USD?.balance || 0) <= 0 && Number(result.bill?.summary?.KHR?.gross || 0) + Number(result.bill?.summary?.USD?.gross || 0) > 0;
      if (settled) {
        try { notifyOpdDoctorsPaymentCompleted(database, session, patient, result.bill, result.payments); } catch {}
      }
      audit(database, request, 'FINANCE_PAYMENT_COMPLETED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, paymentIds: result.payments.map(item => item.id), paymentStatus: result.paymentStatus?.code || '' } });
      return sendJson(response, 201, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post(/^\/api\/finance\/payments\/([0-9a-f-]+)\/attachments$/, async (ctx) => {
    const { request, response, session, config, database, sendJson, readBinary, audit, requireContext, safeAttachmentName, routeParams } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK'].includes(role)) {
      return sendJson(response, 403, { error: 'Billing access is required.' }, { secure: config.cookieSecure });
    }
    const paymentId = routeParams[1];
    const payment = getFinancePayment(database, paymentId);
    if (!payment) return sendJson(response, 404, { error: 'Payment not found.' }, { secure: config.cookieSecure });
    const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const extensionByType = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
    const extension = extensionByType[contentType];
    if (!extension) return sendJson(response, 415, { error: 'Only PDF, JPEG and PNG attachments are allowed.' }, { secure: config.cookieSecure });
    const bytes = await readBinary(request, 12 * 1024 * 1024);
    if (!bytes.length) return sendJson(response, 400, { error: 'Attachment is empty.' }, { secure: config.cookieSecure });
    const uploadRoot = path.join(path.dirname(config.databasePath), 'uploads', 'finance', payment.id);
    fs.mkdirSync(uploadRoot, { recursive: true });
    const storagePath = path.join(uploadRoot, `${crypto.randomUUID()}${extension}`);
    fs.writeFileSync(storagePath, bytes, { flag: 'wx' });
    const attachment = addPaymentAttachment(database, payment.id, { filename: safeAttachmentName(request.headers['x-file-name']), contentType, storagePath, userId: session.user_id });
    audit(database, request, 'FINANCE_PAYMENT_ATTACHMENT_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { paymentId: payment.id, attachmentId: attachment.id, patientKey: payment.patient_key } });
    return sendJson(response, 201, { attachment }, { secure: config.cookieSecure });
  });

  router.get(/^\/api\/finance\/payment-attachments\/([0-9a-f-]+)$/, async (ctx) => {
    const { response, session, config, database, sendJson, sendFile, redirect, requireContext, routeParams } = ctx;
    if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'ACCOUNTANT', 'CLERK', 'DIRECTOR', 'VICE_DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Finance access is required.' }, { secure: config.cookieSecure });
    }
    const attachmentId = routeParams[1];
    const attachment = getPaymentAttachment(database, attachmentId);
    if (!attachment) return sendJson(response, 404, { error: 'Attachment not found.' }, { secure: config.cookieSecure });
    return sendFile(response, attachment.storage_path, attachment.content_type, { secure: config.cookieSecure }, false);
  });

  router.get('/api/finance/expenses', async (ctx) => {
    const { response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'ACCOUNTANT'].includes(role)) {
      return sendJson(response, 403, { error: 'Accounting access is required.' }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, { expenses: listExpenses(database) }, { secure: config.cookieSecure });
  });

  router.post('/api/finance/expenses', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT'].includes(role)) {
      return sendJson(response, 403, { error: 'Accounting access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const validExpense = validate(body, Schemas.expense);
    if (!validExpense.valid) return sendJson(response, 400, { error: validExpense.error, details: validExpense.errors }, { secure: config.cookieSecure });
    try {
      const expense = addExpense(database, validExpense.data, session.user_id);
      audit(database, request, 'FINANCE_EXPENSE_RECORDED', { userId: session.user_id, subjectUsername: session.username, details: { expenseId: expense.id, amount: expense.amount, currency: expense.currency, category: expense.category } });
      return sendJson(response, 201, { expense }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/finance/void', async (ctx) => {
    const { request, response, session, config, database, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'ACCOUNTANT', 'CLERK'].includes(role)) {
      return sendJson(response, 403, { error: 'Accounting access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const validVoid = validate(body, Schemas.voidFinance);
    if (!validVoid.valid) return sendJson(response, 400, { error: validVoid.error, details: validVoid.errors }, { secure: config.cookieSecure });
    if (role === 'CLERK' && validVoid.data.kind !== 'charge') {
      return sendJson(response, 403, { error: 'Cashiers can delete unpaid service fees only.' }, { secure: config.cookieSecure });
    }
    try {
      if (validVoid.data.kind === 'payment') {
        const payment = getFinancePayment(database, String(validVoid.data.id || ''));
        if (payment) assertCashierInvoiceWritable(database, payment.patient_key || payment.patientKey, payment.invoice_id || payment.invoiceId, role);
      }
      const ok = voidFinanceItem(database, validVoid.data.kind, validVoid.data.id, validVoid.data.reason, session.user_id, Date.now(), { unpaidOnly: true });
      if (!ok) return sendJson(response, 404, { error: 'Finance item was not found or is already void.' }, { secure: config.cookieSecure });
      audit(database, request, 'FINANCE_ITEM_VOIDED', { userId: session.user_id, subjectUsername: session.username, details: { kind: validVoid.data.kind, id: validVoid.data.id } });
      return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/cashflow', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Hospital Director or Administrator access is required.' }, { secure: config.cookieSecure });
    }
    try {
      const month = url.searchParams.get('month');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      return sendJson(response, 200, cashflowRange(database, { month, startDate, endDate }), { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/monthly-service-report', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Hospital Director or Administrator access is required.' }, { secure: config.cookieSecure });
    }
    try {
      const month = url.searchParams.get('month');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      return sendJson(response, 200, serviceRevenueRange(database, { month, startDate, endDate }), { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.get('/api/finance/cashflow-day', async (ctx) => {
    const { url, response, session, config, database, sendJson, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Hospital Director or Administrator access is required.' }, { secure: config.cookieSecure });
    }
    try {
      return sendJson(response, 200, cashflowDayDetails(database, url.searchParams.get('date')), { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });
}
