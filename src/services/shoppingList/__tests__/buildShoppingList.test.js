import {
  buildShoppingList,
  buildItemsFromRecipe,
  mergeShoppingItems,
  resolveMealSlot,
  itemIdForKey,
  sortShoppingItems,
} from '../buildShoppingList';

const pancakes = {
  id: 'r-pancakes',
  title: 'Pancakes',
  servings: '4',
  ingredients: [
    { ingredientId: 'flour', amount: '2', unit: 'cups' },
    { ingredientId: 'milk', amount: '1 1/2', unit: 'cup' },
    { ingredientId: 'eggs', amount: '2', unit: '' },
    { ingredientId: 'sugar', amount: '1', unit: 'tablespoon' },
    { ingredientId: 'salt', amount: '', unit: '' },
  ],
};

const bread = {
  id: 'r-bread',
  title: 'Garlic Bread',
  servings: 4,
  ingredients: [
    { ingredientId: 'flour', amount: '1', unit: 'cup' },
    { ingredientId: 'garlic cloves', amount: '3', unit: 'cloves' },
    { ingredientId: 'butter', amount: '4', unit: 'tbsp' },
    { ingredientId: 'salt', amount: '1/2', unit: 'tsp' },
  ],
};

const pasta = {
  id: 'r-pasta',
  title: 'Garlic Pasta',
  servings: '4-6',
  ingredients: [
    { ingredientId: 'Garlic', amount: '2', unit: 'clove' },
    { ingredientId: 'spaghetti', amount: '1', unit: 'lb' },
    { ingredientId: 'olive oil', amount: '1/4', unit: 'cup' },
    { ingredientId: 'black pepper', amount: 'to taste', unit: '' },
  ],
};

const byKey = (items, key) => items.find((i) => i.key === key);

describe('resolveMealSlot', () => {
  test('new format', () => {
    expect(resolveMealSlot({ recipe: pancakes, servings: 2 })).toEqual({ recipe: pancakes, servings: 2 });
  });
  test('legacy format prefers selectedServings', () => {
    const r = resolveMealSlot({ ...pancakes, selectedServings: 8 });
    expect(r.servings).toBe(8);
    expect(r.recipe.title).toBe('Pancakes');
  });
  test('invalid slots', () => {
    expect(resolveMealSlot(null)).toBeNull();
    expect(resolveMealSlot('x')).toBeNull();
    expect(resolveMealSlot({ foo: 1 })).toBeNull();
  });
});

describe('buildShoppingList', () => {
  const plan = {
    Monday: { Breakfast: { recipe: pancakes, servings: 4 }, Dinner: { recipe: bread, servings: 4 } },
    Tuesday: { Dinner: { recipe: pasta, servings: 4 } },
  };
  const items = buildShoppingList(plan);

  test('2 cups + 1 cup flour = 3 cups', () => {
    const flour = byKey(items, 'flour');
    expect(flour.quantity).toBe(3);
    expect(flour.parts).toHaveLength(1);
    expect(flour.parts[0].unit).toBe('cup');
    expect(flour.quantityText).toBe('3 cups');
    expect(flour.unit).toBe('cups');
    expect(flour.sources).toHaveLength(2);
  });

  test('garlic cloves across recipes merge into one line', () => {
    const garlic = byKey(items, 'garlic');
    expect(items.filter((i) => i.key === 'garlic')).toHaveLength(1);
    expect(garlic.name).toBe('Garlic');
    expect(garlic.quantity).toBe(5);
    expect(garlic.quantityText).toBe('5 cloves');
    expect(garlic.aisle.aisleId).toBe('produce');
  });

  test('"salt to taste" is retained and merged with real amounts', () => {
    const salt = byKey(items, 'salt');
    expect(salt).toBeDefined();
    expect(salt.quantityText).toBe('1/2 tsp');
    expect(salt.isToTaste).toBe(false);
    expect(salt.sources).toHaveLength(2);
    const pepper = byKey(items, 'black pepper');
    expect(pepper.isToTaste).toBe(true);
    expect(pepper.quantity).toBeNull();
    expect(pepper.quantityText).toBe('to taste');
    expect(pepper.aisle.aisleId).toBe('spices');
  });

  test('servings "4-6" gives no NaN', () => {
    items.forEach((i) => {
      i.parts.forEach((p) => expect(Number.isNaN(p.value)).toBe(false));
      expect(i.quantity === null || Number.isFinite(i.quantity)).toBe(true);
    });
    expect(byKey(items, 'spaghetti').quantityText).toBe('1 lb');
    expect(byKey(items, 'spaghetti').servingsUnknown).toBe(false);
  });

  test('item shape', () => {
    const milk = byKey(items, 'milk');
    expect(milk).toMatchObject({
      id: 'ing-milk',
      key: 'milk',
      name: 'Milk',
      quantity: 1.5,
      unit: 'cups',
      quantityText: '1 1/2 cups',
      isToTaste: false,
      servingsUnknown: false,
      category: 'Dairy & Eggs',
      completed: false,
      alreadyHave: false,
      notes: '',
      estimatedCost: 0,
    });
    expect(milk.aisle).toEqual({ aisleId: 'dairy-eggs', aisleName: 'Dairy & Eggs', order: 4 });
    expect(milk.sources[0]).toMatchObject({
      recipeId: 'r-pancakes', recipeTitle: 'Pancakes', day: 'Monday', meal: 'Breakfast', servings: 4,
      originalText: '1 1/2 cup milk',
    });
    const eggs = byKey(items, 'egg');
    expect(eggs.quantityText).toBe('2');
    expect(eggs.unit).toBe('');
  });

  test('no undefined values anywhere (Firestore safe)', () => {
    const walk = (v) => {
      if (v === undefined) throw new Error('undefined found');
      if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    expect(() => walk(items)).not.toThrow();
  });

  test('sorted by aisle order then name', () => {
    const orders = items.map((i) => i.aisle.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    const outOfOrder = items.filter((it, i) => i > 0
      && it.aisle.order === items[i - 1].aisle.order
      && items[i - 1].name.localeCompare(it.name) > 0);
    expect(outOfOrder).toEqual([]);
  });

  test('cup + tablespoon merges into one volume part', () => {
    const r = { title: 'X', servings: 2, ingredients: [
      { ingredientId: 'sugar', amount: '1', unit: 'cup' },
      { ingredientId: 'Sugar', amount: '2', unit: 'Tbsp' },
    ] };
    const sugar = byKey(buildItemsFromRecipe(r, 2), 'sugar');
    expect(sugar.parts).toHaveLength(1);
    expect(sugar.parts[0].category).toBe('volume');
    expect(sugar.quantityText).toBe('1 1/8 cups');
  });

  test('flour in cups and grams stays two parts', () => {
    const plan2 = {
      Monday: { Lunch: { recipe: pancakes, servings: 4 } },
      Tuesday: { Lunch: { recipe: { title: 'Cake', servings: 8, ingredients: [
        { ingredientId: 'all-purpose flour', amount: '100', unit: 'grams' },
        { ingredientId: 'flour', amount: '50', unit: 'g' },
      ] }, servings: 8 } },
    };
    const res = buildShoppingList(plan2);
    const flourLines = res.filter((i) => i.key.includes('flour'));
    // "all purpose flour" groups separately from "flour" by key; check plain flour
    const flour = byKey(res, 'flour');
    expect(flour.parts.map((p) => p.category)).toEqual(['volume', 'weight']);
    expect(flour.quantityText).toBe('2 cups + 50 g');
    expect(flourLines.length).toBeGreaterThanOrEqual(1);
  });

  test('blank recipe servings are flagged and treated as one batch', () => {
    const r = { title: 'Mystery', servings: '', ingredients: [{ ingredientId: 'rice', amount: '2', unit: 'cups' }] };
    const res = buildShoppingList({ Monday: { Dinner: { recipe: r, servings: 6 } } });
    expect(res[0].servingsUnknown).toBe(true);
    expect(res[0].quantity).toBe(2);
    expect(res[0].sources[0].servingsUnknown).toBe(true);
  });

  test('legacy bare recipe slot works', () => {
    const res = buildShoppingList({ Monday: { Dinner: { ...pancakes, selectedServings: 8 } } });
    expect(byKey(res, 'flour').quantityText).toBe('4 cups');
    expect(byKey(res, 'egg').quantity).toBe(4);
  });

  test('legacy slot without selectedServings uses recipe yield', () => {
    const res = buildShoppingList({ Monday: { Dinner: { ...pancakes } } });
    expect(byKey(res, 'flour').quantity).toBe(2);
  });

  test('same recipe on 3 days triples', () => {
    const res = buildShoppingList({
      Monday: { Dinner: { recipe: bread, servings: 4 } },
      Tuesday: { Dinner: { recipe: bread, servings: 4 } },
      Wednesday: { Dinner: { recipe: bread, servings: 4 } },
    });
    expect(byKey(res, 'garlic').quantity).toBe(9);
    expect(byKey(res, 'flour').quantity).toBe(3);
    expect(byKey(res, 'butter').quantityText).toBe('3/4 cup');
    expect(byKey(res, 'garlic').sources.map((s) => s.day)).toEqual(['Monday', 'Tuesday', 'Wednesday']);
  });

  test('2 servings of a 4-serving recipe halves', () => {
    const res = buildShoppingList({ Monday: { Dinner: { recipe: pancakes, servings: 2 } } });
    expect(byKey(res, 'flour').quantityText).toBe('1 cup');
    expect(byKey(res, 'milk').quantityText).toBe('3/4 cup');
    expect(byKey(res, 'egg').quantity).toBe(1);
    expect(byKey(res, 'sugar').quantityText).toBe('1 1/2 tsp');
  });

  test('servings as strings ("2 servings") scale too', () => {
    const res = buildShoppingList({ Monday: { Dinner: { recipe: pancakes, servings: '2 servings' } } });
    expect(byKey(res, 'flour').quantity).toBe(1);
  });

  test('AI import style amounts: unicode, "a pinch", full unit names', () => {
    const r = { title: 'Import', servings: 'Serves 2', ingredients: [
      { ingredientId: 'butter', amount: '2½', unit: 'tablespoons' },
      { ingredientId: 'nutmeg', amount: 'a pinch', unit: '' },
      { ingredientId: 'cheddar cheese', amount: '200', unit: 'grams' },
      '3/4 cup chopped walnuts',
    ] };
    const res = buildItemsFromRecipe(r, 4);
    expect(byKey(res, 'butter').quantityText).toBe('5 tbsp');
    expect(byKey(res, 'nutmeg').isToTaste).toBe(true);
    expect(byKey(res, 'nutmeg').quantityText).toBe('a pinch');
    expect(byKey(res, 'cheddar cheese').quantityText).toBe('400 g');
    expect(byKey(res, 'walnut').quantityText).toBe('1 1/2 cups');
  });

  test('skips invalid slots, days and ingredients safely', () => {
    const res = buildShoppingList({
      id: 'abc',
      createdAt: { seconds: 1, nanoseconds: 2 },
      Monday: { Dinner: null, Lunch: 'x', Snack: { recipe: { title: 'No ings' }, servings: 2 },
        Breakfast: { recipe: { title: 'Bad', servings: 2, ingredients: [null, {}, { ingredientId: '' }, 5,
          { ingredientId: 'apple', amount: '1/0', unit: '' }] }, servings: 2 } },
    });
    expect(res).toHaveLength(1);
    expect(res[0].key).toBe('apple');
    expect(res[0].quantity).toBeNull();
    expect(res[0].quantityText).toBe('1/0');
    expect(buildShoppingList(null)).toEqual([]);
    expect(buildShoppingList([])).toEqual([]);
  });

  test('options.days filters', () => {
    const res = buildShoppingList(plan, { days: ['Tuesday'] });
    expect(byKey(res, 'flour')).toBeUndefined();
    expect(byKey(res, 'spaghetti')).toBeDefined();
  });

  test('multiple recipes in one meal slot (array)', () => {
    const res = buildShoppingList({ Monday: { Dinner: [{ recipe: bread, servings: 4 }, { recipe: pasta, servings: 4 }] } });
    expect(byKey(res, 'garlic').quantity).toBe(5);
  });
});

describe('buildItemsFromRecipe', () => {
  test('matches meal plan builder output', () => {
    const a = buildItemsFromRecipe(pancakes, 8);
    const b = buildShoppingList({ X: { Y: { recipe: pancakes, servings: 8 } } });
    expect(a.map((i) => [i.key, i.quantityText])).toEqual(b.map((i) => [i.key, i.quantityText]));
  });
  test('blank servings = recipe yield; title used (never "undefined")', () => {
    const res = buildItemsFromRecipe(pancakes);
    expect(byKey(res, 'flour').quantity).toBe(2);
    expect(byKey(res, 'flour').sources[0].recipeTitle).toBe('Pancakes');
  });
  test('"1/2" amount scales without NaN', () => {
    const res = buildItemsFromRecipe({ title: 'T', servings: 2, ingredients: [{ ingredientId: 'honey', amount: '1/2', unit: 'cup' }] }, 3);
    expect(res[0].quantityText).toBe('3/4 cup');
  });
});

describe('mergeShoppingItems', () => {
  const base = buildShoppingList({ Monday: { Dinner: { recipe: bread, servings: 4 } } });

  test('keeps user-set fields and adds new sources', () => {
    const existing = base.map((i) => (i.key === 'garlic'
      ? { ...i, completed: true, alreadyHave: true, notes: 'big ones', productMatch: { id: 'p1' }, estimatedCost: 2.5 }
      : i));
    const more = buildShoppingList({ Tuesday: { Dinner: { recipe: pasta, servings: 4 } } });
    const merged = mergeShoppingItems(existing, more);
    const garlic = byKey(merged, 'garlic');
    expect(garlic).toMatchObject({ completed: true, alreadyHave: true, notes: 'big ones', estimatedCost: 2.5, quantity: 5 });
    expect(garlic.productMatch).toEqual({ id: 'p1' });
    expect(merged.filter((i) => i.key === 'garlic')).toHaveLength(1);
    expect(byKey(merged, 'spaghetti')).toBeDefined();
  });

  test('does not double count the same sources', () => {
    const merged = mergeShoppingItems(base, base);
    expect(byKey(merged, 'garlic').quantity).toBe(3);
    expect(merged).toHaveLength(base.length);
    const twice = mergeShoppingItems(mergeShoppingItems(base, base), base);
    expect(byKey(twice, 'flour').quantity).toBe(1);
  });

  test('same recipe on another day still adds', () => {
    const tue = buildShoppingList({ Tuesday: { Dinner: { recipe: bread, servings: 4 } } });
    expect(byKey(mergeShoppingItems(base, tue), 'garlic').quantity).toBe(6);
  });

  test('manual/legacy items keep their amount as a base', () => {
    const existing = [{ id: 'item-123', name: 'Flour', quantity: 2, unit: 'cups', category: 'Baking', completed: true }];
    const merged = mergeShoppingItems(existing, base);
    const flour = byKey(merged, 'flour');
    expect(flour.id).toBe('item-123');
    expect(flour.completed).toBe(true);
    expect(flour.quantityText).toBe('3 cups');
    // merging again does not double count
    expect(byKey(mergeShoppingItems(merged, base), 'flour').quantityText).toBe('3 cups');
  });

  test('manual new item adds to a recipe item', () => {
    const merged = mergeShoppingItems(base, [{ name: 'butter', quantity: 4, unit: 'tbsp' }]);
    expect(byKey(merged, 'butter').quantityText).toBe('1/2 cup');
  });

  test('handles empty / bad input', () => {
    expect(mergeShoppingItems(null, null)).toEqual([]);
    expect(mergeShoppingItems(undefined, base)).toHaveLength(base.length);
  });
});

describe('helpers', () => {
  test('itemIdForKey', () => {
    expect(itemIdForKey('black pepper')).toBe('ing-black-pepper');
    expect(itemIdForKey('')).toBe('ing-item');
  });
  test('sortShoppingItems does not mutate', () => {
    const items = [{ name: 'Zucchini', aisle: { order: 1 } }, { name: 'Apple', aisle: { order: 1 } }];
    expect(sortShoppingItems(items).map((i) => i.name)).toEqual(['Apple', 'Zucchini']);
    expect(items[0].name).toBe('Zucchini');
  });
});

describe('merge keeps duplicate lines and separate adds', () => {
  const cake = {
    id: 'cake', title: 'Cake', servings: 4,
    ingredients: [
      { ingredientId: 'sugar', amount: '1', unit: 'cup' },
      { ingredientId: 'flour', amount: '2', unit: 'cups' },
      { ingredientId: 'sugar', amount: '1', unit: 'cup' },
    ],
  };
  const sugar = (items) => items.find((i) => i.key === 'sugar').quantityText;

  test('two identical lines in one recipe both count when merged into an existing item', () => {
    const existing = [{ id: 'm', key: 'sugar', name: 'Sugar', quantity: 1, unit: 'cup', sources: [] }];
    expect(sugar(mergeShoppingItems(existing, buildItemsFromRecipe(cake, 4)))).toBe('3 cups');
  });

  test('a fresh build and a merge agree', () => {
    expect(sugar(buildItemsFromRecipe(cake, 4))).toBe('2 cups');
    expect(sugar(mergeShoppingItems([], buildItemsFromRecipe(cake, 4)))).toBe('2 cups');
  });

  test('a second recipe with the same lines adds up', () => {
    const bread = { ...cake, id: 'bread', title: 'Bread' };
    const list = buildItemsFromRecipe(cake, 4);
    expect(sugar(mergeShoppingItems(list, buildItemsFromRecipe(bread, 4)))).toBe('4 cups');
  });

  test('re-merging the exact same build is still a no-op', () => {
    const plan = { mon: { dinner: { recipe: cake, servings: 4 } } };
    const list = buildShoppingList(plan);
    expect(sugar(mergeShoppingItems(list, buildShoppingList(plan)))).toBe('2 cups');
  });

  test('separate adds (addId) of the same recipe always add, at any servings', () => {
    const plan = { mon: { dinner: { recipe: cake, servings: 4 } }, tue: { dinner: { recipe: cake, servings: 4 } } };
    let list = buildShoppingList(plan);
    expect(sugar(list)).toBe('4 cups');
    list = mergeShoppingItems(list, buildItemsFromRecipe(cake, 4, { addId: 'a1' }));
    expect(sugar(list)).toBe('6 cups');
    list = mergeShoppingItems(list, buildItemsFromRecipe(cake, 8, { addId: 'a2' }));
    expect(sugar(list)).toBe('2 1/2 quarts'); // 10 cups
  });

  test('without addId a different servings count is not ignored', () => {
    let list = buildItemsFromRecipe(cake, 4);
    list = mergeShoppingItems(list, buildItemsFromRecipe(cake, 8));
    expect(sugar(list)).toBe('6 cups');
  });
});

describe('ingredient reading', () => {
  const build = (ingredients, servings) => buildItemsFromRecipe({ id: 'r', title: 'R', servings: 2, ingredients }, servings);
  const text = (items, key) => {
    const it = items.find((i) => i.key === key);
    return it ? it.quantityText : undefined;
  };

  test('string lines with compound amounts, sizes and containers', () => {
    const items = build([
      '1 cup + 2 tbsp milk',
      '1 (14 oz) can diced tomatoes',
      '400g can chickpeas',
      '2 x 400g cans chickpeas',
      '2 15-ounce cans beans',
    ]);
    const milk = items.find((i) => i.key === 'milk');
    expect(milk.name).toBe('Milk');
    expect(milk.quantityText).toBe('1 1/8 cups'); // 1 cup + 2 tbsp, nothing lost
    expect(text(items, 'tomato')).toBe('1 can');
    expect(text(items, 'chickpea')).toBe('3 cans');
    expect(text(items, 'bean')).toBe('2 cans');
    expect(items.map((i) => i.name)).not.toEqual(expect.arrayContaining([expect.stringMatching(/Can|X /)]));
  });

  test('count unit hidden in the name is used', () => {
    const items = build([
      { ingredientId: 'garlic', amount: '2', unit: 'cloves' },
      { ingredientId: 'garlic cloves, minced', amount: '3', unit: '' },
      '4 garlic cloves',
      { ingredientId: 'garlic', amount: '1', unit: 'head' },
    ], 4);
    expect(text(items, 'garlic')).toBe('18 cloves + 2 heads');
  });

  test('salt and pepper becomes two items that can match the staples', () => {
    const items = build([{ ingredientId: 'salt and pepper', amount: '', unit: '' }, 'salt & freshly ground black pepper, to taste']);
    expect(items.map((i) => i.key).sort()).toEqual(['black pepper', 'salt']);
    expect(items.every((i) => i.isToTaste)).toBe(true);
  });

  test('true synonyms share one line', () => {
    const items = build([
      { ingredientId: 'white sugar', amount: '1', unit: 'cup' },
      { ingredientId: 'sugar', amount: '1', unit: 'cup' },
      { ingredientId: 'scallions', amount: '2', unit: '' },
      { ingredientId: 'spring onions', amount: '1', unit: '' },
    ]);
    expect(text(items, 'sugar')).toBe('2 cups');
    expect(text(items, 'green onion')).toBe('3');
  });

  test('zero amounts do not show as "0 tsp"', () => {
    const items = build([
      { ingredientId: 'water', amount: '0', unit: 'cups' },
      { ingredientId: 'ice', amount: 0, unit: '' },
      { ingredientId: 'flour', amount: '0', unit: 'cup' },
      { ingredientId: 'flour', amount: '1', unit: 'cup' },
    ]);
    expect(text(items, 'water')).toBe('to taste');
    expect(text(items, 'ice')).toBe('to taste');
    expect(text(items, 'flour')).toBe('1 cup');
  });

  test('unusable desired servings are flagged, blank is not', () => {
    const recipe = { id: 'r', servings: 3, ingredients: [{ ingredientId: 'flour', amount: '1', unit: 'cup' }] };
    expect(buildItemsFromRecipe(recipe, 0)[0]).toMatchObject({ quantityText: '1 cup', servingsUnknown: true });
    expect(buildItemsFromRecipe(recipe, 'abc')[0].servingsUnknown).toBe(true);
    expect(buildItemsFromRecipe(recipe, '')[0].servingsUnknown).toBe(false);
    expect(buildItemsFromRecipe(recipe)[0].servingsUnknown).toBe(false);
  });
});

describe('imported lines with the measure inside the name', () => {
  const haitian = {
    id: 'h1',
    title: 'Haitian Chicken',
    servings: '4 people',
    ingredients: [
      { ingredientId: 'pound cut up chicken bone in, skin on, I just did drumsticks', amount: '1', unit: '' },
      { ingredientId: '(32 oz) can whole peeled tomatoes', amount: '1', unit: '' },
      { ingredientId: '(6 oz) can tomato paste', amount: '1', unit: '' },
      { ingredientId: 'large sweet onions cut in large chunks', amount: '2', unit: '' },
      { ingredientId: 'pound cake', amount: '1', unit: '' },
    ],
  };
  const byName = (items) => Object.fromEntries(items.map((i) => [i.name, i]));
  const items = byName(buildItemsFromRecipe(haitian, 4));

  test('a leading unit word becomes the unit', () => {
    expect(items.Chicken).toMatchObject({ quantityText: '1 lb' });
  });

  test('package sizes are kept for the shopper', () => {
    expect(items['Tomato Paste']).toMatchObject({ quantityText: '1 can', sizeNote: '6 oz' });
    expect(items['Whole Peeled Tomato']).toMatchObject({ quantityText: '1 can', sizeNote: '32 oz' });
  });

  test('prep words in the name are dropped; foods named after units are left alone', () => {
    expect(items['Sweet Onion']).toMatchObject({ quantityText: '2' });
    expect(items['Pound Cake']).toMatchObject({ quantityText: '1' });
  });

  test('items without a package size have an empty sizeNote', () => {
    expect(items['Sweet Onion'].sizeNote).toBe('');
  });
});
