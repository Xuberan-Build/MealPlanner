/**
 * Ingredient name normalization -> stable grouping key.
 *
 * normalizeIngredientName("Garlic Cloves, minced") === "garlic"
 * normalizeIngredientName("Tomatoes (diced)")      === "tomato"
 * displayIngredientName("cherry tomatoes, halved") === "Cherry Tomato"
 */

const PREP_WORDS = new Set([
  'chopped', 'minced', 'diced', 'sliced', 'fresh', 'freshly', 'large', 'medium', 'small',
  'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'grated', 'shredded', 'peeled',
  'crushed', 'cubed', 'halved', 'quartered', 'julienned', 'softened', 'melted', 'packed',
  'lightly', 'firmly', 'trimmed', 'rinsed', 'drained', 'divided', 'zested', 'juiced',
  'deseeded', 'seeded', 'pitted', 'torn', 'mashed', 'beaten', 'sifted', 'heaping',
  'and', 'or',
]);

const TRAILING_PHRASES = [
  'to taste', 'for garnish', 'for serving', 'to serve', 'as needed', 'optional',
  'or more', 'plus more', 'or to taste', 'if desired', 'for frying', 'for greasing',
  'more or less', 'bone in', 'skin on',
];

// Words that describe a cut or product but never name it. A comma-separated segment made
// only of these ("boneless, skinless chicken thighs") is joined to the next segment
// instead of being taken as the whole name.
const DESCRIPTOR_WORDS = new Set([
  ...PREP_WORDS,
  'boneless', 'skinless', 'bone', 'in', 'skin', 'on', 'ripe', 'organic', 'raw', 'unsalted',
  'salted', 'low', 'sodium', 'reduced', 'fat', 'lean', 'extra', 'virgin', 'uncooked', 'cooked',
]);

const isOnlyDescriptors = (segment) => {
  const words = segment.split(/[^a-z]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => DESCRIPTOR_WORDS.has(w));
};

/** The part of "a, b, c" that names the ingredient (later parts are usually prep notes). */
function nameSegment(s) {
  const segments = s.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  let head = segments.shift() || '';
  while (segments.length && isOnlyDescriptors(head)) head = `${head} ${segments.shift()}`;
  return head;
}

// Words that end in "s" but are not plurals (never singularize these).
const INVARIANT = new Set([
  'asparagus', 'hummus', 'couscous', 'molasses', 'swiss', 'citrus', 'octopus', 'bass',
  'grass', 'lemongrass', 'hibiscus', 'cactus', 'series', 'species', 'watercress', 'cress',
  'schnapps', 'jus', 'bitters', 'harissa',
]);

const IRREGULAR = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  cookies: 'cookie',
  pies: 'pie',
  brownies: 'brownie',
  veggies: 'veggie',
  smoothies: 'smoothie',
  calories: 'calorie',
  rotinis: 'rotini',
  geese: 'goose',
  mice: 'mouse',
  chilies: 'chili',
  chilis: 'chili',
  chillies: 'chilli',
  chillis: 'chilli',
  chiles: 'chile',
};

export function singularize(word) {
  const w = word;
  if (!w || w.length <= 3) return w;
  if (INVARIANT.has(w)) return w;
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ch|sh|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function basicClean(name) {
  let s = String(name === null || name === undefined ? '' : name).toLowerCase();
  // Strip accents so "jalapeño" groups with "jalapeno" and "crème fraîche" stays readable.
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {
    // String.prototype.normalize unavailable: keep the text as is
  }
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  s = nameSegment(s);
  s = s.replace(/[-_/]/g, ' ');
  // Prep instructions inside the name: "chicken cut up" / "onions cut into large chunks".
  s = s.replace(/\bcut up\b/g, ' ').replace(/\bcut (?:into|in)\b.*$/, ' ');
  s = s.replace(/['’`]/g, '');
  s = s.replace(/[^a-z0-9&\s]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

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

function stripPrepWords(words) {
  let w = words.slice();
  // "extra large eggs" / "extra virgin"? only strip "extra" when it precedes a size word
  while (w.length > 1 && (PREP_WORDS.has(w[0]) || (w[0] === 'extra' && ['large', 'small'].includes(w[1])))) {
    w = w.slice(1);
  }
  while (w.length > 1 && PREP_WORDS.has(w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  return w;
}

const GARLIC_NOISE = new Set(['clove', 'cloves', 'of', 'head', 'heads', 'bulb', 'bulbs']);

/** Cleaned name without singularization (shared by key + display). */
function cleanedWords(name) {
  const base = stripPhrases(basicClean(name));
  if (!base) return [];
  let words = stripPrepWords(base.split(' '));
  if (words[0] === 'of' && words.length > 1) words = words.slice(1);
  if (words.includes('garlic')) {
    const filtered = words.filter((w) => !GARLIC_NOISE.has(w));
    if (filtered.length) words = filtered;
  }
  return words;
}

/**
 * normalizeIngredientName(name) -> string key ('' for empty input).
 * Lowercased, punctuation-free, prep words stripped, last word singularized.
 */
export function normalizeIngredientName(name) {
  const words = cleanedWords(name);
  if (!words.length) return basicClean(name);
  const last = words.length - 1;
  words[last] = singularize(words[last]);
  return words.join(' ');
}

const SMALL_WORDS = new Set(['of', 'and', 'or', 'de', 'with', 'in', 'a', 'the', 'la', 'le', 'du', 'al', 'en']);

/**
 * displayIngredientName(name) -> Title Case version of the grouping key, so that every
 * variant that groups together shows the same label ("garlic cloves" -> "Garlic").
 */
export function displayIngredientName(name) {
  const key = normalizeIngredientName(name);
  if (!key) return '';
  return key
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
