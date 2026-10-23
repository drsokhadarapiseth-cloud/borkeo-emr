import { searchBeneficiaries } from '../npca/beneficiaries.mjs';
import { errorText } from '../npca/client.mjs';
import { publicSettings } from '../npca/settings.mjs';
import { listSubmissions } from '../npca/storage.mjs';
import { npcaAudit } from '../npca/storage.mjs';
import { setCodeOverride, codeValues, formDefinitions, referenceSheets, formValueSet } from '../npca/codes.mjs';
export function mountNpcaRoutes(router) {
  const send=(ctx,status,body)=>ctx.sendJson(ctx.response,status,body,{secure:ctx.config.cookieSecure});
  const read={requireSession:true,roles:['ADMIN','DIRECTOR','ACCOUNTANT','CLERK']};
  const write={requireSession:true,roles:['ADMIN','ACCOUNTANT','CLERK']};
  const failure=(ctx,error)=>send(ctx,error.status||400,{error:error.code?errorText(error):error.message});
  router.get('/api/npca/availability',ctx=>send(ctx,200,{enabled:ctx.config.npca.enabled}),{requireSession:true});
  router.get('/api/npca/form-definitions',ctx=>send(ctx,200,{enabled:ctx.config.npca.enabled,sendForms:ctx.config.npca.sendForms,forms:[...formDefinitions.values()],values:referenceSheets['Form Values'].slice(1).map(row=>({set:row[0],code:row[1],en:row[2],kh:row[3]})),aliases:Object.fromEntries([...new Set([...formDefinitions.values()].flatMap(f=>f.fields.map(v=>v.valueSet)))].map(name=>[name,formValueSet(name)]))}),{requireSession:true});
  router.get('/api/npca/candidates',ctx=>send(ctx,200,{patients:ctx.database.sqlite.prepare(`SELECT p.patient_key,p.case_number,p.full_name,p.service_mode FROM patient_records p JOIN npca_patient_links l ON l.patient_key=p.patient_key WHERE l.eligible=1 ORDER BY p.updated_at DESC LIMIT 500`).all()}),read);
  router.get('/api/npca/review',ctx=>{
    const patientKey=ctx.url.searchParams.get('patientKey');
    try{
      const current=ctx.npca.prepare(patientKey);
      const stored=ctx.database.sqlite.prepare('SELECT payload FROM npca_submissions WHERE patient_key=? ORDER BY updated_at DESC LIMIT 1').get(patientKey);
      npcaAudit(ctx.database,'REVIEW',{actorId:ctx.session.user_id,patientKey});
      return send(ctx,200,{...current,storedPayload:stored?JSON.parse(stored.payload):null});
    }catch(error){return failure(ctx,error);}
  },read);
  router.post('/api/npca/submit',async ctx=>{
    const body=await ctx.readJson(ctx.request,2048);
    try{const result=ctx.npca.enqueue(String(body.patientKey||''),ctx.session.user_id);return send(ctx,result.queued?202:422,result);}
    catch(error){return failure(ctx,error);}
  },write);
  router.get('/api/npca/badge',ctx=>{
    const key=ctx.url.searchParams.get('patientKey'),patient=ctx.database.findPatient(key);
    const financial=['CLERK','ACCOUNTANT'].includes(ctx.sessionRole(ctx.session));
    if(!patient||!financial&&!ctx.canAccessPatient(ctx.database,ctx.session,patient))return send(ctx,403,{error:'Access denied.'});
    const row=ctx.database.sqlite.prepare('SELECT status,queue_state FROM npca_submissions WHERE patient_key=? ORDER BY updated_at DESC LIMIT 1').get(key);
    return send(ctx,200,{enabled:ctx.config.npca.enabled,...(row||{})});
  },{requireSession:true});
  router.get('/api/npca/mappings',ctx=>send(ctx,200,{mappings:ctx.database.sqlite.prepare('SELECT * FROM npca_codes').all(),lists:Object.fromEntries(['sex','marital','visit','admission','discharge','outcome','payment','nationality'].map(k=>[k,codeValues(k)]))}),{requireSession:true,roles:['ADMIN','DIRECTOR']});
  router.put('/api/npca/mappings',async ctx=>{
    const body=await ctx.readJson(ctx.request,4096);
    try{setCodeOverride(ctx.database,body.category,body.localValue,body.code,ctx.session.user_id);npcaAudit(ctx.database,'MAPPING_CHANGED',{actorId:ctx.session.user_id});return send(ctx,200,{ok:true});}
    catch(error){return failure(ctx,error);}
  },{requireSession:true,roles:['ADMIN']});
  router.post('/api/npca/beneficiaries',async ctx=>{
    const body=await ctx.readJson(ctx.request,2048);
    try { const beneficiaries=await searchBeneficiaries(ctx.npca.client,ctx.database,ctx.session.user_id,String(body.cardNumber||'').trim());
      if(body.patientKey){const patient=ctx.database.findPatient(String(body.patientKey));
        if(!patient||!ctx.canAccessPatient(ctx.database,ctx.session,patient))return send(ctx,403,{error:'Access denied.'});
        const link=ctx.database.sqlite.prepare('SELECT spid FROM npca_patient_links WHERE patient_key=?').get(patient.patient_key);
        if(link&&!beneficiaries.some(person=>person.spid===link.spid&&person.eligible)){
          ctx.database.sqlite.prepare('UPDATE npca_patient_links SET eligible=0 WHERE patient_key=?').run(patient.patient_key);
          npcaAudit(ctx.database,'ELIGIBILITY_RECHECK_FAILED',{actorId:ctx.session.user_id,patientKey:patient.patient_key});
        }
      }
      return ctx.sendJson(ctx.response,200,{beneficiaries},{secure:ctx.config.cookieSecure}); }
    catch(error){return ctx.sendJson(ctx.response,400,{error:error.code?errorText(error):error.message},{secure:ctx.config.cookieSecure});}
  },{requireSession:true,roles:['REGISTRATION','ADMIN']});
  router.post('/api/npca/test', async ctx => {
    try { await ctx.npca.client.getToken(ctx.session.user_id); return ctx.sendJson(ctx.response,200,{ok:true,lastTokenAt:ctx.npca.client.lastTokenAt},{secure:ctx.config.cookieSecure}); }
    catch(error) { return ctx.sendJson(ctx.response,400,{error:errorText(error)},{secure:ctx.config.cookieSecure}); }
  },{requireSession:true,roles:['ADMIN']});
  router.get('/api/npca/settings', ctx => ctx.sendJson(ctx.response, 200, {
    ...publicSettings(ctx.config.npca), lastTokenAt: ctx.npca?.client?.lastTokenAt || null,
    canManage: ctx.sessionRole(ctx.session) === 'ADMIN',
  }, { secure: ctx.config.cookieSecure }), { requireSession: true, roles: ['ADMIN','DIRECTOR'] });
  router.get('/api/npca/submissions', ctx => ctx.sendJson(ctx.response, 200, { submissions: listSubmissions(ctx.database) }, { secure: ctx.config.cookieSecure }),
    { requireSession: true, roles: ['ADMIN','DIRECTOR','ACCOUNTANT','CLERK'] });
}
