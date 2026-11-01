import {
  PLATE_SECTIONS,
  emptyPlate,
  togglePick,
  setPortion,
  isPicked,
  defaultPortion,
  plateComponents,
  isPlateEmpty,
  plateErrors,
  plateTitle,
  plateToRecipe,
  recipeToPlate,
  isPlateRecipe,
} from '../plateModel';
import { buildShoppingList } from '../../../../services/shoppingList/buildShoppingList';
import { normalizeUnit } from '../../../../utils/quantity';

const chickenBroccoliRice = () =>
  ['protein:Chicken thighs', 'veg:Broccoli', 'carb:Rice'].reduce((plate, pick) => {
    const [section, name] = pick.split(':');
    return togglePick(plate, section, name);
  }, emptyPlate());

describe('section catalogue', () => {
  test('every default portion uses a unit the quantity engine understands', () => {
    PLATE_SECTIONS.flatMap((s) => s.options).forEach(({ name, unit }) => {
      const category = normalizeUnit(unit).category;
      expect([name, category]).not.toEqual([name, 'unknown']);
    });
  });
});

describe('picking components', () => {
  test('toggling adds with the default portion, toggling again removes', () => {
    let plate = togglePick(emptyPlate(), 'protein', 'Salmon');
    expect(plate.protein).toEqual([{ name: 'Salmon', amount: '6', unit: 'oz' }]);
    expect(isPicked(plate, 'protein', 'salmon')).toBe(true);
    plate = togglePick(plate, 'protein', 'SALMON');
    expect(plate.protein).toEqual([]);
  });

  test('custom names get a neutral portion; blank names and unknown sections are ignored', () => {
    const plate = togglePick(emptyPlate(), 'veg', 'Bok choy');
    expect(plate.veg).toEqual([{ name: 'Bok choy', amount: '1', unit: '' }]);
    expect(togglePick(plate, 'veg', '  ')).toBe(plate);
    expect(togglePick(plate, 'dessert', 'Cake')).toBe(plate);
    expect(defaultPortion('carb', 'rice')).toEqual({ amount: '1/2', unit: 'cup' });
  });

  test('toggling is immutable', () => {
    const before = emptyPlate();
    togglePick(before, 'protein', 'Tofu');
    expect(before.protein).toEqual([]);
  });

  test('portions can be edited per pick', () => {
    const plate = setPortion(chickenBroccoliRice(), 'protein', 'chicken thighs', { amount: '8' });
    expect(plate.protein[0]).toEqual({ name: 'Chicken thighs', amount: '8', unit: 'oz' });
    expect(setPortion(plate, 'carb', 'Rice', { unit: 'g', amount: '75' }).carb[0]).toMatchObject({ amount: '75', unit: 'g' });
  });
});

describe('validation and titles', () => {
  test('empty plate and portion errors', () => {
    expect(isPlateEmpty(emptyPlate())).toBe(true);
    const bad = setPortion(chickenBroccoliRice(), 'veg', 'Broccoli', { amount: 'lots' });
    expect(plateErrors(bad)).toEqual(['Broccoli: enter an amount like 6, 1/2 or 1 1/2']);
    expect(plateErrors(setPortion(bad, 'veg', 'Broccoli', { amount: '' }))).toEqual([]); // blank = some
    expect(plateErrors(setPortion(bad, 'veg', 'Broccoli', { amount: '0' }))).toHaveLength(1);
  });

  test('titles read naturally', () => {
    expect(plateTitle(emptyPlate())).toBe('Plate');
    expect(plateTitle(togglePick(emptyPlate(), 'protein', 'Eggs'))).toBe('Eggs');
    expect(plateTitle(chickenBroccoliRice())).toBe('Chicken thighs, Broccoli & Rice');
    expect(plateTitle(togglePick(chickenBroccoliRice(), 'extras', 'Olive oil'))).toBe('Chicken thighs, Broccoli & Rice');
    expect(plateTitle(togglePick(emptyPlate(), 'extras', 'Avocado'))).toBe('Avocado');
  });
});

describe('plate <-> recipe', () => {
  test('a plate becomes a one-serving recipe of per-person portions', () => {
    const recipe = plateToRecipe(chickenBroccoliRice(), { mealType: 'Dinner' });
    expect(isPlateRecipe(recipe)).toBe(true);
    expect(recipe).toMatchObject({ title: 'Chicken thighs, Broccoli & Rice', mealType: 'Dinner', servings: 1 });
    expect(recipe.ingredients).toEqual([
      { ingredientId: 'Chicken thighs', amount: '6', unit: 'oz', plateSection: 'protein' },
      { ingredientId: 'Broccoli', amount: '1 1/2', unit: 'cup', plateSection: 'veg' },
      { ingredientId: 'Rice', amount: '1/2', unit: 'cup', plateSection: 'carb' },
    ]);
    expect(plateToRecipe(chickenBroccoliRice(), { title: '  Meal prep  ' }).title).toBe('Meal prep');
  });

  test('round-trips for editing, tolerating older or hand-made plate recipes', () => {
    const plate = chickenBroccoliRice();
    expect(recipeToPlate(plateToRecipe(plate))).toEqual(plate);
    const loose = recipeToPlate({ ingredients: [{ ingredientId: 'Hot sauce', amount: 1 }, { ingredientId: '' }, null] });
    expect(loose.extras).toEqual([{ name: 'Hot sauce', amount: '1', unit: '' }]);
    expect(plateComponents(recipeToPlate(undefined))).toEqual([]);
  });

  test('the shopping list scales plates by the number of people', () => {
    const plate = plateToRecipe(chickenBroccoliRice(), { mealType: 'Dinner' });
    const items = buildShoppingList({
      Monday: { Dinner: { recipe: plate, servings: 2 } },
      Tuesday: { Dinner: { recipe: plate, servings: 2 } },
    });
    const byName = Object.fromEntries(items.map((i) => [i.name, i.quantityText]));
    expect(byName['Chicken Thigh']).toBe('1 1/2 lb'); // 6 oz x 2 people x 2 days
    expect(byName.Broccoli).toBe('6 cups');
    expect(byName.Rice).toBe('2 cups');
    expect(items.every((i) => !i.servingsUnknown)).toBe(true);
  });
});
