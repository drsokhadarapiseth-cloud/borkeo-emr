// v41.6 - Intake and output chart: a "Daily balance" row (fluid in minus fluid
// out, per column) under the fluid-out total of every nursing chart. It wraps
// calculateNursingFluidTotals (EMR.html), so it updates whenever the totals do.
// Its cells are calculated cells (never editable, never saved, never counted in
// the record field positions).
'use strict';
(function () {
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  const LABEL = { kh: 'តុល្យភាពប្រចាំថ្ងៃ', en: 'Daily balance' }; // approved Khmer (RULE 2)
  const OUTPUT_TOTAL = 'សរុបទឹកចេញ'; // existing row label in EMR.html
  const INPUT_TOTAL = 'សរុបទឹកចូល';

  const number = (text) => {
    const value = parseFloat(String(text || '').replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  };
  // Same lookup as findNursingTableRow in EMR.html: any cell of the row holds the label.
  const rowByLabel = (table, label) => Array.from(table.rows).find((row) => !row.hasAttribute('data-fluid-balance') && Array.from(row.cells).some((cell) => cell.textContent.trim() === label));

  function updateBalance(table) {
    const inRow = rowByLabel(table, INPUT_TOTAL);
    const outRow = rowByLabel(table, OUTPUT_TOTAL);
    if (!inRow || !outRow) return;
    let balance = table.querySelector('tr[data-fluid-balance]');
    if (!balance) {
      balance = outRow.cloneNode(true);
      balance.dataset.fluidBalance = '';
      balance.removeAttribute('id');
      Array.from(balance.cells).forEach((cell, index) => {
        cell.removeAttribute('contenteditable');
        cell.removeAttribute('id');
        cell.classList.remove('nursing-editable-cell', 'nursing-io-entry-cell');
        if (index > 0) { cell.classList.add('nursing-calculated-cell'); cell.textContent = ''; }
      });
      outRow.insertAdjacentElement('afterend', balance);
    }
    const labelCell = balance.cells[0];
    labelCell.innerHTML = `<strong>${english() ? LABEL.en : LABEL.kh}</strong>`;
    const ins = Array.from(inRow.cells).slice(1);
    const outs = Array.from(outRow.cells).slice(1);
    Array.from(balance.cells).slice(1).forEach((cell, index) => {
      const a = number(ins[index]?.textContent);
      const b = number(outs[index]?.textContent);
      if (a === null && b === null) { cell.textContent = ''; cell.removeAttribute('data-sign'); return; }
      const value = (a || 0) - (b || 0);
      cell.textContent = `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}`;
      cell.dataset.sign = value < 0 ? 'negative' : value > 0 ? 'positive' : 'zero';
      cell.setAttribute('aria-label', english() ? LABEL.en : LABEL.kh);
    });
  }

  function wrap() {
    const original = window.calculateNursingFluidTotals;
    if (typeof original !== 'function' || original.balanceWrapped) return false;
    const wrapped = function (table) { const result = original.apply(this, arguments); try { if (table) updateBalance(table); } catch { /* never break the chart */ } return result; };
    wrapped.balanceWrapped = true;
    window.calculateNursingFluidTotals = wrapped;
    return true;
  }

  wrap();
  window.addEventListener('borkeo-language-change', () => document.querySelectorAll('#sub_nursing .vital-tbl').forEach((table) => { try { updateBalance(table); } catch {} }));
  window.EmrFluidBalance = { updateBalance };
})();
