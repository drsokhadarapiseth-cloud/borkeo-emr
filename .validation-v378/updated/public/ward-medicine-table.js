const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const MAX_COLUMNS = 25, MIN_COLUMNS = 8, ROWS = 16;
function patientNameWidth(names) {
  const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (context) context.font = '13px Battambang,Arial,sans-serif';
  return Math.ceil(Math.max(0, ...names.map(name => {
    const text = String(name || '');
    return context ? context.measureText(text).width : Array.from(text).length * 9;
  }))) + 10;
}
export function quantityText(cell) {
  if (!cell) return '';
  if (cell.incomplete) return cell.quantity ? `${cell.quantity} + ?` : '?';
  return String(cell.quantity);
}
export function renderMedicineSheets(report,{role="",canSign=false}={}) {
  const matrix = report.matrix;
  // Give the longest patient name enough room to remain inside its cell. When
  // more room is needed, use fewer medicine columns on each page and continue
  // the remaining medicines on the next page instead of squeezing the name.
  const namePixels = Math.max(233, patientNameWidth(matrix.rows.map(patient => patient.fullName)));
  const sheetWidth = Math.max(1100, Math.ceil((namePixels + MIN_COLUMNS * 28) / .89 + 44));
  const nameWidth = namePixels / (sheetWidth - 44) * 100;
  const columnsPerPage = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS,
    Math.floor((100 - 4 - 7 - nameWidth) / 2.65)));
  const drugWidth = (100 - 4 - 7 - nameWidth) / columnsPerPage;
  const sheets = [];
  const columnPages = Math.max(1,Math.ceil(matrix.columns.length/columnsPerPage));
  const rowPages = Math.max(1,Math.ceil(matrix.rows.length/ROWS));
  const totalPages = columnPages * rowPages;
  for (let colPage=0;colPage<columnPages;colPage++) {
    const offset = colPage*columnsPerPage;
    const columns = Array.from({length:columnsPerPage},(_,i)=>matrix.columns[offset+i] || null);
    for (let rowPage=0;rowPage<rowPages;rowPage++) {
      const patients = matrix.rows.slice(rowPage*ROWS,(rowPage+1)*ROWS);
      const pageTotal = columns.map((column,i) => {
        if (!column) return null;
        const cells = patients.map(patient=>patient.cells[offset+i]).filter(Boolean);
        return {quantity:Math.round(cells.reduce((sum,cell)=>sum+cell.quantity,0)*1e6)/1e6,incomplete:cells.some(cell=>cell.incomplete)};
      });
      const medicineCells = cells => columns.map((column,i)=>`<td class="quantity">${column?escape(quantityText(cells[i])):''}</td>`).join('');
      const rows = Array.from({length:ROWS},(_,i)=>{
        const patient=patients[i];
        return `<tr><td>${escape(patient?.bedLabel)}</td><td class="patient-name">${escape(patient?.fullName)}</td><td class="diagnosis">${escape(patient?.diagnosis)}</td>${medicineCells(patient?patient.cells.slice(offset,offset+columnsPerPage):[])}</tr>`;
      }).join('');
      const [year,month,day]=report.date.split('-');
      const number=sheets.length+1;
      sheets.push(`<div class="sheet-frame"><section class="report-sheet" data-sheet-width="${sheetWidth}">
        <header class="report-title"><h2>បណ្ណស្នើរសុំឱសថ</h2><p>ORDER DELIVERY FORM INPATIENT</p></header>
        <div class="report-meta"><span>ផ្នែក៖ <strong>${escape(report.wardNameKh)}</strong></span><span>ថ្ងៃទី ${escape(day)} ខែ ${escape(month)} ឆ្នាំ ${escape(year)}</span></div>
        <div class="report-count">ចំនួនអ្នកជំងឺសម្រាកពេទ្យ៖ <strong>${matrix.patientCount}</strong>${totalPages>1?`<span class="page-number">ទំព័រ ${number}/${totalPages}</span>`:''}</div>
        <table class="drug-matrix"><colgroup><col data-column-width="4"><col data-column-width="${nameWidth}"><col data-column-width="7">${columns.map(()=>`<col data-column-width="${drugWidth.toFixed(3)}">`).join('')}</colgroup>
        <thead><tr><th rowspan="2" class="vertical"><span>លេខគ្រែ</span></th><th rowspan="2" class="vertical"><span>ឈ្មោះអ្នកជំងឺ</span></th><th rowspan="2" class="vertical"><span>រោគវិនិច្ឆ័យ</span></th><th colspan="${columnsPerPage}" class="group-title">រាយនាមមុខឱសថ និងបរិក្ខាពេទ្យ</th></tr>
        <tr>${columns.map(column=>`<th class="vertical drug-heading" title="${escape(column?.unit)}"><span>${escape(column?.label)}</span></th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody><tfoot><tr><th colspan="3">សរុប${rowPages>1?'ក្នុងទំព័រ':''}</th>${medicineCells(pageTotal)}</tr>
        ${rowPages>1&&rowPage===rowPages-1?`<tr><th colspan="3">សរុបក្នុងផ្នែក</th>${medicineCells(matrix.totals.slice(offset,offset+columnsPerPage))}</tr>`:''}</tfoot></table>
        <footer class="signatures">${[
          [3,'ប្រធានមន្ទីរពេទ្យ',report.approval?.director],
          [4,'ឱសថការី',report.approval?.pharmacy],
          [5,'អ្នកប្រគល់',report.approval?.sender],
          [2,report.approval?.chief?.title||'ប្រធានផ្នែក',report.approval?.chief],
          [6,'អ្នកទទួល',report.approval?.receiver],
          [1,'នាយសាល',report.approval?.nurse],
        ].map(([step,label,signer])=>`<span class="signature-position"><b>${label}</b><br>${signer?.signatureDataUrl&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signer.signatureDataUrl)?`<img class="medicine-signature-image" src="${escape(signer.signatureDataUrl)}" alt="${escape(label)}">`:''}${signer?.name?escape(signer.name):'________________'}${signer?.signedAt?`<br>${escape(new Date(signer.signedAt).toLocaleString())}`:''}${canSign&&step===report.approval?.nextStep?`<br><button type="button" class="compact success" data-medicine-sign="${step}">ចុះហត្ថលេខា / Sign</button>`:''}</span>`).join('')}</footer>
        ${matrix.unresolvedCount?'<p class="missing-note">? = ចំនួនសរុបមិនទាន់បានបញ្ជាក់ក្នុងវេជ្ជបញ្ជា។</p>':''}
      </section></div>`);
    }
  }
  return sheets.join('');
}
