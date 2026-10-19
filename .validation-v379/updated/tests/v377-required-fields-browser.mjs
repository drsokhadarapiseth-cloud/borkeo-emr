import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

test('required-field gating in a real browser, including the actual Registration markup', () => {
  const candidates = [process.env.EMR_TEST_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
  const browser = candidates.find(file => fs.existsSync(file));
  assert.ok(browser, 'Set EMR_TEST_BROWSER to a Chromium executable to run this explicit browser check.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-required-'));
  const guard = fs.readFileSync('public/emr-required-fields.js', 'utf8');
  const emr = JSON.stringify(fs.readFileSync('protected/EMR.html', 'utf8')).replace(/</g, '\\u003c');
  const stock = JSON.stringify(fs.readFileSync('protected/stock.html', 'utf8')).replace(/</g, '\\u003c');
  const fixture = `<!doctype html><html lang="km"><head><meta charset="utf-8">
  <style>.page:not(.active),.sub-tab:not(.active){display:none}.emr-required-missing{outline:2px solid red}</style>
  <script>${guard}</script></head><body><main id="fixture"></main><pre id="result">pending</pre>
  <script>
  (async function(){
    const results=[];let failed=0;
    const root=document.getElementById('fixture');
    const api=window.BorkeoRequiredFields;
    function check(name,fn){try{fn();results.push({name,pass:true})}catch(e){failed++;results.push({name,pass:false,error:e.message})}}
    function ok(value,message='Assertion failed'){if(!value)throw Error(message)}
    function mount(html){root.innerHTML=html;return root.firstElementChild}
    function click(button){button.click()}
    function valid(scope){return api.validate(scope)}
    const text='<label>ឈ្មោះ <span>*</span></label><input id="name">';

    check('blocks a click before its inline and delegated transfer handlers',()=>{
      const form=mount('<section>'+text+'<button type="button" onclick="window.inlineTransfer=1">បញ្ជូនទៅផ្នែកទ្រីយ៉ា</button></section>');
      let calls=0;form.addEventListener('click',()=>calls++);click(form.querySelector('button'));
      ok(calls===0&&!window.inlineTransfer);ok(document.activeElement.id==='name');ok(form.querySelector('[role=alert]').textContent.includes('សូមបំពេញ'));
      form.querySelector('input').value='សុខ';click(form.querySelector('button'));ok(calls===1&&window.inlineTransfer===1);
    });
    check('whitespace is missing; numeric zero is filled',()=>{
      const form=mount('<form><label>ចំនួន *<input type="number" value="0"></label><label>កំណត់សម្គាល់ *<textarea>  </textarea></label></form>');
      ok(!valid(form));ok(!form.querySelector('input').classList.contains('emr-required-missing'));
      form.querySelector('textarea').value='បានបំពេញ';ok(valid(form));
    });
    check('radio and checkbox groups need a selection; individually required checkboxes must each be checked',()=>{
      const form=mount('<form><div class="input-group"><label>ភេទ *</label><label><input type="radio" name="sex">ប្រុស</label><label><input type="radio" name="sex">ស្រី</label></div><div class="input-group"><label>ជម្រើស *</label><label><input type="checkbox" name="a">ក</label><label><input type="checkbox" name="b">ខ</label></div><label>យល់ព្រម *<input type="checkbox" id="consent" required></label></form>');
      ok(!valid(form));form.querySelector('[name=sex]').checked=true;form.querySelector('[name=b]').checked=true;
      ok(!valid(form));form.querySelector('#consent').checked=true;ok(valid(form));
    });
    check('native required radio group accepts the other selected option',()=>{
      const form=mount('<form><input type="radio" name="choice" required><input type="radio" name="choice" checked></form>');ok(valid(form));
    });
    check('hidden, disabled, closed-dialog and inactive-page fields do not block',()=>{
      const form=mount('<section>'+text+'<div hidden><label>លាក់ *<input></label></div><label>បិទ *<input disabled required></label><dialog><label>ប្រអប់ *<input required></label></dialog><div class="page"><label>ទំព័រផ្សេង *<input required></label></div></section>');
      form.querySelector('#name').value='បានបំពេញ';ok(valid(form));
      form.querySelector('[hidden]').hidden=false;ok(!valid(form));
    });
    check('cancel, close, navigation and adding an input row remain available',()=>{
      const form=mount('<form><label>ត្រូវបំពេញ *<input required></label><button>បោះបង់</button><button type="button">បិទ</button><button type="button">បន្ទាប់</button><button type="button">បន្ថែមថ្នាំ</button><button data-close>×</button></form>');
      let calls=0;form.addEventListener('submit',e=>{e.preventDefault();calls++});form.querySelector('button').click();ok(calls===1);
      for(const button of form.querySelectorAll('[type=button]')){button.addEventListener('click',()=>calls++);button.click()}ok(calls===4);
      form.querySelector('[data-close]').click();ok(calls===5);
    });
    check('validates the action form rather than an unrelated visible form',()=>{
      mount('<section><form id="a"><label>ក *<input value="filled"></label><button>រក្សាទុក</button></form><form><label>ខ *<input></label></form></section>');
      let calls=0;document.getElementById('a').addEventListener('submit',e=>{e.preventDefault();calls++});document.querySelector('#a button').click();ok(calls===1);
    });
    check('external labels and form-associated external controls are required',()=>{
      mount('<section><label for="outside">ឈ្មោះ *</label><form id="f"></form><input id="outside" form="f"></section>');const form=document.getElementById('f');ok(!valid(form));document.getElementById('outside').value='សុខ';ok(valid(form));
    });
    check('dynamic approval dialog validates only its own fields',()=>{
      mount('<section><label>មិនពាក់ព័ន្ធ *<input></label></section>');
      const dialog=document.createElement('dialog');dialog.innerHTML='<label>មូលហេតុ *</label><input><button type="button" data-approve>អនុម័ត</button>';root.append(dialog);dialog.show();
      let calls=0;dialog.querySelector('button').addEventListener('click',()=>calls++);dialog.querySelector('button').click();ok(calls===0);dialog.querySelector('input').value='បានពិនិត្យ';dialog.querySelector('button').click();ok(calls===1);dialog.close();
    });
    check('custom nationality dropdown validates its stored select and focuses its visible button',()=>{
      const form=mount('<section><div class="input-group"><label>ជនជាតិ *</label><div class="emr-nat-wrapper"><select style="display:none"><option value=""></option><option value="kh">ខ្មែរ</option></select><button type="button" class="emr-nat-btn">ជ្រើសរើស</button><input style="display:none" class="emr-nat-search-input"></div></div></section>');
      ok(!valid(form));ok(document.activeElement.classList.contains('emr-nat-btn'));form.querySelector('select').value='kh';ok(valid(form));
    });
    check('two starred blood-pressure controls are both required; hidden pediatric star is exempt',()=>{
      const form=mount('<section><table><tr><td><span>សម្ពាធឈាម</span><span class="required-star">*</span><input id="sys">/<input id="dia"></td></tr></table></section>');
      form.querySelector('#sys').value='120';ok(!valid(form));ok(document.activeElement.id==='dia');form.querySelector('#dia').value='80';ok(valid(form));
      form.querySelector('#sys').value='';form.querySelector('.required-star').hidden=true;ok(valid(form));
    });
    check('select multiple and file required fields require actual values',()=>{
      const form=mount('<form><label>ជម្រើស *<select multiple><option value="a">ក</option></select></label><label>ឯកសារ *<input type="file"></label></form>');ok(!valid(form));
      form.querySelector('option').selected=true;const transfer=new DataTransfer();transfer.items.add(new File(['synthetic'],'test.txt'));form.querySelector('input').files=transfer.files;ok(valid(form));
    });
    check('keyboard submit events and programmatic form.submit are blocked',()=>{
      const form=mount('<form>'+text+'<button>រក្សាទុក</button></form>');let calls=0;form.addEventListener('submit',e=>{e.preventDefault();calls++});form.requestSubmit();ok(calls===0);
      let navigation=0;const before=location.href;form.submit();ok(location.href===before);form.querySelector('input').value='សុខ';form.requestSubmit();ok(calls===1);
    });
    check('first missing field follows document order across native and visual required markers',()=>{
      const form=mount('<form><label>ទីមួយ *<input id="first"></label><input required id="second"></form>');ok(!valid(form));ok(document.activeElement.id==='first');
    });
    check('an asterisk in an option value or clinical footnote does not require an optional field',()=>{
      const form=mount('<section><label>ជម្រើស<select><option value="">Test *</option></select></label><p>*សម្គាល់</p><input></section>');ok(valid(form));
    });
    check('all save, send, approve and transfer actions block without writing',()=>{
      for(const label of ['រក្សាទុក','ផ្ញើ','អនុម័ត','បញ្ជូន','Save','Submit','Send','Approve','Transfer']){
        const form=mount('<section>'+text+'<button type="button">'+label+'</button></section>');let calls=0;form.querySelector('button').addEventListener('click',()=>calls++);form.querySelector('button').click();ok(calls===0,label);
      }
    });
    check('actual Registration asterisks: individual fields and all choice groups block edits and transfers',()=>{
      const parsed=new DOMParser().parseFromString(${emr},'text/html');const registration=parsed.getElementById('web-admission');
      for(const element of registration.querySelectorAll('*'))for(const attr of [...element.attributes])if(attr.name.startsWith('on'))element.removeAttribute(attr.name);
      root.replaceChildren(document.importNode(registration,true));const form=root.firstElementChild;
      ok(!valid(form));ok(document.activeElement.id==='web_health_id');
      function fill(){for(const field of form.querySelectorAll('input,select,textarea')){
        if(field.type==='radio'){if(!form.querySelector('input[type=radio][name="'+field.name+'"]:checked'))field.checked=true}
        else if(field.tagName==='SELECT'){if(!field.value){const option=new Option('សាកល្បង','synthetic');field.add(option);field.value='synthetic'}}
        else if(!['hidden','file','checkbox'].includes(field.type)){field.value=field.type==='date'?'2026-10-18':field.type==='time'?'10:30':'សាកល្បង'}
      }}
      fill();ok(valid(form),'filled registration should pass');
      const ids=['web_health_id','web_last_name','web_first_name','web_phone','web_province','web_district','web_commune','web_village','web_caregiver_name','web_caregiver_phone','web_caregiver_relation'];
      for(const id of ids){const field=form.querySelector('#'+id);ok(field,'missing fixture field '+id);if(field.disabled)continue;const old=field.value;field.value='';ok(!valid(form),'should require '+id);ok(document.activeElement===field,'should focus '+id);field.value=old;ok(valid(form),'restored '+id)}
      for(const name of ['other_id','sex_radio','emr_pmrs_case_type','marital','disability','web_caregiver_sex']){
        const fields=[...form.querySelectorAll('input[type=radio][name="'+name+'"]')];ok(fields.length>0,name);fields.forEach(f=>f.checked=false);ok(!valid(form),'should require '+name);fields[0].checked=true;ok(valid(form),'restored '+name);
      }
      const occupation=[...form.querySelectorAll('.input-group')].find(g=>g.querySelector('label')?.textContent.includes('មុខរបរ')).querySelector('select');
      occupation.value='';ok(!valid(form),'occupation required');occupation.value='ផ្សេងៗ';const other=form.querySelector('#reg_occupation_other');other.style.display='';other.value='';ok(!valid(form),'other occupation required when shown');other.value='សាកល្បង';ok(valid(form));
      let transfers=0;const button=form.querySelector('.btn-next');button.addEventListener('click',()=>transfers++);form.querySelector('#web_health_id').value='';button.click();ok(transfers===0);form.querySelector('#web_health_id').value='synthetic';button.click();ok(transfers===1);
    });
    function fillAll(form){for(const field of form.querySelectorAll('input,select,textarea')){
      if(field.type==='radio'){if(![...form.querySelectorAll('input[type=radio]')].some(peer=>peer.name===field.name&&peer.checked))field.checked=true}
      else if(field.type==='checkbox')field.checked=true;
      else if(field.tagName==='SELECT'){if(!field.value){field.add(new Option('សាកល្បង','synthetic'));field.value='synthetic'}}
      else if(!['hidden','file','button','submit'].includes(field.type)){field.value=field.type==='number'?'1':field.type==='date'?'2026-10-18':field.type==='datetime-local'?'2026-10-18T10:30':'សាកល្បង'}
    }}
    check('actual ANC required case, pregnancy count and diagnosis fields block saves',()=>{
      const parsed=new DOMParser().parseFromString(${emr},'text/html');const form=document.importNode(parsed.getElementById('sub_anc'),true);form.classList.add('active');
      for(const element of form.querySelectorAll('*'))for(const attr of [...element.attributes])if(attr.name.startsWith('on'))element.removeAttribute(attr.name);
      root.replaceChildren(form);fillAll(form);ok(valid(form),'filled ANC');
      const cases=[...form.querySelectorAll('[name=anc_case_type]')];cases.forEach(field=>field.checked=false);ok(!valid(form),'case required');cases[0].checked=true;ok(valid(form));
      for(const field of [form.querySelector('input[type=number]'),[...form.querySelectorAll('.input-group')].find(group=>group.querySelector('label')?.textContent.includes('រោគវិនិច្ឆ័យចូល')).querySelector('select')]){
        const old=field.value;field.value='';ok(!valid(form),'ANC field required');field.value=old;ok(valid(form));
      }
    });
    check('actual stock editor and a dynamically renamed starred label require values',()=>{
      const parsed=new DOMParser().parseFromString(${stock},'text/html');const form=document.importNode(parsed.getElementById('stock-add'),true);root.replaceChildren(form);fillAll(form);ok(valid(form),'filled stock');
      const field=form.querySelector('[name=name]');form.querySelector('#stock-name-label').textContent='ឈ្មោះឱសថ *';field.value='';ok(!valid(form));field.value='សាកល្បង';ok(valid(form));
    });
    const iframe=document.createElement('iframe');iframe.srcdoc='<form><label>ឈ្មោះ *<input></label><button type="button">រក្សាទុក</button></form>';
    root.replaceChildren(iframe);await new Promise(resolve=>iframe.addEventListener('load',resolve,{once:true}));
    check('embedded specialty form installs validation in its own window',()=>{
      let calls=0;const doc=iframe.contentDocument;doc.querySelector('button').addEventListener('click',()=>calls++);doc.querySelector('button').click();ok(calls===0);ok(iframe.contentWindow.BorkeoRequiredFields);doc.querySelector('input').value='សុខ';doc.querySelector('button').click();ok(calls===1);
    });
    check('parent save includes visible embedded forms and exempts hidden ones',()=>{
      iframe.contentDocument.querySelector('input').value='';ok(!valid(root));iframe.hidden=true;ok(valid(root));iframe.hidden=false;iframe.contentDocument.querySelector('input').value='សុខ';ok(valid(root));
    });
    document.getElementById('result').textContent=JSON.stringify({failed,results});
  })().catch(error=>{document.getElementById('result').textContent=JSON.stringify({fatal:error.message})});
  </script></body></html>`;
  fs.writeFileSync(path.join(directory, 'fixture.html'), fixture);
  try {
    const run = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
      '--disable-background-networking', '--no-default-browser-check', '--user-data-dir=' + path.join(directory, 'profile'),
      '--dump-dom', '--virtual-time-budget=4000', pathToFileURL(path.join(directory, 'fixture.html')).href],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
    assert.ifError(run.error);
    const result = run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(result && result !== 'pending', 'Browser fixture did not finish: ' + run.stderr.slice(-1500));
    const report = JSON.parse(result.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
    console.log(JSON.stringify(report));
    assert.equal(report.fatal, undefined);
    assert.equal(report.failed, 0, JSON.stringify(report.results?.filter(row => !row.pass)));
    assert.ok(report.results.length >= 17);
  } finally {
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('borkeo-required-'));
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
});
