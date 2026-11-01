import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  toCatalogKey,
  getCatalogEntries,
  getCatalogEntry,
  isStale,
  clearCatalogCache,
  CALLABLE_TIMEOUT_MS
} from '../productCatalogService';

jest.mock('../../firebase', () => ({ app: {}, db: {} }));

jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn()
}));

const mockCallable = jest.fn();

const DAY = 24 * 60 * 60 * 1000;
const ts = (msAgo) => ({ toMillis: () => Date.now() - msAgo });
const product = (name) => ({ barcode: name, productName: name, brands: [], categories: [] });

/** catalog: { key: docData } */
const mockCatalog = (catalog) => {
  getDoc.mockImplementation(async (ref) => ({
    exists: () => Boolean(catalog[ref.id]),
    data: () => catalog[ref.id]
  }));
};

/** Callable that returns 'ok' with one product for every requested key. */
const mockCallableFillsAll = () => {
  mockCallable.mockImplementation(async ({ keys }) => ({
    data: {
      entries: Object.fromEntries(keys.map((k) => [k, { status: 'ok', products: [product(k)] }])),
      errors: {}
    }
  }));
};

// CRA enables resetMocks, so implementations are (re)installed before every test.
beforeEach(() => {
  jest.clearAllMocks();
  clearCatalogCache();
  doc.mockImplementation((db, collection, id) => ({ collection, id }));
  getFunctions.mockReturnValue({ name: 'functions' });
  httpsCallable.mockReturnValue(mockCallable);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  console.warn.mockRestore();
});

describe('toCatalogKey', () => {
  it.each([
    ['All-Purpose Flour', 'all-purpose-flour'],
    ['garlic cloves', 'garlic'],
    ['Chicken Breasts', 'chicken-breast'],
    ['  ', ''],
    [undefined, '']
  ])('%p -> %p', (name, key) => {
    expect(toCatalogKey(name)).toBe(key);
  });
});

describe('isStale', () => {
  it('ok docs go stale after 30 days, empty after 7', () => {
    expect(isStale({ status: 'ok', updatedAt: ts(29 * DAY) })).toBe(false);
    expect(isStale({ status: 'ok', updatedAt: ts(31 * DAY) })).toBe(true);
    expect(isStale({ status: 'empty', updatedAt: ts(6 * DAY) })).toBe(false);
    expect(isStale({ status: 'empty', updatedAt: ts(8 * DAY) })).toBe(true);
    expect(isStale({ status: 'ok' })).toBe(true);
  });
});

describe('getCatalogEntries', () => {
  it('serves fresh Firestore docs without calling the function', async () => {
    mockCatalog({ milk: { status: 'ok', products: [product('Milk')], updatedAt: ts(DAY) } });

    const result = await getCatalogEntries(['Milk', 'milk']);

    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(doc).toHaveBeenCalledWith({}, 'productCatalog', 'milk');
    expect(mockCallable).not.toHaveBeenCalled();
    expect(result.get('milk')).toEqual({
      status: 'ok', products: [product('Milk')], source: 'catalog'
    });
  });

  it('serves the in-memory cache on a second request without touching Firestore', async () => {
    mockCatalog({ milk: { status: 'ok', products: [product('Milk')], updatedAt: ts(DAY) } });
    await getCatalogEntries(['milk']);
    getDoc.mockClear();

    const result = await getCatalogEntries(['Milk']);

    expect(getDoc).not.toHaveBeenCalled();
    expect(mockCallable).not.toHaveBeenCalled();
    expect(result.get('milk').source).toBe('cache');
  });

  it('bypasses the memory cache when useMemoryCache is false', async () => {
    mockCatalog({ milk: { status: 'ok', products: [], updatedAt: ts(DAY) } });
    await getCatalogEntries(['milk']);
    await getCatalogEntries(['milk'], { useMemoryCache: false });
    expect(getDoc).toHaveBeenCalledTimes(2);
  });

  it('sends missing and stale keys to the callable, keeping fresh ones local', async () => {
    mockCatalog({
      milk: { status: 'ok', products: [product('Milk')], updatedAt: ts(DAY) },
      egg: { status: 'ok', products: [product('Old egg')], updatedAt: ts(40 * DAY) },
      saffron: { status: 'empty', products: [], updatedAt: ts(10 * DAY) }
    });
    mockCallableFillsAll();

    const result = await getCatalogEntries(['milk', 'eggs', 'saffron', 'tofu']);

    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockCallable.mock.calls[0][0].keys.sort()).toEqual(['egg', 'saffron', 'tofu']);
    expect(result.get('milk').source).toBe('catalog');
    expect(result.get('egg')).toEqual({ status: 'ok', products: [product('egg')], source: 'function' });
    expect(result.get('tofu').source).toBe('function');
  });

  it('chunks callable requests by 30 keys', async () => {
    mockCatalog({});
    mockCallableFillsAll();
    const names = Array.from({ length: 65 }, (_, i) => `item${i}`);

    const result = await getCatalogEntries(names);

    expect(mockCallable).toHaveBeenCalledTimes(3);
    expect(mockCallable.mock.calls.map(([arg]) => arg.keys.length)).toEqual([30, 30, 5]);
    expect(result.size).toBe(65);
    expect([...result.values()].every((e) => e.source === 'function')).toBe(true);
  });

  it('creates the callable with a short timeout', async () => {
    mockCatalog({});
    mockCallableFillsAll();
    await getCatalogEntries(['tofu']);
    expect(httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'lookupCatalogProducts', {
      timeout: CALLABLE_TIMEOUT_MS
    });
  });

  it('resolves keys as unavailable after one failed attempt, then stops calling', async () => {
    mockCatalog({});
    mockCallable.mockRejectedValue(Object.assign(new Error('not found'), { code: 'functions/not-found' }));

    const first = await getCatalogEntries(['tofu', 'tempeh']);

    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(first.get('tofu')).toEqual({ status: 'unavailable', products: [], source: 'unavailable' });
    expect(first.get('tempeh').status).toBe('unavailable');

    const second = await getCatalogEntries(['seitan']);
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(second.get('seitan').status).toBe('unavailable');
  });

  it('falls back to stale catalog data when the callable fails', async () => {
    mockCatalog({ egg: { status: 'ok', products: [product('Old egg')], updatedAt: ts(40 * DAY) } });
    mockCallable.mockRejectedValue(new Error('network'));

    const result = await getCatalogEntries(['egg']);

    expect(result.get('egg')).toEqual({
      status: 'ok', products: [product('Old egg')], source: 'catalog'
    });
  });

  it('isolates per-key errors from the callable and Firestore', async () => {
    getDoc.mockImplementation(async (ref) => {
      if (ref.id === 'broken') throw new Error('permission-denied');
      return { exists: () => false, data: () => undefined };
    });
    mockCallable.mockResolvedValue({
      data: {
        entries: { tofu: { status: 'empty', products: [] } },
        errors: { broken: 'upstream timeout' }
      }
    });

    const result = await getCatalogEntries(['tofu', 'broken']);

    expect(result.get('tofu')).toEqual({ status: 'empty', products: [], source: 'function' });
    expect(result.get('broken').status).toBe('unavailable');
  });

  it('ignores empty names and handles an empty list', async () => {
    expect((await getCatalogEntries([])).size).toBe(0);
    expect((await getCatalogEntries(['', '   ', null])).size).toBe(0);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('getCatalogEntry', () => {
  it('returns the entry for one name', async () => {
    mockCatalog({ garlic: { status: 'ok', products: [product('Garlic')], updatedAt: ts(DAY) } });
    const entry = await getCatalogEntry('garlic cloves');
    expect(entry.products[0].productName).toBe('Garlic');
  });
});
