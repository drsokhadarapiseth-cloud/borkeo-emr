/**
 * Borkeo EMR - 4-Color Coded Doctor SOAP Controller (Phase 5)
 * WCAG 2.2 AA / IEC 62366-1 Medical Safety Compliant.
 * Manages Subjective, Objective, Assessment, Plan documentation for physicians.
 */
(function (global) {
  'use strict';

  var I18N = {
    khmer: {
      sTitle: 'ពាក្យបណ្តឹង និងប្រវត្តិ',
      sHint: 'អ្វីដែលអ្នកជំងឺរាយការណ៍ (រោគសញ្ញា ប្រវត្តិជំងឺ)',
      oTitle: 'ការពិនិត្យ និងលទ្ធផល',
      oHint: 'សញ្ញាជីវិត ការពិនិត្យរាងកាយ និងលទ្ធផលវិភាគ',
      aTitle: 'ការវាយតម្លៃ និងរោគវិនិច្ឆ័យ',
      aHint: 'រោគវិនិច្ឆ័យចម្បង លេខកូដ ICD-10 និងការវាយតម្លៃ',
      pTitle: 'ផែនការព្យាបាល',
      pHint: 'ឱសថព្យាបាល ការបញ្ជាបន្ថែម និងការណែនាំ',
      pullResults: 'ទាញលទ្ធផលចុងក្រោយ',
      copyPrev: 'ចម្លងពីកំណត់ត្រាមុន',
      legacyBadge: 'ចំណាំចាស់',
      requiredBadge: '(ចាំបាច់)',
      statusFilled: 'បានបំពេញ',
      statusEmpty: 'មិនទាន់បំពេញ',
      showMore: 'បង្ហាញបន្ថែម',
      showLess: 'បង្រួម',
      validationError: 'សូមបញ្ចូលព័ត៌មានចាំបាច់៖ ពាក្យបណ្តឹង (S) និងការវាយតម្លៃ (A)',
      noResultsFound: 'មិនមានលទ្ធផល Paraclinic ថ្មីសម្រាប់អ្នកជំងឺនេះទេ',
      noPreviousNote: 'មិនមានកំណត់ត្រាមុនសម្រាប់ចម្លងទេ',
      copiedSuccess: 'បានចម្លងពីកំណត់ត្រាមុនរួចរាល់'
    },
    english: {
      sTitle: 'Subjective',
      sHint: 'Patient-reported complaints, symptoms, interval history',
      oTitle: 'Objective',
      oHint: 'Vital signs, physical examination, diagnostic results',
      aTitle: 'Assessment',
      aHint: 'Working diagnosis, ICD-10 code, clinical impression',
      pTitle: 'Plan',
      pHint: 'Treatment orders, medications, follow-up plan',
      pullResults: 'Pull Latest Results',
      copyPrev: 'Copy From Previous Note',
      legacyBadge: 'Legacy Note',
      requiredBadge: '(Required)',
      statusFilled: 'Completed',
      statusEmpty: 'Empty',
      showMore: 'Show more',
      showLess: 'Show less',
      validationError: 'Please fill required sections: Subjective (S) and Assessment (A)',
      noResultsFound: 'No new paraclinic results found for this patient',
      noPreviousNote: 'No previous note found to copy from',
      copiedSuccess: 'Copied from previous note'
    }
  };

  function getLang() {
    return (global.currentLang === 'english' || global.currentLang === 'en') ? 'english' : 'khmer';
  }

  function t(key) {
    var lang = getLang();
    return (I18N[lang] && I18N[lang][key]) || I18N.khmer[key] || '';
  }

  function isDoctorRole() {
    var role = String(
      (global.emrSession && global.emrSession.user && global.emrSession.user.activeRole) ||
      (global.getEmrRole && global.getEmrRole()) ||
      ''
    ).toUpperCase();
    return !role || ['DOCTOR', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].indexOf(role) !== -1;
  }

  function autoGrow(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    var newHeight = Math.max(84, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
  }

  function updateStatusDot(section) {
    var textarea = document.getElementById('mon_soap_' + section);
    var dot = document.querySelector('.emr-soap-box.section-' + section + ' .emr-soap-status-dot');
    if (!textarea || !dot) return;
    var filled = textarea.value.trim().length > 0;
    dot.classList.toggle('filled', filled);
    dot.setAttribute('title', filled ? t('statusFilled') : t('statusEmpty'));
  }

  function syncLegacyInputs() {
    var s = (document.getElementById('mon_soap_s') ? document.getElementById('mon_soap_s').value : '').trim();
    var o = (document.getElementById('mon_soap_o') ? document.getElementById('mon_soap_o').value : '').trim();
    var a = (document.getElementById('mon_soap_a') ? document.getElementById('mon_soap_a').value : '').trim();
    var p = (document.getElementById('mon_soap_p') ? document.getElementById('mon_soap_p').value : '').trim();

    var evolInput = document.getElementById('mon_input_evol');
    if (evolInput) {
      var evolParts = [];
      if (s) evolParts.push('S: ' + s);
      if (o) evolParts.push('O: ' + o);
      evolInput.value = evolParts.length > 0 ? evolParts.join('\n') : (s || o || '');
    }

    var conclusionInput = document.getElementById('mon_input_conclusion');
    if (conclusionInput) {
      var conclusionParts = [];
      if (a) conclusionParts.push('A: ' + a);
      if (p) conclusionParts.push('P: ' + p);
      conclusionInput.value = conclusionParts.length > 0 ? conclusionParts.join('\n') : (a || p || '');
    }
  }

  function attachTabCycle(fromId, toId) {
    var fromEl = document.getElementById(fromId);
    if (!fromEl) return;
    fromEl.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        var toEl = document.getElementById(toId);
        if (toEl) {
          e.preventDefault();
          toEl.focus();
        }
      }
    });
  }

  function insertQuickPhrase(section, phrase) {
    var textarea = document.getElementById('mon_soap_' + section);
    if (!textarea) return;
    var current = textarea.value.trim();
    if (current.length === 0) {
      textarea.value = phrase;
    } else {
      textarea.value = current + '\n' + phrase;
    }
    autoGrow(textarea);
    updateStatusDot(section);
    syncLegacyInputs();
    textarea.focus();
  }

  async function pullLatestResults() {
    var oField = document.getElementById('mon_soap_o');
    if (!oField) return;

    var curKey = null;
    if (global.getCurrentPatient && global.getCurrentPatient()) {
      curKey = global.getCurrentPatient().patientKey;
    } else {
      var patKeyEl = document.getElementById('cur_pat_key') || document.getElementById('web_adm_no');
      curKey = patKeyEl ? patKeyEl.value : null;
    }

    if (!curKey) {
      alert(t('noResultsFound'));
      return;
    }

    try {
      var response = await fetch('/api/paraclinic/orders?patientKey=' + encodeURIComponent(curKey), {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch paraclinic results');
      var data = await response.json();
      var orders = (data && data.orders) || [];
      var completedOrders = orders.filter(function (ord) {
        return ord.status === 'RESULT_AVAILABLE' || ord.status === 'WARD_SEEN' || (ord.result && (ord.result.items || ord.result.findings));
      });

      if (completedOrders.length === 0) {
        alert(t('noResultsFound'));
        return;
      }

      var resultSummaries = [];
      completedOrders.slice(0, 3).forEach(function (ord) {
        var mod = ord.modality || 'LAB';
        if (ord.result && ord.result.items && ord.result.items.length > 0) {
          var itemsText = ord.result.items.map(function (it) {
            return (it.name || it.code) + ': ' + (it.value !== null && it.value !== undefined ? it.value : '-') + (it.unit ? ' ' + it.unit : '');
          }).join(', ');
          resultSummaries.push('[' + mod + '] ' + itemsText);
        } else if (ord.result && (ord.result.findings || ord.result.conclusion)) {
          var text = ord.result.conclusion || ord.result.findings || '';
          resultSummaries.push('[' + mod + '] ' + text);
        }
      });

      if (resultSummaries.length > 0) {
        var appendText = 'លទ្ធផលវិភាគ (Results):\n' + resultSummaries.join('\n');
        var curVal = oField.value.trim();
        oField.value = curVal ? curVal + '\n' + appendText : appendText;
        autoGrow(oField);
        updateStatusDot('o');
        syncLegacyInputs();
      } else {
        alert(t('noResultsFound'));
      }
    } catch (e) {
      alert(t('noResultsFound'));
    }
  }

  function copyFromPreviousNote() {
    var cards = document.querySelectorAll('#daily_monitoring_feed .ipd-mon-card');
    if (!cards || cards.length === 0) {
      alert(t('noPreviousNote'));
      return;
    }
    var topCard = cards[0];
    var data = topCard._monitoringCopyData;
    if (!data) {
      alert(t('noPreviousNote'));
      return;
    }

    if (data.soap) {
      populate(data);
    } else {
      // Legacy note fallback
      var evol = data.evol || '';
      var conclusion = data.conclusion || '';
      var sField = document.getElementById('mon_soap_s');
      var oField = document.getElementById('mon_soap_o');
      var aField = document.getElementById('mon_soap_a');
      var pField = document.getElementById('mon_soap_p');

      if (sField) sField.value = evol;
      if (oField) oField.value = '';
      if (aField) aField.value = conclusion;
      if (pField) pField.value = '';

      ['s', 'o', 'a', 'p'].forEach(function (sec) {
        var txt = document.getElementById('mon_soap_' + sec);
        autoGrow(txt);
        updateStatusDot(sec);
      });
      syncLegacyInputs();
    }
  }

  function reset() {
    ['s', 'o', 'a', 'p'].forEach(function (sec) {
      var textarea = document.getElementById('mon_soap_' + sec);
      if (textarea) {
        textarea.value = '';
        textarea.style.height = '84px';
      }
      var dot = document.querySelector('.emr-soap-box.section-' + sec + ' .emr-soap-status-dot');
      if (dot) dot.classList.remove('filled');
    });
    syncLegacyInputs();
  }

  function populate(data) {
    if (!data) return;
    var soap = data.soap || null;

    var sVal = '';
    var oVal = '';
    var aVal = '';
    var pVal = '';

    if (soap && typeof soap === 'object') {
      sVal = soap.s || '';
      oVal = soap.o || '';
      aVal = soap.a || '';
      pVal = soap.p || '';
    } else {
      // Parse legacy evol and conclusion
      var evol = data.evol || '';
      var conclusion = data.conclusion || '';

      if (evol.startsWith('S:') || evol.indexOf('\nO:') !== -1) {
        var sMatch = evol.match(/^S:\s*([\s\S]*?)(?=\nO:|$)/);
        var oMatch = evol.match(/\nO:\s*([\s\S]*)$/);
        sVal = sMatch ? sMatch[1].trim() : evol;
        oVal = oMatch ? oMatch[1].trim() : '';
      } else {
        sVal = evol;
      }

      if (conclusion.startsWith('A:') || conclusion.indexOf('\nP:') !== -1) {
        var aMatch = conclusion.match(/^A:\s*([\s\S]*?)(?=\nP:|$)/);
        var pMatch = conclusion.match(/\nP:\s*([\s\S]*)$/);
        aVal = aMatch ? aMatch[1].trim() : conclusion;
        pVal = pMatch ? pMatch[1].trim() : '';
      } else {
        aVal = conclusion;
      }
    }

    var sEl = document.getElementById('mon_soap_s');
    var oEl = document.getElementById('mon_soap_o');
    var aEl = document.getElementById('mon_soap_a');
    var pEl = document.getElementById('mon_soap_p');

    if (sEl) sEl.value = sVal;
    if (oEl) oEl.value = oVal;
    if (aEl) aEl.value = aVal;
    if (pEl) pEl.value = pVal;

    ['s', 'o', 'a', 'p'].forEach(function (sec) {
      var txt = document.getElementById('mon_soap_' + sec);
      autoGrow(txt);
      updateStatusDot(sec);
    });

    syncLegacyInputs();
  }

  function getValues() {
    var s = (document.getElementById('mon_soap_s') ? document.getElementById('mon_soap_s').value : '').trim();
    var o = (document.getElementById('mon_soap_o') ? document.getElementById('mon_soap_o').value : '').trim();
    var a = (document.getElementById('mon_soap_a') ? document.getElementById('mon_soap_a').value : '').trim();
    var p = (document.getElementById('mon_soap_p') ? document.getElementById('mon_soap_p').value : '').trim();

    return { s: s, o: o, a: a, p: p };
  }

  function validate() {
    var vals = getValues();
    if (!vals.s) {
      var sEl = document.getElementById('mon_soap_s');
      if (sEl) {
        sEl.focus();
        sEl.setCustomValidity(t('validationError'));
        if (sEl.reportValidity) sEl.reportValidity();
      }
      alert(t('validationError'));
      return false;
    }
    if (!vals.a) {
      var aEl = document.getElementById('mon_soap_a');
      if (aEl) {
        aEl.focus();
        aEl.setCustomValidity(t('validationError'));
        if (aEl.reportValidity) aEl.reportValidity();
      }
      alert(t('validationError'));
      return false;
    }
    return true;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderCardGrid(data) {
    if (!data) return '';
    var soap = data.soap;

    if (!soap || (!soap.s && !soap.o && !soap.a && !soap.p)) {
      // Legacy layout with badge
      var evolText = escapeHtml(data.evol || '-');
      var conclusionText = escapeHtml(data.conclusion || '-');
      var icd10Html = data.icd10 ? '<div class="mon-conclusion-code"><strong>ICD-10:</strong> <span data-language-exclude>' + escapeHtml(data.icd10) + '</span></div>' : '';

      return '<div class="ipd-body-grid">' +
        '<div>' +
          '<div style="margin-bottom:6px;"><span class="emr-legacy-note-badge"><i class="fa-solid fa-clock-rotate-left"></i> ' + t('legacyBadge') + '</span></div>' +
          '<div class="ipd-side-sec">' +
            '<div class="ipd-side-title"><i class="fa-regular fa-file-lines"></i> ការវិវត្តន៍</div>' +
            '<div style="color: #0284c7; line-height: 1.6; font-size: 12px; white-space: pre-line;">' + evolText + '</div>' +
          '</div>' +
          '<div class="ipd-side-sec conclusion">' +
            '<div class="ipd-side-title c-title"><i class="fa-regular fa-clipboard"></i> សេចក្តីសន្និដ្ឋាន</div>' +
            icd10Html +
            '<div style="color: #ea580c; font-weight: bold; font-size: 13px; white-space: pre-line;">' + conclusionText + '</div>' +
          '</div>' +
        '</div>';
    }

    // Modern 4-color SOAP grid
    var sContent = escapeHtml(soap.s || '-');
    var oContent = escapeHtml(soap.o || '-');
    var aContent = escapeHtml(soap.a || '-');
    var pContent = escapeHtml(soap.p || '-');
    var icd10Badge = data.icd10 ? ' <span style="font-weight:normal; font-size:11px; background:#fff7ed; padding:1px 6px; border-radius:4px; border:1px solid #fed7aa; color:#c2410c;">ICD-10: ' + escapeHtml(data.icd10) + '</span>' : '';

    return '<div class="emr-soap-card-grid">' +
      '<div class="emr-soap-card-sec sec-s">' +
        '<div class="emr-soap-card-sec-head color-s"><i class="fa-solid fa-circle-info"></i> ' + t('sTitle') + ' (S)</div>' +
        '<div class="emr-soap-card-text">' + sContent + '</div>' +
        (sContent.length > 90 ? '<button type="button" class="emr-soap-toggle-more no-print" onclick="EmrSoapNote.toggleCardText(this)">' + t('showMore') + '</button>' : '') +
      '</div>' +
      '<div class="emr-soap-card-sec sec-o">' +
        '<div class="emr-soap-card-sec-head color-o"><i class="fa-solid fa-stethoscope"></i> ' + t('oTitle') + ' (O)</div>' +
        '<div class="emr-soap-card-text">' + oContent + '</div>' +
        (oContent.length > 90 ? '<button type="button" class="emr-soap-toggle-more no-print" onclick="EmrSoapNote.toggleCardText(this)">' + t('showMore') + '</button>' : '') +
      '</div>' +
      '<div class="emr-soap-card-sec sec-a">' +
        '<div class="emr-soap-card-sec-head color-a"><i class="fa-solid fa-clipboard-check"></i> ' + t('aTitle') + ' (A)' + icd10Badge + '</div>' +
        '<div class="emr-soap-card-text">' + aContent + '</div>' +
        (aContent.length > 90 ? '<button type="button" class="emr-soap-toggle-more no-print" onclick="EmrSoapNote.toggleCardText(this)">' + t('showMore') + '</button>' : '') +
      '</div>' +
      '<div class="emr-soap-card-sec sec-p">' +
        '<div class="emr-soap-card-sec-head color-p"><i class="fa-solid fa-prescription"></i> ' + t('pTitle') + ' (P)</div>' +
        '<div class="emr-soap-card-text">' + pContent + '</div>' +
        (pContent.length > 90 ? '<button type="button" class="emr-soap-toggle-more no-print" onclick="EmrSoapNote.toggleCardText(this)">' + t('showMore') + '</button>' : '') +
      '</div>' +
    '</div>';
  }

  function toggleCardText(button) {
    if (!button) return;
    var textEl = button.previousElementSibling;
    if (!textEl) return;
    var expanded = textEl.classList.toggle('is-expanded');
    button.textContent = expanded ? t('showLess') : t('showMore');
  }

  function toggleBoxCollapse(button) {
    var box = button.closest('.emr-soap-box');
    if (!box) return;
    box.classList.toggle('is-collapsed');
  }

  function refreshLanguageLabels() {
    var titles = {
      s: t('sTitle'),
      o: t('oTitle'),
      a: t('aTitle'),
      p: t('pTitle')
    };
    var hints = {
      s: t('sHint'),
      o: t('oHint'),
      a: t('aHint'),
      p: t('pHint')
    };

    ['s', 'o', 'a', 'p'].forEach(function (sec) {
      var titleEl = document.querySelector('.emr-soap-box.section-' + sec + ' .emr-soap-title');
      if (titleEl) {
        var req = (sec === 's' || sec === 'a') ? ' <span style="color:red;">*</span>' : '';
        titleEl.innerHTML = titles[sec] + req;
      }
      var hintEl = document.querySelector('.emr-soap-box.section-' + sec + ' .emr-soap-hint');
      if (hintEl) hintEl.textContent = hints[sec];
    });

    var pullBtn = document.getElementById('mon_soap_btn_pull');
    if (pullBtn) pullBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> ' + t('pullResults');

    var copyBtn = document.getElementById('mon_soap_btn_copy');
    if (copyBtn) copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> ' + t('copyPrev');
  }

  function init() {
    ['s', 'o', 'a', 'p'].forEach(function (sec) {
      var textarea = document.getElementById('mon_soap_' + sec);
      if (textarea) {
        textarea.addEventListener('input', function () {
          autoGrow(textarea);
          updateStatusDot(sec);
          syncLegacyInputs();
          textarea.setCustomValidity('');
        });
      }
    });

    attachTabCycle('mon_soap_s', 'mon_soap_o');
    attachTabCycle('mon_soap_o', 'mon_soap_a');
    attachTabCycle('mon_soap_a', 'mon_soap_p');

    // Enforce role permissions
    if (!isDoctorRole()) {
      ['s', 'o', 'a', 'p'].forEach(function (sec) {
        var txt = document.getElementById('mon_soap_' + sec);
        if (txt) txt.disabled = true;
      });
      document.querySelectorAll('.emr-soap-chip, .emr-soap-btn').forEach(function (btn) {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
      });
    }

    refreshLanguageLabels();
  }

  // Export public interface
  global.EmrSoapNote = {
    init: init,
    reset: reset,
    populate: populate,
    getValues: getValues,
    validate: validate,
    renderCardGrid: renderCardGrid,
    insertQuickPhrase: insertQuickPhrase,
    pullLatestResults: pullLatestResults,
    copyFromPreviousNote: copyFromPreviousNote,
    toggleCardText: toggleCardText,
    toggleBoxCollapse: toggleBoxCollapse,
    refreshLanguageLabels: refreshLanguageLabels
  };

  global.addEventListener('borkeo-language-change', refreshLanguageLabels);
  document.addEventListener('DOMContentLoaded', function () {
    init();
  });

})(typeof window !== 'undefined' ? window : this);
