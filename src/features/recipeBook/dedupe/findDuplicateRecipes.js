// src/features/recipeBook/dedupe/findDuplicateRecipes.js
//
// Pure detection of duplicate recipes in the Recipe Book. Nothing here deletes or
// changes data: it only proposes groups that the user reviews (and confirms) in
// DuplicateReview.
//
//   findDuplicateRecipes(recipes) -> [{ key, confidence, reason, recipes, suggestedKeepId }]
//
// Rules (two recipes are linked when one holds):
//   exact  - same title key AND the same ingredient set (or both have no ingredients)
//   likely - same title key AND ingredient Jaccard >= 0.6
//          - same title key AND exactly one copy has no ingredients (an empty stub)
//          - near-identical title key (small edit distance) AND ingredient Jaccard >= 0.8
// Linked recipes are grouped (connected components). Plates (kind: 'plate') are only
// ever compared with other plates, recipes with recipes.

import { normalizeIngredientName, parseIngredientLine } from '../../../utils/quantity';

export const SAME_TITLE_MIN_JACCARD = 0.6;
export const SIMILAR_TITLE_MIN_JACCARD = 0.8;
export const SIMILAR_TITLE_MAX_EDITS = 2;
export const SIMILAR_TITLE_MAX_EDIT_RATIO = 0.2;
export const SIMILAR_TITLE_MIN_LENGTH = 6;

// Words that say nothing about which dish it is.
const LEADING_FILLERS = [
  ['the', 'best'], ['best', 'ever'], ['best'], ['easy'], ['simple'], ['quick'], ['homemade'],
  ['classic'], ['my'], ['the'],
];
const TRAILING_FILLERS = [
  ['recipe'], ['recipes'], ['the', 'best'], ['easy'], ['copy'], ['homemade'],
];

const startsWith = (words, phrase) => phrase.every((w, i) => words[i] === w);
const endsWith = (words, phrase) => {
  const offset = words.length - phrase.length;
  return offset >= 0 && phrase.every((w, i) => words[offset + i] === w);
};

/** "The Best Sofrito Recipe!" -> "sofrito". Never strips a title down to nothing. */
export function titleKey(title) {
  const base = String(title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  let words = base ? base.split(' ') : [];
  let changed = true;
  while (changed && words.length > 1) {
    changed = false;
    for (const phrase of TRAILING_FILLERS) {
      if (words.length > phrase.length && endsWith(words, phrase)) {
        words = words.slice(0, words.length - phrase.length);
        changed = true;
        break;
      }
    }
    if (changed) continue;
    for (const phrase of LEADING_FILLERS) {
      if (words.length > phrase.length && startsWith(words, phrase)) {
        words = words.slice(phrase.length);
        changed = true;
        break;
      }
    }
  }
  return words.join(' ');
}

const ingredientName = (ingredient) => {
  if (ingredient === null || ingredient === undefined) return '';
  if (typeof ingredient === 'string') return parseIngredientLine(ingredient).key;
  const raw = ingredient.ingredientId ?? ingredient.name ?? '';
  return normalizeIngredientName(String(raw).replace(/[-_]+/g, ' '));
};

/** Set of normalised ingredient keys for a recipe. */
export function ingredientSignature(recipe) {
  const keys = new Set();
  (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).forEach((ing) => {
    const key = ingredientName(ing);
    if (key) keys.add(key);
  });
  return keys;
}

/** |A ∩ B| / |A ∪ B|; 1 when both are empty. */
export function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  a.forEach((key) => { if (b.has(key)) shared += 1; });
  return shared / (a.size + b.size - shared);
}

/** Levenshtein distance (small strings only: recipe titles). */
export function editDistance(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const titlesNearlyEqual = (a, b) => {
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  if (Math.min(a.length, b.length) < SIMILAR_TITLE_MIN_LENGTH) return false;
  const distance = editDistance(a, b);
  return distance <= SIMILAR_TITLE_MAX_EDITS && distance / longest <= SIMILAR_TITLE_MAX_EDIT_RATIO;
};

const sameSet = (a, b) => a.size === b.size && [...a].every((key) => b.has(key));

/** How two prepared recipes relate: 'exact' | 'likely' | null. */
function compare(a, b) {
  if (!a.titleKey || !b.titleKey) return null;
  if (a.titleKey === b.titleKey) {
    if (sameSet(a.signature, b.signature)) return 'exact';
    if (a.signature.size === 0 || b.signature.size === 0) return 'likely';
    return jaccard(a.signature, b.signature) >= SAME_TITLE_MIN_JACCARD ? 'likely' : null;
  }
  if (a.signature.size === 0 || b.signature.size === 0) return null;
  if (!titlesNearlyEqual(a.titleKey, b.titleKey)) return null;
  return jaccard(a.signature, b.signature) >= SIMILAR_TITLE_MIN_JACCARD ? 'likely' : null;
}

// ---- completeness / which copy to keep ----------------------------------------

/** Firestore Timestamp, Date, ISO string or millis -> millis (null when unknown). */
export function toMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export const hasInstructions = (recipe) => {
  const { instructions } = recipe || {};
  if (Array.isArray(instructions)) return instructions.some((step) => String(step ?? '').trim());
  return Boolean(String(instructions ?? '').trim());
};
export const hasImage = (recipe) => Boolean(String(recipe?.imageUrl ?? '').trim());
export const hasServings = (recipe) => Boolean(String(recipe?.servings ?? '').trim());

/** The facts DuplicateReview shows side by side. */
export function describeRecipe(recipe) {
  return {
    ingredientCount: Array.isArray(recipe?.ingredients) ? recipe.ingredients.filter(Boolean).length : 0,
    hasInstructions: hasInstructions(recipe),
    hasImage: hasImage(recipe),
    hasServings: hasServings(recipe),
    updatedAt: toMillis(recipe?.updatedAt),
    createdAt: toMillis(recipe?.createdAt),
  };
}

// Instructions matter most, then a photo, then servings; ingredient count breaks ties.
const completenessScore = (facts) =>
  (facts.hasInstructions ? 4 : 0) + (facts.hasImage ? 2 : 0) + (facts.hasServings ? 1 : 0);

const byId = (a, b) => (String(a.recipe.id) < String(b.recipe.id) ? -1 : String(a.recipe.id) > String(b.recipe.id) ? 1 : 0);

/** Best first: completeness, ingredient count, newest update, oldest creation, id. */
function rankForKeeping(a, b) {
  return (
    completenessScore(b.facts) - completenessScore(a.facts) ||
    b.facts.ingredientCount - a.facts.ingredientCount ||
    (b.facts.updatedAt ?? -Infinity) - (a.facts.updatedAt ?? -Infinity) ||
    (a.facts.createdAt ?? Infinity) - (b.facts.createdAt ?? Infinity) ||
    byId(a, b)
  );
}

const listJoin = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function keepReason(ranked) {
  const [best, runnerUp] = ranked;
  const f = best.facts;
  const r = runnerUp.facts;
  if (completenessScore(f) !== completenessScore(r) || f.ingredientCount !== r.ingredientCount) {
    const strengths = [];
    if (f.hasInstructions) strengths.push('instructions');
    if (f.hasImage) strengths.push('a photo');
    if (f.hasServings) strengths.push('servings');
    strengths.push(`${f.ingredientCount} ingredient${f.ingredientCount === 1 ? '' : 's'}`);
    return `it is the most complete (${listJoin(strengths)})`;
  }
  if ((f.updatedAt ?? null) !== (r.updatedAt ?? null)) return 'the copies are equally complete and it was updated most recently';
  if ((f.createdAt ?? null) !== (r.createdAt ?? null)) return 'the copies are equally complete and it is the original (created first)';
  return 'the copies are equally complete';
}

function matchReason(members, confidence) {
  const keys = new Set(members.map((m) => m.titleKey));
  const sizes = members.map((m) => m.signature.size);
  if (confidence === 'exact') {
    return sizes[0] === 0 ? 'Same name, and no copy lists ingredients.' : 'Same name and identical ingredients.';
  }
  if (sizes.some((s) => s === 0)) return 'Same name; one copy has no ingredients listed.';
  let lowest = 1;
  members.forEach((a, i) => members.slice(i + 1).forEach((b) => {
    lowest = Math.min(lowest, jaccard(a.signature, b.signature));
  }));
  const overlap = `${Math.round(lowest * 100)}% of ingredients in common`;
  return keys.size === 1 ? `Same name, ${overlap}.` : `Nearly the same name, ${overlap}.`;
}

// ---- grouping -------------------------------------------------------------------

const prepare = (recipe) => ({
  recipe,
  kind: recipe?.kind === 'plate' ? 'plate' : 'recipe',
  titleKey: titleKey(recipe?.title),
  signature: ingredientSignature(recipe),
  facts: describeRecipe(recipe),
});

const comparePrepared = (a, b) => (a.kind === b.kind ? compare(a, b) : null);

/**
 * Direct link between two recipes by the rules above: 'exact' | 'likely' | null.
 * Groups are chains of links, so two members of one group may NOT be directly linked
 * (e.g. two different "Curry" recipes joined only through an empty "Curry" stub).
 */
export function linkRecipes(a, b) {
  if (!a || !b) return null;
  if (a.id !== undefined && a.id === b.id) return null;
  return comparePrepared(prepare(a), prepare(b));
}

/** Stable key for a group: its sorted recipe ids. Used to remember dismissals. */
export const groupKey = (ids) => [...ids].map(String).sort().join('|');

export function findDuplicateRecipes(recipes) {
  const seen = new Set();
  const prepared = [];
  (Array.isArray(recipes) ? recipes : []).forEach((recipe) => {
    const id = recipe?.id;
    if (id === null || id === undefined || id === '' || seen.has(String(id))) return;
    seen.add(String(id));
    prepared.push(prepare(recipe));
  });
  prepared.sort(byId);

  // Union-find over pairwise links.
  const parent = prepared.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      if (comparePrepared(prepared[i], prepared[j])) parent[find(j)] = find(i);
    }
  }
  const components = new Map();
  prepared.forEach((item, i) => {
    const root = find(i);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(item);
  });

  const groups = [];
  components.forEach((members) => {
    if (members.length < 2) return;
    const allExact = members.every((a, i) => members.slice(i + 1).every((b) => comparePrepared(a, b) === 'exact'));
    const confidence = allExact ? 'exact' : 'likely';
    const ranked = [...members].sort(rankForKeeping);
    const keep = ranked[0];
    const rest = members.filter((m) => m !== keep).sort((a, b) =>
      String(a.recipe.title ?? '').localeCompare(String(b.recipe.title ?? '')) || byId(a, b));
    groups.push({
      key: groupKey(members.map((m) => m.recipe.id)),
      confidence,
      reason: `${matchReason(members, confidence)} Suggest keeping "${keep.recipe.title}" because ${keepReason(ranked)}.`,
      recipes: [keep, ...rest].map((m) => m.recipe),
      suggestedKeepId: keep.recipe.id,
      sortTitle: keep.titleKey,
    });
  });

  return groups
    .sort((a, b) => a.sortTitle.localeCompare(b.sortTitle) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ sortTitle, ...group }) => group);
}

export default findDuplicateRecipes;
