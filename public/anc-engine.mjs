// v42.6 - ANC engine (no page code; used by the ANC record page, the server
// and the tests). Rules come from the official files copied into
// server/catalogues (anc-color-chart.json, anc-visit-schedule.json) and the
// owner defaults in server/clinical-options.json "maternal".
// - Dates are 'YYYY-MM-DD' strings; GA is in weeks (decimal) from the EDD.
// - EDD = LMP + 280 days; a dating ultrasound before 14 weeks whose EDD is more
//   than 7 days different replaces it (the source is always returned).
// - Colour: every chart item is checked (automatic items from the data, the
//   others from tick boxes); the highest level wins: red > yellow > green.
// - Schedule: green = 4 visits (page 7), yellow / red = 8 visits (page 8).

export const DEFAULT_OPTIONS = Object.freeze({
  datingUltrasoundMaxWeeks: 14,
  datingUltrasoundMaxDifferenceDays: 7,
  prePregnancyWeightFromTriageMaxWeeks: 12,
  singleWeekVisitTolerance: 1,
  levelOverrides: { twins_y: 'red' },
  heightCheckBelowCm: 145,
});

const DAY = 86400000;
const LEVELS = { green: 0, yellow: 1, red: 2 };

export function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(time) ? null : time;
}

export function formatDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const time = parseDate(value);
  return time === null ? '' : formatDate(time + Math.round(days) * DAY);
}

export function daysBetween(from, to) {
  const a = parseDate(from), b = parseDate(to);
  return a === null || b === null ? null : Math.round((b - a) / DAY);
}

export function eddFromLmp(lmp) {
  return parseDate(lmp) === null ? '' : addDays(lmp, 280);
}

// The EDD used by the record and where it comes from ('lmp' | 'ultrasound' | '').
export function datingEdd({ lmp = '', ultrasoundEdd = '', ultrasoundDate = '' } = {}, options = DEFAULT_OPTIONS) {
  const fromLmp = eddFromLmp(lmp);
  const usEdd = parseDate(ultrasoundEdd) === null ? '' : String(ultrasoundEdd).slice(0, 10);
  let usEarly = false;
  if (usEdd && parseDate(ultrasoundDate) !== null) {
    const gaDaysAtScan = 280 - daysBetween(ultrasoundDate, usEdd);
    usEarly = gaDaysAtScan >= 0 && gaDaysAtScan < (options.datingUltrasoundMaxWeeks ?? 14) * 7;
  }
  if (fromLmp && usEdd && usEarly && Math.abs(daysBetween(fromLmp, usEdd)) > (options.datingUltrasoundMaxDifferenceDays ?? 7)) {
    return { edd: usEdd, source: 'ultrasound', lmpEdd: fromLmp };
  }
  if (fromLmp) return { edd: fromLmp, source: 'lmp', lmpEdd: fromLmp };
  if (usEdd) return { edd: usEdd, source: 'ultrasound', lmpEdd: '' };
  return { edd: '', source: '', lmpEdd: '' };
}

// GA on a date from the EDD: { weeks (decimal), completedWeeks, days, label '27+3' }.
export function gestationalAge(edd, date) {
  const left = daysBetween(date, edd);
  if (left === null) return null;
  const totalDays = 280 - left;
  if (totalDays < 0) return null;
  return { weeks: totalDays / 7, completedWeeks: Math.floor(totalDays / 7), days: totalDays % 7, label: `${Math.floor(totalDays / 7)}+${totalDays % 7}` };
}

// Date when the pregnancy reaches a GA (weeks).
export function dateAtGa(edd, weeks) {
  return parseDate(edd) === null ? '' : addDays(edd, weeks * 7 - 280);
}

export function bmi(weightKg, heightCm) {
  const w = Number(weightKg), h = Number(heightCm) / 100;
  if (!(w > 0) || !(h > 0)) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

// ---------------------------------------------------------------- colour
const num = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function parseBp(value) {
  const match = /(\d{2,3})\s*\/\s*(\d{2,3})/.exec(String(value || ''));
  return match ? { systolic: Number(match[1]), diastolic: Number(match[2]) } : null;
}

// 'positive' | 'negative' | '' from a typed or released result.
export function resultSign(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (/non[\s-]?reactive|negative|neg\b|\u17a2\u179c\u17b7\u1787\u17d2\u1787\u1798\u17b6\u1793|^-$|^\(-\)$/.test(text)) return 'negative';
  if (/reactive|positive|pos\b|\u179c\u17b7\u1787\u17d2\u1787\u1798\u17b6\u1793|^\+$|^\(\+\)$/.test(text)) return 'positive';
  return '';
}

// Facts the automatic chart items use. record = the ANC record; visits = saved
// visits (oldest first); today = date of the check.
export function ancFacts(record = {}, visits = [], today = '') {
  const identity = record.identity || {};
  const previous = Array.isArray(record.previous) ? record.previous.filter((row) => row && Object.values(row).some(Boolean)) : [];
  const labs = Array.isArray(record.labs) ? record.labs : [];
  const latest = (pick) => {
    for (const source of [...visits].reverse()) { const value = pick(source); if (value !== null && value !== undefined && value !== '') return value; }
    return null;
  };
  const latestLab = (key) => {
    const fromTable = [...labs].filter((column) => column && String(column[key] ?? '').trim()).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).pop();
    const fromVisit = latest((visit) => visit?.rapid?.[key]);
    const tableDate = fromTable?.date || '';
    const visitDate = latest((visit) => (visit?.rapid?.[key] ? visit.date : null)) || '';
    if (fromTable && (!fromVisit || tableDate >= visitDate)) return fromTable[key];
    return fromVisit;
  };
  const dating = datingEdd({ lmp: record.lmp, ultrasoundEdd: record.ultrasoundEdd, ultrasoundDate: record.ultrasoundDate });
  const ga = today && dating.edd ? gestationalAge(dating.edd, today) : null;
  const bp = parseBp(latest((visit) => visit?.bp));
  const births = num(identity.births);
  const miscarriages = num(identity.miscarriages);
  const abortions = num(identity.abortions);
  const caesareanRows = previous.filter((row) => /caesarean|c-section|\u179c\u17c7\u1780\u17b6\u178f\u17cb/i.test(String(row.deliveryType || ''))).length;
  const lastBirth = previous.map((row) => row.date).filter((date) => parseDate(date) !== null).sort().pop();
  const monthsSince = lastBirth && today ? Math.floor(daysBetween(lastBirth, today) / 30.4375) : null;
  const group = String(latestLab('group') || '');
  return {
    age: num(identity.age),
    heightCm: num(record.heightCm),
    prePregnancyBmi: bmi(record.prePregnancyWeightKg, record.heightCm),
    bp,
    births,
    miscarriages,
    abortionsMiscarriages: births === null && miscarriages === null && abortions === null ? null : (miscarriages || 0) + (abortions || 0),
    caesareans: Math.max(caesareanRows, num(identity.caesareans) || 0) || (previous.length ? 0 : null),
    monthsSinceLastBirth: monthsSince,
    gaWeeks: ga ? ga.weeks : null,
    hb: num(latestLab('hb')),
    hiv: resultSign(latestLab('hiv')),
    syphilis: resultSign(latestLab('syphilis')),
    hbsag: resultSign(latestLab('hbsag')),
    rhesus: /neg|rh\s*-|[abo]+\s*-|\(-\)|\u17a2\u179c\u17b7\u1787\u17d2\u1787\u1798\u17b6\u1793/i.test(group) ? 'negative' : group ? 'positive' : '',
  };
}

// Automatic items: true (applies), false (does not apply), null (unknown).
const AUTO = {
  age_normal: (f) => (f.age === null ? null : f.age >= 20 && f.age <= 34),
  age_risk: (f) => (f.age === null ? null : f.age < 20 || f.age > 34),
  height_normal: (f) => (f.heightCm === null ? null : f.heightCm > 150),
  height_risk: (f) => (f.heightCm === null ? null : f.heightCm <= 150),
  bmi_normal: (f) => (f.prePregnancyBmi === null ? null : f.prePregnancyBmi >= 18.5 && f.prePregnancyBmi < 25),
  bmi_risk: (f) => (f.prePregnancyBmi === null ? null : f.prePregnancyBmi < 18.5 || (f.prePregnancyBmi >= 25 && f.prePregnancyBmi <= 30)),
  bmi_high: (f) => (f.prePregnancyBmi === null ? null : f.prePregnancyBmi > 30),
  bp_normal: (f) => (f.bp ? f.bp.systolic < 140 && f.bp.diastolic < 90 : null),
  bp_risk: (f) => (f.bp ? (f.bp.systolic >= 140 || f.bp.diastolic >= 90) && f.bp.systolic < 160 && f.bp.diastolic < 110 : null),
  bp_severe: (f) => (f.bp ? f.bp.systolic >= 160 || f.bp.diastolic >= 110 : null),
  anaemia_severe: (f) => (f.hb === null ? null : f.hb < 7),
  hb_moderate: (f) => (f.hb === null ? null : f.hb >= 7 && f.hb < 10),
  hb_normal: (f) => (f.hb === null ? null : f.hb >= 10),
  births_normal: (f) => (f.births === null ? null : f.births <= 3),
  many_children: (f) => (f.births === null ? null : f.births === 4),
  grand_multipara: (f) => (f.births === null ? null : f.births >= 5),
  no_abortion: (f) => (f.abortionsMiscarriages === null ? null : f.abortionsMiscarriages === 0),
  abortion_1: (f) => (f.abortionsMiscarriages === null ? null : f.abortionsMiscarriages >= 1),
  miscarriage_3: (f) => (f.miscarriages === null ? null : f.miscarriages >= 3),
  interval_ok: (f) => (f.monthsSinceLastBirth === null ? null : f.monthsSinceLastBirth > 24),
  interval_short: (f) => (f.monthsSinceLastBirth === null ? null : f.monthsSinceLastBirth <= 24),
  csection_1: (f) => (f.caesareans === null ? null : f.caesareans === 1),
  csection_2: (f) => (f.caesareans === null ? null : f.caesareans >= 2),
  post_term: (f) => (f.gaWeeks === null ? null : f.gaWeeks >= 41),
  infections_negative: (f) => ([f.hiv, f.syphilis, f.hbsag].every((v) => v === 'negative')),
  not_tested: (f) => ([f.hiv, f.syphilis, f.hbsag].some((v) => !v)),
  infection_positive: (f) => ([f.hiv, f.syphilis, f.hbsag].some((v) => v === 'positive')),
  rh_negative: (f) => (f.rhesus ? f.rhesus === 'negative' : null),
};

// { colour, reasons: [{ key, level, kh, auto }], flags: [] }. ticks: { itemKey: true }.
export function evaluateColour(chart, facts, ticks = {}, options = DEFAULT_OPTIONS) {
  const reasons = [];
  const flags = [];
  for (const section of chart?.sections || []) {
    for (const item of section.items || []) {
      const level = options.levelOverrides?.[item.key] || item.level;
      const rule = AUTO[item.key];
      const automatic = rule && item.auto ? rule(facts) : null;
      const applies = automatic === true || Boolean(ticks[item.key]);
      if (applies && level !== 'green') reasons.push({ key: item.key, level, kh: item.kh, section: section.key, auto: automatic === true });
    }
  }
  if (facts.heightCm !== null && facts.heightCm < (options.heightCheckBelowCm ?? 145)) flags.push('height-check');
  const colour = reasons.reduce((best, reason) => (LEVELS[reason.level] > LEVELS[best] ? reason.level : best), 'green');
  return { colour, reasons, flags };
}

// ---------------------------------------------------------------- schedule
export function planFor(colour, schedule) {
  return colour === 'green' ? schedule.green : schedule.yellowRed;
}

const CATEGORIES = ['records', 'lab', 'exam', 'ultrasound', 'care'];

// What a task does: own result field, a Laboratory / Imaging order, the iron
// prescription, the tetanus vaccine, or a simple check.
export function taskAction(category, text) {
  const value = String(text || '');
  if (category === 'ultrasound') return /^\*/.test(value) ? 'check' : 'order:ULTRASOUND';
  if (category === 'lab') {
    if (/Hepatitis B/i.test(value)) return 'order:HBSAG';
    if (/OGTT/i.test(value)) return 'order:OGTT';
    if (/CBC/i.test(value)) return 'own:hb';
    if (/^HIV$/i.test(value.trim())) return 'own:hiv';
    if (/Syphilis/i.test(value)) return 'own:syphilis';
    if (/\u1780\u17d2\u179a\u17bb\u1798\u1788\u17b6\u1798/.test(value)) return 'order:BLOOD_GROUP';
    if (/\u1791\u17b9\u1780\u1793\u17c4\u1798/.test(value)) return 'own:urine';
    return 'check';
  }
  if (category === 'care') {
    if (/\u1787\u17b6\u178f\u17b7\u178a\u17c2\u1780/.test(value)) return 'rx:iron';
    if (/\u178f\u17c1\u178f\u17b6\u178e\u17bc\u179f/.test(value)) return 'vaccine:tt';
    return 'check';
  }
  return 'check';
}

export function tasksFor(visit) {
  if (!visit) return [];
  return CATEGORIES.flatMap((category) => (visit[category] || []).map((text, index) => ({
    key: `${visit.visit}:${category}:${index}`, visit: visit.visit, category, text, action: taskAction(category, text),
  })));
}

// Automatically done from the data (results typed or released).
export function taskDoneByData(task, facts, visit) {
  if (task.action === 'own:hiv') return Boolean(facts.hiv);
  if (task.action === 'own:syphilis') return Boolean(facts.syphilis);
  if (task.action === 'order:HBSAG') return Boolean(facts.hbsag);
  if (task.action === 'own:hb') return facts.hb !== null;
  if (task.action === 'order:BLOOD_GROUP') return Boolean(facts.rhesus);
  if (task.action === 'own:urine') return Boolean(visit && (visit.proteinuria || visit.glucosuria));
  return false;
}

// The visit for a GA: { visit, next, scheduled }. doneVisits: visit numbers already seen.
export function visitForGa(plan, gaWeeks, doneVisits = []) {
  if (!plan || gaWeeks === null || gaWeeks === undefined) return { visit: null, next: plan?.visits?.[0] || null, scheduled: false };
  const week = Math.floor(gaWeeks);
  const matches = plan.visits.filter((visit) => week >= visit.gaFrom && week <= visit.gaTo);
  const visit = matches.find((item) => !doneVisits.includes(item.visit)) || matches[matches.length - 1] || null;
  const next = plan.visits.find((item) => item.gaFrom > week && (!visit || item.visit > visit.visit)) || null;
  return { visit, next, scheduled: Boolean(visit) };
}

// Tasks of earlier visits that are not done and not closed with a reason.
export function overdueTasks(plan, gaWeeks, taskState = {}, facts = {}) {
  if (!plan || gaWeeks === null || gaWeeks === undefined) return [];
  const week = Math.floor(gaWeeks);
  return plan.visits.filter((visit) => visit.gaTo < week).flatMap(tasksFor)
    .filter((task) => !taskState[task.key] && !taskDoneByData(task, facts, null) && task.category !== 'records');
}

// Suggested date of the next visit (first day of its weeks); '' when none.
export function suggestedAppointment(edd, nextVisit) {
  return nextVisit ? dateAtGa(edd, nextVisit.gaFrom) : '';
}

// One summary for the page and the server.
export function ancStatus({ chart, schedule, record = {}, visits = [], today, options = DEFAULT_OPTIONS }) {
  const facts = ancFacts(record, visits, today);
  const colour = evaluateColour(chart, facts, record.ticks || {}, options);
  const dating = datingEdd({ lmp: record.lmp, ultrasoundEdd: record.ultrasoundEdd, ultrasoundDate: record.ultrasoundDate }, options);
  const ga = dating.edd ? gestationalAge(dating.edd, today) : null;
  const plan = planFor(colour.colour, schedule);
  const doneVisits = visits.map((visit) => visit.scheduleVisit).filter(Boolean);
  // GA not known yet (no LMP): the tasks of the first visit.
  const placed = ga ? visitForGa(plan, ga.weeks, doneVisits)
    : { visit: plan?.visits?.[0] || null, next: plan?.visits?.[1] || null, scheduled: Boolean(plan?.visits?.length) };
  const tasks = tasksFor(placed.visit).map((task) => ({ ...task, state: record.tasks?.[task.key] || null, autoDone: taskDoneByData(task, facts, visits[visits.length - 1]) }));
  return {
    facts, colour: colour.colour, reasons: colour.reasons, flags: colour.flags, dating, ga,
    plan: colour.colour === 'green' ? 'green' : 'yellowRed', visitsPlanned: plan?.visits?.length || 0,
    visit: placed.visit, next: placed.next, scheduled: placed.scheduled, tasks,
    overdue: overdueTasks(plan, ga ? ga.weeks : null, record.tasks || {}, facts),
    appointment: suggestedAppointment(dating.edd, placed.next),
  };
}
