#!/usr/bin/env node
/**
 * Normalize diet types in Firestore (recipes + globalDietTypes).
 *
 * DRY RUN BY DEFAULT: prints what would change and writes nothing. Writes only with --apply.
 * Never deletes documents. Uses the same pure logic as the app (src/utils/dietTypes/*), so
 * the data ends up exactly how the app already displays it.
 *
 * Recipes (`recipes` collection; only the `dietType` / `dietTypes` fields are written):
 *   formatting  "vegan " -> "Vegan", "gluten free" -> "Gluten-Free"
 *   alias       "GF" -> "Gluten-Free", "ketogenic" -> "Keto", "Veg" -> "Vegetarian"
 *   blank       "Not Specified" / "none" / "N/A" -> dietType '' and dietTypes []
 *   duplicate   ["Vegan", "vegan"] -> ["Vegan"]
 *   fill-array  dietTypes missing/empty -> filled from the legacy dietType
 *   conflict    legacy dietType not in dietTypes: legacy only re-spelled, reported (fix by hand)
 *   typo        "Vegatarain" looks like "Vegetarian": reported only, NOT changed
 *
 * globalDietTypes (one doc kept per key; nothing deleted):
 *   merge   duplicates get { isActive: false, mergedInto: <keeperId>, mergedAt }
 *           (the app already hides inactive types and folds mergedInto ids into the keeper,
 *            so favorites/hidden saved under the old id keep working). Keeper: system/default
 *            type, else the one already spelled canonically, else the oldest.
 *   rename  keeper whose name isn't canonical gets { name, previousName }
 *   blank-named docs and likely typos are reported, not touched.
 *
 * Usage (from the repo root):
 *   node scripts/normalizeDietTypes.mjs --project <id>                 # dry run (default)
 *   node scripts/normalizeDietTypes.mjs --project <id> --user <uid>    # only that user's recipes
 *   node scripts/normalizeDietTypes.mjs --project <id> --apply         # write
 *
 * Credentials: Application Default Credentials
 *   (`gcloud auth application-default login`, or GOOGLE_APPLICATION_CREDENTIALS).
 */

import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLEANUP_MODULE = path.join(ROOT, "src/utils/dietTypes/cleanup.js");
const BATCH_LIMIT = 400; // Firestore allows 500 writes per batch

/**
 * Import an ES module from src/ (the app package isn't "type": "module", so Node can't
 * import those .js files directly). Each file and its relative imports are loaded as
 * data: URLs. Only relative imports are supported; src/utils/dietTypes has no others.
 * @param {string} file - Absolute path
 * @param {Map<string, string>} [cache] - file -> data URL
 * @return {Promise<string>} data: URL of the module
 */
async function toDataUrl(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  let source = await readFile(file, "utf8");
  const specifiers = new Set();
  const re = /\b(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
  for (let m = re.exec(source); m; m = re.exec(source)) specifiers.add(m[1]);
  for (const spec of specifiers) {
    if (!spec.startsWith(".")) throw new Error(`${path.relative(ROOT, file)} imports "${spec}"; only relative imports are supported`);
    let target = path.resolve(path.dirname(file), spec);
    if (!path.extname(target)) target += ".js";
    const url = await toDataUrl(target, cache);
    source = source.split(`'${spec}'`).join(`'${url}'`).split(`"${spec}"`).join(`"${url}"`);
  }
  // encodeURIComponent leaves ' unescaped; escape it so the URL can sit in a quoted import.
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(source).replace(/'/g, "%27")}`;
  cache.set(file, url);
  return url;
}

/**
 * Load the pure planning logic (exported for a credential-free smoke test).
 * @return {Promise<object>} src/utils/dietTypes/cleanup.js exports
 */
export async function loadCleanupModule() {
  return import(await toDataUrl(CLEANUP_MODULE));
}

/**
 * Commit updates in batches.
 * @param {FirebaseFirestore.Firestore} db - Firestore
 * @param {Array<{ref: FirebaseFirestore.DocumentReference, update: object}>} writes - Writes
 * @return {Promise<number>} Number written
 */
async function commitInBatches(db, writes) {
  let done = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const {ref, update} of writes.slice(i, i + BATCH_LIMIT)) batch.update(ref, update);
    await batch.commit();
    done += Math.min(BATCH_LIMIT, writes.length - i);
    console.log(`  committed ${done}/${writes.length}`);
  }
  return done;
}

/**
 * Entry point.
 * @return {Promise<void>}
 */
async function main() {
  const cleanup = await loadCleanupModule();
  let opts;
  try {
    opts = cleanup.parseCleanupArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${cleanup.CLEANUP_USAGE}`);
    process.exit(2);
  }

  const {initializeApp, applicationDefault} = await import("firebase-admin/app");
  const {getFirestore, Timestamp} = await import("firebase-admin/firestore");
  initializeApp({credential: applicationDefault(), projectId: opts.project});
  const db = getFirestore();

  let recipesQuery = db.collection("recipes");
  if (opts.user) recipesQuery = recipesQuery.where("userId", "==", opts.user);
  const [recipeSnap, globalSnap] = await Promise.all([
    recipesQuery.get(),
    db.collection("globalDietTypes").get(),
  ]);

  const recipePlans = recipeSnap.docs.map((d) => cleanup.planRecipeDietTypes({id: d.id, ...d.data()}));
  const globalPlan = cleanup.planGlobalDietTypeMerges(globalSnap.docs.map((d) => ({id: d.id, ...d.data()})));

  console.log(cleanup.formatCleanupReport({
    recipePlans, globalPlan, apply: opts.apply, project: opts.project, verbose: opts.verbose,
  }));

  if (!opts.apply) return;

  const now = Timestamp.now();
  const writes = [
    ...recipePlans.filter((p) => p.changed).map((p) => ({
      ref: db.collection("recipes").doc(p.id),
      update: p.update,
    })),
    ...globalPlan.updates.map((u) => ({
      ref: db.collection("globalDietTypes").doc(u.id),
      update: u.reason === "merge" ? {...u.update, mergedAt: now} : {...u.update, updatedAt: now},
    })),
  ];
  console.log(`\nWriting ${writes.length} update(s) to ${opts.project} ...`);
  await commitInBatches(db, writes);
  console.log("Done.");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
