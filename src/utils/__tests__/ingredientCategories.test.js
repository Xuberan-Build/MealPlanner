import {
  AISLES,
  AISLE_IDS,
  getAisle,
  getAisleById,
  categorizeIngredient,
  normalizeIngredientName,
  sortByAisle,
  groupByAisle,
  compareByAisle,
  INGREDIENT_CATEGORIES,
  getAllCategories,
  isValidCategory
} from '../ingredientCategories';

const {
  PRODUCE,
  BAKERY,
  MEAT_SEAFOOD,
  DAIRY_EGGS,
  DELI,
  FROZEN,
  GRAINS,
  CANNED,
  BAKING,
  SPICES,
  CONDIMENTS,
  SNACKS,
  BEVERAGES,
  HOUSEHOLD
} = AISLE_IDS;

describe('AISLES', () => {
  test('are in store-walk order', () => {
    expect(AISLES.map(a => a.name)).toEqual([
      'Produce',
      'Bakery',
      'Meat & Seafood',
      'Dairy & Eggs',
      'Deli & Refrigerated',
      'Frozen',
      'Pantry: Grains & Pasta',
      'Pantry: Canned & Jarred',
      'Baking',
      'Spices & Seasonings',
      'Oils, Vinegars & Condiments',
      'Snacks',
      'Beverages',
      'Household & Other'
    ]);
    AISLES.forEach((a, i) => expect(a.order).toBe(i + 1));
  });

  test('ids are unique and resolvable', () => {
    const ids = AISLES.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getAisleById('produce').name).toBe('Produce');
    expect(getAisleById('spices & seasonings').id).toBe(SPICES);
    expect(getAisleById('nope')).toBeNull();
    expect(getAisleById(undefined)).toBeNull();
  });
});

// [input, expected aisleId]
const CASES = [
  // Pepper traps
  ['black pepper', SPICES],
  ['ground pepper', SPICES],
  ['ground black pepper', SPICES],
  ['freshly ground black pepper', SPICES],
  ['peppercorns', SPICES],
  ['black peppercorns', SPICES],
  ['pepper', SPICES],
  ['salt and pepper', SPICES],
  ['cayenne pepper', SPICES],
  ['red pepper flakes', SPICES],
  ['crushed red pepper', SPICES],
  ['lemon pepper', SPICES],
  ['bell pepper', PRODUCE],
  ['red bell peppers', PRODUCE],
  ['red pepper', PRODUCE],
  ['green peppers', PRODUCE],
  ['jalapeño pepper', PRODUCE],
  ['jalapeños', PRODUCE],
  ['Jalapeno', PRODUCE],
  ['peppers', PRODUCE],
  ['roasted red peppers', CANNED],
  ['pepper jack cheese', DAIRY_EGGS],
  // Garlic / onion traps
  ['garlic powder', SPICES],
  ['onion powder', SPICES],
  ['garlic salt', SPICES],
  ['garlic', PRODUCE],
  ['Garlic Cloves', PRODUCE],
  ['minced garlic', PRODUCE],
  ['onion', PRODUCE],
  ['red onions', PRODUCE],
  ['green onions', PRODUCE],
  ['garlic bread', BAKERY],
  // Butter / milk / cream traps
  ['peanut butter', CANNED],
  ['almond butter', CANNED],
  ['butter', DAIRY_EGGS],
  ['unsalted butter', DAIRY_EGGS],
  ['butter lettuce', PRODUCE],
  ['coconut milk', CANNED],
  ['canned coconut milk', CANNED],
  ['almond milk', DAIRY_EGGS],
  ['oat milk', DAIRY_EGGS],
  ['milk', DAIRY_EGGS],
  ['buttermilk', DAIRY_EGGS],
  ['heavy cream', DAIRY_EGGS],
  ['sour cream', DAIRY_EGGS],
  ['cream cheese', DAIRY_EGGS],
  ['cream of tartar', BAKING],
  ['cream of mushroom soup', CANNED],
  ['ice cream', FROZEN],
  ['vanilla ice cream', FROZEN],
  ['evaporated milk', CANNED],
  ['sweetened condensed milk', CANNED],
  // Broth / stock
  ['chicken broth', CANNED],
  ['low-sodium chicken stock', CANNED],
  ['beef broth', CANNED],
  ['vegetable stock', CANNED],
  ['chicken', MEAT_SEAFOOD],
  ['chicken breasts', MEAT_SEAFOOD],
  ['boneless skinless chicken thighs', MEAT_SEAFOOD],
  // Eggs vs eggplant
  ['eggplant', PRODUCE],
  ['egg', DAIRY_EGGS],
  ['eggs', DAIRY_EGGS],
  ['large eggs', DAIRY_EGGS],
  ['egg noodles', GRAINS],
  // Tomatoes
  ['tomato paste', CANNED],
  ['tomato sauce', CANNED],
  ['canned tomatoes', CANNED],
  ['crushed tomatoes', CANNED],
  ['diced tomatoes', CANNED],
  ['tomatoes', PRODUCE],
  ['cherry tomatoes', PRODUCE],
  ['tomato', PRODUCE],
  // Citrus
  ['lemon juice', PRODUCE],
  ['lime juice', PRODUCE],
  ['lemon', PRODUCE],
  ['lemon zest', PRODUCE],
  ['orange juice', BEVERAGES],
  // Frozen
  ['frozen peas', FROZEN],
  ['frozen corn', FROZEN],
  ['frozen chicken breasts', FROZEN],
  ['frozen mixed berries', FROZEN],
  ['peas', FROZEN],
  ['corn', PRODUCE],
  ['puff pastry', FROZEN],
  // Condiments
  ['soy sauce', CONDIMENTS],
  ['fish sauce', CONDIMENTS],
  ['olive oil', CONDIMENTS],
  ['extra-virgin-olive-oil', CONDIMENTS],
  ['apple cider vinegar', CONDIMENTS],
  ['dijon mustard', CONDIMENTS],
  ['mayonnaise', CONDIMENTS],
  ['sriracha', CONDIMENTS],
  // Baking
  ['baking soda', BAKING],
  ['baking powder', BAKING],
  ['all-purpose-flour', BAKING],
  ['All-Purpose Flour', BAKING],
  ['all_purpose_flour', BAKING],
  ['brown sugar', BAKING],
  ['powdered sugar', BAKING],
  ['vanilla extract', BAKING],
  ['chocolate chips', BAKING],
  ['cornstarch', BAKING],
  ['active dry yeast', BAKING],
  // Spices
  ['salt', SPICES],
  ['kosher salt', SPICES],
  ['sea salt', SPICES],
  ['ground cumin', SPICES],
  ['smoked paprika', SPICES],
  ['cinnamon', SPICES],
  ['chili powder', SPICES],
  ['dried oregano', SPICES],
  ['dried thyme', SPICES],
  ['ground ginger', SPICES],
  ['bay leaves', SPICES],
  ['italian seasoning', SPICES],
  // Fresh herbs / produce
  ['fresh thyme', PRODUCE],
  ['fresh basil', PRODUCE],
  ['basil', PRODUCE],
  ['cilantro', PRODUCE],
  ['ginger', PRODUCE],
  ['baby spinach', PRODUCE],
  ['sweet potatoes', PRODUCE],
  ['potatoes', PRODUCE],
  ['avocados', PRODUCE],
  ['mushrooms', PRODUCE],
  ['carrots', PRODUCE],
  ['green beans', PRODUCE],
  ['brussels sprouts', PRODUCE],
  ['asparagus', PRODUCE],
  ['blueberries', PRODUCE],
  // Bakery
  ['bread', BAKERY],
  ['hamburger buns', BAKERY],
  ['flour tortillas', BAKERY],
  ['corn tortillas', BAKERY],
  ['pita bread', BAKERY],
  // Meat & seafood
  ['ground beef', MEAT_SEAFOOD],
  ['bacon', MEAT_SEAFOOD],
  ['salmon fillets', MEAT_SEAFOOD],
  ['shrimp', MEAT_SEAFOOD],
  ['pork tenderloin', MEAT_SEAFOOD],
  ['italian sausage', MEAT_SEAFOOD],
  // Dairy
  ['shredded cheddar cheese', DAIRY_EGGS],
  ['parmesan', DAIRY_EGGS],
  ['greek yogurt', DAIRY_EGGS],
  ['crème fraîche', DAIRY_EGGS],
  // Deli / refrigerated
  ['firm tofu', DELI],
  ['hummus', DELI],
  ['salami', DELI],
  ['smoked salmon', DELI],
  // Grains & pasta
  ['spaghetti', GRAINS],
  ['jasmine rice', GRAINS],
  ['rice', GRAINS],
  ['quinoa', GRAINS],
  ['rolled oats', GRAINS],
  ['panko breadcrumbs', GRAINS],
  // Canned & jarred
  ['black beans', CANNED],
  ['chickpeas', CANNED],
  ['canned tuna', CANNED],
  ['tuna', CANNED],
  ['kalamata olives', CANNED],
  ['capers', CANNED],
  ['honey', CANNED],
  ['maple syrup', CANNED],
  ['red curry paste', CANNED],
  // Snacks
  ['walnuts', SNACKS],
  ['sliced almonds', SNACKS],
  ['raisins', SNACKS],
  ['dried cranberries', SNACKS],
  ['tortilla chips', SNACKS],
  // Beverages
  ['dry white wine', BEVERAGES],
  ['coffee', BEVERAGES],
  ['sparkling water', BEVERAGES],
  // Household
  ['paper towels', HOUSEHOLD],
  ['aluminum foil', HOUSEHOLD],
  ['dish soap', HOUSEHOLD],
  ['parchment paper', BAKING]
];

describe('getAisle classifies ingredients', () => {
  test('has at least 60 cases', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(60);
  });

  test.each(CASES)('%s -> %s', (name, expected) => {
    expect(getAisle(name).aisleId).toBe(expected);
  });
});

describe('getAisle behaviour', () => {
  test('returns the documented shape', () => {
    const r = getAisle('Black Pepper');
    expect(r).toEqual(
      expect.objectContaining({
        aisleId: SPICES,
        aisleName: 'Spices & Seasonings',
        order: 10,
        subcategory: 'Pepper'
      })
    );
  });

  test('is case-insensitive and whitespace tolerant', () => {
    expect(getAisle('  GARLIC   POWDER ').aisleId).toBe(SPICES);
    expect(getAisle('SoY SaUcE').aisleId).toBe(CONDIMENTS);
  });

  test('is whole-word aware', () => {
    // "pecan" contains "can"; "nutmeg" contains "nut"; "iceberg" contains "ice"
    expect(getAisle('pecans').aisleId).toBe(SNACKS);
    expect(getAisle('nutmeg').aisleId).toBe(SPICES);
    expect(getAisle('iceberg lettuce').aisleId).toBe(PRODUCE);
    expect(getAisle('pineapple').aisleId).toBe(PRODUCE);
    expect(getAisle('scallions').aisleId).toBe(PRODUCE);
  });

  test('ignores parenthetical notes', () => {
    expect(getAisle('diced tomatoes (14 oz can)').aisleId).toBe(CANNED);
    expect(getAisle('salt (to taste)').aisleId).toBe(SPICES);
  });

  test('unknown, empty and non-string inputs fall back to Household & Other', () => {
    [undefined, null, '', '   ', 'xyzzy widget'].forEach(v => {
      const r = getAisle(v);
      expect(r.aisleId).toBe(HOUSEHOLD);
      expect(r.subcategory).toBe('Other');
    });
    expect(getAisle(42).aisleId).toBe(HOUSEHOLD);
  });

  test('returned objects are copies (cache cannot be mutated)', () => {
    const a = getAisle('salt');
    a.aisleId = 'hacked';
    expect(getAisle('salt').aisleId).toBe(SPICES);
  });

  test('frozen modifier assigns frozen subcategories', () => {
    expect(getAisle('frozen spinach').subcategory).toBe('Frozen Vegetables');
    expect(getAisle('frozen mango chunks').subcategory).toBe('Frozen Fruits');
    expect(getAisle('frozen shrimp').subcategory).toBe('Frozen Meat & Seafood');
  });
});

describe('normalizeIngredientName', () => {
  test('handles ids, accents and punctuation', () => {
    expect(normalizeIngredientName('all-purpose-flour')).toBe('all purpose flour');
    expect(normalizeIngredientName('Jalapeño')).toBe('jalapeno');
    expect(normalizeIngredientName('half & half')).toBe('half and half');
    expect(normalizeIngredientName(null)).toBe('');
  });
});

describe('categorizeIngredient (back-compat)', () => {
  test('keeps { category: { name }, subcategory } shape', () => {
    const r = categorizeIngredient('garlic');
    expect(typeof r.category.name).toBe('string');
    expect(r.category.name).toBe('Produce');
    expect(r.subcategory).toBe('Vegetables');
    expect(r.category.aisleId).toBe(PRODUCE);
    expect(r.category.legacyName).toBe('Produce');
    expect(r.category.subcategories).toBe(INGREDIENT_CATEGORIES.PRODUCE.subcategories);
  });

  test('black pepper is no longer Produce', () => {
    expect(categorizeIngredient('black pepper').category.name).toBe('Spices & Seasonings');
    expect(categorizeIngredient('black pepper').category.legacyKey).toBe('PANTRY');
  });

  test('empty input still returns a usable category', () => {
    const r = categorizeIngredient('');
    expect(r.category.name).toBe('Household & Other');
    expect(r.subcategory).toBe('Other');
  });

  test('legacy helpers still work', () => {
    expect(getAllCategories()).toBe(INGREDIENT_CATEGORIES);
    expect(isValidCategory('PRODUCE', 'FRUITS')).toBe(true);
    expect(isValidCategory('PRODUCE', 'NOPE')).toBe(false);
    expect(isValidCategory('NOPE', 'FRUITS')).toBe(false);
  });
});

describe('sorting and grouping', () => {
  const items = [
    { name: 'paper towels' },
    { name: 'soy sauce' },
    { name: 'salt' },
    { name: 'garlic' },
    { name: 'eggs' },
    { name: 'basil' },
    { name: 'chicken thighs' },
    { name: 'frozen peas' }
  ];

  test('sortByAisle orders by store walk without mutating input', () => {
    const copy = [...items];
    const sorted = sortByAisle(items).map(i => i.name);
    expect(items).toEqual(copy);
    expect(sorted).toEqual([
      'basil', // Produce / Fresh Herbs
      'garlic', // Produce / Vegetables
      'chicken thighs',
      'eggs',
      'frozen peas',
      'salt',
      'soy sauce',
      'paper towels'
    ]);
  });

  test('groupByAisle returns non-empty aisles in order', () => {
    const groups = groupByAisle(items);
    expect(groups.map(g => g.aisle.id)).toEqual([
      PRODUCE,
      MEAT_SEAFOOD,
      DAIRY_EGGS,
      FROZEN,
      SPICES,
      CONDIMENTS,
      HOUSEHOLD
    ]);
    expect(groups[0].items.map(i => i.name)).toEqual(['basil', 'garlic']);
  });

  test('works with strings, custom getters and explicit aisleId', () => {
    expect(sortByAisle(['salt', 'onion'])).toEqual(['onion', 'salt']);
    expect(sortByAisle([{ ingredientId: 'salt' }, { ingredientId: 'onion' }]).map(i => i.ingredientId)).toEqual([
      'onion',
      'salt'
    ]);
    const custom = sortByAisle([{ label: 'salt' }, { label: 'onion' }], i => i.label);
    expect(custom.map(i => i.label)).toEqual(['onion', 'salt']);
    // explicit aisleId overrides classification
    const overridden = groupByAisle([{ name: 'salt', aisleId: BEVERAGES }]);
    expect(overridden[0].aisle.id).toBe(BEVERAGES);
    expect(compareByAisle('onion', 'salt')).toBeLessThan(0);
    expect(sortByAisle(undefined)).toEqual([]);
  });
});

describe('Australian / UK names and chili plurals', () => {
  test.each([
    ['chilies', 'produce'], ['red chilies', 'produce'], ['chillis', 'produce'], ['chillies', 'produce'],
    ['chilli powder', 'spices'], ['cornflour', 'baking'], ['courgette', 'produce'], ['pak choi', 'produce'],
    ['tamarind paste', 'condiments'], ['nori sheets', 'canned-jarred'], ['treacle', 'baking'], ['vegemite', 'canned-jarred'],
    ['kicap manis', 'condiments'], ['kecap manis', 'condiments'], ['sweet soy sauce', 'condiments'],
  ])('%s -> %s', (name, aisleId) => {
    expect(getAisle(name).aisleId).toBe(aisleId);
  });
});
