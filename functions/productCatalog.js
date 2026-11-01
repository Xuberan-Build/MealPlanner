/**
 * Product catalog: a server-filled Firestore cache of OpenFoodFacts (OFF) search results,
 * keyed by ingredient catalog key, so the browser never calls OFF directly.
 *
 * This module has no Firebase imports: Firestore, fetch, the logger and the Timestamp
 * factory are injected, so the same code runs in the Cloud Function (functions/index.js),
 * in the seed script (scripts/seedProductCatalog.mjs) and under `node --test`.
 *
 * Doc shape (collection `productCatalog`, doc id = key):
 *   { key, searchTerm, country: 'US', source: 'openfoodfacts', status: 'ok' | 'empty',
 *     products: Product[] (max 20, best first), updatedAt: Timestamp }
 */

import {toCatalogKey} from "./catalogNames.js";

export {toCatalogKey, normalizeIngredientName} from "./catalogNames.js";

export const CATALOG_COLLECTION = "productCatalog";
export const MAX_KEYS_PER_REQUEST = 30;
export const MAX_KEY_INPUT_LENGTH = 200;
export const MAX_PRODUCTS_PER_ENTRY = 20;
export const OK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const EMPTY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const OFF_TIMEOUT_MS = 6000;
export const OFF_MAX_RETRIES = 1;
export const OFF_RETRY_DELAY_MS = 750;
export const OFF_CONCURRENCY = 4;
// OFF asks for "AppName/Version (contact)". Set OFF_CONTACT (an email or URL) in the
// functions environment / seed shell to include a real contact.
export const OFF_USER_AGENT = `SavorMeals/1.0 (product catalog${
  process.env.OFF_CONTACT ? `; ${process.env.OFF_CONTACT}` : ""
})`;

const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OFF_PAGE_SIZE = 30; // fetch a few extra so dedupe/ranking still leaves 20
const MAX_DOC_JSON_CHARS = 800 * 1000; // stay well under Firestore's 1 MiB doc limit

// Same field list the client requested (src/services/openFoodFactsService.js).
const OFF_FIELDS = [
  "code", "product_name", "brands", "quantity", "image_url", "image_front_url",
  "image_small_url", "image_thumb_url", "categories", "categories_tags", "labels",
  "labels_tags", "nutriments", "nutrition_grades", "nova_group", "ingredients",
  "allergens", "allergens_tags", "stores", "countries", "last_modified_t", "completeness",
];

/** Error for invalid callable input; index.js maps it to HttpsError('invalid-argument'). */
export class CatalogInputError extends Error {
  /** @param {string} message - Human readable reason */
  constructor(message) {
    super(message);
    this.name = "CatalogInputError";
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Validate callable input `{ keys: string[] }` and return deduped, re-normalized keys.
 * @param {*} data - request.data from the callable
 * @return {string[]} Unique catalog keys in input order
 * @throws {CatalogInputError} When input is not an array of 1..30 non-empty strings
 */
export function validateLookupInput(data) {
  const keys = data && data.keys;
  if (!Array.isArray(keys)) {
    throw new CatalogInputError("keys must be an array of strings");
  }
  if (keys.length < 1 || keys.length > MAX_KEYS_PER_REQUEST) {
    throw new CatalogInputError(`keys must contain 1 to ${MAX_KEYS_PER_REQUEST} entries`);
  }
  const out = [];
  const seen = new Set();
  keys.forEach((raw, i) => {
    if (typeof raw !== "string" || raw.trim() === "") {
      throw new CatalogInputError(`keys[${i}] must be a non-empty string`);
    }
    if (raw.length > MAX_KEY_INPUT_LENGTH) {
      throw new CatalogInputError(`keys[${i}] is longer than ${MAX_KEY_INPUT_LENGTH} characters`);
    }
    const key = toCatalogKey(raw);
    if (!key) {
      throw new CatalogInputError(`keys[${i}] does not contain an ingredient name`);
    }
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  });
  return out;
}

/**
 * OFF search term for a catalog key ("all-purpose-flour" -> "all purpose flour").
 * @param {string} key - Catalog key
 * @return {string} Search term
 */
export function searchTermForKey(key) {
  return String(key).replace(/-/g, " ").trim();
}

// ============================================================================
// PRODUCT NORMALIZATION (port of normalizeProduct in openFoodFactsService.js)
// ============================================================================

const splitList = (value) => (value ? String(value).split(",").map((s) => s.trim()) : []);
const hasTag = (tags, fragment) => tags.some((tag) => String(tag).includes(fragment));

/**
 * Normalize a raw OFF product into the client's Product shape.
 *
 * Identical to the client's normalizeProduct except, so the doc is storable and
 * JSON-serializable through the callable:
 * - `lastModified` is an ISO string (or null) instead of a Date;
 * - `_raw` is null instead of a copy of the raw product (it doubled the doc size and
 *   nothing in the client reads it).
 * @param {object} rawProduct - Product object from OFF search.pl
 * @return {object|null} Normalized product, or null for falsy input
 */
export function normalizeProduct(rawProduct) {
  if (!rawProduct) return null;
  const n = rawProduct.nutriments || {};
  const labelsTags = rawProduct.labels_tags || [];

  return {
    barcode: rawProduct.code || rawProduct._id || "",
    productName: rawProduct.product_name || rawProduct.product_name_en || "Unknown Product",

    brands: splitList(rawProduct.brands),
    brand: rawProduct.brands ? String(rawProduct.brands).split(",")[0].trim() : "",

    quantity: rawProduct.quantity || "",
    packagingSize: rawProduct.product_quantity || "",

    categories: splitList(rawProduct.categories),
    categoriesTags: rawProduct.categories_tags || [],

    imageUrl: rawProduct.image_url || rawProduct.image_front_url || "",
    imageFrontUrl: rawProduct.image_front_url || "",
    imageSmallUrl: rawProduct.image_small_url || rawProduct.image_front_small_url || "",
    imageThumbnailUrl: rawProduct.image_thumb_url || rawProduct.image_front_thumb_url || "",

    nutriments: {
      energyKcal: n["energy-kcal"] || 0,
      energy: n.energy || 0,
      proteins: n.proteins || 0,
      proteinsUnit: n.proteins_unit || "g",
      carbohydrates: n.carbohydrates || 0,
      carbohydratesUnit: n.carbohydrates_unit || "g",
      sugars: n.sugars || 0,
      fat: n.fat || 0,
      fatUnit: n.fat_unit || "g",
      saturatedFat: n["saturated-fat"] || 0,
      fiber: n.fiber || 0,
      sodium: n.sodium || 0,
      salt: n.salt || 0,
    },

    nutritionGrade: rawProduct.nutrition_grades || rawProduct.nutrition_grade_fr || "",
    novaGroup: rawProduct.nova_group || rawProduct.nova_groups || "",

    labels: splitList(rawProduct.labels),
    labelsTags,

    isOrganic: hasTag(labelsTags, "organic"),
    isVegan: hasTag(labelsTags, "vegan"),
    isVegetarian: hasTag(labelsTags, "vegetarian"),
    isGlutenFree: hasTag(labelsTags, "gluten-free"),
    isDairyFree: hasTag(labelsTags, "dairy-free"),
    isKosher: hasTag(labelsTags, "kosher"),
    isHalal: hasTag(labelsTags, "halal"),

    ingredients: rawProduct.ingredients || [],
    ingredientsText: rawProduct.ingredients_text || "",
    allergens: rawProduct.allergens || "",
    allergensTags: rawProduct.allergens_tags || [],

    lastModified: rawProduct.last_modified_t ?
      new Date(rawProduct.last_modified_t * 1000).toISOString() :
      null,
    completeness: rawProduct.completeness || 0,

    stores: splitList(rawProduct.stores),
    countries: splitList(rawProduct.countries),

    _raw: null,
  };
}

/**
 * Word-overlap relevance of a product name to the search term (0..1).
 * @param {string} productName - Product name
 * @param {string} searchTerm - Search term
 * @return {number} Fraction of search words present in the name
 */
function nameRelevance(productName, searchTerm) {
  const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const name = String(productName || "").toLowerCase();
  const hits = words.filter((w) => name.includes(w)).length;
  return hits / words.length;
}

/**
 * Dedupe by barcode and order best first: products whose name contains more of the
 * search words come first; OFF's popularity order breaks ties. Capped at 20.
 * @param {object[]} products - Normalized products in OFF order
 * @param {string} searchTerm - Search term used
 * @return {object[]} Ranked products
 */
export function rankProducts(products, searchTerm) {
  const seen = new Set();
  const unique = [];
  for (const p of products) {
    if (!p) continue;
    const id = p.barcode || `${p.productName}|${p.brand}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(p);
  }
  return unique
      .map((p, index) => ({p, index, score: nameRelevance(p.productName, searchTerm)}))
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .slice(0, MAX_PRODUCTS_PER_ENTRY)
      .map((x) => x.p);
}

/**
 * Shrink products until the serialized doc fits under the size budget: first drop the
 * bulky `ingredients` arrays, then drop products from the end.
 * @param {object[]} products - Ranked products
 * @param {number} [maxChars] - JSON size budget
 * @return {object[]} Products that fit
 */
export function fitProductsToDocSize(products, maxChars = MAX_DOC_JSON_CHARS) {
  const size = (list) => JSON.stringify(list).length;
  if (size(products) <= maxChars) return products;
  let list = products.map((p) => ({...p, ingredients: []}));
  while (list.length > 0 && size(list) > maxChars) list = list.slice(0, -1);
  return list;
}

// ============================================================================
// OPENFOODFACTS FETCH
// ============================================================================

/**
 * OFF search URL for US products, sorted by popularity.
 * @param {string} searchTerm - Search term
 * @return {string} URL
 */
export function buildSearchUrl(searchTerm) {
  const params = new URLSearchParams({
    search_terms: searchTerm,
    search_simple: "1",
    action: "process",
    page_size: String(OFF_PAGE_SIZE),
    page: "1",
    sort_by: "unique_scans_n",
    json: "1",
    fields: OFF_FIELDS.join(","),
    // Restrict to products sold in the US (tag filter; the client's bare
    // `countries=United States` param is not an OFF search filter).
    tagtype_0: "countries",
    tag_contains_0: "contains",
    tag_0: "united-states",
  });
  return `${OFF_SEARCH_URL}?${params}`;
}

/** Error from OFF that is worth retrying (timeout, network, 429, 5xx). */
class RetryableError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One OFF search request with a timeout.
 * @param {string} url - Search URL
 * @param {Function} fetchImpl - fetch implementation
 * @param {number} timeoutMs - Per-request timeout
 * @return {Promise<object[]>} Raw OFF products
 */
async function fetchOnce(url, fetchImpl, timeoutMs) {
  // A ref'd timer (unlike AbortSignal.timeout) also covers reading the body.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fail = (error, fallback) => {
    const timedOut = controller.signal.aborted ||
      (error && (error.name === "TimeoutError" || error.name === "AbortError"));
    return new RetryableError(timedOut ? `OpenFoodFacts timed out after ${timeoutMs}ms` : fallback);
  };
  try {
    let res;
    try {
      res = await fetchImpl(url, {
        headers: {"User-Agent": OFF_USER_AGENT, "Accept": "application/json"},
        signal: controller.signal,
      });
    } catch (error) {
      throw fail(error, `OpenFoodFacts request failed: ${error && error.message}`);
    }
    if (!res.ok) {
      const message = `OpenFoodFacts HTTP ${res.status}`;
      if (res.status === 429 || res.status >= 500) throw new RetryableError(message);
      throw new Error(message);
    }
    let data;
    try {
      data = await res.json();
    } catch (error) {
      throw fail(error, "OpenFoodFacts returned invalid JSON");
    }
    return data && Array.isArray(data.products) ? data.products : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search OFF (US) for a term and return ranked, normalized products.
 * @param {string} searchTerm - Search term
 * @param {object} [options] - Options
 * @param {Function} [options.fetchImpl] - fetch implementation (default global fetch)
 * @param {number} [options.timeoutMs] - Per-request timeout (default 6000)
 * @param {number} [options.retries] - Retries on retryable failures (default 1)
 * @param {number} [options.retryDelayMs] - Delay before a retry
 * @return {Promise<object[]>} Up to 20 products, best first ([] when none)
 */
export async function fetchOffProducts(searchTerm, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeoutMs = OFF_TIMEOUT_MS,
    retries = OFF_MAX_RETRIES,
    retryDelayMs = OFF_RETRY_DELAY_MS,
  } = options;
  const url = buildSearchUrl(searchTerm);
  let attempt = 0;
  for (;;) {
    try {
      const raw = await fetchOnce(url, fetchImpl, timeoutMs);
      const products = raw.map(normalizeProduct).filter(Boolean);
      return fitProductsToDocSize(rankProducts(products, searchTerm));
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= retries) throw error;
      attempt += 1;
      await sleep(retryDelayMs);
    }
  }
}

// ============================================================================
// FRESHNESS, DOCS, CONCURRENCY
// ============================================================================

/**
 * Milliseconds since epoch for a Firestore Timestamp, Date or number (NaN if unknown).
 * @param {*} value - Timestamp-like value
 * @return {number} Milliseconds
 */
export function toMillis(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return NaN;
}

/**
 * Whether a stored catalog doc can be served without refetching.
 * 'ok' docs are fresh for 30 days, 'empty' docs for 7 days; anything else is stale.
 * @param {object|null} doc - Stored doc data
 * @param {number} nowMs - Current time
 * @return {boolean} True when fresh
 */
export function isEntryFresh(doc, nowMs) {
  if (!doc || !Array.isArray(doc.products)) return false;
  const ttl = doc.status === "ok" ? OK_TTL_MS : doc.status === "empty" ? EMPTY_TTL_MS : 0;
  const updated = toMillis(doc.updatedAt);
  if (!ttl || Number.isNaN(updated)) return false;
  const age = nowMs - updated;
  return age >= 0 && age < ttl;
}

/**
 * Build the Firestore doc for a key.
 * @param {string} key - Catalog key
 * @param {object[]} products - Ranked products
 * @param {*} updatedAt - Firestore Timestamp (or test stand-in)
 * @return {object} Catalog doc
 */
export function buildCatalogDoc(key, products, updatedAt) {
  return {
    key,
    searchTerm: searchTermForKey(key),
    country: "US",
    source: "openfoodfacts",
    status: products.length ? "ok" : "empty",
    products,
    updatedAt,
  };
}

/**
 * Concurrency limiter: at most `max` tasks run at once, optionally spacing task starts.
 * @param {number} max - Max concurrent tasks
 * @param {object} [options] - Options
 * @param {number} [options.minStartIntervalMs] - Minimum gap between task starts
 * @return {function(Function): Promise<*>} run(task) -> task's result
 */
export function createLimiter(max, {minStartIntervalMs = 0} = {}) {
  let active = 0;
  let lastStart = 0;
  const queue = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    const {task, resolve, reject} = queue.shift();
    active += 1;
    const wait = Math.max(0, lastStart + minStartIntervalMs - Date.now());
    lastStart = Date.now() + wait;
    sleep(wait)
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          next();
        });
  };
  return (task) => new Promise((resolve, reject) => {
    queue.push({task, resolve, reject});
    next();
  });
}

const entryOf = (doc) => ({status: doc.status, products: doc.products || []});
const messageOf = (error) => (error && error.message) || String(error);

/**
 * Create the catalog service used by the callable and the seed script.
 * @param {object} deps - Dependencies
 * @param {object} deps.db - Firestore (Admin SDK) instance
 * @param {function(number): *} deps.makeTimestamp - millis -> Firestore Timestamp
 * @param {object} [deps.logger] - firebase-functions/logger-compatible logger
 * @param {Function} [deps.fetchImpl] - fetch implementation
 * @param {Function} [deps.limiter] - Shared limiter (default: 4 concurrent)
 * @param {function(): number} [deps.now] - Clock
 * @param {object} [deps.fetchOptions] - Extra options for fetchOffProducts
 * @return {{lookupKeys: function(string[], object=): Promise<object>,
 *   fillKey: function(string, object=): Promise<object>}} Service
 */
export function createCatalogService(deps) {
  const {
    db,
    makeTimestamp,
    logger = {info() {}, warn() {}, error() {}},
    fetchImpl = globalThis.fetch,
    limiter = createLimiter(OFF_CONCURRENCY),
    now = Date.now,
    fetchOptions = {},
  } = deps;
  const collection = db.collection(CATALOG_COLLECTION);
  const inFlight = new Map(); // key -> Promise<doc>, dedupes concurrent fills per instance

  /**
   * Fetch a key from OFF and write its doc. A failed write is logged, not thrown.
   * @param {string} key - Catalog key
   * @param {object} [options] - Options
   * @param {number} [options.deadlineMs] - Skip (throw) if the task starts after this time
   * @return {Promise<object>} The doc that was (or should have been) written
   */
  function fillKey(key, {deadlineMs = Infinity} = {}) {
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = limiter(async () => {
      if (now() > deadlineMs) throw new Error("Lookup time budget exceeded; retry later");
      const products = await fetchOffProducts(searchTermForKey(key), {fetchImpl, ...fetchOptions});
      const doc = buildCatalogDoc(key, products, makeTimestamp(now()));
      try {
        await collection.doc(key).set(doc);
      } catch (error) {
        logger.error("productCatalog write failed", {key, error: messageOf(error)});
      }
      return doc;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  }

  /**
   * Read stored docs for keys; a read failure is logged and treated as "not cached".
   * @param {string[]} keys - Catalog keys
   * @return {Promise<Map<string, object>>} key -> doc data
   */
  async function readDocs(keys) {
    const found = new Map();
    try {
      const snaps = await db.getAll(...keys.map((k) => collection.doc(k)));
      snaps.forEach((snap, i) => {
        if (snap.exists) found.set(keys[i], snap.data());
      });
    } catch (error) {
      logger.error("productCatalog read failed", {count: keys.length, error: messageOf(error)});
    }
    return found;
  }

  /**
   * Serve fresh docs from Firestore and fill the rest from OFF. Never throws per key:
   * failures go to `errors`, except that a stale doc is served when its refresh fails.
   * @param {string[]} keys - Validated catalog keys
   * @param {object} [options] - Options
   * @param {number} [options.deadlineMs] - Absolute time after which no new OFF
   *   requests are started (remaining keys are reported in `errors`)
   * @return {Promise<{entries: object, errors: object, stats: object}>} Result
   */
  async function lookupKeys(keys, {deadlineMs = Infinity} = {}) {
    const entries = {};
    const errors = {};
    const stats = {cached: 0, fetched: 0, stale: 0, failed: 0};
    const stored = await readDocs(keys);
    const startMs = now();

    const toFill = [];
    for (const key of keys) {
      const doc = stored.get(key);
      if (isEntryFresh(doc, startMs)) {
        entries[key] = entryOf(doc);
        stats.cached += 1;
      } else {
        toFill.push(key);
      }
    }

    await Promise.all(toFill.map(async (key) => {
      try {
        entries[key] = entryOf(await fillKey(key, {deadlineMs}));
        stats.fetched += 1;
      } catch (error) {
        const old = stored.get(key);
        if (old && Array.isArray(old.products)) {
          entries[key] = entryOf(old);
          stats.stale += 1;
          logger.warn("productCatalog refresh failed; serving stale", {key, error: messageOf(error)});
        } else {
          errors[key] = messageOf(error);
          stats.failed += 1;
          logger.warn("productCatalog fill failed", {key, error: messageOf(error)});
        }
      }
    }));

    return {entries, errors, stats};
  }

  return {lookupKeys, fillKey};
}
