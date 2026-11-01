import {
  damerauLevenshtein,
  highlightMatch,
  searchDietTypeItems,
  suggestDietTypes,
} from '../suggest';

const names = (result) => result.suggestions.map((s) => s.name);
const first = (result) => result.suggestions[0];

describe('damerauLevenshtein', () => {
  test('edits and transpositions', () => {
    expect(damerauLevenshtein('keto', 'keto')).toBe(0);
    expect(damerauLevenshtein('vegatarian', 'vegetarian')).toBe(1);
    expect(damerauLevenshtein('italain', 'italian')).toBe(1); // swap
    expect(damerauLevenshtein('glutnfree', 'glutenfree')).toBe(1);
    expect(damerauLevenshtein('', 'abc')).toBe(3);
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('suggestDietTypes', () => {
  const userTypes = ['Italian', 'Haitian', 'Puerto Rican', 'vegan ', { name: 'Sugar-Free' }];

  test('empty query lists user + canonical types, deduped by key, alphabetically', () => {
    const result = suggestDietTypes('', userTypes, { limit: Infinity });
    const list = names(result);
    expect(list).toContain('Vegan');
    expect(list).toContain('Italian');
    expect(list).toContain('FMD');
    expect(list.filter((n) => n === 'Vegan')).toHaveLength(1);
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b)));
    expect(result.showCreate).toBe(false);
  });

  test('exact match ranks first, no create, no did-you-mean', () => {
    const result = suggestDietTypes('vegan', userTypes);
    expect(first(result)).toEqual({ name: 'Vegan', reason: 'exact', isNew: false });
    expect(result.exactMatch).toBe('Vegan');
    expect(result.showCreate).toBe(false);
    expect(result.didYouMean).toBeNull();
  });

  test('alias match: GF -> Gluten-Free, ketogenic -> Keto, veg -> Vegetarian', () => {
    // Common misspellings in the alias table are treated as the type itself.
    expect(suggestDietTypes('Vegatarian', []).exactMatch).toBe('Vegetarian');
    expect(first(suggestDietTypes('GF', []))).toMatchObject({ name: 'Gluten-Free', reason: 'alias' });
    expect(first(suggestDietTypes('ketogenic', []))).toMatchObject({ name: 'Keto', reason: 'alias' });
    expect(first(suggestDietTypes('fasting mimicking', []))).toMatchObject({ name: 'FMD', reason: 'alias' });
    const veg = suggestDietTypes('veg', []);
    expect(names(veg).slice(0, 2)).toEqual(['Vegetarian', 'Vegan']);
    expect(veg.exactMatch).toBe('Vegetarian');
    expect(veg.showCreate).toBe(false);
  });

  test('partial alias: "ketog" still suggests Keto', () => {
    expect(first(suggestDietTypes('ketog', []))).toMatchObject({ name: 'Keto', reason: 'alias' });
  });

  test('ranking order: exact > alias > prefix > word-start > substring > fuzzy', () => {
    const known = ['Free Range', 'Gluten-Free', 'Carefree Cooking', 'Fre'];
    const result = suggestDietTypes('fre', known, { limit: 20, includeCanonical: false });
    expect(result.suggestions.map((s) => [s.name, s.reason])).toEqual([
      ['Fre', 'exact'],
      ['Free Range', 'prefix'],
      ['Gluten-Free', 'word-start'],
      ['Carefree Cooking', 'substring'],
    ]);

    const fuzzy = suggestDietTypes('pal', ['Paleo', 'Pal'], { includeCanonical: false });
    expect(fuzzy.suggestions.map((s) => s.reason)).toEqual(['exact', 'prefix']);
  });

  test('prefix ties break by shorter name', () => {
    expect(names(suggestDietTypes('low', [])).slice(0, 2)).toEqual(['Low-Fat', 'Low-Carb']);
  });

  test('user types win ties against canonical-only types', () => {
    const result = suggestDietTypes('h', ['Haitian'], { limit: 3 });
    expect(first(result).name).toBe('Haitian');
  });

  test('typos produce didYouMean and no create', () => {
    for (const [typo, expected] of [
      ['vegetaryan', 'Vegetarian'],
      ['vegitarain', 'Vegetarian'],
      ['glutn free', 'Gluten-Free'],
      ['meditteranean', 'Mediterranean'],
      ['pesacatarian', 'Pescatarian'],
      ['ketto', 'Keto'],
      ['Italain', 'Italian'],
    ]) {
      const result = suggestDietTypes(typo, ['Italian']);
      expect([typo, result.didYouMean]).toEqual([typo, expected]);
      expect(result.showCreate).toBe(false);
      expect(result.suggestions.some((s) => s.isNew)).toBe(false);
    }
  });

  test('short terms allow only one edit', () => {
    // "kale" is 2 edits from "keto": not suggested.
    const result = suggestDietTypes('kale', []);
    expect(result.didYouMean).toBeNull();
    expect(result.showCreate).toBe(true);
  });

  test('create appears only when nothing is close', () => {
    const result = suggestDietTypes('soul food', ['Italian']);
    expect(result.showCreate).toBe(true);
    expect(result.createName).toBe('Soul Food');
    expect(result.suggestions[result.suggestions.length - 1]).toEqual({ name: 'Soul Food', reason: 'new', isNew: true });

    // A prefix match is close enough: no create while typing "Ital".
    expect(suggestDietTypes('Ital', ['Italian']).showCreate).toBe(false);
  });

  test('create name is canonical', () => {
    expect(suggestDietTypes('  sugar   free ', []).createName).toBe('Sugar-Free');
  });

  test('blank-ish query offers nothing to create', () => {
    const result = suggestDietTypes('Not Specified', []);
    expect(result.showCreate).toBe(false);
    expect(result.createName).toBeNull();
  });

  test('limit caps matched suggestions', () => {
    const result = suggestDietTypes('e', [], { limit: 3 });
    expect(result.suggestions.filter((s) => !s.isNew)).toHaveLength(3);
  });

  test('user variants of a canonical type show the canonical name once', () => {
    const result = suggestDietTypes('veg', ['vegan', 'VEGAN', 'Vegan '], { limit: 10 });
    expect(names(result).filter((n) => /^vegan$/i.test(n))).toEqual(['Vegan']);
  });

  test('plain mode (canonicalize: false) does no aliasing', () => {
    const result = suggestDietTypes('din', ['Dinner', 'Lunch', 'breakfast'], { canonicalize: false, includeCanonical: false });
    expect(names(result)).toEqual(['Dinner']);
    const create = suggestDietTypes('gf', ['Dinner'], { canonicalize: false, includeCanonical: false });
    expect(create.createName).toBe('gf');
    expect(create.showCreate).toBe(true);
    // Lowercase options are kept as-is.
    expect(names(suggestDietTypes('break', ['breakfast'], { canonicalize: false, includeCanonical: false }))).toEqual(['breakfast']);
  });
});

describe('searchDietTypeItems', () => {
  test('returns original items ranked, filtering non-matches', () => {
    const items = [{ id: 'a', name: 'Low-Carb' }, { id: 'b', name: 'Vegan' }, { id: 'c', name: 'Keto' }];
    expect(searchDietTypeItems('carb', items).map((i) => i.id)).toEqual(['a']);
    expect(searchDietTypeItems('VEGAN', items).map((i) => i.id)).toEqual(['b']);
    expect(searchDietTypeItems('', items)).toBe(items);
  });

  test('works with strings', () => {
    // "vega" is a prefix of Vegan and one typo from "vege(tarian)".
    expect(searchDietTypeItems('vega', ['Vegetarian', 'Vegan', 'Keto'])).toEqual(['Vegan', 'Vegetarian']);
  });
});

describe('highlightMatch', () => {
  test('marks the matching part, preferring word starts', () => {
    expect(highlightMatch('Gluten-Free', 'free')).toEqual([
      { text: 'Gluten-', match: false },
      { text: 'Free', match: true },
    ]);
    expect(highlightMatch('Vegetarian', 'VEG')).toEqual([
      { text: 'Veg', match: true },
      { text: 'etarian', match: false },
    ]);
    expect(highlightMatch('Gluten-Free', 'gluten free')).toEqual([{ text: 'Gluten-Free', match: true }]);
  });

  test('no match returns the plain name', () => {
    expect(highlightMatch('Keto', 'xyz')).toEqual([{ text: 'Keto', match: false }]);
    expect(highlightMatch('Keto', '')).toEqual([{ text: 'Keto', match: false }]);
  });
});
