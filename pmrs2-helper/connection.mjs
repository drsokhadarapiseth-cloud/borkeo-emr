const SOURCE = 'https://pmrs.digitalsp.gov.kh';
const TTL = 600000;
const KEYS = new Set(['fullName', 'sex', 'dob', 'age', 'phone', 'healthId', 'caseNumber', 'equityCard', 'province', 'district', 'commune', 'village', 'street', 'entryType', 'caregiverName', 'caregiverPhone', 'caregiverRelation']);
export function receivingOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('target');
  return url.origin;
}
export function patientPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('patient');
  const payload = {};
  for (const [key, value] of Object.entries(input)) {
    if (!KEYS.has(key)) continue;
    if (typeof value !== 'string' || value.length > 1000) throw Error('patient');
    const text = value.normalize('NFC').trim();
    if (text) payload[key] = text;
  }
  if (!payload.fullName && !payload.healthId && !payload.caseNumber) throw Error('patient');
  if (payload.age) {
    const age = payload.age.replace(/[០-៩]/g, c => String(c.charCodeAt(0) - 0x17e0)).match(/^(\d{1,3})(?:\s*(?:ឆ្នាំ|years?))?$/iu);
    if (age && Number(age[1]) <= 130) payload.age = age[1]; else delete payload.age;
  }
  return payload;
}

// Runs only in the extension worker. Patient data stays in browser-session
// storage, never on disk in local storage or inside a URL.
export class TransferBridge {
  constructor(browser) { this.browser = browser; }
  async handle(message, sender) {
    const api = this.browser;
    if (sender.frameId !== 0 || !sender.tab?.id) throw Error('sender');
    const origin = new URL(sender.url).origin;
    const saved = await api.storage.session.get({ pmrs2Transfers: {} });
    const records = Object.fromEntries(Object.entries(saved.pmrs2Transfers).filter(([, item]) => Date.now() - item.at < TTL));
    const store = () => api.storage.session.set({ pmrs2Transfers: records });
    if (message.type === 'pmrs2-send') {
      if (origin !== SOURCE) throw Error('sender');
      const payload = patientPayload(message.payload);
      const pending = Object.values(records).find(item => item.sourceTabId === sender.tab.id && !['filled', 'failed'].includes(item.stage));
      if (pending) {
        if (JSON.stringify(pending.payload) !== JSON.stringify(payload)) throw Error('busy');
        return { ok: true, id: pending.id, stage: pending.stage };
      }
      for (const [id, item] of Object.entries(records)) if (item.sourceTabId === sender.tab.id) delete records[id];
      const cfg = await api.storage.local.get({ borkeoBaseUrl: 'http://127.0.0.1:3001' });
      const target = receivingOrigin(cfg.borkeoBaseUrl);
      const id = crypto.randomUUID();
      const item = { id, payload, origin: target, sourceTabId: sender.tab.id, targetTabId: null, at: Date.now(), stage: 'opened' };
      records[id] = item;
      const tab = await api.tabs.create({ url: target + '/emr?view=register&pmrs2Import=1', active: true });
      item.targetTabId = tab.id;
      await store();
      return { ok: true, id, stage: item.stage };
    }
    const item = message.type === 'pmrs2-status'
      ? records[message.id]
      : Object.values(records).find(item => item.targetTabId === sender.tab.id && item.origin === origin);
    if (!item) { await store(); return { ok: false, error: 'expired' }; }
    if (message.type === 'pmrs2-status') {
      if (origin !== SOURCE || item.sourceTabId !== sender.tab.id) throw Error('sender');
      return { ok: true, id: item.id, stage: item.stage, fields: item.fields || 0, duplicates: item.duplicates || 0, reason: item.reason || '' };
    }
    if (message.type === 'pmrs2-pending') return item.payload ? { ok: true, id: item.id, payload: item.payload } : { ok: false };
    if (message.type === 'pmrs2-navigate') {
      if (item.redirected) { item.stage='failed'; item.reason='form'; await store(); return {ok:false}; }
      item.redirected=true; await store(); return {ok:true};
    }
    if (message.type === 'pmrs2-stage' && message.id === item.id) {
      if (!['login', 'ready', 'applying', 'filled', 'failed'].includes(message.stage)) throw Error('stage');
      if (item.stage === 'filled') return { ok: true };
      item.stage = message.stage;
      item.reason = ['module', 'record', 'form', 'apply'].includes(message.reason) ? message.reason : '';
      if (message.stage === 'filled') {
        item.fields = Number.isSafeInteger(message.fields) ? Math.max(0, message.fields) : 0;
        item.duplicates = Number.isSafeInteger(message.duplicates) ? Math.max(0, message.duplicates) : 0;
        delete item.payload;
      }
      await store(); return { ok: true };
    }
    throw Error('message');
  }
}
