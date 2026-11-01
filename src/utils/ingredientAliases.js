// src/utils/ingredientAliases.js
//
// Which ingredient names are the same product ("old fashioned oats" = "rolled oats").
// Built-in aliases ship with the app; the shared ingredient dictionary (Firestore, edited
// by admins) adds to them, overrides them, or switches them off for every user.
// Keys are grouping keys from normalizeIngredientName (lowercase, singular).

import { normalizeIngredientName } from './quantity';

/** Shipped defaults. Only true same-product names; e.g. bare "pepper" is NOT here. */
export const BUILT_IN_ALIASES = Object.freeze({
  'white sugar': 'sugar',
  'granulated sugar': 'sugar',
  'granulated white sugar': 'sugar',
  'ap flour': 'all purpose flour',
  'plain flour': 'all purpose flour',
  evoo: 'extra virgin olive oil',
  'bicarbonate of soda': 'baking soda',
  'bicarb soda': 'baking soda',
  'bicarb of soda': 'baking soda',
  scallion: 'green onion',
  'spring onion': 'green onion',
  'cilantro leaf': 'cilantro',
  'coriander leaf': 'cilantro',
  'black peppercorn': 'black pepper',
  'ground black pepper': 'black pepper',
  'cracked black pepper': 'black pepper',
  courgette: 'zucchini',
  aubergine: 'eggplant',
  capsicum: 'bell pepper',
  // Oats: rolled and old-fashioned are the same product (quick/instant/steel-cut are not).
  'old fashioned oat': 'rolled oat',
  'old fashioned rolled oat': 'rolled oat',
  'whole rolled oat': 'rolled oat',
  // Beans and starches
  garbanzo: 'chickpea',
  'garbanzo bean': 'chickpea',
  'chick pea': 'chickpea',
  'corn starch': 'cornstarch',
  // Sugar
  'confectioners sugar': 'powdered sugar',
  'icing sugar': 'powdered sugar',
  // Dairy
  'heavy whipping cream': 'heavy cream',
  'double cream': 'heavy cream',
  parmesan: 'parmesan cheese',
  'parmigiano reggiano': 'parmesan cheese',
  'parmigiano reggiano cheese': 'parmesan cheese',
});

const MAX_HOPS = 4; // "a -> b -> c" chains resolve; loops stop safely

/** Grouping key for any name the user might type ("Old-Fashioned Oats" -> "old fashioned oat"). */
export const aliasKey = (name) => normalizeIngredientName(name);

/**
 * Pure merge of built-ins with dictionary entries
 * [{ alias, canonical, enabled }] (alias/canonical already grouping keys).
 * Enabled entries add or override; disabled entries switch a mapping off (even a built-in).
 */
export function mergeAliases(builtIns, entries) {
  const merged = { ...builtIns };
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const from = aliasKey(entry?.alias);
    if (!from) return;
    const to = aliasKey(entry?.canonical);
    if (entry.enabled === false || !to || to === from) delete merged[from];
    else merged[from] = to;
  });
  return merged;
}

/** Follows a key through the alias map (a -> b -> c), stopping at loops. */
export function resolveWith(aliases, key) {
  let current = key;
  const seen = new Set([current]);
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const next = aliases[current];
    if (!next || seen.has(next)) break;
    seen.add(next);
    current = next;
  }
  return current;
}

/**
 * Problems with a proposed alias, [] when it is fine:
 * blank names, mapping a name to itself, or a loop (canonical already resolves to alias).
 */
export function validateAlias(aliases, alias, canonical) {
  const from = aliasKey(alias);
  const to = aliasKey(canonical);
  const problems = [];
  if (!from) problems.push('Enter the name to replace.');
  if (!to) problems.push('Enter the name it should become.');
  if (from && to && from === to) problems.push('Both names are already the same ingredient.');
  if (from && to && from !== to && resolveWith(aliases, to) === from) {
    problems.push(`"${canonical}" already becomes "${alias}", so this would loop.`);
  }
  return problems;
}

// ----------------------------------------------------------- active registry

let active = { ...BUILT_IN_ALIASES };

/** Apply the shared dictionary for everyone on this device (called when it loads). */
export function applyIngredientDictionary(entries) {
  active = mergeAliases(BUILT_IN_ALIASES, entries);
}

/** The aliases in use right now (built-ins + shared dictionary). */
export const getActiveAliases = () => active;

/** Grouping key after aliases: the key the shopping list groups on. */
export const resolveIngredientKey = (key) => resolveWith(active, key);

/** Test helper: back to built-ins only. */
export function resetIngredientAliasesForTests() {
  active = { ...BUILT_IN_ALIASES };
}
