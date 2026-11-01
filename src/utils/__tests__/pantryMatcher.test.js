import {
  annotateWithPantry,
  isPantryMatch,
  findPantryMatch,
  pantryKey,
  summarizePantryStatus,
  needParts,
  matchScore,
} from '../pantryMatcher';

const one = (item, pantry) => annotateWithPantry([item], pantry)[0];

describe('isPantryMatch - matches the same product', () => {
  test.each([
    ['olive oil', 'olive oil'],
    ['Olive Oil', 'olive oil'],
    ['extra virgin olive oil', 'olive oil'],
    ['olive oil', 'extra-virgin olive oil'],
    ['kosher salt', 'salt'],
    ['sea salt', 'salt'],
    ['salt', 'kosher salt'],
    ['Eggs', 'egg'],
    ['large eggs', 'eggs'],
    ['garlic cloves', 'garlic'],
    ['Garlic', 'garlic, minced'],
    ['all-purpose flour', 'flour'],
    ['all purpose flour', 'all-purpose flour'],
    ['ground black pepper', 'black pepper'],
    ['black pepper', 'pepper'],
    ['freshly ground black pepper', 'pepper'],
    ['unsalted butter', 'butter'],
    ['granulated sugar', 'sugar'],
    ['white sugar', 'granulated sugar'],
    ['boneless skinless chicken breasts', 'chicken breast'],
    ['low sodium soy sauce', 'soy sauce'],
    ['tomatoes', 'tomato'],
    ['ground cinnamon', 'cinnamon'],
    ['whole milk', 'milk'],
    ['scallions', 'green onions'],
  ])('%s ~ %s', (a, b) => {
    expect(isPantryMatch(a, b)).toBe(true);
  });
});

describe('isPantryMatch - never matches a different product', () => {
  test.each([
    ['garlic powder', 'garlic'],
    ['garlic', 'garlic powder'],
    ['peanut butter', 'butter'],
    ['butter', 'peanut butter'],
    ['coconut milk', 'milk'],
    ['milk', 'coconut milk'],
    ['almond milk', 'milk'],
    ['onion powder', 'onion'],
    ['brown sugar', 'sugar'],
    ['powdered sugar', 'sugar'],
    ['bread flour', 'all-purpose flour'],
    ['whole wheat flour', 'flour'],
    ['ground ginger', 'ginger'],
    ['ground beef', 'ground turkey'],
    ['sesame oil', 'olive oil'],
    ['red bell pepper', 'black pepper'],
    ['bell peppers', 'pepper'],
    ['chicken broth', 'chicken'],
    ['chicken thighs', 'chicken breast'],
    ['cream cheese', 'cream'],
    ['sour cream', 'cream'],
    ['egg noodles', 'eggs'],
    ['dried cranberries', 'cranberries'],
    ['baking soda', 'baking powder'],
    ['lemon juice', 'lemon'],
    ['', 'salt'],
    ['salt', ''],
  ])('%s !~ %s', (a, b) => {
    expect(isPantryMatch(a, b)).toBe(false);
  });
});

describe('findPantryMatch', () => {
  const pantry = [
    { id: 'a', name: 'olive oil', isStaple: true },
    { id: 'b', name: 'extra virgin olive oil' },
    { id: 'c', name: 'butter' },
  ];
  test('prefers exact key', () => {
    expect(findPantryMatch({ name: 'Extra Virgin Olive Oil' }, pantry).id).toBe('b');
    expect(findPantryMatch({ name: 'olive oil' }, pantry).id).toBe('a');
  });
  test('reads ingredientId when there is no name', () => {
    expect(findPantryMatch({ ingredientId: 'unsalted-butter' }, pantry).id).toBe('c');
  });
  test('no match / bad input', () => {
    expect(findPantryMatch({ name: 'peanut butter' }, pantry)).toBeNull();
    expect(findPantryMatch({ name: 'x' }, [])).toBeNull();
    expect(findPantryMatch({ name: 'x' }, null)).toBeNull();
    expect(findPantryMatch({}, pantry)).toBeNull();
  });
});

describe('annotateWithPantry - statuses', () => {
  test('no pantry match => need', () => {
    const r = one({ name: 'Basil', quantity: 1, unit: 'bunch' }, [{ name: 'salt' }]);
    expect(r.pantryStatus).toBe('need');
    expect(r.pantryMatch).toBeNull();
    expect(r.needsCheck).toBe(false);
  });

  test('staple => have regardless of quantity', () => {
    const r = one({ name: 'kosher salt', quantity: 2, unit: 'tbsp' }, [{ name: 'salt', isStaple: true, quantity: 1, unit: 'tsp' }]);
    expect(r.pantryStatus).toBe('have');
    expect(r.pantryMatch.name).toBe('salt');
    expect(r.needsCheck).toBe(false);
  });

  test('staple explicitly run out (quantity 0) => need', () => {
    const r = one({ name: 'salt', quantity: 1, unit: 'tsp' }, [{ name: 'salt', isStaple: true, quantity: 0 }]);
    expect(r.pantryStatus).toBe('need');
    expect(r.pantryMatch.name).toBe('salt');
  });

  test('pantry item without quantity => have', () => {
    const r = one({ name: 'Rice', quantity: 2, unit: 'cups' }, [{ name: 'rice', quantity: null, unit: null }]);
    expect(r.pantryStatus).toBe('have');
    expect(r.needsCheck).toBe(false);
  });

  test('pantry quantity 0 (ran out) => need', () => {
    const r = one({ name: 'Rice', quantity: 2, unit: 'cups' }, [{ name: 'rice', quantity: 0, unit: 'cup' }]);
    expect(r.pantryStatus).toBe('need');
    expect(r.pantryMatch.name).toBe('rice');
  });

  test('enough in compatible unit => have', () => {
    const r = one({ name: 'milk', quantity: 1, unit: 'cup' }, [{ name: 'milk', quantity: 1, unit: 'quart' }]);
    expect(r.pantryStatus).toBe('have');
  });

  test('exactly enough => have', () => {
    const r = one({ name: 'eggs', quantity: 6, unit: '' }, [{ name: 'egg', quantity: 6, unit: null }]);
    expect(r.pantryStatus).toBe('have');
  });

  test('not enough => partial with remaining text', () => {
    const r = one({ name: 'flour', quantity: 3, unit: 'cups' }, [{ name: 'all-purpose flour', quantity: 2, unit: 'cup' }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.remainingQuantityText).toBe('1 cup');
    expect(r.remainingQuantity[0].value).toBeCloseTo(1);
  });

  test('partial across volume units', () => {
    const r = one({ name: 'olive oil', quantity: 1, unit: 'cup' }, [{ name: 'olive oil', quantity: 8, unit: 'tbsp' }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.remainingQuantityText).toBe('1/2 cup');
  });

  test('partial across weight units', () => {
    const r = one({ name: 'chicken breast', quantity: 2, unit: 'lb' }, [{ name: 'chicken breast', quantity: 500, unit: 'g' }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.remainingQuantity[0].unit).toBe('lb');
  });

  test('count partial', () => {
    const r = one({ name: 'eggs', quantity: 12 }, [{ name: 'eggs', quantity: 4 }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.remainingQuantityText).toBe('8');
  });

  test('incompatible units => partial (stays to buy) with needsCheck and the full need', () => {
    const r = one({ name: 'flour', quantity: 2, unit: 'cups' }, [{ name: 'flour', quantity: 1, unit: 'kg' }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.needsCheck).toBe(true);
    expect(r.remainingQuantityText).toBe('2 cups');
  });

  test('count vs different count unit => partial with needsCheck', () => {
    const r = one({ name: 'tomato paste', quantity: 2, unit: 'tbsp' }, [{ name: 'tomato paste', quantity: 1, unit: 'can' }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.needsCheck).toBe(true);
  });

  test('unitless pantry count vs a weight need stays to buy', () => {
    const r = one({ name: 'chicken breast', quantity: 500, unit: 'g' }, [{ name: 'chicken breast', quantity: 1 }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.needsCheck).toBe(true);
    expect(r.remainingQuantityText).toBe('500 g');
  });

  test('to-taste item matched in pantry => have', () => {
    const r = one({ name: 'salt', quantity: 'to taste', unit: '' }, [{ name: 'salt', quantity: 10, unit: 'g' }]);
    expect(r.pantryStatus).toBe('have');
    expect(r.needsCheck).toBe(false);
  });

  test('blank amount matched in pantry => have', () => {
    const r = one({ name: 'Black Pepper', quantity: '', unit: '' }, [{ name: 'pepper', quantity: 1, unit: 'jar' }]);
    expect(r.pantryStatus).toBe('have');
  });

  test('to-taste item not in pantry => need', () => {
    const r = one({ name: 'salt', isToTaste: true }, []);
    expect(r.pantryStatus).toBe('need');
  });

  test('uses item.parts when present (mixed parts)', () => {
    const item = {
      name: 'butter',
      parts: [
        { value: 0.5, unit: 'cup', category: 'volume' },
        { value: 100, unit: 'g', category: 'weight' },
      ],
    };
    const r = one(item, [{ name: 'butter', quantity: 1, unit: 'cup' }]);
    // the cup part is covered, the 100 g can't be compared: still to buy, nothing dropped
    expect(r.pantryStatus).toBe('partial');
    expect(r.needsCheck).toBe(true);
    expect(r.remainingQuantityText).toBe('100 g');
  });

  test('partial keeps every part it could not subtract', () => {
    const flour = one({ name: 'flour', parts: [
      { value: 2, unit: 'cup', category: 'volume' },
      { value: 100, unit: 'g', category: 'weight' },
    ] }, [{ name: 'flour', quantity: 1, unit: 'cup' }]);
    expect(flour.pantryStatus).toBe('partial');
    expect(flour.remainingQuantityText).toBe('1 cup + 100 g');

    const garlic = one({ name: 'garlic', parts: [
      { value: 4, unit: 'clove', category: 'count' },
      { value: 2, unit: 'head', category: 'count' },
    ] }, [{ name: 'garlic', quantity: 1, unit: 'head' }]);
    expect(garlic.pantryStatus).toBe('partial');
    expect(garlic.remainingQuantityText).toBe('4 cloves + 1 head');

    const butter = one({ name: 'butter', parts: [
      { value: 2, unit: 'stick', category: 'count' },
      { value: 0.25, unit: 'cup', category: 'volume' },
    ] }, [{ name: 'butter', quantity: 1, unit: 'cup' }]);
    expect(butter.pantryStatus).toBe('partial');
    expect(butter.needsCheck).toBe(true);
    expect(butter.remainingQuantityText).toBe('2 sticks');
  });

  test('string quantities are parsed ("1 1/2")', () => {
    const r = one({ name: 'sugar', quantity: '1 1/2', unit: 'cups' }, [{ name: 'sugar', quantity: '1', unit: 'cup' }]);
    expect(r.pantryStatus).toBe('partial');
    expect(r.remainingQuantityText).toBe('1/2 cup');
  });

  test('never-match traps produce need', () => {
    const pantry = [{ name: 'garlic' }, { name: 'butter' }, { name: 'milk' }];
    const out = annotateWithPantry(
      [{ name: 'garlic powder' }, { name: 'peanut butter' }, { name: 'coconut milk' }],
      pantry,
    );
    expect(out.map((i) => i.pantryStatus)).toEqual(['need', 'need', 'need']);
  });

  test('does not mutate inputs and keeps other fields', () => {
    const items = [{ id: 1, name: 'salt', quantity: 1, unit: 'tsp', checked: true }];
    const pantry = [{ name: 'salt', isStaple: true }];
    const out = annotateWithPantry(items, pantry);
    expect(items[0].pantryStatus).toBeUndefined();
    expect(out[0]).toMatchObject({ id: 1, checked: true, pantryStatus: 'have' });
    expect(out[0]).not.toBe(items[0]);
  });

  test('handles bad inputs', () => {
    expect(annotateWithPantry(null, [])).toEqual([]);
    expect(annotateWithPantry([{ name: 'salt' }], null)[0].pantryStatus).toBe('need');
    expect(annotateWithPantry([null], [])[0]).toBeNull();
  });
});

describe('helpers', () => {
  test('pantryKey normalizes and applies synonyms', () => {
    expect(pantryKey('Garlic Cloves')).toBe('garlic');
    expect(pantryKey('Pepper')).toBe('black pepper');
    expect(pantryKey({ name: 'All-Purpose Flour' })).toBe('flour');
    expect(pantryKey('')).toBe('');
  });

  test('needParts reads quantity/amount', () => {
    expect(needParts({ quantity: 2, unit: 'cups' })[0]).toMatchObject({ value: 2, unit: 'cup' });
    expect(needParts({ amount: '1/2', unit: 'tsp' })[0]).toMatchObject({ value: 0.5, unit: 'tsp' });
    expect(needParts(null)).toEqual([]);
  });

  test('summarizePantryStatus counts', () => {
    expect(summarizePantryStatus([
      { pantryStatus: 'have' }, { pantryStatus: 'need' }, { pantryStatus: 'need' }, { pantryStatus: 'partial' }, {},
    ])).toEqual({ have: 1, partial: 1, need: 2, total: 4 });
  });
});


describe('meat cuts are not interchangeable', () => {
  test.each([
    ['ground beef', 'beef'],
    ['ground turkey', 'turkey'],
    ['whole chicken', 'chicken'],
  ])('%s does not match %s', (a, b) => {
    expect(matchScore(a, b)).toBeNull();
  });
  test('ground still matches for spices, whole for dairy', () => {
    expect(matchScore('ground cumin', 'cumin')).not.toBeNull();
    expect(matchScore('whole milk', 'milk')).not.toBeNull();
  });
});

describe('pantry stock is shared between list lines that match it', () => {
  test('olive oil + extra virgin olive oil draw from one 3 tbsp bottle', () => {
    const out = annotateWithPantry([
      { name: 'Olive Oil', quantity: 2, unit: 'tbsp' },
      { name: 'Extra Virgin Olive Oil', quantity: 2, unit: 'tbsp' },
    ], [{ id: 'p1', name: 'Olive Oil', quantity: 3, unit: 'tbsp' }]);
    expect(out[0].pantryStatus).toBe('have');
    expect(out[1].pantryStatus).toBe('partial');
    expect(out[1].remainingQuantityText).toBe('1 tbsp');
  });
  test('stock used up by an earlier line => need', () => {
    const out = annotateWithPantry([
      { name: 'milk', quantity: 1, unit: 'cup' },
      { name: 'whole milk', quantity: 1, unit: 'cup' },
    ], [{ id: 'm', name: 'milk', quantity: 1, unit: 'cup' }]);
    expect(out.map((i) => i.pantryStatus)).toEqual(['have', 'need']);
  });
});

describe('stock bought for a shopping list', () => {
  const bought = { id: 'p1', name: 'Milk', quantity: 2, unit: 'cup', fromPurchase: true, purchasedForListId: 'L1' };
  test('counts on the list it was bought for', () => {
    const [r] = annotateWithPantry([{ name: 'milk', quantity: 2, unit: 'cup' }], [bought], { listId: 'L1' });
    expect(r.pantryStatus).toBe('have');
  });
  test('does not count on another list (assumed used by those meals)', () => {
    const [r] = annotateWithPantry([{ name: 'milk', quantity: 2, unit: 'cup' }], [bought], { listId: 'L2' });
    expect(r.pantryStatus).toBe('need');
    expect(r.pantryMatch).toBe(bought);
    const [unsaved] = annotateWithPantry([{ name: 'milk', quantity: 2, unit: 'cup' }], [bought]);
    expect(unsaved.pantryStatus).toBe('need');
  });
  test('confirmed (user) stock always counts', () => {
    const [r] = annotateWithPantry([{ name: 'milk', quantity: 2, unit: 'cup' }], [{ ...bought, fromPurchase: false }], { listId: 'L2' });
    expect(r.pantryStatus).toBe('have');
  });
});
