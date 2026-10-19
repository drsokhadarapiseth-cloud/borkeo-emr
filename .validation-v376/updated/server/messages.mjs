import crypto from 'node:crypto';

const MESSAGE_TYPES = new Set(['WARD','LAB','IMAGING','PHARMACY','ADMIN','DIRECTOR','TRIAGE','REGISTRATION','CLERK','ACCOUNTANT']);

function addColumnIfMissing(sqlite, table, column, definition) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function ensureMessagingSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS staff_messages (
      id TEXT PRIMARY KEY,
      sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL DEFAULT '',
      sender_ward_code TEXT NOT NULL DEFAULT '',
      destination_type TEXT NOT NULL,
      destination_code TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      patient_key TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS staff_messages_destination_idx
      ON staff_messages(destination_type, destination_code, created_at DESC);
    CREATE INDEX IF NOT EXISTS staff_messages_sender_idx
      ON staff_messages(sender_user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS staff_message_reads (
      message_id TEXT NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, user_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS staff_message_completions (
      message_id TEXT NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
      recipient_group TEXT NOT NULL,
      completed_by TEXT NOT NULL REFERENCES users(id),
      completed_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, recipient_group)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS staff_message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES staff_messages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      uploaded_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS staff_message_attachment_idx
      ON staff_message_attachments(message_id, uploaded_at);
  `);
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
    id TEXT PRIMARY KEY, message_id TEXT NOT NULL UNIQUE REFERENCES staff_messages(id),
    patient_key TEXT NOT NULL, patient_version INTEGER NOT NULL, fingerprint TEXT NOT NULL,
    submitted_by TEXT NOT NULL REFERENCES users(id), submitted_at INTEGER NOT NULL, snapshot_json TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS pharmacy_prescriptions_patient_idx ON pharmacy_prescriptions(patient_key,submitted_at);`);
  addColumnIfMissing(database.sqlite,'pharmacy_prescriptions','dispensed_at','INTEGER');
  addColumnIfMissing(database.sqlite,'pharmacy_prescriptions','dispensed_by','TEXT');
  addColumnIfMissing(database.sqlite, 'staff_messages', 'destination_role', "TEXT NOT NULL DEFAULT ''");
}

function cleanText(value, maximum) {
  return String(value ?? '').trim().slice(0, maximum);
}

function messageRow(database, row, viewerId = '') {
  if (!row) return null;
  const attachments = database.sqlite.prepare(`SELECT id, filename, content_type, uploaded_at
    FROM staff_message_attachments WHERE message_id=? ORDER BY uploaded_at`).all(row.id);
  const read = viewerId ? database.sqlite.prepare(`SELECT read_at FROM staff_message_reads WHERE message_id=? AND user_id=?`).get(row.id, viewerId) : null;
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderName: row.sender_name || '',
    senderRole: row.sender_role || '',
    senderWardCode: row.sender_ward_code || '',
    destinationType: row.destination_type,
    destinationCode: row.destination_code || '',
    destinationRole: row.destination_role || '',
    subject: row.subject || '',
    body: row.body || '',
    patientKey: row.patient_key || '',
    prescriptionId: database.sqlite.prepare('SELECT id FROM pharmacy_prescriptions WHERE message_id=?').get(row.id)?.id || null,
    createdAt: row.created_at,
    readAt: read?.read_at || null,
    attachments: attachments.map(item => ({
      id: item.id, filename: item.filename, contentType: item.content_type, uploadedAt: item.uploaded_at,
    })),
  };
}

export function createStaffMessage(database, values) {
  const destinationType = String(values.destinationType || '').toUpperCase();
  if (!MESSAGE_TYPES.has(destinationType)) throw new Error('Message destination is invalid.');
  const destinationCode = cleanText(values.destinationCode, 80).toLowerCase();
  if (destinationType === 'WARD' && !destinationCode) throw new Error('Choose a ward destination.');
  const subject = cleanText(values.subject, 180);
  const body = cleanText(values.body, 5000);
  if (!subject && !body) throw new Error('Enter a subject or message.');
  const id = crypto.randomUUID();
  const now = Date.now();
  const destinationRole = destinationType === 'WARD' ? cleanText(values.destinationRole, 40).toUpperCase() : '';
  database.sqlite.prepare(`INSERT INTO staff_messages
    (id,sender_user_id,sender_role,sender_ward_code,destination_type,destination_code,destination_role,subject,body,patient_key,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, values.senderUserId, cleanText(values.senderRole, 40), cleanText(values.senderWardCode, 80).toLowerCase(),
      destinationType, destinationType === 'WARD' ? destinationCode : destinationType.toLowerCase(), destinationRole,
      subject, body, cleanText(values.patientKey, 220), now,
    );
  return getStaffMessage(database, id, values.senderUserId);
}

export function createSystemMessage(database, values) {
  return createStaffMessage(database, values);
}

export function getStaffMessage(database, id, viewerId = '') {
  const row = database.sqlite.prepare(`SELECT m.*, u.display_name AS sender_name
    FROM staff_messages m JOIN users u ON u.id=m.sender_user_id WHERE m.id=?`).get(id);
  return messageRow(database, row, viewerId);
}

export function messageRecipientGroup(visibility) {
  const role = String(visibility.role || '').toUpperCase();
  if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return 'MANAGEMENT';
  if (['LAB','IMAGING','PHARMACY','TRIAGE','REGISTRATION','CLERK','ACCOUNTANT'].includes(role)) return role;
  return `WARD:${String(visibility.wardCode || '').toLowerCase()}:${role}`;
}

function recipientFilter(visibility) {
  const role = String(visibility.role || '').toUpperCase();
  if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return { sql: "m.destination_type IN ('ADMIN','DIRECTOR')", args: [] };
  if (['LAB','IMAGING','PHARMACY','TRIAGE','REGISTRATION','CLERK','ACCOUNTANT'].includes(role)) return { sql: 'm.destination_type=?', args: [role] };
  return { sql: "m.destination_type='WARD' AND m.destination_code=? AND (m.destination_role='' OR m.destination_role=?)",
    args: [String(visibility.wardCode || '').toLowerCase(), role] };
}

export function completeStaffMessage(database, messageId, visibility, completedAt = Date.now()) {
  const filter = recipientFilter(visibility);
  // Being the sender is sufficient to read, but never to complete another team's task.
  if (!database.sqlite.prepare(`SELECT m.id FROM staff_messages m WHERE m.id=? AND ${filter.sql}`).get(messageId, ...filter.args)) return null;
  const group = messageRecipientGroup(visibility);
  database.sqlite.prepare(`INSERT INTO staff_message_completions(message_id,recipient_group,completed_by,completed_at)
    VALUES (?,?,?,?) ON CONFLICT(message_id,recipient_group) DO NOTHING`).run(messageId, group, visibility.userId, completedAt);
  return database.sqlite.prepare(`SELECT c.completed_at AS completedAt,c.completed_by AS completedBy,u.display_name AS completedByName
    FROM staff_message_completions c JOIN users u ON u.id=c.completed_by WHERE c.message_id=? AND c.recipient_group=?`).get(messageId, group);
}

export function completePatientMessages(database, patientKey, visibility, options = {}) {
  if (!patientKey) return 0;
  const filter = recipientFilter(visibility);
  const cutoff = options.before ?? Date.now();
  const rows = database.sqlite.prepare(`SELECT m.id,m.subject FROM staff_messages m WHERE m.patient_key=? AND m.created_at<=? AND ${filter.sql}`)
    .all(patientKey, cutoff, ...filter.args);
  let completed = 0;
  for (const row of rows) {
    if (options.subjectIncludes && !row.subject.includes(options.subjectIncludes)) continue;
    if (options.subjectPattern && !options.subjectPattern.test(row.subject)) continue;
    if (completeStaffMessage(database, row.id, visibility, cutoff)) completed++;
  }
  return completed;
}

export function pendingStaffMessageCount(database, visibility) {
  const filter=recipientFilter(visibility),group=messageRecipientGroup(visibility);
  return Number(database.sqlite.prepare(`SELECT COUNT(*) count FROM staff_messages m
    LEFT JOIN staff_message_completions c ON c.message_id=m.id AND c.recipient_group=?
    WHERE ${filter.sql} AND c.completed_at IS NULL`).get(group,...filter.args).count);
}

export function listStaffMessages(database, visibility, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 100);
  const sent = options.box === 'sent';
  const history = options.state === 'completed';
  const filter = recipientFilter(visibility);
  const group = messageRecipientGroup(visibility);
  const rows = database.sqlite.prepare(`SELECT m.*,u.display_name AS sender_name,
    c.completed_at,c.completed_by,actor.display_name AS completed_by_name
    FROM staff_messages m JOIN users u ON u.id=m.sender_user_id
    LEFT JOIN staff_message_completions c ON c.message_id=m.id AND c.recipient_group=?
    LEFT JOIN users actor ON actor.id=c.completed_by
    WHERE ${sent ? 'm.sender_user_id=?' : filter.sql + (history ? ' AND c.completed_at IS NOT NULL' : ' AND c.completed_at IS NULL')}
    ORDER BY m.created_at DESC,m.id LIMIT ?`).all(group, ...(sent ? [visibility.userId] : filter.args), limit);
  return rows.map(row => ({ ...messageRow(database,row,visibility.userId),
    completedAt: row.completed_at || null, completedBy: row.completed_by || null,
    completedByName: row.completed_by_name || '' }));
}

export function canViewStaffMessage(message, visibility) {
  if (!message) return false;
  if (message.senderUserId === visibility.userId) return true;
  const role = String(visibility.role || '').toUpperCase();
  if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) return ['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(message.destinationType);
  if (['LAB','IMAGING','PHARMACY','TRIAGE','REGISTRATION','CLERK','ACCOUNTANT'].includes(role)) return message.destinationType === role;
  return Boolean(visibility.wardCode) && message.destinationType === 'WARD' &&
    message.destinationCode === String(visibility.wardCode).toLowerCase() &&
    (!message.destinationRole || message.destinationRole === role);
}

export function markStaffMessageRead(database, messageId, userId) {
  const now = Date.now();
  database.sqlite.prepare(`INSERT INTO staff_message_reads(message_id,user_id,read_at) VALUES (?,?,?)
    ON CONFLICT(message_id,user_id) DO UPDATE SET read_at=excluded.read_at`).run(messageId, userId, now);
  return now;
}

export function addStaffMessageAttachment(database, messageId, values) {
  const id = crypto.randomUUID();
  const now = Date.now();
  database.sqlite.prepare(`INSERT INTO staff_message_attachments
    (id,message_id,filename,content_type,storage_path,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)`).run(
      id, messageId, values.filename, values.contentType, values.storagePath, values.userId, now,
    );
  return { id, messageId, filename: values.filename, contentType: values.contentType, uploadedAt: now };
}

export function getStaffMessageAttachment(database, id) {
  return database.sqlite.prepare(`SELECT a.*, m.sender_user_id, m.destination_type, m.destination_code
    FROM staff_message_attachments a JOIN staff_messages m ON m.id=a.message_id WHERE a.id=?`).get(id) || null;
}
