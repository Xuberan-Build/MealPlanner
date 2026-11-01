import {
  buildShoppingList,
  buildItemsFromRecipe,
  mergeShoppingItems,
  replacePlanSources,
} from '../buildShoppingList';

const soup = {
  id: 'soup',
  title: 'Soup',
  servings: '4',
  ingredients: [
    { ingredientId: 'onion', amount: '1', unit: '' },
    { ingredientId: 'carrot', amount: '2', unit: '' },
  ],
};
const stew = {
  id: 'stew',
  title: 'Stew',
  servings: '4',
  ingredients: [
    { ingredientId: 'onion', amount: '2', unit: '' },
    { ingredientId: 'beef', amount: '500', unit: 'g' },
  ],
};

const plan = (slots) => slots.reduce((acc, [day, meal, recipe, servings]) => ({
  ...acc,
  [day]: { ...(acc[day] || {}), [meal]: { recipe, servings } },
}), {});

const byName = (items) => Object.fromEntries(items.map((i) => [i.name, i]));

describe('replacePlanSources (regenerating a list after the plan changed)', () => {
  test('replaces plan amounts instead of adding to them', () => {
    const before = buildShoppingList(plan([['Monday', 'Dinner', soup, 4]]));
    const after = replacePlanSources(before, buildShoppingList(plan([['Monday', 'Dinner', soup, 8]])));
    expect(byName(after).Onion.quantityText).toBe('2');
    expect(byName(after).Carrot.quantityText).toBe('4');
  });

  test('regenerating an unchanged plan changes nothing', () => {
    const list = buildShoppingList(plan([['Monday', 'Dinner', soup, 4], ['Tuesday', 'Dinner', stew, 4]]));
    const again = replacePlanSources(list, buildShoppingList(plan([['Monday', 'Dinner', soup, 4], ['Tuesday', 'Dinner', stew, 4]])));
    expect(again.map((i) => [i.name, i.quantityText])).toEqual(list.map((i) => [i.name, i.quantityText]));
  });

  test('keeps ticks, pantry overrides, notes and ids on surviving items', () => {
    const before = buildShoppingList(plan([['Monday', 'Dinner', soup, 4]])).map((i) => (
      i.name === 'Onion'
        ? { ...i, id: 'my-onion', completed: true, pantryOverride: 'need', notes: 'red ones' }
        : i
    ));
    const onion = byName(replacePlanSources(before, buildShoppingList(plan([['Monday', 'Dinner', soup, 8]])))).Onion;
    expect(onion).toMatchObject({ id: 'my-onion', completed: true, pantryOverride: 'need', notes: 'red ones' });
    expect(onion.quantityText).toBe('2');
  });

  test('drops items whose recipe left the plan, but keeps ones already bought', () => {
    const before = buildShoppingList(plan([['Monday', 'Dinner', soup, 4], ['Tuesday', 'Dinner', stew, 4]]))
      .map((i) => (i.name === 'Beef' ? { ...i, completed: true } : i));
    const after = byName(replacePlanSources(before, buildShoppingList(plan([['Monday', 'Dinner', soup, 4]]))));
    expect(after.Beef.completed).toBe(true); // bought: stays
    expect(after.Onion.quantityText).toBe('1'); // stew's 2 onions gone
    expect(Object.keys(after).sort()).toEqual(['Beef', 'Carrot', 'Onion']);
  });

  test('manual items and single-recipe adds are untouched', () => {
    const fromPlan = buildShoppingList(plan([['Monday', 'Dinner', soup, 4]]));
    const manual = { id: 'm1', name: 'Paper Towels', quantity: 1, unit: '', sources: [] };
    const withAdds = mergeShoppingItems(fromPlan.concat(manual), buildItemsFromRecipe(stew, 4, { addId: 'add-1' }));

    const after = byName(replacePlanSources(withAdds, buildShoppingList(plan([['Monday', 'Dinner', soup, 8]]))));
    expect(after['Paper Towels']).toMatchObject({ id: 'm1', quantity: 1 });
    expect(after.Beef.quantityText).toBe('500 g'); // from the single-recipe add
    // Onion: 2 from the re-scaled plan + 2 from the separately added stew, not the old plan's 1.
    expect(after.Onion.quantityText).toBe('4');
  });

  test('older items without per-source parts are replaced wholesale, not double counted', () => {
    const legacy = [{
      id: 'old-onion',
      key: 'onion',
      name: 'Onion',
      quantity: 1,
      unit: '',
      completed: false,
      notes: 'legacy',
      sources: [{ recipeTitle: 'Soup', day: 'Monday', meal: 'Dinner' }],
    }];
    const onion = byName(replacePlanSources(legacy, buildShoppingList(plan([['Monday', 'Dinner', soup, 8]])))).Onion;
    expect(onion).toMatchObject({ id: 'old-onion', notes: 'legacy', quantityText: '2' });
  });

  test('tolerates empty and malformed input', () => {
    expect(replacePlanSources(undefined, undefined)).toEqual([]);
    expect(replacePlanSources([null, 'x'], [])).toEqual([]);
  });
});
