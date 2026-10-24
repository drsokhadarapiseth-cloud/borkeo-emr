import { uploadDirectory } from '../config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WARDS } from '../access.mjs';
import { MANAGEMENT } from '../requests.mjs';
import {
  createStaffMessage, getStaffMessage, canViewStaffMessage,
  listStaffMessages, pendingStaffMessageCount, completeStaffMessage,
  markStaffMessageRead, addStaffMessageAttachment, getStaffMessageAttachment
} from '../messages.mjs';
import { prescriptionForMessage } from '../pharmacy-prescriptions.mjs';

export function mountMessagesRoutes(router) {
  // 1. POST /api/messages/:id/reply
  router.post(/^\/api\/messages\/([0-9a-f-]+)\/reply$/, async (ctx) => {
    const {
      session, database, config, sendJson, readJson, match, request, audit,
      sessionRole, sessionWard, messagingVisibility, destinationExists
    } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const original = getStaffMessage(database, match[1], session.user_id);
    if (!original || !canViewStaffMessage(original, messagingVisibility(session))) {
      return sendJson(ctx.response, 404, { error: 'Message not found.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10000);
    if (!String(body?.body || '').trim()) {
      return sendJson(ctx.response, 400, { error: 'Reply text is required.' }, { secure: config.cookieSecure });
    }
    const type = original.senderWardCode ? 'WARD' : MANAGEMENT.includes(original.senderRole) ? 'ADMIN' : original.senderRole;
    if (!destinationExists(type, original.senderWardCode || '')) {
      return sendJson(ctx.response, 400, { error: 'This message has no reply destination.' }, { secure: config.cookieSecure });
    }
    try {
      const message = createStaffMessage(database, {
        senderUserId: session.user_id,
        senderRole: sessionRole(session),
        senderWardCode: sessionWard(session),
        destinationType: type,
        destinationCode: original.senderWardCode || '',
        patientKey: original.patientKey,
        subject: 'ឆ្លើយតប៖ ' + String(original.subject || '').slice(0, 140),
        body: String(body.body || '').trim(),
      });
      audit(database, request, 'WARD_MESSAGE_REPLY', { userId: session.user_id, details: { originalId: original.id, messageId: message.id } });
      return sendJson(ctx.response, 201, { message }, { secure: config.cookieSecure });
    } catch (e) {
      return sendJson(ctx.response, 400, { error: e.message }, { secure: config.cookieSecure });
    }
  });

  // 2. GET /api/messages/destinations
  router.get('/api/messages/destinations', async (ctx) => {
    const { session, requireContext, sendJson, response, config, messagingRoleAllowed } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const destinations = [
      { type: 'ADMIN', code: 'admin', nameKh: 'អ្នកគ្រប់គ្រងប្រព័ន្ធ', nameEn: 'Administrator' },
      { type: 'DIRECTOR', code: 'director', nameKh: 'នាយកមន្ទីរពេទ្យ', nameEn: 'Director' },
      ...WARDS.map(ward => ({ type: 'WARD', code: ward.code, nameKh: ward.nameKh, nameEn: ward.nameEn })),
      { type: 'PHARMACY', code: 'pharmacy', nameKh: 'ឱសថស្ថាន', nameEn: 'Pharmacy' },
      { type: 'LAB', code: 'lab', nameKh: 'មន្ទីរពិសោធន៍', nameEn: 'Laboratory' },
      { type: 'IMAGING', code: 'imaging', nameKh: 'រូបភាពវេជ្ជសាស្ត្រ', nameEn: 'Imaging' },
    ];
    return sendJson(response, 200, { destinations }, { secure: config.cookieSecure });
  });

  // 3. GET /api/messages
  router.get('/api/messages', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, url, messagingRoleAllowed, messagingVisibility } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const box = ['sent', 'direct'].includes(url.searchParams.get('box')) ? url.searchParams.get('box') : 'inbox';
    const limit = Number(url.searchParams.get('limit') || 30);
    const messages = listStaffMessages(database, messagingVisibility(session), { box, limit, state: url.searchParams.get('state') });
    return sendJson(response, 200, { messages, pendingCount: pendingStaffMessageCount(database, messagingVisibility(session)) }, { secure: config.cookieSecure });
  });

  // 4. POST /api/messages
  router.post('/api/messages', async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, readJson, request, audit,
      sessionWard, messagingRoleAllowed, destinationExists
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxClinicalBodyBytes);
    if (!destinationExists(body?.destinationType, body?.destinationCode)) {
      return sendJson(response, 400, { error: 'Message destination is invalid.' }, { secure: config.cookieSecure });
    }
    try {
      const message = createStaffMessage(database, {
        senderUserId: session.user_id, senderRole: role, senderWardCode: sessionWard(session),
        destinationType: body?.destinationType, destinationCode: body?.destinationCode,
        subject: body?.subject, body: body?.body, patientKey: body?.patientKey,
      });
      audit(database, request, 'STAFF_MESSAGE_SENT', {
        userId: session.user_id, subjectUsername: session.username,
        details: { messageId: message.id, destinationType: message.destinationType, destinationCode: message.destinationCode, patientKey: message.patientKey }
      });
      return sendJson(response, 201, { message }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 5. GET /api/messages/:id/prescription
  router.get(/^\/api\/messages\/([0-9a-f-]+)\/prescription$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, messagingVisibility } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    requireContext(session);
    const message = getStaffMessage(database, match[1], session.user_id);
    if (!message || !canViewStaffMessage(message, messagingVisibility(session))) {
      return sendJson(response, 404, { error: 'Prescription not found.' }, { secure: config.cookieSecure });
    }
    const prescription = prescriptionForMessage(database, message.id);
    if (!prescription) return sendJson(response, 404, { error: 'Prescription not found.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, { prescription }, { secure: config.cookieSecure });
  });

  // 6. POST /api/messages/:id/complete
  router.post(/^\/api\/messages\/([0-9a-f-]+)\/complete$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, request, audit, sessionWard, messagingRoleAllowed, messagingVisibility } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const completion = completeStaffMessage(database, match[1], messagingVisibility(session));
    if (!completion) return sendJson(response, 404, { error: 'Message is outside your recipient group.' }, { secure: config.cookieSecure });
    audit(database, request, 'STAFF_MESSAGE_COMPLETED', { userId: session.user_id, details: { messageId: match[1], role, ward: sessionWard(session) } });
    return sendJson(response, 200, { completion }, { secure: config.cookieSecure });
  });

  // 7. POST /api/messages/:id/read
  router.post(/^\/api\/messages\/([0-9a-f-]+)\/read$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, messagingRoleAllowed, messagingVisibility } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const message = getStaffMessage(database, match[1], session.user_id);
    if (!message || !canViewStaffMessage(message, messagingVisibility(session))) {
      return sendJson(response, 404, { error: 'Message not found.' }, { secure: config.cookieSecure });
    }
    const readAt = markStaffMessageRead(database, message.id, session.user_id);
    return sendJson(response, 200, { readAt }, { secure: config.cookieSecure });
  });

  // 8. POST /api/messages/:id/attachments
  router.post(/^\/api\/messages\/([0-9a-f-]+)\/attachments$/, async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, readBinary, request, audit, match,
      messagingRoleAllowed, safeAttachmentName
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const message = getStaffMessage(database, match[1], session.user_id);
    if (!message || message.senderUserId !== session.user_id) {
      return sendJson(response, 403, { error: 'Only the sender can attach files to this message.' }, { secure: config.cookieSecure });
    }
    const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const extensionByType = {
      'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'text/plain': '.txt',
      'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    const extension = extensionByType[contentType];
    if (!extension) return sendJson(response, 415, { error: 'Allowed attachments: PDF, JPG, PNG, TXT, DOC and DOCX.' }, { secure: config.cookieSecure });
    const bytes = await readBinary(request, 12 * 1024 * 1024);
    if (!bytes.length) return sendJson(response, 400, { error: 'Attachment is empty.' }, { secure: config.cookieSecure });
    const uploadRoot = uploadDirectory(config, 'messages', message.id);
    fs.mkdirSync(uploadRoot, { recursive: true });
    const storagePath = path.join(uploadRoot, `${crypto.randomUUID()}${extension}`);
    fs.writeFileSync(storagePath, bytes, { flag: 'wx' });
    const attachment = addStaffMessageAttachment(database, message.id, {
      filename: safeAttachmentName(request.headers['x-file-name']),
      contentType,
      storagePath,
      userId: session.user_id
    });
    audit(database, request, 'STAFF_MESSAGE_ATTACHMENT_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { messageId: message.id, attachmentId: attachment.id } });
    return sendJson(response, 201, { attachment }, { secure: config.cookieSecure });
  });

  // 9. GET /api/messages/attachments/:id
  router.get(/^\/api\/messages\/attachments\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, redirect, sendFile, match, messagingRoleAllowed, messagingVisibility } = ctx;
    if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!messagingRoleAllowed(role)) return sendJson(response, 403, { error: 'Messaging is not available for this role.' }, { secure: config.cookieSecure });
    const attachment = getStaffMessageAttachment(database, match[1]);
    if (!attachment) return sendJson(response, 404, { error: 'Attachment not found.' }, { secure: config.cookieSecure });
    const message = getStaffMessage(database, attachment.message_id, session.user_id);
    if (!canViewStaffMessage(message, messagingVisibility(session))) {
      return sendJson(response, 403, { error: 'You cannot view this attachment.' }, { secure: config.cookieSecure });
    }
    return sendFile(response, attachment.storage_path, attachment.content_type, { secure: config.cookieSecure }, false);
  });
}
