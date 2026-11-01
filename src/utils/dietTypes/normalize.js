/**
 * Diet type normalization (pure, no imports).
 *
 * Diet types are free-typed, so the same diet shows up as "vegan", "Vegan ", "VEGAN",
 * "Gluten Free", "gluten-free", "GF" ... This module maps every spelling to one canonical
 * display name and a stable comparison key.
 *
 * - canonicalDietType(input)  -> display name ("Gluten-Free"), or null for blank /
 *                                "Not Specified" / "none".
 * - dietTypeKey(input)        -> comparison key ("glutenfree"); '' for blank.
 * - normalizeRecipeDietTypes  -> { dietType, dietTypes } for a recipe, reading both the
 *                                legacy `dietType` string and the `dietTypes` array.
 *
 * Unknown values are never dropped: they are trimmed, Title Cased and get consistent
 * hyphenation ("sugar free" -> "Sugar-Free", "low sodium" -> "Low-Sodium").
 *
 * This file must stay free of imports: scripts/normalizeDietTypes.mjs loads it straight
 * from src/ in Node.
 */

/**
 * Curated diet types. `aliases` are compared in compact form (lowercase, letters and
 * digits only), so "gluten free", "Gluten-Free" and "glutenfree" are all one alias.
 * Spelling mistakes listed here are the common ones seen in real data; anything else
 * is only *suggested* (never auto-corrected) by suggest.js.
 */
const DIET_DEFINITIONS = [
  { name: 'Vegan', aliases: ['vegan', 'vegans', 'vegn', 'veggan'] },
  {
    name: 'Vegetarian',
    // "Veg" / "Veggie" are what people type for vegetarian; "vegan" is always spelled out.
    aliases: ['vegetarian', 'vegetarians', 'veg', 'veggie', 'veggies', 'vegatarian',
      'vegeterian', 'vegitarian', 'vegtarian', 'vegetarain', 'vegeratian', 'vegetarion'],
  },
  { name: 'Pescatarian', aliases: ['pescatarian', 'pescetarian', 'pescitarian', 'pescaterian', 'pescatarain'] },
  { name: 'Keto', aliases: ['keto', 'ketogenic', 'ketofriendly'] },
  { name: 'Paleo', aliases: ['paleo', 'paleolithic'] },
  { name: 'Whole30', aliases: ['whole30', 'wholethirty'] },
  { name: 'Gluten-Free', aliases: ['glutenfree', 'gf', 'nogluten', 'glutenless', 'withoutgluten'] },
  // Lactose-free is deliberately NOT an alias: lactose-free dairy exists, so it stays its
  // own (custom) type "Lactose-Free".
  { name: 'Dairy-Free', aliases: ['dairyfree', 'df', 'nodairy', 'nondairy', 'withoutdairy'] },
  { name: 'Low-Carb', aliases: ['lowcarb', 'lowcarbs', 'lowcarbohydrate', 'lowcarbohydrates'] },
  { name: 'Low-Fat', aliases: ['lowfat'] },
  { name: 'High-Protein', aliases: ['highprotein'] },
  { name: 'Mediterranean', aliases: ['mediterranean', 'meddiet', 'mediteranean', 'mediterranian', 'mediterrenean'] },
  { name: 'Halal', aliases: ['halal'] },
  { name: 'Kosher', aliases: ['kosher'] },
  { name: 'Nut-Free', aliases: ['nutfree', 'nutsfree', 'nonuts', 'nonut'] },
  { name: 'Diabetic-Friendly', aliases: ['diabeticfriendly', 'diabetic', 'diabetesfriendly', 'diabetes'] },
  // The user's meal plans are literally named "FMD".
  { name: 'FMD', aliases: ['fmd', 'fastingmimicking', 'fastingmimickingdiet'] },
];

/**
 * Cuisines people put in the diet field. They are recognised (so casing is right and
 * they dedupe) but are not offered as diet suggestions to everyone.
 */
const CUISINE_DEFINITIONS = [
  { name: 'Italian', aliases: ['italian'] },
  { name: 'Puerto Rican', aliases: ['puertorican'] },
  { name: 'Mexican', aliases: ['mexican'] },
  { name: 'Indonesian', aliases: ['indonesian'] },
  { name: 'Haitian', aliases: ['haitian'] },
];

/** Compact forms that mean "no diet type". */
const BLANK_VALUES = new Set([
  '', 'notspecified', 'none', 'na', 'nan', 'unspecified', 'nodiet', 'null', 'undefined',
  'uncategorized', 'uncategorised',
]);

/** Lowercase joiners kept lowercase inside Title Case ("Arroz con Pollo"). */
const SMALL_WORDS = new Set(['a', 'an', 'and', 'or', 'of', 'with', 'the', 'in', 'on', 'de', 'del', 'la', 'con', 'y']);

/** Canonical diet names, in curated order. */
export const CANONICAL_DIET_TYPES = Object.freeze(DIET_DEFINITIONS.map((d) => d.name));

/** Recognised cuisine names. */
export const KNOWN_CUISINES = Object.freeze(CUISINE_DEFINITIONS.map((d) => d.name));

/** canonical name -> compact aliases (read-only view, for UI hints and tests). */
export const DIET_TYPE_ALIASES = Object.freeze(
  [...DIET_DEFINITIONS, ...CUISINE_DEFINITIONS].reduce((acc, d) => {
    acc[d.name] = Object.freeze([...d.aliases]);
    return acc;
  }, {})
);

const stripMarks = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Compact comparison form: lowercase, accents removed, letters and digits only.
 * Text with no Latin letters/digits (e.g. emoji, CJK) falls back to lowercase without
 * whitespace so it still gets a non-empty key.
 * @param {string} text
 * @returns {string}
 */
export function compactDietText(text) {
  const s = String(text ?? '');
  const compact = stripMarks(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact) return compact;
  return s.toLowerCase().replace(/[\s\-_.,/\\'"`]+/g, '');
}

/**
 * Loose comparison form: lowercase, accents removed, hyphens/underscores as spaces,
 * other punctuation dropped, whitespace collapsed.
 * @param {string} text
 * @returns {string}
 */
export function looseDietText(text) {
  return stripMarks(String(text ?? ''))
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9\s&']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_INDEX = (() => {
  const index = new Map();
  for (const def of [...DIET_DEFINITIONS, ...CUISINE_DEFINITIONS]) {
    index.set(compactDietText(def.name), def.name);
    for (const alias of def.aliases) index.set(alias, def.name);
  }
  return index;
})();

const CANONICAL_KEYS = new Set(DIET_DEFINITIONS.map((d) => compactDietText(d.name)));

function lookupAlias(compact) {
  if (ALIAS_INDEX.has(compact)) return ALIAS_INDEX.get(compact);
  // "Keto Diet", "Mediterranean diet", "Paleo-Diet"
  if (compact.length > 4 && compact.endsWith('diet') && ALIAS_INDEX.has(compact.slice(0, -4))) {
    return ALIAS_INDEX.get(compact.slice(0, -4));
  }
  return null;
}

/** Text value of a diet type that may be a string or a { name } object. */
export function dietTypeText(input) {
  if (typeof input === 'string') return input;
  if (typeof input === 'number') return String(input);
  if (input && typeof input === 'object' && typeof input.name === 'string') return input.name;
  return '';
}

/** Trim, collapse whitespace, tidy hyphens. */
function cleanSpacing(text) {
  return text
    .replace(/[\s _]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[\s-]+|[\s-]+$/g, '');
}

/** Join "x free" -> "x-free", "low x" -> "low-x", "x friendly" -> "x-friendly". */
function joinCompounds(text) {
  const words = text.split(' ');
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();
    if ((lower === 'free' || lower === 'friendly') && out.length > 0) {
      out[out.length - 1] = `${out[out.length - 1]}-${word}`;
    } else if ((lower === 'low' || lower === 'high') && i + 1 < words.length) {
      out.push(`${word}-${words[i + 1]}`);
      i += 1;
    } else {
      out.push(word);
    }
  }
  return out.join(' ');
}

function casePart(part, { isFirst, preserveCaps }) {
  if (!part) return part;
  const letters = part.replace(/[^A-Za-z]/g, '');
  if (!letters) return part; // "30", "&"
  // Acronyms the user typed on purpose: "AIP", "Low FODMAP", "BBQ".
  if (preserveCaps && letters === letters.toUpperCase() && letters.length <= 6) return part;
  // Deliberate inner capitals: "McDonald's", "DeLonghi".
  if (/^[A-Z]/.test(part) && /[A-Z]/.test(part.slice(1)) && /[a-z]/.test(part)) return part;
  const lower = part.toLowerCase();
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCase(text) {
  const words = text.split(' ');
  const hasLower = /[a-z]/.test(text);
  const singleShortCaps = words.length === 1 && text.replace(/[^A-Za-z]/g, '').length <= 3;
  const preserveCaps = hasLower || singleShortCaps;
  return words
    .map((word, wi) => word
      .split('-')
      .map((part, pi) => casePart(part, { isFirst: wi === 0 && pi === 0, preserveCaps }))
      .join('-'))
    .join(' ');
}

/**
 * True when the value means "no diet type" (blank, "Not Specified", "none", "N/A" ...).
 * @param {*} input
 * @returns {boolean}
 */
export function isBlankDietType(input) {
  const cleaned = cleanSpacing(dietTypeText(input));
  return !cleaned || BLANK_VALUES.has(compactDietText(cleaned));
}

/**
 * Canonical display name for a diet type.
 * @param {string|{name: string}} input - Raw value as typed / stored.
 * @returns {string|null} Canonical name, or null for blank / "Not Specified" / "none".
 */
export function canonicalDietType(input) {
  const cleaned = cleanSpacing(dietTypeText(input));
  if (!cleaned) return null;
  const compact = compactDietText(cleaned);
  if (BLANK_VALUES.has(compact)) return null;
  const alias = lookupAlias(compact);
  if (alias) return alias;
  return titleCase(joinCompounds(cleaned));
}

/**
 * Stable comparison key used for dedupe. Aliases share a key ("GF" and "Gluten Free" are
 * both "glutenfree"); spelling variants of a custom type share one too ("Sugar Free",
 * "sugar-free", "Sugarfree" -> "sugarfree").
 * @param {string|{name: string}} input
 * @returns {string} Key, or '' for blank values.
 */
export function dietTypeKey(input) {
  const canonical = canonicalDietType(input);
  return canonical ? compactDietText(canonical) : '';
}

/** True when the value is one of the curated diet types (not a cuisine / custom type). */
export function isCanonicalDietType(input) {
  return CANONICAL_KEYS.has(dietTypeKey(input));
}

/** Compact aliases of a canonical name (curated diets and cuisines), [] otherwise. */
export function getDietTypeAliases(input) {
  const canonical = canonicalDietType(input);
  return (canonical && DIET_TYPE_ALIASES[canonical]) || [];
}

/**
 * Canonicalize and dedupe a list of diet types (strings or { name } objects), keeping
 * first-seen order and dropping blanks.
 * @param {Array} list
 * @returns {string[]}
 */
export function normalizeDietTypeList(list) {
  const items = Array.isArray(list) ? list : list == null ? [] : [list];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const name = canonicalDietType(item);
    if (!name) continue;
    const key = compactDietText(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Canonical diet types for a recipe.
 *
 * Precedence: when the `dietTypes` array has entries it is the source of truth (the
 * recipe form writes only the array, so the legacy string can be stale); the legacy
 * `dietType` is kept as the primary only when it is also in the array. When the array is
 * empty/missing, the legacy `dietType` (string, or an old array value) is used.
 *
 * @param {{dietType?: string|string[], dietTypes?: Array}} recipe
 * @returns {{dietType: string|null, dietTypes: string[]}}
 */
export function normalizeRecipeDietTypes(recipe) {
  const r = recipe || {};
  const fromArray = normalizeDietTypeList(
    Array.isArray(r.dietTypes) ? r.dietTypes : typeof r.dietTypes === 'string' ? [r.dietTypes] : []
  );
  const legacyList = Array.isArray(r.dietType) ? r.dietType : r.dietType == null ? [] : [r.dietType];

  if (fromArray.length === 0) {
    const fromLegacy = normalizeDietTypeList(legacyList);
    return { dietType: fromLegacy[0] || null, dietTypes: fromLegacy };
  }

  const legacyKey = dietTypeKey(legacyList[0]);
  const primary = (legacyKey && fromArray.find((name) => compactDietText(name) === legacyKey)) || fromArray[0];
  return { dietType: primary, dietTypes: fromArray };
}
