// src/services/pantryService.js
// Pantry ("what we have") persistence. One Firestore doc per item in `pantryItems`:
//   { userId, key, name, aisleId, quantity: number|null, unit: string|null, isStaple,
//     fromPurchase, purchasedForListId, lastPurchasedAt, updatedAt, createdAt }
// fromPurchase/purchasedForListId: the stock came from ticking items off that shopping list.
// It is assumed to be used by that list's meals, so other lists don't count it as "have"
// until the user confirms the amount here (any user edit clears the flags).
// `key` is pantryKey(name) (normalizeIngredientName + a few synonyms) and is unique per user.
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getAisle } from '../utils/ingredientCategories';
import { displayIngredientName, normalizeUnit, parseAmount, convertQuantity, toFriendlyUnit } from '../utils/quantity';
import { pantryKey } from '../utils/pantryMatcher';

export const PANTRY_COLLECTION = 'pantryItems';

/** Opt-in starter list (never added automatically). */
export const COMMON_STAPLES = Object.freeze([
  'Salt',
  'Black Pepper',
  'Olive Oil',
  'Vegetable Oil',
  'Sugar',
  'All-Purpose Flour',
  'Baking Soda',
  'Baking Powder',
  'Garlic Powder'
]);

/** Fields that mark an amount as confirmed by the user (not just bought for a list). */
const USER_CONFIRMED = Object.freeze({ fromPurchase: false, purchasedForListId: null });

const requireUser = (action) => {
  const user = auth.currentUser;
  if (!user) throw new Error(`User must be authenticated to ${action}`);
  return user;
};

const toDate = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : v || null);

const fromSnap = (snap) => {
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    lastPurchasedAt: toDate(data.lastPurchasedAt)
  };
};

/** Coerce a user-entered quantity to number|null. */
export const cleanQuantity = (quantity) => {
  if (quantity === null || quantity === undefined || quantity === '') return null;
  if (typeof quantity === 'number') return Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
  const parsed = parseAmount(quantity);
  return parsed.value !== null && parsed.value >= 0 ? parsed.value : null;
};

/** Canonical unit string or null ('each' / blank -> null). */
export const cleanUnit = (unit) => {
  if (unit === null || unit === undefined || !String(unit).trim()) return null;
  const nu = normalizeUnit(unit);
  return nu.unit === 'each' ? null : nu.unit;
};

/**
 * Add two quantities when their units are compatible.
 * Returns { quantity, unit } or null when they can't be combined.
 */
export const addQuantities = (aQty, aUnit, bQty, bUnit) => {
  if (aQty === null || aQty === undefined) return { quantity: bQty, unit: bUnit };
  if (bQty === null || bQty === undefined) return { quantity: aQty, unit: aUnit };
  const ua = normalizeUnit(aUnit || '');
  const ub = normalizeUnit(bUnit || '');
  if (ua.unit === ub.unit) return { quantity: Math.round((aQty + bQty) * 1e6) / 1e6, unit: aUnit || null };
  const converted = convertQuantity({ value: bQty, unit: ub.unit, category: ub.category }, ua.unit);
  if (converted === null) return null;
  const sum = toFriendlyUnit({ value: aQty + converted, unit: ua.unit, category: ua.category });
  return { quantity: sum.value, unit: sum.unit === 'each' ? null : sum.unit };
};

/** Get every pantry item for the current user, sorted by name. */
export const getPantry = async () => {
  try {
    const user = requireUser('read the pantry');
    const q = query(collection(db, PANTRY_COLLECTION), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((d) => items.push(fromSnap(d)));
    items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return items;
  } catch (error) {
    console.error('Error fetching pantry:', error);
    throw error;
  }
};

const findByKey = (items, key) => items.find((i) => (i.key || pantryKey(i.name)) === key) || null;

/**
 * Add or update a pantry item, de-duplicated by normalized key.
 * Existing item: provided fields overwrite (quantity/unit replaced, not added).
 * @returns {Promise<Object>} the saved item (with id)
 */
export const upsertPantryItem = async ({ name, quantity, unit, isStaple } = {}, existingItems = null) => {
  try {
    const user = requireUser('update the pantry');
    const key = pantryKey(name);
    if (!key) throw new Error('Pantry item needs a name');

    const items = existingItems || (await getPantry());
    const existing = findByKey(items, key);

    if (existing) {
      const updates = { updatedAt: serverTimestamp() };
      if (quantity !== undefined) {
        updates.quantity = cleanQuantity(quantity);
        Object.assign(updates, USER_CONFIRMED);
      }
      if (unit !== undefined) updates.unit = cleanUnit(unit);
      if (isStaple !== undefined) updates.isStaple = Boolean(isStaple);
      await updateDoc(doc(db, PANTRY_COLLECTION, existing.id), updates);
      return { ...existing, ...updates, updatedAt: new Date() };
    }

    const newDoc = {
      userId: user.uid,
      key,
      name: displayIngredientName(name) || String(name).trim(),
      aisleId: getAisle(name).aisleId,
      quantity: cleanQuantity(quantity),
      unit: cleanUnit(unit),
      isStaple: Boolean(isStaple),
      ...USER_CONFIRMED,
      lastPurchasedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, PANTRY_COLLECTION), newDoc);
    return { id: ref.id, ...newDoc, createdAt: new Date(), updatedAt: new Date() };
  } catch (error) {
    console.error('Error saving pantry item:', error);
    throw error;
  }
};

/** Update arbitrary editable fields (name is not editable; remove + add instead). */
export const updatePantryItem = async (id, { quantity, unit, isStaple, aisleId } = {}) => {
  try {
    requireUser('update the pantry');
    const updates = { updatedAt: serverTimestamp() };
    if (quantity !== undefined) {
      updates.quantity = cleanQuantity(quantity);
      Object.assign(updates, USER_CONFIRMED);
    }
    if (unit !== undefined) updates.unit = cleanUnit(unit);
    if (isStaple !== undefined) updates.isStaple = Boolean(isStaple);
    if (aisleId !== undefined) updates.aisleId = aisleId;
    await updateDoc(doc(db, PANTRY_COLLECTION, id), updates);
    return updates;
  } catch (error) {
    console.error('Error updating pantry item:', error);
    throw error;
  }
};

export const removePantryItem = async (id) => {
  try {
    requireUser('update the pantry');
    await deleteDoc(doc(db, PANTRY_COLLECTION, id));
  } catch (error) {
    console.error('Error removing pantry item:', error);
    throw error;
  }
};

export const setStaple = async (id, isStaple) => updatePantryItem(id, { isStaple: Boolean(isStaple) });

const itemName = (i) => (i && (i.name || i.ingredientName || i.item || i.ingredientId)) || '';

const sameList = (a, b) => !!a && !!b && String(a) === String(b);

/** Stock the user entered or confirmed (not just bought for some shopping list). */
const isUserStock = (p) => p && p.fromPurchase !== true;

/**
 * Next pantry state for one purchase.
 *  - nothing / ran out (0)          -> the bought amount, flagged as bought for this list
 *  - bought earlier for THIS list   -> amounts added (still flagged)
 *  - bought for ANOTHER list        -> that stock was for those meals: replaced by this buy
 *  - user stock with an amount      -> left as is (this buy is for this list's meals)
 *  - user stock "in stock" (null)   -> left as is
 */
export const nextStockAfterPurchase = (existing, qty, unit, listId) => {
  const listFlag = { fromPurchase: true, purchasedForListId: listId || null };
  if (!existing) return { quantity: qty, unit, ...listFlag };
  const q = existing.quantity;
  if (existing.isStaple) {
    return q === 0 ? { quantity: null, unit: existing.unit ?? null, ...USER_CONFIRMED } : null;
  }
  if (q === 0) return { quantity: qty, unit, ...listFlag };
  if (!isUserStock(existing)) {
    if (sameList(existing.purchasedForListId, listId) && q !== null && q !== undefined && qty !== null) {
      const sum = addQuantities(q, existing.unit, qty, unit);
      if (sum) return { ...sum, ...listFlag };
    }
    return { quantity: qty, unit, ...listFlag };
  }
  if (q === null || q === undefined) return null; // "in stock": nothing to record
  return null; // user-entered amount: this purchase is for the list's meals
};

/**
 * Record bought shopping items in the pantry and return what was changed so it can be undone.
 * shoppingItems: [{ name, quantity|amount, unit, listId? }]
 * @returns {Promise<{ saved: Array, records: Array<Object|null> }>}
 *   records[i] (aligned with shoppingItems) is passed to undoPurchase to take it back:
 *   { pantryId, created, previous: { quantity, unit, fromPurchase, purchasedForListId } | null }
 */
export const recordPurchases = async (shoppingItems = []) => {
  try {
    const user = requireUser('update the pantry');
    const pantry = await getPantry();
    const saved = [];
    const records = [];

    for (const item of shoppingItems || []) {
      const name = itemName(item);
      const key = pantryKey(name);
      if (!key) {
        records.push(null);
        continue;
      }
      const rawQty = item.quantity !== undefined ? item.quantity : item.amount;
      const qty = cleanQuantity(rawQty);
      const unit = cleanUnit(item.unit);
      const listId = item.listId || null;
      const existing = findByKey(pantry, key);

      if (existing) {
        const next = nextStockAfterPurchase(existing, qty, unit, listId);
        const updates = { lastPurchasedAt: serverTimestamp(), updatedAt: serverTimestamp() };
        if (next) Object.assign(updates, next);
        await updateDoc(doc(db, PANTRY_COLLECTION, existing.id), updates);
        const previous = {
          quantity: existing.quantity ?? null,
          unit: existing.unit ?? null,
          fromPurchase: existing.fromPurchase === true,
          purchasedForListId: existing.purchasedForListId ?? null,
        };
        const doc_ = { ...existing, ...updates, lastPurchasedAt: new Date(), updatedAt: new Date() };
        Object.assign(existing, doc_);
        saved.push(doc_);
        records.push({ pantryId: existing.id, created: false, previous });
      } else {
        const newDoc = {
          userId: user.uid,
          key,
          name: displayIngredientName(name) || String(name).trim(),
          aisleId: getAisle(name).aisleId,
          ...nextStockAfterPurchase(null, qty, unit, listId),
          isStaple: false,
          lastPurchasedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const ref = await addDoc(collection(db, PANTRY_COLLECTION), newDoc);
        const doc_ = { id: ref.id, ...newDoc, lastPurchasedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
        pantry.push(doc_);
        saved.push(doc_);
        records.push({ pantryId: ref.id, created: true, previous: null });
      }
    }
    return { saved, records };
  } catch (error) {
    console.error('Error adding purchased items to pantry:', error);
    throw error;
  }
};

/** Back-compat wrapper: record purchases, return the saved pantry docs. */
export const addPurchasedItems = async (shoppingItems = []) => (await recordPurchases(shoppingItems)).saved;

/**
 * Take back a purchase recorded by recordPurchases (the item was unticked).
 * Created docs are deleted; updated docs get their previous amount and flags back.
 * @returns {Promise<{ removedId: string } | { saved: Object } | null>}
 */
export const undoPurchase = async (record) => {
  if (!record || !record.pantryId) return null;
  try {
    requireUser('update the pantry');
    if (record.created) {
      await deleteDoc(doc(db, PANTRY_COLLECTION, record.pantryId));
      return { removedId: record.pantryId };
    }
    const prev = record.previous || {};
    const updates = {
      quantity: prev.quantity ?? null,
      unit: prev.unit ?? null,
      fromPurchase: prev.fromPurchase === true,
      purchasedForListId: prev.purchasedForListId ?? null,
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db, PANTRY_COLLECTION, record.pantryId), updates);
    return { saved: { id: record.pantryId, ...updates, updatedAt: new Date() } };
  } catch (error) {
    console.error('Error undoing pantry purchase:', error);
    throw error;
  }
};

/**
 * Opt-in: add the COMMON_STAPLES list as staples. Existing items are marked as staples.
 * Must only be called from an explicit user action.
 */
export const seedCommonStaples = async (names = COMMON_STAPLES) => {
  const pantry = await getPantry();
  const results = [];
  for (const name of names) {
    const saved = await upsertPantryItem({ name, isStaple: true }, pantry);
    if (!pantry.some((p) => p.id === saved.id)) pantry.push(saved);
    results.push(saved);
  }
  return results;
};

/**
 * "We have this" from a shopping list row. The list item's pantryOverride already records
 * the choice for this list; the pantry is only changed when it would otherwise say "need":
 *   - no match            -> a new, unquantified pantry item ("in stock")
 *   - ran out (0)         -> back in stock (quantity null)
 *   - bought for a list   -> confirmed as the user's own stock (amount kept)
 *   - anything else       -> left untouched (a known amount is never wiped)
 * @param {Object} item shopping item ({ name, ... })
 * @param {Object|null} pantryMatch item.pantryMatch from annotateWithPantry, if any
 * @returns {Promise<Object>} the (possibly unchanged) pantry item
 */
export const markHave = async (item, pantryMatch = null) => {
  if (pantryMatch && pantryMatch.id) {
    if (pantryMatch.quantity === 0) {
      await updatePantryItem(pantryMatch.id, { quantity: null });
      return { ...pantryMatch, quantity: null, ...USER_CONFIRMED, updatedAt: new Date() };
    }
    if (pantryMatch.fromPurchase === true) {
      requireUser('update the pantry');
      await updateDoc(doc(db, PANTRY_COLLECTION, pantryMatch.id), { ...USER_CONFIRMED, updatedAt: serverTimestamp() });
      return { ...pantryMatch, ...USER_CONFIRMED, updatedAt: new Date() };
    }
    return pantryMatch;
  }
  return upsertPantryItem({ name: itemName(item) || String(item || '') });
};

/**
 * "We need this" from a shopping list row. Never deletes a pantry item.
 *   - staple, unquantified "in stock", or stock bought for a list -> marked run out (0)
 *   - a user-entered amount -> left untouched (the list's pantryOverride covers this list)
 * @returns {Promise<Object|null>} the (possibly unchanged) pantry item, null when no match
 */
export const markNeed = async (pantryMatch) => {
  if (!pantryMatch || !pantryMatch.id) return null;
  const q = pantryMatch.quantity;
  const unquantified = q === null || q === undefined;
  if (pantryMatch.isStaple || unquantified || pantryMatch.fromPurchase === true) {
    if (q === 0) return pantryMatch;
    await updatePantryItem(pantryMatch.id, { quantity: 0 });
    return { ...pantryMatch, quantity: 0, ...USER_CONFIRMED, updatedAt: new Date() };
  }
  return pantryMatch;
};
