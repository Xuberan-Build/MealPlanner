import {
  combineQuantities,
  toFriendlyUnit,
  formatAmount,
  formatQuantity,
  combineAndFormat,
  convertQuantity,
  subtractQuantities,
} from '..';
import * as legacy from '../../quantityNormalizer';

describe('combineQuantities - audit #1 (aliases are never dropped)', () => {
  test('2 cups + 1 cup = 3 cup', () => {
    expect(combineQuantities([{ value: 2, unit: 'cups' }, { value: 1, unit: 'cup' }])).toEqual([
      { value: 3, unit: 'cup', category: 'volume', system: 'imperial' },
    ]);
  });
  test('2 cup + 1 tablespoon includes the tablespoon', () => {
    const [p] = combineQuantities([{ value: 2, unit: 'cup' }, { value: 1, unit: 'tablespoon' }]);
    expect(p.category).toBe('volume');
    expect(p.unit).toBe('ml');
    expect(p.value).toBeCloseTo(2 * 236.588 + 14.7868, 3);
  });
  test('teaspoons + T + Tbsp + tsp all merge', () => {
    const [p] = combineQuantities([
      { value: 1, unit: 'teaspoons' }, { value: 1, unit: 'T' }, { value: 1, unit: 'Tbsp' }, { value: 1, unit: 'tsp' },
    ]);
    expect(convertQuantity(p, 'tsp')).toBeCloseTo(8, 3);
  });
  test('grams + g + lbs merge as weight', () => {
    const [p] = combineQuantities([{ value: 100, unit: 'grams' }, { value: 50, unit: 'g' }, { value: 1, unit: 'lbs' }]);
    expect(p).toMatchObject({ unit: 'g', category: 'weight', system: 'imperial' });
    expect(p.value).toBeCloseTo(603.592, 3);
  });
  test('cloves + cloves merge', () => {
    expect(combineQuantities([{ value: 2, unit: 'cloves' }, { value: 3, unit: 'clove' }])).toEqual([
      { value: 5, unit: 'clove', category: 'count' },
    ]);
  });
});

describe('combineQuantities - audit #2 (never add across categories)', () => {
  test('1 cup + 100 g -> two parts, either order', () => {
    const a = combineQuantities([{ value: 1, unit: 'cup' }, { value: 100, unit: 'g' }]);
    expect(a).toEqual([
      { value: 1, unit: 'cup', category: 'volume', system: 'imperial' },
      { value: 100, unit: 'g', category: 'weight', system: 'metric' },
    ]);
    const b = combineQuantities([{ value: 100, unit: 'g' }, { value: 1, unit: 'cup' }]);
    expect(b.map((p) => p.unit)).toEqual(['g', 'cup']);
  });
  test('1 can + 1 tbsp -> two parts', () => {
    const r = combineQuantities([{ value: 1, unit: 'can' }, { value: 1, unit: 'tbsp' }]);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ value: 1, unit: 'can', category: 'count' });
    expect(r[1]).toMatchObject({ value: 1, unit: 'tbsp', category: 'volume' });
  });
  test("'each' does not merge with cloves", () => {
    const r = combineQuantities([{ value: 2, unit: 'clove' }, { value: 1, unit: '' }]);
    expect(r).toEqual([
      { value: 2, unit: 'clove', category: 'count' },
      { value: 1, unit: 'each', category: 'count' },
    ]);
  });
  test('unknown units merge only with identical unit', () => {
    const r = combineQuantities([{ value: 1, unit: 'knob' }, { value: 2, unit: 'knobs' }, { value: 1, unit: 'scoop' }]);
    expect(r).toEqual([
      { value: 3, unit: 'knob', category: 'unknown' },
      { value: 1, unit: 'scoop', category: 'unknown' },
    ]);
  });
});

describe('combineQuantities - parsing, to-taste, nothing dropped', () => {
  test('string amounts are parsed (2½, ranges, legacy {amount})', () => {
    const [p] = combineQuantities([{ amount: '2½', unit: 'cup' }, { amount: '1-2', unit: 'cups' }]);
    expect(p.value).toBe(4.5);
  });
  test('unit embedded in the amount string', () => {
    const [p] = combineQuantities([{ value: '3/4 cup', unit: '' }]);
    expect(p).toMatchObject({ value: 0.75, unit: 'cup', category: 'volume' });
  });
  test('to-taste alone -> one to-taste part', () => {
    expect(combineQuantities([{ value: '', unit: '' }, { value: 'to taste', unit: '' }])).toEqual([
      { value: null, unit: '', category: 'unknown', isToTaste: true, note: 'to taste' },
    ]);
  });
  test('to-taste absorbed by numeric amounts', () => {
    expect(combineQuantities([{ value: 'to taste' }, { value: 1, unit: 'tsp' }])).toEqual([
      { value: 1, unit: 'tsp', category: 'volume', system: 'imperial' },
    ]);
  });
  test('unparseable amounts kept as notes', () => {
    const r = combineQuantities([{ value: 'abc', unit: 'cup' }, { value: 1, unit: 'cup' }]);
    expect(r).toHaveLength(2);
    expect(r[1]).toEqual({ value: null, unit: '', category: 'unknown', isToTaste: false, note: 'abc' });
  });
  test('empty / invalid input', () => {
    expect(combineQuantities([])).toEqual([]);
    expect(combineQuantities(null)).toEqual([]);
  });
  test('all-metric mixed units stay metric', () => {
    const [p] = combineQuantities([{ value: 500, unit: 'ml' }, { value: 1, unit: 'l' }]);
    expect(p).toEqual({ value: 1500, unit: 'ml', category: 'volume', system: 'metric' });
  });
});

describe('toFriendlyUnit (audit #7)', () => {
  const vol = (value, unit, system) => ({ value, unit, category: 'volume', ...(system ? { system } : {}) });
  test.each([
    [vol(3, 'tsp'), 1, 'tbsp'],
    [vol(16, 'tbsp'), 1, 'cup'],
    [vol(0.5, 'cup'), 0.5, 'cup'],
    [vol(1 / 3, 'cup'), 1 / 3, 'cup'],
    [vol(5, 'tbsp'), 5, 'tbsp'],
    [vol(2, 'tsp'), 2, 'tsp'],
    [vol(4, 'tbsp'), 0.25, 'cup'],
    [vol(10, 'cup'), 2.5, 'quart'],
    [vol(16, 'cup'), 1, 'gallon'],
    [vol(473.176, 'ml', 'imperial'), 2, 'cup'],
    [vol(14.7868, 'ml', 'imperial'), 1, 'tbsp'],
    [vol(1500, 'ml', 'metric'), 1.5, 'l'],
    [vol(250, 'ml'), 250, 'ml'],
    [vol(473.176, 'ml', 'metric'), 473, 'ml'],
  ])('%p -> %p %p', (part, value, unit) => {
    const r = toFriendlyUnit(part);
    expect(r.unit).toBe(unit);
    expect(r.value).toBeCloseTo(value, 6);
  });

  test('weight', () => {
    expect(toFriendlyUnit({ value: 1200, unit: 'g', category: 'weight', system: 'metric' })).toMatchObject({ value: 1.2, unit: 'kg' });
    expect(toFriendlyUnit({ value: 250, unit: 'g', category: 'weight' })).toMatchObject({ value: 250, unit: 'g' });
    expect(toFriendlyUnit({ value: 8, unit: 'oz', category: 'weight' })).toMatchObject({ value: 8, unit: 'oz' });
    expect(toFriendlyUnit({ value: 24, unit: 'oz', category: 'weight' })).toMatchObject({ value: 1.5, unit: 'lb' });
    expect(toFriendlyUnit({ value: 603.592, unit: 'g', category: 'weight', system: 'imperial' })).toMatchObject({ unit: 'lb', value: 4 / 3 });
  });

  test('count rounds, keeps unit; null passes through', () => {
    expect(toFriendlyUnit({ value: 1.3333333, unit: 'clove', category: 'count' })).toEqual({ value: 4 / 3, unit: 'clove', category: 'count' });
    const tt = { value: null, unit: '', category: 'unknown', isToTaste: true };
    expect(toFriendlyUnit(tt)).toBe(tt);
  });
});

describe('formatAmount (audit #7, #10)', () => {
  test.each([
    [10, '10'], [100, '100'], [20, '20'], [1, '1'], [0, '0'],
    [1.5, '1 1/2'], [0.5, '1/2'], [0.3333333, '1/3'], [0.6666667, '2/3'], [0.25, '1/4'], [0.125, '1/8'],
    [2.75, '2 3/4'], [0.875, '7/8'], [0.99, '1'], [12.4, '12 1/2'], [0.01, '1/8'],
  ])('imperial %p -> %p', (value, expected) => {
    expect(formatAmount(value)).toBe(expected);
  });
  test('metric decimals', () => {
    expect(formatAmount(473.176, 'metric')).toBe('473.18');
    expect(formatAmount(10, 'metric')).toBe('10');
    expect(formatAmount(1.5, 'metric')).toBe('1.5');
  });
  test('invalid -> empty', () => {
    expect(formatAmount(null)).toBe('');
    expect(formatAmount(NaN)).toBe('');
    expect(formatAmount(Infinity)).toBe('');
  });
});

describe('formatQuantity', () => {
  test('mixed categories joined with +', () => {
    expect(formatQuantity([
      { value: 1.5, unit: 'cup', category: 'volume' },
      { value: 100, unit: 'g', category: 'weight' },
    ])).toBe('1 1/2 cups + 100 g');
  });
  test('pluralization', () => {
    expect(formatQuantity({ value: 1, unit: 'cup', category: 'volume' })).toBe('1 cup');
    expect(formatQuantity({ value: 0.5, unit: 'cup', category: 'volume' })).toBe('1/2 cup');
    expect(formatQuantity({ value: 3, unit: 'clove', category: 'count' })).toBe('3 cloves');
    expect(formatQuantity({ value: 2, unit: 'bunch', category: 'count' })).toBe('2 bunches');
    expect(formatQuantity({ value: 2, unit: 'tbsp', category: 'volume' })).toBe('2 tbsp');
    expect(formatQuantity({ value: 2, unit: 'lb', category: 'weight' })).toBe('2 lb');
    expect(formatQuantity({ value: 3, unit: 'each', category: 'count' })).toBe('3');
    expect(formatQuantity({ value: 2, unit: 'knob', category: 'unknown' })).toBe('2 knobs');
  });
  test('to-taste and notes', () => {
    expect(formatQuantity([{ value: null, unit: '', category: 'unknown', isToTaste: true }])).toBe('to taste');
    expect(formatQuantity([{ value: null, unit: '', category: 'unknown', isToTaste: true, note: 'a pinch' }])).toBe('a pinch');
  });
  test('combineAndFormat end-to-end', () => {
    expect(combineAndFormat([{ value: 2, unit: 'cups' }, { value: 1, unit: 'cup' }]).display).toBe('3 cups');
    expect(combineAndFormat([{ value: 1, unit: 'tsp' }, { value: 2, unit: 'teaspoons' }]).display).toBe('1 tbsp');
    expect(combineAndFormat([{ value: 1, unit: 'cup' }, { value: 100, unit: 'g' }]).display).toBe('1 cup + 100 g');
    expect(combineAndFormat([{ value: 500, unit: 'ml' }, { value: 1, unit: 'L' }]).display).toBe('1.5 L');
    expect(combineAndFormat([{ value: '', unit: '' }]).display).toBe('to taste');
    expect(combineAndFormat([]).display).toBe('');
  });
  test('scaled thirds do not show float noise', () => {
    expect(combineAndFormat([{ value: 1 / 3, unit: 'cup' }]).display).toBe('1/3 cup');
  });
});

describe('convertQuantity / subtractQuantities', () => {
  test('convertQuantity', () => {
    expect(convertQuantity({ value: 1, unit: 'cup' }, 'tbsp')).toBeCloseTo(16, 2);
    expect(convertQuantity({ value: 1, unit: 'lb' }, 'ounces')).toBeCloseTo(16, 2);
    expect(convertQuantity({ value: 1, unit: 'cup' }, 'g')).toBeNull();
    expect(convertQuantity({ value: 2, unit: 'clove' }, 'cloves')).toBe(2);
  });
  test('need 2 cups, have 1 cup -> 1 cup left', () => {
    const r = subtractQuantities([{ value: 2, unit: 'cup' }], [{ value: 1, unit: 'cup' }]);
    expect(r.covered).toBe(false);
    expect(r.remaining).toEqual([{ value: 1, unit: 'cup', category: 'volume', system: 'imperial' }]);
  });
  test('need 1 cup, have 1 l -> covered', () => {
    expect(subtractQuantities([{ value: 1, unit: 'cup' }], [{ value: 1, unit: 'l' }])).toEqual({ remaining: [], covered: true });
  });
  test('have unquantified -> covered', () => {
    expect(subtractQuantities([{ value: 3, unit: 'clove' }], [{ value: '', unit: '' }]).covered).toBe(true);
  });
  test('different categories are not subtracted', () => {
    const r = subtractQuantities([{ value: 1, unit: 'cup' }, { value: 100, unit: 'g' }], [{ value: 200, unit: 'g' }]);
    expect(r.remaining).toEqual([{ value: 1, unit: 'cup', category: 'volume', system: 'imperial' }]);
  });
  test('nothing on hand', () => {
    expect(subtractQuantities([{ value: 1, unit: 'cup' }], []).covered).toBe(false);
  });
});

describe('legacy quantityNormalizer wrappers', () => {
  test('parseFraction handles audit cases, never NaN/Infinity', () => {
    expect(legacy.parseFraction('2½')).toBe(2.5);
    expect(legacy.parseFraction('½')).toBe(0.5);
    expect(legacy.parseFraction('1-2')).toBe(2);
    expect(legacy.parseFraction('3/4 cup')).toBe(0.75);
    expect(legacy.parseFraction('a pinch')).toBe(0);
    expect(legacy.parseFraction('1/0')).toBe(0);
    expect(legacy.parseFraction(3)).toBe(3);
  });
  test('formatQuantity integer-zero bug fixed', () => {
    expect(legacy.formatQuantity(10, 'cup')).toBe('10 cup');
    expect(legacy.formatQuantity(100, 'g')).toBe('100 g');
    expect(legacy.formatQuantity(2.5, '')).toBe('2.5');
    expect(legacy.formatQuantity(0, 'cup')).toBe('');
    expect(legacy.formatQuantity([{ value: 1.5, unit: 'cup', category: 'volume' }])).toBe('1 1/2 cups');
  });
  test('combineQuantities keeps old shape and drops nothing', () => {
    const r = legacy.combineQuantities([{ amount: 2, unit: 'cups' }, { amount: 1, unit: 'cup' }]);
    expect(r).toMatchObject({ amount: 3, unit: 'cup', display: '3 cups' });
    const mixed = legacy.combineQuantities([{ amount: 1, unit: 'cup' }, { amount: 100, unit: 'g' }]);
    expect(mixed.parts).toHaveLength(2);
    expect(mixed.display).toBe('1 cup + 100 g');
    expect(legacy.combineQuantities([])).toMatchObject({ amount: 0, unit: '' });
  });
  test('getUnitCategory / normalizeQuantity alias-aware', () => {
    expect(legacy.getUnitCategory('Cups')).toBe('volume');
    expect(legacy.getUnitCategory('lbs')).toBe('weight');
    expect(legacy.getUnitCategory('can')).toBe('units');
    expect(legacy.getUnitCategory('knob')).toBeNull();
    expect(legacy.getUnitCategory(undefined)).toBeNull();
    expect(legacy.normalizeQuantity(2, 'tablespoons')).toMatchObject({ unit: 'ml', category: 'volume' });
    expect(legacy.normalizeQuantity(2, 'tablespoons').amount).toBeCloseTo(29.5736, 3);
    expect(legacy.UNIT_CONVERSIONS.volume.cup).toBe(236.588);
  });
});

describe('unknown units ending in -sses', () => {
  test('glass + glasses merge', () => {
    const parts = combineQuantities([{ amount: '1', unit: 'glass' }, { amount: '2', unit: 'glasses' }]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ value: 3, unit: 'glass' });
  });
});
