import {
  normalizeListItem,
  normalizeList,
  annotateList,
  effectiveStatus,
  prepareItemsForSave,
  makeManualItem,
  asManualSource,
  parseAmountText,
  applyItemEdit,
  purchaseFromItem,
  displayQuantity,
  sourceTitles,
  groupForDisplay,
  sanitizeForFirestore,
} from '../listModel';
import { buildItemsFromRecipe, mergeShoppingItems } from '../../../services/shoppingList/buildShoppingList';

const hasUndefined = (v) => {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.some(hasUndefined);
  if (v && typeof v === 'object') return Object.values(v).some(hasUndefined);
  return false;
};

const recipe = {
  id: 'r1',
  title: 'Tacos',
  servings: '4',
  ingredients: [
    { ingredientId: 'Garlic cloves', amount: '2', unit: 'cloves' },
    { ingredientId: 'olive oil', amount: '2', unit: 'tbsp' },
    { ingredientId: 'salt', amount: '', unit: '' },
    { ingredientId: 'flour', amount: '1', unit: 'cup' },
  ],
};

describe('normalizeListItem (legacy saved items)', () => {
  test('fills key, aisle, parts and quantityText for an old item', () => {
    const item = normalizeListItem({ id: 'x', name: 'Black pepper', quantity: 1, unit: 'items', category: 'Produce' });
    expect(item.key).toBe('black pepper');
    expect(item.aisleId).toBe('spices'); // old categorizer's "Produce" is ignored
    expect(item.quantityText).toBe('1');
    expect(item.parts).toHaveLength(1);
    expect(item.completed).toBe(false);
  });

  test('old raw-float items get a readable amount', () => {
    const item = normalizeListItem({ name: 'Milk', quantity: 473.176, unit: 'ml' });
    expect(item.quantityText).not.toMatch(/473\.176/);
    expect(item.id).toBe('ing-milk');
  });

  test('unknown names fall back to a legacy category that is a real aisle', () => {
    const item = normalizeListItem({ name: 'Zorblax', quantity: 1, unit: '', category: 'Bakery' });
    expect(item.aisleId).toBe('bakery');
  });

  test('legacy alreadyHave becomes a "have" override; explicit null does not', () => {
    expect(normalizeListItem({ name: 'Rice', alreadyHave: true }).pantryOverride).toBe('have');
    expect(normalizeListItem({ name: 'Rice', alreadyHave: true, pantryOverride: null }).pantryOverride).toBe(null);
  });

  test('blank amount stays blank, not "to taste"', () => {
    const item = normalizeListItem({ name: 'Paper towels' });
    expect(item.quantityText).toBe('');
    expect(item.isToTaste).toBe(false);
  });

  test('non-objects are dropped and duplicate ids are made unique', () => {
    const list = normalizeList([null, 'x', { id: 'a', name: 'Milk' }, { id: 'a', name: 'Eggs' }]);
    expect(list).toHaveLength(2);
    expect(new Set(list.map((i) => i.id)).size).toBe(2);
  });

  test('builder items pass through unchanged in meaning', () => {
    const [garlic] = buildItemsFromRecipe(recipe, 8).filter((i) => i.key === 'garlic');
    const n = normalizeListItem(garlic);
    expect(n.quantityText).toBe('4 cloves');
    expect(n.sources[0].recipeTitle).toBe('Tacos');
  });
});

describe('pantry annotation and overrides', () => {
  const items = buildItemsFromRecipe(recipe, 4);
  const pantry = [
    { id: 'p1', name: 'Olive Oil', quantity: null, unit: null, isStaple: true },
    { id: 'p2', name: 'Flour', quantity: 0.5, unit: 'cup', isStaple: false },
  ];

  test('statuses come from the pantry', () => {
    const view = annotateList(items, pantry);
    const by = Object.fromEntries(view.map((i) => [i.key, i]));
    expect(by['olive oil'].effectiveStatus).toBe('have');
    expect(by.flour.effectiveStatus).toBe('partial');
    expect(displayQuantity(by.flour)).toBe('need 1/2 cup (have some)');
    expect(by.garlic.effectiveStatus).toBe('need');
    expect(displayQuantity(by.salt)).toBe('to taste');
  });

  test('override wins over the pantry', () => {
    const list = normalizeList(items).map((i) => (i.key === 'olive oil' ? { ...i, pantryOverride: 'need' } : i));
    const oil = annotateList(list, pantry).find((i) => i.key === 'olive oil');
    expect(oil.effectiveStatus).toBe('need');
    expect(effectiveStatus({ pantryStatus: 'need', pantryOverride: 'have' })).toBe('have');
  });

  test('null pantry (not loaded) keeps saved statuses', () => {
    const saved = prepareItemsForSave(items, pantry);
    const view = annotateList(saved, null);
    expect(view.find((i) => i.key === 'olive oil').effectiveStatus).toBe('have');
  });

  test('saved items are Firestore-safe with compact pantry match and synced alreadyHave', () => {
    const withDates = pantry.map((p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() }));
    const saved = prepareItemsForSave(items, withDates);
    expect(hasUndefined(saved)).toBe(false);
    const oil = saved.find((i) => i.key === 'olive oil');
    expect(oil.alreadyHave).toBe(true);
    expect(oil.pantryStatus).toBe('have');
    expect(oil.pantryMatch).toEqual({ id: 'p1', name: 'Olive Oil', quantity: null, unit: null, isStaple: true });
    expect(saved.every((i) => !('effectiveStatus' in i))).toBe(true);
  });
});

describe('grouping for display', () => {
  test('to buy by aisle in store order, bought last, have separate', () => {
    const list = normalizeList([
      ...buildItemsFromRecipe(recipe, 4),
      makeManualItem('Bananas'),
      makeManualItem('Apples'),
    ]).map((i) => (i.key === 'apple' ? { ...i, completed: true } : i));
    const pantry = [{ id: 'p1', name: 'Olive Oil', quantity: null, isStaple: true }];
    const g = groupForDisplay(annotateList(list, pantry));
    const orders = g.toBuy.map((x) => x.aisle.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    const produce = g.toBuy.find((x) => x.aisle.id === 'produce');
    expect(produce.items[produce.items.length - 1].key).toBe('apple');
    expect(produce.remaining).toBe(produce.items.length - 1);
    expect(g.have.map((i) => i.key)).toEqual(['olive oil']);
    expect(g.counts.have).toBe(1);
    expect(g.counts.bought).toBe(1);
  });

  test('a bought item stays in To buy even when the pantry now has it', () => {
    const list = normalizeList([makeManualItem('Milk')]).map((i) => ({ ...i, completed: true }));
    const g = groupForDisplay(annotateList(list, [{ id: 'p', name: 'Milk', quantity: null }]));
    expect(g.counts.toBuy).toBe(1);
    expect(g.have).toHaveLength(0);
  });
});

describe('manual items and edits', () => {
  test('quick add parses an amount and gets an aisle', () => {
    const item = makeManualItem('2 lb chicken breast');
    expect(item.name).toBe('Chicken breast');
    expect(item.quantityText).toBe('2 lb');
    expect(item.aisleId).toBe('meat-seafood');
    expect(item.id).toMatch(/^manual-/);
  });

  test('plain names have no amount; templates keep theirs', () => {
    expect(makeManualItem('Paper towels').quantityText).toBe('');
    expect(makeManualItem('Eggs', { quantity: 12, unit: 'items' }).quantityText).toBe('12');
    expect(makeManualItem('  ')).toBe(null);
  });

  test('manual add merges into an existing line instead of duplicating', () => {
    const list = normalizeList(buildItemsFromRecipe(recipe, 4));
    const merged = normalizeList(mergeShoppingItems(list, [asManualSource(makeManualItem('1 cup flour'))]));
    const flour = merged.filter((i) => i.key === 'flour');
    expect(flour).toHaveLength(1);
    expect(flour[0].quantityText).toBe('2 cups');
    expect(sourceTitles(flour[0])).toEqual(['Tacos']);
    const again = normalizeList(mergeShoppingItems(merged, [asManualSource(makeManualItem('1 cup flour'))]));
    expect(again.find((i) => i.key === 'flour').quantityText).toBe('3 cups');
  });

  test('parseAmountText handles mixed, counts, to taste and blank', () => {
    expect(parseAmountText('')).toEqual([]);
    expect(parseAmountText('3')[0]).toMatchObject({ value: 3, unit: 'each' });
    expect(parseAmountText('1 1/2 cups + 50 g')).toHaveLength(2);
    expect(parseAmountText('to taste')[0].isToTaste).toBe(true);
    expect(parseAmountText('2 bunches')[0]).toMatchObject({ value: 2, unit: 'bunch' });
  });

  test('applyItemEdit changes amount, aisle and name; sources lose their parts', () => {
    const [flour] = normalizeList(buildItemsFromRecipe(recipe, 4)).filter((i) => i.key === 'flour');
    const edited = applyItemEdit(flour, { name: 'Bread flour', amountText: '3 cups', aisleId: 'bakery', notes: 'King Arthur' });
    expect(edited.quantityText).toBe('3 cups');
    expect(edited.key).toBe('bread flour');
    expect(edited.aisleId).toBe('bakery');
    expect(edited.notes).toBe('King Arthur');
    expect(edited.sources[0].parts).toBeUndefined();
    expect(sourceTitles(edited)).toEqual(['Tacos']);
  });

  test('applyItemEdit with unchanged amount keeps the recipe math', () => {
    const [flour] = normalizeList(buildItemsFromRecipe(recipe, 4)).filter((i) => i.key === 'flour');
    const edited = applyItemEdit(flour, { name: flour.name, amountText: flour.quantityText, aisleId: flour.aisleId, notes: '' });
    expect(edited.sources[0].parts).toBeDefined();
    expect(edited.parts).toEqual(flour.parts);
  });
});

describe('purchases and misc', () => {
  test('purchaseFromItem uses the remaining amount for partial items', () => {
    const view = annotateList(buildItemsFromRecipe(recipe, 4), [{ id: 'p', name: 'Flour', quantity: 0.5, unit: 'cup' }]);
    const flour = view.find((i) => i.key === 'flour');
    expect(purchaseFromItem(flour)).toEqual({ name: 'Flour', quantity: 0.5, unit: 'cup' });
    const garlic = view.find((i) => i.key === 'garlic');
    expect(purchaseFromItem(garlic)).toEqual({ name: 'Garlic', quantity: 2, unit: 'clove' });
    const salt = view.find((i) => i.key === 'salt');
    expect(purchaseFromItem(salt).quantity).toBe(null);
  });

  test('sanitizeForFirestore drops undefined and NaN', () => {
    expect(sanitizeForFirestore({ a: undefined, b: NaN, c: [1, undefined], d: new Date(0) }))
      .toEqual({ b: null, c: [1], d: '1970-01-01T00:00:00.000Z' });
  });
});
