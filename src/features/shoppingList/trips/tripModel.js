// src/features/shoppingList/trips/tripModel.js
//
// Splitting one week's shopping list over 1-3 grocery runs ("trips"). Pure: no React,
// no Firebase. The saved list stays one item per ingredient; trip "lines" are a view.
//
//   needDayIndex(day)                 -> 1 (Monday) ... 7 (Sunday) | null
//   buildTrips(days)                  -> trips in week order (Sunday trip = before Monday)
//   tripLabel(trip) / tripCoverText(trip)   -> "Trip 1 · Sunday" / "for Mon–Tue meals"
//   chooseTrip(needDay, freshness, trips)   -> { index, note }   (the assignment rules)
//   splitItemIntoLines(item, trips)   -> one line per trip that buys some of the item
//   splitIntoTripLines(items, trips)  -> all lines (1 trip: the items themselves)
//   buildTripView(items, pantry, trips, { listId }) -> { trips: [...], have, counts, lines }
//   toggleTick(item, { tripKey, bought, tripKeys })  -> { item, undo, purchases }
//   reopenItem(item, firstTripKey)    -> item with its first-trip line to buy again
//   attachPurchaseRecords(items, entries) -> { items, stale }
//
// Assignment rules, per need day (the day a recipe on the plan uses the item):
//   - keeps all week (onions, pantry, frozen, spices...) -> the FIRST trip
//   - perishable -> the LATEST trip on or before the need day; if even that is further
//     ahead than its shelf life, it is still bought there, flagged "use soon"
//   - ripening fruit -> the latest trip that leaves >= ripenDays before the need day, with
//     "buy firm, ripens by Fri"; when no trip leaves enough time, the latest trip on or
//     before the need day, with "buy ripe"
//   - no day (manual items, single-recipe adds, extra amounts) -> the first trip
//   - needed before the first trip -> the first trip, flagged "needed Mon"
// Amounts for the same item in the same trip are combined.
//
// Ticks (persisted on the item, see toggleTick):
//   completed        the whole item is bought (the only tick with 1 trip, as before)
//   boughtTrips      { [tripKey]: true } trip lines ticked one by one (2-3 trips)
//   pantryAdded      purchase record for a whole-item tick (pantryService.recordPurchases)
//   pantryAddedTrips { [tripKey]: record } purchase records for trip-line ticks
// A line is bought when completed || boughtTrips[tripKey]. tripKey is the trip's day.

import { combineQuantities, toFriendlyUnit } from '../../../utils/quantity';
import { annotateWithPantry } from '../../../utils/pantryMatcher';
import { effectiveStatus, groupForDisplay, normalizeList, withParts } from '../listModel';
import { freshnessFor } from './freshnessTable';
import { tripDayPosition } from './tripSettingsStore';

export const WEEK_DAYS = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** "monday" / "Mon" / "MONDAY" -> 1 ... "Sunday" -> 7; null when it is not a day. */
export function needDayIndex(day) {
  const d = String(day || '').trim().toLowerCase();
  if (d.length < 3) return null;
  const i = WEEK_DAYS.findIndex((name) => name.toLowerCase().startsWith(d) || d.startsWith(name.toLowerCase()));
  return i === -1 ? null : i + 1;
}

/** 1 -> "Mon" ... 7 -> "Sun". */
export const shortDay = (index) => SHORT_DAYS[index - 1] || '';

/**
 * Trips for these days, in week order. Each covers the need days from its own day (Monday
 * for a Sunday trip) up to the day before the next trip:
 *   { key, day, position, index, number, from, to }   (from/to: need day indexes, 1-7)
 */
export function buildTrips(days) {
  const unique = [];
  (Array.isArray(days) ? days : []).forEach((d) => {
    if (tripDayPosition(d) >= 0 && !unique.includes(d)) unique.push(d);
  });
  const sorted = unique.sort((a, b) => tripDayPosition(a) - tripDayPosition(b));
  return sorted.map((day, index) => {
    const position = tripDayPosition(day);
    const next = sorted[index + 1];
    return {
      key: day,
      day,
      position,
      index,
      number: index + 1,
      from: Math.max(position, 1),
      to: next ? tripDayPosition(next) - 1 : 7,
    };
  });
}

export const tripLabel = (trip) => (trip ? `Trip ${trip.number} · ${trip.day}` : '');

/** "for Mon–Tue meals", "for Wed meals"; '' when a later trip covers all its days. */
export function tripCoverText(trip) {
  if (!trip || trip.to < trip.from) return '';
  const range = trip.from === trip.to ? shortDay(trip.from) : `${shortDay(trip.from)}–${shortDay(trip.to)}`;
  return `for ${range} meals`;
}

/** Index of the latest trip on or before the need day, -1 when every trip is later. */
function latestOnOrBefore(needDay, trips, minGap = 0) {
  for (let i = trips.length - 1; i >= 0; i -= 1) {
    if (needDay - trips[i].position >= minGap) return i;
  }
  return -1;
}

/**
 * Which trip buys an amount needed on needDay (1-7, null = no day).
 * freshness: { shelfLifeDays (null = keeps), ripenDays (null = not buy-ahead fruit) }.
 * -> { index, note: null | { kind: 'firm' | 'ripe' | 'useSoon' | 'early', day } }
 */
export function chooseTrip(needDay, freshness, trips) {
  if (!Array.isArray(trips) || trips.length === 0) return { index: 0, note: null };
  const { shelfLifeDays = null, ripenDays = null } = freshness || {};
  if (!needDay) return { index: 0, note: null };

  const onOrBefore = latestOnOrBefore(needDay, trips);
  const isFresh = ripenDays !== null || shelfLifeDays !== null;
  if (!isFresh) return { index: 0, note: null };
  if (onOrBefore === -1) return { index: 0, note: { kind: 'early', day: needDay } };

  if (ripenDays !== null) {
    const ahead = latestOnOrBefore(needDay, trips, ripenDays);
    if (ahead !== -1) return { index: ahead, note: { kind: 'firm', day: needDay } };
    return { index: onOrBefore, note: { kind: 'ripe', day: needDay } };
  }
  const gap = needDay - trips[onOrBefore].position;
  return { index: onOrBefore, note: gap > shelfLifeDays ? { kind: 'useSoon', day: needDay } : null };
}

/** Text for a line's notes: "buy firm, ripens by Fri", "buy ripe", "use soon (for Sat)". */
export function tripNoteText(notes) {
  const list = Array.isArray(notes) ? notes.filter(Boolean) : [];
  const several = list.length > 1;
  const texts = list.map((n) => {
    const day = shortDay(n.day);
    if (n.kind === 'firm') return `buy firm, ripens by ${day}`;
    if (n.kind === 'ripe') return several ? `buy ripe for ${day}` : 'buy ripe';
    if (n.kind === 'useSoon') return `use soon (for ${day})`;
    if (n.kind === 'early') return `needed ${day}`;
    return '';
  }).filter(Boolean);
  return Array.from(new Set(texts)).join(' · ');
}

/** Same rounding/units the builder uses when it adds sources up. */
function combineParts(parts) {
  const combined = combineQuantities(parts).map(toFriendlyUnit);
  return combined.length ? combined : [{ value: null, unit: '', category: 'unknown', isToTaste: true }];
}

/**
 * What the item is needed for, by day: [{ day (1-7 | null), parts, sources }].
 * Items whose sources carry their own amounts are split per day; extra amounts (manual
 * adds) have no day. Edited / older items can't be split: the whole amount is needed by
 * the earliest day any of its recipes uses it.
 */
function needsOf(item) {
  const sources = Array.isArray(item.sources) ? item.sources.filter(isPlainObject) : [];
  const splittable = sources.length > 0 && sources.every((s) => Array.isArray(s.parts));
  if (!splittable) {
    const daysUsed = sources.map((s) => needDayIndex(s.day)).filter(Boolean);
    return [{ day: daysUsed.length ? Math.min(...daysUsed) : null, parts: item.parts || [], sources }];
  }
  const byDay = new Map();
  const add = (day, parts, source) => {
    if (!byDay.has(day)) byDay.set(day, { day, parts: [], sources: [] });
    const need = byDay.get(day);
    need.parts.push(...parts);
    if (source) need.sources.push(source);
  };
  sources.forEach((s) => add(needDayIndex(s.day), s.parts, s));
  if (Array.isArray(item.extraParts) && item.extraParts.length) add(null, item.extraParts, null);
  return Array.from(byDay.values());
}

/** Is this line of the item bought? (tripKey null = the whole item, the 1-trip case) */
export function isLineBought(item, tripKey) {
  if (!item) return false;
  if (item.completed === true) return true;
  return !!(tripKey && isPlainObject(item.boughtTrips) && item.boughtTrips[tripKey] === true);
}

/**
 * The item's lines for these trips (2+ trips). Each line is the item with only that trip's
 * amounts and sources, plus:
 *   { id: `${item.id}@${tripKey}`, itemId, tripKey, tripIndex, tripNote, needDays,
 *     itemTripKeys (every trip key this item appears in), completed (this line's tick) }
 * An item bought on a single trip keeps its own amounts exactly.
 */
export function splitItemIntoLines(item, trips) {
  if (!item || !Array.isArray(trips) || trips.length === 0) return [];
  const freshness = freshnessFor(item);
  const byTrip = new Map();
  needsOf(item).forEach((need) => {
    const { index, note } = chooseTrip(need.day, freshness, trips);
    if (!byTrip.has(index)) byTrip.set(index, { parts: [], sources: [], notes: [], days: [] });
    const group = byTrip.get(index);
    group.parts.push(...need.parts);
    group.sources.push(...need.sources);
    if (note) group.notes.push(note);
    if (need.day) group.days.push(need.day);
  });

  const indexes = Array.from(byTrip.keys()).sort((a, b) => a - b);
  const itemTripKeys = indexes.map((i) => trips[i].key);
  const single = indexes.length === 1;
  return indexes.map((index) => {
    const trip = trips[index];
    const group = byTrip.get(index);
    const base = single ? item : withParts(item, combineParts(group.parts));
    const line = {
      ...base,
      id: `${item.id}@${trip.key}`,
      itemId: item.id,
      tripKey: trip.key,
      tripIndex: index,
      tripNote: tripNoteText(group.notes.sort((a, b) => a.day - b.day)),
      needDays: Array.from(new Set(group.days)).sort((a, b) => a - b),
      itemTripKeys,
      completed: isLineBought(item, trip.key),
    };
    if (!single) {
      line.sources = group.sources;
      line.extraParts = [];
    }
    return line;
  });
}

/** All trip lines, in item order. With 0-1 trips the items are returned untouched. */
export function splitIntoTripLines(items, trips) {
  const list = Array.isArray(items) ? items : [];
  if (!Array.isArray(trips) || trips.length <= 1) return list;
  return list.flatMap((item) => splitItemIntoLines(item, trips));
}

/**
 * Pantry status per line. Bought lines claim pantry stock first (their own purchase was
 * recorded there), then open lines in trip order, so stock covers the earliest trip.
 * Without a pantry (not loaded) a split line can't reuse its item's saved "have some"
 * amount, so it shows its full amount.
 */
export function annotateTripLines(lines, pantry, opts = {}) {
  const list = Array.isArray(lines) ? lines : [];
  let annotated;
  if (Array.isArray(pantry)) {
    const order = list.map((line, i) => i).sort((a, b) => {
      const la = list[a];
      const lb = list[b];
      if (la.completed !== lb.completed) return la.completed ? -1 : 1;
      return (la.tripIndex || 0) - (lb.tripIndex || 0) || a - b;
    });
    const result = annotateWithPantry(order.map((i) => list[i]), pantry, opts);
    annotated = new Array(list.length);
    order.forEach((original, pos) => { annotated[original] = result[pos]; });
  } else {
    annotated = list.map((line) => (line.pantryStatus === 'partial' && (line.itemTripKeys || []).length > 1
      ? { ...line, pantryStatus: 'need', remainingQuantity: null, remainingQuantityText: null }
      : line));
  }
  return annotated.map((line) => ({ ...line, effectiveStatus: effectiveStatus(line) }));
}

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });

/** One "Already have" row per item, whichever trips its lines were on. */
export function mergeHaveLines(lines) {
  const byItem = new Map();
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const id = line.itemId || line.id;
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id).push(line);
  });
  return Array.from(byItem.values()).map((group) => {
    if (group.length === 1) return group[0];
    const merged = withParts(group[0], combineParts(group.flatMap((l) => l.parts || [])));
    return {
      ...merged,
      id: group[0].itemId,
      tripKey: null,
      tripNote: '',
      sources: group.flatMap((l) => l.sources || []),
      needsCheck: group.some((l) => l.needsCheck),
    };
  }).sort(byName);
}

/**
 * Everything the page shows for 2-3 trips:
 *   trips:  [{ trip, label, cover, toBuy: aisles (as groupForDisplay), counts }]
 *   have:   one row per item we already have (not bought), A-Z
 *   counts: { toBuy, bought, remaining, have } over all trips
 *   lines:  every annotated line (for looking a line up by id)
 */
export function buildTripView(items, pantry, trips, opts = {}) {
  const lines = annotateTripLines(splitIntoTripLines(normalizeList(items), trips), pantry, opts);
  const haveLines = [];
  const counts = { toBuy: 0, bought: 0, remaining: 0, have: 0 };
  const sections = (trips || []).map((trip) => {
    const grouped = groupForDisplay(lines.filter((l) => l.tripKey === trip.key));
    haveLines.push(...grouped.have);
    counts.toBuy += grouped.counts.toBuy;
    counts.bought += grouped.counts.bought;
    counts.remaining += grouped.counts.remaining;
    return {
      trip,
      label: tripLabel(trip),
      cover: tripCoverText(trip),
      toBuy: grouped.toBuy,
      counts: { toBuy: grouped.counts.toBuy, bought: grouped.counts.bought, remaining: grouped.counts.remaining },
    };
  });
  const have = mergeHaveLines(haveLines);
  counts.have = have.length;
  return { trips: sections, have, counts, lines };
}

/* ------------------------------------------------------------------ ticks */

const without = (map, key) => {
  if (!isPlainObject(map)) return {};
  const { [key]: _removed, ...rest } = map;
  return rest;
};

/** Write the tick maps back, dropping them when empty (see listModel.withTripTicks). */
function withTickMaps(item, boughtTrips, pantryAddedTrips) {
  const { boughtTrips: _b, pantryAddedTrips: _p, ...rest } = item;
  return {
    ...rest,
    ...(Object.keys(boughtTrips).length ? { boughtTrips } : {}),
    ...(Object.keys(pantryAddedTrips).length ? { pantryAddedTrips } : {}),
  };
}

const wholeRecord = (item) => (item.pantryAdded && item.pantryAdded.pantryId ? item.pantryAdded : null);
const tripRecords = (item) => (isPlainObject(item.pantryAddedTrips) ? Object.values(item.pantryAddedTrips) : []);

/**
 * Tick or untick an item (tripKey null: the whole item, as with 1 trip) or one trip line.
 * tripKeys: every trip key the item currently has lines in (for "all lines bought").
 * -> { item, undo: purchase records to take back out of the pantry,
 *      purchases: lines to record as bought now (null = the whole item, else a tripKey) }
 * Older items recorded in the pantry without an undo record are never sent twice.
 */
export function toggleTick(item, { tripKey = null, bought, tripKeys = [] } = {}) {
  const record = wholeRecord(item);
  const legacyRecorded = item.addedToPantry === true && !record;
  const ticks = isPlainObject(item.boughtTrips) ? { ...item.boughtTrips } : {};
  const records = isPlainObject(item.pantryAddedTrips) ? { ...item.pantryAddedTrips } : {};
  const undo = [];
  const purchases = [];

  if (!tripKey) {
    const next = { ...item, completed: bought };
    if (bought) {
      if (next.pantryOverride === 'need' && legacyRecorded) next.pantryOverride = null;
      if (!legacyRecorded && !record) {
        // Lines already recorded one by one are replaced by one purchase of the whole amount.
        undo.push(...tripRecords(item));
        purchases.push(null);
        return { item: withTickMaps(next, {}, {}), undo, purchases };
      }
      return { item: next, undo, purchases };
    }
    undo.push(...tripRecords(item));
    if (record) {
      undo.push(record);
      next.addedToPantry = false;
      next.pantryAdded = null;
    } else if (legacyRecorded) {
      next.pantryOverride = 'need'; // can't undo an old purchase: keep it on the list
    }
    return { item: withTickMaps(next, {}, {}), undo, purchases };
  }

  const keys = Array.isArray(tripKeys) && tripKeys.length ? tripKeys : [tripKey];
  if (bought) {
    ticks[tripKey] = true;
    const allBought = keys.every((k) => ticks[k]);
    const next = { ...item, completed: item.completed === true || allBought };
    if (allBought && next.pantryOverride === 'need' && legacyRecorded) next.pantryOverride = null;
    if (!legacyRecorded && !record && !records[tripKey]) purchases.push(tripKey);
    return { item: withTickMaps(next, ticks, records), undo, purchases };
  }

  const next = { ...item, completed: false };
  const wholeTick = item.completed === true && !keys.every((k) => ticks[k]);
  if (wholeTick) {
    // Bought as one (with 1 trip): the other lines stay bought, re-recorded line by line.
    // (A whole purchase still queued, not yet recorded, is dropped by the caller.)
    keys.filter((k) => k !== tripKey).forEach((k) => {
      ticks[k] = true;
      if (!legacyRecorded && !records[k]) purchases.push(k);
    });
    if (record) {
      undo.push(record);
      next.addedToPantry = false;
      next.pantryAdded = null;
    } else if (legacyRecorded) {
      next.pantryOverride = 'need';
    }
  } else if (legacyRecorded && keys.every((k) => ticks[k])) {
    next.pantryOverride = 'need';
  }
  if (records[tripKey]) undo.push(records[tripKey]);
  return { item: withTickMaps(next, without(ticks, tripKey), without(records, tripKey)), undo, purchases };
}

/** More of the item was added: its first-trip line (where extra amounts go) is open again. */
export function reopenItem(item, firstTripKey = null) {
  const next = { ...item, completed: false };
  if (!firstTripKey || !isPlainObject(item.boughtTrips)) return next;
  return withTickMaps(next, without(item.boughtTrips, firstTripKey), isPlainObject(item.pantryAddedTrips) ? item.pantryAddedTrips : {});
}

/**
 * Store purchase records on the items they were made for.
 * entries: [{ itemId, tripKey (null = whole item), record }]
 * -> { items, stale: records whose tick was taken back while saving (to undo) }
 */
export function attachPurchaseRecords(items, entries) {
  const stale = [];
  const byItem = new Map();
  (entries || []).forEach((e) => {
    if (!e || !e.record) return;
    if (!byItem.has(e.itemId)) byItem.set(e.itemId, []);
    byItem.get(e.itemId).push(e);
  });
  let changed = false;
  const next = (items || []).map((item) => {
    const mine = byItem.get(item.id);
    if (!mine) return item;
    let out = item;
    mine.forEach(({ tripKey, record }) => {
      if (!isLineBought(out, tripKey)) {
        stale.push(record);
        return;
      }
      changed = true;
      if (!tripKey) {
        out = { ...out, addedToPantry: true, pantryAdded: record };
      } else {
        out = { ...out, pantryAddedTrips: { ...(isPlainObject(out.pantryAddedTrips) ? out.pantryAddedTrips : {}), [tripKey]: record } };
      }
    });
    return out;
  });
  byItem.forEach((list, id) => {
    if (!(items || []).some((it) => it.id === id)) list.forEach((e) => stale.push(e.record));
  });
  return { items: changed ? next : items, stale, changed };
}
