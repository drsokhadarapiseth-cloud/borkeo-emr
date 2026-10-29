import {openNetworkRecord} from './network-record-dialog.mjs?v=5060';import {safeError} from './network-ui.mjs';
const back=document.querySelector('[data-record-back]'),status=document.querySelector('[data-record-status]'),params=new URLSearchParams(location.search);
const leave=()=>history.length>1?history.back():location.assign('/patient-list');back.onclick=leave;
try{if(!params.get('peerId')||!params.get('patientKey'))throw Error('ទិន្នន័យមិនត្រឹមត្រូវ');await openNetworkRecord({peerId:params.get('peerId'),patient:{patientKey:params.get('patientKey'),fullName:''},trigger:back,onClose:leave})}catch(error){status.textContent=safeError(error)}
