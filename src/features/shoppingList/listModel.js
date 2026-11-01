// src/features/shoppingList/listModel.js
//
// Pure helpers that sit between the shopping list page and the shared engines
// (quantity engine, aisle categorizer, builder, pantry matcher). No React, no Firebase.
//
//   normalizeListItem(item)            -> item with key/aisle/parts/quantityText filled in
//                                         (legacy saved items render without migration)
//   normalizeList(items)               -> normalized items with unique ids
//   effectiveStatus(item)              -> 'have' | 'partial' | 'need' (user override wins)
//   annotateList(items, pantry|null, { listId }?) -> normalized + pantry-annotated + effectiveStatus
//   prepareItemsForSave(items, pantry, { listId }?) -> Firestore-ready items (no undefined, no Dates,
//                                         compact pantryMatch, alreadyHave synced)
//   makeManualItem(text, opts?)        -> item for quick add / templates / categories modal
//   asManualSource(item)               -> manual item whose amount always adds when merged
//   parseAmountText(text)              -> parts[] from "1 1/2 cups + 50 g", "3", "to taste"
//   applyItemEdit(item, data)          -> item after the edit modal saved
//   purchaseFromItem(item)             -> { name, quantity, unit } for pantryService.addPurchasedItems
//   displayQuantity(item)              -> what the row shows ("2 cups", "need 1 cup (have some)")
//   sourceTitles(item)                 -> unique recipe titles for the "from:" line
//   groupForDisplay(viewItems)         -> { toBuy: [{ aisle, items, remaining }], have: [], counts }

import {
  combineQuantities,
  formatQuantity,
  parseIngredientLine,
  unitLabel,
  roundImperial,
} from '../../utils/quantity';
import { getAisle, getAisleById, AISLES } from '../../utils/ingredientCategories';
import { annotateWithPantry } from '../../utils/pantryMatcher';
import { ingredientKey, itemIdForKey } from '../../services/shoppingList/buildShoppingList';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Legacy list units that really mean "a count of the thing". */
const EACH_UNITS = new Set(['', 'item', 'items', 'each', 'ea', 'pc', 'pcs', 'unit', 'units', 'x']);

export function cleanUnitInput(unit) {
  if (isBlank(unit)) return '';
  const u = String(unit).trim();
  return EACH_UNITS.has(u.toLowerCase()) ? '' : u;
}

/** Firestore-safe copy of one engine part. */
function cleanPart(part) {
  const out = {
    value: finiteOrNull(part && part.value),
    unit: (part && part.unit) || '',
    category: (part && part.category) || 'unknown',
  };
  if (part && part.system) out.system = part.system;
  if (part && part.isToTaste) out.isToTaste = true;
  if (part && part.note) out.note = String(part.note);
  return out;
}

/** Parts for a plain quantity + unit (legacy items, templates). Blank quantity -> []. */
function partsFromQuantity(quantity, unit) {
  if (isBlank(quantity)) return [];
  if (typeof quantity === 'number' && !Number.isFinite(quantity)) return [];
  return combineQuantities([{ value: quantity, unit: cleanUnitInput(unit) }]).map(cleanPart);
}

/**
 * Parse what a person types into an amount box:
 *   "2 cups" | "1 1/2 cups + 50 g" | "3" | "2 bunches" | "to taste" | "a pinch" | ""
 * Returns engine parts ([] for blank).
 */
export function parseAmountText(text) {
  if (isBlank(text)) return [];
  const pieces = String(text).split('+').map((s) => s.trim()).filter(Boolean);
  const entries = pieces.map((piece) => {
    const line = parseIngredientLine(piece);
    if (line.amount.isToTaste) return { value: line.amount, unit: '' };
    if (line.amount.value === null) return { value: piece, unit: '' }; // kept as a note
    const unit = line.unit !== 'each' ? line.unit : (line.name || '').trim();
    return { value: line.amount, unit: cleanUnitInput(unit) };
  });
  return combineQuantities(entries).map(cleanPart);
}

/** Primary quantity/unit display fields from parts (mirrors the builder). */
function primaryFields(parts) {
  const primary = (parts || []).find((p) => p.value !== null) || null;
  if (!primary) return { quantity: null, unit: '' };
  const shown = primary.system === 'metric' ? primary.value : roundImperial(primary.value);
  return { quantity: primary.value, unit: primary.unit === 'each' ? '' : unitLabel(primary.unit, shown > 1) };
}

function textForParts(parts, isToTaste) {
  if (parts && parts.length) return formatQuantity(parts, { friendly: false }) || (isToTaste ? 'to taste' : '');
  return isToTaste ? 'to taste' : '';
}

function aisleFields(name, item = {}) {
  const fromItem = (item.aisle && getAisleById(item.aisle.aisleId)) || getAisleById(item.aisleId);
  if (fromItem) {
    return {
      aisle: { aisleId: fromItem.id, aisleName: fromItem.name, order: fromItem.order },
      aisleId: fromItem.id,
      category: fromItem.name,
      subcategory: typeof item.subcategory === 'string' ? item.subcategory : '',
    };
  }
  const guessed = getAisle(name);
  // The old categorizer's labels are unreliable, so they only help when the name is unknown.
  const legacy = guessed.aisleId === 'household' && guessed.matched === null ? getAisleById(item.category) : null;
  const a = legacy
    ? { aisleId: legacy.id, aisleName: legacy.name, order: legacy.order, subcategory: '' }
    : guessed;
  return {
    aisle: { aisleId: a.aisleId, aisleName: a.aisleName, order: a.order },
    aisleId: a.aisleId,
    category: a.aisleName,
    subcategory: a.subcategory || '',
  };
}

let manualCounter = 0;
const newManualId = () => {
  manualCounter += 1;
  return `manual-${Date.now().toString(36)}-${manualCounter}-${Math.random().toString(36).slice(2, 7)}`;
};

/**
 * Fill in everything the page needs on an item, whatever its age:
 * builder items pass through; legacy saved items (quantity/unit/category only) get a key,
 * aisle, parts and quantityText computed on the fly.
 */
export function normalizeListItem(item) {
  if (!isPlainObject(item)) return null;
  const rawName = item.name || item.ingredientId || item.item || item.ingredientName || '';
  const name = String(rawName).trim() || 'Item';
  const key = item.key || ingredientKey(name) || name.toLowerCase();

  let parts;
  if (Array.isArray(item.parts) && item.parts.length) {
    parts = item.parts.map(cleanPart);
  } else {
    const legacyQty = item.quantity !== undefined && item.quantity !== null ? item.quantity
      : item.adjustedAmount !== undefined ? item.adjustedAmount : item.amount;
    parts = item.isToTaste ? [{ value: null, unit: '', category: 'unknown', isToTaste: true }]
      : partsFromQuantity(legacyQty, item.unit);
  }
  const isToTaste = parts.length > 0 && parts.every((p) => p.value === null && p.isToTaste);
  const quantityText = typeof item.quantityText === 'string' && item.quantityText
    ? item.quantityText
    : textForParts(parts, isToTaste || !!item.isToTaste);

  let pantryOverride = null;
  if (item.pantryOverride === 'have' || item.pantryOverride === 'need') pantryOverride = item.pantryOverride;
  else if (item.pantryOverride === undefined && item.alreadyHave === true) pantryOverride = 'have'; // legacy flag

  const primary = primaryFields(parts);
  return {
    ...item,
    id: isBlank(item.id) ? itemIdForKey(key) : String(item.id),
    key,
    name,
    quantity: finiteOrNull(item.quantity) !== null ? item.quantity : primary.quantity,
    unit: typeof item.unit === 'string' ? item.unit : primary.unit,
    quantityText,
    parts,
    isToTaste: isToTaste || item.isToTaste === true,
    servingsUnknown: item.servingsUnknown === true,
    ...aisleFields(name, item),
    sources: Array.isArray(item.sources) ? item.sources.filter(isPlainObject) : [],
    extraParts: Array.isArray(item.extraParts) ? item.extraParts.map(cleanPart) : [],
    completed: item.completed === true,
    alreadyHave: item.alreadyHave === true,
    pantryOverride,
    addedToPantry: item.addedToPantry === true,
    notes: typeof item.notes === 'string' ? item.notes : '',
    estimatedCost: finiteOrNull(Number(item.estimatedCost)) || 0,
  };
}

/** Normalize a whole list and guarantee unique ids (React keys, per-item updates). */
export function normalizeList(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeListItem)
    .filter(Boolean)
    .map((item, i) => {
      let id = item.id;
      if (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      return id === item.id ? item : { ...item, id };
    });
}

/** The status the UI should use: the user's explicit choice beats the pantry match. */
export function effectiveStatus(item) {
  if (!item) return 'need';
  if (item.pantryOverride === 'need') return 'need';
  if (item.pantryOverride === 'have') return 'have';
  return item.pantryStatus === 'have' || item.pantryStatus === 'partial' ? item.pantryStatus : 'need';
}

/**
 * Normalize + annotate with the pantry. When the pantry has not loaded (null), the
 * pantry fields saved on the items are kept as they are.
 */
export function annotateList(items, pantry, opts = {}) {
  const normalized = normalizeList(items);
  const annotated = Array.isArray(pantry) ? annotateWithPantry(normalized, pantry, opts) : normalized;
  return annotated.map((item) => ({ ...item, effectiveStatus: effectiveStatus(item) }));
}

function compactPantryMatch(m) {
  if (!isPlainObject(m)) return null;
  return {
    id: m.id ? String(m.id) : null,
    name: m.name ? String(m.name) : '',
    quantity: finiteOrNull(m.quantity),
    unit: m.unit ? String(m.unit) : null,
    isStaple: m.isStaple === true,
  };
}

/** Recursively drop undefined, turn NaN/Infinity into null, Dates into ISO strings. */
export function sanitizeForFirestore(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirestore).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    // Firestore sentinels / Timestamps have methods; pass them through untouched.
    if (typeof value.toDate === 'function' || typeof value.isEqual === 'function') return value;
    const out = {};
    Object.keys(value).forEach((k) => {
      const v = sanitizeForFirestore(value[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  if (typeof value === 'function') return undefined;
  return value;
}

/** Items exactly as they should be written to Firestore. */
export function prepareItemsForSave(items, pantry, opts = {}) {
  return annotateList(items, pantry, opts).map(({ effectiveStatus: status, ...item }) => sanitizeForFirestore({
    ...item,
    pantryStatus: item.pantryStatus === 'have' || item.pantryStatus === 'partial' ? item.pantryStatus : 'need',
    pantryMatch: compactPantryMatch(item.pantryMatch),
    remainingQuantity: Array.isArray(item.remainingQuantity) ? item.remainingQuantity.map(cleanPart) : null,
    remainingQuantityText: item.remainingQuantityText || null,
    needsCheck: item.needsCheck === true,
    alreadyHave: status === 'have',
  }));
}

function capitalize(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/**
 * A manually added item (quick add, templates, categories modal).
 * text may carry an amount ("2 lb chicken"); opts.quantity/opts.unit win when given.
 */
export function makeManualItem(text, opts = {}) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let name = raw;
  let parts = [];
  if (!isBlank(opts.quantity)) {
    parts = partsFromQuantity(opts.quantity, opts.unit);
  } else {
    const line = parseIngredientLine(raw);
    if (line.amount.value !== null && line.name) {
      name = line.name;
      parts = combineQuantities([{ value: line.amount, unit: line.unit === 'each' ? '' : line.unit }]).map(cleanPart);
    }
  }
  name = capitalize(name);
  const key = ingredientKey(name) || name.toLowerCase();
  const primary = primaryFields(parts);
  return normalizeListItem({
    id: newManualId(),
    key,
    name,
    quantity: primary.quantity,
    unit: primary.unit,
    quantityText: textForParts(parts, false),
    parts,
    isToTaste: false,
    servingsUnknown: false,
    sources: [],
    extraParts: [],
    manual: true,
    completed: false,
    alreadyHave: false,
    pantryOverride: null,
    notes: '',
    estimatedCost: 0,
  });
}

/**
 * Wrap a manual item's amount as its own one-off source so mergeShoppingItems always
 * ADDS it to an existing line ("1 cup flour" twice -> 2 cups) instead of treating an
 * identical amount as a re-save. Items without an amount are returned unchanged.
 */
export function asManualSource(item) {
  if (!item || !Array.isArray(item.parts) || item.parts.length === 0) return item;
  return {
    ...item,
    sources: [{
      recipeId: null,
      recipeTitle: '',
      day: '',
      meal: '',
      servings: null,
      originalText: `manual ${item.id}`,
      parts: item.parts,
      servingsUnknown: false,
    }],
  };
}

/** What the edit modal pre-fills into its amount box. */
export function editableAmountText(item) {
  if (!item) return '';
  if (item.isToTaste) return 'to taste';
  return item.quantityText || '';
}

/**
 * Apply the edit modal's { name, amountText, aisleId, notes } to an item.
 * A changed amount becomes a manual amount: the recipe sources stay (for the "from:" line
 * and de-duplication) but no longer drive the total.
 */
export function applyItemEdit(item, data = {}) {
  const base = normalizeListItem(item);
  if (!base) return item;
  const next = { ...base };

  if (typeof data.name === 'string' && data.name.trim() && data.name.trim() !== base.name) {
    next.name = data.name.trim();
    next.key = ingredientKey(next.name) || next.name.toLowerCase();
  }

  if (typeof data.amountText === 'string' && data.amountText.trim() !== editableAmountText(base).trim()) {
    const parts = parseAmountText(data.amountText);
    const isToTaste = parts.length > 0 && parts.every((p) => p.value === null && p.isToTaste);
    const primary = primaryFields(parts);
    next.parts = parts;
    next.isToTaste = isToTaste;
    next.quantity = primary.quantity;
    next.unit = primary.unit;
    next.quantityText = textForParts(parts, isToTaste);
    next.extraParts = [];
    next.sources = base.sources.map(({ parts: _ignored, ...rest }) => rest);
    next.remainingQuantity = null;
    next.remainingQuantityText = null;
  }

  if (data.aisleId && data.aisleId !== base.aisleId) {
    const a = getAisleById(data.aisleId);
    if (a) {
      next.aisle = { aisleId: a.id, aisleName: a.name, order: a.order };
      next.aisleId = a.id;
      next.category = a.name;
      next.subcategory = '';
    }
  }

  if (typeof data.notes === 'string') next.notes = data.notes;
  return next;
}

/** The amount we just bought, in the shape pantryService.addPurchasedItems expects. */
export function purchaseFromItem(item) {
  const parts = item && item.pantryStatus === 'partial' && Array.isArray(item.remainingQuantity)
    ? item.remainingQuantity
    : (item && item.parts) || [];
  const primary = parts.find((p) => p && p.value !== null && p.value !== undefined) || null;
  return {
    name: (item && item.name) || '',
    quantity: primary ? primary.value : null,
    unit: primary && primary.unit && primary.unit !== 'each' ? primary.unit : null,
  };
}

/** The amount text a row shows. */
export function displayQuantity(item) {
  if (!item) return '';
  const status = item.effectiveStatus || effectiveStatus(item);
  if (status === 'partial' && item.remainingQuantityText) return `need ${item.remainingQuantityText} (have some)`;
  if (item.isToTaste) return item.quantityText && item.quantityText !== 'to taste' ? item.quantityText : 'to taste';
  return item.quantityText || '';
}

/** Unique recipe titles the item came from, in order. */
export function sourceTitles(item) {
  const out = [];
  ((item && item.sources) || []).forEach((s) => {
    const t = s && typeof s.recipeTitle === 'string' ? s.recipeTitle.trim() : '';
    if (t && !out.includes(t)) out.push(t);
  });
  return out;
}

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });

/**
 * Split annotated items into the two page sections.
 *   toBuy: aisles in store-walk order, each { aisle, items (open first, then bought; A-Z), remaining }
 *   have:  items we already have (not bought), A-Z
 *   counts: { toBuy, bought, remaining, have }
 */
export function groupForDisplay(viewItems) {
  const items = Array.isArray(viewItems) ? viewItems : [];
  const toBuyItems = items.filter((i) => i.completed || i.effectiveStatus !== 'have');
  const have = items.filter((i) => !i.completed && i.effectiveStatus === 'have').sort(byName);

  const byAisle = new Map();
  toBuyItems.forEach((i) => {
    const id = getAisleById(i.aisleId) ? i.aisleId : 'household';
    if (!byAisle.has(id)) byAisle.set(id, []);
    byAisle.get(id).push(i);
  });
  const toBuy = AISLES.filter((a) => byAisle.has(a.id)).map((aisle) => {
    const list = byAisle.get(aisle.id).slice().sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return byName(a, b);
    });
    return { aisle, items: list, remaining: list.filter((i) => !i.completed).length };
  });

  const bought = toBuyItems.filter((i) => i.completed).length;
  return {
    toBuy,
    have,
    counts: { toBuy: toBuyItems.length, bought, remaining: toBuyItems.length - bought, have: have.length },
  };
}
