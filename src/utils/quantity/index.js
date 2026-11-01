/**
 * Single source of truth for recipe quantity math.
 *
 *   parseAmount(value)              -> { value, min?, max?, isToTaste, raw, rest }
 *   normalizeUnit(unit)             -> { unit, category }
 *   normalizeIngredientName(name)   -> grouping key
 *   displayIngredientName(name)     -> Title Case label of the grouping key
 *   parseServings(value)            -> positive number | null (ranges -> lower bound)
 *   servingScale(target, base)      -> { multiplier, target, base, reliable }
 *   computeServingMultiplier(t, b)  -> number (1 when unknown)
 *   scaleQuantity(amount, m)        -> same shape as input, scaled
 *   combineQuantities(list)         -> Array<part>
 *   toFriendlyUnit(part)            -> part in a readable cooking unit
 *   convertQuantity(part, toUnit)   -> number | null
 *   subtractQuantities(need, have)  -> { remaining: Array<part>, covered }
 *   formatAmount(value, system)     -> "1 1/2"
 *   formatQuantity(parts, opts)     -> "1 1/2 cups + 100 g"
 *   combineAndFormat(list)          -> { parts, display }
 *   parseIngredientLine(line)       -> { amount, unit, category, name, key, amounts, sizeNote }
 *   liftCountUnitFromName(name)     -> 'clove' for "garlic cloves", else null
 */
import { parseAmount } from './parseAmount';
import { normalizeUnit } from './units';
import { normalizeIngredientName } from './names';

export { parseAmount, UNICODE_FRACTIONS } from './parseAmount';
export {
  normalizeUnit,
  isKnownUnit,
  unitLabel,
  toBase,
  fromBase,
  systemOfUnit,
  categoryOfCanonical,
  VOLUME_TO_ML,
  WEIGHT_TO_G,
  METRIC_UNITS,
  COUNT_UNITS,
  UNIT_LABELS,
} from './units';
export { normalizeIngredientName, displayIngredientName, singularize } from './names';
export { parseServings, servingScale, computeServingMultiplier } from './servings';
export {
  scaleQuantity,
  combineQuantities,
  toFriendlyUnit,
  convertQuantity,
  subtractQuantities,
  formatQuantity,
  combineAndFormat,
} from './combine';
export { formatAmount, formatPart, roundImperial, roundMetric } from './format';

// Size words are quantity qualifiers, not purchasable units, when parsing free text.
const SIZE_WORDS = new Set(['large', 'medium', 'small', 'lg', 'med', 'sm', 'whole', 'extra large', 'xl']);

// Count units you buy a product in ("2 x 400g cans", "1 (14 oz) can").
const CONTAINER_UNITS = new Set(['can', 'jar', 'package', 'bag', 'box', 'bottle', 'container']);

const isMeasure = (text) => {
  const c = normalizeUnit(text).category;
  return c === 'volume' || c === 'weight';
};
const isContainer = (text) => CONTAINER_UNITS.has(normalizeUnit(text).unit) && normalizeUnit(text).category === 'count';

/**
 * liftCountUnitFromName("garlic cloves, minced") -> 'clove'
 * A count unit hidden in an ingredient name that the grouping key drops ("garlic cloves"
 * is keyed "garlic"), so "3 garlic cloves" means 3 cloves, not 3 garlics. null otherwise.
 */
export function liftCountUnitFromName(name) {
  if (!name) return null;
  const key = normalizeIngredientName(name);
  const keyWords = new Set(key.split(' '));
  const words = String(name).toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[,;]/)[0]
    .split(/[^a-z]+/).filter(Boolean);
  for (const w of words) {
    const nu = normalizeUnit(w);
    if (nu.category !== 'count' || nu.unit === 'each' || CONTAINER_UNITS.has(nu.unit)) continue;
    if (keyWords.has(w) || keyWords.has(nu.unit)) continue;
    return nu.unit;
  }
  return null;
}

/** Drop "(14 oz)", "x", and "400g" / "15-ounce" size tokens in front of a container word. */
function stripSizeTokens(rest) {
  let r = rest;
  let note = '';
  let changed = true;
  while (changed) {
    changed = false;
    const paren = r.match(/^\(([^)]*)\)\s*/);
    if (paren) {
      note = note || paren[1].trim();
      r = r.slice(paren[0].length);
      changed = true;
    }
    if (/^x\s+/.test(r)) {
      r = r.replace(/^x\s+/, '');
      changed = true;
    }
    const size = r.match(/^(\d+(?:\.\d+)?)\s*-?\s*((?:fl\s+)?[a-z]+)\.?\s+(?=(\S+))/);
    if (size && isMeasure(size[2]) && isContainer(size[3])) {
      note = note || `${size[1]} ${normalizeUnit(size[2]).unit}`;
      r = r.slice(size[0].length);
      changed = true;
    }
  }
  return { rest: r, note };
}

function parseSingleLine(line) {
  let amount = parseAmount(line === null || line === undefined ? '' : String(line));
  let rest = amount.rest || '';
  if (amount.value === null && !amount.isToTaste) rest = String(line || '').trim().toLowerCase();
  if (amount.isToTaste) {
    rest = rest.replace(/^(a\s+)?(pinch|dash|handful|splash|drizzle|few|little|some)\s+(of\s+)?/, '');
  }
  let sizeNote = '';
  if (amount.value !== null) {
    // "400g can chickpeas": the amount is the size of ONE container.
    const words0 = rest.split(' ');
    if (words0.length > 1 && isMeasure(words0[0]) && isContainer(words0[1])) {
      sizeNote = `${amount.value} ${normalizeUnit(words0[0]).unit}`;
      amount = { value: 1, isToTaste: false, raw: '1', rest: words0.slice(1).join(' ') };
      rest = amount.rest;
    }
    const stripped = stripSizeTokens(rest);
    rest = stripped.rest;
    sizeNote = sizeNote || stripped.note;
  }
  let unit = 'each';
  let category = 'count';
  const words = rest.split(' ').filter(Boolean);
  for (const n of [2, 1]) {
    if (words.length > n - 1) {
      let candidate = words.slice(0, n).join(' ');
      // rest is lowercased; recover a lone uppercase "T" (tablespoon) from the original
      if (candidate === 't' && /(^|[\s\d\u00BC-\u00BE\u2150-\u215E])T(\.|\s|$)/.test(String(line))) candidate = 'T';
      const nu = normalizeUnit(candidate);
      if (nu.category !== 'unknown' && !SIZE_WORDS.has(candidate.toLowerCase().replace(/\./g, ''))) {
        unit = nu.unit;
        category = nu.category;
        rest = words.slice(n).join(' ');
        break;
      }
    }
  }
  rest = rest.replace(/^of\s+/, '').trim();
  // Original casing for the name portion when possible
  const original = String(line || '');
  const idx = original.toLowerCase().lastIndexOf(rest);
  const name = rest && idx >= 0 ? original.slice(idx, idx + rest.length).trim() : rest;
  if (unit === 'each' && amount.value !== null) {
    const lifted = liftCountUnitFromName(name);
    if (lifted) {
      unit = lifted;
      category = 'count';
    }
  }
  return { amount, unit, category, name, sizeNote };
}

const COMPOUND_SPLIT_RE = /\s+(?:\+|plus)\s+(?=[\d\u00BC-\u00BE\u2150-\u215E])/i;

/**
 * parseIngredientLine("2 1/2 cups flour, sifted")
 *   -> { amount: <parseAmount result>, unit: 'cup', category: 'volume',
 *        name: 'flour, sifted', key: 'flour', amounts: [{ amount, unit, category }], sizeNote: '' }
 * Lines without a unit ("3 eggs") get unit 'each'. "1 large onion" -> unit 'each',
 * name 'large onion', key 'onion'. "4 garlic cloves" -> unit 'clove', key 'garlic'.
 * "1 cup + 2 tbsp milk" -> amounts [1 cup, 2 tbsp], name 'milk'.
 * "1 (14 oz) can tomatoes", "2 x 400g cans chickpeas", "2 15-ounce cans beans"
 *   -> counted in cans, the size kept in sizeNote.
 */
export function parseIngredientLine(line) {
  const text = line === null || line === undefined ? '' : String(line);
  const pieces = text.split(COMPOUND_SPLIT_RE);
  if (pieces.length > 1) {
    const parsed = pieces.map(parseSingleLine);
    if (parsed.every((p) => p.amount.value !== null)) {
      const named = parsed.slice().reverse().find((p) => p.name) || parsed[parsed.length - 1];
      const first = parsed[0];
      return {
        amount: first.amount,
        unit: first.unit,
        category: first.category,
        name: named.name,
        key: normalizeIngredientName(named.name),
        amounts: parsed.map((p) => ({ amount: p.amount, unit: p.unit, category: p.category })),
        sizeNote: parsed.map((p) => p.sizeNote).find(Boolean) || '',
      };
    }
  }
  const single = parseSingleLine(text);
  return {
    ...single,
    key: normalizeIngredientName(single.name),
    amounts: [{ amount: single.amount, unit: single.unit, category: single.category }],
  };
}
