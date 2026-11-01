import { pickRecipesForSlot } from '../recipePicker';

const recipes = [
  { id: '1', title: 'Tacos', mealType: 'Dinner', dietType: 'Mexican', prepTime: '20 mins' },
  { id: '2', title: 'Chicken & Broccoli Bowl', mealType: 'Lunch', prepTime: '30' },
  { id: '3', title: 'Pancakes', mealType: 'Breakfast', prepTime: '15' },
  { id: '4', title: 'Mystery Stew' },
  { id: '5', kind: 'plate', title: 'Steak night', mealType: 'Dinner' },
  { id: '6', title: 'Apple Salad', mealType: 'dinner', prepTime: '90 min' },
];

const titles = (list) => list.map((r) => r.title);

test('recipes for this meal come first; every other recipe is still offered', () => {
  const { matching, others } = pickRecipesForSlot(recipes, { mealType: 'Dinner' });
  expect(titles(matching)).toEqual(['Apple Salad', 'Tacos']); // case-insensitive, alphabetical
  expect(titles(others)).toEqual(['Chicken & Broccoli Bowl', 'Mystery Stew', 'Pancakes']);
});

test('saved plates are never in the recipe lists', () => {
  const { matching, others } = pickRecipesForSlot(recipes, { mealType: 'Dinner' });
  expect([...matching, ...others].some((r) => r.kind === 'plate')).toBe(false);
});

test('filters apply to both lists', () => {
  expect(titles(pickRecipesForSlot(recipes, { mealType: 'Dinner', dietFilter: 'mexican' }).matching)).toEqual(['Tacos']);
  const quick = pickRecipesForSlot(recipes, { mealType: 'Dinner', prepFilter: 'quick' });
  expect(titles(quick.matching)).toEqual(['Tacos']);
  expect(titles(quick.others)).toEqual(['Pancakes']);
});

test('search finds a lunch recipe from a dinner slot', () => {
  const { matching, others } = pickRecipesForSlot(recipes, { mealType: 'Dinner', searchTerm: 'broccoli' });
  expect(matching).toEqual([]);
  expect(titles(others)).toEqual(['Chicken & Broccoli Bowl']);
});

test('tolerates missing input', () => {
  expect(pickRecipesForSlot(undefined)).toEqual({ matching: [], others: [] });
  expect(pickRecipesForSlot([null], { mealType: 'Lunch' })).toEqual({ matching: [], others: [] });
});
