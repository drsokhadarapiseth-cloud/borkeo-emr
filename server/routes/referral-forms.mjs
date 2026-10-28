import {networkLocal} from '../emr-network.mjs';
import {referralAccess,latestReferral,referralDefaults,saveReferral} from '../referral-forms.mjs';
import {getESignature} from '../esign.mjs';
export function mountReferralFormRoutes(router){
 router.get('/api/referral-form',async ctx=>{
  const key=String(ctx.url.searchParams.get('patientKey')||''),{row,canEdit}=referralAccess(ctx.database,ctx.session,key,ctx.opdConsultationPaymentConfirmed);
  const defaults=referralDefaults(row);if(networkLocal(ctx.database).managed)defaults.facility=networkLocal(ctx.database).name;
  if(row.department_code==='anc'){
   const visit=ctx.database.sqlite.prepare("SELECT * FROM anc_visits WHERE patient_key=? AND json_extract(referral_json,'$.signed.userId') IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(key);
   if(visit){const referral=JSON.parse(visit.referral_json),data=JSON.parse(visit.data_json);Object.assign(defaults,{reason:(referral.reasons||[]).join(' · '),treatment:referral.treatment||'',gestation:String(visit.ga_weeks||''),bp:data.bp||defaults.bp,pulse:data.pulse||defaults.pulse,temperature:data.temperature||defaults.temperature,spo2:data.spo2||defaults.spo2});}
  }
  return ctx.sendJson(ctx.response,200,{form:latestReferral(ctx.database,key),defaults,canEdit,savedSignature:canEdit?getESignature(ctx.database,ctx.session.user_id):null},{secure:ctx.config.cookieSecure});
 });
 router.post('/api/referral-form',async ctx=>{
  const body=await ctx.readJson(ctx.request,220000),key=String(body.patientKey||'');
  const form=saveReferral(ctx.database,ctx.session,key,body,ctx.opdConsultationPaymentConfirmed);
  ctx.audit(ctx.database,ctx.request,'REFERRAL_FORM_SAVED',{userId:ctx.session.user_id,details:{patientKey:key,revision:form.revision,signed:Boolean(form.signature)}});
  return ctx.sendJson(ctx.response,200,{form},{secure:ctx.config.cookieSecure});
 });
 router.post('/api/referral-form/print',async ctx=>{
  const body=await ctx.readJson(ctx.request,2000),key=String(body.patientKey||'');referralAccess(ctx.database,ctx.session,key,ctx.opdConsultationPaymentConfirmed);
  const form=latestReferral(ctx.database,key);if(!form?.signature||form.revision!==body.revision)return ctx.sendJson(ctx.response,409,{error:'សូមរក្សាទុក និងចុះហត្ថលេខាមុនបោះពុម្ព'},{secure:ctx.config.cookieSecure});
  ctx.audit(ctx.database,ctx.request,'REFERRAL_FORM_PRINTED',{userId:ctx.session.user_id,details:{patientKey:key,revision:form.revision}});
  return ctx.sendJson(ctx.response,200,{form},{secure:ctx.config.cookieSecure});
 });
}
