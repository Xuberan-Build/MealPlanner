import { findFreshness, freshnessFor, aisleShelfLife } from '../freshnessTable';
import { normalizeList } from '../../listModel';

const fresh = (name) => freshnessFor(normalizeList([{ name, quantity: 1 }])[0]);

describe('freshness table', () => {
  test.each([
    ['salmon fillets', 2],
    ['shrimp', 2],
    ['ground beef', 2],
    ['boneless skinless chicken breasts', 2],
    ['pork chops', 3],
    ['strawberries', 3],
    ['baby spinach', 5],
    ['fresh basil leaves', 5],
    ['mushrooms', 5],
    ['sourdough bread', 4],
    ['whole milk', 7],
    ['feta cheese', 7],
    ['large eggs', 21],
    ['carrots', 21],
    ['lemons', 14],
  ])('%s keeps about %i days', (name, days) => {
    expect(fresh(name).shelfLifeDays).toBe(days);
  });

  test.each(['onion', 'potatoes', 'garlic cloves', 'rice', 'canned peaches', 'dried basil', 'frozen peas', 'ground cumin', 'coconut milk', 'black pepper'])(
    '%s keeps all week',
    (name) => {
      expect(fresh(name)).toEqual({ shelfLifeDays: null, ripenDays: null });
    }
  );

  test.each([
    ['avocados', 3],
    ['bananas', 3],
    ['peaches', 3],
    ['mango', 3],
    ['Roma tomatoes', 2],
  ])('%s is bought firm and ripens in %i days', (name, days) => {
    expect(fresh(name).ripenDays).toBe(days);
  });

  test('cherry tomatoes are not ripening fruit (longest suffix wins)', () => {
    expect(findFreshness('cherry tomato')).toEqual({ shelfLifeDays: 5, ripenDays: null });
  });

  test('unknown names fall back to their aisle', () => {
    expect(findFreshness('zorblax')).toBeNull();
    expect(aisleShelfLife('meat-seafood', 'Fish & Seafood')).toBe(2);
    expect(aisleShelfLife('produce')).toBe(7);
    expect(aisleShelfLife('canned-jarred')).toBeNull();
    expect(freshnessFor({ key: 'zorblax', aisleId: 'bakery' }).shelfLifeDays).toBe(4);
  });
});
