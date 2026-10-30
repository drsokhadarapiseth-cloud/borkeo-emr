// Patient data crosses only the extension's message channel, never window.opener.
(function () {
  'use strict';
  if (window.__borkeoPmrs2ButtonAdded) return;
  window.__borkeoPmrs2ButtonAdded = true;
  const button = document.createElement('button');
  button.id = 'borkeo-pmrs2-send'; button.type = 'button';
  button.textContent = 'បញ្ជូនទៅ Borkeo';
  button.style.cssText = 'position:fixed;z-index:2147483647;right:18px;bottom:18px;background:#0b7895;color:#fff;border:0;border-radius:24px;padding:12px 20px;font:600 14px sans-serif;cursor:pointer';
  const status = document.createElement('p');
  status.id = 'borkeo-pmrs2-status'; status.setAttribute('role', 'status');
  status.style.cssText = 'position:fixed;z-index:2147483647;right:18px;bottom:66px;max-width:min(420px,90vw);padding:12px;border-radius:8px;background:#eef8fb;color:#123c51;white-space:pre-wrap;font:14px/1.8 sans-serif';
  status.textContent = 'កម្មវិធីជំនួយ ' + chrome.runtime.getManifest().version;
  document.body.append(status, button);
  const labels = { opened:'បានបើកទម្រង់ចុះឈ្មោះ។ កំពុងរង់ចាំប្រព័ន្ធ។', login:'សូមចូលគណនីក្នុងផ្ទាំង Borkeo ដែលបានបើក។', ready:'កំពុងរង់ចាំទម្រង់ចុះឈ្មោះ។', applying:'កំពុងបញ្ចូលព័ត៌មានទៅទម្រង់។', filled:'បានបញ្ចូលព័ត៌មានទៅទម្រង់។ សូមពិនិត្យមុនរក្សាទុក។', failed:'មិនអាចបញ្ចូលព័ត៌មានបានទេ។ សូមពិនិត្យសារក្នុងផ្ទាំង Borkeo។' };
  const message = data => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(data, response => chrome.runtime.lastError ? reject(Error('extension')) : resolve(response));
  });
  let polling;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const payload = scrapePmrs2(document);
    if (!payload.fullName && !payload.healthId && !payload.caseNumber) {
      status.textContent = 'រកមិនឃើញឈ្មោះ ឬលេខសម្គាល់អ្នកជំងឺទេ។ សូមបើកទំព័រព័ត៌មានអ្នកជំងឺ ហើយសាកល្បងម្ដងទៀត។'; return;
    }
    button.disabled = true;
    try {
      const sent = await message({ type:'pmrs2-send', payload });
      if (!sent?.ok) throw Error(sent?.error || 'transfer');
      let checks = 0;
      const poll = async () => {
        try {
          const result = await message({ type:'pmrs2-status', id:sent.id });
          if (!result?.ok) throw Error('expired');
          status.textContent = (labels[result.stage] || labels.ready) + '\n' + chrome.runtime.getManifest().version;
          status.dataset.stage = result.stage;
          if (result.stage === 'filled') status.textContent += '\n' + result.fields + ' ព័ត៌មាន • ' + result.duplicates + ' អ្នកជំងឺអាចស្ទួន';
          if (['filled','failed'].includes(result.stage) || checks++ >= 600) { button.disabled = false; return; }
          polling = setTimeout(poll, 1000);
        } catch { button.disabled = false; status.textContent = 'ការបញ្ជូនបានផុតកំណត់ ឬកម្មវិធីជំនួយបានប្ដូរ។ សូមផ្ទុកទំព័រឡើងវិញ។'; }
      };
      poll();
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message === 'busy' ? 'មានការបញ្ជូនអ្នកជំងឺម្នាក់ទៀតកំពុងដំណើរការ។ សូមបញ្ចប់ការបញ្ជូននោះមុន។' : error.message === 'target' ? 'សូមកំណត់អាសយដ្ឋាន Borkeo ក្នុងកម្មវិធីជំនួយឱ្យបានត្រឹមត្រូវ។' : 'មិនអាចបញ្ជូនបានទេ។ សូមផ្ទុកកម្មវិធីជំនួយ និងទំព័រឡើងវិញ។';
    }
  });
  window.addEventListener('pagehide', () => clearTimeout(polling), { once:true });
})();
