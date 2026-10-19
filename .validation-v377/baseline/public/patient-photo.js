// Borkeo EMR v34.5 - Patient Photo Capture & Management
(function () {
  'use strict';

  let activeStream = null;
  let currentCapturedDataUrl = null;
  let currentFacingMode = 'user'; // 'user' or 'environment'
  let photoDialog = null;
  let streamReqId = 0;
  let dialogEventsBound = false;

  function ensurePhotoDialog() {
    let dialog = document.getElementById('patient-photo-dialog');
    if (dialog) {
      return dialog;
    }

    dialog = document.createElement('dialog');
    dialog.id = 'patient-photo-dialog';
    dialog.innerHTML = `
      <div class="photo-dialog-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span id="photo-dialog-title">ថត ឬ បញ្ចូលរូបថតអ្នកជំងឺ (Patient Photo)</span>
        </h3>
        <button type="button" class="btn-close" id="btn-close-photo-dialog" aria-label="បិទ">&times;</button>
      </div>

      <div class="photo-dialog-body">
        <div class="photo-tab-bar">
          <button type="button" class="photo-tab-btn active" id="tab-btn-camera">
            📷 ប្រើម៉ាស៊ីនថត (Camera)
          </button>
          <button type="button" class="photo-tab-btn" id="tab-btn-upload">
            📁 ជ្រើសឯកសាររូបភាព (Upload File)
          </button>
        </div>

        <!-- Camera Section -->
        <div id="photo-camera-section">
          <div class="photo-camera-viewport" id="camera-viewport">
            <video id="photo-video-stream" autoplay playsinline muted></video>
            <img id="photo-captured-preview" style="display:none;" alt="Captured preview">
            <div class="camera-guide-overlay" id="camera-guide"></div>
            <div id="camera-error-msg" style="display:none; color:#fca5a5; padding:16px; text-align:center;"></div>
          </div>

          <div class="photo-camera-controls" id="camera-controls">
            <button type="button" class="btn-photo-secondary" id="btn-switch-camera" title="ត្រលប់កាមេរ៉ា">
              🔄 ត្រលប់កាមេរ៉ា
            </button>
            <button type="button" class="btn-photo-primary" id="btn-capture-photo">
              📸 ថតរូប
            </button>
            <button type="button" class="btn-photo-secondary" id="btn-retake-photo" style="display:none;">
              ↺ ថតម្តងទៀត
            </button>
          </div>
        </div>

        <!-- File Upload Section -->
        <div id="photo-upload-section" style="display:none;">
          <input type="file" id="photo-file-input" accept="image/*" style="display:none;">
          <div class="photo-upload-zone" id="photo-upload-dropzone">
            <div style="font-size:36px; margin-bottom:8px;">🖼️</div>
            <p style="font-weight:700; margin:0 0 6px 0; color:#0369a1;">ចុចទីនេះ ឬ អូសទម្លាក់រូបថត</p>
            <p style="font-size:12px; color:#64748b; margin:0;">គាំទ្រ JPEG, PNG, WebP (រហូតដល់ 10MB)</p>
          </div>
          <div id="upload-preview-container" style="display:none; margin-top:14px; text-align:center;">
            <img id="upload-preview-img" style="max-width:240px; max-height:240px; border-radius:10px; border:2px solid #0284c7; object-fit:cover;" alt="Upload preview">
            <div style="margin-top:10px;">
              <button type="button" class="btn-photo-secondary" id="btn-change-upload-file">ជ្រើសរូបភាពផ្សេង</button>
            </div>
          </div>
        </div>
      </div>

      <div class="photo-dialog-footer">
        <div>
          <button type="button" class="btn-photo-danger" id="btn-remove-photo" style="display:none;">
            🗑️ លុបរូបថតចេញ
          </button>
        </div>
        <div class="photo-action-btn-group">
          <button type="button" class="btn-photo-secondary" id="btn-cancel-photo">បោះបង់</button>
          <button type="button" class="btn-photo-primary" id="btn-save-photo" disabled>
            💾 រក្សាទុករូបថត
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    if (!dialogEventsBound) {
      bindDialogEvents(dialog);
      dialogEventsBound = true;
    }
    return dialog;
  }

  function stopCameraStream() {
    if (activeStream) {
      try {
        activeStream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('Error stopping camera stream:', e);
      }
      activeStream = null;
    }
    const video = document.getElementById('photo-video-stream');
    if (video) {
      video.srcObject = null;
    }
  }

  async function startCameraStream(facingMode = 'user') {
    stopCameraStream();
    const reqId = ++streamReqId;
    const dialog = document.getElementById('patient-photo-dialog');
    const video = document.getElementById('photo-video-stream');
    const errorMsg = document.getElementById('camera-error-msg');
    const guide = document.getElementById('camera-guide');
    if (!video || !dialog || !dialog.open) return;

    if (errorMsg) errorMsg.style.display = 'none';
    video.style.display = 'block';
    if (guide) guide.style.display = 'block';

    const capturedPreview = document.getElementById('photo-captured-preview');
    if (capturedPreview) capturedPreview.style.display = 'none';

    const btnRetake = document.getElementById('btn-retake-photo');
    const btnCapture = document.getElementById('btn-capture-photo');
    if (btnRetake) btnRetake.style.display = 'none';
    if (btnCapture) btnCapture.style.display = 'inline-flex';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (errorMsg) {
        errorMsg.textContent = 'កម្មវិធីរុករកមិនគាំទ្រម៉ាស៊ីនថតទេ (Camera not supported or blocked by HTTPS policy). សូមប្រើផ្ទាំង "ជ្រើសឯកសាររូបភាព" ជំនួស។';
        errorMsg.style.display = 'block';
      }
      video.style.display = 'none';
      if (guide) guide.style.display = 'none';
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const curDlg = document.getElementById('patient-photo-dialog');
      if (reqId !== streamReqId || !curDlg || !curDlg.open) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      activeStream = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});
    } catch (err) {
      console.warn('Camera access error:', err);
      // Fallback try without facingMode constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const curDlg = document.getElementById('patient-photo-dialog');
        if (reqId !== streamReqId || !curDlg || !curDlg.open) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        video.srcObject = stream;
        await video.play().catch(() => {});
      } catch (err2) {
        const curDlg = document.getElementById('patient-photo-dialog');
        if (reqId !== streamReqId || !curDlg || !curDlg.open) return;
        if (errorMsg) {
          errorMsg.textContent = 'មិនអាចបើកម៉ាស៊ីនថតបានទេ (សូមអនុញ្ញាតសិទ្ធិ Camera ឬ ប្រើផ្ទាំងជ្រើសឯកសាររូបភាព)។';
          errorMsg.style.display = 'block';
        }
        video.style.display = 'none';
        if (guide) guide.style.display = 'none';
      }
    }
  }

  function compressImage(sourceElement, targetWidth = 360, targetHeight = 360, quality = 0.82) {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const sw = sourceElement.videoWidth || sourceElement.naturalWidth || sourceElement.width;
    const sh = sourceElement.videoHeight || sourceElement.naturalHeight || sourceElement.height;

    if (!sw || !sh) return null;

    // Center crop square/aspect ratio
    let sx = 0, sy = 0, sWidth = sw, sHeight = sh;
    const aspect = targetWidth / targetHeight;
    const sourceAspect = sw / sh;

    if (sourceAspect > aspect) {
      sWidth = sh * aspect;
      sx = (sw - sWidth) / 2;
    } else {
      sHeight = sw / aspect;
      sy = (sh - sHeight) / 2;
    }

    ctx.drawImage(sourceElement, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function bindDialogEvents(dialog) {
    const btnClose = dialog.querySelector('#btn-close-photo-dialog');
    const btnCancel = dialog.querySelector('#btn-cancel-photo');
    const tabCamera = dialog.querySelector('#tab-btn-camera');
    const tabUpload = dialog.querySelector('#tab-btn-upload');
    const cameraSection = dialog.querySelector('#photo-camera-section');
    const uploadSection = dialog.querySelector('#photo-upload-section');
    const btnSwitch = dialog.querySelector('#btn-switch-camera');
    const btnCapture = dialog.querySelector('#btn-capture-photo');
    const btnRetake = dialog.querySelector('#btn-retake-photo');
    const btnSave = dialog.querySelector('#btn-save-photo');
    const btnRemove = dialog.querySelector('#btn-remove-photo');
    const fileInput = dialog.querySelector('#photo-file-input');
    const dropzone = dialog.querySelector('#photo-upload-dropzone');
    const btnChangeUpload = dialog.querySelector('#btn-change-upload-file');
    const uploadPreviewContainer = dialog.querySelector('#upload-preview-container');
    const uploadPreviewImg = dialog.querySelector('#upload-preview-img');
    const capturedPreview = dialog.querySelector('#photo-captured-preview');
    const videoStream = dialog.querySelector('#photo-video-stream');
    const cameraGuide = dialog.querySelector('#camera-guide');

    function closeDialog() {
      streamReqId++; // Invalidate pending stream requests
      stopCameraStream();
      currentCapturedDataUrl = null;
      if (dialog && dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
    }

    btnClose.addEventListener('click', closeDialog);
    btnCancel.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('close', closeDialog);

    tabCamera.addEventListener('click', () => {
      tabCamera.classList.add('active');
      tabUpload.classList.remove('active');
      cameraSection.style.display = 'block';
      uploadSection.style.display = 'none';
      if (!currentCapturedDataUrl) {
        startCameraStream(currentFacingMode);
      }
    });

    tabUpload.addEventListener('click', () => {
      tabUpload.classList.add('active');
      tabCamera.classList.remove('active');
      cameraSection.style.display = 'none';
      uploadSection.style.display = 'block';
      stopCameraStream();
    });

    btnSwitch.addEventListener('click', () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      startCameraStream(currentFacingMode);
    });

    async function persistPatientPhotoIfLoaded(photoDataUrl) {
      const p = typeof window.getLoadedEmrPatient === 'function' ? window.getLoadedEmrPatient() : null;
      const patientKey = p?.patientKey || p?.id || p?.patient_key || new URLSearchParams(location.search).get('patient') || new URLSearchParams(location.search).get('patientKey') || '';
      if (!patientKey) return;
      try {
        const csrf = window.emrCsrfToken || window.csrfToken || '';
        const res = await fetch('/api/patient-photo', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf
          },
          body: JSON.stringify({ patientKey, photo: photoDataUrl, expectedVersion: Number.isInteger(p?.version) ? p.version : undefined })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || 'មិនអាចរក្សាទុករូបថតបានទេ');
        if (res.ok) {
          if (p) {
            if (Number.isInteger(result.patientVersion)) p.version = result.patientVersion;
            if (result.updatedAt) p.updatedAt = result.updatedAt;
            p.photo = photoDataUrl;
            if (p.data) {
              p.data['scope:registration:id:web_patient_photo'] = photoDataUrl;
              p.data['scope:registration:id:patient_photo'] = photoDataUrl;
              p.data['system:patientPhoto'] = photoDataUrl;
            }
          }
        }
      } catch (err) {
        alert(err.message || 'មិនអាចរក្សាទុករូបថតបានទេ');
        console.warn('Failed to auto-persist photo:', err);
      }
    }
    window.persistPatientPhotoIfLoaded = persistPatientPhotoIfLoaded;

    btnCapture.addEventListener('click', async () => {
      if (!videoStream || videoStream.readyState < 2) return;
      const dataUrl = compressImage(videoStream);
      if (dataUrl) {
        currentCapturedDataUrl = dataUrl;
        stopCameraStream();
        window.updatePatientPhotoDisplay(dataUrl);
        await persistPatientPhotoIfLoaded(dataUrl);
        closeDialog();
      }
    });

    btnRetake.addEventListener('click', () => {
      currentCapturedDataUrl = null;
      btnSave.disabled = true;
      startCameraStream(currentFacingMode);
    });

    // Upload Dropzone
    dropzone.addEventListener('click', () => fileInput.click());
    btnChangeUpload.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#0284c7';
      dropzone.style.background = '#f0f9ff';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#cbd5e1';
      dropzone.style.background = '#f8fafc';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#cbd5e1';
      dropzone.style.background = '#f8fafc';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleImageFile(fileInput.files[0]);
      }
    });

    function handleImageFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('សូមជ្រើសឯកសាររូបភាពត្រឹមត្រូវ។');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          const compressed = compressImage(img);
          if (compressed) {
            currentCapturedDataUrl = compressed;
            window.updatePatientPhotoDisplay(compressed);
            await persistPatientPhotoIfLoaded(compressed);
            closeDialog();
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

    btnRemove.addEventListener('click', async () => {
      if (confirm('តើលោកអ្នកពិតជាចង់លុបរូបថតអ្នកជំងឺនេះមែនទេ?')) {
        window.updatePatientPhotoDisplay('');
        await persistPatientPhotoIfLoaded('');
        closeDialog();
      }
    });

    btnSave.addEventListener('click', () => {
      if (currentCapturedDataUrl) {
        window.updatePatientPhotoDisplay(currentCapturedDataUrl);
        closeDialog();
      }
    });
  }

  // Updates all visual elements with the patient photo Data URL
  window.updatePatientPhotoDisplay = function (photoDataUrl) {
    const photo = photoDataUrl || '';

    // 1. Hidden inputs for form persistence
    const hiddenInputs = [
      document.getElementById('web_patient_photo'),
      document.querySelector('input[name="system:patientPhoto"]'),
      document.querySelector('input[name="scope:registration:id:patient_photo"]'),
      document.getElementById('reg_patient_photo_input')
    ];
    hiddenInputs.forEach((inp) => {
      if (inp) {
        inp.value = photo;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // 2. Registration Avatar preview
    const regAvatars = document.querySelectorAll('.registration-avatar, #reg_patient_photo_avatar');
    regAvatars.forEach((avatar) => {
      avatar.setAttribute('tabindex', '0');
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('aria-label', 'ថត ឬ បញ្ចូលរូបថតអ្នកជំងឺ (Capture or Upload Photo)');
      if (photo) {
        avatar.innerHTML = `<img src="${photo}" alt="Patient photo">`;
      } else {
        avatar.innerHTML = `
          <div style="text-align: center; color: #64748b;">
            <div style="font-size: 40px; margin-bottom: 8px;">📷</div>
            <div style="font-weight: 700; font-size: 13px; color: #0284c7;">ចុចដើម្បីថតរូប</div>
            <div style="font-size: 11px; margin-top: 4px;">Webcam / Upload</div>
          </div>
        `;
      }
    });

    // 3. OPD Form Patient Header Banner
    const opdPhotoFrames = document.querySelectorAll('.opd-patient-photo-frame, #opd_patient_photo_frame');
    opdPhotoFrames.forEach((frame) => {
      if (photo) {
        frame.innerHTML = `<img src="${photo}" alt="Patient Photo"><div class="photo-retake-camera-badge" data-action="capture-patient-photo" title="ថតរូបអ្នកជំងឺឡើងវិញ (Retake photo)">📷</div>`;
      } else {
        frame.innerHTML = `<div class="photo-placeholder" title="គ្មានរូបថត">👤</div><div class="photo-retake-camera-badge" data-action="capture-patient-photo" title="ថតរូបអ្នកជំងឺ (Take photo)">📷</div>`;
      }
    });

    // 4. IPD Form Patient Header Banner
    const ipdPhotoFrames = document.querySelectorAll('.ipd-patient-photo-frame, #ipd_patient_photo_frame');
    ipdPhotoFrames.forEach((frame) => {
      if (photo) {
        frame.innerHTML = `<img src="${photo}" alt="Patient Photo"><div class="photo-retake-camera-badge" data-action="capture-patient-photo" title="ថតរូបអ្នកជំងឺឡើងវិញ (Retake photo)">📷</div>`;
      } else {
        frame.innerHTML = `<div class="photo-placeholder" title="គ្មានរូបថត">👤</div><div class="photo-retake-camera-badge" data-action="capture-patient-photo" title="ថតរូបអ្នកជំងឺ (Take photo)">📷</div>`;
      }
    });

    // 5. Inpatient Context Workspace Header
    const contextAvatars = document.querySelectorAll('.inpatient-context-avatar-card, #inpatient_context_avatar');
    contextAvatars.forEach((card) => {
      if (photo) {
        card.innerHTML = `<img src="${photo}" alt="Patient Photo">`;
      } else {
        card.innerHTML = `<div style="color:#64748b; font-size:24px;">👤</div>`;
      }
    });

    // 6. Triage Form Patient Photo Frame (Level with patient name)
    const triagePhotoFrames = document.querySelectorAll('.triage-patient-photo-frame, #triage_patient_photo_frame');
    triagePhotoFrames.forEach((frame) => {
      frame.style.cursor = 'pointer';
      frame.setAttribute('data-action', 'capture-patient-photo');
      if (photo) {
        frame.innerHTML = `<img src="${photo}" alt="Patient Photo" style="width:100%; height:100%; object-fit:cover; border-radius:6px; cursor:pointer;">`;
      } else {
        frame.innerHTML = `<div class="photo-placeholder" style="font-size: 48px; color: #cbd5e1; cursor:pointer;" title="គ្មានរូបថត - ចុចដើម្បីថតរូប">👤</div>`;
      }
    });

    // Mark dirty flag if available to trigger unsaved state
    if (typeof window.patientRecordDirty !== 'undefined') {
      window.patientRecordDirty = true;
    }
  };

  // Open photo modal dialog
  window.openPatientPhotoModal = function () {
    const dialog = ensurePhotoDialog();
    currentCapturedDataUrl = null;

    // Check existing photo
    const existingPhotoInput = document.getElementById('web_patient_photo') ||
      document.querySelector('input[name="system:patientPhoto"]') ||
      document.querySelector('input[name="scope:registration:id:patient_photo"]');
    const existingPhoto = existingPhotoInput ? existingPhotoInput.value : '';

    const btnRemove = dialog.querySelector('#btn-remove-photo');
    if (btnRemove) {
      btnRemove.style.display = existingPhoto ? 'inline-flex' : 'none';
    }

    const btnSave = dialog.querySelector('#btn-save-photo');
    if (btnSave) btnSave.disabled = true;

    // Reset upload zone
    const dropzone = dialog.querySelector('#photo-upload-dropzone');
    const uploadPreviewContainer = dialog.querySelector('#upload-preview-container');
    const fileInput = dialog.querySelector('#photo-file-input');
    if (dropzone) dropzone.style.display = 'block';
    if (uploadPreviewContainer) uploadPreviewContainer.style.display = 'none';
    if (fileInput) fileInput.value = '';

    // Reset tabs to Camera
    const tabCamera = dialog.querySelector('#tab-btn-camera');
    const tabUpload = dialog.querySelector('#tab-btn-upload');
    const cameraSection = dialog.querySelector('#photo-camera-section');
    const uploadSection = dialog.querySelector('#photo-upload-section');
    if (tabCamera) tabCamera.classList.add('active');
    if (tabUpload) tabUpload.classList.remove('active');
    if (cameraSection) cameraSection.style.display = 'block';
    if (uploadSection) uploadSection.style.display = 'none';

    dialog.showModal();
    startCameraStream(currentFacingMode);
  };
  window.openPatientPhotoDialog = window.openPatientPhotoModal;

  // Listen for patient-loaded event to automatically render photo
  document.addEventListener('emr:patient-loaded', (e) => {
    const patient = e.detail?.patient;
    const photo = patient?.photo || patient?.data?.['scope:registration:id:web_patient_photo'] || patient?.data?.['scope:registration:id:patient_photo'] || patient?.data?.['system:patientPhoto'] || '';
    if (photo) window.updatePatientPhotoDisplay(photo);
  });

  // Attach event delegation for photo click triggers
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.getLoadedEmrPatient === 'function') {
      const p = window.getLoadedEmrPatient();
      const photo = p?.photo || p?.data?.['scope:registration:id:web_patient_photo'] || p?.data?.['scope:registration:id:patient_photo'] || p?.data?.['system:patientPhoto'] || '';
      if (photo) window.updatePatientPhotoDisplay(photo);
    }
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.registration-avatar, #reg_patient_photo_avatar, .patient-header-photo-frame, .inpatient-context-avatar-card, .triage-patient-photo-frame, #triage_patient_photo_frame, [data-action="capture-patient-photo"]');
      if (trigger) {
        e.preventDefault();
        window.openPatientPhotoModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const trigger = e.target.closest && e.target.closest('.registration-avatar, #reg_patient_photo_avatar, [data-action="capture-patient-photo"]');
        if (trigger) {
          e.preventDefault();
          window.openPatientPhotoModal();
        }
      }
      if (e.key === 'Escape') {
        const dlg = document.getElementById('patient-photo-dialog');
        if (dlg && dlg.open) {
          e.preventDefault();
          dlg.close();
        }
      }
    });
  });
})();
