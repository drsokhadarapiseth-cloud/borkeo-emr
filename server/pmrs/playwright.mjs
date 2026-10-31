// No live PMRS selectors are guessed. A site-verified profile is supplied outside Git.
import fs from 'node:fs';
export const PMRS_ORIGIN = 'https://pmrs.digitalsp.gov.kh';
export function fail(code, status = 409) { throw Object.assign(new Error(code), {code, status}); }
export function readProfile(file = process.env.PMRS_PLAYWRIGHT_PROFILE) {
  return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
export function loadProfile(file = process.env.PMRS_PLAYWRIGHT_PROFILE) {
  const profile=readProfile(file);
  if(profile)validateImportProfile(profile);
  return profile;
}
const selector=spec=>spec && typeof spec.selector==='string' && spec.selector.trim();
const dated=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
function validMappings(map,write=false) {
  if(!map||typeof map!=='object'||Array.isArray(map)||!Object.keys(map).length)return false;
  return Object.entries(map).every(([key,spec])=>
    /^(registration|clinical)\.[a-zA-Z0-9_.*]+$/.test(key) &&
    !key.split('.').some(x=>['__proto__','prototype','constructor'].includes(x)) &&
    selector(spec) && (write?['input','select','checkbox'].includes(spec.kind):!spec.kind||['text','input','select','checkbox'].includes(spec.kind)));
}
export function importProfileIssues(p) {
  const issues=[];
  if(!p||typeof p!=='object')return ['PROFILE_MISSING'];
  if(p.origin!==PMRS_ORIGIN)issues.push('PROFILE_ORIGIN_INVALID');
  if(p.automationAuthorized!==true)issues.push('AUTOMATION_AUTHORIZATION_REQUIRED');
  if(p.selectorsVerified!==true)issues.push('IMPORT_VERIFICATION_REQUIRED');
  if(!dated(p.verifiedAt)||typeof p.verificationReference!=='string'||!p.verificationReference.trim())issues.push('IMPORT_EVIDENCE_REQUIRED');
  if(!['authenticated','patientId','encounterId'].every(key=>selector(p[key])))issues.push('IDENTITY_MAPPING_REQUIRED');
  if(!validMappings(p.read))issues.push('READ_MAPPING_REQUIRED');
  try {
    if(p.loginOrigins && (!Array.isArray(p.loginOrigins)||p.loginOrigins.some(origin=>new URL(origin).origin!==origin||!origin.startsWith('https://'))))issues.push('LOGIN_ORIGIN_INVALID');
  }catch{issues.push('LOGIN_ORIGIN_INVALID');}
  return issues;
}
export function exportProfileIssues(p) {
  const issues=importProfileIssues(p);
  if(!p||typeof p!=='object')return [...issues,'EXPORT_VERIFICATION_REQUIRED'];
  if(p.exportVerified!==true)issues.push('EXPORT_VERIFICATION_REQUIRED');
  if(!dated(p.exportVerifiedAt)||typeof p.exportVerificationReference!=='string'||!p.exportVerificationReference.trim())issues.push('EXPORT_EVIDENCE_REQUIRED');
  if(!selector(p.save)||!selector(p.receipt))issues.push('SAVE_RECEIPT_MAPPING_REQUIRED');
  if(!validMappings(p.write,true))issues.push('WRITE_MAPPING_REQUIRED');
  if(!p.submission||!['POST','PUT','PATCH'].includes(p.submission.method)||!/^\/(?!\/)[^?#]*$/.test(p.submission.path||''))issues.push('SUBMISSION_ENDPOINT_REQUIRED');
  return [...new Set(issues)];
}
export function validateImportProfile(p) {
  const issues=importProfileIssues(p);if(issues.length)fail('PROFILE_UNVERIFIED',503);return p;
}
export function validateExportProfile(p) {
  const issues=exportProfileIssues(p);if(issues.length)fail('EXPORT_UNVERIFIED',503);return p;
}
// Compatibility entry point: opening a browser requires verified read-only import, not export.
export const validateProfile=validateImportProfile;
export function putPath(object, path, value) {
  const parts=path.split('.'); let cursor=object;
  for (const [index, part] of parts.entries()) {
    if (['__proto__','constructor','prototype'].includes(part)) fail('PROFILE_INVALID',503);
    if (index===parts.length-1) cursor[part]=value;
    else cursor=cursor[part] ??= /^\d+$/.test(parts[index+1]) ? [] : {};
  }
}
export function flatten(value, prefix='', result={}) {
  if (value === null || value === undefined || value === '') return result;
  if (typeof value !== 'object') { result[prefix]=String(value); return result; }
  for (const [key, item] of Object.entries(value)) {
    // Control/validation metadata is not a clinical target field.
    if (['warnings','fieldsComplete','followUpsReady','source','sourceDateTime','originalDateTime','outcomeCode','statusCode','route','scheduleType','doseAmount','effectiveAt','protocolIntervals'].includes(key)) continue;
    flatten(item,prefix ? `${prefix}.${key}` : key,result);
  }
  return result;
}
export class PmrsPage {
  constructor(page, profile, gate={mode:'review',remaining:0}) { this.page=page;this.profile=validateProfile(profile);this.gate=gate; }
  async element(spec) {
    const locator=this.page.locator(spec.selector);
    if (await locator.count() !== 1 || !await locator.isVisible()) fail('PAGE_CHANGED');
    return locator;
  }
  async controlValue(locator,spec){return spec.kind==='checkbox'?String(await locator.isChecked()):await locator.inputValue();}
  async readValue(spec) {
    const locator=await this.element(spec);
    const value=['input','select','checkbox'].includes(spec.kind) ? await this.controlValue(locator,spec) : await locator.innerText();
    const text=String(value??'').trim();
    if (text.length>12000) fail('FIELD_TOO_LARGE');
    if (spec.values) {
      if (!Object.hasOwn(spec.values,text)) fail('CHOICE_UNMATCHED');
      return String(spec.values[text]);
    }
    return text;
  }
  async identity() {
    if (new URL(this.page.url()).origin !== PMRS_ORIGIN) fail('LOGIN_REQUIRED',401);
    await this.element(this.profile.authenticated);
    this.gate.mode='review';
    const patientId=await this.readValue(this.profile.patientId), encounterId=await this.readValue(this.profile.encounterId);
    if (!patientId || !encounterId || patientId.length>160 || encounterId.length>160) fail('IDENTITY_REQUIRED');
    return {patientId,encounterId};
  }
  async capture({registrationOnly=false}={}) {
    const before=await this.identity(), snapshot={identity:before,registration:{},clinical:{}};
    for (const [path,spec] of Object.entries(this.profile.read)) {
      if(registrationOnly&&!path.startsWith('registration.'))continue;
      putPath(snapshot,path,await this.readValue(spec));
    }
    if (JSON.stringify(before)!==JSON.stringify(await this.identity())) fail('IDENTITY_CHANGED');
    if (Buffer.byteLength(JSON.stringify(snapshot))>200000) fail('RECORD_TOO_LARGE');
    snapshot.registration.healthId=before.patientId;
    snapshot.registration.caseNumber=before.encounterId;
    return snapshot;
  }
  async plan(clinical) {
    validateExportProfile(this.profile);
    const values=flatten({clinical}), operations=[];
    for (const [path,value] of Object.entries(values)) {
      const indexes=[...path.matchAll(/(?:^|\.)(\d+)(?=\.|$)/g)].map(match=>Number(match[1]));
      const template=this.profile.write[path]||this.profile.write[path.replace(/(?:^|\.)(\d+)(?=\.|$)/g,match=>match.startsWith('.')?'.*':'*')];
      const spec=template?{...template,selector:template.selector.replace(/\{\{(\d+)\}\}/g,(_,i)=>String(indexes[Number(i)]+1))}:null;
      if (!spec || !['input','select','checkbox'].includes(spec.kind)) fail('FIELD_UNMAPPED');
      if(/\.medications\.\d+\.name$/.test(path)&&spec.kind!=='select')fail('MEDICINE_CHOICE_REQUIRED');
      const locator=await this.element(spec);
      let target=value;
      if (spec.values) {
        if (!Object.hasOwn(spec.values,value)) fail('CHOICE_UNMATCHED');
        target=String(spec.values[value]);
      }
      if(spec.kind==='checkbox'&&!['true','false'].includes(target))fail('CHOICE_UNMATCHED');
      if (spec.kind==='select') {
        const choices=await locator.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
        if (!choices.includes(target)) fail('CHOICE_UNMATCHED');
      }
      operations.push({path, spec, before:await this.controlValue(locator,spec), after:target});
    }
    if (!operations.length) fail('EMPTY_EXPORT');
    return operations;
  }
  async check(operations,filled=false) {
    for(const op of operations) if(await this.controlValue(await this.element(op.spec),op.spec) !== (filled?op.after:op.before)) fail('TARGET_CHANGED');
  }
  async fill(operations) {
    validateExportProfile(this.profile);
    await this.check(operations);
    // Never click navigation/add/save controls during filling. Only verified form controls.
    for (const op of operations) {
      const locator=await this.element(op.spec);
      if(op.spec.kind==='select') await locator.selectOption(op.after); else if(op.spec.kind==='checkbox')await locator.setChecked(op.after==='true');else await locator.fill(op.after);
    }
    await this.check(operations,true);
  }
  async submit(identity,operations) {
    validateExportProfile(this.profile);
    if(JSON.stringify(await this.identity())!==JSON.stringify(identity)) fail('IDENTITY_CHANGED');
    await this.check(operations,true);
    const receipt=await this.element(this.profile.receipt);
    const previous=await receipt.innerText();
    this.gate.mode='submit';this.gate.remaining=1;
    try {
    await (await this.element(this.profile.save)).click({timeout:15000});
    // A click alone is never success. Receipt must change and identify this encounter.
    await this.page.waitForFunction(({selector,previous,encounterId})=>{
      const nodes=document.querySelectorAll(selector);
      return nodes.length===1 && nodes[0].textContent.trim()!==previous.trim() && nodes[0].textContent.includes(encounterId);
    },{selector:this.profile.receipt.selector,previous,encounterId:identity.encounterId},{timeout:15000});
    if(JSON.stringify(await this.identity())!==JSON.stringify(identity)) fail('IDENTITY_CHANGED');
    return 'confirmed';
    } finally {this.gate.mode='review';this.gate.remaining=0;}
  }
}
export async function openPmrs(profile) {
  validateImportProfile(profile);
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:false});
  try {
    const context=await browser.newContext({acceptDownloads:false,serviceWorkers:'block'});
    // Credentials, cookies and authenticator codes stay in this ephemeral browser.
    const allowed=new Set([PMRS_ORIGIN,...profile.loginOrigins||[]]);
    const gate={mode:'login',remaining:0};
    await context.route('**/*',route=>{
      let origin;try {origin=new URL(route.request().url()).origin;} catch {return route.abort();}
      if(!allowed.has(origin))return route.abort();
      const request=route.request();
      if(!['GET','HEAD','OPTIONS'].includes(request.method()) && gate.mode!=='login') {
        if(gate.mode!=='submit'||gate.remaining!==1||origin!==PMRS_ORIGIN||new URL(request.url()).pathname!==profile.submission.path||request.method()!==profile.submission.method)return route.abort();
        gate.remaining=0;
      }
      return route.continue();
    });
    const page=await context.newPage();
    context.on('page',popup=>{if(popup!==page)void popup.close();});
    page.setDefaultTimeout(10000);
    await page.goto(PMRS_ORIGIN,{waitUntil:'domcontentloaded',timeout:30000});
    return {adapter:new PmrsPage(page,profile,gate),close:()=>browser.close()};
  } catch(error) {await browser.close();throw error;}
}
