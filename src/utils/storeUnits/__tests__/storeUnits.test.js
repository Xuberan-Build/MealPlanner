import { toStoreQuantity, findStoreUnit, wholeUnits, formatWeight, itemGrams, STORE_UNITS } from '..';
import { buildShoppingList } from '../../../services/shoppingList/buildShoppingList';
import { normalizeIngredientName, normalizeUnit } from '../../quantity';

/** Real list items, built the same way the app builds them. */
const itemsFor = (ingredients, servings = 1, days = 1) => {
  const recipe = { id: 'r', title: 'Test', servings: '1', ingredients };
  const plan = {};
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].slice(0, days).forEach((day) => {
    plan[day] = { Dinner: { recipe, servings } };
  });
  return Object.fromEntries(buildShoppingList(plan).map((i) => [i.key, i]));
};

describe('store table', () => {
  test('every entry is complete and uses units the engine knows', () => {
    Object.entries(STORE_UNITS).forEach(([key, entry]) => {
      expect([key, normalizeIngredientName(key)]).toEqual([key, key]); // keys are grouping keys
      expect(['count', 'package', 'weight']).toContain(entry.sell.by);
      if (entry.sell.by !== 'weight') {
        expect([key, entry.sell.grams > 0, Boolean(entry.sell.label && entry.sell.plural)]).toEqual([key, true, true]);
      }
      Object.entries(entry.perUnit).forEach(([unit, grams]) => {
        expect([key, unit, grams > 0]).toEqual([key, unit, true]);
        if (unit !== 'each') expect([key, unit, normalizeUnit(unit).category]).not.toEqual([key, unit, 'unknown']);
      });
    });
  });

  test('lookup falls back to the longest whole-word suffix', () => {
    expect(findStoreUnit('organic baby spinach')).toBe(STORE_UNITS['baby spinach']);
    expect(findStoreUnit('sweet onion')).toBe(STORE_UNITS.onion);
    expect(findStoreUnit('green onion')).toBe(STORE_UNITS['green onion']); // not "onion"
    expect(findStoreUnit('squeezed lemon juice')).toBe(STORE_UNITS['lemon juice']);
    expect(findStoreUnit('dragon fruit')).toBeNull();
    expect(findStoreUnit('')).toBeNull();
  });
});

describe('rounding and formatting', () => {
  test('rounds up to whole units with a small tolerance', () => {
    expect(wholeUnits(0.3)).toBe(1);
    expect(wholeUnits(1.8)).toBe(2);
    expect(wholeUnits(2.05)).toBe(2); // close enough to 2
    expect(wholeUnits(2.2)).toBe(3);
    expect(wholeUnits(0)).toBe(0);
  });

  test('weights read as ounces under a pound, else quarter pounds', () => {
    expect(formatWeight(170)).toBe('6 oz');
    expect(formatWeight(680.4)).toBe('1 1/2 lb');
    expect(formatWeight(500, { roundUp: true })).toBe('1 1/4 lb');
    expect(formatWeight(0)).toBe('');
  });
});

describe('toStoreQuantity: the "Build a plate" week', () => {
  // Chicken thighs, broccoli, rice, spinach, eggs: 2 people, Thursday + Friday.
  const items = itemsFor(
    [
      { ingredientId: 'Chicken thighs', amount: '6', unit: 'oz' },
      { ingredientId: 'Broccoli', amount: '1 1/2', unit: 'cup' },
      { ingredientId: 'Rice', amount: '1/2', unit: 'cup' },
      { ingredientId: 'Spinach', amount: '2', unit: 'cup' },
      { ingredientId: 'Eggs', amount: '2', unit: '' },
      { ingredientId: 'Sweet potato', amount: '1', unit: '' },
    ],
    2,
    2,
  );

  test('produce sold whole: heads, with the weight for reference', () => {
    // Weight of the 2 heads you pick up (broccoli is priced by the pound).
    expect(toStoreQuantity(items.broccoli)).toEqual({ text: '2 heads', detail: '≈ 1 1/4 lb', forText: 'for 6 cups' });
  });

  test('bagged greens, grains and eggs come in packages', () => {
    // 8 cups of leaves shows as "2 quarts" in cooking terms; the store view fixes that.
    expect(toStoreQuantity(items.spinach)).toEqual({ text: '2 bags', detail: '5 oz each', forText: 'for 2 quarts' });
    expect(toStoreQuantity(items.rice)).toEqual({ text: '1 bag', detail: '2 lb', forText: 'for 2 cups' });
    expect(toStoreQuantity(items.egg)).toEqual({ text: '1 dozen', detail: '', forText: 'for 8' });
  });

  test('meat stays by weight and does not repeat itself', () => {
    expect(toStoreQuantity(items['chicken thigh'])).toEqual({ text: '1 1/2 lb', detail: '', forText: '' });
  });

  test('counted produce keeps its count', () => {
    expect(toStoreQuantity(items['sweet potato'])).toEqual({ text: '4 sweet potatoes', detail: '≈ 1 3/4 lb', forText: '' });
  });
});

describe('toStoreQuantity: mixed units and fallbacks', () => {
  test('mixed cooking units are added up before converting', () => {
    const { 'lemon juice': juice } = itemsFor([
      { ingredientId: 'lemon juice', amount: '1', unit: 'tbsp' },
      { ingredientId: 'fresh lemon juice', amount: '1/4', unit: 'cup' },
    ]);
    expect(toStoreQuantity(juice)).toEqual({ text: '2 lemons', detail: '', forText: 'for 5 tbsp' }); // ≈ 1.7 lemons
  });

  test('cloves of garlic become heads', () => {
    const { garlic } = itemsFor([{ ingredientId: 'garlic cloves', amount: '5', unit: '' }]);
    expect(toStoreQuantity(garlic)).toMatchObject({ text: '1 head', forText: 'for 5 cloves' });
  });

  test('unknown items, to-taste items and unconvertible units fall back (null)', () => {
    const items = itemsFor([
      { ingredientId: 'dragon fruit', amount: '1', unit: '' },
      { ingredientId: 'salt', amount: '', unit: '' },
      { ingredientId: 'broccoli', amount: '1', unit: 'pinch' },
    ]);
    expect(toStoreQuantity(items['dragon fruit'])).toBeNull();
    expect(toStoreQuantity(items.salt)).toBeNull();
    expect(toStoreQuantity(items.broccoli)).toBeNull();
    expect(toStoreQuantity(undefined)).toBeNull();
    expect(itemGrams([], STORE_UNITS.broccoli)).toBeNull();
  });
});

describe('toStoreQuantity: shopper wording', () => {
  test('a part of a whole still says what it is for', () => {
    const { onion } = itemsFor([{ ingredientId: 'onion', amount: '1/4', unit: '' }]);
    expect(toStoreQuantity(onion)).toEqual({ text: '1 onion', detail: '≈ 6 oz', forText: 'for 1/4' });
  });

  test('things not weighed at the register show no weight', () => {
    const items = itemsFor([
      { ingredientId: 'dill', amount: '1/4', unit: 'cup' },
      { ingredientId: 'cooked rotisserie chicken', amount: '1', unit: 'cup' },
    ]);
    expect(toStoreQuantity(items.dill)).toEqual({ text: '1 bunch', detail: '', forText: 'for 1/4 cup' });
    expect(toStoreQuantity(items['cooked rotisserie chicken'])).toEqual({ text: '1 chicken', detail: '', forText: 'for 1 cup' });
  });

  test('package size reads "each" only for more than one', () => {
    const { butter } = itemsFor([{ ingredientId: 'butter', amount: '1', unit: 'tbsp' }]);
    expect(toStoreQuantity(butter)).toEqual({ text: '1 package', detail: '1 lb', forText: 'for 1 tbsp' });
    const { spinach } = itemsFor([{ ingredientId: 'spinach', amount: '6', unit: 'cup' }]);
    expect(toStoreQuantity(spinach).detail).toBe('5 oz each');
  });

  test('"squeezed lemon juice" and "lemon juice" are one line', () => {
    const items = itemsFor([
      { ingredientId: 'lemon juice', amount: '1', unit: 'tbsp' },
      { ingredientId: 'squeezed lemon juice', amount: '1/4', unit: 'cup' },
    ]);
    expect(Object.keys(items)).toEqual(['lemon juice']);
  });
});

