export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeError=e=>/[\u1780-\u17ff]/.test(e?.message||'')?e.message:'មិនអាចផ្ទុកទិន្នន័យបាន';
export async function api(url,body,{signal}={}){
 let csrf=window.emrSession?.csrfToken;if(body&&!csrf){const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(response.status===401){location.assign('/login');throw Error('មិនមានសិទ្ធិ')}csrf=(await response.json()).csrfToken}
 const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},body:body?JSON.stringify(body):undefined});
 const result=await response.json();if(!response.ok)throw Error(result.error||'មិនអាចផ្ទុកទិន្នន័យបាន');return result;
}
