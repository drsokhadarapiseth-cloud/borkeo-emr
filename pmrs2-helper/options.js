import { receivingOrigin } from './connection.mjs';
const input=document.getElementById('borkeoBaseUrl'),status=document.getElementById('saved');
document.getElementById('version').textContent=chrome.runtime.getManifest().version;
chrome.storage.local.get({borkeoBaseUrl:'http://127.0.0.1:3001'},cfg=>{input.value=cfg.borkeoBaseUrl;});
document.getElementById('save').addEventListener('click',()=>{
  let origin;
  try { origin=receivingOrigin(input.value.trim()); }
  catch { status.hidden=false;status.textContent='សូមបញ្ចូលអាសយដ្ឋានក្នុងកុំព្យូទ័រនេះ និងលេខច្រកឱ្យបានត្រឹមត្រូវ។';return; }
  chrome.storage.local.set({borkeoBaseUrl:origin},()=>{status.hidden=false;status.textContent=chrome.runtime.lastError?'មិនអាចរក្សាទុកបានទេ។':'បានរក្សាទុក';input.value=origin;});
});
