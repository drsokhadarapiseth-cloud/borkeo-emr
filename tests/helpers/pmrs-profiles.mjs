// Synthetic configuration only. Never use this as a live PMRS profile.
import {PMRS_ORIGIN} from '../../server/pmrs/playwright.mjs';
export function syntheticImportProfile(){return {
  origin:PMRS_ORIGIN,automationAuthorized:true,selectorsVerified:true,
  verifiedAt:'2026-10-31',verificationReference:'Synthetic read-only fixture',
  authenticated:{selector:'#signed-in'},patientId:{selector:'#patient'},encounterId:{selector:'#encounter'},
  read:{'registration.fullName':{selector:'#name'},'clinical.diagnosisText':{selector:'#diagnosis',kind:'input'}}
};}
export function syntheticExportProfile(){return {...syntheticImportProfile(),
  exportVerified:true,exportVerifiedAt:'2026-10-31',exportVerificationReference:'Synthetic export fixture',
  save:{selector:'#save'},receipt:{selector:'#receipt'},submission:{path:'/synthetic-save',method:'POST'},
  write:{'clinical.diagnosisText':{selector:'#diagnosis',kind:'input'}}
};}
