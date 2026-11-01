import { unitLabel, systemOfUnit } from './units';

const FRACTIONS = [
  [0, ''],
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
  [1, ''],
];

/**
 * roundImperial(v): rounds to a kitchen-friendly number.
 *   < 10  -> nearest 1/8 or 1/3 step (0.333.. -> 1/3, 0.3 -> 1/3, 1.06 -> 1)
 *   10-20 -> nearest 1/2
 *   >= 20 -> nearest whole
 *   any positive value never rounds to 0 (min 1/8).
 */
export function roundImperial(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v <= 0) return 0;
  if (v >= 20) return Math.round(v);
  if (v >= 10) return Math.round(v * 2) / 2;
  const whole = Math.floor(v);
  const frac = v - whole;
  let best = 0;
  let bestDiff = Infinity;
  for (const [f] of FRACTIONS) {
    const d = Math.abs(frac - f);
    if (d < bestDiff - 1e-9) {
      bestDiff = d;
      best = f;
    }
  }
  const r = whole + best;
  return r === 0 ? 1 / 8 : r;
}

/** Metric rounding: < 10 -> 1 decimal, otherwise whole numbers. */
export function roundMetric(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v <= 0) return 0;
  if (v < 10) return Math.max(Math.round(v * 10) / 10, 0.1);
  return Math.round(v);
}

function fractionString(r) {
  const whole = Math.floor(r + 1e-9);
  const frac = r - whole;
  let label = '';
  for (const [f, l] of FRACTIONS) {
    if (Math.abs(frac - f) < 1e-6) {
      label = l;
      if (f === 1) return String(whole + 1);
      break;
    }
  }
  if (!label && frac > 1e-6) {
    // Not a known fraction (shouldn't happen after roundImperial) - fall back to decimals
    return String(Number(r.toFixed(2)));
  }
  if (whole === 0) return label || '0';
  return label ? `${whole} ${label}` : String(whole);
}

/**
 * formatAmount(value, system = 'imperial') -> string
 *   imperial: fractions to the nearest 1/8 (or 1/3): 1.5 -> "1 1/2", 0.3333 -> "1/3", 10 -> "10"
 *   metric:   up to 2 decimals, no trailing zeros: 473.176 -> "473.18", 1.5 -> "1.5", 10 -> "10"
 *   null/NaN/Infinity -> ""
 */
export function formatAmount(value, system = 'imperial') {
  if (value === null || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  if (system === 'metric') {
    return String(Number(value.toFixed(2)));
  }
  return fractionString(roundImperial(value));
}

/** Formats one already-friendly part. */
export function formatPart(part) {
  if (!part) return '';
  if (part.value === null || part.value === undefined) {
    if (part.isToTaste) return part.note || 'to taste';
    return part.note || '';
  }
  const metric = (part.category === 'volume' || part.category === 'weight')
    && (part.system || systemOfUnit(part.unit)) === 'metric';
  const amount = formatAmount(part.value, metric ? 'metric' : 'imperial');
  const shown = metric ? Number(part.value.toFixed(2)) : roundImperial(part.value);
  const label = unitLabel(part.unit, shown > 1);
  return label ? `${amount} ${label}` : amount;
}
