// src/utils/storeUnits/index.js
//
// Turns a shopping-list item's cooking amount ("6 cups broccoli") into what you actually
// buy ("2 heads, ≈ 1 1/4 lb"). The cooking amount stays the source of truth for scaling,
// combining and the pantry; this is only how a row is shown.

import { VOLUME_TO_ML, WEIGHT_TO_G, formatAmount } from '../quantity';
import { findStoreUnit } from './storeUnitTable';

export { STORE_UNITS, findStoreUnit } from './storeUnitTable';

const OZ = WEIGHT_TO_G.oz;
const LB = WEIGHT_TO_G.lb;
const CUP_ML = VOLUME_TO_ML.cup;

// Within this fraction of a whole unit, don't buy one more (2.05 heads -> 2, 2.2 -> 3).
const ROUND_DOWN_TOLERANCE = 0.1;

/** Grams for one quantity part, or null when it can't be converted for this item. */
function partToGrams(part, entry) {
  const { value, unit, category } = part || {};
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (category === 'weight' && WEIGHT_TO_G[unit]) return value * WEIGHT_TO_G[unit];
  if (category === 'volume' && VOLUME_TO_ML[unit] && entry.perUnit.cup) {
    return (value * VOLUME_TO_ML[unit] / CUP_ML) * entry.perUnit.cup;
  }
  const countUnit = !unit || unit === 'each' ? 'each' : unit;
  if (entry.perUnit[countUnit]) return value * entry.perUnit[countUnit];
  // Already in the unit it is sold in ("2 heads garlic").
  if (entry.sell.label && countUnit === entry.sell.label) return value * entry.sell.grams;
  return null;
}

/** Total grams for an item's parts; null if any part is unmeasurable (to taste, unknown unit). */
export function itemGrams(parts, entry) {
  if (!Array.isArray(parts) || parts.length === 0) return null;
  let total = 0;
  for (const part of parts) {
    const grams = partToGrams(part, entry);
    if (grams === null) return null;
    total += grams;
  }
  return total;
}

/** "4 sweet potatoes" for a recipe's "4" needs no "for 4" (but "1 onion" for "1/4" does). */
function isSameCount(parts, entry, n) {
  if (entry.sell.by !== 'count' || entry.perUnit.each !== entry.sell.grams) return false;
  if (!(parts || []).every((p) => !p.unit || p.unit === 'each')) return false;
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return Math.abs(total - n) < 1e-9;
}

/** Whole purchasable units, rounded up (with a little tolerance), never fewer than 1. */
export function wholeUnits(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.max(1, Math.ceil(raw - ROUND_DOWN_TOLERANCE));
}

/** "10 oz" under a pound (whole ounces), else "1 1/4 lb" (quarter pounds). */
export function formatWeight(grams, { roundUp = false } = {}) {
  if (!Number.isFinite(grams) || grams <= 0) return '';
  const step = (n) => (roundUp ? Math.ceil(n - 1e-9) : Math.max(1, Math.round(n)));
  if (grams < LB) return `${step(grams / OZ)} oz`;
  const quarters = step((grams / LB) * 4);
  return `${formatAmount(quarters / 4)} lb`;
}

const plural = (n, label, pluralLabel) => `${n} ${n === 1 ? label : pluralLabel}`;

/**
 * toStoreQuantity({ key, parts, quantityText }) ->
 *   { text, detail, forText } | null
 *
 *   text:    what to buy            "2 heads" / "2 bags" / "1 1/2 lb" / "1 dozen"
 *   detail:  supporting size        "≈ 1 1/4 lb" / "5 oz each" / ''
 *   forText: what it covers         "for 6 cups" ('' when it says the same thing)
 *
 * null when the item isn't in the store table or its amount can't be measured; callers
 * then show the cooking amount, so nothing is ever worse than before.
 */
export function toStoreQuantity(item) {
  const entry = findStoreUnit(item?.key);
  if (!entry) return null;
  const grams = itemGrams(item.parts, entry);
  if (grams === null || grams <= 0) return null;

  const { sell } = entry;
  let text;
  let detail = '';
  if (sell.by === 'weight') {
    text = formatWeight(grams, { roundUp: true });
  } else {
    const n = wholeUnits(grams / sell.grams);
    text = sell.label === 'dozen' ? `${n} dozen` : plural(n, sell.label, sell.plural);
    if (sell.by === 'count') {
      // Weight of what you pick up, for produce priced by the pound at the register.
      detail = sell.weighed ? `≈ ${formatWeight(n * sell.grams)}` : '';
    } else if (sell.size) {
      detail = n === 1 ? sell.size : `${sell.size} each`;
    }
    if (isSameCount(item.parts, entry, n)) return { text, detail, forText: '' };
  }

  const cooking = String(item.quantityText || '').trim();
  const forText = cooking && cooking !== text ? `for ${cooking}` : '';
  return { text, detail, forText };
}
