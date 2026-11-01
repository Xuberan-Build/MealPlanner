/**
 * Server-side port of src/utils/quantity/names.js (ingredient name -> grouping key).
 *
 * Cloud Functions cannot import from src/, so this is a faithful copy of the client
 * normalizer. KEEP IN SYNC: functions/test/catalogNames.test.js loads the client module
 * and fails if any sample name produces a different key here.
 *
 * Note: GROUPING_SYNONYMS (src/services/shoppingList/buildShoppingList.js) are NOT applied,
 * because the client's catalog key is defined as normalizeIngredientName(name) only.
 */

const PREP_WORDS = new Set([
  "chopped", "minced", "diced", "sliced", "fresh", "freshly", "large", "medium", "small",
  "finely", "coarsely", "roughly", "thinly", "thickly", "grated", "shredded", "peeled",
  "crushed", "cubed", "halved", "quartered", "julienned", "softened", "melted", "packed",
  "lightly", "firmly", "trimmed", "rinsed", "drained", "divided", "zested", "juiced",
  "deseeded", "seeded", "pitted", "torn", "mashed", "beaten", "sifted", "heaping",
  "squeezed",
  "and", "or",
]);

const TRAILING_PHRASES = [
  "to taste", "for garnish", "for serving", "to serve", "as needed", "optional",
  "or more", "plus more", "or to taste", "if desired", "for frying", "for greasing",
  "more or less", "bone in", "skin on",
];

// Words that describe a cut or product but never name it. A comma-separated segment made
// only of these ("boneless, skinless chicken thighs") is joined to the next segment
// instead of being taken as the whole name.
const DESCRIPTOR_WORDS = new Set([
  ...PREP_WORDS,
  "boneless", "skinless", "bone", "in", "skin", "on", "ripe", "organic", "raw", "unsalted",
  "salted", "low", "sodium", "reduced", "fat", "lean", "extra", "virgin", "uncooked", "cooked",
]);

const isOnlyDescriptors = (segment) => {
  const words = segment.split(/[^a-z]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => DESCRIPTOR_WORDS.has(w));
};

/**
 * The part of "a, b, c" that names the ingredient (later parts are usually prep notes).
 * @param {string} s
 * @return {string}
 */
function nameSegment(s) {
  const segments = s.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  let head = segments.shift() || "";
  while (segments.length && isOnlyDescriptors(head)) head = `${head} ${segments.shift()}`;
  return head;
}

// Words that end in "s" but are not plurals (never singularize these).
const INVARIANT = new Set([
  "asparagus", "hummus", "couscous", "molasses", "swiss", "citrus", "octopus", "bass",
  "grass", "lemongrass", "hibiscus", "cactus", "series", "species", "watercress", "cress",
  "schnapps", "jus", "bitters", "harissa",
]);

const IRREGULAR = {
  leaves: "leaf",
  loaves: "loaf",
  halves: "half",
  knives: "knife",
  cookies: "cookie",
  pies: "pie",
  brownies: "brownie",
  veggies: "veggie",
  smoothies: "smoothie",
  calories: "calorie",
  rotinis: "rotini",
  geese: "goose",
  mice: "mouse",
  chilies: "chili",
  chilis: "chili",
  chillies: "chilli",
  chillis: "chilli",
  chiles: "chile",
};

/**
 * Conservative English singularizer (identical to the client's).
 * @param {string} word - Lowercase word
 * @return {string} Singular form
 */
export function singularize(word) {
  const w = word;
  if (!w || w.length <= 3) return w;
  if (INVARIANT.has(w)) return w;
  if (Object.prototype.hasOwnProperty.call(IRREGULAR, w)) return IRREGULAR[w];
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (/(ch|sh|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/**
 * Lowercase, strip accents/brackets/punctuation, keep only the part before a comma.
 * @param {*} name - Raw ingredient name
 * @return {string} Cleaned string
 */
function basicClean(name) {
  let s = String(name === null || name === undefined ? "" : name).toLowerCase();
  try {
    s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch (e) {
    // String.prototype.normalize unavailable: keep the text as is
  }
  s = s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  s = nameSegment(s);
  s = s.replace(/[-_/]/g, " ");
  // Prep instructions inside the name: "chicken cut up" / "onions cut into large chunks".
  s = s.replace(/\bcut up\b/g, " ").replace(/\bcut (?:into|in)\b.*$/, " ");
  s = s.replace(/['’`]/g, "");
  s = s.replace(/[^a-z0-9&\s]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Remove trailing phrases such as "to taste" (repeatedly).
 * @param {string} s - Cleaned string
 * @return {string} String without trailing phrases
 */
function stripPhrases(s) {
  let out = s;
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of TRAILING_PHRASES) {
      if (out === phrase) continue;
      if (out.endsWith(` ${phrase}`)) {
        out = out.slice(0, -(phrase.length + 1)).trim();
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Strip leading/trailing preparation words, keeping at least one word.
 * @param {string[]} words - Words
 * @return {string[]} Remaining words
 */
function stripPrepWords(words) {
  let w = words.slice();
  while (
    w.length > 1 &&
    (PREP_WORDS.has(w[0]) || (w[0] === "extra" && ["large", "small"].includes(w[1])))
  ) {
    w = w.slice(1);
  }
  while (w.length > 1 && PREP_WORDS.has(w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  return w;
}

const GARLIC_NOISE = new Set(["clove", "cloves", "of", "head", "heads", "bulb", "bulbs"]);

/**
 * Cleaned name split into words, without singularization.
 * @param {*} name - Raw ingredient name
 * @return {string[]} Words
 */
function cleanedWords(name) {
  const base = stripPhrases(basicClean(name));
  if (!base) return [];
  let words = stripPrepWords(base.split(" "));
  if (words[0] === "of" && words.length > 1) words = words.slice(1);
  if (words.includes("garlic")) {
    const filtered = words.filter((w) => !GARLIC_NOISE.has(w));
    if (filtered.length) words = filtered;
  }
  return words;
}

/**
 * normalizeIngredientName(name) -> string key ('' for empty input).
 * Lowercased, punctuation-free, prep words stripped, last word singularized.
 * @param {*} name - Raw ingredient name
 * @return {string} Normalized grouping key with single spaces
 */
export function normalizeIngredientName(name) {
  const words = cleanedWords(name);
  if (!words.length) return basicClean(name);
  const last = words.length - 1;
  words[last] = singularize(words[last]);
  return words.join(" ");
}

/**
 * Catalog document id for an ingredient name: normalized name with spaces -> '-'.
 * "All-Purpose Flour, sifted" -> "all-purpose-flour". Never contains '/'.
 * Must stay identical to the client's
 * `(name) => normalizeIngredientName(name).replace(/\s+/g, '-')`.
 * @param {*} name - Raw ingredient name or an existing catalog key
 * @return {string} Catalog key ('' when the name normalizes to nothing)
 */
export function toCatalogKey(name) {
  return normalizeIngredientName(name).replace(/\s+/g, "-");
}
