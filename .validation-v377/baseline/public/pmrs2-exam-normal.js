// These suggested findings are inserted only when a clinician presses "ធម្មតា".
// Each component stays editable. Language choices translate known normal
// template text; findings edited by the clinician are preserved.
export const NORMAL_EXAM = Object.freeze({
  neurological: {
    label: 'Neurological system',
    fields: {
      ipd_exam_gcs_eye: ['GCS eye', '4'],
      ipd_exam_gcs_verbal: ['GCS verbal', '5'],
      ipd_exam_gcs_motor: ['GCS motor', '6'],
      ipd_exam_gcs_total: ['GCS total', '15'],
      ipd_exam_neuro_other: ['Other', 'មិនមានភាពខុសប្រក្រតីដែលពិនិត្យឃើញ'],
    },
  },
  pain: {
    label: 'Pain score',
    fields: { ipd_exam_pain: ['Score', '0'] },
  },
  heent: {
    label: 'HEENT',
    fields: {
      ipd_exam_head: ['Head', 'ក្បាលមើលទៅធម្មតា'],
      ipd_exam_eye_left: ['Left eye', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_eye_right: ['Right eye', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_fundus: ['Fundus', 'ធម្មតា'],
      ipd_exam_ear_left: ['Left ear', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_ear_right: ['Right ear', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_nose: ['Nose', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_throat: ['Throat', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_neck: ['Neck', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_lymph: ['Lymph nodes', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
    },
  },
  respiratory: {
    label: 'Respiratory system',
    fields: {
      ipd_exam_resp_inspection: ['Inspection', 'ទ្រូងផ្លាស់ទីស្មើគ្នាពេលដកដង្ហើម'],
      ipd_exam_resp_auscultation: ['Auscultation', 'សំឡេងដង្ហើមធម្មតាទាំងសងខាង គ្មានសំឡេងបន្ថែម'],
      ipd_exam_resp_palpation: ['Palpation', 'ការពង្រីកទ្រូងស្មើគ្នាទាំងសងខាង'],
      ipd_exam_resp_percussion: ['Percussion', 'សំឡេងគោះថ្លាស្មើគ្នាទាំងសងខាង'],
    },
  },
  cardiovascular: {
    label: 'Cardiovascular system',
    fields: {
      ipd_exam_cvs_inspection: ['Inspection', 'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញនៅតំបន់បេះដូង'],
      ipd_exam_cvs_auscultation: ['Auscultation', 'ចង្វាក់ទៀងទាត់ សំឡេង S1 និង S2 ច្បាស់ គ្មានសំឡេងបន្ថែម'],
      ipd_exam_cvs_palpation: ['Palpation', 'ស្ទាបចំណុចបេះដូងធម្មតា គ្មានរំញ័រ'],
      ipd_exam_cvs_percussion: ['Percussion', 'សំឡេងគោះមិនមានភាពខុសប្រក្រតី'],
    },
  },
  abdomen: {
    label: 'Abdomen',
    fields: {
      ipd_exam_abd_inspection: ['Inspection', 'ពោះមិនហើម មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ'],
      ipd_exam_abd_auscultation: ['Auscultation', 'ឮសំឡេងចលនាពោះវៀនធម្មតា'],
      ipd_exam_abd_palpation: ['Palpation', 'ពោះទន់ មិនឈឺពេលស្ទាប'],
      ipd_exam_abd_percussion: ['Percussion', 'សំឡេងគោះពោះធម្មតា'],
    },
  },
  genitourinary: {
    label: 'Genitourinary system',
    fields: { ipd_exam_gu: ['Examination', 'មិនមានភាពខុសប្រក្រតីដែលពិនិត្យឃើញ'] },
  },
  extremities: {
    label: 'Extremities',
    fields: {
      ipd_exam_extremities: ['Examination', 'ចុងអវៈយវៈកក់ក្តៅ គ្មានហើម'],
      ipd_exam_crt: ['CRT (s)', '2'],
    },
  },
  musculoskeletal: {
    label: 'Musculoskeletal system',
    fields: { ipd_exam_msk: ['Examination', 'ចលនាសន្លាក់ធម្មតា មិនឈឺពេលពិនិត្យ'] },
  },
  other: {
    label: 'Other systems',
    fields: { ipd_exam_other: ['Examination', 'មិនមានភាពខុសប្រក្រតីដែលពិនិត្យឃើញ'] },
  },
});

// Translations of the existing Khmer findings. Numeric scores stay identical.
const NORMAL_TEXT_TRANSLATIONS = Object.freeze({
  'មិនមានភាពខុសប្រក្រតីដែលពិនិត្យឃើញ': ['No abnormality detected on examination', 'Aucune anomalie décelée à l’examen'],
  'ក្បាលមើលទៅធម្មតា': ['Head appears normal', 'Aspect normal de la tête'],
  'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ': ['No visible abnormality', 'Aucune anomalie visible'],
  'ធម្មតា': ['Normal', 'Normal'],
  'ទ្រូងផ្លាស់ទីស្មើគ្នាពេលដកដង្ហើម': ['Symmetrical chest movement with breathing', 'Mouvements thoraciques symétriques à la respiration'],
  'សំឡេងដង្ហើមធម្មតាទាំងសងខាង គ្មានសំឡេងបន្ថែម': ['Normal breath sounds bilaterally, no added sounds', 'Bruits respiratoires normaux bilatéraux, sans bruits surajoutés'],
  'ការពង្រីកទ្រូងស្មើគ្នាទាំងសងខាង': ['Equal chest expansion bilaterally', 'Expansion thoracique symétrique des deux côtés'],
  'សំឡេងគោះថ្លាស្មើគ្នាទាំងសងខាង': ['Equal resonant percussion bilaterally', 'Sonorité normale et symétrique à la percussion'],
  'មិនមានភាពខុសប្រក្រតីដែលមើលឃើញនៅតំបន់បេះដូង': ['No visible abnormality over the precordium', 'Aucune anomalie visible de la région précordiale'],
  'ចង្វាក់ទៀងទាត់ សំឡេង S1 និង S2 ច្បាស់ គ្មានសំឡេងបន្ថែម': ['Regular rhythm, clear S1 and S2, no added sounds', 'Rythme régulier, B1 et B2 bien audibles, sans bruits surajoutés'],
  'ស្ទាបចំណុចបេះដូងធម្មតា គ្មានរំញ័រ': ['Normal apex beat, no thrill', 'Choc de pointe normal, sans frémissement'],
  'សំឡេងគោះមិនមានភាពខុសប្រក្រតី': ['No abnormality on percussion', 'Aucune anomalie à la percussion'],
  'ពោះមិនហើម មិនមានភាពខុសប្រក្រតីដែលមើលឃើញ': ['Abdomen not distended, no visible abnormality', 'Abdomen non distendu, sans anomalie visible'],
  'ឮសំឡេងចលនាពោះវៀនធម្មតា': ['Normal bowel sounds', 'Bruits intestinaux normaux'],
  'ពោះទន់ មិនឈឺពេលស្ទាប': ['Abdomen soft and non-tender', 'Abdomen souple et indolore à la palpation'],
  'សំឡេងគោះពោះធម្មតា': ['Normal abdominal percussion', 'Percussion abdominale normale'],
  'ចុងអវៈយវៈកក់ក្តៅ គ្មានហើម': ['Extremities warm, no edema', 'Extrémités chaudes, sans œdème'],
  'ចលនាសន្លាក់ធម្មតា មិនឈឺពេលពិនិត្យ': ['Normal joint movement, no pain on examination', 'Mobilité articulaire normale, sans douleur à l’examen'],
});

export function normalExamText(normal, language = 'kh') {
  const translations = NORMAL_TEXT_TRANSLATIONS[normal];
  return translations && (language === 'en' || language === 'fr')
    ? translations[language === 'en' ? 0 : 1] : normal;
}

function saved(data, id) {
  const value = data[`scope:medical:id:${id}`] ?? data[`id:${id}`];
  return typeof value === 'string' ? value.trim() : '';
}

function checked(data, id) {
  return data[`scope:medical:id:${id}`] === true || data[`id:${id}`] === true;
}

// A system is summarized as "normal" only while every entered component
// exactly matches the clinician-selected template; edits appear in full.
export function summarizeClinicalExamination(data) {
  const result = [];
  const general = [
    ['ipd_exam_general_good', 'good'], ['ipd_exam_general_fair', 'fair'],
    ['ipd_exam_general_severe', 'severe'], ['ipd_exam_general_very_severe', 'very severe'],
  ].find(([id]) => checked(data, id));
  if (general) result.push(`General appearance: ${general[1]}`);
  const neurological = [
    ['ipd_exam_neuro_conscious', 'conscious'], ['ipd_exam_neuro_delirium', 'delirium'],
    ['ipd_exam_neuro_coma', 'coma'], ['ipd_exam_neuro_seizure', 'seizure'],
  ].find(([id]) => checked(data, id));
  for (const [key, system] of Object.entries(NORMAL_EXAM)) {
    const parts = Object.entries(system.fields).map(([id, [label, normal]]) => ({ label, normal, value: saved(data, id) }));
    if (!parts.some(part => part.value) && !(key === 'neurological' && neurological)) continue;
    if (key === 'pain') { result.push(`Pain score: ${parts[0].value}`); continue; }
    const neuroNormal = key !== 'neurological' || neurological?.[1] === 'conscious';
    result.push(neuroNormal && parts.every(part => ['kh', 'en', 'fr'].some(language => part.value === normalExamText(part.normal, language)))
      ? `${system.label}: normal`
      : `${system.label}: ${[
        ...(key === 'neurological' && neurological ? [`Status: ${neurological[1]}`] : []),
        ...parts.filter(part => part.value).map(part => `${part.label}: ${part.value}`),
      ].join('; ')}`);
  }
  return result;
}

if (typeof window !== 'undefined') {
  window.fillClinicalExamNormal = function (systemName) {
    const language = document.getElementById('ipd_exam_normal_language')?.value || 'kh';
    const systems = systemName === 'all' ? Object.values(NORMAL_EXAM) : [NORMAL_EXAM[systemName]].filter(Boolean);
    for (const system of systems) {
      for (const [id, [, normal]] of Object.entries(system.fields)) {
        const control = document.getElementById(id);
        const current = control?.value.trim();
        const translated = normalExamText(normal, language);
        const isTemplate = ['kh', 'en', 'fr'].some(code => current === normalExamText(normal, code));
        if (control && (!current || isTemplate) && control.value !== translated) {
          control.value = translated;
          control.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
    if (systemName === 'all' || systemName === 'neurological') {
      for (const [group, index] of (systemName === 'all' ? [['gen_app', 0], ['neuro', 0]] : [['neuro', 0]])) {
        const options = document.querySelectorAll(`input[name="${group}"]`);
        if (options.length && !Array.from(options).some(option => option.checked)) {
          options[index].checked = true;
          options[index].dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  };
}
