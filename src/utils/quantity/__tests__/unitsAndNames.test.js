import { normalizeUnit, normalizeIngredientName, displayIngredientName, parseIngredientLine } from '..';

describe('normalizeUnit', () => {
  test.each([
    ['tsp', 'tsp', 'volume'], ['t', 'tsp', 'volume'], ['teaspoon', 'tsp', 'volume'], ['Teaspoons', 'tsp', 'volume'],
    ['tsp.', 'tsp', 'volume'],
    ['T', 'tbsp', 'volume'], ['Tbsp', 'tbsp', 'volume'], ['Tbsp.', 'tbsp', 'volume'], ['tbs', 'tbsp', 'volume'],
    ['tbl', 'tbsp', 'volume'], ['tablespoon', 'tbsp', 'volume'], ['Tablespoons', 'tbsp', 'volume'], ['TBSP', 'tbsp', 'volume'],
    ['cup', 'cup', 'volume'], ['cups', 'cup', 'volume'], ['Cups', 'cup', 'volume'], ['c', 'cup', 'volume'], ['c.', 'cup', 'volume'],
    ['fl oz', 'fl oz', 'volume'], ['fl. oz.', 'fl oz', 'volume'], ['fluid ounces', 'fl oz', 'volume'], ['floz', 'fl oz', 'volume'],
    ['pint', 'pint', 'volume'], ['pt', 'pint', 'volume'], ['quarts', 'quart', 'volume'], ['qt', 'quart', 'volume'],
    ['gallon', 'gallon', 'volume'], ['gal', 'gallon', 'volume'],
    ['ml', 'ml', 'volume'], ['mL', 'ml', 'volume'], ['milliliters', 'ml', 'volume'], ['millilitre', 'ml', 'volume'],
    ['l', 'l', 'volume'], ['L', 'l', 'volume'], ['liters', 'l', 'volume'], ['litre', 'l', 'volume'],
    ['g', 'g', 'weight'], ['grams', 'g', 'weight'], ['gram', 'g', 'weight'], ['gr', 'g', 'weight'],
    ['kg', 'kg', 'weight'], ['kilograms', 'kg', 'weight'],
    ['oz', 'oz', 'weight'], ['ounces', 'oz', 'weight'], ['lb', 'lb', 'weight'], ['lbs', 'lb', 'weight'],
    ['lbs.', 'lb', 'weight'], ['pounds', 'lb', 'weight'],
    ['clove', 'clove', 'count'], ['cloves', 'clove', 'count'], ['can', 'can', 'count'], ['cans', 'can', 'count'],
    ['package', 'package', 'count'], ['pkg', 'package', 'count'], ['bunch', 'bunch', 'count'], ['bunches', 'bunch', 'count'],
    ['head', 'head', 'count'], ['slice', 'slice', 'count'], ['slices', 'slice', 'count'], ['piece', 'piece', 'count'],
    ['pc', 'piece', 'count'], ['whole', 'each', 'count'], ['stick', 'stick', 'count'], ['sprigs', 'sprig', 'count'],
    ['pinch', 'pinch', 'count'], ['dash', 'dash', 'count'], ['large', 'each', 'count'], ['medium', 'each', 'count'],
    ['small', 'each', 'count'], ['', 'each', 'count'], [null, 'each', 'count'], [undefined, 'each', 'count'],
    ['can (14 oz)', 'can', 'count'],
  ])('%p -> %p (%p)', (input, unit, category) => {
    expect(normalizeUnit(input)).toEqual({ unit, category });
  });

  test('unknown units are kept (singularized), never dropped', () => {
    expect(normalizeUnit('scoops')).toEqual({ unit: 'scoop', category: 'unknown' });
    expect(normalizeUnit('Knob')).toEqual({ unit: 'knob', category: 'unknown' });
  });
});

describe('normalizeIngredientName (audit #8)', () => {
  test.each([
    ['Garlic', 'garlic'],
    ['garlic', 'garlic'],
    ['garlic cloves', 'garlic'],
    ['garlic clove', 'garlic'],
    ['cloves garlic', 'garlic'],
    ['Cloves of Garlic, minced', 'garlic'],
    ['  Garlic   Cloves ', 'garlic'],
    ['onion, diced', 'onion'],
    ['Onion (diced)', 'onion'],
    ['diced onions', 'onion'],
    ['Large Yellow Onion', 'yellow onion'],
    ['finely chopped fresh parsley', 'parsley'],
    ['tomatoes', 'tomato'],
    ['Cherry Tomatoes, halved', 'cherry tomato'],
    ['potatoes', 'potato'],
    ['berries', 'berry'],
    ['peaches', 'peach'],
    ['radishes', 'radish'],
    ['bay leaves', 'bay leaf'],
    ['olives', 'olive'],
    ['eggs', 'egg'],
    ['asparagus', 'asparagus'],
    ['hummus', 'hummus'],
    ['couscous', 'couscous'],
    ['molasses', 'molasses'],
    ['swiss', 'swiss'],
    ['Swiss cheese', 'swiss cheese'],
    ['cookies', 'cookie'],
    ['salt to taste', 'salt'],
    ['black-pepper', 'black pepper'],
    ['olive_oil', 'olive oil'],
    ['peeled and diced carrots', 'carrot'],
    ['ground cloves', 'ground clove'],
    ['', ''],
    [null, ''],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeIngredientName(input)).toBe(expected);
  });

  test('variants share one key', () => {
    const keys = new Set(['Garlic', 'garlic', 'garlic cloves', 'Garlic Clove, minced'].map(normalizeIngredientName));
    expect(keys.size).toBe(1);
  });

  test('displayIngredientName title-cases the grouping key', () => {
    expect(displayIngredientName('garlic cloves')).toBe('Garlic');
    expect(displayIngredientName('cherry tomatoes, halved')).toBe('Cherry Tomato');
    expect(displayIngredientName('cream of mushroom soup')).toBe('Cream of Mushroom Soup');
    expect(displayIngredientName('')).toBe('');
  });
});

describe('normalizeIngredientName - real imported recipe lines', () => {
  test.each([
    // A leading segment of descriptors is not the ingredient name.
    ['boneless, skinless chicken thighs', 'boneless skinless chicken thigh'],
    ['fresh, chopped parsley', 'parsley'],
    // Later segments are still prep notes.
    ['onion, diced', 'onion'],
    ['chicken breasts, cut into cubes', 'chicken breast'],
    ['garlic cloves, minced', 'garlic'],
    // Prep instructions written inside the name.
    ['large sweet onions cut in large chunks', 'sweet onion'],
    ['whole chicken, cut up', 'whole chicken'],
    ['Cayenne more or less to taste', 'cayenne'],
    ['chicken thighs bone in, skin on', 'chicken thigh'],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeIngredientName(input)).toBe(expected);
  });
});

describe('parseIngredientLine', () => {
  test('amount + unit + name', () => {
    const r = parseIngredientLine('2 1/2 cups flour, sifted');
    expect(r.amount.value).toBe(2.5);
    expect(r).toMatchObject({ unit: 'cup', category: 'volume', name: 'flour, sifted', key: 'flour' });
  });
  test('no unit -> each', () => {
    expect(parseIngredientLine('3 eggs')).toMatchObject({ unit: 'each', key: 'egg' });
  });
  test('size words are not units', () => {
    expect(parseIngredientLine('1 large onion')).toMatchObject({ unit: 'each', key: 'onion' });
  });
  test('uppercase T is tablespoon, lowercase t is teaspoon', () => {
    expect(parseIngredientLine('1 T sugar').unit).toBe('tbsp');
    expect(parseIngredientLine('1 t sugar').unit).toBe('tsp');
  });
  test('to taste lines', () => {
    const r = parseIngredientLine('a pinch of salt');
    expect(r.amount.isToTaste).toBe(true);
    expect(r.key).toBe('salt');
  });
  test('count unit', () => {
    expect(parseIngredientLine('2 cans black beans')).toMatchObject({ unit: 'can', key: 'black bean' });
  });
});

describe('accents', () => {
  test('accents are stripped for the key and the label', () => {
    expect(displayIngredientName('crème fraîche')).toBe('Creme Fraiche');
    expect(displayIngredientName('jalapeños')).toBe('Jalapeno');
    expect(normalizeIngredientName('Jalapeño')).toBe(normalizeIngredientName('jalapeno'));
  });
});

describe('chili plurals', () => {
  test.each([
    ['chilies', 'chili'], ['chilis', 'chili'], ['chillies', 'chilli'], ['chillis', 'chilli'], ['red chilies', 'red chili'],
  ])('%s -> %s', (input, key) => {
    expect(normalizeIngredientName(input)).toBe(key);
  });
});

describe('parseIngredientLine - harder shapes', () => {
  test('compound amounts share one name', () => {
    const r = parseIngredientLine('1 cup + 2 tbsp milk');
    expect(r.key).toBe('milk');
    expect(r.amounts.map((a) => [a.amount.value, a.unit])).toEqual([[1, 'cup'], [2, 'tbsp']]);
    const p = parseIngredientLine('1 cup plus 2 tablespoons milk');
    expect(p.amounts.map((a) => a.unit)).toEqual(['cup', 'tbsp']);
    expect(p.key).toBe('milk');
  });
  test('"1 and 1/2 cups" is not split', () => {
    const r = parseIngredientLine('1 and 1/2 cups flour');
    expect(r.amounts).toHaveLength(1);
    expect(r).toMatchObject({ unit: 'cup', key: 'flour' });
    expect(r.amount.value).toBe(1.5);
  });
  test('parenthetical size before the unit', () => {
    const r = parseIngredientLine('1 (14 oz) can diced tomatoes');
    expect(r).toMatchObject({ unit: 'can', key: 'tomato', sizeNote: '14 oz' });
    expect(r.amount.value).toBe(1);
  });
  test('size glued to the amount before a container', () => {
    const r = parseIngredientLine('400g can chickpeas');
    expect(r).toMatchObject({ unit: 'can', key: 'chickpea', sizeNote: '400 g' });
    expect(r.amount.value).toBe(1);
  });
  test('"N x size containers"', () => {
    const r = parseIngredientLine('2 x 400g cans chickpeas');
    expect(r).toMatchObject({ unit: 'can', key: 'chickpea' });
    expect(r.amount.value).toBe(2);
  });
  test('"N 15-ounce cans"', () => {
    const r = parseIngredientLine('2 15-ounce cans beans');
    expect(r).toMatchObject({ unit: 'can', key: 'bean' });
    expect(r.amount.value).toBe(2);
  });
  test('count unit in the name is lifted', () => {
    expect(parseIngredientLine('4 garlic cloves')).toMatchObject({ unit: 'clove', key: 'garlic' });
    expect(parseIngredientLine('1 garlic bulb')).toMatchObject({ unit: 'head', key: 'garlic' });
    // units the key keeps are not lifted
    expect(parseIngredientLine('2 cinnamon sticks')).toMatchObject({ unit: 'each', key: 'cinnamon stick' });
  });
});
