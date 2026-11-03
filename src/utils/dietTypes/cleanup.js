/**
 * Pure planning / reporting logic for scripts/normalizeDietTypes.mjs.
 *
 * The script reads Firestore, hands plain objects to these functions and (only with
 * --apply) writes the planned updates. Nothing here touches Firestore.
 */
import {
  CANONICAL_DIET_TYPES,
  canonicalDietType,
  compactDietText,
  dietTypeKey,
  dietTypeText,
  isBlankDietType,
  normalizeRecipeDietTypes,
} from './normalize';
import { damerauLevenshtein, maxTypoDistance } from './suggest';

export const CLEANUP_USAGE =
  'Usage: node scripts/normalizeDietTypes.mjs --project <id> [--dry-run | --apply] [--user <uid>] [--verbose]';

/**
 * Parse CLI flags. Dry run is the default; writing needs an explicit --apply.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{project: string, apply: boolean, user: string|null, verbose: boolean}}
 */
export function parseCleanupArgs(argv) {
  const opts = { project: '', apply: false, user: null, verbose: false };
  let sawDryRun = false;
  const value = (arg, name, i) => (arg === name ? [argv[i + 1] || '', i + 1] : [arg.slice(name.length + 1), i]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--dry-run') sawDryRun = true;
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--project' || arg.startsWith('--project=')) {
      [opts.project, i] = value(arg, '--project', i);
    } else if (arg === '--user' || arg.startsWith('--user=')) {
      let user;
      [user, i] = value(arg, '--user', i);
      if (!user || user.startsWith('--')) throw new Error('--user needs a user id');
      opts.user = user;
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }
  if (!opts.project || opts.project.startsWith('--')) {
    throw new Error('--project <id> is required (there is no default project)');
  }
  if (opts.apply && sawDryRun) throw new Error('Use either --dry-run or --apply, not both');
  return opts;
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Closest curated diet within typo distance (report-only; never auto-applied).
 * @param {string} name
 * @returns {string|null}
 */
export function likelyTypoOf(name) {
  const canonical = canonicalDietType(name);
  if (!canonical || CANONICAL_DIET_TYPES.includes(canonical)) return null;
  const compact = compactDietText(canonical);
  const max = maxTypoDistance(compact.length);
  let best = null;
  let bestDistance = Infinity;
  for (const target of CANONICAL_DIET_TYPES) {
    const d = damerauLevenshtein(compact, compactDietText(target));
    if (d <= max && d < bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  return best;
}

function classifyValue(raw) {
  if (raw != null && typeof raw !== 'string') return 'formatting'; // e.g. { name } objects
  const text = dietTypeText(raw);
  if (isBlankDietType(raw)) return text.trim() ? 'blank' : null;
  const canonical = canonicalDietType(raw);
  if (canonical === text) return null;
  // Same letters, different case/spacing/hyphens -> formatting; otherwise an alias.
  return compactDietText(text) === compactDietText(canonical) ? 'formatting' : 'alias';
}

/**
 * Plan the diet type update for one recipe.
 *
 * Categories (a recipe can have several):
 * - formatting : case / whitespace / hyphenation ("vegan " -> "Vegan", "gluten free" -> "Gluten-Free")
 * - alias      : synonym or known misspelling ("GF" -> "Gluten-Free", "ketogenic" -> "Keto", "Veg" -> "Vegetarian")
 * - blank      : "Not Specified" / "none" / "N/A" cleared to '' / []
 * - duplicate  : duplicate entries in dietTypes removed (by key)
 * - fill-array : dietTypes missing/empty, filled from the legacy dietType
 * - conflict   : legacy dietType is not in dietTypes; the legacy value is only re-spelled,
 *                never dropped (report it, fix by hand)
 * - typo       : report only, nothing written ("Vegatarian" looks like "Vegetarian")
 *
 * @param {{id: string, dietType?: *, dietTypes?: *}} recipe
 * @returns {{id: string, changed: boolean, update: object, before: object, after: object, categories: string[], typos: Array<{value: string, suggestion: string}>}}
 */
export function planRecipeDietTypes(recipe) {
  const r = recipe || {};
  const categories = new Set();
  const legacyRaw = Array.isArray(r.dietType) ? r.dietType[0] : r.dietType;
  const rawArray = Array.isArray(r.dietTypes) ? r.dietTypes : r.dietTypes == null ? [] : [r.dietTypes];
  const before = { dietType: r.dietType === undefined ? undefined : r.dietType, dietTypes: r.dietTypes };

  const norm = normalizeRecipeDietTypes(r);
  const afterTypes = norm.dietTypes;
  let afterType = norm.dietType || '';

  // Legacy value the array doesn't contain: keep it (re-spelled), flag it.
  const legacyCanonical = canonicalDietType(legacyRaw);
  const arrayCanonical = rawArray.map(canonicalDietType).filter(Boolean);
  if (arrayCanonical.length && legacyCanonical &&
    !afterTypes.some((n) => compactDietText(n) === dietTypeKey(legacyCanonical))) {
    afterType = legacyCanonical;
    categories.add('conflict');
  }

  for (const value of [legacyRaw, ...rawArray]) {
    const c = classifyValue(value);
    if (c) categories.add(c);
  }
  if (arrayCanonical.length > afterTypes.length) categories.add('duplicate');
  if (!arrayCanonical.length && afterTypes.length) categories.add('fill-array');

  const update = {};
  const currentType = typeof r.dietType === 'string' ? r.dietType : r.dietType == null ? '' : null;
  if (currentType === null || currentType !== afterType) {
    // Don't create a field just to store '' on recipes that never had one.
    if (!(r.dietType === undefined && afterType === '')) update.dietType = afterType;
  }
  const currentArray = Array.isArray(r.dietTypes) ? r.dietTypes : null;
  if (!currentArray ? afterTypes.length > 0 || r.dietTypes != null : !sameList(currentArray, afterTypes)) {
    update.dietTypes = afterTypes;
  }

  const typos = [];
  for (const name of afterTypes) {
    const suggestion = likelyTypoOf(name);
    if (suggestion) typos.push({ value: name, suggestion });
  }
  if (typos.length) categories.add('typo');

  const changed = Object.keys(update).length > 0;
  if (!changed) categories.delete('formatting');
  return {
    id: r.id,
    changed,
    update,
    before,
    after: { dietType: afterType, dietTypes: afterTypes },
    categories: [...categories],
    typos,
  };
}

const isSystem = (dt) => dt.createdBy === 'system' || dt.isDefault === true;
const millis = (ts) => {
  if (!ts) return Infinity;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? Infinity : n;
};

/**
 * Plan merges for globalDietTypes docs that share a key.
 *
 * Nothing is deleted. Per key, the keeper is: a system/default type, else the one whose
 * name is already canonical, else the oldest (createdAt), else lowest id. Duplicates get
 * `{ isActive: false, mergedInto: <keeperId> }` (the service already hides inactive types
 * and folds `mergedInto` ids into the keeper). Keepers whose name isn't canonical get
 * `{ name: <canonical>, previousName: <old> }`. Docs already merged / inactive are left
 * alone. Blank-named docs are reported, not touched.
 *
 * @param {Array<{id: string, name?: string, createdBy?: string, isActive?: boolean, createdAt?: *, mergedInto?: string}>} docs
 * @returns {{groups: Array<{key: string, name: string, keeperId: string, duplicateIds: string[]}>, updates: Array<{id: string, update: object, reason: string}>, blankIds: string[], typos: Array<{id: string, value: string, suggestion: string}>}}
 */
export function planGlobalDietTypeMerges(docs) {
  const active = (Array.isArray(docs) ? docs : []).filter((d) => d && d.isActive !== false && !d.mergedInto);
  const blankIds = [];
  const byKey = new Map();
  for (const d of active) {
    const key = dietTypeKey(d.name);
    if (!key) {
      blankIds.push(d.id);
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(d);
  }

  const groups = [];
  const updates = [];
  const typos = [];
  for (const [key, members] of byKey) {
    const name = canonicalDietType(members[0].name);
    const sorted = members.slice().sort((a, b) =>
      (isSystem(b) ? 1 : 0) - (isSystem(a) ? 1 : 0) ||
      (b.name === name ? 1 : 0) - (a.name === name ? 1 : 0) ||
      millis(a.createdAt) - millis(b.createdAt) ||
      String(a.id).localeCompare(String(b.id)));
    const [keeper, ...dupes] = sorted;
    if (keeper.name !== name) {
      updates.push({ id: keeper.id, update: { name, previousName: keeper.name ?? null }, reason: 'rename' });
    }
    for (const d of dupes) {
      updates.push({ id: d.id, update: { isActive: false, mergedInto: keeper.id }, reason: 'merge' });
    }
    if (dupes.length) groups.push({ key, name, keeperId: keeper.id, duplicateIds: dupes.map((d) => d.id) });
    const suggestion = likelyTypoOf(name);
    if (suggestion) typos.push({ id: keeper.id, value: name, suggestion });
  }
  return { groups, updates, blankIds, typos };
}

const show = (v) => (v === undefined ? '(unset)' : JSON.stringify(v));

/**
 * Human-readable report.
 * @param {{recipePlans: Array, globalPlan: ReturnType<typeof planGlobalDietTypeMerges>, apply: boolean, project: string, verbose?: boolean}} input
 * @returns {string}
 */
export function formatCleanupReport({ recipePlans, globalPlan, apply, project, verbose = false }) {
  const lines = [];
  const changed = recipePlans.filter((p) => p.changed);
  const counts = {};
  for (const p of recipePlans) for (const c of p.categories) counts[c] = (counts[c] || 0) + 1;

  lines.push(`${apply ? '[apply]' : '[dry-run]'} project=${project}`);
  lines.push('');
  lines.push(`Recipes: ${recipePlans.length} scanned, ${changed.length} to update`);
  for (const p of changed) {
    lines.push(`  ${p.id} [${p.categories.join(', ')}]`);
    if ('dietType' in p.update) lines.push(`    dietType:  ${show(p.before.dietType)} -> ${show(p.after.dietType)}`);
    if ('dietTypes' in p.update) lines.push(`    dietTypes: ${show(p.before.dietTypes)} -> ${show(p.after.dietTypes)}`);
  }
  const conflicts = recipePlans.filter((p) => p.categories.includes('conflict'));
  if (conflicts.length) {
    lines.push('', `Conflicts (legacy dietType not in dietTypes; kept, fix by hand): ${conflicts.length}`);
    for (const p of conflicts) lines.push(`  ${p.id}: dietType ${show(p.after.dietType)} vs dietTypes ${show(p.after.dietTypes)}`);
  }
  const typoRecipes = recipePlans.filter((p) => p.typos.length);
  if (typoRecipes.length) {
    lines.push('', `Possible typos (NOT changed): ${typoRecipes.length} recipe(s)`);
    for (const p of typoRecipes) {
      for (const t of p.typos) lines.push(`  ${p.id}: "${t.value}" — did you mean "${t.suggestion}"?`);
    }
  }
  if (verbose) {
    const unchanged = recipePlans.length - changed.length;
    lines.push('', `Unchanged recipes: ${unchanged}`);
  }

  lines.push('', `globalDietTypes: ${globalPlan.groups.length} duplicate group(s), ${globalPlan.updates.length} doc update(s)`);
  for (const g of globalPlan.groups) {
    lines.push(`  "${g.name}": keep ${g.keeperId}; mark inactive (mergedInto) ${g.duplicateIds.join(', ')}`);
  }
  for (const u of globalPlan.updates.filter((x) => x.reason === 'rename')) {
    lines.push(`  rename ${u.id}: ${show(u.update.previousName)} -> ${show(u.update.name)}`);
  }
  if (globalPlan.blankIds.length) {
    lines.push(`  blank names (left alone): ${globalPlan.blankIds.join(', ')}`);
  }
  for (const t of globalPlan.typos) lines.push(`  possible typo ${t.id}: "${t.value}" — did you mean "${t.suggestion}"? (NOT changed)`);

  lines.push('', 'By category: ' + (Object.keys(counts).length
    ? Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(' ')
    : 'none'));
  lines.push(apply ? 'Writes applied (no documents deleted).' : 'Nothing written. Re-run with --apply to write.');
  return lines.join('\n');
}
