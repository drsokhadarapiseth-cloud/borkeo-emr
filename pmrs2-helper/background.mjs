import { TransferBridge } from './connection.mjs';
const bridge = new TransferBridge(chrome);
let queue = Promise.resolve();
// Serialize requests so a newly opened tab cannot race its transfer registration.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message?.type?.startsWith('pmrs2-')) return;
  queue = queue.then(() => bridge.handle(message, sender)).then(respond, error => respond({ ok: false, error: ['target', 'patient', 'sender', 'stage', 'busy'].includes(error.message) ? error.message : 'transfer' }));
  return true;
});
// Remove patient details left by versions that used persistent local storage.
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove(['pmrs2Payload', 'pmrs2PayloadAt', 'pmrs2TransferId', 'pmrs2TargetOrigin']));
