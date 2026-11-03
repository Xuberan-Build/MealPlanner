/**
 * Read-time dedupe / grouping of diet types (pure).
 *
 * Everything here groups by dietTypeKey and displays one name per key, so "vegan",
 * "Vegan " and "VEGAN" are a single "Vegan". Nothing here writes data.
 */
import {
  canonicalDietType,
  compactDietText,
  dietTypeKey,
  dietTypeText,
  isCanonicalDietType,
  normalizeRecipeDietTypes,
} from './normalize';

/** Group label for recipes with no diet type. */
export const UNCATEGORIZED_LABEL = 'Uncategorized';

/**
 * Build a key -> display-name index over many diet type values.
 *
 * Display name per key: the curated canonical name when there is one; otherwise the most
 * common canonical spelling among the inputs (ties: first seen).
 *
 * @param {Array<string|{name: string}>} values
 * @returns {{names: string[], keys: string[], displayName: (input: *) => (string|null), has: (input: *) => boolean, size: number}}
 */
export function createDietTypeIndex(values) {
  const byKey = new Map(); // key -> { counts: Map(name -> n), order: string[] }
  for (const value of Array.isArray(values) ? values : []) {
    const name = canonicalDietType(value);
    if (!name) continue;
    const key = compactDietText(name);
    let entry = byKey.get(key);
    if (!entry) {
      entry = { counts: new Map(), order: [] };
      byKey.set(key, entry);
    }
    if (!entry.counts.has(name)) entry.order.push(name);
    entry.counts.set(name, (entry.counts.get(name) || 0) + 1);
  }

  const display = new Map();
  for (const [key, entry] of byKey) {
    let best = entry.order[0];
    if (!isCanonicalDietType(best)) {
      for (const name of entry.order) {
        if (entry.counts.get(name) > entry.counts.get(best)) best = name;
      }
    }
    display.set(key, best);
  }

  const names = [...display.values()].sort((a, b) => a.localeCompare(b));
  return {
    names,
    keys: [...display.keys()],
    size: display.size,
    has: (input) => display.has(dietTypeKey(input)),
    displayName: (input) => {
      const key = dietTypeKey(input);
      if (!key) return null;
      return display.get(key) || canonicalDietType(input);
    },
  };
}

/**
 * Distinct, sorted display names of every diet type used by the recipes.
 * @param {Array} recipes
 * @returns {string[]}
 */
export function collectRecipeDietTypes(recipes) {
  const all = [];
  for (const recipe of Array.isArray(recipes) ? recipes : []) {
    all.push(...normalizeRecipeDietTypes(recipe).dietTypes);
  }
  return createDietTypeIndex(all).names;
}

/**
 * Group recipes by their primary (canonical) diet type. Each recipe appears once.
 * @param {Array} recipes
 * @param {{index?: ReturnType<typeof createDietTypeIndex>, fallback?: string}} [options]
 *   `index` lets callers share display names across recipe sets (e.g. built from all
 *   recipes while grouping only the filtered ones).
 * @returns {Object<string, Array>} display name -> recipes
 */
export function groupRecipesByDietType(recipes, options = {}) {
  const list = Array.isArray(recipes) ? recipes : [];
  const fallback = options.fallback || UNCATEGORIZED_LABEL;
  const index = options.index || createDietTypeIndex(list.flatMap((r) => normalizeRecipeDietTypes(r).dietTypes));
  return list.reduce((acc, recipe) => {
    const primary = normalizeRecipeDietTypes(recipe).dietType;
    const label = (primary && index.displayName(primary)) || fallback;
    (acc[label] = acc[label] || []).push(recipe);
    return acc;
  }, {});
}

/**
 * True when any of the recipe's diet types matches (by key) one of the selected ones.
 * An empty selection matches everything.
 * @param {object} recipe
 * @param {Array<string>} selected
 * @returns {boolean}
 */
export function recipeMatchesDietFilter(recipe, selected) {
  const keys = new Set((Array.isArray(selected) ? selected : []).map(dietTypeKey).filter(Boolean));
  if (keys.size === 0) return true;
  return normalizeRecipeDietTypes(recipe).dietTypes.some((name) => keys.has(compactDietText(name)));
}

const isSystemType = (dt) => dt && (dt.createdBy === 'system' || dt.isDefault === true);

/**
 * Dedupe diet type objects ({ id, name, createdBy, ... }) by key.
 *
 * Keeper per key: a system/default type first, then one whose stored name is already
 * canonical, then the first seen. The keeper gets the canonical display name, its `key`,
 * `mergedIds` (ids of the duplicates folded into it), `variants` (raw names seen) and a
 * summed `recipeCount` when counts are present. Objects with a blank name are dropped.
 * Input objects are not mutated.
 *
 * @param {Array<object>} dietTypes
 * @returns {Array<object>} In first-seen order of each key.
 */
export function dedupeDietTypeObjects(dietTypes) {
  const groups = new Map();
  for (const dt of Array.isArray(dietTypes) ? dietTypes : []) {
    if (!dt || typeof dt !== 'object') continue;
    const name = canonicalDietType(dt.name);
    if (!name) continue;
    const key = compactDietText(name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(dt);
  }

  const out = [];
  for (const [key, members] of groups) {
    const canonicalName = canonicalDietType(members[0].name);
    const keeper =
      members.find(isSystemType) ||
      members.find((dt) => dt.name === canonicalName) ||
      members[0];
    const display = createDietTypeIndex(members.map((dt) => dt.name)).displayName(canonicalName);
    const others = members.filter((dt) => dt !== keeper);
    const counts = members.map((dt) => dt.recipeCount).filter((n) => typeof n === 'number');
    const merged = {
      ...keeper,
      name: display,
      key,
      mergedIds: [
        ...(Array.isArray(keeper.mergedIds) ? keeper.mergedIds : []),
        ...others.map((dt) => dt.id).filter((id) => id != null && id !== keeper.id),
      ],
      variants: [...new Set(members.map((dt) => dietTypeText(dt.name)))],
    };
    if (counts.length) merged.recipeCount = counts.reduce((a, b) => a + b, 0);
    out.push(merged);
  }
  return out;
}
