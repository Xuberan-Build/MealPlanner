#!/usr/bin/env node
/**
 * Seed the `productCatalog` Firestore collection with OpenFoodFacts (US) products for
 * common grocery ingredients.
 *
 * Ingredient list: every phrase in the keyword DICTIONARY of src/utils/ingredientCategories.js
 * (all aisles except "household"), converted with toCatalogKey and deduped. The file is
 * read at run time, so the list always matches the app's categorizer.
 *
 * Uses the exact same lookup/normalize code as the lookupCatalogProducts function
 * (functions/productCatalog.js), so seeded and on-demand docs are identical. Keys that
 * already have a fresh doc are skipped, so the script is safe to re-run / resume.
 *
 * Usage (from the repo root):
 *   node scripts/seedProductCatalog.mjs --project <id> --dry-run
 *   node scripts/seedProductCatalog.mjs --project <id> [--limit N]
 *
 * Credentials: Application Default Credentials
 *   (`gcloud auth application-default login`, or GOOGLE_APPLICATION_CREDENTIALS).
 * Optional: OFF_CONTACT=<email or url> adds a contact to the OpenFoodFacts User-Agent.
 */

import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {
  createCatalogService,
  createLimiter,
  OFF_CONCURRENCY,
  MAX_KEYS_PER_REQUEST,
  toCatalogKey,
} from "../functions/productCatalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORIES_FILE = path.join(ROOT, "src/utils/ingredientCategories.js");
const EXCLUDED_AISLES = new Set(["household"]); // non-food: OFF has nothing useful
const START_INTERVAL_MS = 250; // polite spacing between OFF requests

const USAGE = "Usage: node scripts/seedProductCatalog.mjs --project <id> [--dry-run] [--limit N]";

/**
 * Parse CLI flags.
 * @param {string[]} argv - process.argv.slice(2)
 * @return {{project: string, dryRun: boolean, limit: number}} Options
 */
export function parseArgs(argv) {
  const opts = {project: "", dryRun: false, limit: Infinity};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--project") {
      opts.project = argv[++i] || "";
    } else if (arg.startsWith("--project=")) {
      opts.project = arg.slice("--project=".length);
    } else if (arg === "--limit" || arg.startsWith("--limit=")) {
      const raw = arg === "--limit" ? argv[++i] : arg.slice("--limit=".length);
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) throw new Error(`--limit must be a positive integer, got "${raw}"`);
      opts.limit = n;
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }
  if (!opts.project || opts.project.startsWith("--")) {
    throw new Error("--project <id> is required (there is no default project)");
  }
  return opts;
}

/**
 * Load the (non-exported) keyword DICTIONARY from the client's ESM source by appending an
 * export and importing it as a data: URL. Works because the file has no imports.
 * @return {Promise<object>} aisleId -> subcategory -> phrases[]
 */
async function loadDictionary() {
  const source = await readFile(CATEGORIES_FILE, "utf8");
  if (!/\bconst DICTIONARY\s*=/.test(source)) {
    throw new Error(`DICTIONARY not found in ${CATEGORIES_FILE}`);
  }
  if (/^\s*import\s/m.test(source)) {
    throw new Error(`${CATEGORIES_FILE} now has imports; update loadDictionary()`);
  }
  const code = `${source}\nexport {DICTIONARY as __SEED_DICTIONARY__};\n`;
  const mod = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
  return mod.__SEED_DICTIONARY__;
}

/**
 * Unique catalog keys for every food phrase in the dictionary, in dictionary order.
 * @param {object} dictionary - aisleId -> subcategory -> phrases[]
 * @return {string[]} Catalog keys
 */
export function keysFromDictionary(dictionary) {
  const keys = new Set();
  for (const [aisleId, subcategories] of Object.entries(dictionary)) {
    if (EXCLUDED_AISLES.has(aisleId)) continue;
    for (const phrases of Object.values(subcategories)) {
      for (const phrase of phrases) {
        const key = toCatalogKey(phrase);
        if (key) keys.add(key);
      }
    }
  }
  return [...keys];
}

/**
 * Split an array into chunks.
 * @param {Array} list - Items
 * @param {number} size - Chunk size
 * @return {Array[]} Chunks
 */
const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * Seed entry point.
 * @return {Promise<void>}
 */
async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(2);
  }

  const dictionary = await loadDictionary();
  const allKeys = keysFromDictionary(dictionary);
  const keys = allKeys.slice(0, opts.limit);

  if (opts.dryRun) {
    console.log(keys.join("\n"));
    console.log(`\n[dry-run] project=${opts.project}: ${keys.length} keys ` +
      `(${allKeys.length} unique food keys in ${path.relative(ROOT, CATEGORIES_FILE)}). Nothing written.`);
    return;
  }

  const {initializeApp, applicationDefault} = await import("firebase-admin/app");
  const {getFirestore, Timestamp} = await import("firebase-admin/firestore");
  initializeApp({credential: applicationDefault(), projectId: opts.project});

  const service = createCatalogService({
    db: getFirestore(),
    makeTimestamp: (ms) => Timestamp.fromMillis(ms),
    limiter: createLimiter(OFF_CONCURRENCY, {minStartIntervalMs: START_INTERVAL_MS}),
    logger: {info() {}, warn() {}, error: (msg, data) => console.error(msg, data)},
  });

  const totals = {cached: 0, fetched: 0, stale: 0, failed: 0, ok: 0, empty: 0};
  const failures = {};
  const batches = chunk(keys, MAX_KEYS_PER_REQUEST);
  console.log(`Seeding ${keys.length} keys into ${opts.project}/productCatalog ...`);

  for (const [i, batch] of batches.entries()) {
    const {entries, errors, stats} = await service.lookupKeys(batch);
    for (const k of Object.keys(stats)) totals[k] += stats[k];
    for (const entry of Object.values(entries)) totals[entry.status] += 1;
    Object.assign(failures, errors);
    console.log(`batch ${i + 1}/${batches.length}: ` +
      `cached=${stats.cached} fetched=${stats.fetched} failed=${stats.failed}`);
  }

  console.log(`\nDone. ok=${totals.ok} empty=${totals.empty} cached=${totals.cached} ` +
    `fetched=${totals.fetched} stale=${totals.stale} failed=${totals.failed}`);
  if (Object.keys(failures).length) {
    console.log("Failed keys (re-run to retry):");
    for (const [key, message] of Object.entries(failures)) console.log(`  ${key}: ${message}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
