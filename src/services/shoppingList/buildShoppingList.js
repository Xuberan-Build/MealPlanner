// src/services/shoppingList/buildShoppingList.js
//
// The ONE pure shopping-list builder. Every path that turns recipes into shopping items
// (meal plan generation, "add a single recipe", the service helper) goes through here so
// they all agree on serving math, unit merging, rounding, naming and aisle grouping.
//
// Public API:
//   buildShoppingList(mealPlan, options?)       -> items[]
//   buildItemsFromRecipe(recipe, servings, ctx?) -> items[]
//   mergeShoppingItems(existingItems, newItems) -> items[]
//   resolveMealSlot(slot)                       -> { recipe, servings } | null
//   ingredientKey(name)                         -> grouping key
//   itemIdForKey(key)                           -> deterministic id ('ing-<slug>')
//   sortShoppingItems(items)                    -> new array sorted by aisle, then name
//
// No Firebase, no React: safe to call from anywhere and easy to unit test.
// Every value written onto an item is Firestore-safe (no `undefined`).

import {
  parseAmount,
  parseServings,
  scaleQuantity,
  combineQuantities,
  toFriendlyUnit,
  formatQuantity,
  normalizeIngredientName,
  displayIngredientName,
  parseIngredientLine,
  liftCountUnitFromName,
  unitLabel,
  roundImperial,
  normalizeUnit,
} from '../../utils/quantity';
import { getAisle } from '../../utils/ingredientCategories';

/* ------------------------------------------------------------------ helpers */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * True synonyms that should share one shopping line. Deliberately small: only names that are
 * the same product in every recipe (bare "pepper" is NOT here, it can mean a bell pepper).
 */
const GROUPING_SYNONYMS = {
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
  'courgette': 'zucchini',
  aubergine: 'eggplant',
  capsicum: 'bell pepper',
};

/** Grouping key for an ingredient name ("Garlic cloves, minced" -> "garlic"). */
export function ingredientKey(name) {
  const key = normalizeIngredientName(name);
  return GROUPING_SYNONYMS[key] || key;
}

/** Deterministic item id for a grouping key. */
export function itemIdForKey(key) {
  const slug = String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ing-${slug || 'item'}`;
}

/** Strip a part down to Firestore-safe primitive fields. */
function cleanPart(part) {
  const out = {
    value: typeof part.value === 'number' && Number.isFinite(part.value) ? part.value : null,
    unit: part.unit || '',
    category: part.category || 'unknown',
  };
  if (part.system) out.system = part.system;
  if (part.isToTaste) out.isToTaste = true;
  if (part.note) out.note = String(part.note);
  return out;
}

function partsSignature(parts) {
  return JSON.stringify((parts || []).map((p) => [p.value, p.unit, p.category, !!p.isToTaste, p.note || '']));
}

/**
 * Identity of one recipe line in one recipe add. Two identical lines in one recipe are told
 * apart by lineIndex; separate adds of the same recipe by addId (and servings), so only a
 * true re-save of the same source is recognised as a duplicate.
 */
function sourceSignature(s) {
  return [
    s.recipeId || '', s.recipeTitle || '', s.day || '', s.meal || '', s.originalText || '',
    s.lineIndex === undefined || s.lineIndex === null ? '' : s.lineIndex,
    s.servings === undefined || s.servings === null ? '' : s.servings,
    s.addId || '',
  ].join('|');
}

/* ------------------------------------------------------------ slot handling */

/**
 * resolveMealSlot(slot) -> { recipe, servings } | null
 *   New format:    { recipe: {...snapshot}, servings }
 *   Legacy format: bare recipe object with selectedServings (or servings)
 * servings is returned raw (may be a string or undefined); the caller parses it.
 */
export function resolveMealSlot(slot) {
  if (!isPlainObject(slot)) return null;
  if (isPlainObject(slot.recipe)) {
    const servings = !isBlank(slot.servings) ? slot.servings : slot.selectedServings;
    return { recipe: slot.recipe, servings };
  }
  if (slot.title || slot.name || Array.isArray(slot.ingredients)) {
    const servings = !isBlank(slot.selectedServings) ? slot.selectedServings : slot.servings;
    return { recipe: slot, servings };
  }
  return null;
}

/* ------------------------------------------------------ ingredient handling */

const LOOKS_LIKE_AMOUNT = /^\s*(\d|[¼-¾⅐-⅞]|a\s|an\s|one\b|two\b|three\b|four\b|five\b|six\b|half\b)/i;

// "salt and pepper (to taste)" is two shopping items, not one called "Salt and Pepper".
const SALT_AND_PEPPER_RE = /^\s*((?:kosher\s+|sea\s+|table\s+)?salt)\s*(?:and|&|\+|n)\s*((?:freshly\s+)?(?:ground\s+|cracked\s+)?(?:black\s+)?pepper)\b/i;
const OIL_AND_VINEGAR_RE = /^\s*((?:extra\s+virgin\s+)?olive\s+oil|oil)\s*(?:and|&)\s*((?:balsamic\s+|red\s+wine\s+|white\s+wine\s+|apple\s+cider\s+)?vinegar)\b/i;

function splitPairName(name) {
  const sp = String(name || '').match(SALT_AND_PEPPER_RE);
  if (sp) return ['salt', 'black pepper'];
  const ov = String(name || '').match(OIL_AND_VINEGAR_RE);
  if (ov) return [ov[1].trim(), ov[2].trim()];
  return [name];
}

// "pound cake" / "cup cakes" are foods, not "1 pound of cake".
const UNIT_WORD_FOODS_RE = /^\s*(pound\s+cake|cup\s*cakes?)\b/i;

/**
 * True when an import left the unit field blank but put the measure at the start of the
 * name: "pound cut up chicken", "(6 oz) can tomato paste", "cans black beans".
 */
function nameStartsWithMeasure(name) {
  const text = String(name || '').trim();
  if (!text || UNIT_WORD_FOODS_RE.test(text)) return false;
  if (text.startsWith('(')) return true;
  const firstWord = text.toLowerCase().split(/[^a-z.]+/).filter(Boolean)[0] || '';
  const { unit, category } = normalizeUnit(firstWord);
  return (category === 'volume' || category === 'weight' || (category === 'count' && unit !== 'each'))
    && text.split(/\s+/).length > 1;
}

/** Unit to use for an ingredient with a blank unit: a count unit hidden in its name, else ''. */
function unitFromName(name, unit, entries) {
  if (!isBlank(unit) && String(unit).trim().toLowerCase() !== 'each') return unit;
  const hasNumber = entries.some((e) => {
    const v = parseAmount(e.amount).value;
    return v !== null;
  });
  if (!hasNumber) return isBlank(unit) ? '' : String(unit);
  return liftCountUnitFromName(name) || (isBlank(unit) ? '' : String(unit));
}

/**
 * Turn one recipe ingredient (object or free-text string) into a list of
 *   { name, entries: [{ amount (raw|parsed), unit }], originalText }
 * (usually one; "salt and pepper" gives two). Empty list when there is no name.
 */
function readIngredient(ing) {
  if (ing === null || ing === undefined) return [];

  const fromLine = (text) => {
    const line = parseIngredientLine(text);
    const entries = (line.amounts || [{ amount: line.amount, unit: line.unit }])
      .map((a) => ({ amount: a.amount, unit: a.unit === 'each' ? '' : a.unit }));
    return { name: line.name, entries, sizeNote: line.sizeNote || '' };
  };

  let name;
  let entries;
  let originalText;
  let sizeNote = '';

  if (typeof ing === 'string') {
    const text = ing.trim();
    if (!text) return [];
    const line = fromLine(text);
    name = line.name || text;
    entries = line.entries;
    sizeNote = line.sizeNote;
    originalText = text;
  } else {
    if (!isPlainObject(ing)) return [];
    const rawName = ing.ingredientId || ing.name || ing.ingredient || ing.item || ing.title || '';
    name = typeof rawName === 'string' ? rawName.trim() : String(rawName);
    if (!name) return [];

    let amount = ing.amount !== undefined ? ing.amount : ing.quantity;
    const unit = ing.unit;

    // Imports sometimes put the whole line ("2 cups flour") into the name field.
    let parsedFromName = null;
    if (isBlank(amount) && isBlank(unit) && LOOKS_LIKE_AMOUNT.test(name)) {
      const line = fromLine(name);
      const first = parseAmount(line.entries[0] && line.entries[0].amount);
      if (line.name && (first.value !== null || first.isToTaste)) parsedFromName = line;
    } else if (!isBlank(amount) && isBlank(unit) && nameStartsWithMeasure(name)) {
      // The measure was imported into the name: read "1" + "(6 oz) can tomato paste" as one line.
      const line = fromLine(`${String(amount).trim()} ${name}`);
      if (line.name && line.entries.some((e) => !isBlank(e.unit))) parsedFromName = line;
    }

    if (parsedFromName) {
      originalText = [isBlank(amount) ? '' : String(amount).trim(), name].filter(Boolean).join(' ');
      name = parsedFromName.name;
      entries = parsedFromName.entries;
      sizeNote = parsedFromName.sizeNote;
    } else {
      originalText = [isBlank(amount) ? '' : String(amount).trim(), isBlank(unit) ? '' : String(unit).trim(), name]
        .filter(Boolean)
        .join(' ');
      if (isBlank(amount)) amount = '';
      const baseEntries = [{ amount, unit: isBlank(unit) ? '' : String(unit) }];
      entries = [{ amount, unit: unitFromName(name, unit, baseEntries) }];
    }
  }

  if (!entries.length) entries = [{ amount: '', unit: '' }];
  return splitPairName(name).map((n) => ({ name: n, entries, originalText, sizeNote }));
}

/* ---------------------------------------------------------- item assembly */

/**
 * Build a finished item from a group { key, names[], sources[] } where every source
 * carries its own scaled (unrounded) parts.
 */
function assembleItem(group, base = {}) {
  const allParts = [];
  group.sources.forEach((s) => (s.parts || []).forEach((p) => allParts.push(p)));
  (group.extraParts || []).forEach((p) => allParts.push(p));

  const combined = combineQuantities(allParts).map(toFriendlyUnit).map(cleanPart);
  const parts = combined.length
    ? combined
    : [{ value: null, unit: '', category: 'unknown', isToTaste: true }];
  const primary = parts.find((p) => p.value !== null) || null;
  const isToTaste = !primary && parts.every((p) => p.isToTaste);

  const nameSource = group.names[0] || group.key;
  const aisleInfo = getAisle(nameSource);
  const servingsUnknown = group.sources.some((s) => s.servingsUnknown === true);
  // Package sizes from the recipes ("6 oz"), so the shopper buys the right can/jar.
  const sizeNote = Array.from(new Set(group.sources.map((s) => s.sizeNote).filter(Boolean))).join(', ');

  let quantity = null;
  let unit = '';
  if (primary) {
    quantity = primary.value;
    const shown = primary.system === 'metric' ? primary.value : roundImperial(primary.value);
    unit = unitLabel(primary.unit, shown > 1);
  }

  return {
    id: itemIdForKey(group.key),
    key: group.key,
    name: displayIngredientName(nameSource) || nameSource,
    quantity,
    unit,
    quantityText: formatQuantity(parts, { friendly: false }) || (isToTaste ? 'to taste' : ''),
    parts,
    isToTaste,
    servingsUnknown,
    sizeNote,
    aisle: { aisleId: aisleInfo.aisleId, aisleName: aisleInfo.aisleName, order: aisleInfo.order },
    aisleId: aisleInfo.aisleId,
    category: aisleInfo.aisleName,
    subcategory: aisleInfo.subcategory || '',
    sources: group.sources.map((s) => ({
      recipeId: s.recipeId === undefined ? null : s.recipeId,
      recipeTitle: s.recipeTitle || '',
      day: s.day || '',
      meal: s.meal || '',
      servings: s.servings === undefined ? null : s.servings,
      originalText: s.originalText || '',
      ...(typeof s.lineIndex === 'number' ? { lineIndex: s.lineIndex } : {}),
      ...(s.addId ? { addId: String(s.addId) } : {}),
      ...(s.sizeNote ? { sizeNote: String(s.sizeNote) } : {}),
      parts: (s.parts || []).map(cleanPart),
      servingsUnknown: !!s.servingsUnknown,
    })),
    extraParts: (group.extraParts || []).map((p) => cleanPart(combineQuantities([p])[0] || p)),
    completed: false,
    alreadyHave: false,
    notes: '',
    estimatedCost: 0,
    ...base,
  };
}

/** Comparator: aisle order, then display name. */
function compareItems(a, b) {
  const ao = a?.aisle?.order ?? getAisle(a?.name).order;
  const bo = b?.aisle?.order ?? getAisle(b?.name).order;
  if (ao !== bo) return ao - bo;
  return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
}

/** sortShoppingItems(items) -> new array sorted by aisle order, then name. */
export function sortShoppingItems(items) {
  return (Array.isArray(items) ? items.slice() : []).sort(compareItems);
}

/**
 * Collect sources from one recipe into the groups map.
 * ctx: { day, meal } labels for the source records.
 */
function addRecipeToGroups(groups, recipe, desiredServings, ctx = {}) {
  if (!isPlainObject(recipe) || !Array.isArray(recipe.ingredients)) return;

  const base = parseServings(recipe.servings);
  const target = parseServings(desiredServings);
  // A servings value was asked for but is not a usable number ("0", "abc"): flag it.
  const targetInvalid = !isBlank(desiredServings) && target === null;
  let multiplier = 1;
  let servingsUnknown = targetInvalid;
  if (base === null) {
    // Unknown recipe yield: make the recipe once, and tell the UI.
    servingsUnknown = true;
  } else if (target !== null) {
    multiplier = target / base;
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) multiplier = 1;

  const recipeTitle = recipe.title || recipe.name || '';
  const recipeId = recipe.id !== undefined ? recipe.id : recipe.recipeId;
  const servingsOut = target !== null ? target : base;

  recipe.ingredients.forEach((raw, lineIndex) => {
    readIngredient(raw).forEach((ing) => {
      const key = ingredientKey(ing.name);
      if (!key) return;

      const scaledEntries = ing.entries.map((e) => ({
        value: scaleQuantity(parseAmount(e.amount), multiplier),
        unit: e.unit,
      }));
      let parts = combineQuantities(scaledEntries).filter((p) => p.value !== 0);
      // "0 cups water": nothing measurable to buy, but keep the line (unquantified).
      if (parts.length === 0) parts = [{ value: null, unit: '', category: 'unknown', isToTaste: true }];

      if (!groups.has(key)) groups.set(key, { key, names: [], sources: [] });
      const group = groups.get(key);
      group.names.push(ing.name);
      const source = {
        recipeId,
        recipeTitle,
        day: ctx.day || '',
        meal: ctx.meal || '',
        servings: servingsOut,
        originalText: ing.originalText,
        lineIndex,
        parts,
        servingsUnknown,
      };
      if (ing.sizeNote) source.sizeNote = ing.sizeNote;
      if (ctx.addId) source.addId = String(ctx.addId);
      group.sources.push(source);
    });
  });
}

function finalize(groups) {
  return sortShoppingItems(Array.from(groups.values()).map((g) => assembleItem(g)));
}

/* --------------------------------------------------------------- public API */

/**
 * buildItemsFromRecipe(recipe, servings, ctx?) -> items[]
 * Same logic as buildShoppingList for a single recipe. servings may be a number or string;
 * blank means "the recipe's own yield" (multiplier 1); an unusable value ("0", "abc") also
 * uses the recipe's yield but sets servingsUnknown so the UI can warn.
 * ctx: { day, meal, addId } labels; addId makes this add distinct from earlier adds.
 */
export function buildItemsFromRecipe(recipe, servings, ctx = {}) {
  const groups = new Map();
  addRecipeToGroups(groups, recipe, servings, ctx);
  return finalize(groups);
}

/**
 * buildShoppingList(mealPlan, options?) -> items[]
 *   mealPlan: { [day]: { [meal]: slot | slot[] } }, slots in either format.
 *   options.days:  optional array of day keys to include (others skipped).
 *   options.meals: optional array of meal keys to include.
 */
export function buildShoppingList(mealPlan, options = {}) {
  if (!isPlainObject(mealPlan)) return [];
  const dayFilter = Array.isArray(options.days) ? new Set(options.days) : null;
  const mealFilter = Array.isArray(options.meals) ? new Set(options.meals) : null;
  const groups = new Map();

  Object.entries(mealPlan).forEach(([day, meals]) => {
    if (!isPlainObject(meals)) return;
    if (dayFilter && !dayFilter.has(day)) return;
    Object.entries(meals).forEach(([meal, slotOrSlots]) => {
      if (mealFilter && !mealFilter.has(meal)) return;
      const slots = Array.isArray(slotOrSlots) ? slotOrSlots : [slotOrSlots];
      slots.forEach((slot) => {
        const resolved = resolveMealSlot(slot);
        if (!resolved) return;
        addRecipeToGroups(groups, resolved.recipe, resolved.servings, { day, meal });
      });
    });
  });

  return finalize(groups);
}

/* ------------------------------------------------------------------ merging */

const USER_FIELDS = ['id', 'completed', 'alreadyHave', 'notes', 'productMatch', 'estimatedCost'];

/** Parts of an item that are not attributed to a recipe source (manual / legacy amounts). */
function unattributedParts(item) {
  const sources = Array.isArray(item.sources) ? item.sources : [];
  const hasSourceParts = sources.length > 0 && sources.every((s) => Array.isArray(s.parts));
  if (hasSourceParts) return Array.isArray(item.extraParts) ? item.extraParts.slice() : [];
  // Manual or older item: its whole current amount is the unattributed base.
  if (Array.isArray(item.parts) && item.parts.length) return item.parts.slice();
  if (item.quantity === null || item.quantity === undefined || item.quantity === '' || item.isToTaste) {
    return [{ value: null, unit: '', category: 'unknown', isToTaste: true }];
  }
  return [{ value: item.quantity, unit: item.unit || '' }];
}

/**
 * mergeShoppingItems(existingItems, newItems) -> items[]
 * Merges by normalized name key. For matching items:
 *   - sources already on the existing item (same recipe/day/meal/line/servings/addId) are NOT
 *     added again, so re-saving the same build never double-counts; each existing source
 *     cancels one identical incoming source (multiset), so duplicate lines in one recipe all
 *     count. Give each separate "add a recipe" action its own ctx.addId so it always adds;
 *   - new sources are added and quantities recomputed from all sources;
 *   - amounts not tied to a source (manual items, older lists without per-source parts)
 *     are kept in item.extraParts and added on top;
 *   - a new item with no sources (manual add) adds its amount unless it is identical to
 *     what the existing item already shows;
 *   - user-set fields (id, completed, alreadyHave, notes, productMatch, estimatedCost and any
 *     other fields the builder does not own) are preserved.
 * Items that match nothing are appended. Result is sorted by aisle, then name.
 */
export function mergeShoppingItems(existingItems, newItems) {
  const existing = Array.isArray(existingItems) ? existingItems.filter(isPlainObject) : [];
  const incoming = Array.isArray(newItems) ? newItems.filter(isPlainObject) : [];

  const result = existing.map((item) => ({ ...item }));
  const indexByKey = new Map();
  result.forEach((item, i) => {
    const key = item.key || ingredientKey(item.name || item.ingredientId || '');
    if (key && !indexByKey.has(key)) indexByKey.set(key, i);
  });

  incoming.forEach((item) => {
    const key = item.key || ingredientKey(item.name || item.ingredientId || '');
    if (!key) return;

    if (!indexByKey.has(key)) {
      indexByKey.set(key, result.length);
      result.push({ ...item, key });
      return;
    }

    const idx = indexByKey.get(key);
    const old = result[idx];
    const oldSources = Array.isArray(old.sources) ? old.sources : [];
    const newSources = Array.isArray(item.sources) ? item.sources : [];
    const legacySources = oldSources.filter((s) => !Array.isArray(s.parts));
    const partSources = oldSources.filter((s) => Array.isArray(s.parts));
    let extraParts = unattributedParts(old);

    if (newSources.length === 0) {
      // Manual add: skip if it is exactly what is already shown.
      const newParts = Array.isArray(item.parts) && item.parts.length
        ? item.parts
        : unattributedParts({ quantity: item.quantity, unit: item.unit, isToTaste: item.isToTaste });
      if (partsSignature(newParts) === partsSignature(old.parts)) return;
      extraParts = extraParts.concat(newParts);
      result[idx] = rebuild(old, key, partSources, extraParts, legacySources);
      return;
    }

    // Multiset: each source already on the item cancels exactly one identical incoming
    // source. Incoming sources never cancel each other, so two identical lines from one
    // recipe both count.
    const existingCounts = new Map();
    oldSources.forEach((s) => {
      const sig = sourceSignature(s);
      existingCounts.set(sig, (existingCounts.get(sig) || 0) + 1);
    });
    const added = [];
    newSources.forEach((s) => {
      const sig = sourceSignature(s);
      const n = existingCounts.get(sig) || 0;
      if (n > 0) existingCounts.set(sig, n - 1);
      else added.push(s);
    });
    if (added.length === 0) return; // everything already counted

    // New sources without parts (should not happen with builder output): count their item amount.
    const addedWithParts = added.filter((s) => Array.isArray(s.parts));
    if (addedWithParts.length !== added.length) {
      extraParts = extraParts.concat(Array.isArray(item.parts) ? item.parts : []);
    }
    result[idx] = rebuild(
      old,
      key,
      partSources.concat(addedWithParts),
      extraParts,
      legacySources.concat(added.filter((s) => !Array.isArray(s.parts))),
    );
  });

  return sortShoppingItems(result);
}

function rebuild(old, key, sources, extraParts, keepSources = []) {
  const fresh = assembleItem({ key, names: [old.name || key], sources, extraParts });
  const preserved = {};
  USER_FIELDS.forEach((f) => {
    if (old[f] !== undefined) preserved[f] = old[f];
  });
  const merged = { ...old, ...fresh, ...preserved };
  if (keepSources.length) merged.sources = keepSources.concat(fresh.sources);
  // Keep the aisle the existing item already had (it may be a user override).
  if (old.aisle && old.aisle.aisleId) {
    merged.aisle = old.aisle;
    merged.aisleId = old.aisle.aisleId;
    if (old.category) merged.category = old.category;
    if (old.subcategory !== undefined) merged.subcategory = old.subcategory;
  }
  return merged;
}

/** A source that came from a meal-plan slot (single-recipe adds and manual amounts have no slot). */
const isPlanSource = (s) => isPlainObject(s) && !isBlank(s.day) && !isBlank(s.meal);

/**
 * Re-sync a saved list with a freshly built meal-plan list (regenerating after the plan
 * changed). Meal-plan amounts are replaced, never added on top of the old ones; everything
 * the user did is kept:
 *   - manual items and single-recipe adds stay exactly as they are,
 *   - an item with both kinds of sources keeps its non-plan amounts plus the new plan amounts,
 *   - user state (id, ticked, pantry overrides, notes, product picks...) carries over by key,
 *   - plan items no longer in the plan are dropped, unless already ticked as bought.
 * Older items whose sources carry no parts cannot be split, so any plan source on them
 * makes the whole item plan-derived.
 */
export function replacePlanSources(existingItems, freshPlanItems) {
  const existing = Array.isArray(existingItems) ? existingItems.filter(isPlainObject) : [];
  const fresh = Array.isArray(freshPlanItems) ? freshPlanItems.filter(isPlainObject) : [];
  const keyOf = (item) => item.key || ingredientKey(item.name || item.ingredientId || '');

  const kept = [];
  const replacedByKey = new Map(); // fully plan-derived items, remembered for their user state
  existing.forEach((item) => {
    const key = keyOf(item);
    const sources = Array.isArray(item.sources) ? item.sources : [];
    if (!sources.some(isPlanSource)) {
      kept.push(item);
      return;
    }
    const splittable = sources.every((s) => Array.isArray(s.parts));
    const otherSources = splittable ? sources.filter((s) => !isPlanSource(s)) : [];
    const extraParts = splittable ? unattributedParts(item) : [];
    if (otherSources.length === 0 && extraParts.length === 0) {
      if (key && !replacedByKey.has(key)) replacedByKey.set(key, item);
      return;
    }
    kept.push(rebuild(item, key, otherSources, extraParts));
  });

  const freshKeys = new Set(fresh.map(keyOf));
  const carried = fresh.map((item) => {
    const old = replacedByKey.get(keyOf(item));
    if (!old) return item;
    const { sources: _s, parts: _p, extraParts: _e, quantity: _q, unit: _u, quantityText: _t, ...state } = old;
    return { ...state, ...item, ...pickUserFields(old), key: keyOf(item) };
  });
  const boughtButDropped = Array.from(replacedByKey.entries())
    .filter(([key, item]) => !freshKeys.has(key) && item.completed)
    .map(([, item]) => item);

  return mergeShoppingItems(kept.concat(boughtButDropped), carried);
}

function pickUserFields(item) {
  const picked = {};
  USER_FIELDS.forEach((f) => {
    if (item[f] !== undefined) picked[f] = item[f];
  });
  return picked;
}

export default buildShoppingList;
