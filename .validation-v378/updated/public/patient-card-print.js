/* Borkeo EMR v35.3: isolated sticker studio. No patient/database writes. */
(function () {
    'use strict';
    const MM = 96 / 25.4;
    const defaults = {currentType:'a5_sheet',widthMm:67,heightMm:35,gapMm:2.5,gapX:2.5,gapY:2.5,count:10,offsetTop:0,offsetLeft:0,scale:100,qrText:''};
    const state = Object.assign({}, defaults);
    let revision = 0, busy = false, openedSignature = '';
    const el = id => document.getElementById(id);
    const value = id => (el(id)?.value || '').trim();
    const patientSignature = () => JSON.stringify(['web_health_id','web_last_name','web_first_name','web_age','web_dob','web_phone','web_village','web_commune','web_district','web_province'].map(value).concat(document.querySelector('input[name="sex_radio"]:checked')?.value||''));
    function number(val, fallback, min, max) {
        if (val === '' || val === null || val === undefined) return fallback;
        const n = Number(val);
        return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback;
    }
    function normalizeConfig(cfg = {}) {
        const types = ['a5_sheet','a4_sheet','thermal_80x35','card_85x54'];
        const type = types.includes(cfg.currentType) ? cfg.currentType : 'a5_sheet';
        const isA5 = type === 'a5_sheet';
        const defaultW = isA5 ? 67 : (type === 'card_85x54' ? 85.6 : 80);
        const defaultH = type === 'card_85x54' ? 54 : 35;
        const isMulti = type === 'a5_sheet' || type === 'a4_sheet'; // count:type==='a4_sheet'?10:1
        const raw = Number(cfg.scalePercent ?? cfg.scale ?? 100);
        const zoom = Number.isFinite(raw) && raw > 2 ? Math.round(number(raw,100,25,200)) : 100;
        const defaultGap = isA5 ? 2.5 : 2;
        const fallbackGap = cfg.gapMm !== undefined ? number(cfg.gapMm, defaultGap, 0, 20) : defaultGap;
        const gx = number(cfg.gapX !== undefined ? cfg.gapX : fallbackGap, defaultGap, 0, 20);
        const gy = number(cfg.gapY !== undefined ? cfg.gapY : fallbackGap, defaultGap, 0, 20);
        return {
            currentType: type,
            widthMm: number(cfg.widthMm, defaultW, 50, 150),
            heightMm: number(cfg.heightMm, defaultH, 25, 100),
            gapMm: gx,
            gapX: gx,
            gapY: gy,
            count: isMulti ? number(cfg.count, 10, 1, 10) : 1,
            offsetTop: number(cfg.offsetTop, 0, -15, 30),
            offsetLeft: number(cfg.offsetLeft, 0, -15, 30),
            scale: zoom
        };
    }
    function layout(cfg) {
        const isA5 = cfg.currentType === 'a5_sheet', a4 = cfg.currentType === 'a4_sheet', isMulti = isA5 || a4;
        const columns = isMulti ? 2 : 1, rows = isMulti ? 5 : 1; // columns = a4 ? 2 : 1, rows = a4 ? 5 : 1
        const gapX = cfg.gapX !== undefined ? cfg.gapX : (cfg.gapMm ?? 2.5);
        const gapY = cfg.gapY !== undefined ? cfg.gapY : (cfg.gapMm ?? 2.5);
        const gridWidth = columns * cfg.widthMm + (columns - 1) * gapX;
        const gridHeight = rows * cfg.heightMm + (rows - 1) * gapY;
        const pageWidth = isA5 ? 148 : (a4 ? 210 : cfg.widthMm + Math.max(0, cfg.offsetLeft));
        const pageHeight = isA5 ? 210 : (a4 ? 297 : cfg.heightMm + Math.max(0, cfg.offsetTop) + 0.2);
        const sheetWidth = isA5 ? 138 : (a4 ? 190 : pageWidth);
        const sheetHeight = isA5 ? 199.8 : (a4 ? 276.8 : pageHeight - 0.2); // sheetHeight = a4 ? 276.8
        const x = isA5 ? (sheetWidth - gridWidth) / 2 + cfg.offsetLeft : (a4 ? (sheetWidth - gridWidth) / 2 + cfg.offsetLeft : cfg.offsetLeft);
        const y = isA5 ? (sheetHeight - gridHeight) / 2 + cfg.offsetTop : (a4 ? 5 + cfg.offsetTop : cfg.offsetTop);
        const valid = x >= 0 && y >= 0 && x + gridWidth <= sheetWidth + 0.001 && y + gridHeight <= sheetHeight + 0.001;
        return {isA5, a4, isMulti, columns, rows, count: isMulti ? cfg.count : 1, maxCount: columns * rows, gapX, gapY, gridWidth, gridHeight, pageWidth, pageHeight, sheetWidth, sheetHeight, x, y, valid};
    }
    const fields = {card_print_type:'currentType',card_custom_width:'widthMm',card_custom_height:'heightMm',card_custom_gap:'gapMm',card_custom_gap_x:'gapX',card_custom_gap_y:'gapY',card_label_count:'count',card_offset_top:'offsetTop',card_offset_left:'offsetLeft',card_scale:'scale'};
    function writeControls() {
        Object.entries(fields).forEach(([id,key])=>{if(el(id))el(id).value=state[key];});
        if(el('card_label_count'))el('card_label_count').value=state.count;
    }
    function loadSavedStickerConfig() {
        let cfg = {};
        try {
            const raw = window.localStorage.getItem('borkeo_sticker_cfg');
            if (raw) cfg = JSON.parse(raw) || {};
        } catch (_) {}
        // Upgrade stale/unsupported configs (< 349, missing type, or legacy single-card card_85x54) to a5_sheet
        if (!cfg.configVersion || cfg.configVersion < 353 || cfg.currentType === 'card_85x54' || !cfg.currentType) {
            cfg = { currentType: 'a5_sheet', widthMm: 67, heightMm: 35, gapMm: 2, count: 10, offsetTop: 0, offsetLeft: 0, scale: 100, configVersion: 353 };
            try { window.localStorage.setItem('borkeo_sticker_cfg', JSON.stringify(cfg)); } catch (_) {}
        }
        Object.assign(state, normalizeConfig(cfg));
        writeControls();
    }
    function saveStickerConfig() {
        try { window.localStorage.setItem('borkeo_sticker_cfg', JSON.stringify({...normalizeConfig(state), scalePercent: state.scale, configVersion: 353})); } catch (_) {}
    }
    function renderCardQR(containerId, text) {
        const box = el(containerId);if(!box)return;
        box.replaceChildren();
        if(!text)return;
        if(typeof window.QRCode !== 'function')throw new Error('QR code library is unavailable. Refresh this page.');
        new window.QRCode(box,{text,width:192,height:192,colorDark:'#000000',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
        const canvas=box.querySelector('canvas');
        const source=canvas ? canvas.toDataURL('image/png') : box.querySelector('img')?.src;
        if(!source || !source.startsWith('data:image/'))throw new Error('QR code could not be generated.');
        const img=document.createElement('img');img.src=source;img.alt='Health ID QR';img.width=192;img.height=192;box.replaceChildren(img);
    }
    function status(text, error=false) {
        const node=el('card_print_status');if(node){node.textContent=text;node.dataset.error=String(error);}
    }
    function ruler(axis, length) {
        const node=el(axis==='x'?'card_ruler_top':'card_ruler_left');if(!node)return;
        node.replaceChildren();
        for(let mm=0;mm<=length;mm+=10){const tick=document.createElement('span');tick.textContent=mm;tick.style[axis==='x'?'left':'top']=mm*MM+'px';node.appendChild(tick);}
    }
    function fitCard(card) {
        let ok=true;
        card.querySelectorAll('.card-text').forEach(text=>{
            text.style.fontSize='';
            let size=parseFloat(getComputedStyle(text).fontSize);
            const min=6.4, lines=text.closest('.card-address-row')?2:1;
            const fits=()=>text.scrollWidth<=text.clientWidth+1 && text.getBoundingClientRect().height<=parseFloat(getComputedStyle(text).lineHeight)*lines+1;
            while(!fits() && size>min+0.05){size=Math.max(min,size-0.2);text.style.fontSize=size+'px';}
            if(!fits())ok=false;
        });
        const bounds=card.getBoundingClientRect(),footer=card.querySelector('.card-footer-bar')?.getBoundingClientRect();
        if(footer && footer.bottom>bounds.bottom-1)ok=false;
        if(card.scrollHeight>card.clientHeight+1 || card.scrollWidth>card.clientWidth+1)ok=false;
        return ok;
    }
    function copyCards() {
        const source=el('card_template_element'),grid=el('card_print_container');if(!source||!grid)return;
        grid.replaceChildren();
        for(let i=0;i<state.count;i++){
            const card=source.cloneNode(true);card.removeAttribute('id');
            card.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
            card.style.transform='none';card.style.margin='0';grid.appendChild(card);
        }
    }
    function updatePatientCardPreview() {
        const cfg={};Object.entries(fields).forEach(([id,key])=>{cfg[key]=el(id)?.value ?? state[key];});
        if(cfg.currentType==='a5_sheet' && state.currentType!=='a5_sheet'){cfg.widthMm=67;cfg.heightMm=35;cfg.gapMm=2.5;cfg.gapX=2.5;cfg.gapY=2.5;}
        else if(cfg.currentType==='a4_sheet' && state.currentType!=='a4_sheet'){cfg.widthMm=80;cfg.heightMm=35;cfg.gapMm=2.5;cfg.gapX=2.5;cfg.gapY=2.5;}
        else if(cfg.currentType==='card_85x54' && state.currentType!=='card_85x54'){cfg.widthMm=85.6;cfg.heightMm=54;}
        else if(cfg.currentType==='thermal_80x35' && state.currentType!=='thermal_80x35'){cfg.widthMm=80;cfg.heightMm=35;}
        Object.assign(state,normalizeConfig(cfg));writeControls();saveStickerConfig();revision++;
        const card=el('card_template_element'),stage=el('card_preview_stage'),zoom=el('card_preview_zoom');if(!card||!stage||!zoom)return;
        card.style.width=state.widthMm+'mm';card.style.height=state.heightMm+'mm';
        card.style.setProperty('--card-font-scale',state.currentType==='a5_sheet'?Math.min(1.0,(state.heightMm/35)*(state.widthMm/67)*0.95):Math.min(1.15,state.heightMm/35));
        // Zoom belongs to the studio only. Printed millimetres and the A5/A4 grid never change.
        zoom.style.transform='scale(1)';
        const textFits=el('patient_card_dialog')?.open ? fitCard(card) : true;
        const factor=state.scale/100, width=state.widthMm*MM, height=state.heightMm*MM;
        zoom.style.width=width+'px';zoom.style.height=height+'px';zoom.style.transform='scale('+factor+')';
        stage.style.width=(width+30)*factor+'px';stage.style.height=(height+30)*factor+'px';
        ruler('x',state.widthMm);ruler('y',state.heightMm);
        const result=layout(state);state.printable=result.valid&&textFits&&!!state.qrText;
        const button=el('card_print_button');if(button)button.disabled=!state.printable||busy;
        const countGroup=el('card_count_group');if(countGroup)countGroup.hidden=!result.isMulti;
        if(!result.valid)status('ទំហំ ឬគែមមិនអាចដាក់ស្លាកទាំងអស់លើមួយទំព័រ។ / Size or offsets do not fit one page.',true);
        else if(!textFits)status('អត្ថបទវែងពេក។ សូមបង្កើនទំហំស្លាក។ / Text does not fit; increase label size. Nothing will be cut off.',true);
        else if(!state.qrText)status('សូមបញ្ចូលលេខប័ណ្ណមុនបោះពុម្ព។ / A Health ID is required.',true);
        else if(result.isA5)status('A5 Portrait · ' + state.count + ' ស្លាក · 2 × 5 · 1 ទំព័រ · Top '+(5+result.y).toFixed(1)+' mm / Left '+(5+result.x).toFixed(1)+' mm · Print 100%');
        else if(result.a4)status('A4 Portrait · ' + state.count + ' ស្លាក · 2 × 5 · 1 ទំព័រ · Top '+(10+result.y).toFixed(1)+' mm / Left '+(10+result.x).toFixed(1)+' mm · Print 100%');
        else status('1 ស្លាក / Label · Print 100% / Actual size');
        copyCards();
    }
    async function ready(doc, root=doc) {
        const stylesheet=doc.querySelector('link[href*="patient-card-print.css"]');
        if(stylesheet && !stylesheet.sheet)await new Promise((resolve,reject)=>{stylesheet.addEventListener('load',resolve,{once:true});stylesheet.addEventListener('error',()=>reject(new Error('The sticker stylesheet did not load.')),{once:true});});
        return Promise.all([
            doc.fonts.load('8px "EMR Sticker Khmer"','ប័ណ្ណ អាយុ កំណើត អាសយដ្ឋាន រតនគិរី').then(fonts=>{if(!fonts.length)throw new Error('The Khmer print font did not load.');return doc.fonts.ready;}),
            ...Array.from(root.querySelectorAll('img'),img=>img.decode ? img.decode() : new Promise((resolve,reject)=>{if(img.complete)return img.naturalWidth?resolve():reject(new Error('Image did not load.'));img.onload=resolve;img.onerror=reject;}))
        ]);
    }
    function timeout(promise, ms) {
        return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Print resources took too long to load.')),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
    }
    function printCss(cfg) {
        const p=layout(cfg);
        let pageRule;
        if(p.isA5) {
            pageRule = '@page { size: A5 portrait; margin: 5mm; }';
        } else if(p.a4) {
            pageRule = '@page { size: A4 portrait; margin: 10mm; }';
        } else {
            pageRule = '@page { size: '+p.pageWidth+'mm '+p.pageHeight+'mm; margin: 0; }';
        }
        const fontScale = p.isA5
            ? Math.min(1.0, (cfg.heightMm/35) * (cfg.widthMm/67) * 0.95)
            : Math.min(1.15, cfg.heightMm/35);
        return pageRule +
            'html,body{margin:0!important;padding:0!important;width:'+p.sheetWidth+'mm!important;min-height:0!important;height:auto!important;background:#fff!important;overflow:hidden!important;box-sizing:border-box!important;}' +
            '.print-sheet{position:relative!important;width:'+p.sheetWidth+'mm!important;height:'+p.sheetHeight+'mm!important;max-height:'+p.sheetHeight+'mm!important;box-sizing:border-box!important;margin:0!important;padding:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;break-after:auto!important;page-break-after:auto!important;}' +
            '.print-grid{position:absolute!important;left:'+p.x+'mm!important;top:'+p.y+'mm!important;display:grid!important;grid-template-columns:repeat('+p.columns+','+cfg.widthMm+'mm)!important;grid-template-rows:repeat('+p.rows+','+cfg.heightMm+'mm)!important;column-gap:'+p.gapX+'mm!important;row-gap:'+p.gapY+'mm!important;width:'+p.gridWidth+'mm!important;height:'+p.gridHeight+'mm!important;align-content:start!important;margin:0!important;padding:0!important;box-sizing:border-box!important;}' +
            '.patient-id-card{width:'+cfg.widthMm+'mm!important;height:'+cfg.heightMm+'mm!important;min-width:'+cfg.widthMm+'mm!important;min-height:'+cfg.heightMm+'mm!important;margin:0!important;box-sizing:border-box!important;transform:none!important;box-shadow:none!important;break-inside:avoid!important;page-break-inside:avoid!important;visibility:visible!important;display:flex!important;flex-direction:column!important;--card-font-scale:'+fontScale+';}';
    }
    async function printPatientCards() {
        if(busy)return;
        if(patientSignature()!==openedSignature){status('Patient details changed. Close and reopen this preview before printing.',true);return;}
        updatePatientCardPreview();if(!state.printable)return;
        busy=true;if(el('card_print_button'))el('card_print_button').disabled=true;
        let frame;
        const cleanup=()=>{if(frame){frame.remove();frame=null;}busy=false;updatePatientCardPreview();};
        try {
            const started=revision;
            await timeout(ready(document,el('card_template_element')),15000);
            if(started!==revision)throw new Error('Settings changed while preparing print. Please print again.');
            if(patientSignature()!==openedSignature)throw new Error('Patient details changed. Reopen this preview before printing.');
            updatePatientCardPreview();if(!state.printable)throw new Error('The label content does not fit.');
            const cfg={...state};
            const source=el('card_template_element');
            if(!source)throw new Error('Card template element not found.');

            copyCards();
            const grid=el('card_print_container');
            el('card_print_iframe')?.remove();frame=document.createElement('iframe');frame.id='card_print_iframe';frame.title='Patient sticker print';frame.setAttribute('aria-hidden','true');
            Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:(cfg.currentType==='a5_sheet'?'148mm':(cfg.currentType==='a4_sheet'?'210mm':cfg.widthMm+'mm')),height:(cfg.currentType==='a5_sheet'?'210mm':(cfg.currentType==='a4_sheet'?'297mm':cfg.heightMm+'mm')),border:'0'});document.body.appendChild(frame);
            const doc=frame.contentDocument;
            doc.open();
            doc.write('<!DOCTYPE html><html lang="km"><head><meta charset="utf-8"><title>Patient Stickers</title><link rel="stylesheet" href="/public/patient-card-print.css?v=3530"><style>'+printCss(cfg)+'</style></head><body class="card-print-document"><main class="print-sheet"><div class="print-grid">'+(grid?grid.innerHTML:'')+'</div></main></body></html>');
            doc.close();

            const count = cfg.count;
            let cards=Array.from(doc.querySelectorAll('.patient-id-card'));
            if(cards.length<count && source){
                const printGrid=doc.querySelector?.('.print-grid');
                if(printGrid){
                    printGrid.replaceChildren();
                    for(let i=0;i<count;i++){
                        const card=source.cloneNode(true);card.removeAttribute('id');
                        card.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
                        card.style.transform='none';card.style.margin='0';
                        card.style.visibility='visible';card.style.display='flex';
                        printGrid.appendChild(card);
                    }
                    cards=Array.from(doc.querySelectorAll('.patient-id-card'));
                }
            }

            const printRevision=revision;
            await timeout(ready(doc),15000);
            await timeout(new Promise(resolve=>frame.contentWindow.requestAnimationFrame(()=>frame.contentWindow.requestAnimationFrame(resolve))),3000);
            if(printRevision!==revision)throw new Error('Settings changed while preparing print. Please print again.');
            if(patientSignature()!==openedSignature)throw new Error('Patient details changed. Reopen this preview before printing.');

            // Final pre-print inspection: exactly the expected number of cards
            if(cards.length!==count)throw new Error('Expected '+count+' labels, found '+cards.length+'.');
            if(cards.length!==cfg.count)throw new Error('Expected '+cfg.count+' labels, found '+cards.length+'.');
            if(!cards.every(fitCard))throw new Error('The printed label content does not fit. Increase label size.');

            frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});
            status('បោះពុម្ព / Printing · '+(cfg.currentType==='a5_sheet'?'A5 Portrait':(cfg.currentType==='a4_sheet'?'A4 Portrait':'Label'))+' · 100% / Actual size · Headers and footers off');
            frame.contentWindow.focus();frame.contentWindow.print();
            busy=false;if(el('card_print_button'))el('card_print_button').disabled=false;
        } catch(error) {cleanup();status(error.message,true);}
    }
    function openPatientCardPrintModal() {
        const dialog=el('patient_card_dialog');if(!dialog)return;
        const fullName=[value('web_last_name'),value('web_first_name')].filter(Boolean).join(' ')||'—';
        const age=value('web_age');
        const data={card_lbl_name:fullName,card_lbl_sex:document.querySelector('input[name="sex_radio"]:checked')?.value||'—',card_lbl_age:age?(age.includes('ឆ្នាំ')?age:age+' ឆ្នាំ'):'—',card_lbl_dob:value('web_dob')||'—',card_lbl_phone:value('web_phone')||'—',card_lbl_address:['web_village','web_commune','web_district','web_province'].map(value).filter(Boolean).join(', ')||'—',card_lbl_id:value('web_health_id')||'—'};
        Object.entries(data).forEach(([id,text])=>{if(el(id))el(id).textContent=text;});
        openedSignature=patientSignature();
        state.qrText=data.card_lbl_id==='—'?'':data.card_lbl_id;
        loadSavedStickerConfig();
        if(!dialog.open)dialog.showModal();
        try {renderCardQR('card_qr_container',state.qrText);updatePatientCardPreview();const started=revision;timeout(ready(document,el('card_template_element')),15000).then(()=>{if(dialog.open&&started===revision)updatePatientCardPreview();}).catch(error=>{state.printable=false;if(el('card_print_button'))el('card_print_button').disabled=true;status(error.message,true);});}
        catch(error){state.printable=false;if(el('card_print_button'))el('card_print_button').disabled=true;status(error.message,true);}
    }
    window.patientCardState=state;
    window.patientCardPrintStudio={normalizeConfig,layout,printCss};
    window.openPatientCardPrintModal = openPatientCardPrintModal;
    window.updatePatientCardPreview = updatePatientCardPreview;
    window.printPatientCards = printPatientCards;
    window.renderCardQR = renderCardQR;
})();
