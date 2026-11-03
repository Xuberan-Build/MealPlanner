import {
  collectRecipeDietTypes,
  createDietTypeIndex,
  dedupeDietTypeObjects,
  groupRecipesByDietType,
  recipeMatchesDietFilter,
} from '../collection';

const recipes = [
  { id: '1', dietType: 'vegan' },
  { id: '2', dietType: 'Vegan ' },
  { id: '3', dietType: 'VEGAN' },
  { id: '4', dietType: 'Gluten Free' },
  { id: '5', dietTypes: ['GF'] },
  { id: '6', dietType: 'gluten-free' },
  { id: '7', dietType: 'Not Specified' },
  { id: '8' },
  { id: '9', dietType: 'Keto', dietTypes: ['ketogenic', 'Dairy Free'] },
  { id: '10', dietType: 'puerto rican' },
  { id: '11', dietType: 'Sugarfree' },
  { id: '12', dietType: 'sugar free' },
  { id: '13', dietType: 'Sugar Free' },
];

describe('createDietTypeIndex', () => {
  test('one display name per key; curated name wins, else most common spelling', () => {
    const index = createDietTypeIndex(['vegan', 'VEGAN', 'Sugarfree', 'sugar free', 'Sugar Free', 'Not Specified']);
    expect(index.names).toEqual(['Sugar-Free', 'Vegan']);
    expect(index.displayName('sugarfree')).toBe('Sugar-Free');
    expect(index.displayName('Vegan ')).toBe('Vegan');
    expect(index.displayName('Not Specified')).toBeNull();
    expect(index.displayName('Soul food')).toBe('Soul Food'); // unknown -> canonical
    expect(index.has('VEGAN')).toBe(true);
    expect(index.has('keto')).toBe(false);
  });
});

describe('collectRecipeDietTypes', () => {
  test('distinct canonical names across legacy + array fields', () => {
    expect(collectRecipeDietTypes(recipes)).toEqual([
      'Dairy-Free', 'Gluten-Free', 'Keto', 'Puerto Rican', 'Sugar-Free', 'Vegan',
    ]);
  });
});

describe('groupRecipesByDietType', () => {
  test('vegan / Vegan / VEGAN are one "Vegan" group; blanks are Uncategorized', () => {
    const grouped = groupRecipesByDietType(recipes);
    const ids = (label) => (grouped[label] || []).map((r) => r.id);
    expect(Object.keys(grouped).sort()).toEqual([
      'Gluten-Free', 'Keto', 'Puerto Rican', 'Sugar-Free', 'Uncategorized', 'Vegan',
    ]);
    expect(ids('Vegan')).toEqual(['1', '2', '3']);
    expect(ids('Gluten-Free')).toEqual(['4', '5', '6']);
    expect(ids('Uncategorized')).toEqual(['7', '8']);
    expect(ids('Keto')).toEqual(['9']);
    expect(ids('Sugar-Free')).toEqual(['11', '12', '13']);
  });

  test('every recipe appears exactly once and objects are untouched', () => {
    const grouped = groupRecipesByDietType(recipes);
    const all = Object.values(grouped).flat();
    expect(all).toHaveLength(recipes.length);
    expect(all.find((r) => r.id === '1')).toBe(recipes[0]);
    expect(recipes[0].dietType).toBe('vegan');
  });

  test('a shared index keeps display names stable when grouping a subset', () => {
    const index = createDietTypeIndex(['Sugar Free', 'Sugar Free', 'Sugarfree']);
    const grouped = groupRecipesByDietType([{ id: 'x', dietType: 'Sugarfree' }], { index });
    expect(Object.keys(grouped)).toEqual(['Sugar-Free']);
  });
});

describe('recipeMatchesDietFilter', () => {
  test('matches by key against any of the recipe diet types', () => {
    expect(recipeMatchesDietFilter({ dietType: 'vegan ' }, ['Vegan'])).toBe(true);
    expect(recipeMatchesDietFilter({ dietTypes: ['GF'] }, ['Gluten-Free'])).toBe(true);
    expect(recipeMatchesDietFilter({ dietType: 'Keto', dietTypes: ['Keto', 'Dairy-Free'] }, ['dairy free'])).toBe(true);
    expect(recipeMatchesDietFilter({ dietType: 'Keto' }, ['Vegan'])).toBe(false);
    expect(recipeMatchesDietFilter({ dietType: 'Not Specified' }, ['Vegan'])).toBe(false);
    expect(recipeMatchesDietFilter({ dietType: 'Keto' }, [])).toBe(true);
  });
});

describe('dedupeDietTypeObjects', () => {
  test('merges by key, keeps the system type, records merged ids and variants', () => {
    const result = dedupeDietTypeObjects([
      { id: 'u1', name: 'vegan ', createdBy: 'user1', recipeCount: 2 },
      { id: 'vegan', name: 'Vegan', createdBy: 'system', recipeCount: 3 },
      { id: 'u2', name: 'VEGAN', createdBy: 'user2' },
      { id: 'gf', name: 'GF', createdBy: 'user1' },
      { id: 'blank', name: 'Not Specified', createdBy: 'user1' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'vegan',
      name: 'Vegan',
      key: 'vegan',
      createdBy: 'system',
      mergedIds: ['u1', 'u2'],
      variants: ['vegan ', 'Vegan', 'VEGAN'],
      recipeCount: 5,
    });
    expect(result[1]).toMatchObject({ id: 'gf', name: 'Gluten-Free', mergedIds: [] });
  });

  test('prefers an already-canonical name when there is no system type', () => {
    const result = dedupeDietTypeObjects([
      { id: 'a', name: 'sugar free', createdBy: 'u' },
      { id: 'b', name: 'Sugar-Free', createdBy: 'u' },
    ]);
    expect(result).toEqual([expect.objectContaining({ id: 'b', name: 'Sugar-Free', mergedIds: ['a'] })]);
  });

  test('does not mutate inputs', () => {
    const input = [{ id: 'a', name: 'vegan' }];
    dedupeDietTypeObjects(input);
    expect(input).toEqual([{ id: 'a', name: 'vegan' }]);
  });
});
