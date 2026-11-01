import {test, describe} from "node:test";
import assert from "node:assert/strict";

import {
  buildCatalogDoc,
  buildSearchUrl,
  CatalogInputError,
  createCatalogService,
  createLimiter,
  EMPTY_TTL_MS,
  fetchOffProducts,
  fitProductsToDocSize,
  isEntryFresh,
  normalizeProduct,
  OK_TTL_MS,
  OFF_USER_AGENT,
  rankProducts,
  searchTermForKey,
  validateLookupInput,
} from "../productCatalog.js";
import {loadClientModule} from "./loadClientModule.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 1);

const rawProduct = (overrides = {}) => ({
  code: "0001",
  product_name: "Gold Medal All Purpose Flour",
  brands: "Gold Medal, General Mills",
  quantity: "5 lb",
  categories: "Flours, Wheat flours",
  categories_tags: ["en:flours"],
  image_url: "https://img/1.jpg",
  image_small_url: "https://img/1s.jpg",
  image_thumb_url: "https://img/1t.jpg",
  labels: "Organic, Kosher",
  labels_tags: ["en:organic", "en:kosher", "en:vegan"],
  nutriments: {"energy-kcal": 364, "proteins": 10, "saturated-fat": 0.2},
  nutrition_grades: "a",
  nova_group: 1,
  ingredients: [{id: "en:wheat-flour", text: "wheat flour"}],
  allergens: "en:gluten",
  allergens_tags: ["en:gluten"],
  stores: "Walmart, Target",
  countries: "United States",
  last_modified_t: 1700000000,
  completeness: 0.9,
  ...overrides,
});

// ---------------------------------------------------------------- mocks

/** In-memory stand-in for the Admin Firestore API used by the service. */
function mockDb({docs = {}, failReads = false, failWrites = false} = {}) {
  const store = new Map(Object.entries(docs));
  const writes = [];
  const ref = (id) => ({
    id,
    async set(data) {
      if (failWrites) throw new Error("write denied");
      writes.push({id, data});
      store.set(id, data);
    },
  });
  return {
    store,
    writes,
    collection(name) {
      assert.equal(name, "productCatalog");
      return {doc: ref};
    },
    async getAll(...refs) {
      if (failReads) throw new Error("firestore unavailable");
      return refs.map((r) => ({exists: store.has(r.id), data: () => store.get(r.id)}));
    },
  };
}

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** fetch mock: routes by search term to a handler returning a response or throwing. */
function mockFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    const term = new URL(url).searchParams.get("search_terms");
    calls.push({term, url, init});
    const handler = handlers[term] || handlers["*"];
    if (!handler) throw new Error(`unexpected term ${term}`);
    return handler(calls.filter((c) => c.term === term).length);
  };
  fn.calls = calls;
  return fn;
}

const ts = (ms) => ({toMillis: () => ms, ms});

const makeService = (db, fetchImpl, extra = {}) => createCatalogService({
  db,
  fetchImpl,
  makeTimestamp: ts,
  now: () => NOW,
  fetchOptions: {retryDelayMs: 0, timeoutMs: 50},
  ...extra,
});

// ---------------------------------------------------------------- validation

describe("validateLookupInput", () => {
  test("re-normalizes, dedupes and keeps order", () => {
    assert.deepEqual(
        validateLookupInput({keys: ["All-Purpose Flour", "all-purpose-flour", "Garlic cloves", "garlic"]}),
        ["all-purpose-flour", "garlic"],
    );
  });

  test("rejects bad shapes", () => {
    const bad = [
      undefined, null, {}, {keys: "flour"}, {keys: []},
      {keys: Array.from({length: 31}, (_, i) => `item${i}`)},
      {keys: ["flour", ""]}, {keys: ["  "]}, {keys: [42]}, {keys: [null]},
      {keys: ["((()))"]}, {keys: ["x".repeat(201)]},
    ];
    for (const data of bad) {
      assert.throws(() => validateLookupInput(data), CatalogInputError, JSON.stringify(data));
    }
  });

  test("accepts 30 keys", () => {
    const keys = Array.from({length: 30}, (_, i) => `item ${i}`);
    assert.equal(validateLookupInput({keys}).length, 30);
  });

  test("searchTermForKey", () => {
    assert.equal(searchTermForKey("all-purpose-flour"), "all purpose flour");
  });
});

// ---------------------------------------------------------------- normalization

describe("normalizeProduct", () => {
  test("matches the client's normalizeProduct except lastModified/_raw", async () => {
    const mod = await loadClientModule(
        "src/services/openFoodFactsService.js",
        "export {normalizeProduct as __normalizeProduct__};",
    );
    const samples = [
      rawProduct(),
      {code: "2", product_name_en: "Eggs"},
      {_id: "3", brands: "A", nutriments: {}, last_modified_t: 0},
      {},
    ];
    for (const raw of samples) {
      const expected = mod.__normalizeProduct__(raw);
      const actual = normalizeProduct(raw);
      assert.equal(actual.lastModified,
          expected.lastModified ? expected.lastModified.toISOString() : null);
      assert.equal(actual._raw, null);
      const strip = ({lastModified, _raw, ...rest}) => rest;
      assert.deepEqual(strip(actual), strip(expected));
      // JSON round-trip safe (callable response + Firestore)
      assert.deepEqual(JSON.parse(JSON.stringify(actual)), actual);
    }
    assert.equal(normalizeProduct(null), null);
  });

  test("derives flags and lists", () => {
    const p = normalizeProduct(rawProduct());
    assert.equal(p.brand, "Gold Medal");
    assert.deepEqual(p.brands, ["Gold Medal", "General Mills"]);
    assert.equal(p.isOrganic, true);
    assert.equal(p.isKosher, true);
    assert.equal(p.isGlutenFree, false);
    assert.equal(p.nutriments.energyKcal, 364);
    assert.equal(p.lastModified, "2023-11-14T22:13:20.000Z");
  });
});

describe("rankProducts / fitProductsToDocSize", () => {
  test("dedupes by barcode, puts name matches first, caps at 20", () => {
    const products = [
      {barcode: "1", productName: "Pancake mix"},
      {barcode: "2", productName: "All purpose flour"},
      {barcode: "2", productName: "All purpose flour (dup)"},
      {barcode: "3", productName: "Bread flour"},
      ...Array.from({length: 30}, (_, i) => ({barcode: `x${i}`, productName: "Other"})),
    ];
    const ranked = rankProducts(products, "all purpose flour");
    assert.equal(ranked.length, 20);
    assert.deepEqual(ranked.slice(0, 3).map((p) => p.barcode), ["2", "3", "1"]);
  });

  test("drops ingredients, then trailing products, to fit the size budget", () => {
    const big = Array.from({length: 5}, (_, i) => ({barcode: `${i}`, ingredients: ["x".repeat(500)]}));
    const trimmed = fitProductsToDocSize(big, 1000);
    assert.ok(JSON.stringify(trimmed).length <= 1000);
    assert.ok(trimmed.every((p) => p.ingredients.length === 0));
    assert.equal(fitProductsToDocSize(big, 1e9), big);
  });
});

// ---------------------------------------------------------------- freshness

describe("isEntryFresh", () => {
  const doc = (status, ageMs) => ({status, products: [], updatedAt: ts(NOW - ageMs)});
  test("ok docs: 30 days", () => {
    assert.equal(isEntryFresh(doc("ok", OK_TTL_MS - 1), NOW), true);
    assert.equal(isEntryFresh(doc("ok", OK_TTL_MS), NOW), false);
  });
  test("empty docs: 7 days", () => {
    assert.equal(isEntryFresh(doc("empty", 6 * DAY), NOW), true);
    assert.equal(isEntryFresh(doc("empty", EMPTY_TTL_MS), NOW), false);
  });
  test("missing / malformed docs are stale", () => {
    assert.equal(isEntryFresh(null, NOW), false);
    assert.equal(isEntryFresh({status: "ok", products: []}, NOW), false);
    assert.equal(isEntryFresh({status: "weird", products: [], updatedAt: ts(NOW)}, NOW), false);
    assert.equal(isEntryFresh({status: "ok", updatedAt: ts(NOW)}, NOW), false);
    assert.equal(isEntryFresh({status: "ok", products: [], updatedAt: new Date(NOW - DAY)}, NOW), true);
    assert.equal(isEntryFresh(doc("ok", -DAY), NOW), false); // future timestamp
  });
});

// ---------------------------------------------------------------- fetch

describe("fetchOffProducts", () => {
  test("US filter, User-Agent and normalized products", async () => {
    const fetchImpl = mockFetch({"*": () => jsonResponse({products: [rawProduct()]})});
    const products = await fetchOffProducts("all purpose flour", {fetchImpl});
    assert.equal(products.length, 1);
    assert.equal(products[0].productName, "Gold Medal All Purpose Flour");
    const {url, init} = fetchImpl.calls[0];
    const params = new URL(url).searchParams;
    assert.equal(params.get("tagtype_0"), "countries");
    assert.equal(params.get("tag_0"), "united-states");
    assert.equal(params.get("json"), "1");
    assert.equal(init.headers["User-Agent"], OFF_USER_AGENT);
    assert.match(OFF_USER_AGENT, /^SavorMeals\/1\.0 \(/);
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(buildSearchUrl("x"), url.replace("all+purpose+flour", "x"));
  });

  test("retries once on 5xx then succeeds", async () => {
    const fetchImpl = mockFetch({"*": (n) => n === 1 ? jsonResponse({}, 503) : jsonResponse({products: []})});
    assert.deepEqual(await fetchOffProducts("x", {fetchImpl, retryDelayMs: 0}), []);
    assert.equal(fetchImpl.calls.length, 2);
  });

  test("gives up after one retry", async () => {
    const fetchImpl = mockFetch({"*": () => jsonResponse({}, 502)});
    await assert.rejects(fetchOffProducts("x", {fetchImpl, retryDelayMs: 0}), /HTTP 502/);
    assert.equal(fetchImpl.calls.length, 2);
  });

  test("does not retry 4xx", async () => {
    const fetchImpl = mockFetch({"*": () => jsonResponse({}, 400)});
    await assert.rejects(fetchOffProducts("x", {fetchImpl, retryDelayMs: 0}), /HTTP 400/);
    assert.equal(fetchImpl.calls.length, 1);
  });

  test("times out via the abort signal", async () => {
    const hang = (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    });
    const started = Date.now();
    await assert.rejects(fetchOffProducts("x", {fetchImpl: hang, timeoutMs: 30, retryDelayMs: 0}),
        /timed out after 30ms/);
    assert.ok(Date.now() - started < 1000);
  });
});

// ---------------------------------------------------------------- limiter

test("createLimiter caps concurrency", async () => {
  const run = createLimiter(4);
  let active = 0;
  let peak = 0;
  const task = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return "done";
  };
  const results = await Promise.all(Array.from({length: 12}, () => run(task)));
  assert.equal(peak, 4);
  assert.equal(results.length, 12);
  await assert.rejects(run(async () => {
    throw new Error("boom");
  }), /boom/);
  assert.equal(await run(async () => 1), 1, "limiter recovers after a rejection");
});

// ---------------------------------------------------------------- service

describe("createCatalogService.lookupKeys", () => {
  test("serves fresh docs, fills missing/stale ones, isolates failures", async () => {
    const db = mockDb({docs: {
      "fresh": {status: "ok", products: [{barcode: "f"}], updatedAt: ts(NOW - DAY)},
      "old-but-empty": {status: "empty", products: [], updatedAt: ts(NOW - 8 * DAY)},
      "stale-broken": {status: "ok", products: [{barcode: "s"}], updatedAt: ts(NOW - 40 * DAY)},
    }});
    const fetchImpl = mockFetch({
      "new item": () => jsonResponse({products: [rawProduct({code: "n"})]}),
      "old but empty": () => jsonResponse({products: []}),
      "stale broken": () => jsonResponse({}, 500),
      "broken": () => {
        throw new TypeError("fetch failed");
      },
    });
    const service = makeService(db, fetchImpl);
    const {entries, errors, stats} = await service.lookupKeys(
        ["fresh", "new-item", "old-but-empty", "stale-broken", "broken"]);

    assert.deepEqual(entries.fresh, {status: "ok", products: [{barcode: "f"}]});
    assert.equal(entries["new-item"].status, "ok");
    assert.equal(entries["new-item"].products[0].barcode, "n");
    assert.deepEqual(entries["old-but-empty"], {status: "empty", products: []});
    assert.deepEqual(entries["stale-broken"], {status: "ok", products: [{barcode: "s"}]}, "stale fallback");
    assert.equal(entries.broken, undefined);
    assert.deepEqual(Object.keys(errors), ["broken"]);
    assert.match(errors.broken, /fetch failed/);
    assert.deepEqual(stats, {cached: 1, fetched: 2, stale: 1, failed: 1});

    assert.ok(!fetchImpl.calls.some((c) => c.term === "fresh"), "fresh doc not refetched");
    const written = Object.fromEntries(db.writes.map((w) => [w.id, w.data]));
    assert.deepEqual(Object.keys(written).sort(), ["new-item", "old-but-empty"]);
    const {updatedAt, ...rest} = written["new-item"];
    const {updatedAt: _u, ...expected} = buildCatalogDoc("new-item", rest.products, null);
    assert.deepEqual(rest, expected);
    assert.equal(updatedAt.ms, NOW);
    assert.equal(written["new-item"].searchTerm, "new item");
    assert.equal(written["new-item"].country, "US");
    assert.equal(written["new-item"].source, "openfoodfacts");
    assert.equal(written["old-but-empty"].status, "empty");
  });

  test("Firestore read/write failures do not fail the call", async () => {
    const db = mockDb({failReads: true, failWrites: true});
    const errorsLogged = [];
    const fetchImpl = mockFetch({"*": () => jsonResponse({products: [rawProduct()]})});
    const service = makeService(db, fetchImpl, {
      logger: {info() {}, warn() {}, error: (msg) => errorsLogged.push(msg)},
    });
    const {entries, errors} = await service.lookupKeys(["flour"]);
    assert.equal(entries.flour.status, "ok");
    assert.deepEqual(errors, {});
    assert.deepEqual(errorsLogged, ["productCatalog read failed", "productCatalog write failed"]);
  });

  test("dedupes concurrent fills of the same key", async () => {
    const db = mockDb();
    const fetchImpl = mockFetch({"*": async () => {
      await new Promise((r) => setTimeout(r, 10));
      return jsonResponse({products: []});
    }});
    const service = makeService(db, fetchImpl);
    await Promise.all([service.lookupKeys(["milk"]), service.lookupKeys(["milk"])]);
    assert.equal(fetchImpl.calls.length, 1);
  });

  test("past the deadline, unfetched keys are reported as errors", async () => {
    const db = mockDb();
    const fetchImpl = mockFetch({"*": () => jsonResponse({products: []})});
    const service = makeService(db, fetchImpl);
    const {entries, errors} = await service.lookupKeys(["a1", "b2"], {deadlineMs: NOW - 1});
    assert.deepEqual(entries, {});
    assert.deepEqual(Object.keys(errors).sort(), ["a1", "b2"]);
    assert.equal(fetchImpl.calls.length, 0);
  });

  test("at most 4 OFF requests in flight", async () => {
    const db = mockDb();
    let active = 0;
    let peak = 0;
    const fetchImpl = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return jsonResponse({products: []});
    };
    const service = makeService(db, fetchImpl);
    const keys = Array.from({length: 10}, (_, i) => `item-${i}`);
    const {entries} = await service.lookupKeys(keys);
    assert.equal(Object.keys(entries).length, 10);
    assert.equal(peak, 4);
  });
});
