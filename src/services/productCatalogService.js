/**
 * Product Catalog Service
 *
 * Reads candidate products for shopping-list ingredients from our own Firestore
 * `productCatalog` collection. Missing or stale entries are filled server-side by the
 * `lookupCatalogProducts` callable. The browser never talks to OpenFoodFacts here.
 *
 * Lookup order per key: in-memory cache -> Firestore doc -> callable.
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../firebase';
import { normalizeIngredientName } from '../utils/quantity';

export const CATALOG_COLLECTION = 'productCatalog';
export const LOOKUP_FUNCTION_NAME = 'lookupCatalogProducts';
export const CALLABLE_CHUNK_SIZE = 30;
export const CALLABLE_TIMEOUT_MS = 8000;

const DAY_MS = 24 * 60 * 60 * 1000;
export const OK_MAX_AGE_MS = 30 * DAY_MS;
export const EMPTY_MAX_AGE_MS = 7 * DAY_MS;
export const MEMORY_TTL_MS = 15 * 60 * 1000;
export const CALLABLE_COOLDOWN_MS = 60 * 1000;

/** @type {Map<string, {entry: {status: string, products: Array}, expiresAt: number}>} */
const memoryCache = new Map();
let callableDownUntil = 0;
let lookupCallable = null;

/**
 * Convert an ingredient name to its catalog key / Firestore doc id.
 * "All-Purpose Flour" -> "all-purpose-flour", "garlic cloves" -> "garlic".
 * @param {string} name - Raw ingredient name
 * @returns {string} Catalog key ('' when the name has no usable content)
 */
export const toCatalogKey = (name) =>
  normalizeIngredientName(name || '').replace(/\s+/g, '-');

/**
 * Clear the in-memory cache and the callable failure cooldown (tests / sign-out).
 * @returns {void}
 */
export const clearCatalogCache = () => {
  memoryCache.clear();
  callableDownUntil = 0;
  lookupCallable = null;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const normalizeEntry = (raw) => ({
  status: raw?.status === 'ok' ? 'ok' : 'empty',
  products: Array.isArray(raw?.products) ? raw.products : []
});

/**
 * Whether a catalog doc is too old to trust ('ok' > 30 days, 'empty' > 7 days).
 * @param {Object} data - Firestore doc data
 * @param {number} [now] - Current time in ms
 * @returns {boolean}
 */
export const isStale = (data, now = Date.now()) => {
  const maxAge = data?.status === 'ok' ? OK_MAX_AGE_MS : EMPTY_MAX_AGE_MS;
  return now - toMillis(data?.updatedAt) > maxAge;
};

const readMemory = (key, now) => {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    memoryCache.delete(key);
    return null;
  }
  return hit.entry;
};

const writeMemory = (key, entry, now) => {
  memoryCache.set(key, { entry, expiresAt: now + MEMORY_TTL_MS });
};

/** Read one catalog doc. Resolves { data, error? } (data null on a miss or failure); never rejects. */
const readCatalogDoc = async (key) => {
  try {
    const snap = await getDoc(doc(db, CATALOG_COLLECTION, key));
    return { key, data: snap.exists() ? snap.data() : null };
  } catch (error) {
    return { key, data: null, error };
  }
};

const getLookupCallable = () => {
  if (!lookupCallable) {
    lookupCallable = httpsCallable(getFunctions(app), LOOKUP_FUNCTION_NAME, {
      timeout: CALLABLE_TIMEOUT_MS
    });
  }
  return lookupCallable;
};

/**
 * Call lookupCatalogProducts once for a chunk of keys (no retries).
 * Resolves { entries, errors, failed }; never rejects.
 */
const callLookup = async (keys) => {
  try {
    const result = await getLookupCallable()({ keys });
    const data = result?.data || {};
    return { entries: data.entries || {}, errors: data.errors || {}, failed: false };
  } catch (error) {
    console.warn(`${LOOKUP_FUNCTION_NAME} unavailable:`, error?.code || error?.message || error);
    return { entries: {}, errors: {}, failed: true };
  }
};

/** Run the callable for keys in chunks of 30 (parallel). Returns Map key -> entry. */
const fetchFromFunction = async (keys, now) => {
  const filled = new Map();
  if (!keys.length || now < callableDownUntil) return filled;

  const results = await Promise.all(chunk(keys, CALLABLE_CHUNK_SIZE).map(callLookup));
  if (results.some((r) => r.failed)) callableDownUntil = Date.now() + CALLABLE_COOLDOWN_MS;

  results.forEach(({ entries, errors }) => {
    Object.entries(entries).forEach(([key, raw]) => {
      if (raw && !errors[key]) filled.set(key, normalizeEntry(raw));
    });
    Object.entries(errors).forEach(([key, message]) => {
      console.warn(`${LOOKUP_FUNCTION_NAME} error for "${key}":`, message);
    });
  });
  return filled;
};

/**
 * Get catalog entries for a list of ingredient names.
 *
 * Never throws. Keys the callable cannot fill resolve to stale catalog data if any,
 * otherwise { status: 'unavailable', products: [] }.
 *
 * @param {string[]} names - Ingredient names (duplicates / empty names are fine)
 * @param {Object} [options]
 * @param {boolean} [options.useMemoryCache=true] - Serve from the in-memory cache
 * @returns {Promise<Map<string, {status: 'ok'|'empty'|'unavailable', products: Array,
 *   source: 'cache'|'catalog'|'function'|'unavailable'}>>} keyed by toCatalogKey(name)
 */
export const getCatalogEntries = async (names, options = {}) => {
  const { useMemoryCache = true } = options;
  const now = Date.now();
  const result = new Map();
  const keys = [...new Set((names || []).map(toCatalogKey).filter(Boolean))];

  const uncached = keys.filter((key) => {
    const hit = useMemoryCache ? readMemory(key, now) : null;
    if (hit) result.set(key, { ...hit, source: 'cache' });
    return !hit;
  });

  const docs = await Promise.all(uncached.map(readCatalogDoc));
  // One warning per lookup, not one per ingredient (a rules or network problem hits them all).
  const failed = docs.filter((d) => d.error);
  if (failed.length) {
    console.warn(
      `productCatalog reads failed for ${failed.length} of ${docs.length} items:`,
      failed[0].error?.message || failed[0].error
    );
  }
  const staleData = new Map();
  const toLookup = [];
  docs.forEach(({ key, data }) => {
    if (data && !isStale(data, now)) {
      const entry = normalizeEntry(data);
      writeMemory(key, entry, now);
      result.set(key, { ...entry, source: 'catalog' });
      return;
    }
    if (data) staleData.set(key, normalizeEntry(data));
    toLookup.push(key);
  });

  const filled = await fetchFromFunction(toLookup, now);
  toLookup.forEach((key) => {
    const fresh = filled.get(key);
    if (fresh) {
      writeMemory(key, fresh, now);
      result.set(key, { ...fresh, source: 'function' });
    } else if (staleData.has(key)) {
      result.set(key, { ...staleData.get(key), source: 'catalog' });
    } else {
      result.set(key, { status: 'unavailable', products: [], source: 'unavailable' });
    }
  });

  return result;
};

/**
 * Get catalog products for a single ingredient name.
 * @param {string} name - Ingredient name
 * @param {Object} [options] - Same as getCatalogEntries
 * @returns {Promise<{status: string, products: Array, source: string}>}
 */
export const getCatalogEntry = async (name, options) => {
  const key = toCatalogKey(name);
  const entries = await getCatalogEntries([name], options);
  return entries.get(key) || { status: 'unavailable', products: [], source: 'unavailable' };
};

const productCatalogService = {
  toCatalogKey,
  getCatalogEntries,
  getCatalogEntry,
  isStale,
  clearCatalogCache
};

export default productCatalogService;
