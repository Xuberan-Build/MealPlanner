// src/utils/storeUnits/storeUnitTable.js
//
// How common US groceries are SOLD, and how their cooking amounts convert to weight.
// Keys are grouping keys from normalizeIngredientName (lowercase, singular).
//
//   sell:  how the shopper buys it
//     { by: 'count',   label, plural, grams }      a whole thing (head, bunch, lemon) of ~grams
//                                                   (weighed: true = priced by weight at the register)
//     { by: 'package', label, plural, grams, size } a package of `grams`, labelled `size`
//     { by: 'weight' }                              sold by the pound / ounce
//   perUnit: grams in ONE of a cooking unit. 'cup' converts all volume (tbsp, tsp, ml...);
//     'each' is a bare count ("2 onions"); other keys are count units (clove, slice, stick).
//
// Values are typical retail sizes and USDA-style cup weights; "about right" is the goal,
// because amounts are rounded UP to whole purchasable units anyway.

const lb = (n) => Math.round(n * 453.592);
const oz = (n) => Math.round(n * 28.3495);

const count = (label, plural, grams) => ({ by: 'count', label, plural, grams });
// Sold whole but priced by the pound at the register, so the list shows the weight too.
const weighed = (label, plural, grams) => ({ ...count(label, plural, grams), weighed: true });
const pack = (label, plural, grams, size) => ({ by: 'package', label, plural, grams, size });
const WEIGHT = { by: 'weight' };

export const STORE_UNITS = {
  // ---------------------------------------------------------------- produce
  broccoli: { sell: weighed('head', 'heads', oz(10)), perUnit: { cup: 85, each: oz(10), head: oz(10) } },
  cauliflower: { sell: weighed('head', 'heads', oz(21)), perUnit: { cup: 107, each: oz(21), head: oz(21) } },
  cabbage: { sell: weighed('head', 'heads', lb(2)), perUnit: { cup: 89, each: lb(2), head: lb(2) } },
  lettuce: { sell: count('head', 'heads', oz(22)), perUnit: { cup: 47, each: oz(22), head: oz(22), leaf: 10 } },
  'romaine lettuce': { sell: count('head', 'heads', oz(22)), perUnit: { cup: 47, each: oz(22), head: oz(22), leaf: 10 } },
  romaine: { sell: count('head', 'heads', oz(22)), perUnit: { cup: 47, each: oz(22), head: oz(22), leaf: 10 } },
  spinach: { sell: pack('bag', 'bags', oz(5), '5 oz'), perUnit: { cup: 30 } },
  'baby spinach': { sell: pack('bag', 'bags', oz(5), '5 oz'), perUnit: { cup: 30 } },
  'salad green': { sell: pack('bag', 'bags', oz(5), '5 oz'), perUnit: { cup: 30 } },
  'mixed green': { sell: pack('bag', 'bags', oz(5), '5 oz'), perUnit: { cup: 30 } },
  arugula: { sell: pack('bag', 'bags', oz(5), '5 oz'), perUnit: { cup: 20 } },
  kale: { sell: count('bunch', 'bunches', oz(8)), perUnit: { cup: 25, bunch: oz(8), leaf: 15 } },
  onion: { sell: weighed('onion', 'onions', 170), perUnit: { cup: 160, each: 170 } },
  'green onion': { sell: count('bunch', 'bunches', 100), perUnit: { cup: 100, each: 15, bunch: 100, stalk: 15 } },
  scallion: { sell: count('bunch', 'bunches', 100), perUnit: { cup: 100, each: 15, bunch: 100, stalk: 15 } },
  shallot: { sell: count('shallot', 'shallots', 45), perUnit: { cup: 160, each: 45 } },
  garlic: { sell: count('head', 'heads', 50), perUnit: { cup: 136, clove: 5, head: 50, each: 5 } },
  carrot: { sell: pack('bag', 'bags', lb(1), '1 lb'), perUnit: { cup: 128, each: 61 } },
  celery: { sell: count('bunch', 'bunches', lb(1)), perUnit: { cup: 101, stalk: 40, each: 40, bunch: lb(1) } },
  'bell pepper': { sell: count('pepper', 'peppers', 120), perUnit: { cup: 149, each: 120 } },
  'red bell pepper': { sell: count('pepper', 'peppers', 120), perUnit: { cup: 149, each: 120 } },
  jalapeno: { sell: count('pepper', 'peppers', 14), perUnit: { cup: 90, each: 14 } },
  zucchini: { sell: weighed('zucchini', 'zucchini', 200), perUnit: { cup: 124, each: 200 } },
  cucumber: { sell: weighed('cucumber', 'cucumbers', 300), perUnit: { cup: 119, each: 300 } },
  tomato: { sell: weighed('tomato', 'tomatoes', 123), perUnit: { cup: 180, each: 123 } },
  'cherry tomato': { sell: pack('pint', 'pints', 285, '1 pint'), perUnit: { cup: 149, each: 17 } },
  potato: { sell: weighed('potato', 'potatoes', 213), perUnit: { cup: 150, each: 213 } },
  'sweet potato': { sell: weighed('sweet potato', 'sweet potatoes', 200), perUnit: { cup: 133, each: 200 } },
  mushroom: { sell: pack('package', 'packages', oz(8), '8 oz'), perUnit: { cup: 70, each: 18 } },
  'green bean': { sell: WEIGHT, perUnit: { cup: 100 } },
  asparagus: { sell: count('bunch', 'bunches', lb(1)), perUnit: { cup: 134, bunch: lb(1), each: 16 } },
  'brussels sprout': { sell: WEIGHT, perUnit: { cup: 88, each: 19 } },
  corn: { sell: count('ear', 'ears', 90), perUnit: { cup: 154, ear: 90, each: 90 } },
  avocado: { sell: count('avocado', 'avocados', 150), perUnit: { cup: 150, each: 150 } },
  lemon: { sell: count('lemon', 'lemons', 100), perUnit: { cup: 212, each: 100 } },
  'lemon juice': { sell: count('lemon', 'lemons', 45), perUnit: { cup: 244 } },
  lime: { sell: count('lime', 'limes', 67), perUnit: { cup: 212, each: 67 } },
  'lime juice': { sell: count('lime', 'limes', 30), perUnit: { cup: 244 } },
  ginger: { sell: WEIGHT, perUnit: { cup: 96 } },
  cilantro: { sell: count('bunch', 'bunches', 60), perUnit: { cup: 16, bunch: 60, sprig: 2 } },
  parsley: { sell: count('bunch', 'bunches', 60), perUnit: { cup: 30, bunch: 60, sprig: 2 } },
  dill: { sell: count('bunch', 'bunches', 30), perUnit: { cup: 9, bunch: 30, sprig: 1 } },
  basil: { sell: pack('package', 'packages', oz(0.75), '0.75 oz'), perUnit: { cup: 24, leaf: 0.5, sprig: 2 } },
  mint: { sell: pack('package', 'packages', oz(0.75), '0.75 oz'), perUnit: { cup: 50, leaf: 0.5, sprig: 2 } },
  apple: { sell: count('apple', 'apples', 182), perUnit: { cup: 125, each: 182 } },
  banana: { sell: count('banana', 'bananas', 118), perUnit: { cup: 150, each: 118 } },
  orange: { sell: count('orange', 'oranges', 140), perUnit: { cup: 180, each: 140 } },
  strawberry: { sell: pack('container', 'containers', lb(1), '1 lb'), perUnit: { cup: 152, each: 12 } },
  blueberry: { sell: pack('container', 'containers', oz(6), '6 oz'), perUnit: { cup: 148 } },
  raspberry: { sell: pack('container', 'containers', oz(6), '6 oz'), perUnit: { cup: 123 } },

  // ---------------------------------------------------------------- protein
  'chicken breast': { sell: WEIGHT, perUnit: { each: 230, cup: 140 } },
  'boneless skinless chicken breast': { sell: WEIGHT, perUnit: { each: 230, cup: 140 } },
  'chicken thigh': { sell: WEIGHT, perUnit: { each: 115, cup: 140 } },
  'boneless skinless chicken thigh': { sell: WEIGHT, perUnit: { each: 115, cup: 140 } },
  'chicken drumstick': { sell: WEIGHT, perUnit: { each: 110 } },
  'chicken wing': { sell: WEIGHT, perUnit: { each: 90 } },
  'rotisserie chicken': { sell: count('chicken', 'chickens', 600), perUnit: { cup: 140 } },
  'ground beef': { sell: WEIGHT, perUnit: { cup: 225 } },
  'ground turkey': { sell: WEIGHT, perUnit: { cup: 225 } },
  'ground pork': { sell: WEIGHT, perUnit: { cup: 225 } },
  steak: { sell: WEIGHT, perUnit: { each: 280 } },
  'pork chop': { sell: WEIGHT, perUnit: { each: 200 } },
  salmon: { sell: WEIGHT, perUnit: { each: 170, fillet: 170 } },
  shrimp: { sell: WEIGHT, perUnit: { cup: 145, each: 12 } },
  bacon: { sell: pack('package', 'packages', oz(12), '12 oz'), perUnit: { slice: 12, each: 12 } },
  tofu: { sell: pack('block', 'blocks', oz(14), '14 oz'), perUnit: { cup: 252 } },
  egg: { sell: pack('dozen', 'dozen', 600, ''), perUnit: { each: 50, cup: 243 } },

  // ---------------------------------------------------------------- grains, bread, baking
  rice: { sell: pack('bag', 'bags', lb(2), '2 lb'), perUnit: { cup: 185 } },
  'white rice': { sell: pack('bag', 'bags', lb(2), '2 lb'), perUnit: { cup: 185 } },
  'brown rice': { sell: pack('bag', 'bags', lb(2), '2 lb'), perUnit: { cup: 190 } },
  quinoa: { sell: pack('bag', 'bags', oz(12), '12 oz'), perUnit: { cup: 170 } },
  pasta: { sell: pack('box', 'boxes', lb(1), '1 lb'), perUnit: { cup: 100 } },
  spaghetti: { sell: pack('box', 'boxes', lb(1), '1 lb'), perUnit: { cup: 100 } },
  'orzo pasta': { sell: pack('box', 'boxes', lb(1), '1 lb'), perUnit: { cup: 180 } },
  orzo: { sell: pack('box', 'boxes', lb(1), '1 lb'), perUnit: { cup: 180 } },
  'rolled oat': { sell: pack('canister', 'canisters', oz(18), '18 oz'), perUnit: { cup: 81 } },
  oat: { sell: pack('canister', 'canisters', oz(18), '18 oz'), perUnit: { cup: 81 } },
  'quick oat': { sell: pack('canister', 'canisters', oz(18), '18 oz'), perUnit: { cup: 81 } },
  'steel cut oat': { sell: pack('canister', 'canisters', oz(30), '30 oz'), perUnit: { cup: 176 } },
  bread: { sell: pack('loaf', 'loaves', oz(20), '20 oz'), perUnit: { slice: 28, each: 28 } },
  tortilla: { sell: pack('pack', 'packs', 450, '10 ct'), perUnit: { each: 45 } },
  'all purpose flour': { sell: pack('bag', 'bags', lb(5), '5 lb'), perUnit: { cup: 125 } },
  flour: { sell: pack('bag', 'bags', lb(5), '5 lb'), perUnit: { cup: 125 } },
  sugar: { sell: pack('bag', 'bags', lb(4), '4 lb'), perUnit: { cup: 200 } },
  'brown sugar': { sell: pack('bag', 'bags', lb(2), '2 lb'), perUnit: { cup: 220 } },
  'powdered sugar': { sell: pack('bag', 'bags', lb(2), '2 lb'), perUnit: { cup: 120 } },
  cornstarch: { sell: pack('box', 'boxes', oz(16), '16 oz'), perUnit: { cup: 128 } },

  // ---------------------------------------------------------------- dairy
  milk: { sell: pack('half gallon', 'half gallons', 1950, ''), perUnit: { cup: 245 } },
  'heavy cream': { sell: pack('pint', 'pints', 480, '16 fl oz'), perUnit: { cup: 238 } },
  'half and half': { sell: pack('pint', 'pints', 485, '16 fl oz'), perUnit: { cup: 242 } },
  butter: { sell: pack('package', 'packages', lb(1), '1 lb'), perUnit: { cup: 227, stick: 113 } },
  'unsalted butter': { sell: pack('package', 'packages', lb(1), '1 lb'), perUnit: { cup: 227, stick: 113 } },
  'cheddar cheese': { sell: pack('block', 'blocks', oz(8), '8 oz'), perUnit: { cup: 113, slice: 21 } },
  'mozzarella cheese': { sell: pack('bag', 'bags', oz(8), '8 oz'), perUnit: { cup: 113 } },
  'parmesan cheese': { sell: pack('container', 'containers', oz(5), '5 oz'), perUnit: { cup: 100 } },
  cheese: { sell: pack('package', 'packages', oz(8), '8 oz'), perUnit: { cup: 113, slice: 21 } },
  'sour cream': { sell: pack('tub', 'tubs', oz(16), '16 oz'), perUnit: { cup: 230 } },
  'greek yogurt': { sell: pack('tub', 'tubs', oz(32), '32 oz'), perUnit: { cup: 245 } },
  yogurt: { sell: pack('tub', 'tubs', oz(32), '32 oz'), perUnit: { cup: 245 } },
  'cream cheese': { sell: pack('package', 'packages', oz(8), '8 oz'), perUnit: { cup: 232 } },

  // ---------------------------------------------------------------- pantry liquids & cans
  'chicken broth': { sell: pack('carton', 'cartons', 946, '32 oz'), perUnit: { cup: 240 } },
  'low sodium chicken broth': { sell: pack('carton', 'cartons', 946, '32 oz'), perUnit: { cup: 240 } },
  'chicken stock': { sell: pack('carton', 'cartons', 946, '32 oz'), perUnit: { cup: 240 } },
  'vegetable broth': { sell: pack('carton', 'cartons', 946, '32 oz'), perUnit: { cup: 240 } },
  'beef broth': { sell: pack('carton', 'cartons', 946, '32 oz'), perUnit: { cup: 240 } },
  'coconut milk': { sell: pack('can', 'cans', 400, '13.5 oz'), perUnit: { cup: 240 } },
  'black bean': { sell: pack('can', 'cans', 255, '15 oz'), perUnit: { cup: 172 } },
  chickpea: { sell: pack('can', 'cans', 255, '15 oz'), perUnit: { cup: 164 } },
  'olive oil': { sell: pack('bottle', 'bottles', 460, '16.9 fl oz'), perUnit: { cup: 216 } },
  'extra virgin olive oil': { sell: pack('bottle', 'bottles', 460, '16.9 fl oz'), perUnit: { cup: 216 } },
  'vegetable oil': { sell: pack('bottle', 'bottles', 1300, '48 fl oz'), perUnit: { cup: 218 } },
  'soy sauce': { sell: pack('bottle', 'bottles', 300, '10 fl oz'), perUnit: { cup: 255 } },
  salsa: { sell: pack('jar', 'jars', oz(16), '16 oz'), perUnit: { cup: 260 } },
};

/**
 * Store entry for a grouping key: an exact match, else the longest whole-word suffix
 * ("organic baby spinach" -> "baby spinach", "sweet onion" -> "onion"). null when unknown.
 */
export function findStoreUnit(key) {
  const words = String(key || '').trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const entry = STORE_UNITS[words.slice(i).join(' ')];
    if (entry) return entry;
  }
  return null;
}
