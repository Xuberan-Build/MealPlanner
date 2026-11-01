// src/features/shoppingList/trips/tripSettingsStore.js
//
// "How many grocery runs a week, and on which days". Pure helpers + a tiny localStorage
// store. The setting is kept per user, but in this browser only (not synced to the account).
//
// Shape: { count: 1 | 2 | 3, days: { 1: [day], 2: [day, day], 3: [day, day, day] } }
//   Days are full English names. The plan's week runs Monday-Sunday, so a Sunday trip is
//   "before the week starts" (shopping for Monday). Days per count are remembered
//   separately, so switching 2 -> 3 -> 2 keeps custom days.

/** Trip days in week order: Sunday comes first (the day before the plan's Monday). */
export const TRIP_DAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
export const TRIP_COUNTS = Object.freeze([1, 2, 3]);

export const DEFAULT_TRIP_DAYS = Object.freeze({
  1: Object.freeze(['Sunday']),
  2: Object.freeze(['Sunday', 'Wednesday']),
  3: Object.freeze(['Sunday', 'Tuesday', 'Thursday']),
});

export const DEFAULT_TRIP_SETTINGS = Object.freeze({ count: 1, days: DEFAULT_TRIP_DAYS });

const STORAGE_PREFIX = 'savor.shoppingTrips.v1';

/** Position of a trip day in the week (Sunday 0 ... Saturday 6), -1 when not a day. */
export const tripDayPosition = (day) => TRIP_DAYS.indexOf(day);

const byPosition = (a, b) => tripDayPosition(a) - tripDayPosition(b);

/** A clean list of `count` distinct days in week order (defaults fill any gaps). */
function cleanDays(raw, count) {
  const picked = [];
  (Array.isArray(raw) ? raw : []).forEach((d) => {
    if (tripDayPosition(d) >= 0 && !picked.includes(d) && picked.length < count) picked.push(d);
  });
  DEFAULT_TRIP_DAYS[count].concat(TRIP_DAYS).forEach((d) => {
    if (picked.length < count && !picked.includes(d)) picked.push(d);
  });
  return picked.sort(byPosition);
}

/** Any stored value -> valid settings. */
export function normalizeTripSettings(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const count = TRIP_COUNTS.includes(Number(value.count)) ? Number(value.count) : DEFAULT_TRIP_SETTINGS.count;
  const rawDays = value.days && typeof value.days === 'object' ? value.days : {};
  const daysOut = {};
  TRIP_COUNTS.forEach((n) => { daysOut[n] = cleanDays(rawDays[n], n); });
  return { count, days: daysOut };
}

/** The trip days in use right now, in week order. */
export function activeTripDays(settings) {
  const s = normalizeTripSettings(settings);
  return s.days[s.count];
}

/** Settings with a different number of trips (its days are remembered per count). */
export function setTripCount(settings, count) {
  const s = normalizeTripSettings(settings);
  return TRIP_COUNTS.includes(Number(count)) ? { ...s, count: Number(count) } : s;
}

/**
 * Settings with trip `index` (0-based, in the current order) moved to `day`. Picking a day
 * another trip already uses swaps the two, so days always stay distinct.
 */
export function setTripDay(settings, index, day) {
  const s = normalizeTripSettings(settings);
  const current = s.days[s.count].slice();
  if (index < 0 || index >= current.length || tripDayPosition(day) < 0) return s;
  const other = current.indexOf(day);
  if (other >= 0) current[other] = current[index];
  current[index] = day;
  return { ...s, days: { ...s.days, [s.count]: current.sort(byPosition) } };
}

const storageKey = (userId) => `${STORAGE_PREFIX}:${userId || 'guest'}`;

const defaultStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (e) {
    return null; // access itself can throw (blocked storage)
  }
};

/** Saved settings for this user on this device (defaults when none / unreadable). */
export function loadTripSettings(userId, storage = defaultStorage()) {
  try {
    const raw = storage ? storage.getItem(storageKey(userId)) : null;
    return normalizeTripSettings(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return normalizeTripSettings(null);
  }
}

/** Remember settings for this user on this device. Returns false when storage is unavailable. */
export function saveTripSettings(userId, settings, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(storageKey(userId), JSON.stringify(normalizeTripSettings(settings)));
    return true;
  } catch (e) {
    return false; // private mode / quota: the page still works for this visit
  }
}
