import {
  CANONICAL_DIET_TYPES,
  KNOWN_CUISINES,
  canonicalDietType,
  dietTypeKey,
  isBlankDietType,
  isCanonicalDietType,
  normalizeDietTypeList,
  normalizeRecipeDietTypes,
} from '../normalize';

describe('canonicalDietType', () => {
  test.each([
    ['vegan', 'Vegan'],
    ['Vegan ', 'Vegan'],
    ['VEGAN', 'Vegan'],
    ['  vEgAn  ', 'Vegan'],
    ['Vegetarian', 'Vegetarian'],
    ['veg', 'Vegetarian'],
    ['Veggie', 'Vegetarian'],
    ['Vegatarian', 'Vegetarian'],
    ['vegeterian', 'Vegetarian'],
    ['pescetarian', 'Pescatarian'],
    ['Keto', 'Keto'],
    ['ketogenic', 'Keto'],
    ['Keto Diet', 'Keto'],
    ['paleo', 'Paleo'],
    ['Whole 30', 'Whole30'],
    ['whole30', 'Whole30'],
    ['Gluten Free', 'Gluten-Free'],
    ['gluten-free', 'Gluten-Free'],
    ['GLUTEN  FREE', 'Gluten-Free'],
    ['glutenfree', 'Gluten-Free'],
    ['GF', 'Gluten-Free'],
    ['gf', 'Gluten-Free'],
    ['dairy free', 'Dairy-Free'],
    ['DF', 'Dairy-Free'],
    ['non-dairy', 'Dairy-Free'],
    ['low carb', 'Low-Carb'],
    ['Low-Carb', 'Low-Carb'],
    ['lowcarb', 'Low-Carb'],
    ['low fat', 'Low-Fat'],
    ['high protein', 'High-Protein'],
    ['mediterranean diet', 'Mediterranean'],
    ['halal', 'Halal'],
    ['KOSHER', 'Kosher'],
    ['nut free', 'Nut-Free'],
    ['diabetic', 'Diabetic-Friendly'],
    ['Diabetic Friendly', 'Diabetic-Friendly'],
    ['fmd', 'FMD'],
    ['FMD', 'FMD'],
    ['Fasting Mimicking Diet', 'FMD'],
    ['fasting-mimicking', 'FMD'],
  ])('%p -> %p', (input, expected) => {
    expect(canonicalDietType(input)).toBe(expected);
  });

  test('blank-ish values are null', () => {
    for (const v of ['', '   ', 'Not Specified', 'not specified', 'NOT  SPECIFIED', 'none', 'None', 'N/A', 'n/a', '-', 'Uncategorized', null, undefined, {}, 42 && false]) {
      expect(canonicalDietType(v)).toBeNull();
    }
    expect(isBlankDietType('Not Specified')).toBe(true);
    expect(isBlankDietType('Vegan')).toBe(false);
  });

  test('cuisines are kept and title-cased', () => {
    expect(canonicalDietType('italian')).toBe('Italian');
    expect(canonicalDietType('puerto rican')).toBe('Puerto Rican');
    expect(canonicalDietType('PUERTO RICAN')).toBe('Puerto Rican');
    expect(canonicalDietType('Puerto-Rican')).toBe('Puerto Rican');
    expect(canonicalDietType('mexican')).toBe('Mexican');
    expect(canonicalDietType('Indonesian ')).toBe('Indonesian');
    expect(canonicalDietType('haitian')).toBe('Haitian');
    expect(KNOWN_CUISINES).toEqual(['Italian', 'Puerto Rican', 'Mexican', 'Indonesian', 'Haitian']);
    // Cuisines are recognised but are not curated diets.
    expect(isCanonicalDietType('Italian')).toBe(false);
  });

  test('unknown custom types are kept, title-cased, hyphenation normalized', () => {
    expect(canonicalDietType('sugar free')).toBe('Sugar-Free');
    expect(canonicalDietType('Sugar-free')).toBe('Sugar-Free');
    expect(canonicalDietType('low sodium')).toBe('Low-Sodium');
    expect(canonicalDietType('lactose free')).toBe('Lactose-Free'); // NOT Dairy-Free
    expect(canonicalDietType('kid friendly')).toBe('Kid-Friendly');
    expect(canonicalDietType('soul food')).toBe('Soul Food');
    expect(canonicalDietType('arroz con pollo night')).toBe('Arroz con Pollo Night');
    expect(canonicalDietType('my   mom_s  recipes')).toBe('My Mom S Recipes');
    expect(canonicalDietType("grandma's")).toBe("Grandma's");
    expect(canonicalDietType('gluten - free-ish')).toBe('Gluten-Free-Ish');
  });

  test('acronyms the user typed are preserved', () => {
    expect(canonicalDietType('AIP')).toBe('AIP');
    expect(canonicalDietType('Low FODMAP')).toBe('Low-FODMAP');
    expect(canonicalDietType('BBQ night')).toBe('BBQ Night');
    // All-caps shouting of ordinary words is not an acronym.
    expect(canonicalDietType('SOUL FOOD')).toBe('Soul Food');
    expect(canonicalDietType('THAI')).toBe('Thai');
  });

  test('accepts { name } objects', () => {
    expect(canonicalDietType({ name: ' vegan' })).toBe('Vegan');
  });

  test('is idempotent', () => {
    const inputs = ['vegan', 'GF', 'sugar free', 'Low FODMAP', 'puerto rican', 'soul food', 'AIP', 'Vegatarian'];
    for (const v of inputs) {
      const once = canonicalDietType(v);
      expect(canonicalDietType(once)).toBe(once);
    }
    for (const name of CANONICAL_DIET_TYPES) expect(canonicalDietType(name)).toBe(name);
  });
});

describe('dietTypeKey', () => {
  test('lowercase alphanumerics of the canonical name', () => {
    expect(dietTypeKey('Gluten-Free')).toBe('glutenfree');
    expect(dietTypeKey('Whole30')).toBe('whole30');
    expect(dietTypeKey('Puerto Rican')).toBe('puertorican');
  });

  test('variants share a key', () => {
    const same = (...vals) => expect(new Set(vals.map(dietTypeKey)).size).toBe(1);
    same('vegan', 'Vegan ', 'VEGAN');
    same('Gluten Free', 'gluten-free', 'GF', 'glutenfree');
    same('Keto', 'ketogenic');
    same('Veg', 'Vegetarian', 'Vegatarian');
    same('Sugar Free', 'sugar-free', 'Sugarfree');
  });

  test('different diets have different keys', () => {
    expect(dietTypeKey('Vegan')).not.toBe(dietTypeKey('Vegetarian'));
    expect(dietTypeKey('Lactose Free')).not.toBe(dietTypeKey('Dairy Free'));
  });

  test('blank is empty string', () => {
    expect(dietTypeKey('Not Specified')).toBe('');
    expect(dietTypeKey('')).toBe('');
    expect(dietTypeKey(null)).toBe('');
  });

  test('non-latin text still gets a key', () => {
    expect(dietTypeKey('素食')).toBe('素食');
    expect(dietTypeKey('Végétarien')).toBe('vegetarien');
  });
});

describe('normalizeDietTypeList', () => {
  test('canonicalizes, dedupes by key, drops blanks, keeps order', () => {
    expect(normalizeDietTypeList(['vegan', 'GF', 'Vegan ', 'Not Specified', 'gluten free', { name: 'keto' }]))
      .toEqual(['Vegan', 'Gluten-Free', 'Keto']);
    expect(normalizeDietTypeList(null)).toEqual([]);
    expect(normalizeDietTypeList('vegan')).toEqual(['Vegan']);
  });
});

describe('normalizeRecipeDietTypes', () => {
  test('legacy string only', () => {
    expect(normalizeRecipeDietTypes({ dietType: 'vegan ' })).toEqual({ dietType: 'Vegan', dietTypes: ['Vegan'] });
    expect(normalizeRecipeDietTypes({ dietType: 'Not Specified' })).toEqual({ dietType: null, dietTypes: [] });
    expect(normalizeRecipeDietTypes({})).toEqual({ dietType: null, dietTypes: [] });
    expect(normalizeRecipeDietTypes(null)).toEqual({ dietType: null, dietTypes: [] });
  });

  test('legacy array value', () => {
    expect(normalizeRecipeDietTypes({ dietType: ['keto', 'GF'] })).toEqual({ dietType: 'Keto', dietTypes: ['Keto', 'Gluten-Free'] });
  });

  test('array only', () => {
    expect(normalizeRecipeDietTypes({ dietTypes: ['gf', 'Vegan', 'vegan'] }))
      .toEqual({ dietType: 'Gluten-Free', dietTypes: ['Gluten-Free', 'Vegan'] });
  });

  test('legacy is primary when it is in the array', () => {
    expect(normalizeRecipeDietTypes({ dietType: 'VEGAN', dietTypes: ['GF', 'vegan'] }))
      .toEqual({ dietType: 'Vegan', dietTypes: ['Gluten-Free', 'Vegan'] });
  });

  test('array wins over a stale legacy value', () => {
    expect(normalizeRecipeDietTypes({ dietType: 'Vegan', dietTypes: ['Keto'] }))
      .toEqual({ dietType: 'Keto', dietTypes: ['Keto'] });
  });

  test('empty array falls back to legacy', () => {
    expect(normalizeRecipeDietTypes({ dietType: 'GF', dietTypes: [] }))
      .toEqual({ dietType: 'Gluten-Free', dietTypes: ['Gluten-Free'] });
    expect(normalizeRecipeDietTypes({ dietType: 'Haitian', dietTypes: ['Not Specified', ''] }))
      .toEqual({ dietType: 'Haitian', dietTypes: ['Haitian'] });
  });
});
