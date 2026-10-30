// PMRS2 patient-page labels, mapped to Borkeo payload keys. These are the Khmer
// captions shown on the PMRS2 entry/identity screens (pmrs.digitalsp.gov.kh).
// If PMRS2 changes a caption, update it here; no other file needs editing.
// Each label is matched against the page's own text, so spelling must match PMRS2.
var PMRS2_FIELDS = [
  { key: 'fullName', labels: ['ឈ្មោះអ្នកជំងឺ', 'ឈ្មោះ'] },
  { key: 'sex', labels: ['ភេទ'] },
  { key: 'dob', labels: ['ថ្ងៃខែឆ្នាំកំណើត', 'ថ្ងៃកំណើត'] },
  { key: 'age', labels: ['អាយុ'] },
  { key: 'phone', labels: ['លេខទូរស័ព្ទ'] },
  { key: 'healthId', labels: ['លេខបណ្ណសុខាភាព', 'លេខប័ណ្ណសុខភាព'] },
  { key: 'caseNumber', labels: ['លេខករណី'] },
  { key: 'equityCard', labels: ['លេខបណ្ណសមធម៌', 'ប័ណ្ណមូលនិធិសមធម៌'] },
  { key: 'province', labels: ['ខេត្ត', 'រាជធានី/ខេត្ត'] },
  { key: 'district', labels: ['ស្រុក', 'ក្រុង/ស្រុក/ខណ្ឌ'] },
  { key: 'commune', labels: ['ឃុំ', 'ឃុំ/សង្កាត់'] },
  { key: 'village', labels: ['ភូមិ'] },
  { key: 'street', labels: ['អាសយដ្ឋាន', 'ទីតាំង'] },
  { key: 'entryType', labels: ['ប្រភេទនៃការចូល'] },
  { key: 'caregiverName', labels: ['ឈ្មោះអ្នកកំដរ'] },
  { key: 'caregiverPhone', labels: ['លេខទូរស័ព្ទអ្នកកំដរ'] },
  { key: 'caregiverRelation', labels: ['ទំនាក់ទំនង'] },
];

if (typeof module !== 'undefined' && module.exports) module.exports = { PMRS2_FIELDS };
