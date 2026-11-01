import {
  BUILT_IN_ALIASES,
  aliasKey,
  mergeAliases,
  resolveWith,
  validateAlias,
  applyIngredientDictionary,
  getActiveAliases,
  resolveIngredientKey,
  resetIngredientAliasesForTests,
} from '../ingredientAliases';
import { ingredientKey } from '../../services/shoppingList/buildShoppingList';
import { pantryKey } from '../pantryMatcher';

afterEach(() => resetIngredientAliasesForTests());

describe('built-in aliases', () => {
  test('every built-in uses grouping keys on both sides and never loops', () => {
    Object.entries(BUILT_IN_ALIASES).forEach(([from, to]) => {
      expect([from, aliasKey(from)]).toEqual([from, from]);
      expect([to, aliasKey(to)]).toEqual([to, to]);
      expect(resolveWith(BUILT_IN_ALIASES, from)).not.toBe(from);
    });
  });
});

describe('mergeAliases', () => {
  test('dictionary entries add, override and switch off built-ins', () => {
    const merged = mergeAliases(BUILT_IN_ALIASES, [
      { alias: 'Steel-Cut Oats', canonical: 'Irish oats', enabled: true }, // add (normalized)
      { alias: 'parmesan', canonical: 'parmigiano reggiano cheese', enabled: true }, // override
      { alias: 'double cream', canonical: 'heavy cream', enabled: false }, // switch off
      { alias: '', canonical: 'x' }, // ignored
      { alias: 'rice', canonical: 'Rice' }, // same thing: no mapping
    ]);
    expect(merged['steel cut oat']).toBe('irish oat');
    expect(merged.parmesan).toBe('parmigiano reggiano cheese');
    expect(merged).not.toHaveProperty('double cream');
    expect(merged).not.toHaveProperty('rice');
    expect(BUILT_IN_ALIASES['double cream']).toBe('heavy cream'); // built-ins untouched
  });

  test('tolerates bad input', () => {
    expect(mergeAliases({ a: 'b' }, null)).toEqual({ a: 'b' });
    expect(mergeAliases({ a: 'b' }, [null, 7, {}])).toEqual({ a: 'b' });
  });
});

describe('resolveWith', () => {
  test('follows chains and stops on loops', () => {
    expect(resolveWith({ a: 'b', b: 'c' }, 'a')).toBe('c');
    expect(resolveWith({ a: 'b', b: 'a' }, 'a')).toBe('b');
    expect(resolveWith({}, 'x')).toBe('x');
  });
});

describe('validateAlias', () => {
  test('explains blank, same-name and looping proposals', () => {
    expect(validateAlias({}, 'old fashioned oats', 'rolled oats')).toEqual([]);
    expect(validateAlias({}, '', 'rolled oats')).toEqual(['Enter the name to replace.']);
    expect(validateAlias({}, 'Oats', 'oat')).toEqual(['Both names are already the same ingredient.']);
    expect(validateAlias({ 'rolled oat': 'old fashioned oat' }, 'old fashioned oats', 'rolled oats')).toEqual([
      '"rolled oats" already becomes "old fashioned oats", so this would loop.',
    ]);
  });
});

describe('active registry: one dictionary for every list and the pantry', () => {
  test('applying the shared dictionary changes shopping-list and pantry grouping', () => {
    expect(ingredientKey('jumbo oats')).toBe('jumbo oat');
    applyIngredientDictionary([{ alias: 'jumbo oats', canonical: 'rolled oats', enabled: true }]);
    expect(getActiveAliases()['jumbo oat']).toBe('rolled oat');
    expect(ingredientKey('Jumbo Oats')).toBe('rolled oat');
    expect(pantryKey('jumbo oats')).toBe('rolled oat');
    expect(resolveIngredientKey('old fashioned oat')).toBe('rolled oat'); // built-ins still apply
  });

  test('switching off a built-in splits the names again', () => {
    applyIngredientDictionary([{ alias: 'garbanzo bean', canonical: 'chickpea', enabled: false }]);
    expect(ingredientKey('garbanzo beans')).toBe('garbanzo bean');
    expect(ingredientKey('chick peas')).toBe('chickpea');
  });
});
