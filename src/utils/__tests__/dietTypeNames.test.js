import { dietTypeNames } from '../dietTypeNames';

describe('dietTypeNames', () => {
  test('accepts diet-type objects and legacy strings', () => {
    expect(dietTypeNames([{ id: 'vegan', name: 'Vegan' }, 'Keto', { name: ' Paleo ' }])).toEqual([
      'Vegan',
      'Keto',
      'Paleo',
    ]);
  });

  test('drops blanks, duplicates and malformed entries', () => {
    expect(dietTypeNames([{ name: 'Vegan' }, 'Vegan', '', null, {}, { name: 42 }, 7])).toEqual(['Vegan']);
  });

  test('non-arrays give an empty list', () => {
    expect(dietTypeNames(undefined)).toEqual([]);
    expect(dietTypeNames({ name: 'Vegan' })).toEqual([]);
  });
});
