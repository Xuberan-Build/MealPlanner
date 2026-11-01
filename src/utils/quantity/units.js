/**
 * Unit tables and unit normalization.
 *
 * Canonical units:
 *   volume: tsp, tbsp, cup, fl oz, pint, quart, gallon, ml, cl, dl, l   (base: ml)
 *   weight: mg, g, kg, oz, lb                                           (base: g)
 *   count:  each, clove, can, package, bunch, head, slice, piece, stick,
 *           sprig, pinch, dash, jar, bottle, bag, box, container, stalk,
 *           leaf, fillet, loaf, sheet, cube, ear, link, handful
 *   unknown: anything else (canonical = cleaned, singularized text)
 *
 * "oz" is treated as WEIGHT; fluid ounces must be written "fl oz" / "fluid ounce".
 */

/** Factor to convert 1 canonical unit into the category base unit (ml or g). */
export const VOLUME_TO_ML = {
  tsp: 14.7868 / 3, // exactly 1/3 tbsp so 3 tsp === 1 tbsp
  tbsp: 14.7868,
  'fl oz': 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
};

export const WEIGHT_TO_G = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

export const METRIC_UNITS = new Set(['ml', 'cl', 'dl', 'l', 'mg', 'g', 'kg']);

export const COUNT_UNITS = new Set([
  'each', 'clove', 'can', 'package', 'bunch', 'head', 'slice', 'piece', 'stick',
  'sprig', 'pinch', 'dash', 'jar', 'bottle', 'bag', 'box', 'container', 'stalk',
  'leaf', 'fillet', 'loaf', 'sheet', 'cube', 'ear', 'link', 'handful',
]);

// alias (already lowercased, punctuation-stripped, whitespace-collapsed) -> canonical
const ALIASES = {
  // teaspoon
  tsp: 'tsp', tsps: 'tsp', ts: 'tsp', tspn: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', teasp: 'tsp',
  // tablespoon
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tbls: 'tbsp', tb: 'tbsp', tblsp: 'tbsp',
  tblspn: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbspn: 'tbsp',
  // cup
  cup: 'cup', cups: 'cup', c: 'cup',
  // fluid ounce
  'fl oz': 'fl oz', floz: 'fl oz', 'fluid oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  'fl ounce': 'fl oz', 'fl ounces': 'fl oz',
  // pint / quart / gallon
  pint: 'pint', pints: 'pint', pt: 'pint', pts: 'pint',
  quart: 'quart', quarts: 'quart', qt: 'quart', qts: 'quart',
  gallon: 'gallon', gallons: 'gallon', gal: 'gallon', gals: 'gallon',
  // metric volume
  ml: 'ml', mls: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', centiliter: 'cl', centiliters: 'cl', centilitre: 'cl', centilitres: 'cl',
  dl: 'dl', deciliter: 'dl', deciliters: 'dl', decilitre: 'dl', decilitres: 'dl',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l', ltr: 'l', ltrs: 'l', lt: 'l',
  // weight
  mg: 'mg', milligram: 'mg', milligrams: 'mg', milligramme: 'mg',
  g: 'g', gr: 'g', grs: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kilogramme: 'kg',
  oz: 'oz', ozs: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', '#': 'lb',
  // count
  '': 'each', each: 'each', ea: 'each', whole: 'each', unit: 'each', units: 'each',
  large: 'each', medium: 'each', small: 'each', lg: 'each', lrg: 'each', med: 'each', sm: 'each',
  'extra large': 'each', xl: 'each',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  package: 'package', packages: 'package', pkg: 'package', pkgs: 'package', pack: 'package',
  packs: 'package', packet: 'package', packets: 'package', envelope: 'package', envelopes: 'package',
  bunch: 'bunch', bunches: 'bunch',
  head: 'head', heads: 'head', bulb: 'head', bulbs: 'head',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece',
  stick: 'stick', sticks: 'stick',
  sprig: 'sprig', sprigs: 'sprig',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  jar: 'jar', jars: 'jar',
  bottle: 'bottle', bottles: 'bottle',
  bag: 'bag', bags: 'bag',
  box: 'box', boxes: 'box',
  container: 'container', containers: 'container', tub: 'container', tubs: 'container',
  stalk: 'stalk', stalks: 'stalk', rib: 'stalk', ribs: 'stalk',
  leaf: 'leaf', leaves: 'leaf',
  fillet: 'fillet', fillets: 'fillet', filet: 'fillet', filets: 'fillet',
  loaf: 'loaf', loaves: 'loaf',
  sheet: 'sheet', sheets: 'sheet',
  cube: 'cube', cubes: 'cube',
  ear: 'ear', ears: 'ear',
  link: 'link', links: 'link',
  handful: 'handful', handfuls: 'handful',
};

/** Singular / plural display labels for canonical units. */
export const UNIT_LABELS = {
  tsp: ['tsp', 'tsp'],
  tbsp: ['tbsp', 'tbsp'],
  cup: ['cup', 'cups'],
  'fl oz': ['fl oz', 'fl oz'],
  pint: ['pint', 'pints'],
  quart: ['quart', 'quarts'],
  gallon: ['gallon', 'gallons'],
  ml: ['ml', 'ml'],
  cl: ['cl', 'cl'],
  dl: ['dl', 'dl'],
  l: ['L', 'L'],
  mg: ['mg', 'mg'],
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  oz: ['oz', 'oz'],
  lb: ['lb', 'lb'],
  each: ['', ''],
  bunch: ['bunch', 'bunches'],
  box: ['box', 'boxes'],
  pinch: ['pinch', 'pinches'],
  dash: ['dash', 'dashes'],
  leaf: ['leaf', 'leaves'],
  loaf: ['loaf', 'loaves'],
};

function cleanUnitText(unit) {
  return String(unit)
    .replace(/\([^)]*\)/g, ' ') // "can (14 oz)" -> "can"
    .replace(/\./g, ' ')
    .replace(/[,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeUnit(u) {
  if (u.endsWith('es') && ALIASES[u.slice(0, -2)] !== undefined) return u.slice(0, -2);
  if (u.endsWith('s') && ALIASES[u.slice(0, -1)] !== undefined) return u.slice(0, -1);
  if (u.endsWith('ies')) return `${u.slice(0, -3)}y`;
  if (u.endsWith('sses')) return u.slice(0, -2); // "glasses" -> "glass"
  if (u.endsWith('ches') || u.endsWith('shes') || u.endsWith('xes')) return u.slice(0, -2);
  if (u.endsWith('s') && !u.endsWith('ss') && u.length > 2) return u.slice(0, -1);
  return u;
}

/** @returns {'volume'|'weight'|'count'|'unknown'} */
export function categoryOfCanonical(unit) {
  if (VOLUME_TO_ML[unit] !== undefined) return 'volume';
  if (WEIGHT_TO_G[unit] !== undefined) return 'weight';
  if (COUNT_UNITS.has(unit)) return 'count';
  return 'unknown';
}

/**
 * normalizeUnit(unit) -> { unit: canonical string, category }
 * Case/punctuation/plural insensitive. A lone "T" is tablespoon, a lone "t" is teaspoon.
 * null/undefined/"" => { unit: 'each', category: 'count' }.
 */
export function normalizeUnit(unit) {
  if (unit === null || unit === undefined) return { unit: 'each', category: 'count' };
  const original = cleanUnitText(unit);
  if (original === 'T') return { unit: 'tbsp', category: 'volume' };
  if (original === 't') return { unit: 'tsp', category: 'volume' };
  const u = original.toLowerCase();

  let canonical = ALIASES[u];
  if (canonical === undefined) {
    // "fl. oz." -> "fl oz" already handled by cleaning; try singular form
    const singular = singularizeUnit(u);
    canonical = ALIASES[singular];
    if (canonical === undefined) {
      return { unit: singular, category: 'unknown' };
    }
  }
  return { unit: canonical, category: categoryOfCanonical(canonical) };
}

/** Is this alias text a known unit (anything but 'unknown')? */
export function isKnownUnit(text) {
  return normalizeUnit(text).category !== 'unknown';
}

/** Convert value of canonical unit to base (ml / g). Returns null if not convertible. */
export function toBase(value, unit) {
  if (VOLUME_TO_ML[unit] !== undefined) return value * VOLUME_TO_ML[unit];
  if (WEIGHT_TO_G[unit] !== undefined) return value * WEIGHT_TO_G[unit];
  return null;
}

/** Convert base value (ml / g) to canonical unit. */
export function fromBase(baseValue, unit) {
  if (VOLUME_TO_ML[unit] !== undefined) return baseValue / VOLUME_TO_ML[unit];
  if (WEIGHT_TO_G[unit] !== undefined) return baseValue / WEIGHT_TO_G[unit];
  return null;
}

export function systemOfUnit(unit) {
  return METRIC_UNITS.has(unit) ? 'metric' : 'imperial';
}

export function unitLabel(unit, plural) {
  const labels = UNIT_LABELS[unit];
  if (labels) return plural ? labels[1] : labels[0];
  if (!unit) return '';
  if (!plural) return unit;
  if (/(ch|sh|x|s|z)$/.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}
