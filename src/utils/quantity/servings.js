import { parseAmount } from './parseAmount';

/**
 * parseServings(value) -> positive number | null
 *
 *   4, "4", "4 servings", "serves 4", "Serves: 4 people", "four" -> 4
 *   "4-6", "4 to 6", "serves 4-6"                                -> 4  (LOWER bound)
 *   "", "0", null, "garbage", -2, NaN                             -> null
 *
 * WHY THE LOWER BOUND: a recipe's ingredient amounts are fixed; "serves 4-6" means that
 * fixed batch feeds somewhere between 4 and 6 people. The multiplier we compute is
 * desired / recipeServings, so a SMALLER recipeServings produces a LARGER multiplier.
 * Using the lower bound therefore errs on buying slightly more rather than coming home
 * short of an ingredient, which is the right failure mode for a shopping list.
 *
 * null means "unknown" - callers must not silently treat it as 1 without flagging it.
 */
export function parseServings(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'object') {
    // tolerate { servings } or { value } wrappers
    if ('servings' in value) return parseServings(value.servings);
    if ('value' in value) return parseServings(value.value);
    return null;
  }
  const s = String(value)
    .toLowerCase()
    .replace(/^\s*(serves|serving size|servings?|makes|yields?|feeds|portions?)\b\s*:?\s*/, '')
    .replace(/^(about|approx\.?|approximately|up to)\s+/, '')
    // A leading dash ("-4") is a range whose lower bound was lost on import (e.g. "2-4");
    // read it as the number that survived rather than as negative/unknown.
    .replace(/^[-‐‑‒–—―]+\s*(?=\d)/, '')
    .trim();
  if (!s) return null;
  const parsed = parseAmount(s);
  if (parsed.isToTaste || parsed.value === null) return null;
  const n = parsed.min !== undefined ? parsed.min : parsed.value;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * servingScale(target, base) -> { multiplier, target, base, reliable }
 *   target/base are parsed with parseServings. If either is unknown the multiplier is 1
 *   and reliable is false so the UI can show a warning instead of silently guessing.
 */
export function servingScale(target, base) {
  const t = parseServings(target);
  const b = parseServings(base);
  if (t === null || b === null) {
    return { multiplier: 1, target: t, base: b, reliable: false };
  }
  return { multiplier: t / b, target: t, base: b, reliable: true };
}

/** computeServingMultiplier(target, base) -> number (1 when unknown). */
export function computeServingMultiplier(target, base) {
  return servingScale(target, base).multiplier;
}
