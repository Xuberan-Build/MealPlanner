import { parseAmount } from './parseAmount';
import {
  normalizeUnit,
  toBase,
  fromBase,
  systemOfUnit,
  VOLUME_TO_ML,
  WEIGHT_TO_G,
} from './units';
import { roundImperial, roundMetric, formatPart } from './format';

/**
 * A "part" is the unit of quantity math:
 *   { value: number|null, unit: canonical unit, category: 'volume'|'weight'|'count'|'unknown',
 *     system?: 'metric'|'imperial', isToTaste?: true, note?: string }
 */

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function validMultiplier(m) {
  const n = typeof m === 'string' ? Number(m) : m;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * scaleQuantity(amount, multiplier)
 *   number            -> number
 *   string            -> parsed amount (see parseAmount) with value/min/max scaled
 *   parsed amount     -> parsed amount scaled
 *   part {value,unit} -> part scaled
 *   array of parts    -> array scaled
 * Invalid multipliers (NaN, <= 0, non-numeric) are treated as 1. null values stay null.
 */
export function scaleQuantity(amount, multiplier) {
  const m = validMultiplier(multiplier);
  if (Array.isArray(amount)) return amount.map((a) => scaleQuantity(a, m));
  if (typeof amount === 'number') {
    return Number.isFinite(amount) ? round6(amount * m) : null;
  }
  if (amount && typeof amount === 'object' && !('raw' in amount && 'isToTaste' in amount)) {
    // a part / {value, unit} object
    const v = typeof amount.value === 'number' ? amount.value : parseAmount(amount.value).value;
    return { ...amount, value: v === null || v === undefined ? null : round6(v * m) };
  }
  const p = parseAmount(amount);
  const out = { ...p, value: p.value === null ? null : round6(p.value * m) };
  if (p.min !== undefined) out.min = round6(p.min * m);
  if (p.max !== undefined) out.max = round6(p.max * m);
  return out;
}

/** Find a unit at the start of free text ("cup flour" -> "cup"). */
function unitFromText(rest) {
  if (!rest) return null;
  const words = rest.split(' ');
  for (const n of [2, 1]) {
    if (words.length >= n) {
      const candidate = words.slice(0, n).join(' ');
      const nu = normalizeUnit(candidate);
      if (nu.category === 'volume' || nu.category === 'weight' || (nu.category === 'count' && nu.unit !== 'each')) {
        return candidate;
      }
    }
  }
  return null;
}

function resolveEntry(entry) {
  if (entry === null || entry === undefined) return null;
  let rawValue;
  let unitText;
  if (typeof entry === 'number' || typeof entry === 'string') {
    rawValue = entry;
    unitText = '';
  } else {
    rawValue = entry.value !== undefined ? entry.value : entry.amount !== undefined ? entry.amount : entry.quantity;
    unitText = entry.unit;
  }
  const p = typeof rawValue === 'number'
    ? parseAmount(rawValue)
    : parseAmount(rawValue === undefined || rawValue === null ? '' : rawValue);
  if ((!unitText || !String(unitText).trim()) && p.rest) {
    unitText = unitFromText(p.rest) || unitText;
  }
  const nu = normalizeUnit(unitText);
  return {
    value: p.value,
    isToTaste: p.isToTaste || (entry && entry.isToTaste === true),
    raw: p.raw,
    note: entry && typeof entry === 'object' ? entry.note : undefined,
    // An already-combined part (e.g. imperial cups+tbsp stored in ml) keeps its system.
    system: entry && typeof entry === 'object' && (entry.system === 'metric' || entry.system === 'imperial')
      ? entry.system : undefined,
    unit: nu.unit,
    category: nu.category,
  };
}

/**
 * combineQuantities(list) -> Array<part>
 *
 * list items: { value|amount|quantity: number|string, unit?: string } (strings are parsed,
 * so "2½", "1-2", "3/4 cup" all work) or bare numbers / strings.
 *
 * Rules:
 *  - volume + volume merge (via ml); weight + weight merge (via g).
 *    If every entry used the same unit the result keeps that unit (2 cup + 1 cup = 3 cup);
 *    otherwise it is expressed in the base unit (ml / g) with `system` recording whether
 *    the inputs were all metric ('metric') or included any imperial unit ('imperial').
 *  - volume and weight are NEVER added together - they become separate parts.
 *  - count / unknown units merge only when the canonical unit is identical.
 *    'each' does NOT merge into other count units ("2 clove + 1 each" stays two parts),
 *    because we cannot know how many cloves "1 garlic" means.
 *  - to-taste / blank entries: if at least one numeric part exists they are absorbed
 *    (the numeric amount already tells you to buy it); otherwise a single
 *    { value: null, isToTaste: true, unit: '', category: 'unknown', note } part is returned.
 *  - non-empty but unparseable amounts ("abc", "1/0") are kept as
 *    { value: null, isToTaste: false, note: raw } parts. NOTHING is ever dropped.
 *  Parts are ordered by first appearance.
 */
export function combineQuantities(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const groups = new Map();
  const unparsed = [];
  let toTaste = null;

  for (const item of list) {
    const e = resolveEntry(item);
    if (!e) continue;
    if (e.value === null) {
      if (e.isToTaste) {
        const note = e.note || (e.raw ? e.raw.trim() : '');
        if (toTaste === null || (!toTaste && note)) toTaste = note;
      } else if (e.raw && !unparsed.includes(e.raw.trim())) {
        unparsed.push(e.raw.trim());
      }
      continue;
    }
    const key = e.category === 'volume' || e.category === 'weight' ? e.category : `${e.category}:${e.unit}`;
    if (!groups.has(key)) groups.set(key, { category: e.category, entries: [] });
    groups.get(key).entries.push(e);
  }

  const parts = [];
  for (const { category, entries } of groups.values()) {
    if (category === 'volume' || category === 'weight') {
      const sameUnit = entries.every((x) => x.unit === entries[0].unit);
      const allMetric = entries.every((x) => (x.system || systemOfUnit(x.unit)) === 'metric');
      const system = allMetric ? 'metric' : 'imperial';
      if (sameUnit) {
        parts.push({
          value: round6(entries.reduce((s, x) => s + x.value, 0)),
          unit: entries[0].unit,
          category,
          system,
        });
      } else {
        const base = entries.reduce((s, x) => s + toBase(x.value, x.unit), 0);
        parts.push({ value: round6(base), unit: category === 'volume' ? 'ml' : 'g', category, system });
      }
    } else {
      parts.push({
        value: round6(entries.reduce((s, x) => s + x.value, 0)),
        unit: entries[0].unit,
        category,
      });
    }
  }

  for (const note of unparsed) {
    parts.push({ value: null, unit: '', category: 'unknown', isToTaste: false, note });
  }

  if (parts.length === 0 && toTaste !== null) {
    const part = { value: null, unit: '', category: 'unknown', isToTaste: true };
    if (toTaste) part.note = toTaste;
    parts.push(part);
  }
  return parts;
}

const IMPERIAL_VOLUME_STEPS = [
  { unit: 'gallon', min: 16 * VOLUME_TO_ML.cup },
  { unit: 'quart', min: 8 * VOLUME_TO_ML.cup },
  { unit: 'cup', min: 0.25 * VOLUME_TO_ML.cup },
  { unit: 'tbsp', min: VOLUME_TO_ML.tbsp, max: 8 },
  { unit: 'tsp', min: 0, max: 6 },
];

function relErr(r, v) {
  return v === 0 ? 0 : Math.abs(r - v) / v;
}

function friendlyImperialVolume(ml) {
  for (let i = 0; i < IMPERIAL_VOLUME_STEPS.length; i += 1) {
    const step = IMPERIAL_VOLUME_STEPS[i];
    if (ml < step.min * (1 - 1e-6)) continue;
    const v = ml / VOLUME_TO_ML[step.unit];
    const r = roundImperial(v);
    const next = IMPERIAL_VOLUME_STEPS[i + 1];
    if (!next || relErr(r, v) <= 0.05) return { value: r, unit: step.unit };
    const nv = ml / VOLUME_TO_ML[next.unit];
    if (next.max !== undefined && nv > next.max) return { value: r, unit: step.unit };
  }
  return { value: roundImperial(ml / VOLUME_TO_ML.tsp), unit: 'tsp' };
}

/**
 * toFriendlyUnit(part) -> part converted to a readable cooking unit and rounded.
 *   volume/imperial: tsp (< 1 tbsp) / tbsp (< 1/4 cup, or when cups round badly) /
 *                    cup / quart (>= 8 cups) / gallon (>= 16 cups)
 *                    e.g. 3 tsp -> 1 tbsp, 16 tbsp -> 1 cup, 0.5 cup stays 1/2 cup.
 *   volume/metric:   ml (< 1000) else l
 *   weight/imperial: oz (< 16 oz) else lb
 *   weight/metric:   g (< 1000) else kg (mg below 1 g)
 *   count/unknown:   same unit, value rounded to nearest 1/8 / 1/3
 * `system` comes from part.system, or is inferred from part.unit. Returns a NEW object;
 * null-valued parts are returned unchanged.
 */
export function toFriendlyUnit(part) {
  if (!part || part.value === null || part.value === undefined || !Number.isFinite(part.value)) return part;
  const { category } = part;
  const system = part.system || systemOfUnit(part.unit);

  if (category === 'volume' && VOLUME_TO_ML[part.unit] !== undefined) {
    const ml = toBase(part.value, part.unit);
    if (system === 'metric') {
      if (ml >= 1000) return { ...part, value: Math.round((ml / 1000) * 100) / 100, unit: 'l', system };
      return { ...part, value: roundMetric(ml), unit: 'ml', system };
    }
    return { ...part, ...friendlyImperialVolume(ml), system };
  }

  if (category === 'weight' && WEIGHT_TO_G[part.unit] !== undefined) {
    const g = toBase(part.value, part.unit);
    if (system === 'metric') {
      if (g >= 1000) return { ...part, value: Math.round((g / 1000) * 100) / 100, unit: 'kg', system };
      if (g < 1) return { ...part, value: roundMetric(g * 1000), unit: 'mg', system };
      return { ...part, value: roundMetric(g), unit: 'g', system };
    }
    const oz = g / WEIGHT_TO_G.oz;
    if (oz < 16) return { ...part, value: roundImperial(oz), unit: 'oz', system };
    return { ...part, value: roundImperial(g / WEIGHT_TO_G.lb), unit: 'lb', system };
  }

  return { ...part, value: roundImperial(part.value) };
}

/**
 * convertQuantity(part, toUnit) -> number | null
 * Converts within volume or weight (any alias accepted for toUnit). null when the
 * categories differ or the unit is a count/unknown unit (unless identical units).
 */
export function convertQuantity(part, toUnit) {
  if (!part || part.value === null || part.value === undefined) return null;
  const from = normalizeUnit(part.unit);
  const to = normalizeUnit(toUnit);
  if (from.unit === to.unit) return part.value;
  if (from.category !== to.category) return null;
  if (from.category !== 'volume' && from.category !== 'weight') return null;
  return round6(fromBase(toBase(part.value, from.unit), to.unit));
}

/**
 * subtractQuantities(need, have) -> { remaining: Array<part>, covered: boolean }
 * need / have: anything combineQuantities accepts (raw entries or parts).
 *   - have empty/missing           -> nothing subtracted, covered false
 *   - have contains an unquantified entry (value null, e.g. pantry item with no amount)
 *                                  -> assume enough on hand: remaining [], covered true
 *   - otherwise each need part is reduced by have parts of the same category
 *     (volume/weight, converted) or same canonical count/unknown unit.
 *     Fully covered parts are removed. Need parts with value null are covered by any have.
 * Remaining parts keep the need part's unit (base-unit parts keep system).
 */
export function subtractQuantities(need, have) {
  const needParts = combineQuantities(need || []);
  if (!have || (Array.isArray(have) && have.length === 0)) {
    return { remaining: needParts, covered: needParts.length === 0 };
  }
  const haveParts = combineQuantities(Array.isArray(have) ? have : [have]);
  if (haveParts.length === 0 || haveParts.some((p) => p.value === null)) {
    return { remaining: [], covered: true };
  }

  const pool = new Map();
  for (const h of haveParts) {
    const key = h.category === 'volume' || h.category === 'weight' ? h.category : `${h.category}:${h.unit}`;
    const amount = h.category === 'volume' || h.category === 'weight' ? toBase(h.value, h.unit) : h.value;
    pool.set(key, (pool.get(key) || 0) + amount);
  }

  const remaining = [];
  for (const n of needParts) {
    if (n.value === null) continue; // to-taste: having any of it is enough
    const convertible = n.category === 'volume' || n.category === 'weight';
    const key = convertible ? n.category : `${n.category}:${n.unit}`;
    const needAmount = convertible ? toBase(n.value, n.unit) : n.value;
    const available = pool.get(key) || 0;
    const used = Math.min(available, needAmount);
    pool.set(key, available - used);
    const left = needAmount - used;
    if (left > needAmount * 1e-6 && left > 1e-6) {
      remaining.push({ ...n, value: round6(convertible ? fromBase(left, n.unit) : left) });
    }
  }
  return { remaining, covered: remaining.length === 0 };
}

/**
 * formatQuantity(parts, { friendly = true } = {}) -> string
 *   [{value:1.5,unit:'cup',category:'volume'}, {value:100,unit:'g',category:'weight'}]
 *     -> "1 1/2 cups + 100 g"
 * Accepts a single part too. Each part is passed through toFriendlyUnit unless
 * friendly:false. to-taste parts render as their note or "to taste".
 */
export function formatQuantity(parts, options = {}) {
  const { friendly = true } = options;
  if (!parts) return '';
  const list = Array.isArray(parts) ? parts : [parts];
  return list
    .map((p) => formatPart(friendly ? toFriendlyUnit(p) : p))
    .filter(Boolean)
    .join(' + ');
}

/** combineAndFormat(list) -> { parts: friendly parts, display: string } convenience. */
export function combineAndFormat(list) {
  const parts = combineQuantities(list).map(toFriendlyUnit);
  return { parts, display: formatQuantity(parts, { friendly: false }) };
}
