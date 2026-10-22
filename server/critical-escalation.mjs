// v41.6 - Critical result escalation: a released lab / imaging result with a
// critical value that nobody has acknowledged after the configured time
// (server/clinical-options.json "criticalEscalation", default 30 minutes) is
// sent once to the patient's ward: the doctors' shared inbox and the ward head.
// The existing acknowledgement (critical_ack_at) is not changed; acknowledging
// later simply stops further escalation.
import { createStaffMessage } from './messages.mjs';

export function ensureCriticalEscalationSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS critical_result_escalations (
    order_id TEXT NOT NULL, released_at INTEGER NOT NULL, escalated_at INTEGER NOT NULL,
    ward_code TEXT NOT NULL DEFAULT '', message_ids_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (order_id, released_at)
  ) STRICT;`);
}

// Approved Khmer for "Critical result escalation" (RULE 2).
const SUBJECT = 'ការជូនដំណឹងបន្ទាន់អំពីលទ្ធផលគ្រោះថ្នាក់';

export function escalateCriticalResults(database, { minutes = 30, roles = ['DOCTOR', 'CHIEF_WARD'], now = Date.now() } = {}) {
  if (!(minutes > 0)) return [];
  const due = database.sqlite.prepare(`SELECT o.* FROM paraclinic_orders o
    LEFT JOIN critical_result_escalations e ON e.order_id=o.id AND e.released_at=o.released_at
    WHERE o.has_critical=1 AND o.released_at IS NOT NULL AND o.critical_ack_at IS NULL AND o.cancelled_at IS NULL
      AND o.released_at<=? AND e.order_id IS NULL`).all(now - minutes * 60_000);
  const sent = [];
  for (const order of due) {
    const patient = database.sqlite.prepare('SELECT full_name, case_number, department_code FROM patient_records WHERE patient_key=?').get(order.patient_key) || {};
    const ward = String(patient.department_code || order.requested_ward || '').toLowerCase();
    const sender = order.validated_by || order.performed_by || order.requested_by;
    const ids = [];
    if (ward && sender) {
      const request = (() => { try { return JSON.parse(order.request_json || '{}'); } catch { return {}; } })();
      const tests = (Array.isArray(request.tests) ? request.tests : Array.isArray(request.items) ? request.items : [])
        .map((t) => (typeof t === 'string' ? t : t?.name || t?.code || '')).filter(Boolean).slice(0, 6).join(', ');
      const waited = Math.round((now - order.released_at) / 60_000);
      for (const role of roles) {
        try {
          const message = createStaffMessage(database, {
            senderUserId: sender, senderRole: order.modality === 'LAB' ? 'LAB' : 'IMAGING', senderWardCode: '',
            destinationType: 'WARD', destinationCode: ward, destinationRole: role,
            subject: `${SUBJECT} · ${patient.full_name || order.patient_key}`,
            body: [patient.full_name, patient.case_number, order.modality, tests, `${waited} min`].filter(Boolean).join(' · '),
            patientKey: order.patient_key,
          });
          ids.push(message.id);
        } catch { /* a message that cannot be sent is not retried in a loop */ }
      }
    }
    database.sqlite.prepare('INSERT INTO critical_result_escalations (order_id, released_at, escalated_at, ward_code, message_ids_json) VALUES (?,?,?,?,?)')
      .run(order.id, order.released_at, now, ward, JSON.stringify(ids));
    sent.push({ orderId: order.id, ward, messages: ids.length });
  }
  return sent;
}
