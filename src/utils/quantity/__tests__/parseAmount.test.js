import { parseAmount, parseServings, servingScale, computeServingMultiplier, scaleQuantity } from '..';

const v = (x) => parseAmount(x).value;

describe('parseAmount - plain numbers & fractions', () => {
  test.each([
    [2, 2],
    [1.5, 1.5],
    ['2', 2],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['1/2', 0.5],
    ['2 1/2', 2.5],
    ['2-1/2', 2.5],
    ['1 - 1/2', 1.5],
    ['  3/4  ', 0.75],
  ])('%p -> %p', (input, expected) => {
    expect(v(input)).toBeCloseTo(expected, 6);
    expect(parseAmount(input).isToTaste).toBe(false);
  });

  test('raw keeps original input', () => {
    expect(parseAmount('2½').raw).toBe('2½');
    expect(parseAmount(3).raw).toBe('3');
  });
});

describe('parseAmount - unicode fractions (audit #3)', () => {
  test.each([
    ['2½', 2.5],
    ['2 ½', 2.5],
    ['½', 0.5],
    ['¼', 0.25],
    ['¾', 0.75],
    ['⅓', 1 / 3],
    ['⅔', 2 / 3],
    ['⅛', 0.125],
    ['⅜', 0.375],
    ['⅝', 0.625],
    ['⅞', 0.875],
    ['⅙', 1 / 6],
    ['⅚', 5 / 6],
    ['⅕', 0.2],
    ['1⅓', 4 / 3],
    ['1⁄2', 0.5],
  ])('%p -> %p', (input, expected) => {
    expect(v(input)).toBeCloseTo(expected, 5);
  });
});

describe('parseAmount - ranges', () => {
  test.each([
    ['1-2', 1, 2],
    ['1 – 2', 1, 2],
    ['1 — 2', 1, 2],
    ['1 to 2', 1, 2],
    ['1 or 2', 1, 2],
    ['1/2-1', 0.5, 1],
    ['1 1/2 - 2', 1.5, 2],
    ['½-1', 0.5, 1],
    ['3-2', 2, 3],
  ])('%p -> min %p max %p, value = max', (input, min, max) => {
    const p = parseAmount(input);
    expect(p.min).toBeCloseTo(min, 6);
    expect(p.max).toBeCloseTo(max, 6);
    expect(p.value).toBeCloseTo(max, 6);
  });

  test('non-range has no min/max', () => {
    const p = parseAmount('2');
    expect(p.min).toBeUndefined();
    expect(p.max).toBeUndefined();
  });
});

describe('parseAmount - trailing text & words', () => {
  test('"3/4 cup" -> 0.75 with rest "cup"', () => {
    const p = parseAmount('3/4 cup');
    expect(p.value).toBe(0.75);
    expect(p.rest).toBe('cup');
  });
  test('"2 tomatoes" does not parse "to" as a range', () => {
    const p = parseAmount('2 tomatoes');
    expect(p.value).toBe(2);
    expect(p.max).toBeUndefined();
    expect(p.rest).toBe('tomatoes');
  });
  test.each([
    ['one', 1],
    ['two', 2],
    ['twelve', 12],
    ['a', 1],
    ['an', 1],
    ['a cup', 1],
    ['half', 0.5],
    ['a half', 0.5],
    ['half a cup', 0.5],
    ['dozen', 12],
    ['a dozen', 12],
    ['two dozen', 24],
    ['half dozen', 6],
    ['half a dozen', 6],
    ['2 dozen', 24],
    ['one and a half', 1.5],
    ['a couple', 2],
    ['about 2', 2],
    ['approximately 3 cups', 3],
  ])('%p -> %p', (input, expected) => {
    expect(v(input)).toBeCloseTo(expected, 6);
  });
});

describe('parseAmount - to taste / blank', () => {
  test.each(['', '   ', null, undefined, 'to taste', 'To Taste', 'a pinch', 'pinch', 'as needed',
    'optional', 'a dash', 'some', 'salt to taste', 'for garnish', '-'])('%p -> isToTaste, value null', (input) => {
    const p = parseAmount(input);
    expect(p.isToTaste).toBe(true);
    expect(p.value).toBeNull();
  });

  test('"1 pinch" is a real number', () => {
    expect(parseAmount('1 pinch')).toMatchObject({ value: 1, isToTaste: false, rest: 'pinch' });
  });
});

describe('parseAmount - never NaN / Infinity', () => {
  test.each(['1/0', '2 1/0', '0/0', 'abc', 'NaN', 'Infinity', NaN, Infinity, -Infinity, -2])('%p -> null', (input) => {
    const p = parseAmount(input);
    expect(p.value).toBeNull();
    expect(Number.isNaN(p.value)).toBe(false);
  });
  test('garbage is not to-taste (display raw instead)', () => {
    expect(parseAmount('abc')).toMatchObject({ value: null, isToTaste: false, raw: 'abc' });
  });
  test('0 is a valid zero', () => {
    expect(v(0)).toBe(0);
    expect(v('0')).toBe(0);
  });
  test('idempotent on parsed objects', () => {
    const p = parseAmount('1-2');
    expect(parseAmount(p)).toBe(p);
  });
});

describe('parseServings (audit #5) - ranges use LOWER bound', () => {
  test.each([
    [4, 4],
    ['4', 4],
    ['4 servings', 4],
    ['serves 4', 4],
    ['Serves: 4 people', 4],
    ['Servings: 6', 6],
    ['makes 12', 12],
    ['four', 4],
    ['4-6', 4],
    ['4 – 6', 4],
    ['4 to 6', 4],
    ['serves 4-6', 4],
    ['2.5', 2.5],
    ['-4', 4], // lost lower bound from import ("2-4" -> "-4")
    ['–2', 2],
  ])('%p -> %p', (input, expected) => {
    expect(parseServings(input)).toBe(expected);
  });

  test.each(['', '0', 0, null, undefined, 'garbage', -2, NaN, 'to taste', '1/0'])('%p -> null', (input) => {
    expect(parseServings(input)).toBeNull();
  });

  test('servingScale flags unknown base instead of silently using 1', () => {
    expect(servingScale(8, '4-6')).toEqual({ multiplier: 2, target: 8, base: 4, reliable: true });
    expect(servingScale(4, '')).toEqual({ multiplier: 1, target: 4, base: null, reliable: false });
    expect(servingScale(4, '0').reliable).toBe(false);
    expect(computeServingMultiplier('2', '4 servings')).toBe(0.5);
    expect(computeServingMultiplier(2, 'garbage')).toBe(1);
  });
});

describe('scaleQuantity', () => {
  test('numbers', () => {
    expect(scaleQuantity(2, 1.5)).toBe(3);
    expect(scaleQuantity(1 / 3, 3)).toBe(1);
  });
  test('strings are parsed then scaled (fixes "1/2" * ratio = NaN, audit #6)', () => {
    expect(scaleQuantity('1/2', 2).value).toBe(1);
    expect(scaleQuantity('2½', 2).value).toBe(5);
  });
  test('ranges scale min & max', () => {
    const s = scaleQuantity('1-2', 2);
    expect(s).toMatchObject({ value: 4, min: 2, max: 4 });
  });
  test('to-taste stays null, never NaN', () => {
    const s = scaleQuantity('to taste', 3);
    expect(s.value).toBeNull();
    expect(s.isToTaste).toBe(true);
  });
  test('invalid multiplier treated as 1', () => {
    expect(scaleQuantity(2, NaN)).toBe(2);
    expect(scaleQuantity(2, 0)).toBe(2);
    expect(scaleQuantity(2, 'abc')).toBe(2);
    expect(scaleQuantity(2, '2')).toBe(4);
  });
  test('parts and arrays of parts', () => {
    expect(scaleQuantity({ value: 2, unit: 'cup', category: 'volume' }, 2)).toEqual({ value: 4, unit: 'cup', category: 'volume' });
    expect(scaleQuantity([{ value: 1, unit: 'g' }, { value: null, unit: '' }], 3)).toEqual([
      { value: 3, unit: 'g' },
      { value: null, unit: '' },
    ]);
  });
});

describe('parseAmount - separators and "and"', () => {
  test('decimal comma', () => {
    expect(v('1,5')).toBe(1.5);
    expect(parseAmount('1,5 kg')).toMatchObject({ value: 1.5, rest: 'kg' });
    expect(v('0,25')).toBe(0.25);
  });
  test('thousands separator', () => {
    expect(v('1,000')).toBe(1000);
    expect(parseAmount('1,000 ml')).toMatchObject({ value: 1000, rest: 'ml' });
    expect(v('12,500,000')).toBe(12500000);
  });
  test('"N and 1/2" is a mixed number', () => {
    expect(v('1 and 1/2')).toBe(1.5);
    expect(parseAmount('2 and 3/4 cups')).toMatchObject({ value: 2.75, rest: 'cups' });
  });
});
