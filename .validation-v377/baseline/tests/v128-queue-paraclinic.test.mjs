import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

test('v12.9 keeps queue boards service-specific with a 3-column 4-row public table and OPD queue hidden from TRIAGE', () => {
  const display = read('protected/queue-display.html');
  const displayJs = read('public/queue-display.js');
  const server = read('server/server.mjs');
  const session = read('public/emr-session.js');
  assert.match(display, /<span>ល\.រ<\/span><span>ឈ្មោះ<\/span><span id="display-place-header">/);
  assert.match(displayJs, /slice\(0,4\)/);
  assert.match(displayJs, /serviceParam/);
  assert.match(session, /role === 'TRIAGE'\) return \[\['\/requests'/);
  const triageBranch = session.match(/if \(role === 'TRIAGE'\) return \[(.*?)\];/s)?.[1] || '';
  assert.doesNotMatch(triageBranch, /\/opd-queue/);
  assert.match(server, /if \(!\['ADMIN','VICE_DIRECTOR','DIRECTOR'\]\.includes\(role\) && !\(role==='DOCTOR' && sessionWard\(session\)==='opd'\)\)/);
});

test('v12.9 exposes skip/re-call controls and paraclinic duplicate/delete protections', () => {
  const triage = read('public/triage.js');
  const opd = read('public/opd-queue.js');
  const para = read('public/paraclinic.js');
  const paraServer = read('server/paraclinic.mjs');
  const server = read('server/server.mjs');
  assert.match(triage, /queue-skip/);
  assert.match(opd, /queue-skip/);
  assert.match(server, /pathname === '\/api\/queue\/skip'/);
  assert.match(para, /hasExistingLabTest/);
  assert.match(para, /data-delete-order/);
  assert.match(paraServer, /ACTIVE_DUPLICATE_STATUSES/);
  assert.match(paraServer, /export function cancelOrder/);
  assert.match(server, /request\.method === 'DELETE' && orderMatch/);
});
