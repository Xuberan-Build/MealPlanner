import {
  findDuplicateRecipes,
  titleKey,
  ingredientSignature,
  jaccard,
  editDistance,
  toMillis,
  groupKey,
  linkRecipes,
} from '../findDuplicateRecipes';

const ing = (...names) => names.map((name) => ({ ingredientId: name, amount: '1', unit: 'cup' }));

const ORZO = ['chicken-breast', 'orzo', 'lemon', 'garlic', 'chicken-broth', 'spinach', 'parmesan'];
const VODKA = ['shrimp', 'penne', 'vodka', 'tomato-paste', 'heavy-cream', 'garlic', 'shallot'];
const AYAM = ['chicken-thigh', 'kecap-manis', 'garlic', 'shallot', 'coriander', 'lime'];
const SOFRITO = ['green-pepper', 'onion', 'garlic', 'cilantro', 'culantro', 'ajicitos'];

const recipe = (id, title, ingredients = [], extra = {}) => ({ id, title, ingredients: ing(...ingredients), ...extra });

describe('titleKey', () => {
  test('lowercases, strips punctuation, accents and extra spaces', () => {
    expect(titleKey('  Crème   Brûlée!! ')).toBe('creme brulee');
    expect(titleKey("Shrimp Pasta Alla Vodka")).toBe('shrimp pasta alla vodka');
  });

  test('drops filler words like "recipe", "the best", "easy", "(Copy)"', () => {
    expect(titleKey('Sofrito Recipe')).toBe('sofrito');
    expect(titleKey('The Best Sofrito')).toBe('sofrito');
    expect(titleKey('Easy Lemon Chicken Orzo')).toBe('lemon chicken orzo');
    expect(titleKey('Lemon Chicken Orzo (Copy)')).toBe('lemon chicken orzo');
    expect(titleKey('Sofrito — the best')).toBe('sofrito');
  });

  test('never strips a title down to nothing', () => {
    expect(titleKey('Recipe')).toBe('recipe');
    expect(titleKey('Easy')).toBe('easy');
    expect(titleKey('')).toBe('');
  });
});

describe('helpers', () => {
  test('ingredient signature normalises ids, names and free-text lines', () => {
    const sig = ingredientSignature({
      ingredients: [
        { ingredientId: 'garlic-cloves', amount: '3' },
        { name: 'Onions' },
        '2 cups chicken broth',
        null,
        { ingredientId: '' },
      ],
    });
    expect([...sig].sort()).toEqual(['chicken broth', 'garlic', 'onion']);
  });

  test('jaccard and edit distance', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(editDistance('ayam bakar', 'ayam bakr')).toBe(1);
    expect(editDistance('chicken soup', 'chicken curry')).toBeGreaterThan(2);
  });

  test('toMillis handles Firestore timestamps, dates, strings and junk', () => {
    expect(toMillis({ seconds: 10, nanoseconds: 5e6 })).toBe(10005);
    expect(toMillis({ toMillis: () => 42 })).toBe(42);
    expect(toMillis(new Date(1000))).toBe(1000);
    expect(toMillis('2024-01-01T00:00:00Z')).toBe(Date.parse('2024-01-01T00:00:00Z'));
    expect(toMillis('not a date')).toBeNull();
    expect(toMillis(undefined)).toBeNull();
  });
});

describe('findDuplicateRecipes', () => {
  test('returns nothing for an empty or duplicate-free book', () => {
    expect(findDuplicateRecipes([])).toEqual([]);
    expect(findDuplicateRecipes(undefined)).toEqual([]);
    expect(findDuplicateRecipes([recipe('a', 'Tacos', ['tortilla']), recipe('b', 'Pho', ['noodle'])])).toEqual([]);
  });

  test('identical copies are an exact group (Lemon Chicken Orzo x2)', () => {
    const groups = findDuplicateRecipes([
      recipe('o1', 'Lemon Chicken Orzo', ORZO),
      recipe('x', 'Tacos', ['tortilla']),
      recipe('o2', 'Lemon Chicken Orzo', ORZO),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'o1|o2', confidence: 'exact' });
    expect(groups[0].recipes.map((r) => r.id).sort()).toEqual(['o1', 'o2']);
    expect(groups[0].reason).toMatch(/Same name and identical ingredients/);
  });

  test('ingredient order, case, plurals and hyphen/space differences still match exactly', () => {
    const groups = findDuplicateRecipes([
      recipe('v1', 'Shrimp Pasta Alla Vodka', VODKA),
      { id: 'v2', title: 'shrimp pasta alla vodka', ingredients: [...VODKA].reverse().map((n) => ({ ingredientId: n.replace(/-/g, ' ') + (n === 'shallot' ? 's' : '') })) },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('exact');
  });

  test('same title with mostly the same ingredients is likely (Air Fryer Ayam Bakar)', () => {
    const groups = findDuplicateRecipes([
      recipe('a1', 'Air Fryer Ayam Bakar', AYAM),
      recipe('a2', 'Air Fryer Ayam Bakar', [...AYAM.slice(0, 5), 'sambal']),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('likely');
    expect(groups[0].reason).toMatch(/Same name, 71% of ingredients in common/);
  });

  test('filler words group "Sofrito" x2 with "Sofrito Recipe" into one group', () => {
    const groups = findDuplicateRecipes([
      recipe('s1', 'Sofrito', SOFRITO),
      recipe('s2', 'Sofrito', SOFRITO),
      recipe('s3', 'Sofrito Recipe', SOFRITO),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('s1|s2|s3');
    expect(groups[0].confidence).toBe('exact');
  });

  test('a stub copy with no ingredients is grouped as likely', () => {
    const groups = findDuplicateRecipes([recipe('s1', 'Sofrito', SOFRITO), recipe('s2', 'Sofrito Recipe', [])]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('likely');
    expect(groups[0].suggestedKeepId).toBe('s1');
    expect(groups[0].reason).toMatch(/one copy has no ingredients/);
  });

  test('two same-titled copies with no ingredients at all are exact', () => {
    const groups = findDuplicateRecipes([recipe('n1', 'Overnight Oats'), recipe('n2', 'Overnight oats')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('exact');
  });

  test('same title but different ingredients (Jaccard < 0.6) is not grouped', () => {
    const groups = findDuplicateRecipes([
      recipe('c1', 'Curry', ['chicken', 'coconut-milk', 'curry-paste', 'basil']),
      recipe('c2', 'Curry', ['lamb', 'yogurt', 'garam-masala', 'basil']),
    ]);
    expect(groups).toEqual([]);
  });

  test('a typo in the title with near-identical ingredients is likely', () => {
    const groups = findDuplicateRecipes([
      recipe('t1', 'Air Fryer Ayam Bakar', AYAM),
      recipe('t2', 'Air Fryer Ayam Bakr', AYAM),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('likely');
    expect(groups[0].reason).toMatch(/Nearly the same name/);
  });

  test('a typo in the title is not enough when ingredients differ (< 0.8)', () => {
    const groups = findDuplicateRecipes([
      recipe('t1', 'Air Fryer Ayam Bakar', AYAM),
      recipe('t2', 'Air Fryer Ayam Bakr', [...AYAM.slice(0, 4), 'sambal', 'rice']),
    ]);
    expect(groups).toEqual([]);
  });

  test('false-positive trap: Chicken Soup vs Chicken Curry', () => {
    const shared = ['chicken-breast', 'onion', 'garlic', 'carrot', 'celery'];
    expect(findDuplicateRecipes([recipe('a', 'Chicken Soup', shared), recipe('b', 'Chicken Curry', shared)])).toEqual([]);
  });

  test('false-positive traps: shared title words or short titles one letter apart', () => {
    const groups = findDuplicateRecipes([
      recipe('a', 'Lemon Chicken Orzo', ORZO),
      recipe('b', 'Lemon Chicken', ORZO.slice(0, 5)),
      recipe('c', 'Beef Tacos', ['beef', 'tortilla', 'salsa']),
      recipe('d', 'Fish Tacos', ['beef', 'tortilla', 'salsa']),
      recipe('e', 'Pho', ['noodle', 'beef']),
      recipe('f', 'Poh', ['noodle', 'beef']),
      recipe('g', 'Shrimp Pasta Alla Vodka', VODKA),
      recipe('h', 'Penne Alla Vodka', VODKA.filter((n) => n !== 'shrimp')),
    ]);
    expect(groups).toEqual([]);
  });

  test('never groups a plate with a recipe, but does group plates with plates', () => {
    const groups = findDuplicateRecipes([
      recipe('r1', 'Chicken Bowl', ['chicken', 'rice']),
      recipe('p1', 'Chicken Bowl', ['chicken', 'rice'], { kind: 'plate' }),
      recipe('p2', 'Chicken Bowl', ['chicken', 'rice'], { kind: 'plate' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('p1|p2');
  });

  test('recipes without an id, or repeated ids, are ignored', () => {
    const groups = findDuplicateRecipes([
      recipe('o1', 'Lemon Chicken Orzo', ORZO),
      recipe('o1', 'Lemon Chicken Orzo', ORZO),
      { title: 'Lemon Chicken Orzo', ingredients: ing(...ORZO) },
    ]);
    expect(groups).toEqual([]);
  });

  test('keeps the most complete copy and says why', () => {
    const groups = findDuplicateRecipes([
      recipe('bare', 'Lemon Chicken Orzo', ORZO, { updatedAt: { seconds: 2000 } }),
      recipe('full', 'Lemon Chicken Orzo', ORZO, { instructions: 'Cook it.', imageUrl: 'x.jpg', servings: '4', updatedAt: { seconds: 1000 } }),
    ]);
    expect(groups[0].suggestedKeepId).toBe('full');
    expect(groups[0].recipes[0].id).toBe('full');
    expect(groups[0].reason).toMatch(/Suggest keeping "Lemon Chicken Orzo" because it is the most complete \(instructions, a photo, servings and 7 ingredients\)/);
  });

  test('more ingredients wins when otherwise equally complete', () => {
    const groups = findDuplicateRecipes([
      recipe('few', 'Air Fryer Ayam Bakar', AYAM.slice(0, 5), { instructions: ['Grill'] }),
      recipe('more', 'Air Fryer Ayam Bakar', AYAM, { instructions: ['Grill'] }),
    ]);
    expect(groups[0].suggestedKeepId).toBe('more');
  });

  test('tie on completeness -> most recently updated', () => {
    const groups = findDuplicateRecipes([
      recipe('old', 'Sofrito', SOFRITO, { updatedAt: '2024-01-01', instructions: 'Blend' }),
      recipe('new', 'Sofrito', SOFRITO, { updatedAt: '2025-06-01', instructions: 'Blend' }),
    ]);
    expect(groups[0].suggestedKeepId).toBe('new');
    expect(groups[0].reason).toMatch(/updated most recently/);
  });

  test('tie on completeness and update -> oldest created (the original)', () => {
    const groups = findDuplicateRecipes([
      recipe('copy', 'Sofrito', SOFRITO, { createdAt: { seconds: 500 } }),
      recipe('orig', 'Sofrito', SOFRITO, { createdAt: { seconds: 100 } }),
    ]);
    expect(groups[0].suggestedKeepId).toBe('orig');
    expect(groups[0].reason).toMatch(/created first/);
  });

  test('full tie -> lowest id, so the result is deterministic', () => {
    const groups = findDuplicateRecipes([recipe('b', 'Sofrito', SOFRITO), recipe('a', 'Sofrito', SOFRITO)]);
    expect(groups[0].suggestedKeepId).toBe('a');
  });

  test('output order is deterministic regardless of input order', () => {
    const list = [
      recipe('v1', 'Shrimp Pasta Alla Vodka', VODKA),
      recipe('o2', 'Lemon Chicken Orzo', ORZO),
      recipe('a1', 'Air Fryer Ayam Bakar', AYAM),
      recipe('s1', 'Sofrito', SOFRITO),
      recipe('o1', 'Lemon Chicken Orzo', ORZO),
      recipe('a2', 'Air Fryer Ayam Bakar', AYAM),
      recipe('v2', 'Shrimp Pasta Alla Vodka', VODKA),
      recipe('s2', 'Sofrito Recipe', SOFRITO),
      recipe('z', 'Tacos', ['tortilla']),
    ];
    const forward = findDuplicateRecipes(list);
    const backward = findDuplicateRecipes([...list].reverse());
    expect(forward).toEqual(backward);
    expect(forward.map((g) => g.key)).toEqual(['a1|a2', 'o1|o2', 'v1|v2', 's1|s2']);
  });

  test('groupKey sorts ids', () => {
    expect(groupKey(['b', 'a', 'c'])).toBe('a|b|c');
  });
});

describe('linkRecipes (direct, per-pair link)', () => {
  const full1 = recipe('c1', 'Curry', ['chicken', 'coconut-milk', 'curry-paste', 'basil']);
  const full2 = recipe('c2', 'Curry', ['lamb', 'yogurt', 'garam-masala', 'basil']);
  const stub = recipe('c3', 'Curry Recipe', []);

  test('exact, likely and unrelated pairs', () => {
    expect(linkRecipes(recipe('a', 'Sofrito', SOFRITO), recipe('b', 'Sofrito Recipe', SOFRITO))).toBe('exact');
    expect(linkRecipes(full1, stub)).toBe('likely');
    expect(linkRecipes(recipe('a', 'Air Fryer Ayam Bakar', AYAM), recipe('b', 'Air Fryer Ayam Bakr', AYAM))).toBe('likely');
    expect(linkRecipes(recipe('a', 'Chicken Soup', ORZO), recipe('b', 'Chicken Curry', ORZO))).toBeNull();
  });

  test('members joined only through a stub are grouped but not directly linked', () => {
    const groups = findDuplicateRecipes([full1, full2, stub]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('c1|c2|c3');
    expect(linkRecipes(full1, full2)).toBeNull();
    expect(linkRecipes(full2, stub)).toBe('likely');
  });

  test('never links a plate to a recipe, a recipe to itself, or missing input', () => {
    expect(linkRecipes(full1, { ...full1, id: 'p', kind: 'plate' })).toBeNull();
    expect(linkRecipes(full1, full1)).toBeNull();
    expect(linkRecipes(full1, null)).toBeNull();
  });
});
