import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createEmrServer} from '../server/server.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const source=read('public/patient-card-print.js');
function studio(){const window={};vm.runInNewContext(source,{window,document:{}});return window.patientCardPrintStudio;}
test('A4 physical geometry contains exactly ten 80 × 35 mm labels within one printable page',()=>{
 const api=studio(),cfg=api.normalizeConfig({currentType:'a4_sheet'}),p=api.layout(cfg);
 assert.equal(p.count,10);assert.equal(p.columns,2);assert.equal(p.rows,5);assert.equal(p.gridWidth,162);assert.equal(p.gridHeight,183);
 assert.equal(p.valid,true);assert.equal(p.sheetWidth,190);assert.equal(p.sheetHeight,276.8);assert.ok(p.sheetHeight<297-20);
 assert.ok(p.x+p.gridWidth<=p.sheetWidth);assert.ok(p.y+p.gridHeight<=p.sheetHeight);
});
test('oversized dimensions and offsets are rejected instead of silently clipping labels',()=>{
 const api=studio();
 for(const changes of [{widthMm:150},{heightMm:100},{offsetTop:-15},{offsetLeft:30},{offsetLeft:-15},{widthMm:100,gapMm:20}])assert.equal(api.layout(api.normalizeConfig(changes)).valid,false,JSON.stringify(changes));
 const cfg=api.normalizeConfig({currentType:'thermal_80x35',offsetTop:3,offsetLeft:2});const p=api.layout(cfg);
 assert.equal(p.count,1);assert.equal(p.valid,true);assert.equal(p.pageWidth,82);assert.equal(p.pageHeight,38.2);assert.equal(p.gridWidth,80);assert.equal(p.gridHeight,35);
});
test('legacy fractional zoom restores to 100 percent; malformed settings stay finite',()=>{
 const api=studio();for(const scale of [undefined,1,1.25,0,-1,NaN,Infinity,'bad'])assert.equal(api.normalizeConfig({scale}).scale,100);
 assert.equal(api.normalizeConfig({scalePercent:'100',scale:1}).scale,100);assert.equal(api.normalizeConfig({scalePercent:125.7}).scale,126);
 const cfg=api.normalizeConfig({widthMm:'bad',heightMm:Infinity,gapMm:NaN,offsetTop:'bad',offsetLeft:Infinity,count:1000,currentType:'<script>'});
 assert.equal(cfg.widthMm,67);assert.equal(cfg.heightMm,35);assert.equal(cfg.count,10);assert.equal(cfg.currentType,'a5_sheet');
});
test('preview zoom never changes the printed physical layout or print scale',()=>{
 const api=studio();assert.equal(api.printCss(api.normalizeConfig({scale:100})),api.printCss(api.normalizeConfig({scale:200})));
 const css=api.printCss(api.normalizeConfig({currentType:'a4_sheet'}));assert.match(css,/@page \{ size: A4 portrait; margin: 10mm; \}/);assert.match(css,/height:276.8mm/);assert.match(css,/repeat\(2,80mm\)/);assert.match(css,/repeat\(5,35mm\)/);assert.match(css,/transform:none!important/);
});
function harness({config=null,fontGate=null,fontFailure=false,longText=false}={}){
 const nodes=new Map(),events=[],saved=[];
 class Element {
  constructor(tag='div'){this.tagName=tag;this.value='';this.children=[];this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.open=false;this.clientWidth=100;this.scrollWidth=100;this.clientHeight=133;this.scrollHeight=133;}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  replaceChildren(...items){this.children=items;this.innerHTML=items.length?'<img src="data:image/png;base64,QR">':'';}
  appendChild(c){this.children.push(c);return c;}setAttribute(){}removeAttribute(){}closest(){return null;}
  querySelector(s){if(s==='canvas')return this.canvas||null;if(s==='.card-footer-bar')return {getBoundingClientRect:()=>({bottom:110})};return null;}
  querySelectorAll(s){return s==='[id]'?[]:s==='.card-text'&&longText?[{style:{},scrollWidth:1000,clientWidth:100,getBoundingClientRect:()=>({height:14}),closest:()=>null}]:[];}
  getBoundingClientRect(){return {height:133,bottom:133,width:302};}
  cloneNode(){const copy=new Element();copy.innerHTML='<article>synthetic</article>';return copy;}
  showModal(){this.open=true;}remove(){events.push('remove-frame');}
 }
 const add=(id,v='')=>{const n=new Element();n.id=id;n.value=v;return n;};
 const fieldValues={card_print_type:'a4_sheet',card_custom_width:'80',card_custom_height:'35',card_custom_gap:'2',card_offset_top:'0',card_offset_left:'0',card_scale:'100',card_label_count:'10',web_health_id:'160201-261013-013',web_last_name:'សុខ',web_first_name:'ស្រីលក្ខណ៍',web_age:'0',web_dob:'2026-10-13',web_phone:'012345678',web_village:'ភូមិសាកល្បង',web_commune:'ឃុំសាកល្បង',web_district:'បរកែវ',web_province:'រតនគិរី'};
 Object.entries(fieldValues).forEach(([id,v])=>add(id,v));
 ['patient_card_dialog','card_template_element','card_print_container','card_print_button','card_preview_stage','card_preview_zoom','card_ruler_top','card_ruler_left','card_print_status','card_count_group','card_qr_container','card_lbl_id','card_lbl_name','card_lbl_age','card_lbl_sex','card_lbl_dob','card_lbl_phone','card_lbl_address'].forEach(id=>add(id));
 let afterprint,printedHtml='',frame;
 const fonts={ready:Promise.resolve(),load:async()=>{events.push('font');if(fontGate)await fontGate;if(fontFailure)throw Error('Synthetic font failure');return [{}];}};
 const frameDoc={fonts,images:[],open(){},write(html){printedHtml=html;},close(){},querySelector:s=>s.startsWith('link')?{sheet:{}}:null,querySelectorAll:s=>s==='.patient-id-card'?Array.from({length:10},()=>new Element()):[]};
 const doc={fonts,body:new Element(),getElementById:id=>nodes.get(id),querySelector:s=>s.startsWith('link')?{sheet:{}}:s.includes('sex_radio')?{value:'ស្រី'}:null,createElement:tag=>{const n=new Element(tag);if(tag==='iframe'){frame=n;n.contentDocument=frameDoc;n.contentWindow={document:frameDoc,requestAnimationFrame:fn=>fn(),addEventListener:(name,fn)=>{if(name==='afterprint')afterprint=fn;},focus(){},print(){events.push('print');}};}return n;}};
 const window={localStorage:{getItem:()=>config,setItem:(key,text)=>saved.push(JSON.parse(text))},QRCode:function(box){box.canvas={toDataURL:()=> 'data:image/png;base64,SYNTHETIC'};}};window.QRCode.CorrectLevel={M:0};
 vm.runInNewContext(source,{window,document:doc,console,setTimeout,clearTimeout,getComputedStyle:()=>({fontSize:'8',lineHeight:'14.8'})});
 return {window,nodes,events,saved,get printedHtml(){return printedHtml;},afterprint:()=>afterprint?.(),get frame(){return frame;}};
}
test('modal populates all six demographics without generating/changing a patient ID and saves only calibration',async()=>{
 const h=harness({config:JSON.stringify({scale:1,widthMm:80,heightMm:35})});h.window.openPatientCardPrintModal();
 await new Promise(r=>setImmediate(r));
 assert.equal(h.nodes.get('patient_card_dialog').open,true);assert.equal(h.nodes.get('card_lbl_name').textContent,'សុខ ស្រីលក្ខណ៍');assert.equal(h.nodes.get('card_lbl_id').textContent,'160201-261013-013');assert.equal(h.nodes.get('web_health_id').value,'160201-261013-013');assert.equal(h.nodes.get('card_lbl_age').textContent,'0 ឆ្នាំ');assert.equal(h.nodes.get('card_scale').value,100);assert.match(h.nodes.get('card_lbl_address').textContent,/រតនគិរី/);
 assert.equal(h.nodes.get('card_print_container').children.length,10);assert.equal(h.saved.at(-1).scalePercent,100);assert.doesNotMatch(JSON.stringify(h.saved),/160201|ស្រីលក្ខណ៍|012345678/);
});
test('print waits for the Khmer font, isolates ten labels, and keeps iframe until afterprint',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r),h=harness({fontGate:gate});h.window.openPatientCardPrintModal();const printing=h.window.printPatientCards();
 await new Promise(r=>setImmediate(r));assert.equal(h.events.includes('print'),false);resolve();await printing;
 assert.equal(h.events.includes('print'),true);assert.match(h.printedHtml,/class="card-print-document"/);assert.match(h.printedHtml,/patient-card-print.css\?v=(?:34[1-9]|35[0-3])0/);assert.equal(h.events.includes('remove-frame'),false);
 h.afterprint();assert.equal(h.events.includes('remove-frame'),true);
});
test('failed font loading stops printing and presents the error instead of printing fallback Khmer',async()=>{
 const h=harness({fontFailure:true});h.window.openPatientCardPrintModal();await h.window.printPatientCards();await new Promise(r=>setImmediate(r));assert.equal(h.events.includes('print'),false);assert.equal(h.nodes.get('card_print_status').dataset.error,'true');assert.match(h.nodes.get('card_print_status').textContent,/font failure/);
});
test('stale configuration during resource loading cannot print the previous patient/settings',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r),h=harness({fontGate:gate});h.window.openPatientCardPrintModal();const printing=h.window.printPatientCards();h.nodes.get('card_offset_top').value='3';h.window.updatePatientCardPreview();resolve();await printing;assert.equal(h.events.includes('print'),false);assert.match(h.nodes.get('card_print_status').textContent,/Settings changed/);
});
test('an overlong field stops printing at the minimum readable size without truncating patient data',()=>{
 const h=harness({longText:true});h.window.openPatientCardPrintModal();assert.equal(h.window.patientCardState.printable,false);assert.equal(h.nodes.get('card_print_button').disabled,true);assert.match(h.nodes.get('card_print_status').textContent,/Text does not fit/);assert.equal(h.nodes.get('web_last_name').value,'សុខ');
});
test('patient changes behind an open preview prevent printing the old snapshot',async()=>{
 const h=harness();h.window.openPatientCardPrintModal();await new Promise(r=>setImmediate(r));h.nodes.get('web_health_id').value='OTHER-PATIENT';await h.window.printPatientCards();assert.equal(h.events.includes('print'),false);assert.match(h.nodes.get('card_print_status').textContent,/Patient details changed/);
});
test('shared card CSS leaves Khmer glyphs visible and cannot hijack other form page sizes',()=>{
 const css=read('public/patient-card-print.css');assert.match(css,/Battambang-Regular.ttf/);assert.match(css,/line-height:1.85/);assert.doesNotMatch(css,/@page\s*\{/);assert.doesNotMatch(css,/body\s*\*/);assert.doesNotMatch(css,/-webkit-line-clamp|text-overflow:ellipsis|max-height:22px/);assert.doesNotMatch(css,/^\.patient-id-card/m);assert.match(css,/:is\(#patient_card_dialog,\.card-print-document\) \.patient-id-card/);
 const html=read('protected/EMR.html');assert.equal((html.match(/id="card_template_element"/g)||[]).length,1);assert.match(html,/class="card-address-row"/);assert.equal((html.slice(html.indexOf('<dialog id="patient_card_dialog"')).match(/<tr[ >]/g)||[]).length,6);
 assert.match(html,/id="card_scale"[^>]*data-emr-transient[^>]*data-emr-no-auto-index/);
});
test('server serves the actual shared stylesheet, script and Khmer font without touching stored patient data',async()=>{
 const app=createEmrServer({databasePath:':memory:',autoDatabase:false,nodeEnv:'test',port:0,host:'127.0.0.1'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;
 try {const before=JSON.stringify(app.database.listPatients());for(const [url,type]of [['/public/patient-card-print.css','text/css'],['/public/patient-card-print.js','text/javascript'],['/public/fonts/Battambang-Regular.ttf','font/ttf']]){const response=await fetch(origin+url);assert.equal(response.status,200,url);assert.match(response.headers.get('content-type'),new RegExp(type));assert.ok((await response.arrayBuffer()).byteLength>100);}assert.equal(JSON.stringify(app.database.listPatients()),before);}finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
