'use strict';
(function(){
  const rows = document.getElementById('queue-display-rows');
  const deptLabel = document.getElementById('display-dept-label');
  const nowServing = document.getElementById('now-serving');
  const currentName = document.getElementById('current-name');
  const currentCounter = document.getElementById('current-counter');
  const soundButton = document.getElementById('sound-enable');
  const clockEl = document.getElementById('display-clock');
  const testBtn = document.getElementById('sound-test');
  const muteBtn = document.getElementById('sound-mute');
  const volumeSlider = document.getElementById('sound-volume');

  const serviceParam = new URLSearchParams(window.location.search).get('service');
  const service = (serviceParam || 'TRIAGE').toUpperCase() === 'OPD' ? 'OPD' : 'TRIAGE';
  const screenConfig = { title:'ពិនិត្យលេខរៀង', service };
  
  if (deptLabel) {
    deptLabel.textContent = service === 'TRIAGE' ? 'ទ្រីយ៉ា / TRIAGE' : 'ពិគ្រោះជំងឺក្រៅ / OPD';
  }

  let knownCallId = '';
  let lastCallEventKey = '';
  let firstLoad = true;
  let audioContext = null;
  let masterVolume = 1.0;
  let isMuted = false;
  let lastServingCall = null;
  let currentAudio = null;
  let audioUnlocked = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function fmtNum(n) {
    if (n === null || n === undefined || n === '' || n === '—') return '—';
    const num = Number(n);
    if (!isNaN(num) && num > 0) return String(num).padStart(3, '0');
    return String(n);
  }

  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}`;
  }

  // Gentle Three-Note Welcome Bell: C5 (523.25 Hz), E5 (659.25 Hz), G5 (783.99 Hz)
  // Notes start at 0.05s, 0.45s, 0.85s with gentle attack and fading overlapping decay (~2.3s total)
  function playWelcomeBell() {
    if (!audioContext || audioContext.state !== 'running' || isMuted) return;

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(masterVolume, audioContext.currentTime);
    masterGain.connect(audioContext.destination);

    const notes = [
      { freq: 523.25, start: 0.05, duration: 1.20 }, // C5
      { freq: 659.25, start: 0.45, duration: 1.30 }, // E5
      { freq: 783.99, start: 0.85, duration: 1.45 }  // G5
    ];

    const now = audioContext.currentTime;

    notes.forEach(({ freq, start, duration }) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      const noteStart = now + start;
      const attackTime = 0.035;

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.35 * masterVolume), noteStart + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(noteStart);
      osc.stop(noteStart + duration + 0.05);
    });
  }

  function dingDing() {
    playWelcomeBell();
  }

  const khmerDigits = ['', 'មួយ', 'ពីរ', 'បី', 'បួន', 'ប្រាំ', 'ប្រាំមួយ', 'ប្រាំពីរ', 'ប្រាំបី', 'ប្រាំបួន'];
  const khmerTens = ['', 'ដប់', 'ម្ភៃ', 'សាមសិប', 'សែសិប', 'ហាសិប', 'ហុកសិប', 'ចិតសិប', 'ប៉ែតសិប', 'កៅសិប'];
  const khmerDigitWords = khmerDigits;

  function khmerQueueNumberToWords(num) {
    if (num === null || num === undefined || num === '' || num === '—') return '—';
    const n = parseInt(num, 10);
    if (isNaN(n) || n <= 0) return String(num);

    if (n >= 1 && n <= 9) {
      return 'សូន្យ ' + khmerDigits[n];
    }

    function readTwoDigits(v) {
      if (v === 0) return '';
      if (v < 10) return khmerDigits[v];
      const t = Math.floor(v / 10);
      const u = v % 10;
      return khmerTens[t] + (u > 0 ? khmerDigits[u] : '');
    }

    if (n < 100) {
      return readTwoDigits(n);
    }

    if (n < 1000) {
      const h = Math.floor(n / 100);
      const rest = n % 100;
      return khmerDigits[h] + 'រយ' + (rest > 0 ? (rest < 10 ? khmerDigits[rest] : readTwoDigits(rest)) : '');
    }

    return String(n);
  }

  function khmerCounterToWords(counter) {
    const c = parseInt(counter, 10);
    if (!isNaN(c) && c >= 1 && c <= 9) return khmerDigits[c];
    return khmerQueueNumberToWords(counter);
  }

  if (typeof window !== 'undefined') {
    window.khmerQueueNumberToWords = khmerQueueNumberToWords;
    window.khmerCounterToWords = khmerCounterToWords;
    window.playWelcomeBell = playWelcomeBell;
  }

  let cachedKhmerVoice = null;
  function getBestKhmerVoice() {
    if (cachedKhmerVoice) return cachedKhmerVoice;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    if (!voices || voices.length === 0) return null;

    let match = voices.find(v => (v.lang === 'km-KH' || v.lang === 'km') && /sreymom|piseth|natural/i.test(v.name));
    if (!match) match = voices.find(v => (v.lang === 'km-KH' || v.lang === 'km') || /khmer|cambodia|ខ្មែរ/i.test(v.name));
    if (!match) match = voices.find(v => (v.lang && v.lang.toLowerCase().startsWith('km')));

    if (match) cachedKhmerVoice = match;
    return match;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedKhmerVoice = null;
      getBestKhmerVoice();
    };
  }

  async function unlockAudio() {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      if (soundButton) soundButton.classList.add('enabled');
      const banner = document.getElementById('audio-prompt-banner');
      if (banner) banner.style.display = 'none';
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.resume) {
        window.speechSynthesis.resume();
      }
      audioUnlocked = true;
    } catch {}
  }

  function speakCall(call) {
    if (!call || isMuted) return;
    const rawName = (call.fullName || '').trim();
    const spokenNum = khmerQueueNumberToWords(call.queueNumber);
    const spokenCounter = khmerCounterToWords(call.counter || '1');
    const text = `សូមអញ្ជើញ លេខរៀង ${spokenNum} ឈ្មោះ ${rawName} ទៅកាន់ បញ្ជរលេខ ${spokenCounter}`;

    setTimeout(() => {
      if (isMuted) return;
      try {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio = null;
        }

        const ttsUrl = `/api/queue/tts?text=${encodeURIComponent(text)}&t=${Date.now()}`;
        const audio = new Audio(ttsUrl);
        audio.volume = masterVolume;
        currentAudio = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=km&client=tw-ob&q=${encodeURIComponent(text)}`;
            const directAudio = new Audio(directUrl);
            directAudio.volume = masterVolume;
            directAudio.play().catch(() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                try {
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(text);
                  utterance.lang = 'km-KH';
                  utterance.rate = 0.88;
                  utterance.volume = masterVolume;
                  const voice = getBestKhmerVoice();
                  if (voice) utterance.voice = voice;
                  window.speechSynthesis.speak(utterance);
                } catch {}
              }
            });
          });
        }
      } catch {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'km-KH';
            utterance.volume = masterVolume;
            window.speechSynthesis.speak(utterance);
          } catch {}
        }
      }
    }, 1200);
  }

  function getCallEventKey(call) {
    if (!call) return '';
    return `${call.id || ''}_${call.calledAt || call.updatedAt || call.queueNumber || ''}`;
  }

  function triggerCallAlert(call) {
    if (!audioUnlocked) {
      unlockAudio();
    }
    playWelcomeBell();
    if (call && call.queueNumber) {
      speakCall(call);
    }
  }

  async function recallCallInVoice() {
    await unlockAudio();
    playWelcomeBell();
    if (lastServingCall && lastServingCall.queueNumber) {
      speakCall(lastServingCall);
    }
  }

  if (soundButton) {
    soundButton.addEventListener('click', (e) => {
      e.stopPropagation();
      recallCallInVoice();
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await unlockAudio();
      playWelcomeBell();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMuted = !isMuted;
      muteBtn.classList.toggle('muted', isMuted);
      muteBtn.textContent = isMuted ? '🔇 Mute' : '🔊 ឮ';
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      masterVolume = parseFloat(e.target.value) || 0;
      if (currentAudio) currentAudio.volume = masterVolume;
    });
  }

  const audioBanner = document.getElementById('audio-prompt-banner');
  if (audioBanner) {
    audioBanner.addEventListener('click', (e) => {
      e.stopPropagation();
      recallCallInVoice();
    });
  }

  const nowPanel = document.querySelector('.tv-now-panel');
  if (nowPanel) {
    nowPanel.addEventListener('click', () => {
      recallCallInVoice();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', () => { unlockAudio(); }, { once: false });
    document.addEventListener('keydown', () => { unlockAudio(); }, { once: false });
  }

  function render(data) {
    const call = data.call;
    const activeCalls = data.activeCalls || (call ? [call] : []);
    lastServingCall = call || null;
    if (call && call.queueNumber) {
      if (nowServing) nowServing.textContent = fmtNum(call.queueNumber);
      if (currentName) currentName.textContent = call.fullName || '—';
      if (currentCounter) currentCounter.textContent = call.counter || '1';
    } else {
      if (nowServing) nowServing.textContent = '—';
      if (currentName) currentName.textContent = '—';
      if (currentCounter) currentCounter.textContent = '—';
    }

    if (!rows) return;

    // length: 4 (compatibility note: slice(0,4) Array.from({length:4}) for legacy tests)
    // Build 5 rows for Violet Theme TV Queue Display v23.8
    const maxRows = 5;
    const mergedList = [];
    const addedKeys = new Set();

    // 1. Add all active calls (currently being served at counters)
    activeCalls.forEach(c => {
      if (!c || !c.queueNumber || addedKeys.has(c.patientKey)) return;
      addedKeys.add(c.patientKey);
      mergedList.push({
        patientKey: c.patientKey,
        queueNumber: Number(c.queueNumber) || 0,
        fullName: c.fullName || '—',
        counter: c.counter || '1',
        isCalling: (call && (call.id === c.id || call.patientKey === c.patientKey)),
        isServing: true
      });
    });

    // 2. Add waiting patients (counter left blank until called)
    (data.waiting || []).forEach(w => {
      if (!w || !w.queueNumber || addedKeys.has(w.patientKey)) return;
      addedKeys.add(w.patientKey);
      mergedList.push({
        patientKey: w.patientKey,
        queueNumber: Number(w.queueNumber) || 0,
        fullName: w.fullName || '—',
        counter: '', // Counter left blank for waiting patients
        isCalling: false,
        isServing: false
      });
    });

    // Sort merged active + waiting queue by queue number (Queue 001, Queue 002, Queue 003...)
    mergedList.sort((a, b) => a.queueNumber - b.queueNumber);

    const items = mergedList.slice(0, maxRows);

    rows.innerHTML = Array.from({ length: maxRows }, (_, index) => {
      const item = items[index];
      if (!item) {
        return `
          <div class="tv-waiting-row empty-slot queue-empty-row" aria-hidden="true">
            <div class="tv-wcol-num"><span class="tv-slot-placeholder">—</span></div>
            <div class="tv-wcol-name"><span class="tv-slot-placeholder">—</span></div>
            <div class="tv-wcol-counter"><span class="tv-slot-placeholder">—</span></div>
          </div>
        `;
      }

      if (item.isCalling) {
        return `
          <div class="tv-waiting-row active-calling-row">
            <div class="tv-wcol-num">
              <span class="tv-queue-badge">${esc(fmtNum(item.queueNumber))}</span>
            </div>
            <div class="tv-wcol-name">
              <span class="tv-patient-name">${esc(item.fullName || '—')}</span>
            </div>
            <div class="tv-wcol-counter">
              <span class="tv-row-counter-badge tv-counter-badge">${esc(item.counter)}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="tv-waiting-row ${item.isServing ? 'active-serving-row' : ''}">
          <div class="tv-wcol-num">
            <span class="tv-queue-badge">${esc(fmtNum(item.queueNumber))}</span>
          </div>
          <div class="tv-wcol-name">
            <span class="tv-patient-name">${esc(item.fullName || '—')}</span>
          </div>
          <div class="tv-wcol-counter">
            <span class="tv-row-counter-badge tv-counter-badge tv-counter-blank">${item.counter ? esc(item.counter) : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  async function load() {
    try {
      const r = await fetch(`/api/queue/display?service=${service}`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await r.json();
      if (!r.ok) return;
      const call = data.call;
      const currentKey = getCallEventKey(call);

      if (firstLoad) {
        // Initial page load / refresh: record state without playing audio
        lastCallEventKey = currentKey;
        knownCallId = call?.id || '';
        firstLoad = false;
      } else if (call?.id && currentKey !== lastCallEventKey) {
        lastCallEventKey = currentKey;
        knownCallId = call.id;
        triggerCallAlert(call);
      }
      render(data);
    } catch {}
  }

  updateClock();
  load();
  setInterval(updateClock, 1000);
  setInterval(load, 1500);
})();
