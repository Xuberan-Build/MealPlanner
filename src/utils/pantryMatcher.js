/**
 * pantryMatcher - pure helpers that compare a shopping list against the user's pantry
 * ("what we have") and decide, per item, whether we still need to buy it.
 *
 *   annotateWithPantry(shoppingItems, pantryItems) -> items + {
 *     pantryStatus: 'have' | 'partial' | 'need',
 *     pantryMatch: pantryItem | null,
 *     remainingQuantity: Array<part> | null,      (partial only)
 *     remainingQuantityText: string | null,       (partial only, e.g. "1 cup")
 *     needsCheck: boolean                          (matched, but units can't be compared)
 *   }
 *
 * Partial/needsCheck: when some needed amount can't be compared with the pantry amount
 * (cups vs grams, cloves vs heads) the item stays on the to-buy side as 'partial' with
 * needsCheck, and remainingQuantity keeps every part we could not subtract.
 *
 * Bought-for-a-list stock: pantry docs created or refilled by ticking items off a shopping
 * list carry fromPurchase + purchasedForListId. That stock is assumed to be used by the
 * meals of the list it was bought for, so on any OTHER list it does not count as "have"
 * (the user can confirm leftovers on the Pantry page, which clears the flag).
 *
 * Several list lines that match the same pantry doc ("olive oil" and "extra virgin olive
 * oil") share its stock: annotateWithPantry subtracts each line's use before the next.
 *
 * Matching is deliberately conservative: an exact normalized key match, or a "same head
 * noun + only harmless qualifier words differ" match ("extra virgin olive oil" ~ "olive oil",
 * "kosher salt" ~ "salt"). Words that change what the product IS ("garlic powder" vs
 * "garlic", "peanut butter" vs "butter", "coconut milk" vs "milk") never match.
 */
import {
  normalizeIngredientName,
  combineQuantities,
  subtractQuantities,
  normalizeUnit,
  formatQuantity,
  parseAmount,
  convertQuantity,
} from './quantity';
import { resolveIngredientKey } from './ingredientAliases';
import { getAisle } from './ingredientCategories';

/**
 * Qualifier words that describe a grade / form of the same product, not a different one.
 * A fuzzy match is allowed only when every differing word is in this set, the head noun
 * (last word) is identical and both names land in the same grocery aisle.
 */
export const HARMLESS_QUALIFIERS = new Set([
  'extra', 'virgin', 'pure', 'light', 'kosher', 'sea', 'table', 'fine', 'coarse', 'flaky',
  'iodized', 'unsalted', 'salted', 'organic', 'fresh', 'all', 'purpose', 'granulated',
  'ground', 'dried', 'raw', 'plain', 'regular', 'whole', 'boneless', 'skinless', 'low',
  'reduced', 'sodium', 'natural', 'cold', 'pressed', 'refined', 'unrefined', 'pitted',
  'large', 'medium', 'small', 'jumbo', 'free', 'range', 'cage', 'of',
]);

/**
 * Qualifiers that are harmless for most aisles but change the product for meat & seafood:
 * "ground beef" is not a steak, a "whole chicken" is not chicken breast.
 */
const MEAT_SENSITIVE_QUALIFIERS = new Set(['ground', 'whole', 'minced']);

/**
 * Pantry coverage applied after the shared same-product aliases (both sides): broader than
 * "same product" on purpose, e.g. a pantry "flour" covers "all purpose flour".
 */
const SYNONYMS = {
  pepper: 'black pepper',
  'black peppercorn': 'black pepper',
  'white sugar': 'sugar',
  'granulated sugar': 'sugar',
  'caster sugar': 'sugar',
  'ap flour': 'flour',
  'plain flour': 'flour',
  'all purpose flour': 'flour',
  'evoo': 'olive oil',
  'bicarbonate of soda': 'baking soda',
  'bicarb soda': 'baking soda',
  'scallion': 'green onion',
  'spring onion': 'green onion',
};

function nameOf(item) {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  return item.name || item.ingredientName || item.item || item.ingredientId || item.key || item.id || '';
}

/** Normalized pantry/shopping key, with synonyms applied. */
export function pantryKey(nameOrItem) {
  const raw = typeof nameOrItem === 'string' ? nameOrItem : nameOf(nameOrItem);
  const key = resolveIngredientKey(normalizeIngredientName(raw));
  return SYNONYMS[key] || key;
}

function safeAisle(name) {
  try {
    return getAisle(name).aisleId;
  } catch (e) {
    return null;
  }
}

/**
 * Compare two names. Returns null (no match) or a score (0 = exact, higher = looser).
 */
export function matchScore(shoppingName, pantryName) {
  const a = pantryKey(shoppingName);
  const b = pantryKey(pantryName);
  if (!a || !b) return null;
  if (a === b) return 0;

  const aw = a.split(' ');
  const bw = b.split(' ');
  // Head noun (last word) must be the same product word.
  if (aw[aw.length - 1] !== bw[bw.length - 1]) return null;

  const aSet = new Set(aw);
  const bSet = new Set(bw);
  const onlyA = aw.filter((w) => !bSet.has(w));
  const onlyB = bw.filter((w) => !aSet.has(w));
  // One side must be a subset of the other (no swapping one qualifier for another word).
  if (onlyA.length && onlyB.length) return null;
  const diff = onlyA.length ? onlyA : onlyB;
  if (!diff.length) return 0; // same words, different order / duplicates
  if (!diff.every((w) => HARMLESS_QUALIFIERS.has(w))) return null;

  // Final guard: a qualifier must not move the item to another aisle
  // ("ground ginger" is a spice, "ginger" is produce).
  const aisleA = safeAisle(a);
  const aisleB = safeAisle(b);
  if (aisleA && aisleB && aisleA !== aisleB) return null;
  if ((aisleA === 'meat-seafood' || aisleB === 'meat-seafood') && diff.some((w) => MEAT_SENSITIVE_QUALIFIERS.has(w))) {
    return null;
  }
  return diff.length;
}

/** true when the shopping name and pantry name refer to the same product. */
export function isPantryMatch(shoppingName, pantryName) {
  return matchScore(shoppingName, pantryName) !== null;
}

/** Best pantry item for one shopping item (exact key first, then fewest differing words). */
export function findPantryMatch(item, pantryItems) {
  if (!Array.isArray(pantryItems) || pantryItems.length === 0) return null;
  const name = nameOf(item);
  if (!name) return null;
  let best = null;
  let bestScore = Infinity;
  for (const p of pantryItems) {
    if (!p) continue;
    const s = matchScore(name, p.name || p.key);
    if (s === null) continue;
    if (s < bestScore) {
      best = p;
      bestScore = s;
      if (s === 0) break;
    }
  }
  return best;
}

function hasNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** The shopping item's quantity as engine parts. */
export function needParts(item) {
  if (!item || typeof item !== 'object') return [];
  if (Array.isArray(item.parts) && item.parts.length) return combineQuantities(item.parts);
  const amount = item.quantity !== undefined ? item.quantity
    : item.amount !== undefined ? item.amount
      : item.adjustedAmount;
  if (item.isToTaste === true) return [{ value: null, unit: '', category: 'unknown', isToTaste: true }];
  return combineQuantities([{ value: amount === undefined ? '' : amount, unit: item.unit || '' }]);
}

function pantryHasQuantity(p) {
  if (!p) return false;
  const q = p.quantity;
  if (hasNumber(q)) return true;
  if (typeof q === 'string' && q.trim()) return parseAmount(q).value !== null;
  return false;
}

function pantryQuantityValue(p) {
  return hasNumber(p.quantity) ? p.quantity : parseAmount(p.quantity).value;
}

function compatible(part, haveUnit) {
  if (!part || part.value === null) return false;
  if (part.category === 'volume' || part.category === 'weight') return part.category === haveUnit.category;
  return part.category === haveUnit.category && part.unit === haveUnit.unit;
}

/** true when this pantry stock was bought for a different shopping list (assumed used up). */
export function isStockForOtherList(match, listId) {
  if (!match || match.fromPurchase !== true || match.isStaple === true) return false;
  const boughtFor = match.purchasedForListId || null;
  // Bought for a list we can't identify: be safe and don't count it as "have".
  if (!boughtFor || !listId) return true;
  return String(boughtFor) !== String(listId);
}

/**
 * Status for a single shopping item against an (already found) pantry match.
 * opts.available: pantry amount still free (in the match's unit) after earlier list lines
 *                 used some of it; defaults to the match's quantity.
 * opts.listId:    the list being annotated (for bought-for-a-list stock, see header).
 * Returns { pantryStatus, remainingQuantity, remainingQuantityText, needsCheck, used }
 *   used: how much of the pantry amount this item takes (match unit), 0 when not tracked.
 */
export function evaluatePantryItem(item, match, opts = {}) {
  const base = { pantryStatus: 'need', remainingQuantity: null, remainingQuantityText: null, needsCheck: false, used: 0 };
  if (!match) return base;

  // Staples are "always have" unless the user explicitly marked them as run out (quantity 0).
  if (match.isStaple === true) return match.quantity === 0 ? base : { ...base, pantryStatus: 'have' };
  if (isStockForOtherList(match, opts.listId)) return base;
  if (!pantryHasQuantity(match)) {
    // Ran out (explicit 0 or negative) => need it; otherwise "we have some".
    if (match.quantity === 0) return base;
    return { ...base, pantryStatus: 'have' };
  }

  const fullValue = pantryQuantityValue(match);
  const haveValue = hasNumber(opts.available) ? Math.min(opts.available, fullValue) : fullValue;
  if (haveValue <= 1e-9) return base;

  const need = needParts(item);
  const numeric = need.filter((p) => p.value !== null);
  if (numeric.length === 0) return { ...base, pantryStatus: 'have' }; // to taste / unquantified

  const haveUnit = normalizeUnit(match.unit || '');
  const comparable = numeric.filter((p) => compatible(p, haveUnit));
  const incomparable = numeric.filter((p) => !compatible(p, haveUnit));

  const partial = (remaining, used) => ({
    pantryStatus: 'partial',
    remainingQuantity: remaining,
    remainingQuantityText: formatQuantity(remaining),
    needsCheck: incomparable.length > 0,
    used,
  });

  if (comparable.length === 0) {
    // We have some, but can't tell how much of what's needed it covers: keep it to buy.
    return partial(incomparable, 0);
  }

  const needInHaveUnit = comparable.reduce((sum, p) => sum + (convertQuantity(p, haveUnit.unit) || 0), 0);
  const used = Math.min(haveValue, needInHaveUnit);
  const { remaining, covered } = subtractQuantities(comparable, [{ value: haveValue, unit: haveUnit.unit }]);
  if (covered && incomparable.length === 0) {
    return { ...base, pantryStatus: 'have', used };
  }
  // Keep the need's original part order ("4 cloves + 1 head", not "1 head + 4 cloves").
  const order = (p) => {
    const i = numeric.findIndex((n) => n.unit === p.unit && n.category === p.category);
    return i === -1 ? numeric.length : i;
  };
  const left = (covered ? [] : remaining).concat(incomparable).sort((x, y) => order(x) - order(y));
  return partial(left, used);
}

/**
 * annotateWithPantry(shoppingItems, pantryItems, opts?) -> new array (inputs untouched).
 * Each item gains pantryStatus, pantryMatch, remainingQuantity, remainingQuantityText, needsCheck.
 * opts.listId: id of the list being annotated (see bought-for-a-list stock above).
 */
export function annotateWithPantry(shoppingItems, pantryItems, opts = {}) {
  if (!Array.isArray(shoppingItems)) return [];
  const pantry = Array.isArray(pantryItems) ? pantryItems.filter(Boolean) : [];
  const available = new Map(); // pantry doc -> amount not yet used by an earlier line
  return shoppingItems.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const match = findPantryMatch(item, pantry);
    const poolKey = match ? (match.id || match) : null;
    const evaluation = evaluatePantryItem(item, match, {
      listId: opts.listId,
      available: poolKey !== null && available.has(poolKey) ? available.get(poolKey) : undefined,
    });
    if (poolKey !== null && evaluation.used > 0 && pantryHasQuantity(match)) {
      const start = available.has(poolKey) ? available.get(poolKey) : pantryQuantityValue(match);
      available.set(poolKey, Math.max(0, start - evaluation.used));
    }
    const { used, ...fields } = evaluation;
    return { ...item, ...fields, pantryMatch: match || null };
  });
}

/** Counts by status: { have, partial, need, total }. */
export function summarizePantryStatus(annotated) {
  const out = { have: 0, partial: 0, need: 0, total: 0 };
  (annotated || []).forEach((i) => {
    if (!i || !i.pantryStatus) return;
    out[i.pantryStatus] += 1;
    out.total += 1;
  });
  return out;
}
