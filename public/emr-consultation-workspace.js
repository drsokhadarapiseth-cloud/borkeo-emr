/**
 * Borkeo EMR v43.3.0 - Integrated Clinical Consultation Workspace Controller
 * Aligned with WCAG 2.2 AA and IEC 62366-1.
 * Screen presentation layer providing two-way sync with frozen form fields.
 */

'use strict';

(function initConsultationWorkspace() {
  if (typeof window === 'undefined') return;

  const VIEW_MODE_KEY = 'borkeo_consultation_view_mode';
  let currentViewMode = 'integrated';

  function isConsultationActive() {
    return window.location.pathname === '/emr' && Boolean(document.getElementById('sub_opd'));
  }

  function getViewMode() {
    try {
      const mode = localStorage.getItem(VIEW_MODE_KEY);
      if (mode === 'compact' || mode === 'classic' || mode === 'integrated') return mode;
      return 'integrated';
    } catch {
      return 'integrated';
    }
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {}

    const body = document.body;
    body.classList.remove('consultation-mode-integrated', 'consultation-mode-compact', 'consultation-mode-classic');
    body.classList.add(`consultation-mode-${mode}`);

    document.querySelectorAll('.cw-view-mode-btn').forEach(btn => {
      const active = btn.dataset.viewMode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    ensureClassicReturnBar(mode === 'classic');
  }

  function ensureClassicReturnBar(show) {
    let bar = document.getElementById('cw_classic_return_bar');
    if (show) {
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'cw_classic_return_bar';
        bar.className = 'cw-classic-return-bar no-print';
        bar.innerHTML = `
          <button type="button" class="cw-btn-return-integrated" id="cw_btn_return_integrated">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            <span>ត្រឡប់ទៅទម្រង់រួមបញ្ចូលគ្នា</span>
          </button>
        `;
        const host = document.getElementById('sub_opd');
        if (host) host.prepend(bar);
        bar.querySelector('#cw_btn_return_integrated')?.addEventListener('click', () => {
          setViewMode('integrated');
        });
      }
      bar.hidden = false;
    } else if (bar) {
      bar.hidden = true;
    }
  }

  // 1. Build the Modern Consultation Workspace HTML
  function renderConsultationWorkspace(host) {
    if (document.getElementById('emr-consultation-workspace')) return;

    const workspace = document.createElement('section');
    workspace.id = 'emr-consultation-workspace';
    workspace.className = 'emr-consultation-workspace no-print';
    workspace.setAttribute('aria-label', 'ទម្រង់ពិនិត្យព្យាបាល');

    workspace.innerHTML = `
      <div class="emr-consultation-grid">
        <!-- Left: Clinical Consultation Form Card -->
        <article class="emr-consultation-card">
          <div class="consultation-card-top-bar">
            <h2 class="consultation-heading">ការពិនិត្យព្យាបាល</h2>
            <div class="cw-view-mode-bar" role="group" aria-label="ទម្រង់បង្ហាញ">
              <button type="button" class="cw-view-mode-btn is-active" id="cw_mode_integrated" data-view-mode="integrated" aria-pressed="true" title="ទម្រង់រួមបញ្ចូលគ្នា">
                <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                <span>ទម្រង់រួមបញ្ចូលគ្នា</span>
              </button>
              <button type="button" class="cw-view-mode-btn" id="cw_mode_compact" data-view-mode="compact" aria-pressed="false" title="ទម្រង់សង្ខេប">
                <i class="fa-solid fa-table-columns" aria-hidden="true"></i>
                <span>ទម្រង់សង្ខេប</span>
              </button>
              <button type="button" class="cw-view-mode-btn" id="cw_mode_classic" data-view-mode="classic" aria-pressed="false" title="ទម្រង់ពិស្ដារពេញលេញ">
                <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
                <span>ទម្រង់ពិស្ដារពេញលេញ</span>
              </button>
            </div>
          </div>

          <!-- Chief Complaint -->
          <div class="consultation-field-wrap">
            <label class="consultation-label" for="consultation_chief_complaint">
              ហេតុផលមកពេទ្យ <span class="req-star" aria-hidden="true">*</span>
            </label>
            <textarea
              id="consultation_chief_complaint"
              class="consultation-chief-complaint"
              data-emr-transient=""
              data-emr-no-save=""
              rows="2"
              placeholder="សូមបញ្ចូលហេតុផលមកពិនិត្យ ឬរោគសញ្ញាសំខាន់..."></textarea>
          </div>

          <!-- Vital Signs Section (6 Metric Cards) -->
          <h3 class="vitals-heading">សញ្ញាសំខាន់</h3>
          <div class="vitals-metric-grid">
            <div class="vital-metric-card">
              <span class="vital-metric-label">សម្ពាធឈាម (mmHg)</span>
              <input
                type="text"
                id="consultation_bp"
                class="vital-metric-input"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="120/80"
                aria-label="សម្ពាធឈាម">
            </div>
            <div class="vital-metric-card">
              <span class="vital-metric-label">ចង្វាក់បេះដូង (ដង/នាទី)</span>
              <input
                type="text"
                id="consultation_pulse"
                class="vital-metric-input"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="78"
                aria-label="ចង្វាក់បេះដូង">
            </div>
            <div class="vital-metric-card">
              <span class="vital-metric-label">សីតុណ្ហភាព (°C)</span>
              <input
                type="text"
                id="consultation_temp"
                class="vital-metric-input"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="36.8"
                aria-label="សីតុណ្ហភាព">
            </div>
            <div class="vital-metric-card">
              <span class="vital-metric-label">អុកស៊ីសែនក្នុងឈាម (SpO2, %)</span>
              <input
                type="text"
                id="consultation_spo2"
                class="vital-metric-input"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="98"
                aria-label="អុកស៊ីសែនក្នុងឈាម">
            </div>
            <div class="vital-metric-card">
              <span class="vital-metric-label">ដង្ហើម (ដង/នាទី)</span>
              <input
                type="text"
                id="consultation_resp"
                class="vital-metric-input"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="18"
                aria-label="ដង្ហើម">
            </div>
            <div class="vital-metric-card">
              <span class="vital-metric-label">ទម្ងន់ (kg)</span>
              <input
                type="text"
                id="consultation_weight"
                class="vital-metric-input"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="62"
                aria-label="ទម្ងន់">
            </div>
          </div>

          <!-- Row 1: HPI & Physical Exam -->
          <div class="consultation-fields-row">
            <div class="consultation-field-wrap">
              <label class="consultation-label" for="consultation_hpi">ប្រវត្តិឫសគល់រោគ</label>
              <textarea
                id="consultation_hpi"
                class="consultation-textarea"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="ប្រវត្តិជំងឺ និងការវិវត្តនៃរោគសញ្ញា..."></textarea>
            </div>
            <div class="consultation-field-wrap">
              <label class="consultation-label" for="consultation_exam">ការពិនិត្យរាងកាយ</label>
              <textarea
                id="consultation_exam"
                class="consultation-textarea"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="លទ្ធផលនៃការពិនិត្យរាងកាយតាមប្រព័ន្ធសរីរាង្គ..."></textarea>
            </div>
          </div>

          <!-- Row 2: Diagnosis & Treatment Plan -->
          <div class="consultation-fields-row">
            <div class="consultation-field-wrap">
              <label class="consultation-label" for="consultation_diagnosis">
                រោគវិនិច្ឆ័យ <span class="req-star" aria-hidden="true">*</span>
              </label>
              <textarea
                id="consultation_diagnosis"
                class="consultation-textarea"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="1. រោគវិនិច្ឆ័យចម្បង&#10;2. រោគវិនិច្ឆ័យបន្ទាប់បន្សំ..."></textarea>
            </div>
            <div class="consultation-field-wrap">
              <label class="consultation-label" for="consultation_plan">
                ផែនការព្យាបាល <span class="req-star" aria-hidden="true">*</span>
              </label>
              <textarea
                id="consultation_plan"
                class="consultation-textarea"
                data-emr-transient=""
                data-emr-no-save=""
                placeholder="1. បញ្ជាវិភាគបន្ថែម&#10;2. ឱសថព្យាបាល&#10;3. ការណែនាំ និងការតាមដាន..."></textarea>
            </div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="consultation-actions-bar">
            <!-- NPCA Toggle -->
            <label class="npca-toggle-group">
              <span class="npca-toggle-label">NPCA (ថ្នាក់លើខំអនុវត្តអន្តរជាតិ)</span>
              <div class="cw-switch">
                <input type="checkbox" id="consultation_npca_toggle" data-emr-transient="" data-emr-no-save="">
                <span class="cw-slider" aria-hidden="true"></span>
              </div>
              <span class="cw-info-bubble" title="ការបញ្ជាក់សេវាបង់ប្រាក់គ្លីនិក NPCA">ⓘ</span>
            </label>

            <!-- Buttons Group -->
            <div class="consultation-buttons-group">
              <button type="button" class="btn-consultation-save" id="consultation_btn_save">
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                <span>រក្សាទុក</span>
              </button>
              <button type="button" class="btn-consultation-print" id="consultation_btn_print">
                <i class="fa-solid fa-print" aria-hidden="true"></i>
                <span>បោះពុម្ព</span>
              </button>
              <div class="consultation-actions-dropdown-wrap">
                <button type="button" class="btn-consultation-other" id="consultation_btn_other" aria-expanded="false" aria-haspopup="true">
                  <span>សកម្មភាពផ្សេងៗ</span>
                  <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                </button>
                <div class="consultation-menu" id="consultation_menu_actions" hidden>
                  <button type="button" class="consultation-menu-item" data-action="insert-rx-to-plan">
                    <i class="fa-solid fa-file-prescription" aria-hidden="true"></i>
                    <span>បញ្ចូលវេជ្ជបញ្ជាទៅក្នុងផែនការ</span>
                  </button>
                  <button type="button" class="consultation-menu-item" data-action="print-rx">
                    <i class="fa-solid fa-prescription" aria-hidden="true"></i>
                    <span>បោះពុម្ពវេជ្ជបញ្ជា</span>
                  </button>
                  <button type="button" class="consultation-menu-item" data-action="print-admission">
                    <i class="fa-solid fa-file-medical" aria-hidden="true"></i>
                    <span>បោះពុម្ភលិខិតចូល</span>
                  </button>
                  <button type="button" class="consultation-menu-item" data-action="print-triage">
                    <i class="fa-solid fa-truck-medical" aria-hidden="true"></i>
                    <span>បោះពុម្ពទម្រង់ទ្រីយ៉ា</span>
                  </button>
                  <button type="button" class="consultation-menu-item" data-action="transfer-ward">
                    <i class="fa-solid fa-bed-pulse" aria-hidden="true"></i>
                    <span>បញ្ជូនទៅសម្រាកពេទ្យ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- Right: Tasks to Complete Checklist Card -->
        <aside class="emr-tasks-card" aria-label="ការងារត្រូវបំពេញ">
          <div class="tasks-card-header">
            <h3 class="tasks-card-title">ការងារត្រូវបំពេញ</h3>
            <button type="button" class="tasks-collapse-btn" id="tasks_collapse_toggle" aria-label="បង្រួម">
              <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
            </button>
          </div>
          <div id="tasks_content_body">
            <div class="tasks-progress-summary">
              បានបំពេញ <span id="tasks_count_display">2/4</span>
            </div>
            <div class="tasks-progress-track">
              <div class="tasks-progress-fill" id="tasks_progress_bar" style="width: 50%;"></div>
            </div>
            <div class="tasks-list">
              <!-- Item 1: Allergy History -->
              <div class="task-item is-warning" id="task_item_allergy" role="button" tabindex="0" data-target="allergy">
                <div class="task-item-icon warning" id="task_icon_allergy">
                  <i class="fa-solid fa-exclamation" aria-hidden="true"></i>
                </div>
                <div class="task-item-content">
                  <div class="task-item-title">ប្រវត្តិអាឡែកស៊ី</div>
                  <div class="task-item-status" id="task_status_allergy">មិនទាន់កត់ត្រា</div>
                </div>
                <i class="fa-solid fa-chevron-right task-item-arrow" aria-hidden="true"></i>
              </div>

              <!-- Item 2: Physical Exam -->
              <div class="task-item" id="task_item_exam" role="button" tabindex="0" data-target="exam">
                <div class="task-item-icon pending" id="task_icon_exam"></div>
                <div class="task-item-content">
                  <div class="task-item-title">ការពិនិត្យរាងកាយ</div>
                  <div class="task-item-status" id="task_status_exam">មិនទាន់បំពេញ</div>
                </div>
                <i class="fa-solid fa-chevron-right task-item-arrow" aria-hidden="true"></i>
              </div>

              <!-- Item 3: Diagnosis -->
              <div class="task-item" id="task_item_diagnosis" role="button" tabindex="0" data-target="diagnosis">
                <div class="task-item-icon pending" id="task_icon_diagnosis"></div>
                <div class="task-item-content">
                  <div class="task-item-title">រោគវិនិច្ឆ័យ</div>
                  <div class="task-item-status" id="task_status_diagnosis">មិនទាន់បំពេញ</div>
                </div>
                <i class="fa-solid fa-chevron-right task-item-arrow" aria-hidden="true"></i>
              </div>

              <!-- Item 4: Treatment Plan -->
              <div class="task-item" id="task_item_plan" role="button" tabindex="0" data-target="plan">
                <div class="task-item-icon pending" id="task_icon_plan"></div>
                <div class="task-item-content">
                  <div class="task-item-title">ផែនការព្យាបាល</div>
                  <div class="task-item-status" id="task_status_plan">មិនទាន់បំពេញ</div>
                </div>
                <i class="fa-solid fa-chevron-right task-item-arrow" aria-hidden="true"></i>
              </div>
            </div>
          </div>
        </aside>
      </div>
    `;

    host.prepend(workspace);
    document.body.classList.add('modern-consultation-active');

    attachEventListeners(workspace);
    syncFromLegacy();
    updateChecklist();
    setViewMode(getViewMode());
  }

  // 2. Attach Interactive Listeners & Live Two-Way Sync
  function attachEventListeners(workspace) {
    // View mode switcher buttons
    workspace.querySelectorAll('.cw-view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setViewMode(btn.dataset.viewMode);
      });
    });

    // Chief Complaint sync
    const modernCc = workspace.querySelector('#consultation_chief_complaint');
    if (modernCc) {
      modernCc.addEventListener('input', () => {
        const legacy = document.getElementById('pmrs_chief_complaint');
        if (legacy && legacy.value !== modernCc.value) {
          legacy.value = modernCc.value;
          legacy.dispatchEvent(new Event('input', { bubbles: true }));
          legacy.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateChecklist();
      });
    }

    // Vitals sync
    const bpInput = workspace.querySelector('#consultation_bp');
    if (bpInput) {
      bpInput.addEventListener('input', () => {
        const parts = bpInput.value.split('/');
        const sys = parts[0]?.trim() || '';
        const dia = parts[1]?.trim() || '';
        const legacySys = document.getElementById('opd_bp_sys') || document.getElementById('web_triage_bp_sys');
        const legacyDia = document.getElementById('opd_bp_dia') || document.getElementById('web_triage_bp_dia');
        if (legacySys) { legacySys.value = sys; legacySys.dispatchEvent(new Event('input', { bubbles: true })); }
        if (legacyDia) { legacyDia.value = dia; legacyDia.dispatchEvent(new Event('input', { bubbles: true })); }
      });
    }

    const metricMap = [
      ['#consultation_pulse', ['opd_pulse', 'web_triage_pulse']],
      ['#consultation_temp', ['opd_temp', 'web_triage_temp']],
      ['#consultation_spo2', ['web_triage_spo2', 'opd_spo2']],
      ['#consultation_resp', ['opd_resp', 'web_triage_resp']],
      ['#consultation_weight', ['opd_weight', 'web_triage_weight']]
    ];

    metricMap.forEach(([sel, legacyIds]) => {
      const el = workspace.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', () => {
        legacyIds.forEach(id => {
          const target = document.getElementById(id);
          if (target && target.value !== el.value) {
            target.value = el.value;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
    });

    // History textarea sync
    const modernHpi = workspace.querySelector('#consultation_hpi');
    if (modernHpi) {
      modernHpi.addEventListener('input', () => {
        const legacyHpi = document.querySelector('#sub_opd textarea[data-emr-key-index="13"]') || document.getElementById('ipd_history_present_illness');
        if (legacyHpi && legacyHpi.value !== modernHpi.value) {
          legacyHpi.value = modernHpi.value;
          legacyHpi.dispatchEvent(new Event('input', { bubbles: true }));
          legacyHpi.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

    // Physical exam textarea sync
    const modernExam = workspace.querySelector('#consultation_exam');
    if (modernExam) {
      modernExam.addEventListener('input', () => {
        const legacyExam = document.querySelector('#sub_opd textarea[data-emr-key-index="22"]');
        if (legacyExam && legacyExam.value !== modernExam.value) {
          legacyExam.value = modernExam.value;
          legacyExam.dispatchEvent(new Event('input', { bubbles: true }));
          legacyExam.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateChecklist();
      });
    }

    // Diagnosis textarea sync
    const modernDiag = workspace.querySelector('#consultation_diagnosis');
    if (modernDiag) {
      modernDiag.addEventListener('input', () => {
        const legacyDiag = document.getElementById('emr_pmrs_opd_diagnosis');
        if (legacyDiag && legacyDiag.value !== modernDiag.value) {
          legacyDiag.value = modernDiag.value;
          legacyDiag.dispatchEvent(new Event('input', { bubbles: true }));
          legacyDiag.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateChecklist();
      });
    }

    // Treatment plan textarea sync
    const modernPlan = workspace.querySelector('#consultation_plan');
    if (modernPlan) {
      modernPlan.addEventListener('input', () => {
        const legacyPlan = document.getElementById('opd_plan_notes') || document.getElementById('web_rx_counsel_note');
        if (legacyPlan && legacyPlan.value !== modernPlan.value) {
          legacyPlan.value = modernPlan.value;
          legacyPlan.dispatchEvent(new Event('input', { bubbles: true }));
          legacyPlan.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateChecklist();
      });
    }

    // Save button
    const saveBtn = workspace.querySelector('#consultation_btn_save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        const originalContent = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> <span>កំពុងរក្សាទុក…</span>';
        try {
          if (typeof window.savePatientRecord === 'function') {
            await window.savePatientRecord();
          }
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalContent;
        }
      });
    }

    // Print button
    const printBtn = workspace.querySelector('#consultation_btn_print');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (typeof window.printSignedOpdForm === 'function') {
          window.printSignedOpdForm();
        } else {
          window.print();
        }
      });
    }

    // Other actions dropdown
    const otherBtn = workspace.querySelector('#consultation_btn_other');
    const menuEl = workspace.querySelector('#consultation_menu_actions');
    if (otherBtn && menuEl) {
      otherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menuEl.hasAttribute('hidden');
        if (isHidden) {
          menuEl.removeAttribute('hidden');
          otherBtn.setAttribute('aria-expanded', 'true');
        } else {
          menuEl.setAttribute('hidden', '');
          otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('click', (e) => {
        if (!otherBtn.contains(e.target) && !menuEl.contains(e.target)) {
          menuEl.setAttribute('hidden', '');
          otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      menuEl.querySelectorAll('.consultation-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          menuEl.setAttribute('hidden', '');
          otherBtn.setAttribute('aria-expanded', 'false');
          const action = item.dataset.action;
          if (action === 'insert-rx-to-plan') {
            insertPrescriptionsToPlan();
          } else if (action === 'print-rx' && typeof window.printSignedOpdPrescription === 'function') {
            window.printSignedOpdPrescription();
          } else if (action === 'print-admission' && typeof window.printAdmissionOnly === 'function') {
            window.printAdmissionOnly();
          } else if (action === 'print-triage' && typeof window.printTriageOnly === 'function') {
            window.printTriageOnly();
          } else if (action === 'transfer-ward') {
            const wardSelect = document.getElementById('web_opd_transfer_ward');
            if (wardSelect) {
              wardSelect.scrollIntoView({ behavior: 'smooth' });
              wardSelect.focus();
            }
          }
        });
      });
    }

    // Helper: Insert prescribed medicines into plan textarea
    function insertPrescriptionsToPlan() {
      const rows = document.querySelectorAll('#opd_rx_table tbody tr');
      const medLines = [];
      rows.forEach(tr => {
        const nameInput = tr.querySelector('input[type="text"][list]') || tr.querySelector('input[type="text"]');
        const medName = nameInput?.value?.trim();
        if (medName) {
          const dose = tr.querySelector('[data-col="dose"] input, .opd-rx-dose')?.value?.trim();
          const route = tr.querySelector('[data-col="route"] select, .opd-rx-route')?.value?.trim();
          const sched = tr.querySelector('[data-col="schedule"] select, .opd-rx-schedule')?.value?.trim();
          const dur = tr.querySelector('[data-col="dur"] input, .opd-rx-dur')?.value?.trim();
          const qty = tr.querySelector('[data-col="qty"] input, .opd-rx-qty')?.value?.trim();
          let line = `- ${medName}`;
          const details = [dose, route, sched, dur ? `${dur}ថ្ងៃ` : '', qty ? `សរុប ${qty}` : ''].filter(Boolean).join(', ');
          if (details) line += ` (${details})`;
          medLines.push(line);
        }
      });

      if (medLines.length > 0) {
        const planEl = workspace.querySelector('#consultation_plan');
        if (planEl) {
          const current = planEl.value.trim();
          const header = 'ឱសថព្យាបាល៖';
          const newBlock = `${header}\n${medLines.join('\n')}`;
          if (current.includes(header)) {
            planEl.value = current + '\n\n' + newBlock;
          } else {
            planEl.value = current ? `${current}\n\n${newBlock}` : newBlock;
          }
          planEl.dispatchEvent(new Event('input', { bubbles: true }));
          planEl.dispatchEvent(new Event('change', { bubbles: true }));
          updateChecklist();
        }
      }
    }

    // Tasks checklist collapse toggle
    const collapseBtn = workspace.querySelector('#tasks_collapse_toggle');
    const bodyEl = workspace.querySelector('#tasks_content_body');
    if (collapseBtn && bodyEl) {
      collapseBtn.addEventListener('click', () => {
        const isCollapsed = bodyEl.hidden;
        bodyEl.hidden = !isCollapsed;
        collapseBtn.innerHTML = isCollapsed
          ? '<i class="fa-solid fa-chevron-up" aria-hidden="true"></i>'
          : '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
      });
    }

    // Task items click-to-focus navigation
    workspace.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const target = item.dataset.target;
        if (target === 'allergy') {
          window.switchOpdTab?.('ipd');
          const allergySlot = document.querySelector('[data-soap-slot="structured-allergy"]');
          if (allergySlot) {
            allergySlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
            allergySlot.querySelector('[data-allergy-field="substance"], button')?.focus();
          }
        } else if (target === 'exam') {
          const el = workspace.querySelector('#consultation_exam');
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        } else if (target === 'diagnosis') {
          const el = workspace.querySelector('#consultation_diagnosis');
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        } else if (target === 'plan') {
          const el = workspace.querySelector('#consultation_plan');
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }
      });
    });

    // Listen to legacy fields changes to update modern inputs dynamically
    const legacyDiag = document.getElementById('emr_pmrs_opd_diagnosis');
    if (legacyDiag) {
      legacyDiag.addEventListener('input', () => {
        if (modernDiag && modernDiag.value !== legacyDiag.value) {
          modernDiag.value = legacyDiag.value;
          updateChecklist();
        }
      });
    }

    const legacyPlan = document.getElementById('opd_plan_notes');
    if (legacyPlan) {
      legacyPlan.addEventListener('input', () => {
        if (modernPlan && modernPlan.value !== legacyPlan.value) {
          modernPlan.value = legacyPlan.value;
          updateChecklist();
        }
      });
    }
  }

  // 3. Sync initial/loaded data from legacy inputs into modern inputs
  function syncFromLegacy() {
    const modernCc = document.getElementById('consultation_chief_complaint');
    const legacyCc = document.getElementById('pmrs_chief_complaint');
    if (modernCc && legacyCc && legacyCc.value) modernCc.value = legacyCc.value;

    const bpInput = document.getElementById('consultation_bp');
    const sys = document.getElementById('opd_bp_sys')?.value || document.getElementById('web_triage_bp_sys')?.value || '';
    const dia = document.getElementById('opd_bp_dia')?.value || document.getElementById('web_triage_bp_dia')?.value || '';
    if (bpInput && (sys || dia)) bpInput.value = `${sys}/${dia}`;

    const pulseInput = document.getElementById('consultation_pulse');
    const pulse = document.getElementById('opd_pulse')?.value || document.getElementById('web_triage_pulse')?.value || '';
    if (pulseInput && pulse) pulseInput.value = pulse;

    const tempInput = document.getElementById('consultation_temp');
    const temp = document.getElementById('opd_temp')?.value || document.getElementById('web_triage_temp')?.value || '';
    if (tempInput && temp) tempInput.value = temp;

    const spo2Input = document.getElementById('consultation_spo2');
    const spo2 = document.getElementById('web_triage_spo2')?.value || document.getElementById('opd_spo2')?.value || '';
    if (spo2Input && spo2) spo2Input.value = spo2;

    const respInput = document.getElementById('consultation_resp');
    const resp = document.getElementById('opd_resp')?.value || document.getElementById('web_triage_resp')?.value || '';
    if (respInput && resp) respInput.value = resp;

    const weightInput = document.getElementById('consultation_weight');
    const weight = document.getElementById('opd_weight')?.value || document.getElementById('web_triage_weight')?.value || '';
    if (weightInput && weight) weightInput.value = weight;

    const modernHpi = document.getElementById('consultation_hpi');
    const legacyHpi = document.querySelector('#sub_opd textarea[data-emr-key-index="13"]') || document.getElementById('ipd_history_present_illness');
    if (modernHpi && legacyHpi && legacyHpi.value) modernHpi.value = legacyHpi.value;

    const modernExam = document.getElementById('consultation_exam');
    const legacyExam = document.querySelector('#sub_opd textarea[data-emr-key-index="22"]');
    if (modernExam && legacyExam && legacyExam.value) modernExam.value = legacyExam.value;

    const modernDiag = document.getElementById('consultation_diagnosis');
    const legacyDiag = document.getElementById('emr_pmrs_opd_diagnosis');
    if (modernDiag && legacyDiag && legacyDiag.value) modernDiag.value = legacyDiag.value;

    const modernPlan = document.getElementById('consultation_plan');
    const legacyPlan = document.getElementById('opd_plan_notes') || document.getElementById('web_rx_counsel_note');
    if (modernPlan && legacyPlan && legacyPlan.value) modernPlan.value = legacyPlan.value;
  }

  // 4. Update Tasks Checklist State & Progress Bar
  function updateChecklist() {
    let completedCount = 0;

    // 1. Allergy History
    const allergyState = window.EmrClinicalSummary?.allergyState?.()?.state;
    const allergyRecorded = allergyState === 'allergy' || allergyState === 'none';
    const allergyItem = document.getElementById('task_item_allergy');
    const allergyIcon = document.getElementById('task_icon_allergy');
    const allergyStatus = document.getElementById('task_status_allergy');

    if (allergyItem && allergyIcon && allergyStatus) {
      if (allergyRecorded) {
        completedCount++;
        allergyItem.className = 'task-item is-success';
        allergyIcon.className = 'task-item-icon success';
        allergyIcon.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
        allergyStatus.textContent = 'បានកត់ត្រា';
      } else {
        allergyItem.className = 'task-item is-warning';
        allergyIcon.className = 'task-item-icon warning';
        allergyIcon.innerHTML = '<i class="fa-solid fa-exclamation" aria-hidden="true"></i>';
        allergyStatus.textContent = 'មិនទាន់កត់ត្រា';
      }
    }

    // 2. Physical Examination
    const examVal = (document.getElementById('consultation_exam')?.value || '').trim();
    const examCompleted = examVal.length > 0;
    const examItem = document.getElementById('task_item_exam');
    const examIcon = document.getElementById('task_icon_exam');
    const examStatus = document.getElementById('task_status_exam');

    if (examItem && examIcon && examStatus) {
      if (examCompleted) {
        completedCount++;
        examItem.className = 'task-item is-success';
        examIcon.className = 'task-item-icon success';
        examIcon.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
        examStatus.textContent = 'បានបំពេញ';
      } else {
        examItem.className = 'task-item';
        examIcon.className = 'task-item-icon pending';
        examIcon.innerHTML = '';
        examStatus.textContent = 'មិនទាន់បំពេញ';
      }
    }

    // 3. Diagnosis
    const diagVal = (document.getElementById('consultation_diagnosis')?.value || '').trim();
    const diagCompleted = diagVal.length > 0;
    const diagItem = document.getElementById('task_item_diagnosis');
    const diagIcon = document.getElementById('task_icon_diagnosis');
    const diagStatus = document.getElementById('task_status_diagnosis');

    if (diagItem && diagIcon && diagStatus) {
      if (diagCompleted) {
        completedCount++;
        diagItem.className = 'task-item is-success';
        diagIcon.className = 'task-item-icon success';
        diagIcon.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
        diagStatus.textContent = 'បានបំពេញ';
      } else {
        diagItem.className = 'task-item';
        diagIcon.className = 'task-item-icon pending';
        diagIcon.innerHTML = '';
        diagStatus.textContent = 'មិនទាន់បំពេញ';
      }
    }

    // 4. Treatment Plan
    const planVal = (document.getElementById('consultation_plan')?.value || '').trim();
    const planCompleted = planVal.length > 0;
    const planItem = document.getElementById('task_item_plan');
    const planIcon = document.getElementById('task_icon_plan');
    const planStatus = document.getElementById('task_status_plan');

    if (planItem && planIcon && planStatus) {
      if (planCompleted) {
        completedCount++;
        planItem.className = 'task-item is-success';
        planIcon.className = 'task-item-icon success';
        planIcon.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
        planStatus.textContent = 'បានបំពេញ';
      } else {
        planItem.className = 'task-item';
        planIcon.className = 'task-item-icon pending';
        planIcon.innerHTML = '';
        planStatus.textContent = 'មិនទាន់បំពេញ';
      }
    }

    // Update Counter & Progress Bar
    const countDisplay = document.getElementById('tasks_count_display');
    const progressBar = document.getElementById('tasks_progress_bar');
    if (countDisplay) countDisplay.textContent = `${completedCount}/4`;
    if (progressBar) progressBar.style.width = `${(completedCount / 4) * 100}%`;
  }

  // 5. Enhance Patient Tabs and Breadcrumbs
  function enhanceRecordNavigation() {
    const tabsWrapper = document.getElementById('emr-chart-tabs-wrapper');
    if (!tabsWrapper) return;
  }
  
  // 6. Bootstrap Initializer
  function init() {
    if (!isConsultationActive()) return;

    const opdHost = document.getElementById('sub_opd');
    if (opdHost) {
      renderConsultationWorkspace(opdHost);
      enhanceRecordNavigation();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('emr:patient-loaded', () => {
    init();
    syncFromLegacy();
    updateChecklist();
  });
  document.addEventListener('emr:clinical-summary', updateChecklist);

  // Periodic safety check to catch delayed session / patient state
  [300, 1000, 2500].forEach(delay => {
    window.setTimeout(() => {
      if (isConsultationActive()) {
        init();
        syncFromLegacy();
        updateChecklist();
      }
    }, delay);
  });

  window.EmrConsultationWorkspace = {
    init,
    syncFromLegacy,
    updateChecklist,
    setViewMode,
    getViewMode: () => currentViewMode
  };
})();
