'use strict';
// Print only the linked report in the browser's native preview. Never save or sign.
(() => {
  let activePrint = null;
  const bounded = (promise, milliseconds = 4000) => Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise(resolve => setTimeout(resolve, milliseconds)),
  ]);
  const nextFrame = (win, fallbackMs = 50) => new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      if (win && typeof win.requestAnimationFrame === 'function') {
        win.requestAnimationFrame(finish);
      }
    } catch {}
    setTimeout(finish, fallbackMs);
  });
  // Apply print rules while measuring, and suppress screen-only decoration.
  const printMedia = css => css.replace(/@media\s+print\b/gi, '@media all')
    .replace(/@media\s+screen\b/gi, '@media not all');

  function snapshot(source, sectionClasses) {
    const copy = source.cloneNode(true);
    const originals = source.querySelectorAll('input,textarea,select');
    copy.querySelectorAll('input,textarea,select').forEach((control, index) => {
      const original = originals[index];
      if (['hidden','file','button','submit'].includes(original.type)) { control.remove(); return; }
      const value = document.createElement('span');
      value.className = 'emr-print-value ' + control.className;
      value.style.cssText = control.style.cssText;
      // Measurements need only their displayed value, rather than the empty
      // input's fixed width. Keep the label, value and unit on the same line.
      if (/^(?:p2|opd|ipd)_(?:temp|bp_sys|bp_dia|weight|height|pulse|resp|spo2)$/.test(original.id)) {
        value.classList.add('emr-print-number');
        const cell = control.closest('td');
        if (cell) cell.classList.add('emr-print-measurement');
      }
      if (original.type === 'checkbox' || original.type === 'radio') {
        value.textContent = original.checked ? '☑' : '☐';
        value.classList.add('emr-print-check');
        if (source.id === 'page2' && original.type === 'checkbox') {
          value.classList.add('emr-triage-check');
          value.textContent = original.checked ? '✓' : '';
          value.dataset.checked = String(original.checked);
        }
      } else {
        value.textContent = original.tagName === 'SELECT'
          ? (original.selectedOptions[0]?.textContent || '') : (original.value || '\u00a0');
        if (original.tagName === 'TEXTAREA') value.classList.add('emr-print-multiline');
      }
      control.replaceWith(value);
    });
    const canvases = source.querySelectorAll('canvas');
    copy.querySelectorAll('canvas').forEach((canvas,index) => {
      try { const img=document.createElement('img'); img.src=canvases[index].toDataURL(); img.className=canvas.className; img.width=canvas.width; img.height=canvas.height; canvas.replaceWith(img); } catch { canvas.remove(); }
    });
    copy.querySelectorAll('.no-print,.print-toolbar,button,script,iframe,object,embed,.emr-editor-history,.patient-summary-tab,.patient-summary-drawer,tr.print-empty-medication-row').forEach(node => node.remove());
    [copy,...copy.querySelectorAll('*')].forEach(node => {
      [...node.attributes].forEach(attr => { if (/^on/i.test(attr.name)) node.removeAttribute(attr.name); });
      node.removeAttribute('contenteditable');
    });
    copy.style.removeProperty('display'); copy.style.removeProperty('visibility');
    copy.style.setProperty('display',copy.id==='print-rx-layout'?'flex':'block','important');
    copy.style.setProperty('content-visibility','visible','important');
    copy.removeAttribute('hidden'); copy.removeAttribute('aria-hidden');
    copy.classList.remove('emr-workflow-hidden','emr-permission-hidden');
    copy.classList.add('emr-print-section',...sectionClasses);
    return copy;
  }

  function withAncestors(source, copy) {
    // Preserve the report's scoped layout rules, without copying other tabs.
    let parent=source.parentElement;
    while(parent && parent.tagName!=='BODY' && parent.tagName!=='HTML') {
      const shell=parent.cloneNode(false);
      shell.removeAttribute('hidden'); shell.removeAttribute('aria-hidden');
      shell.removeAttribute('style'); shell.style.setProperty('display','block','important'); shell.classList.add('emr-print-ancestor');
      // An inactive source page can have dimensions yet suppress all painting.
      shell.style.setProperty('content-visibility','visible','important');
      shell.classList.remove('no-print','emr-workflow-hidden','emr-permission-hidden');
      [...shell.attributes].forEach(attr=>{if(/^on/i.test(attr.name))shell.removeAttribute(attr.name);});
      shell.appendChild(copy); copy=shell; parent=parent.parentElement;
    }
    return copy;
  }

  async function stylesFor(sourceDocument, doc) {
    const assets=[];
    await Promise.all([...sourceDocument.querySelectorAll('style,link[rel="stylesheet"]')].map(async node => {
      // Preserve order while asynchronously loading same-origin CSS.
      const placeholder=doc.createElement('style'); doc.head.appendChild(placeholder);
      if(node.tagName==='STYLE') { placeholder.textContent=printMedia(node.textContent || ''); return; }
      const href = node.getAttribute('href');
      if (!href) return;
      try {
        const url=new URL(href,sourceDocument.baseURI || location.href);
        if(url.origin===location.origin) {
          try {
            const response=await fetch(url.href,{credentials:'same-origin'});
            if(response.ok) {
              let css=await response.text();
              css=css.replace(/url\((['"]?)(?!data:|#)([^)'"\s]+)\1\)/gi,(_,quote,path)=>`url("${new URL(path,url).href}")`);
              placeholder.textContent=printMedia(css);
            }
          } catch(fetchError) {
            console.warn('Could not load print layout:', url.pathname, fetchError);
          }
        } else {
          const link=doc.createElement('link');link.rel='stylesheet';link.href=url.href;
          assets.push(new Promise(resolve=>{link.onload=resolve;link.onerror=resolve;setTimeout(resolve,2000);}));placeholder.replaceWith(link);
        }
      } catch(urlError) {
        console.warn('Invalid stylesheet URL:', href, urlError);
      }
    }));
    await bounded(Promise.all(assets), 2000);
    // Resolve responsive rules once in the print frame. Native print preview
    // can use a different viewport, which must not reflow a measured sheet.
    const flattenMedia = rules => [...rules].map(rule => {
      // A paper sheet uses the desktop form structure. Mobile breakpoints
      // must not collapse its columns before the A4 fitting calculation.
      if (rule.type === 4 && /(?:min|max)-(?:width|height)\s*:/i.test(rule.conditionText)) return '';
      if (rule.type === 4) return doc.defaultView.matchMedia(rule.conditionText).matches
        ? flattenMedia(rule.cssRules) : '';
      return rule.cssText;
    }).join('\n');
    for (const sheet of [...doc.styleSheets]) {
      try {
        const css = flattenMedia(sheet.cssRules);
        if (sheet.ownerNode.tagName === 'STYLE') sheet.ownerNode.textContent = css;
        else { const style = doc.createElement('style'); style.textContent = css; sheet.ownerNode.replaceWith(style); }
      } catch { /* Keep cross-origin stylesheets when CSSOM access is restricted. */ }
    }
  }

  async function fitA4Sheets(doc, root, orientation, separatePages) {
    const sheetSelector = '.page-a4,.nursing-care-page,.paper-frame,.lab-print-page,.sheet-frame';
    const view = doc.defaultView;
    const visible = node => view.getComputedStyle(node).display !== 'none' && node.getClientRects().length;
    const reports = [];
    // Preserve the document's existing sheets (including nursing landscape
    // pages). Keep all ancestor classes/IDs for the original scoped styles.
    for (const report of [...root.children]) {
      const ipd = report.id === 'sub_ipd' ? report : report.querySelector('#sub_ipd');
      const soap = ipd?.querySelector('#ipd_soap_record');
      if (soap) {
        // v40.7: the IPD record is in S/O/A/P boxes. Keep the same two-page
        // balance as before: page 1 has S and O up to the respiratory
        // examination; page 2 has the rest of O, then A and P and the footer.
        const box = letter => soap.querySelector(`[data-soap-record-box="${letter}"]`);
        const clone = node => node.cloneNode(true);
        const oBox = box('o'), oBody = oBox?.querySelector('.emr-soap-body');
        const oChildren = oBody ? [...oBody.childNodes] : [];
        const examination = oChildren.find(node => node.nodeType === 1 && node.querySelector('[data-key="ipd_sec7"]'));
        if (examination && box('s') && box('a') && box('p')) {
          const examBody = examination.lastElementChild;
          const examNodes = [...examBody.childNodes];
          const examSplit = examNodes.indexOf(examBody.children[6]);
          const examPart = index => {
            if (examSplit <= 0) return index ? null : clone(examination);
            const half = clone(examination);
            half.lastElementChild.classList.add('emr-ipd-exam-body');
            half.lastElementChild.replaceChildren(...(index ? examNodes.slice(examSplit) : examNodes.slice(0, examSplit)).map(clone));
            return half;
          };
          const examAt = oChildren.indexOf(examination);
          const oPart = index => {
            const part = clone(oBox);
            part.querySelector('.emr-soap-body').replaceChildren(...(index
              ? [examPart(1), ...oChildren.slice(examAt + 1).map(clone)]
              : [...oChildren.slice(0, examAt).map(clone), examPart(0)]).filter(Boolean));
            return part;
          };
          const soapPage = boxes => { const shell = soap.cloneNode(false); shell.append(...boxes); return shell; };
          const children = [...ipd.childNodes];
          const soapAt = children.indexOf(soap);
          const title = ipd.querySelector('[data-key="ipd_title"]');
          const pages = [
            [...children.slice(0, soapAt).map(clone), soapPage([clone(box('s')), oPart(0)])],
            [title && clone(title), soapPage([oPart(1), clone(box('a')), clone(box('p'))]), ...children.slice(soapAt + 1).map(clone)].filter(Boolean),
          ];
          for (const [index, nodes] of pages.entries()) {
            const copy = report.cloneNode(true);
            const form = copy.id === 'sub_ipd' ? copy : copy.querySelector('#sub_ipd');
            form.replaceChildren(...nodes);
            form.classList.add('emr-ipd-print-page');
            form.querySelector('#daily_monitoring_feed')?.remove();
            form.querySelector('[data-key="ipd_title"]')?.append(doc.createTextNode(` · ${index+1}/2`));
            reports.push({content:copy,orientation});
          }
          continue;
        }
      }
      if (ipd) {
        // Balance history and examination across two A4 pages in the isolated
        // print copy. The editable web form is never divided or changed.
        const record = ipd.querySelector('.paraclinic-medical-main') || ipd;
        const sections = [...record.children].filter(node => node.classList.contains('opd-section'));
        const splitAt = [...record.childNodes].indexOf(sections[6]);
        if (splitAt > 0) {
          const children = [...record.childNodes];
          const heading = record.firstElementChild;
          const examination = sections[6];
          const examBody = examination.lastElementChild;
          // Continue the system examination on page two, after the respiratory examination.
          // This balances the two pages and avoids shrinking all of page two
          // just to keep the entire examination on a single sheet.
          const examSplit = [...(examBody?.childNodes || [])].indexOf(examBody?.children[6]);
          const examHalves = examSplit > 0 ? [0,1].map(index => {
            const half = examination.cloneNode(true);
            const nodes = [...examBody.childNodes];
            half.lastElementChild.classList.add('emr-ipd-exam-body');
            half.lastElementChild.replaceChildren(...(index ? nodes.slice(examSplit) : nodes.slice(0,examSplit)).map(node=>node.cloneNode(true)));
            return half;
          }) : null;
          for (const [index,nodes] of [children.slice(0,splitAt),children.slice(splitAt)].entries()) {
            const copy = report.cloneNode(true);
            const form = copy.id === 'sub_ipd' ? copy : copy.querySelector('#sub_ipd');
            const formBody = form.querySelector('.paraclinic-medical-main') || form;
            formBody.replaceChildren(...nodes.map(node => node.cloneNode(true)));
            form.classList.add('emr-ipd-print-page');
            form.querySelector('#daily_monitoring_feed')?.remove();
            if (examHalves) {
              if (index) formBody.querySelector('.opd-section')?.replaceWith(examHalves[1]);
              else formBody.append(examHalves[0]);
            }
            if (index && heading) formBody.prepend(heading.cloneNode(true));
            const pageHeading=formBody.firstElementChild;
            if (pageHeading) pageHeading.append(doc.createTextNode(` · ${index+1}/2`));
            reports.push({content:copy,orientation});
          }
          continue;
        }
      }
      const pages = [...report.querySelectorAll(sheetSelector)].filter(node =>
        visible(node) && !node.parentElement.closest(sheetSelector));
      if (!pages.length) { reports.push({content:report, orientation}); continue; }
      for (const page of pages) {
        const pageOrientation = page.matches('.nursing-care-page') ? 'landscape' : orientation;
        let content = page.cloneNode(true), ancestor = page.parentElement;
        // Paper wrappers must expand with the fitted layout, rather than
        // retaining their old millimetre cap after the text is scaled.
        content.style.setProperty('width', '100%', 'important');
        content.style.setProperty('max-width', 'none', 'important');
        content.style.setProperty('min-width', '0', 'important');
        while (ancestor && ancestor !== root) {
          const shell = ancestor.cloneNode(false);
          shell.classList.add('emr-print-ancestor');
          shell.appendChild(content); content = shell; ancestor = ancestor.parentElement;
        }
        reports.push({content, orientation:pageOrientation});
      }
    }
    if (!separatePages && reports.every(report => report.orientation === orientation)) {
      const group = doc.createElement('div');
      reports.forEach(report => group.appendChild(report.content));
      reports.splice(0, reports.length, {content:group, orientation});
    }
    root.replaceChildren();
    const style = doc.createElement('style');
    style.textContent = `
      .emr-ipd-print-page .opd-section {padding:6px!important;margin-bottom:8px!important;box-shadow:none!important}
      .emr-ipd-print-page .emr-ipd-exam-body {line-height:1.5!important}
      @page emr-a4-portrait {size:A4 portrait;margin:10mm}
      @page emr-a4-landscape {size:A4 landscape;margin:10mm}
      html {height:auto!important;min-height:0!important;zoom:1!important}
      html body.emr-report-print {height:auto!important;zoom:1!important}
      html body.emr-report-print .emr-a4-sheet {
        display:block!important;position:relative!important;box-sizing:border-box!important;
        margin:0!important;padding:0!important;border:0!important;max-width:none!important;
        contain:size layout paint!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;
        break-before:auto!important;page-break-before:auto!important;
        break-after:page!important;page-break-after:always!important;
      }
      html body.emr-report-print .emr-a4-sheet:last-child {break-after:auto!important;page-break-after:auto!important}
      html body.emr-report-print .emr-a4-content {
        display:flow-root!important;box-sizing:border-box!important;margin:0!important;padding:0!important;
        max-width:none!important;transform-origin:top left!important;page:inherit!important;
      }
      html body.emr-report-print .emr-a4-content * {
        break-before:auto!important;page-break-before:auto!important;
        break-after:auto!important;page-break-after:auto!important;page:inherit!important;
      }
      html body.emr-report-print .emr-a4-content .sheet-frame {height:auto!important;transform:none!important}
      html body.emr-report-print .emr-a4-content .paper-frame {overflow:visible!important}
      @media print {html body.emr-report-print {width:auto!important} html body.emr-report-print .emr-a4-sheet {width:100%!important} html body.emr-report-print .emr-print-root {overflow:hidden!important}}
    `;
    doc.head.appendChild(style);
    for (const report of reports) {
      const landscape = report.orientation === 'landscape';
      const width = (landscape ? 277 : 190) * 96 / 25.4;
      const height = (landscape ? 190 : 277) * 96 / 25.4;
      const sheet = doc.createElement('div'); sheet.className = 'emr-a4-sheet';
      sheet.style.setProperty('width', width + 'px', 'important');
      sheet.style.setProperty('page', 'emr-a4-' + report.orientation, 'important');
      const content = doc.createElement('div'); content.className = 'emr-a4-content';
      content.style.setProperty('width', width + 'px', 'important');
      content.appendChild(report.content);
      // Inline priority also overrides legacy #ID print rules. Pagination now
      // belongs to the sheet wrapper, rather than individual form elements.
      for (const node of [content, ...content.querySelectorAll('*')]) {
        for (const property of ['break-before','break-after','page-break-before','page-break-after']) {
          node.style.setProperty(property, 'auto', 'important');
        }
        node.style.setProperty('page', 'inherit', 'important');
      }
      sheet.appendChild(content); root.appendChild(sheet);
      // Force font selection after cloning each sheet, then wait for those
      // fonts before measuring. Hidden source pages may not have loaded them.
      content.getBoundingClientRect();
      await bounded(doc.fonts?.ready);
      await bounded(Promise.all([...content.querySelectorAll('img')].map(img => img.decode?.().catch(() => {}))));
      await nextFrame(view);
      resizeA4Sheet(doc, sheet, width, height);
    }
  }

  function alignTriageCheckRows(content) {
    const triage=content.querySelector('#page2');
    if (!triage) return;
    const rows=[...triage.querySelectorAll('.symptom-row')];
    rows.forEach(row=>row.style.removeProperty('min-height'));
    // Paired checklist columns keep the same row boundaries after text wraps
    // at the final A4 width. This operates only on the isolated print copy.
    for (const line of triage.querySelectorAll('tr')) {
      const columns=[...line.children].filter(cell=>cell.tagName==='TD')
        .map(cell=>[...cell.children].filter(row=>row.classList.contains('symptom-row')))
        .filter(column=>column.length);
      if (columns.length!==2) continue;
      for (let index=0;index<Math.min(columns[0].length,columns[1].length);index++) {
        const pair=columns.map(column=>column[index]);
        const height=Math.max(...pair.map(row=>row.offsetHeight));
        pair.forEach(row=>row.style.setProperty('min-height',height+'px','important'));
      }
    }
  }

  function resizeA4Sheet(doc, sheet, width, height) {
    const content = sheet.querySelector('.emr-a4-content');
    const visible = node => doc.defaultView.getComputedStyle(node).display !== 'none' && node.getClientRects().length;
    // Leave room for native print headers, footers and printer rounding.
    const availableWidth = width - 2, availableHeight = height - 10 * 96 / 25.4;
    content.style.setProperty('position', 'absolute', 'important');
    content.style.setProperty('top', '0', 'important');
    content.style.setProperty('left', '0', 'important');
    content.style.setProperty('transform', 'none', 'important');

    function layout(scale) {
      // Compensate the layout width for the text scale. The final physical form keeps
      // the full paper width, instead of becoming a narrow column on the left.
      content.style.setProperty('width', (availableWidth / scale) + 'px', 'important');
      content.style.setProperty('zoom', '1', 'important');
      content.style.setProperty('transform', `scale(${scale})`, 'important');
      alignTriageCheckRows(content);
      const box = content.getBoundingClientRect();
      let right = box.right, bottom = box.bottom;
      for (const node of content.querySelectorAll('*')) {
        if (!visible(node)) continue;
        const bounds = node.getBoundingClientRect();
        right = Math.max(right, bounds.right); bottom = Math.max(bottom, bounds.bottom);
      }
      return {width:right - box.left, height:bottom - box.top};
    }
    const fits = bounds => bounds.width <= availableWidth + .5 && bounds.height <= availableHeight;
    let scale = 1, bounds = layout(scale);
    if (!fits(bounds)) {
      let upper = 1, lower = .5;
      while (lower > .01 && !fits(layout(lower))) { upper = lower; lower /= 2; }
      // Find the largest readable text scale which fits both dimensions.
      for (let attempt = 0; attempt < 14; attempt += 1) {
        const middle = (lower + upper) / 2;
        if (fits(layout(middle))) lower = middle; else upper = middle;
      }
      scale = lower;
      bounds = layout(scale);
    }
    sheet.dataset.fitScale = String(scale);
    sheet.style.setProperty('height', Math.ceil(bounds.height) + 'px', 'important');
  }


  window.printEmrReport = async ({selectors,classes=[],sectionClasses=[],title=document.title,sourceDocument=document,orientation='portrait',separatePages=true}) => {
    window.logRecordAccess?.('print', title); // v41.7 record view log
    if(activePrint && !activePrint.invoked) return activePrint.ready;
    // A new click after closing the browser preview can start another report,
    // even in browsers which do not dispatch afterprint consistently.
    activePrint?.cleanup();
    const sources=selectors.map(selector=>sourceDocument.querySelector(selector)).filter(Boolean);
    if(!sources.length) { window.alert('The report is not ready to print. / មិនមានទម្រង់សម្រាប់បោះពុម្ព។'); return; }
    let positioningReady=Promise.resolve();
    if(!document.querySelector('link[data-report-print-style]')) {
      const link=document.createElement('link');link.rel='stylesheet';link.href='/public/report-print.css?v=3670';link.dataset.reportPrintStyle='';
      positioningReady=new Promise(resolve=>{link.onload=resolve;link.onerror=resolve;setTimeout(resolve,1500);});
      document.head.appendChild(link);
    }
    const previousFocus=document.activeElement;
    const frame=document.createElement('iframe');frame.title=title;frame.className='emr-report-print-frame';frame.dataset.orientation=orientation;frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    const job={ready:null,invoked:false,cleanup:()=>{
      frame.remove();
      if(activePrint===job){activePrint=null;previousFocus?.focus({preventScroll:true});}
    }};
    activePrint=job;
    // The authenticated blank page permits report styles inside its own CSP;
    // the application's stricter CSP and original form stay untouched.
    const loaded=new Promise(resolve=>{
      let done=false;
      const finish=()=>{if(!done){done=true;resolve();}};
      frame.onload=finish;
      frame.onerror=finish;
      setTimeout(finish,2500);
    });
    frame.src='/print-preview';
    job.ready=(async()=>{
      try {
        // Position the rendering frame off screen before attaching it. It must
        // remain rendered (not display:none) for every browser to paginate it.
        await positioningReady;
        document.body.appendChild(frame);
        await loaded;if(activePrint!==job)return;
        const doc=frame.contentDocument||frame.contentWindow?.document;
        if(!doc||!doc.body) throw new Error('Could not open print preview frame.');
        doc.head.replaceChildren();doc.body.replaceChildren();doc.documentElement.lang=sourceDocument.documentElement.lang||'km';
        const meta=doc.createElement('meta');meta.setAttribute('charset','utf-8');doc.head.appendChild(meta);
        const base=doc.createElement('base');base.href=sourceDocument.baseURI||location.href;doc.head.appendChild(base);doc.title=title;
        // BODY sources (embedded forms and generated invoices) become DIV reports.
        doc.body.className=['emr-report-print',sourceDocument.body.className,...classes].join(' ');
        const root=doc.createElement('main');root.className='emr-print-root';root.style.setProperty('display','block','important');
        sources.forEach(source=>{
          let copy=snapshot(source,sectionClasses);
          if(copy.tagName==='BODY'){const div=doc.createElement('div');div.className=copy.className;while(copy.firstChild)div.appendChild(copy.firstChild);copy=div;}
          root.appendChild(doc.importNode(withAncestors(source,copy),true));
        });
        doc.body.appendChild(root);
        await stylesFor(sourceDocument,doc);
        const style=doc.createElement('style');style.textContent=`
          @font-face {font-family:Moul;src:url('/public/fonts/Moul-Khmer.woff2') format('woff2');unicode-range:U+1780-17FF,U+19E0-19FF,U+200C-200D,U+25CC}
          @font-face {font-family:Moul;src:url('/public/fonts/Moul-Latin.woff2') format('woff2');unicode-range:U+0000-00FF}
          @font-face {font-family:'Khmer OS Battambang';src:url('/public/fonts/Battambang-Regular.ttf') format('truetype')}
          @font-face {font-family:EMRPrintBattambang;src:url('/public/fonts/Battambang-Regular.ttf') format('truetype')}
          html {background:#e5e7eb!important}
          *,*::before,*::after {animation:none!important;transition:none!important}
          html body.emr-report-print {box-sizing:border-box!important;width:${orientation==='landscape'?'297':'210'}mm!important;max-width:100%!important;margin:12px auto!important;padding:10mm!important;background:white!important;color:black!important;min-height:${orientation==='landscape'?'210':'297'}mm;font-family:EMRPrintBattambang,Arial,sans-serif!important}
          html body.emr-report-print .emr-print-root,html body.emr-report-print .emr-print-ancestor {display:block!important;width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;break-after:auto!important;break-before:auto!important}
          html body.emr-report-print .emr-print-section {display:block!important;width:100%!important;max-width:none!important;height:auto!important;max-height:none!important;overflow:visible!important;margin:0!important;padding:0!important;break-after:auto!important;page-break-after:auto!important}
          html body.emr-report-print #print-rx-layout.emr-print-section {display:flex!important}
          .emr-print-root > :not(:first-child) {break-before:${separatePages?'page':'auto'}}
          .emr-print-value {box-sizing:border-box!important;max-width:100%;display:inline-block;min-height:1em;white-space:pre-wrap;overflow-wrap:normal;word-break:normal;color:black;vertical-align:baseline}
          .emr-print-multiline {display:block;width:100%;height:auto!important;min-height:1em!important}
          .emr-print-number {font-size:inherit!important;line-height:inherit!important;width:auto!important;min-width:1.5em!important;white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;text-align:center}
          .emr-print-measurement {white-space:nowrap!important}
          .emr-print-check {width:auto!important;min-width:0!important}
          #page2 .emr-triage-check {display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box!important;width:12px!important;min-width:12px!important;height:12px!important;min-height:12px!important;padding:0!important;border:1px solid #222;border-radius:2px;font:10px/1 Arial,sans-serif!important;vertical-align:middle;white-space:nowrap;flex-shrink:0}
          #page2 .symptom-row {display:grid!important;grid-template-columns:minmax(0,1fr) 12px!important;column-gap:8px!important;align-items:start!important;box-sizing:border-box!important}
          #page2 .symptom-text {min-width:0;overflow-wrap:normal;word-break:normal}
          #page2 .symptom-row>.emr-triage-check {margin:2px 0 0!important;align-self:start}
          .no-print,.print-toolbar,.emr-editor-history {display:none!important}
          .emr-permission-readonly::before {display:none!important}
          @media print {html {background:white!important} html body.emr-report-print {width:auto!important;max-width:none!important;min-height:0!important;margin:0!important;padding:0!important} @page {size:A4 ${orientation==='landscape'?'landscape':'portrait'};margin:10mm}}
        `;doc.head.appendChild(style);
        doc.body.getBoundingClientRect();
        if (doc.fonts?.load) await bounded(Promise.all([
          doc.fonts.load('14px EMRPrintBattambang'),
          doc.fonts.load('14px "Khmer OS Battambang"'),
          doc.fonts.load('14px Moul', 'ភាសាខ្មែរ'),
          doc.fonts.load('14px Moul', 'Hospital'),
        ]));
        await bounded(doc.fonts?.ready);await bounded(Promise.all([...doc.images].map(img=>img.decode?.().catch(()=>{}))));
        // Fit each existing report sheet in both dimensions. A fixed sheet box contains
        // the scaled form so long sheets do not leave a second page behind. Only this isolated print snapshot is changed.
        await fitA4Sheets(doc, root, orientation, separatePages);
        await nextFrame(frame.contentWindow);
        if(activePrint!==job)return;
        // Only the isolated report is passed to native Print. Keep the snapshot
        // alive until preview closes; do not clear it on a short timer.
        frame.contentWindow.addEventListener('afterprint',job.cleanup,{once:true});
        frame.dataset.ready='true';job.invoked=true;
        frame.contentWindow.focus();frame.contentWindow.print();
      } catch(error) {job.cleanup();console.error('Print preview error:',error);window.alert('Could not open print preview. Please try again. / មិនអាចបើកការមើលមុនបោះពុម្ពបានទេ។ សូមព្យាយាមម្តងទៀត។');}
    })();
    return job.ready;
  };

  window.previewEmrHtml = async (html,title,options={}) => {
    const sourceDocument=new DOMParser().parseFromString(html,'text/html');
    // Preserve organization names in generated cashier documents without executing scripts.
    let branding=window.organizationBranding;
    if(!branding)try{const response=await fetch('/api/organization/branding',{credentials:'same-origin'});if(response.ok)branding=await response.json();}catch{}
    if(branding){
      const names=[[sourceDocument.querySelector('[data-organization-name="kh"]')?.textContent||'មន្ទីរពេទ្យបង្អែក បរកែវ',branding.nameKh],[sourceDocument.querySelector('[data-organization-name="en"]')?.textContent||'Borkeo Referral Hospital',branding.nameEn]];
      const walker=sourceDocument.createTreeWalker(sourceDocument.body,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())for(const [oldName,newName] of names)if(newName)walker.currentNode.nodeValue=walker.currentNode.nodeValue.split(oldName).join(newName);
    }
    return window.printEmrReport({sourceDocument,selectors:options.selectors||['body'],separatePages:options.separatePages??true,title});
  };
})();
