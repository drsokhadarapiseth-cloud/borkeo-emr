/* v42.5: medication routes ("how to use"), one table for every page
 * (prescription forms in EMR.html and emr-inpatient-workflow.js, Pharmacy,
 * staff messages, nursing chart, printing).
 * A NEW line chooses from the simple list: IV, IM, SC, PO, topical, drops,
 * inhaled, vaginal, rectal (PR), sublingual (SL). The old values (iv_fluid, antibiotic_iv, antibiotic_im,
 * injection_unspecified) stay valid for saved records, Pharmacy, messages, the
 * nursing chart and PMRS2 import; they are shown as IV / IM and are no longer
 * offered for a new line (legacy: true). Saved data is never rewritten.
 * priority = order of the nursing medicine chart (lower first). */
(function (root) {
  'use strict';
  var IV = { khmer: 'ចាក់សរសៃ (IV)', english: 'Intravenous (IV)' };
  var IM = { khmer: 'ចាក់សាច់ដុំ (IM)', english: 'Intramuscular (IM)' };
  var DEFINITIONS = [
    { value: 'other_iv', priority: 3, khmer: IV.khmer, english: IV.english },
    { value: 'other_im', priority: 3, khmer: IM.khmer, english: IM.english },
    { value: 'subcutaneous', priority: 3.5, khmer: 'ចាក់ក្រោមស្បែក (SC)', english: 'Subcutaneous (SC)' },
    { value: 'po', priority: 4, khmer: 'លេប (PO)', english: 'Oral (PO)' },
    { value: 'topical', priority: 4.5, khmer: 'លាប', english: 'Topical' },
    { value: 'drops', priority: 4.5, khmer: 'បន្តក់', english: 'Drops' },
    { value: 'inhaled', priority: 4.5, khmer: 'ស្រូប', english: 'Inhaled' },
    { value: 'vaginal', priority: 5, khmer: 'តាមទ្វារមាស', english: 'Vaginal' },
    { value: 'rectal', priority: 5, khmer: 'តាមទ្វារធំ (PR)', english: 'Rectal (PR)' },
    { value: 'sublingual', priority: 5, khmer: 'ក្រោមអណ្តាត (SL)', english: 'Sublingual (SL)' },
    // Old values: kept for saved records, not offered for a new line.
    { value: 'iv_fluid', priority: 1, khmer: IV.khmer, english: IV.english, legacy: true },
    { value: 'antibiotic_iv', priority: 2, khmer: IV.khmer, english: IV.english, legacy: true },
    { value: 'antibiotic_im', priority: 2, khmer: IM.khmer, english: IM.english, legacy: true },
    { value: 'injection_unspecified', priority: 3.5, khmer: 'ចាក់ (ត្រូវបញ្ជាក់ផ្លូវ)', english: 'Injection (route needed)', legacy: true }
  ];

  function definitions() {
    return DEFINITIONS.map(function (definition) { return Object.assign({}, definition); });
  }

  function find(value) {
    var key = String(value == null ? '' : value).trim();
    for (var i = 0; i < DEFINITIONS.length; i++) if (DEFINITIONS[i].value === key) return DEFINITIONS[i];
    return null;
  }

  // Label of a saved route value; unknown text is shown as saved.
  function label(value, language) {
    var definition = find(value);
    if (!definition) return String(value == null ? '' : value);
    return language === 'english' || language === 'en' ? definition.english : definition.khmer;
  }

  root.BorkeoMedicationRoutes = Object.freeze({ definitions: definitions, find: find, label: label });
})(typeof window !== 'undefined' ? window : globalThis);
