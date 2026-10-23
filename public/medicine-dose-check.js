/* v42.5: maximum dose check (adult and paediatric), no DOM - used by
 * public/medication-safety.js and the tests.
 * - The dose is converted to the unit of the limit: number typed x strength
 *   (tablets x mg per tablet; mL x mg per mL from the strength text; mg as
 *   typed). Combinations use the limit "component" (e.g. trimethoprim).
 *   When the dose cannot be converted the result is "unconverted" (no alert).
 * - Per day = per dose x doses per day from the schedule (QD/BID/TID/QID/qH);
 *   a protocol schedule has no per-day check.
 * - Adult: maxPerDose / maxPerDay and, when given, per-kg limits x weight; the
 *   lower limit is used. Child: per-kg limits x weight, never above the child
 *   absolute caps; no weight -> "weight" (orange note, no red alert).
 * - Only APPROVED lines are used. "protocol" lines give guidance, "none" nothing. */
(function (root) {
  'use strict';
  var MASS = { mcg: 0.001, mg: 1, g: 1000 };
  // Row units that count pieces of a solid form (tablet, sachet, patch ...).
  var PIECES = ['គ្រាប់', 'កាប់ស៊ុល', 'គ្រាប់សុល', 'កញ្ចប់', 'ដុំ', 'បន្ទះ', 'បាញ់'];
  // Limits written per piece: the row unit that matches.
  var PIECE_LIMITS = { tablet: 'គ្រាប់', sachet: 'កញ្ចប់', drop: 'ដំណក់', ml: 'mL', vial: 'ផ្លាកុង' };

  function canonicalUnit(value) {
    var units = root.BorkeoMedicineUnits;
    var unit = units ? units.canonical(value) : String(value == null ? '' : value).trim();
    var lower = unit.toLowerCase();
    if (lower === 'mg' || lower === 'g' || lower === 'mcg' || lower === 'mmol') return lower;
    if (lower === 'ml') return 'mL';
    if (lower === 'iu' || lower === 'ui' || lower === 'unit' || lower === 'units') return 'IU';
    if (lower === 'microgram' || lower === 'micrograms' || lower === 'µg') return 'mcg';
    return unit;
  }

  // "500 000" (thousands with a space) = 500000; "2,5" = 2.5.
  function number(text) { return parseFloat(String(text).replace(/(\d)\s(?=\d{3}\b)/g, '$1').replace(',', '.')); }

  // Amount of the active medicine in one piece, or per mL for liquids.
  // Returns { amount, unit, volume } (volume in mL, null for a solid form) or null.
  function parseStrength(item, component) {
    var text = String(item && item.strength || '');
    if (!text) return null;
    var volume = null, match;
    if ((match = /(?:\/|\bper)\s*(\d+(?:[.,]\d+)?)?\s*-?\s*ml\b/i.exec(text))) volume = match[1] ? number(match[1]) : 1;
    else if ((match = /\bin\s+(\d+(?:[.,]\d+)?)\s*-?\s*ml\b/i.exec(text))) volume = number(match[1]);
    var parts = text.split('+');
    var index = 0;
    if (parts.length > 1) {
      var wanted = String(component || '').toLowerCase().trim();
      if (!wanted) return null;
      var names = String(item.name || '').toLowerCase().split('+').map(function (n) { return n.trim(); });
      // The component named in the strength ("60 mg elemental iron"), else by its place in the name.
      index = parts.findIndex(function (p) { return p.toLowerCase().indexOf(wanted) > -1; });
      if (index < 0) index = names.findIndex(function (n) { return n && (n.indexOf(wanted) > -1 || wanted.indexOf(n) > -1); });
      if (index < 0 || index >= parts.length) return null;
    }
    var part = parts[index];
    var percent = /(\d+(?:[.,]\d+)?)\s*%/.exec(part);
    var amount = /(\d{1,3}(?:\s\d{3})+|\d+(?:[.,]\d+)?)\s*(million\s*iu|mg|mcg|micrograms?|µg|g|iu|units?|mmol)\b/i.exec(part);
    if (amount) {
      var unitText = amount[2].toLowerCase().replace(/\s+/g, ' ');
      var value = number(amount[1]);
      if (unitText === 'million iu') { value *= 1e6; unitText = 'iu'; }
      if (!isFinite(value) || value <= 0) return null;
      return { amount: value, unit: canonicalUnit(unitText), volume: volume };
    }
    // "2%" (weight / volume): 2 g per 100 mL = 20 mg per mL.
    if (percent && !/\d\s*:\s*\d/.test(part.slice(0, percent.index))) return { amount: number(percent[1]) * 10, unit: 'mg', volume: 1 };
    return null;
  }

  function convert(value, from, to) {
    if (value === null || !isFinite(value)) return null;
    if (MASS[from] && MASS[to]) return value * MASS[from] / MASS[to];
    return from === to ? value : null;
  }

  // Dose in the unit of the limit, or null when it cannot be converted.
  function doseInLimitUnit(item, quantity, rowUnit, limit) {
    var qty = number(quantity);
    if (!isFinite(qty) || qty <= 0) return null;
    var limitUnit = String(limit && limit.unit || '').trim();
    var target = canonicalUnit(limitUnit);
    var row = canonicalUnit(rowUnit);
    var pieceRow = PIECE_LIMITS[limitUnit.toLowerCase()];
    if (pieceRow) return row === pieceRow ? qty : null;
    if (!(MASS[target] || target === 'IU' || target === 'mmol')) return null;   // rates (mcg/kg/min ...): not checked
    if (MASS[row] || row === 'IU' || row === 'mmol') return convert(qty, row, target);
    var strength = parseStrength(item, limit && limit.component);
    if (!strength) return null;
    if (PIECES.indexOf(row) > -1 && strength.volume === null) return convert(qty * strength.amount, strength.unit, target);
    if (row === 'mL' && strength.volume) return convert(qty * strength.amount / strength.volume, strength.unit, target);
    return null;
  }

  function lowest(values) {
    var list = values.filter(function (v) { return v !== null && v !== undefined && isFinite(v) && v > 0; });
    return list.length ? Math.min.apply(Math, list) : null;
  }

  function round(value) { return value === null ? null : Math.round(value * 100) / 100; }

  // ctx: { child: true|false|null, weightKg }. frequency: doses per day (0 = unknown).
  function evaluate(limit, item, quantity, rowUnit, frequency, ctx) {
    if (!limit || limit.status !== 'approved' || limit.type === 'none') return { level: 'none' };
    if (limit.type === 'protocol') return { level: 'guide', note: limit.note || '' };
    var perDose = doseInLimitUnit(item, quantity, rowUnit, limit);
    if (perDose === null) return { level: String(quantity || '').trim() ? 'unconverted' : 'none' };
    var perDay = frequency > 0 ? perDose * frequency : null;
    var weight = ctx && Number(ctx.weightKg) > 0 ? Number(ctx.weightKg) : null;
    var child = ctx && ctx.child === true;
    var c = limit.child || {}, a = limit.adult || {};
    var maxDose, maxDay;
    if (child) {
      var hasChildLimit = [c.maxPerDosePerKg, c.maxPerDayPerKg, c.maxPerDose, c.maxPerDay].some(function (v) { return v > 0; });
      if (!hasChildLimit) return { level: 'none' };
      if (!weight) return { level: 'weight' };
      maxDose = lowest([c.maxPerDosePerKg ? c.maxPerDosePerKg * weight : null, c.maxPerDose]);
      maxDay = lowest([c.maxPerDayPerKg ? c.maxPerDayPerKg * weight : null, c.maxPerDay]);
    } else {
      maxDose = lowest([a.maxPerDose, a.maxPerDosePerKg && weight ? a.maxPerDosePerKg * weight : null]);
      maxDay = lowest([a.maxPerDay, a.maxPerDayPerKg && weight ? a.maxPerDayPerKg * weight : null]);
    }
    var over = function (value, max) { return value !== null && max !== null && value > max * (1 + 1e-9); };
    var result = { level: 'ok', perDose: round(perDose), perDay: round(perDay), maxPerDose: round(maxDose), maxPerDay: round(maxDay),
      unit: limit.unit, child: child, weightKg: weight, note: limit.note || '' };
    if (over(perDose, maxDose) || over(perDay, maxDay)) {
      result.level = 'red';
      result.overDose = over(perDose, maxDose);
      result.overDay = over(perDay, maxDay);
    }
    return result;
  }

  // Doses per day of a schedule value (discharge rows; the EMR rows use
  // getMedicationDailyFrequency in EMR.html).
  function frequencyOf(scheduleType, qHours) {
    var type = String(scheduleType || '');
    if (/^qd/.test(type)) return 1;
    if (type === 'bid') return 2;
    if (type === 'tid') return 3;
    if (type === 'qid') return 4;
    if (type === 'qh') { var h = number(qHours); return h > 0 ? 24 / h : 0; }
    return 0;
  }

  root.BorkeoDoseCheck = Object.freeze({ parseStrength: parseStrength, doseInLimitUnit: doseInLimitUnit, evaluate: evaluate, frequencyOf: frequencyOf, canonicalUnit: canonicalUnit });
})(typeof window !== 'undefined' ? window : globalThis);
