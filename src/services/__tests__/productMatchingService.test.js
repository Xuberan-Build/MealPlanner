import { getCatalogEntries } from '../productCatalogService';
import {
  matchIngredientToProducts,
  matchItemsBatch,
  batchMatchIngredients,
  rankProductsForIngredient
} from '../productMatchingService';

jest.mock('../productCatalogService', () => {
  const actual = jest.requireActual('../productCatalogService');
  return { ...actual, getCatalogEntries: jest.fn() };
});

jest.mock('../../firebase', () => ({ app: {}, db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));
jest.mock('../openFoodFactsService', () => ({ searchProducts: jest.fn() }));

const makeProduct = (overrides = {}) => ({
  barcode: '000',
  productName: 'Product',
  brands: [],
  categories: [],
  nutritionGrade: '',
  ...overrides
});

const catalog = {
  milk: [
    makeProduct({ barcode: '1', productName: 'Whole Milk', categories: ['Dairy'], nutritionGrade: 'b' }),
    makeProduct({ barcode: '2', productName: 'Chocolate cookies' }),
    makeProduct({ barcode: '3', productName: 'Milk', brands: ['Horizon'], nutritionGrade: 'a' })
  ],
  egg: [makeProduct({ barcode: '4', productName: 'Large Eggs', categories: ['Eggs'] })],
  saffron: []
};

beforeEach(() => {
  jest.clearAllMocks();
  getCatalogEntries.mockImplementation(async (names) => {
    const { toCatalogKey } = jest.requireActual('../productCatalogService');
    return new Map(names.map((n) => {
      const key = toCatalogKey(n);
      const products = catalog[key];
      return [key, products
        ? { status: products.length ? 'ok' : 'empty', products, source: 'catalog' }
        : { status: 'unavailable', products: [], source: 'unavailable' }];
    }));
  });
});

describe('matchIngredientToProducts', () => {
  it('scores catalog candidates and keeps the result shape', async () => {
    const matches = await matchIngredientToProducts({ name: 'Milk' });

    expect(getCatalogEntries).toHaveBeenCalledWith(['Milk'], { useMemoryCache: true });
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((m) => {
      expect(Object.keys(m).sort()).toEqual(['confidence', 'product', 'reason', 'score']);
      expect(['high', 'medium', 'low']).toContain(m.confidence);
      expect(m.score).toBeGreaterThanOrEqual(0.3);
    });
    const scores = matches.map((m) => m.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(matches[0].product.productName).toBe('Whole Milk');
    expect(matches.map((m) => m.product.barcode)).not.toContain('2');
  });

  it('honours minScore and maxResults', async () => {
    const all = await matchIngredientToProducts({ name: 'milk' }, { minScore: 0 });
    expect(all).toHaveLength(3);
    const one = await matchIngredientToProducts({ name: 'milk' }, { minScore: 0, maxResults: 1 });
    expect(one).toHaveLength(1);
  });

  it('passes useCache through to the catalog', async () => {
    await matchIngredientToProducts({ name: 'milk' }, { useCache: false });
    expect(getCatalogEntries).toHaveBeenCalledWith(['milk'], { useMemoryCache: false });
  });

  it('returns [] for empty or unavailable entries', async () => {
    expect(await matchIngredientToProducts({ name: 'saffron' })).toEqual([]);
    expect(await matchIngredientToProducts({ name: 'dragonfruit' })).toEqual([]);
  });

  it('still throws when the ingredient name is missing', async () => {
    await expect(matchIngredientToProducts({})).rejects.toThrow('Ingredient name is required');
  });

  it('never calls OpenFoodFacts', async () => {
    const off = require('../openFoodFactsService');
    await matchIngredientToProducts({ name: 'milk' });
    expect(off.searchProducts).not.toHaveBeenCalled();
  });
});

describe('matchItemsBatch', () => {
  it('makes exactly one catalog request for N items', async () => {
    const items = [
      { id: 'a', name: 'milk' },
      { id: 'b', name: 'eggs' },
      { id: 'c', name: 'saffron' },
      { id: 'd', name: 'dragonfruit' },
      { id: 'e', name: '' }
    ];

    const result = await matchItemsBatch(items);

    expect(getCatalogEntries).toHaveBeenCalledTimes(1);
    expect(getCatalogEntries.mock.calls[0][0]).toEqual(['milk', 'eggs', 'saffron', 'dragonfruit']);
    expect([...result.keys()]).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.get('a')[0].product.productName).toBe('Whole Milk');
    expect(result.get('b')[0].product.barcode).toBe('4');
    expect(result.get('c')).toEqual([]);
    expect(result.get('e')).toEqual([]);
  });

  it('matches the single-item path for each item', async () => {
    const single = await matchIngredientToProducts({ name: 'milk' });
    const batch = await matchItemsBatch([{ id: 'x', name: 'milk' }]);
    expect(batch.get('x')).toEqual(single);
  });

  it('returns an empty Map for no items without a catalog request', async () => {
    expect((await matchItemsBatch([])).size).toBe(0);
    expect(getCatalogEntries).not.toHaveBeenCalled();
  });
});

describe('batchMatchIngredients', () => {
  it('delegates to one catalog request and returns an object keyed by name', async () => {
    const result = await batchMatchIngredients([{ name: 'milk' }, { name: 'eggs' }]);
    expect(getCatalogEntries).toHaveBeenCalledTimes(1);
    expect(Object.keys(result)).toEqual(['milk', 'eggs']);
    expect(result.milk[0].product.productName).toBe('Whole Milk');
  });

  it('returns {} for empty input', async () => {
    expect(await batchMatchIngredients([])).toEqual({});
  });
});

describe('name similarity', () => {
  test('plurals score the same as their singular ("eggs" vs "egg")', () => {
    const product = makeProduct({ barcode: 'e1', productName: 'Large Egg' });
    const score = (name) => rankProductsForIngredient({ name }, [product], { minScore: 0 })[0].score;
    expect(score('eggs')).toBeGreaterThan(0);
    expect(score('eggs')).toBeCloseTo(score('egg'));
    expect(score('Eggs')).toBeCloseTo(score('egg'));
  });

  test('a word inside another word is not a match ("egg" vs "Eggplant")', () => {
    const [eggplant] = rankProductsForIngredient(
      { name: 'egg' },
      [makeProduct({ barcode: 'p1', productName: 'Eggplant' })],
      { minScore: 0 }
    );
    const [egg] = rankProductsForIngredient(
      { name: 'egg' },
      [makeProduct({ barcode: 'e2', productName: 'Free Range Eggs' })],
      { minScore: 0 }
    );
    expect(egg.score).toBeGreaterThan(eggplant ? eggplant.score : 0);
  });
});

describe('rankProductsForIngredient', () => {
  it('is pure and tolerates bad input', () => {
    expect(rankProductsForIngredient({ name: 'milk' }, null)).toEqual([]);
    expect(rankProductsForIngredient(null, catalog.milk)).toEqual([]);
    expect(rankProductsForIngredient({ name: 'milk' }, [null, ...catalog.milk]).length).toBeGreaterThan(0);
  });
});
