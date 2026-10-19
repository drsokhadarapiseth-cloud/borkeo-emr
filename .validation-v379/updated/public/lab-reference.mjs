export const LIMIT_KEYS=['referenceLow','referenceHigh','criticalLow','criticalHigh'];
export function unitRule(test,unit){const r=test.units?.find(x=>x.unit===unit)||(unit===test.baseUnit?{factorToBase:1,offsetToBase:0}:null);if(!r||!Number.isFinite(Number(r.factorToBase))||Number(r.factorToBase)<=0||!Number.isFinite(Number(r.offsetToBase||0)))throw Error(`Unit ${unit} is not approved for ${test.name||test.code}.`);return r}
export function convertValue(value,from,to,test){const a=unitRule(test,from),b=unitRule(test,to);if(value===''||value==null)return value;const n=Number(value);if(!Number.isFinite(n))throw Error('Enter a finite numeric result.');return (n*Number(a.factorToBase)+Number(a.offsetToBase||0)-Number(b.offsetToBase||0))/Number(b.factorToBase)}
export function patientContext(p = {}, at = Date.now()) {
  const raw = String(p.sex || '').toLowerCase();
  const sex = ['m','male','ប្រុស'].includes(raw) ? 'M' : ['f','female','ស្រី'].includes(raw) ? 'F' : '';
  let age = null, days = null;
  const text = String(p.dateOfBirth || p.date_of_birth || '');
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(text + 'T00:00:00Z') : null;
  const now = new Date(at);
  const validDob = dob && Number.isFinite(+dob) && dob.toISOString().slice(0,10) === text;
  if (validDob && dob <= now) {
    days = Math.floor((now - dob) / 86400000);
    // Calendar anniversaries keep leap years and month-end births on the
    // correct side of infant-month and adult-birthday boundaries.
    const anniversary = months => {
      const first = new Date(Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth() + months, 1));
      const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      first.setUTCDate(Math.min(dob.getUTCDate(), lastDay));
      return first;
    };
    let months = (now.getUTCFullYear() - dob.getUTCFullYear()) * 12 + now.getUTCMonth() - dob.getUTCMonth();
    if (now < anniversary(months)) months--;
    const last = anniversary(months), next = anniversary(months + 1);
    age = months / 12 + (now - last) / (next - last) / 12;
  } else if (!text) {
    const a = String(p.age ?? '').trim();
    if (/^\d+(\.\d+)?$/.test(a)) age = Number(a);
    else if (/^\d+(\.\d+)?\s*(years?|yrs?|ឆ្នាំ)$/i.test(a)) age = parseFloat(a);
    else if (/^\d+(\.\d+)?\s*(months?|ខែ)$/i.test(a)) age = parseFloat(a) / 12;
    else if (/^\d+(\.\d+)?\s*(days?|ថ្ងៃ)$/i.test(a)) { days = parseFloat(a); age = days / 365.2425; }
  }
  return { sex, age, days };
}
export function matches(r,c){if(r.sex&&r.sex!==c.sex)return false;for(const [k,v] of [['Age',c.age],['Days',c.days]]){if(r['min'+k]!=null&&(v==null||v<r['min'+k]))return false;if(r['max'+k]!=null&&(v==null||v>=r['max'+k]))return false}return true}
export function clinicalLimits(test,person=null,at=Date.now()){const out={...test};const c=person===null?null:patientContext(person,at),meta=test.referenceConfig||{};for(const [kind,keys] of [['reference',['referenceLow','referenceHigh']],['critical',['criticalLow','criticalHigh']]]){const rules=meta[kind+'Rules'];if(!rules?.length)continue;const rule=c?rules.find(r=>matches(r,c)):null;for(const k of keys)out[k]=rule?.[k]??null;out[kind+'Context']=rule?.label||'No applicable range: check age/sex or configure locally'}return out}
export function resultFlag(value,unit,test){
 if(value===''||value==null)return '';
 const n=convertValue(value,unit,test.baseUnit,test),inc=test.referenceConfig?.criticalInclusive===true;
 // Suppress only floating-point conversion noise at an exact boundary.
 const eps=v=>1e-11*Math.max(1,Math.abs(n),Math.abs(v));
 if(test.criticalLow!=null&&(inc?n<=test.criticalLow+eps(test.criticalLow):n<test.criticalLow-eps(test.criticalLow)))return 'CRITICAL_LOW';
 if(test.criticalHigh!=null&&(inc?n>=test.criticalHigh-eps(test.criticalHigh):n>test.criticalHigh+eps(test.criticalHigh)))return 'CRITICAL_HIGH';
 if(test.referenceLow!=null&&(test.referenceConfig?.referenceLowExclusive?n<=test.referenceLow+eps(test.referenceLow):n<test.referenceLow-eps(test.referenceLow)))return 'LOW';
 if(test.referenceHigh!=null&&(test.referenceConfig?.referenceHighExclusive?n>=test.referenceHigh-eps(test.referenceHigh):n>test.referenceHigh+eps(test.referenceHigh)))return 'HIGH';
 return '';
}
export function displayLimits(limits,unit,test){return Object.fromEntries(LIMIT_KEYS.map(k=>[k,limits[k]==null?null:convertValue(limits[k],test.baseUnit,unit,test)]))}
export function snapshotLimits(result,test){return {...test,name:result.name||test.name,resultType:result.resultType||test.resultType,category:result.category||test.category,specimen:result.specimen??test.specimen,loincCode:result.loincCode??test.loincCode,referenceContext:result.referenceContext,criticalContext:result.criticalContext,...Object.fromEntries(LIMIT_KEYS.map(k=>[k,Object.hasOwn(result,k)?result[k]:null])),baseUnit:result.unit||test.baseUnit,units:[{unit:result.unit||test.baseUnit,factorToBase:1,offsetToBase:0}],referenceNote:result.referenceNote||'Historical report: original range not recorded',referenceConfig:result.referenceConfig||{}}}
export function rebaseTest(test,to){const target=unitRule(test,to),meta=JSON.parse(JSON.stringify(test.referenceConfig||{}));for(const kind of ['referenceRules','criticalRules'])for(const r of meta[kind]||[])for(const k of LIMIT_KEYS)if(r[k]!=null)r[k]=convertValue(r[k],test.baseUnit,to,test);return {...test,...displayLimits(test,to,test),baseUnit:to,units:test.units.map(r=>({unit:r.unit,factorToBase:Number(r.factorToBase)/Number(target.factorToBase),offsetToBase:(Number(r.offsetToBase||0)-Number(target.offsetToBase||0))/Number(target.factorToBase)})),referenceConfig:meta}}
