// src/features/shoppingList/trips/freshnessTable.js
//
// How long fresh groceries keep once bought, and which fruit is bought firm to ripen at
// home. Pure data + lookup; no React. Used to decide which grocery run ("trip") buys what.
//
// Keys are grouping keys from normalizeIngredientName (lowercase, singular), like the
// store-unit table. Lookup uses the longest matching suffix ("boneless skinless chicken
// breast" -> "chicken breast"), so only the distinctive tail needs an entry.
//
//   shelfLifeDays: days it stays good after buying (fridge / counter as usual).
//                  null = keeps for the whole week (onions, pantry goods, frozen...).
//   ripenDays:     buy-ahead fruit: days it takes to ripen from firm at the store.
//
// "About right" is the goal: it only decides between trips a few days apart.

const keeps = Object.freeze({ shelfLifeDays: null, ripenDays: null });
const days = (shelfLifeDays) => Object.freeze({ shelfLifeDays, ripenDays: null });
const ripens = (ripenDays, shelfLifeDays) => Object.freeze({ shelfLifeDays, ripenDays });

/** All of `names` with the same freshness. */
const all = (names, value) => names.reduce((acc, n) => ({ ...acc, [n]: value }), {});
/** "feta" and "feta cheese" (the generic "cheese" suffix would otherwise win). */
const cheeses = (names, value) => all(names.flatMap((n) => [n, `${n} cheese`]), value);

export const FRESHNESS = Object.freeze({
  // ------------------------------------------------------------ fish & seafood: 2 days
  ...all([
    'fish', 'salmon', 'cod', 'tilapia', 'halibut', 'trout', 'mahi mahi', 'snapper', 'sea bass',
    'catfish', 'haddock', 'swordfish', 'tuna steak', 'ahi tuna', 'fresh tuna', 'white fish',
    'shrimp', 'prawn', 'scallop', 'crab', 'crab meat', 'lobster', 'mussel', 'clam', 'oyster',
    'squid', 'calamari', 'octopus', 'seafood',
  ], days(2)),
  'smoked salmon': days(7),

  // ------------------------------------------------- ground meat & poultry: 2 days
  ...all([
    'chicken', 'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick',
    'chicken tender', 'whole chicken', 'turkey', 'turkey breast', 'duck', 'cornish hen',
    'ground beef', 'ground turkey', 'ground pork', 'ground chicken', 'ground lamb',
    'ground chuck', 'ground veal', 'ground bison', 'ground meat', 'ground sausage', 'mince',
    'minced beef', 'hamburger', 'hamburger patty',
  ], days(2)),
  'rotisserie chicken': days(3),

  // ------------------------------------------------------- other fresh meat: 3 days
  ...all([
    'beef', 'steak', 'sirloin', 'ribeye', 'rib eye', 'chuck', 'chuck roast', 'brisket',
    'short rib', 'stew meat', 'tenderloin', 'veal', 'pork', 'pork chop', 'pork loin',
    'pork shoulder', 'pork belly', 'rib', 'lamb', 'lamb chop', 'sausage', 'italian sausage',
    'chorizo', 'bratwurst', 'meatball', 'venison', 'bison',
  ], days(3)),
  ...all(['bacon', 'hot dog', 'kielbasa', 'pancetta', 'prosciutto'], days(7)),
  ham: days(5),
  'roast beef': days(5),

  // ------------------------------------------------------------------ eggs & dairy
  egg: days(21),
  'egg white': days(7),
  'egg yolk': days(2),
  ...all(['milk', 'cream', 'whipping cream', 'half and half'], days(7)),
  ...all(['buttermilk', 'yogurt', 'kefir'], days(10)),
  ...all(['sour cream', 'cream cheese'], days(14)),
  butter: keeps,
  'ice cream': keeps,
  // soft cheese: 7 days; hard cheese keeps for weeks
  'goat cheese': days(7),
  ...cheeses(['mozzarella', 'fresh mozzarella', 'feta', 'ricotta', 'cottage', 'brie', 'burrata', 'mascarpone', 'paneer', 'queso fresco'], days(7)),
  ...cheeses(['cheddar', 'parmesan', 'pecorino', 'gruyere', 'swiss', 'monterey jack', 'pepper jack', 'manchego', 'gouda'], days(21)),
  cheese: days(14),
  tofu: days(14),
  hummus: days(7),

  // ------------------------------------------------------------------------ bakery
  ...all(['bread', 'pita', 'bun', 'roll', 'bagel', 'naan', 'focaccia'], days(4)),
  ...all(['baguette', 'croissant'], days(2)),
  'english muffin': days(7),
  tortilla: days(14),

  // ----------------------------------------------------------------- produce: berries
  ...all(['strawberry', 'blueberry', 'raspberry', 'blackberry', 'berry', 'mixed berry'], days(3)),
  cherry: days(5),
  grape: days(7),

  // ------------------------------------------------- leafy greens & fresh herbs: 5 days
  ...all([
    'spinach', 'baby spinach', 'lettuce', 'romaine', 'romaine lettuce', 'arugula', 'salad green',
    'mixed green', 'spring mix', 'kale', 'chard', 'swiss chard', 'collard green', 'bok choy',
    'watercress', 'cilantro', 'parsley', 'basil', 'mint', 'dill', 'chive', 'tarragon',
    'fresh herb', 'green onion', 'scallion',
  ], days(5)),
  ...all(['microgreen', 'bean sprout'], days(3)),
  ...all(['thyme', 'sage'], days(7)),
  rosemary: days(10),

  // ---------------------------------------------------------------- other vegetables
  ...all(['mushroom', 'green bean', 'broccoli', 'zucchini', 'summer squash', 'yellow squash', 'cucumber', 'eggplant', 'brussels sprout'], days(5)),
  ...all(['asparagus', 'corn', 'snap pea', 'snow pea'], days(3)),
  ...all(['cauliflower', 'bell pepper', 'jalapeno'], days(7)),
  ...all(['leek', 'radish'], days(10)),
  ...all(['celery', 'beet'], days(14)),
  ...all(['carrot', 'cabbage', 'ginger'], days(21)),
  ...all(['cherry tomato', 'grape tomato'], days(5)),

  // ------------------------------------------------------------------- other fruit
  ...all(['apple'], days(21)),
  ...all(['lemon', 'lime', 'orange', 'grapefruit', 'clementine', 'mandarin', 'lemon juice', 'lime juice', 'lemon zest', 'lime zest'], days(14)),
  ...all(['melon', 'watermelon', 'cantaloupe', 'honeydew'], days(7)),
  pineapple: days(5),

  // ---------------------------------------------- buy-ahead fruit: bought firm, ripens
  avocado: ripens(3, 2), // 3-4 days to ripen; buy firm 3+ days ahead
  banana: ripens(3, 4),
  ...all(['peach', 'pear', 'mango', 'kiwi', 'kiwifruit', 'plum', 'nectarine', 'apricot', 'papaya'], ripens(3, 3)),
  tomato: ripens(2, 5),

  // ------------------------------------------------------------------- keeps all week
  ...all([
    'onion', 'shallot', 'garlic', 'potato', 'sweet potato', 'squash', 'butternut squash',
    'acorn squash', 'spaghetti squash', 'pumpkin',
  ], keeps),
});

/** Words in front of a match that mean "not fresh" ("dried basil", "frozen berries", "canned peaches"). */
export const PRESERVED_WORDS = new Set(['dried', 'dry', 'frozen', 'canned', 'jarred', 'pickled', 'powdered', 'ground', 'smoked', 'freeze']);

/** Count words the grouping key keeps at the end ("basil leaf", "salmon fillet", "thyme sprig"). */
const TRAILING_COUNT_WORDS = new Set(['leaf', 'sprig', 'fillet', 'stalk', 'stem', 'bunch', 'head', 'piece', 'floret', 'wedge', 'slice']);

/**
 * findFreshness(key) -> { shelfLifeDays, ripenDays } | null (not in the table).
 * Longest suffix wins; a preserved word dropped in front of the match ("dried basil")
 * means it keeps all week.
 */
export function findFreshness(key) {
  let words = String(key || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 1 && TRAILING_COUNT_WORDS.has(words[words.length - 1])) words = words.slice(0, -1);
  for (let i = 0; i < words.length; i += 1) {
    const entry = FRESHNESS[words.slice(i).join(' ')];
    if (entry) return words.slice(0, i).some((w) => PRESERVED_WORDS.has(w)) ? keeps : entry;
  }
  return words.some((w) => PRESERVED_WORDS.has(w) && w !== 'ground') ? keeps : null;
}

/** Aisles whose contents keep all week, whatever the name says ("coconut milk" is canned). */
export const KEEPS_AISLES = new Set([
  'frozen', 'grains-pasta', 'canned-jarred', 'baking', 'spices', 'condiments', 'snacks', 'beverages', 'household',
]);

/** Fallback when the name is unknown: by aisle, refined by its subcategory. */
const AISLE_DEFAULTS = {
  produce: { default: 7, 'Fresh Herbs': 5, 'Salad & Leafy Greens': 5 },
  bakery: { default: 4, 'Tortillas & Wraps': 14 },
  'meat-seafood': { default: 3, 'Fish & Seafood': 2, Poultry: 2 },
  'dairy-eggs': { default: 7, Eggs: 21, Cheese: 14, 'Milk Alternatives': 10, 'Butter & Margarine': null },
  deli: { default: 5 },
};

/** Shelf life for an aisle (+ subcategory); null = keeps. */
export function aisleShelfLife(aisleId, subcategory = '') {
  if (!aisleId || KEEPS_AISLES.has(aisleId)) return null;
  const table = AISLE_DEFAULTS[aisleId];
  if (!table) return null;
  if (subcategory && Object.prototype.hasOwnProperty.call(table, subcategory)) return table[subcategory];
  return table.default;
}

/**
 * freshnessFor(item) -> { shelfLifeDays, ripenDays }
 * item: { key, aisleId, subcategory } (a normalized list item). Keeps-all-week aisles win,
 * then the name table, then the aisle default.
 */
export function freshnessFor(item) {
  const aisleId = (item && (item.aisleId || (item.aisle && item.aisle.aisleId))) || '';
  if (KEEPS_AISLES.has(aisleId)) return keeps;
  const byName = findFreshness(item && item.key);
  if (byName) return byName;
  return { shelfLifeDays: aisleShelfLife(aisleId, item && item.subcategory), ripenDays: null };
}
