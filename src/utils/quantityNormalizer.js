/**
 * Back-compat wrappers. New code should import from './quantity' instead:
 *   import { parseAmount, combineQuantities, formatQuantity, ... } from '../utils/quantity';
 *
 * These keep the OLD signatures/return shapes so existing callers keep working,
 * but all math is delegated to the new module (no dropped units, no volume+weight sums).
 */
import {
  parseAmount,
  normalizeUnit,
  combineQuantities as combineParts,
  toFriendlyUnit,
  formatQuantity as formatParts,
  formatPart,
  toBase,
} from './quantity';

/**
 * parseFraction(value) -> number. Handles "2 1/2", "2½", "½", "1-2" (-> 2), "3/4 cup",
 * "one". Returns 0 for blank / to-taste / unparseable input (old behaviour), never NaN.
 */
export function parseFraction(value) {
  const p = parseAmount(value);
  return p.value === null ? 0 : p.value;
}

/**
 * Legacy conversion table (factor to ml / g). Kept for callers that read it directly.
 */
export const UNIT_CONVERSIONS = {
  volume: {
    ml: 1,
    l: 1000,
    cup: 236.588,
    tbsp: 14.7868,
    tsp: 4.92892,
    floz: 29.5735,
    pint: 473.176,
    quart: 946.353,
    gallon: 3785.41,
  },
  weight: {
    g: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
  },
  units: {
    piece: 1,
    whole: 1,
    slice: 1,
    can: 1,
    package: 1,
  },
};

function legacyCategory(category) {
  if (category === 'volume' || category === 'weight') return category;
  if (category === 'count') return 'units';
  return null;
}

/**
 * getUnitCategory(unit) -> 'volume' | 'weight' | 'units' | null
 * Now alias-aware ("cups", "tablespoon", "lbs", "T") and null-safe.
 */
export function getUnitCategory(unit) {
  if (unit === null || unit === undefined || String(unit).trim() === '') return null;
  return legacyCategory(normalizeUnit(unit).category);
}

/**
 * normalizeQuantity(amount, fromUnit) -> { amount, unit, category }
 * volume -> ml, weight -> g, other units unchanged (category 'units' or null).
 */
export function normalizeQuantity(amount, fromUnit) {
  const value = parseFraction(amount);
  if (!value || !fromUnit) {
    return { amount: value || 0, unit: fromUnit || '', category: null };
  }
  const nu = normalizeUnit(fromUnit);
  const category = legacyCategory(nu.category);
  if (category === 'volume' || category === 'weight') {
    return { amount: toBase(value, nu.unit), unit: category === 'volume' ? 'ml' : 'g', category };
  }
  return { amount: value, unit: category ? nu.unit : String(fromUnit).toLowerCase(), category };
}

/**
 * combineQuantities([{ amount, unit }]) -> { amount, unit, parts, display }
 * amount/unit describe the FIRST combined part in a friendly cooking unit; `parts`
 * holds every part (volume and weight are never summed together) and `display` is the
 * full human string, e.g. "1 1/2 cups + 100 g". Nothing is dropped.
 */
export function combineQuantities(quantities) {
  if (!quantities || quantities.length === 0) {
    return { amount: 0, unit: '', parts: [], display: '' };
  }
  const parts = combineParts(quantities).map(toFriendlyUnit);
  const first = parts[0];
  const display = formatParts(parts, { friendly: false });
  if (!first) return { amount: 0, unit: '', parts, display };
  return {
    amount: first.value === null ? 0 : first.value,
    unit: first.unit === 'each' ? '' : first.unit,
    parts,
    display,
  };
}

/**
 * formatQuantity(amount, unit) -> string   (legacy signature)
 * formatQuantity(parts[])      -> string   (new signature, delegated)
 * Fixed: formatQuantity(10, 'cup') is "10 cup" (used to be "1 cup").
 */
export function formatQuantity(amount, unit) {
  if (Array.isArray(amount)) return formatParts(amount);
  if (amount && typeof amount === 'object') return formatPart(toFriendlyUnit(amount));
  const n = typeof amount === 'number' ? amount : parseFraction(amount);
  if (!n || !Number.isFinite(n)) return '';
  const formatted = String(Number(n.toFixed(2)));
  return unit ? `${formatted} ${unit}` : formatted;
}
