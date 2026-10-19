export const HEF_LOOKUP_ROLES=new Set(['REGISTRATION','ADMIN','VICE_DIRECTOR']);
export const HEF_SOURCE='https://app.idpoor.gov.kh/verification';
const ENDPOINT='https://app.idpoor.gov.kh/api/reporting/public/equitycards/verification';
export function normalizeHefCard(value){
  const id=String(value??'').replace(/[០-៩]/g,x=>String(x.charCodeAt(0)-0x17e0)).trim();
  if(!/^\d{10}$/.test(id)){const e=new Error('Enter the 10-digit Equity Card number.');e.status=400;throw e;}
  return id;
}
function text(value,max=240){return typeof value==='string'||typeof value==='number'?String(value).replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';}
export function hefDate(value){
  let s=text(value,80).replace(/[០-៩]/g,x=>String(x.charCodeAt(0)-0x17e0));
  if(typeof value==='number' && Number.isFinite(value))s=new Date(value).toISOString().slice(0,10);
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(s);if(!m)return '';
  const day=m.slice(1).join('-'),d=new Date(day+'T00:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===day?day:'';
}
export function normalizeHefResult(raw,requestedCard){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Unexpected IDPoor response.');
  if(!raw.equityCard){
    if(!Object.hasOwn(raw,'fileExists')&&!Object.hasOwn(raw,'validCardRedirected'))throw new Error('Unexpected IDPoor response.');
    return{found:false,requestedCard,source:HEF_SOURCE,verifiedAt:new Date().toISOString()};
  }
  const card=raw.equityCard;
  if(text(card.cardNo)!==requestedCard&&raw.validCardRedirected!==true)throw new Error('IDPoor returned a different card without replacement confirmation.');
  if(!/^\d{10}$/.test(text(card.cardNo)))throw new Error('Unexpected Equity Card number in response.');
  if(!Array.isArray(raw.householdMembers||[])||(raw.householdMembers||[]).length>100)throw new Error('Unexpected household member list.');
  const address={};
  for(const level of ['province','district','commune','village']){
    const item=raw.address?.[level];address[level]=text(item?.nameKm||item?.name);address[level+'Code']='';
  }
  // The official view uses equityCard.villageCode as the geographic code.
  const rawVillageCode=text(card.villageCode,16),villageCode=/^\d{1,8}$/.test(rawVillageCode)?rawVillageCode.padStart(8,'0'):'';
  if(/^\d{8}$/.test(villageCode))for(const[level,len]of [['province',2],['district',4],['commune',6],['village',8]])address[level+'Code']=villageCode.slice(0,len);
  const members=(raw.householdMembers||[]).map((m,index)=>{
    const f=m.fieldValues||{},field=k=>f[k]?.value;
    const lastName=text(field('surname')),firstName=text(field('name')),gender=text(field('gender')).toLowerCase();
    const sex=['male','m','ប្រុស'].includes(gender)?'ប្រុស':['female','f','ស្រី'].includes(gender)?'ស្រី':'';
    return{id:text(m.id,120)||'member-'+index,lastName,firstName,fullName:[lastName,firstName].filter(Boolean).join(' '),sex,dateOfBirth:hefDate(field('dob')),relation:text(field('relationToHead'),120)};
  }).filter(m=>m.fullName);
  return{found:true,requestedCard,source:HEF_SOURCE,verifiedAt:new Date().toISOString(),card:{number:text(card.cardNo,10),valid:typeof card.valid==='boolean'?card.valid:null,disqualified:card.disqualified===true,status:text(card.status,80),povertyStatus:text(raw.householdInfo?.povertyStatus,80),householdCode:text(raw.householdInfo?.code,80),validUntil:hefDate(card.validUntil),redirected:raw.validCardRedirected===true},address,members};
}
async function boundedJson(response){
  if(!response.headers.get('content-type')?.includes('json'))throw new Error('IDPoor returned an unexpected document.');
  const reader=response.body.getReader();let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288){await reader.cancel();throw new Error('IDPoor response is too large.');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createHefLookup({fetchImpl=fetch,now=Date.now}={}){
  let active=0;const attempts=new Map();
  return async function lookup(card,userId){
    const id=normalizeHefCard(card),time=now(),recent=(attempts.get(userId)||[]).filter(t=>time-t<60000);
    if(recent.length>=12||active>=3){const e=new Error('Too many verification requests. Please wait and retry.');e.status=429;throw e;}
    attempts.set(userId,[...recent,time]);active++;
    if(attempts.size>1000)for(const[k,v]of attempts)if(!v.some(t=>time-t<60000))attempts.delete(k);
    try{
      const url=new URL(ENDPOINT);url.searchParams.set('cardNo',id);
      const response=await fetchImpl(url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('IDPoor lookup is temporarily unavailable.');
      return normalizeHefResult(await boundedJson(response),id);
    }catch(error){const e=new Error(error.name==='TimeoutError'||error.name==='AbortError'?'IDPoor lookup timed out. Please retry.':'Cannot verify with IDPoor right now. Please retry or register manually.');e.status=503;throw e;}
    finally{active--;}
  };
}
