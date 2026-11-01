// src/services/ingredientDictionaryService.js
//
// The shared ingredient dictionary: same-product aliases every user's app applies
// ("old fashioned oats" -> "rolled oats"). Anyone signed in reads it; only admins
// (a document at admins/{uid}) change it; entries are switched off, never deleted.
// Users can suggest aliases; admins approve or reject them.

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  aliasKey,
  applyIngredientDictionary,
  getActiveAliases,
  validateAlias,
} from '../utils/ingredientAliases';

export const DICTIONARY_COLLECTION = 'ingredientDictionary';
export const SUGGESTIONS_COLLECTION = 'ingredientAliasSuggestions';
export const ADMINS_COLLECTION = 'admins';
const CACHE_KEY = 'ingredientDictionaryCache';

/** Document id for an alias key ("old fashioned oat" -> "old-fashioned-oat"). */
export const entryIdFor = (key) => String(key).trim().replace(/\s+/g, '-');

const readCache = () => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.entries) ? parsed.entries : null;
  } catch {
    return null;
  }
};

const writeCache = (entries) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ entries, savedAt: Date.now() }));
  } catch {
    /* storage full or blocked: the in-memory dictionary still applies */
  }
};

const toEntry = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    alias: data.alias || '',
    canonical: data.canonical || '',
    enabled: data.enabled !== false,
    note: data.note || '',
    updatedBy: data.updatedBy || null,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
  };
};

/** Apply the last dictionary this device saw, synchronously (before anything is built). */
export function applyCachedIngredientDictionary() {
  const cached = readCache();
  if (cached) applyIngredientDictionary(cached);
  return cached || [];
}

/**
 * Fetch the shared dictionary, apply it, and cache it. On failure the cached (or built-in)
 * aliases stay in effect, so shopping lists never break because of the dictionary.
 */
export async function loadIngredientDictionary() {
  try {
    const snapshot = await getDocs(collection(db, DICTIONARY_COLLECTION));
    const entries = snapshot.docs.map(toEntry);
    applyIngredientDictionary(entries);
    writeCache(entries.map(({ alias, canonical, enabled }) => ({ alias, canonical, enabled })));
    return entries;
  } catch (error) {
    console.warn('Ingredient dictionary unavailable; using saved aliases:', error?.message || error);
    return null;
  }
}

/** True when the signed-in user has an admins/{uid} document. */
export async function isCurrentUserAdmin() {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    return (await getDoc(doc(db, ADMINS_COLLECTION, uid))).exists();
  } catch {
    return false;
  }
}

/** Admin: add or change an alias for everyone. Throws with a readable message if invalid. */
export async function saveAlias({ alias, canonical, note = '' }) {
  const problems = validateAlias(getActiveAliases(), alias, canonical);
  if (problems.length) throw new Error(problems.join(' '));
  const from = aliasKey(alias);
  await setDoc(
    doc(db, DICTIONARY_COLLECTION, entryIdFor(from)),
    {
      alias: from,
      canonical: aliasKey(canonical),
      enabled: true,
      note: String(note || '').slice(0, 200),
      updatedBy: auth.currentUser?.uid || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return loadIngredientDictionary();
}

/** Admin: switch an alias on or off for everyone (also works on built-in aliases). */
export async function setAliasEnabled(alias, enabled, canonical = '') {
  const from = aliasKey(alias);
  if (!from) throw new Error('Enter the name to change.');
  await setDoc(
    doc(db, DICTIONARY_COLLECTION, entryIdFor(from)),
    {
      alias: from,
      ...(canonical ? { canonical: aliasKey(canonical) } : {}),
      enabled: Boolean(enabled),
      updatedBy: auth.currentUser?.uid || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return loadIngredientDictionary();
}

/** Any user: suggest that two names are the same product (reviewed by an admin). */
export async function suggestAlias({ alias, canonical, context = '' }) {
  const uid = auth.currentUser?.uid;
  const from = aliasKey(alias);
  const to = aliasKey(canonical);
  if (!uid || !from || !to || from === to) return null;
  const ref = await addDoc(collection(db, SUGGESTIONS_COLLECTION), {
    alias: from,
    canonical: to,
    context: String(context || '').slice(0, 200),
    suggestedBy: uid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Admin: suggestions waiting for review. */
export async function listPendingSuggestions() {
  const snapshot = await getDocs(
    query(collection(db, SUGGESTIONS_COLLECTION), where('status', '==', 'pending'))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Admin: approve (adds the alias for everyone) or reject a suggestion. */
export async function resolveSuggestion(suggestion, approve) {
  if (approve) await saveAlias({ alias: suggestion.alias, canonical: suggestion.canonical, note: 'Suggested by a user' });
  await updateDoc(doc(db, SUGGESTIONS_COLLECTION, suggestion.id), {
    status: approve ? 'approved' : 'rejected',
    reviewedBy: auth.currentUser?.uid || null,
    reviewedAt: serverTimestamp(),
  });
}
