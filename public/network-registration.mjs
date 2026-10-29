import {api} from './network-ui.mjs';
export async function registerRemotePatient(peerId,patientKey){
 const result=await api('/api/emr-network/registration-draft',{peerId,patientKey});
 const url=new URL(result.url,location.origin);if(url.origin!==location.origin||url.pathname!=='/emr')throw Error('មិនមានសិទ្ធិ');
 location.assign(url.href);
}
