import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

function replaceInFile(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  const norm = s => s.replace(/\r\n/g, '\n');
  let normContent = norm(content);
  let normSearch = norm(searchStr);
  let normReplace = norm(replaceStr);

  if (!normContent.includes(normSearch)) {
    console.error(`Could not find search string in ${filePath}`);
    return false;
  }
  normContent = normContent.replace(normSearch, normReplace);
  fs.writeFileSync(filePath, isCrlf ? normContent.replace(/\n/g, '\r\n') : normContent, 'utf8');
  console.log(`Updated ${filePath}`);
  return true;
}

// 1. Update package.json to 36.9.0
const pkgPath = path.join(ROOT, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '36.9.0';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Updated package.json to v36.9.0');

// 2. Update public/login.html
const loginPath = path.join(ROOT, 'public', 'login.html');
let loginContent = fs.readFileSync(loginPath, 'utf8');
loginContent = loginContent.replace(/v36\.8/g, 'v36.9');
fs.writeFileSync(loginPath, loginContent, 'utf8');
console.log('Updated public/login.html to v36.9');

// 3. Update server/server.mjs
const serverPath = path.join(ROOT, 'server', 'server.mjs');
let serverContent = fs.readFileSync(serverPath, 'utf8');
serverContent = serverContent.replace(/Borkeo EMR v36\.8/g, 'Borkeo EMR v36.9');
fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Updated server/server.mjs to v36.9');

// 4. Update cache busters to ?v=3690
for (const rel of [
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html',
  'protected/health-facility.html',
]) {
  const filePath = path.join(ROOT, rel);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\?v=3680/g, '?v=3690').replace(/\?v=2950/g, '?v=3690');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated cache busters in ${rel}`);
  }
}

// 5. Update public/health-facility.js
const hfPath = path.join(ROOT, 'public', 'health-facility.js');
const newHfCode = `'use strict';
(async()=>{
const uuid=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
const en=()=>typeof window!=='undefined'&&(window.getBorkeoLanguage?.()==='en'||window.currentLang==='english'||window.currentLang==='en'||localStorage.getItem('borkeo-lang')==='en');
const txt=(kh,eng)=>en()?eng:kh;
const $=id=>document.getElementById(id),status=$('hf-status'),tabs=$('hf-tabs'),panels=$('hf-panels');
const sections=[['facility','មូលដ្ឋានសុខាភិបាល','Facility details'],['operationalDistrict','ស្រុកប្រតិបត្តិ (OD)','Operational District'],['contracts','កិច្ចសន្យា','Contracts'],['contacts','ទំនាក់ទំនង','Contacts'],['committee','គណៈកម្មការគ្រប់គ្រង','Management committee'],['staff','បញ្ជីបុគ្គលិក','Staff list'],['banking','ព័ត៌មានធនាគារ','Banking'],['terms',txt('លក្ខខណ្ឌ','Terms and Conditions'),'Terms and Conditions']];
const specs={facility:[['type',txt('ប្រភេទមូលដ្ឋានសុខាភិបាល','Facility type')],['level',txt('កម្រិតមូលដ្ឋានសុខាភិបាល','Facility level')],['startDate',txt('កាលបរិច្ឆេទចាប់ផ្តើម','Start date'),'date'],['endDate',txt('កាលបរិច្ឆេទបញ្ចប់','End date'),'date'],['province',txt('រាជធានី/ខេត្ត','Province/City'),'select'],['district',txt('ក្រុង/ស្រុក/ខណ្ឌ','District/Khan'),'select'],['commune',txt('ឃុំ/សង្កាត់','Commune/Sangkat'),'select'],['village',txt('ភូមិ','Village'),'select'],['house',txt('ផ្ទះលេខ','House number')],['street',txt('ផ្លូវលេខ','Street number')],['group',txt('ក្រុមលេខ','Group number')],['phone',txt('ទូរស័ព្ទ','Phone'),'tel'],['email','Email','email']],contracts:[['program',txt('កម្មវិធី','Program')],['level',txt('កម្រិត','Level')],['paymentMethod',txt('យន្តការទូទាត់','Payment method')],['contractNumber',txt('លេខកិច្ចសន្យា','Contract number')],['startDate',txt('ចាប់ផ្តើម','Start date'),'date'],['endDate',txt('បញ្ចប់','End date'),'date']],contacts:[['name',txt('ឈ្មោះ','Name')],['role',txt('តួនាទី','Role')],['phone',txt('លេខទូរស័ព្ទ','Phone'),'tel'],['email','Email','email'],['primary',txt('ទំនាក់ទំនងចម្បង','Primary contact'),'checkbox']],committee:[['role',txt('តួនាទី','Role')],['name',txt('ឈ្មោះ','Name')]],banking:[['fund',txt('កម្មវិធី / មូលនិធិ','Program / Fund')],['startDate',txt('ចាប់ផ្តើម','Start date'),'date'],['endDate',txt('បញ្ចប់','End date'),'date'],['bank',txt('ឈ្មោះធនាគារ *','Bank name *')],['holder',txt('ឈ្មោះគណនី *','Account holder *')],['account',txt('លេខគណនី *','Account number *')],['branch',txt('សាខា','Branch')],['currency',txt('រូបិយប័ណ្ណ','Currency')],['type',txt('ប្រភេទគណនី','Account Type')],['notes',txt('កំណត់សម្គាល់','Notes')]],terms:[['text',txt('ខ្លឹមសារដែលអនុម័តដោយមន្ទីរពេទ្យ','Hospital approved terms'),'textarea'],['accepted',txt('បានពិនិត្យខ្លឹមសារខាងលើ','I have reviewed the terms above'),'checkbox']]};
let revision=0,documents=[],current=0,dirty=false,csrf='',ready=false,addressesReady=false;const snapshots=new Map();const hasChanges=()=>ready&&sections.filter(s=>s[0]!=='staff').some(([k])=>snapshots.get(k)!==JSON.stringify(collect(k)));
function announce(text){status.textContent=text;}
function field([key,label,type='text'],value=''){const wrap=document.createElement('label');if(type==='checkbox')wrap.className='hf-check';const span=document.createElement('span');span.textContent=label;const input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');if(input.tagName==='INPUT')input.type=type;input.dataset.field=key;if(type==='checkbox')input.checked=value===true;else if(type!=='select')input.value=value||'';input.maxLength=type==='textarea'?20000:300;if(type==='text'){const choices={level:['CPA1','CPA2','CPA3'],type:['មន្ទីរពេទ្យបង្អែកស្រុក','មណ្ឌលសុខភាព','KHR / រៀល','USD / ដុល្លារ','Savings','Current'],currency:['KHR','USD'],role:['ប្រធានមន្ទីរពេទ្យ','អនុប្រធានមន្ទីរពេទ្យ','ប្រធានគណនេយ្យ','Director','Vice Director','Accountant']};if(choices[key]){const list=document.createElement('datalist');list.id='hf-options-'+uuid();choices[key].forEach(v=>list.append(new Option(v,v)));input.setAttribute('list',list.id);wrap.append(list);}}if(type==='select'){const opt=new Option(txt('— ជ្រើសរើស —','— Select —'),'');input.add(opt);}wrap.append(span,input);return wrap;}
function collect(section){const panel=$('hf-'+section);if(section==='operationalDistrict'){const prov=panel.querySelector('[data-field="province"]')?.value||'16';const dists=[...panel.querySelectorAll('input[type="checkbox"][data-od-district]:checked')].map(c=>c.value);return {province:prov,districts:dists};}const read=host=>Object.fromEntries([...host.querySelectorAll('[data-field]')].map(n=>[n.dataset.field,n.type==='checkbox'?n.checked:n.value]));return ['contracts','contacts','committee','banking'].includes(section)?[...panel.querySelectorAll('.hf-row')].map(row=>({id:row.dataset.id,...read(row)})):read(panel);}
async function api(url,method='GET',body){const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save.');return data;}
async function save(section){if(section==='facility'&&!addressesReady)throw Error(txt('សូមរង់ចាំទិន្នន័យអាសយដ្ឋានផ្ទុកចប់ ឬផ្ទុកទំព័រឡើងវិញ។','Wait for address data to load, or reload before saving.'));const result=await api('/api/admin/health-facility','PUT',{section,revision,value:collect(section)});revision=result.revision;documents=result.documents;snapshots.set(section,JSON.stringify(collect(section)));dirty=hasChanges();announce(txt('បានរក្សាទុក · ','Saved · ')+new Date(result.updatedAt).toLocaleString());renderDocuments();return result;}
function button(text,fn,cls='hf-action'){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.onclick=async()=>{if(!ready)return;b.disabled=true;try{await fn();}catch(e){announce(e.message);}finally{b.disabled=false;}};return b;}
function choose(index){current=index;sections.forEach(([key],i)=>{tabs.children[i].setAttribute('aria-selected',String(i===index));tabs.children[i].tabIndex=i===index?0:-1;$('hf-'+key).hidden=i!==index;});$('hf-step').textContent=(index+1)+' / '+sections.length;$('hf-prev').disabled=index===0;$('hf-next').disabled=index===(sections.length-1);}
async function upload(file,kind,ownerId=''){if(!file)return;if(file.size>5*1024*1024)throw Error(txt('ទំហំឯកសារអតិបរមា៖ 5 MB','Maximum file size: 5 MB.'));if(kind==='bank')await save('banking');if(kind==='contract')await save('contracts');const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('Unable to read file.'));r.readAsDataURL(file);});const result=await api('/api/admin/health-facility/documents','POST',{name:file.name,base64,kind,ownerId});documents=result.documents;renderDocuments();announce(txt('ឯកសារបានរក្សាទុក','File saved.'));}
function uploadControl(kind,id=''){const box=document.createElement('div');box.className='hf-upload';const label=document.createElement('label');label.textContent=kind==='bank'?txt('រូបភាព (PNG, JPEG, WebP; 5 MB)','Image (PNG, JPEG, WebP; 5 MB)'):kind==='staff'?txt('បញ្ចូលបញ្ជីបុគ្គលិក (Excel; 5 MB)','Staff list (Excel; 5 MB)'):txt('ភ្ជាប់កិច្ចសន្យា (PDF / Excel; 5 MB)','Attach contract (PDF / Excel; 5 MB)');const input=document.createElement('input');input.type='file';input.accept=kind==='bank'?'.png,.jpg,.jpeg,.webp':kind==='staff'?'.xlsx,.xls':'.pdf,.xlsx,.xls';input.onchange=async()=>{input.disabled=true;try{await upload(input.files[0],kind,id);}catch(e){announce(e.message);}finally{input.value='';input.disabled=false;}};label.append(input);const list=document.createElement('div');list.dataset.docKind=kind;list.dataset.owner=id;box.append(label,list);return box;}
function renderDocuments(){document.querySelectorAll('[data-doc-kind]').forEach(host=>{host.replaceChildren();documents.filter(d=>d.kind===host.dataset.docKind&&d.ownerId===host.dataset.owner).forEach(d=>{const line=document.createElement('div');line.className='hf-doc';const link=document.createElement('a');link.href='/api/admin/health-facility/documents/'+d.id;link.textContent=d.name;const size=document.createElement('small');size.textContent=Math.ceil(d.size/1024)+' KB';line.append(link,size,button(txt('លុប','Remove'),async()=>{if(!confirm(txt('តើអ្នកពិតជាចង់លុបឯកសារនេះមែនទេ?','Remove this file?')))return;const result=await api(link.href,'DELETE');documents=result.documents;renderDocuments();},'hf-remove'));host.append(line);});});renderBankTable();}
function addRow(section,value={}){const host=$('hf-'+section).querySelector('[data-rows]'),row=document.createElement('article');row.className='hf-row';row.dataset.id=value.id||uuid();const heading=document.createElement('div');heading.className='hf-row-header';const title=document.createElement('h3');title.textContent=section==='banking'?txt('គណនីធនាគារ','Bank account'):txt(sections.find(s=>s[0]===section)[1],sections.find(s=>s[0]===section)[2]);heading.append(title,button(txt('លុប','Remove'),()=>{if(!confirm(txt('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?','Remove this entry? Changes take effect after saving.')))return;row.remove();dirty=true;renderBankTable();},'hf-remove'));const grid=document.createElement('div');grid.className='hf-grid';specs[section].forEach(spec=>grid.append(field(spec,value[spec[0]])));row.append(heading,grid);if(section==='contracts'||section==='banking')row.append(uploadControl(section==='contracts'?'contract':'bank',row.dataset.id));host.append(row);renderDocuments();return row;}
function renderBankTable(){const host=$('hf-bank-overview');if(!host)return;host.replaceChildren();const table=document.createElement('table');const head=table.createTHead().insertRow();[txt('កម្មវិធី / មូលនិធិ','Program / Fund'),txt('ចាប់ផ្តើម','Start date'),txt('បញ្ចប់','End date'),txt('ធនាគារ','Bank'),txt('ឈ្មោះគណនី','Account holder'),txt('លេខគណនី','Account number'),txt('រូបិយប័ណ្ណ','Currency'),txt('ប្រភេទគណនី','Account type'),txt('រូបភាព','Image'),txt('សកម្មភាព','Actions')].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th);});const body=table.createTBody();const rows=$('hf-banking').querySelectorAll('.hf-row');rows.forEach(row=>{const r=body.insertRow(),values=Object.fromEntries([...row.querySelectorAll('[data-field]')].map(n=>[n.dataset.field,n.value]));['fund','startDate','endDate','bank','holder','account','currency','type'].forEach(k=>r.insertCell().textContent=values[k]||'—');const images=r.insertCell();documents.filter(d=>d.kind==='bank'&&d.ownerId===row.dataset.id).forEach(d=>{const a=document.createElement('a');a.textContent=d.name;a.href='/api/admin/health-facility/documents/'+d.id;const img=document.createElement('img');img.src=a.href;img.alt=d.name;img.loading='lazy';img.className='hf-bank-image';images.append(img,a,document.createElement('br'));});const actions=r.insertCell();actions.append(button(txt('កែ','Edit'),()=>{row.scrollIntoView({behavior:'smooth',block:'center'});row.querySelector('input').focus();}),button(txt('លុប','Remove'),()=>{if(!confirm(txt('តើអ្នកពិតជាចង់លុបគណនីធនាគារនេះមែនទេ?','Remove bank account? Save afterward to confirm.')))return;row.remove();dirty=true;renderBankTable();},'hf-remove'));});host.append(table);}
async function address(saved){const names=['province','district','commune','village'],selects=names.map(k=>$('hf-facility').querySelector('[data-field="'+k+'"]'));let provinces=[],districts=[],communes=[],villages=[],request=0;const pad=(v,len)=>String(v||'').padStart(len,'0');const fill=(select,rows,len,value='')=>{select.replaceChildren(new Option(txt('— ជ្រើសរើស —','— Select —'),''));rows.forEach(r=>select.add(new Option(r.local,pad(r.code,len))));select.value=value;select.disabled=!rows.length;};async function cascade(level,restore=false){addressesReady=false;const ticket=++request;for(let i=level+1;i<4;i++)fill(selects[i],[],2+i*2);try{if(level===0){const province=provinces.find(p=>pad(p.code,2)===selects[0].value);districts=province?await (await fetch('/data/gazetteer/provinces/'+encodeURIComponent(province.id)+'.json')).json():[];if(ticket!==request)return;fill(selects[1],districts,4,restore?saved.district:'');}if(level<=1){communes=districts.find(d=>pad(d.code,4)===selects[1].value)?.communes||[];fill(selects[2],communes,6,restore?saved.commune:'');}villages=communes.find(c=>pad(c.code,6)===selects[2].value)?.villages||[];fill(selects[3],villages,8,restore?saved.village:'');addressesReady=true;}catch{addressesReady=false;throw Error(txt('មិនអាចទាញយកទិន្នន័យអាសយដ្ឋានបានទេ។','Unable to load local address data. Reload before saving facility details.'));}}try{provinces=await(await fetch('/data/gazetteer/provinces.json')).json();fill(selects[0],provinces,2,saved.province||'');await cascade(0,true);selects.slice(0,3).forEach((s,i)=>s.onchange=()=>cascade(i).catch(e=>announce(e.message)));}catch{announce('Address dataset unavailable.');}}
function build(data){sections.forEach(([key,kh,enLabel],index)=>{const tab=button((index+1)+'. '+txt(kh,enLabel),()=>choose(index));tab.role='tab';tab.id='hf-tab-'+key;tab.setAttribute('aria-controls','hf-'+key);tabs.append(tab);const panel=document.createElement('section');panel.className='hf-panel';panel.id='hf-'+key;panel.role='tabpanel';panel.setAttribute('aria-labelledby',tab.id);const title=document.createElement('h2');title.textContent=txt(kh,enLabel);panel.append(title);panels.append(panel);if(key==='operationalDistrict'){
  const note=document.createElement('p');note.className='hf-note';note.textContent=txt('កំណត់ក្រុង/ស្រុក/ខណ្ឌ ដែលស្ថិតនៅក្នុងដែនសមត្ថកិច្ចរបស់ស្រុកប្រតិបត្តិ (OD)។ នៅពេលចុះឈ្មោះអ្នកជំងឺ ប្រសិនបើរើសស្រុកក្នុងបញ្ជីនេះ ប្រព័ន្ធនឹងជ្រើសរើស «ក្នុងស្រុកប្រតិបត្តិ» ដោយស្វ័យប្រវត្តិ។','Define districts covered by the Operational Health District (OD). In registration, selecting these districts auto-selects "In OD".');
  panel.append(note);
  const provWrap=document.createElement('div');provWrap.style.marginBottom='16px';
  const provLabel=document.createElement('label');provLabel.style.fontWeight='bold';provLabel.textContent=txt('រាជធានី/ខេត្ត នៃស្រុកប្រតិបត្តិ ៖ ','Province/City of Operational District: ');
  const provSelect=document.createElement('select');provSelect.dataset.field='province';provSelect.className='hf-input';provSelect.style.marginLeft='8px';
  provLabel.append(provSelect);provWrap.append(provLabel);panel.append(provWrap);
  const distTitle=document.createElement('h3');distTitle.textContent=txt('បញ្ជីក្រុង/ស្រុក/ខណ្ឌ ក្នុងស្រុកប្រតិបត្តិ ៖','List of Districts in Operational District:');distTitle.style.marginTop='12px';panel.append(distTitle);
  const distHost=document.createElement('div');distHost.id='hf-od-districts-list';distHost.style.display='grid';distHost.style.gridTemplateColumns='repeat(auto-fill, minmax(220px, 1fr))';distHost.style.gap='10px';distHost.style.margin='12px 0';panel.append(distHost);
  const savedOd=data.operationalDistrict||{province:data.facility?.province||'16',districts:['1601','1603','1607']};
  async function loadOdDistricts(provCode){
    distHost.innerHTML='<p>'+txt('កំពុងផ្ទុកបញ្ជីស្រុក...','Loading districts...')+'</p>';
    try{
      const provs=await(await fetch('/data/gazetteer/provinces.json')).json();
      provSelect.replaceChildren();
      provs.forEach(p=>{const opt=new Option(p.local,String(p.code).padStart(2,'0'));if(opt.value===provCode)opt.selected=true;provSelect.add(opt);});
      const selectedProv=provs.find(p=>String(p.code).padStart(2,'0')===provCode)||provs[0];
      const districts=await(await fetch('/data/gazetteer/provinces/'+encodeURIComponent(selectedProv.id)+'.json')).json();
      distHost.replaceChildren();
      const currentSaved=savedOd.districts||['1601','1603','1607'];
      districts.forEach(d=>{
        const code=String(d.code).padStart(4,'0');
        const lbl=document.createElement('label');lbl.className='hf-check';lbl.style.display='flex';lbl.style.alignItems='center';lbl.style.gap='8px';lbl.style.padding='8px 12px';lbl.style.background='#f8fafc';lbl.style.border='1px solid #e2e8f0';lbl.style.borderRadius='6px';lbl.style.cursor='pointer';
        const cb=document.createElement('input');cb.type='checkbox';cb.value=code;cb.dataset.odDistrict='true';
        cb.checked=currentSaved.includes(code);
        cb.onchange=()=>{dirty=true;};
        const txtSpan=document.createElement('span');txtSpan.textContent=en()?(d.english||d.local):((d.type?d.type+' ':'')+d.local);
        lbl.append(cb,txtSpan);distHost.append(lbl);
      });
    }catch(err){distHost.innerHTML='<p style="color:red">'+txt('មិនអាចផ្ទុកបញ្ជីស្រុកបានទេ','Error loading districts')+'</p>';}
  }
  provSelect.onchange=()=>{dirty=true;loadOdDistricts(provSelect.value);};
  loadOdDistricts(savedOd.province||'16');
}else if(['contracts','contacts','committee','banking'].includes(key)){if(key==='banking'){const overview=document.createElement('div');overview.id='hf-bank-overview';overview.className='hf-table-wrap';panel.append(overview);}const rows=document.createElement('div');rows.dataset.rows='';panel.append(rows);(data[key]||[]).forEach(v=>addRow(key,v));panel.append(button(txt('+ បន្ថែម','+ Add entry'),()=>{addRow(key);dirty=true;}));}else if(key==='staff'){const note=document.createElement('p');note.className='hf-note';note.textContent=txt('បញ្ចូល និងរក្សាទុកឯកសារបុគ្គលិក។ ឯកសារមិនបង្កើតគណនីអ្នកប្រើប្រាស់ដោយស្វ័យប្រវត្តិទេ។','Upload and retain staff files. This does not automatically create user accounts.');panel.append(note,uploadControl('staff'));}else{const grid=document.createElement('div');grid.className='hf-grid';specs[key].forEach(spec=>grid.append(field(spec,data[key]?.[spec[0]])));if(key==='terms')grid.className='';panel.append(grid);if(key==='facility'){const a=document.createElement('a');a.href='/admin/organization';a.textContent=txt('ឈ្មោះ និងស្លាកសញ្ញា','Edit facility name and logo');panel.append(a);}if(key==='terms'){const note=document.createElement('p');note.className='hf-note';note.textContent=txt('បញ្ចូលលក្ខខណ្ឌដែលមន្ទីរពេទ្យបានអនុម័ត។','Enter the terms approved by your facility.');panel.append(note);}}if(key!=='staff')panel.append(button(txt('រក្សាទុក','Save'),()=>save(key),'hf-save'));});renderDocuments();choose(0);}
try{const me=await api('/api/auth/me');if(!['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(me.user?.activeRole))throw Error('Management access required.');csrf=me.csrfToken;const info=await api('/api/admin/health-facility'),branding=await api('/api/organization/branding');revision=info.revision;documents=info.documents;$('hf-name').textContent=txt(branding.nameKh,branding.nameEn||branding.nameKh);build(info.data);ready=true;await address(info.data.facility||{});sections.filter(s=>s[0]!=='staff').forEach(([k])=>snapshots.set(k,JSON.stringify(collect(k))));announce(info.updatedAt?(txt('បានរក្សាទុកចុងក្រោយ: ','Last saved: ')+new Date(info.updatedAt).toLocaleString()):txt('សូមបំពេញព័ត៌មាន និងចុចរក្សាទុក','Fill in information and save.'));}catch(e){announce(e.message);}
$('hf-prev').onclick=()=>choose(Math.max(0,current-1));$('hf-next').onclick=()=>choose(Math.min(sections.length-1,current+1));tabs.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();choose(e.key==='Home'?0:e.key==='End'?sections.length-1:(current+(e.key==='ArrowRight'?1:sections.length-1))%sections.length);tabs.children[current].focus();}};panels.addEventListener('input',()=>{dirty=true;renderBankTable();});window.addEventListener('beforeunload',e=>{if(hasChanges()){e.preventDefault();e.returnValue='';}});
})();
`;

fs.writeFileSync(hfPath, newHfCode, 'utf8');
console.log('Updated public/health-facility.js to clean Khmer mode');

console.log('All v36.9 updates applied successfully!');
