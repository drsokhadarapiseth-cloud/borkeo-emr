import { uploadDirectory } from '../config.mjs';
// v41.7 - /api/record-access-log (printing and export reported by the page;
// viewer for management) and /api/patient-documents (scanned documents).
import os from 'node:os';
import path from 'node:path';
import {
  DOCUMENT_WRITE_ROLES, RECORD_LOG_VIEW_ROLES, addDocument, getDocument, listDocuments, listRecordAccess,
  logFromContext, removeDocument,
} from '../record-access.mjs';

export function mountRecordAccessRoutes(router) {
  const fail = (ctx, status, error) => ctx.sendJson(ctx.response, status, { error }, { secure: ctx.config.cookieSecure });

  function patientFor(ctx, patientKey, roles) {
    const { session, database, requireContext, clinicalPatientKey, canAccessPatient } = ctx;
    if (!session) { fail(ctx, 401, 'Authentication required.'); return null; }
    let role;
    try { role = requireContext(session); } catch (error) { fail(ctx, error.status || 409, error.message); return null; }
    if (roles && !roles.has(role)) { fail(ctx, 403, 'Your role cannot do this.'); return null; }
    const row = database.findPatient(clinicalPatientKey(patientKey));
    if (!row || !canAccessPatient(database, session, row)) { fail(ctx, 404, 'Patient not found.'); return null; }
    return { row, role };
  }

  // The page reports a print or an export of the open record.
  router.post('/api/record-access-log', async (ctx) => {
    const body = await ctx.readJson(ctx.request, 5_000);
    const found = patientFor(ctx, body?.patientKey);
    if (!found) return true;
    const action = ['print', 'export'].includes(body?.action) ? body.action : null;
    if (!action) return fail(ctx, 400, 'Action is invalid.');
    logFromContext(ctx, found.row, action, String(body?.detail || ''));
    return ctx.sendJson(ctx.response, 201, { ok: true }, { secure: ctx.config.cookieSecure });
  });

  router.get('/api/record-access-log', async (ctx) => {
    const { session, requireContext, url } = ctx;
    if (!session) return fail(ctx, 401, 'Authentication required.');
    if (!RECORD_LOG_VIEW_ROLES.has(requireContext(session))) return fail(ctx, 403, 'Administrator or Director access is required.');
    const filters = Object.fromEntries(['patient', 'user', 'action', 'from', 'to', 'limit'].map((name) => [name, url.searchParams.get(name) || '']));
    return ctx.sendJson(ctx.response, 200, { entries: listRecordAccess(ctx.database, filters) }, { secure: ctx.config.cookieSecure });
  });

  router.get('/api/patient-documents', async (ctx) => {
    const found = patientFor(ctx, ctx.url.searchParams.get('patientKey'), ctx.clinicalFormReadRoles);
    if (!found) return true;
    return ctx.sendJson(ctx.response, 200, { documents: listDocuments(ctx.database, found.row.patient_key), canUpload: DOCUMENT_WRITE_ROLES.has(found.role) },
      { secure: ctx.config.cookieSecure });
  });

  // Upload: the file is the request body; patientKey, title and category are in the query string.
  router.post('/api/patient-documents', async (ctx) => {
    const { request, session, database, config, url, readBinary, audit } = ctx;
    const found = patientFor(ctx, url.searchParams.get('patientKey'), DOCUMENT_WRITE_ROLES);
    if (!found) return true;
    try {
      const bytes = await readBinary(request, 10 * 1024 * 1024 + 1);
      const document = addDocument(database, {
        // Next to the database (data/uploads/patients); a test database in memory uses a temporary folder.
        uploadRoot: config.dataDirectory ? uploadDirectory(config, 'patients')
          : path.join(config.databasePath === ':memory:' ? path.join(os.tmpdir(), 'borkeo-test-uploads') : path.dirname(config.databasePath), 'uploads', 'patients'),
        patientKey: found.row.patient_key, session, bytes,
        declaredType: String(request.headers['content-type'] || '').split(';')[0].trim(),
        // The page sends the name URI-encoded (Khmer file names); decode, then clean.
        filename: (ctx.safeAttachmentName || String)((() => { try { return decodeURIComponent(String(request.headers['x-file-name'] || '')); } catch { return String(request.headers['x-file-name'] || ''); } })()),
        title: url.searchParams.get('title'), category: url.searchParams.get('category'),
      });
      audit(database, request, 'PATIENT_DOCUMENT_UPLOADED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, documentId: document.id, contentType: document.contentType, sizeBytes: document.sizeBytes } });
      return ctx.sendJson(ctx.response, 201, { document, documents: listDocuments(database, found.row.patient_key) }, { secure: config.cookieSecure });
    } catch (error) {
      return fail(ctx, error.status || 400, error.status === 413 || /too large/i.test(error.message) ? 'The file is larger than 10 MB.' : error.message);
    }
  });

  router.get(/^\/api\/patient-documents\/([0-9a-f-]{36})\/file$/, async (ctx) => {
    const { database, request, session, sendFile, response, config, routeParams, audit } = ctx;
    const document = getDocument(database, routeParams[1]);
    if (!document) return fail(ctx, 404, 'Document not found.');
    const found = patientFor(ctx, document.patient_key, ctx.clinicalFormReadRoles);
    if (!found) return true;
    logFromContext(ctx, found.row, 'document', `${document.title} (${document.filename})`);
    audit(database, request, 'PATIENT_DOCUMENT_VIEWED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, documentId: document.id } });
    return sendFile(response, document.storage_path, document.content_type, { secure: config.cookieSecure }, false);
  });

  router.post(/^\/api\/patient-documents\/([0-9a-f-]{36})\/remove$/, async (ctx) => {
    const { request, session, database, config, readJson, audit, routeParams } = ctx;
    const body = await readJson(request, 5_000);
    const found = patientFor(ctx, body?.patientKey, DOCUMENT_WRITE_ROLES);
    if (!found) return true;
    try {
      if (!removeDocument(database, { patientKey: found.row.patient_key, id: routeParams[1], session, reason: body?.reason })) return fail(ctx, 404, 'Document not found or already removed.');
    } catch (error) { return fail(ctx, 400, error.message); }
    audit(database, request, 'PATIENT_DOCUMENT_REMOVED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, documentId: routeParams[1] } });
    return ctx.sendJson(ctx.response, 200, { documents: listDocuments(database, found.row.patient_key) }, { secure: config.cookieSecure });
  });
}
