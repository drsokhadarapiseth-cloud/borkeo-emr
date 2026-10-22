/* v42.3: medication units (same table as server/medicine-units.mjs).
 * Prescription forms write mg, mL, mcg, g and IU (international units, never
 * translated). Records saved before v42.3 hold the old Khmer labels; they are
 * shown and compared as the new units. Saved data is never rewritten here. */
(function (root) {
  'use strict';
  var ALIASES = {
    'ម.ក្រ': 'mg',
    'ម.ល': 'mL',
    'ml': 'mL',
    'ម៉ៃក្រូក្រាម': 'mcg',
    'µg': 'mcg',
    'ក្រាម': 'g',
    'ui': 'IU',
    'iu': 'IU'
  };

  function canonical(value) {
    var unit = String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
    return ALIASES[unit] || ALIASES[unit.toLowerCase()] || unit;
  }

  function same(left, right) {
    return canonical(left).toLowerCase() === canonical(right).toLowerCase();
  }

  root.BorkeoMedicineUnits = Object.freeze({ canonical: canonical, same: same });
})(typeof window !== 'undefined' ? window : globalThis);
