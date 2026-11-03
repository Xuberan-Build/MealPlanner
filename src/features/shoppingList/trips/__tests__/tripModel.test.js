import {
  needDayIndex,
  buildTrips,
  tripLabel,
  tripCoverText,
  chooseTrip,
  tripNoteText,
  splitItemIntoLines,
  splitIntoTripLines,
  buildTripView,
  isLineBought,
  toggleTick,
  reopenItem,
  attachPurchaseRecords,
} from '../tripModel';
import { normalizeList, annotateList, groupForDisplay, prepareItemsForSave, purchaseFromItem } from '../../listModel';
import buildShoppingList from '../../../../services/shoppingList/buildShoppingList';
import { toStoreQuantity } from '../../../../utils/storeUnits';

const recipe = (id, title, ingredients) => ({ id, title, servings: '2', ingredients });
const slot = (r) => ({ recipe: r, servings: 2 });

// Mon: salmon + avocado + rice; Fri: salmon + avocado + rice; Wed: onion
const PLAN = {
  monday: {
    dinner: slot(recipe('r1', 'Salmon Bowl', [
      { ingredientId: 'salmon', amount: '1', unit: 'lb' },
      { ingredientId: 'avocado', amount: '1', unit: '' },
      { ingredientId: 'rice', amount: '1', unit: 'cup' },
    ])),
  },
  wednesday: {
    dinner: slot(recipe('r2', 'Soup', [{ ingredientId: 'onion', amount: '1', unit: '' }])),
  },
  friday: {
    dinner: slot(recipe('r3', 'Salmon Tacos', [
      { ingredientId: 'salmon', amount: '1/2', unit: 'lb' },
      { ingredientId: 'avocado', amount: '2', unit: '' },
      { ingredientId: 'rice', amount: '1', unit: 'cup' },
    ])),
  },
};

const items = () => normalizeList(buildShoppingList(PLAN));
const byKey = (list, key) => list.filter((l) => l.key === key);
const TWO = buildTrips(['Sunday', 'Wednesday']);
const THREE = buildTrips(['Sunday', 'Tuesday', 'Thursday']);

describe('days and trips', () => {
  test('need days accept plan keys, names and abbreviations', () => {
    expect(needDayIndex('monday')).toBe(1);
    expect(needDayIndex('Friday')).toBe(5);
    expect(needDayIndex('SUN')).toBe(7);
    expect(needDayIndex('')).toBeNull();
    expect(needDayIndex('someday')).toBeNull();
  });

  test('trips are in week order with Sunday before Monday, each covering until the next trip', () => {
    const trips = buildTrips(['Wednesday', 'Sunday', 'Wednesday', 'Funday']);
    expect(trips.map((t) => [t.key, t.position, t.from, t.to])).toEqual([
      ['Sunday', 0, 1, 2],
      ['Wednesday', 3, 3, 7],
    ]);
    expect(tripLabel(trips[0])).toBe('Trip 1 · Sunday');
    expect(tripCoverText(trips[0])).toBe('for Mon–Tue meals');
    expect(tripCoverText(trips[1])).toBe('for Wed–Sun meals');
    expect(tripCoverText(buildTrips(['Sunday', 'Tuesday', 'Wednesday'])[1])).toBe('for Tue meals');
    // A Sunday trip followed by a Monday trip covers no meal day of its own.
    expect(tripCoverText(buildTrips(['Sunday', 'Monday'])[0])).toBe('');
  });
});

describe('chooseTrip (assignment rules)', () => {
  const keeps = { shelfLifeDays: null, ripenDays: null };
  const fish = { shelfLifeDays: 2, ripenDays: null };
  const avocado = { shelfLifeDays: 2, ripenDays: 3 };

  test('things that keep go on the first trip', () => {
    expect(chooseTrip(6, keeps, TWO)).toEqual({ index: 0, note: null });
  });

  test('perishables go on the latest trip on or before the day', () => {
    expect(chooseTrip(1, fish, TWO)).toEqual({ index: 0, note: null });
    expect(chooseTrip(3, fish, TWO)).toEqual({ index: 1, note: null }); // same day as the trip
    expect(chooseTrip(5, fish, TWO)).toEqual({ index: 1, note: null });
  });

  test('perishables still go on the closest trip when it is too far ahead, flagged use soon', () => {
    expect(chooseTrip(6, fish, TWO)).toEqual({ index: 1, note: { kind: 'useSoon', day: 6 } });
  });

  test('ripening fruit is bought on the latest trip that leaves time to ripen', () => {
    expect(chooseTrip(5, avocado, TWO)).toEqual({ index: 0, note: { kind: 'firm', day: 5 } }); // Sun -> Fri: 5 days
    expect(chooseTrip(7, avocado, TWO)).toEqual({ index: 1, note: { kind: 'firm', day: 7 } }); // Wed -> Sun: 4 days
  });

  test('ripening fruit with no trip far enough ahead is bought ripe on the trip before', () => {
    expect(chooseTrip(1, avocado, TWO)).toEqual({ index: 0, note: { kind: 'ripe', day: 1 } });
    expect(chooseTrip(4, avocado, THREE)).toEqual({ index: 0, note: { kind: 'firm', day: 4 } });
    expect(chooseTrip(5, avocado, THREE)).toEqual({ index: 1, note: { kind: 'firm', day: 5 } }); // Tue -> Fri
  });

  test('no day -> first trip; needed before every trip -> first trip, flagged', () => {
    expect(chooseTrip(null, fish, TWO)).toEqual({ index: 0, note: null });
    const late = buildTrips(['Tuesday', 'Thursday']);
    expect(chooseTrip(1, fish, late)).toEqual({ index: 0, note: { kind: 'early', day: 1 } });
  });

  test('note text', () => {
    expect(tripNoteText([{ kind: 'firm', day: 5 }])).toBe('buy firm, ripens by Fri');
    expect(tripNoteText([{ kind: 'ripe', day: 1 }])).toBe('buy ripe');
    expect(tripNoteText([{ kind: 'ripe', day: 1 }, { kind: 'firm', day: 5 }])).toBe('buy ripe for Mon · buy firm, ripens by Fri');
    expect(tripNoteText([{ kind: 'useSoon', day: 6 }])).toBe('use soon (for Sat)');
    expect(tripNoteText([])).toBe('');
  });
});

describe('splitting items into trip lines', () => {
  test('one trip: the items themselves, untouched (the list looks exactly as before)', () => {
    const list = items();
    expect(splitIntoTripLines(list, buildTrips(['Sunday']))).toBe(list);
    expect(splitIntoTripLines(list, [])).toBe(list);
  });

  test('non-perishables are one line on the first trip with their full amount', () => {
    const lines = splitIntoTripLines(items(), TWO);
    const rice = byKey(lines, 'rice');
    expect(rice).toHaveLength(1);
    expect(rice[0]).toMatchObject({ tripKey: 'Sunday', quantityText: '2 cups', tripNote: '' });
    expect(byKey(lines, 'onion')[0].tripKey).toBe('Sunday'); // used Wednesday, keeps all week
  });

  test('fish used Monday and Friday is split across trips with only that trip\'s amount', () => {
    const lines = byKey(splitIntoTripLines(items(), TWO), 'salmon');
    expect(lines.map((l) => [l.tripKey, l.quantityText])).toEqual([
      ['Sunday', '1 lb'],
      ['Wednesday', '8 oz'],
    ]);
    expect(lines[0].sources.map((s) => s.recipeTitle)).toEqual(['Salmon Bowl']);
    expect(lines[1].sources.map((s) => s.recipeTitle)).toEqual(['Salmon Tacos']);
    expect(lines[0].id).toBe(`${lines[0].itemId}@Sunday`);
    expect(lines[0].itemTripKeys).toEqual(['Sunday', 'Wednesday']);
    // Store quantities work per line.
    expect(toStoreQuantity(lines[1]).text).toBe('8 oz');
  });

  test('avocados for Friday are bought firm on the first trip, together with Monday\'s ripe ones', () => {
    const [line] = byKey(splitIntoTripLines(items(), TWO), 'avocado');
    expect(line.tripKey).toBe('Sunday');
    expect(line.quantityText).toBe('3'); // 1 + 2 combined
    expect(line.tripNote).toBe('buy ripe for Mon · buy firm, ripens by Fri');
    expect(line.needDays).toEqual([1, 5]);
  });

  test('avocados with no early enough trip get "buy ripe"', () => {
    const plan = { friday: { dinner: slot(recipe('r9', 'Toast', [{ ingredientId: 'avocado', amount: '1', unit: '' }])) } };
    const [line] = splitIntoTripLines(normalizeList(buildShoppingList(plan)), buildTrips(['Thursday', 'Friday']));
    expect(line).toMatchObject({ tripKey: 'Friday', tripNote: 'buy ripe' });
  });

  test('parts for the same trip are combined (Tue + Wed chicken on the Tuesday trip)', () => {
    const plan = {
      tuesday: { dinner: slot(recipe('a', 'A', [{ ingredientId: 'chicken breast', amount: '1', unit: 'lb' }])) },
      wednesday: { dinner: slot(recipe('b', 'B', [{ ingredientId: 'chicken breast', amount: '8', unit: 'oz' }])) },
    };
    const lines = splitIntoTripLines(normalizeList(buildShoppingList(plan)), THREE);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ tripKey: 'Tuesday', quantityText: '1 1/2 lb' });
  });

  test('items without a day (manual, single-recipe adds) and extra amounts go on the first trip', () => {
    const manual = normalizeList([{ id: 'm', name: 'Strawberries', quantity: 1, unit: 'lb', sources: [] }])[0];
    expect(splitItemIntoLines(manual, TWO).map((l) => l.tripKey)).toEqual(['Sunday']);

    const fishWithExtra = { ...byKey(items(), 'salmon')[0] };
    fishWithExtra.extraParts = [{ value: 4, unit: 'oz', category: 'weight' }];
    const lines = splitItemIntoLines(fishWithExtra, TWO);
    expect(lines.map((l) => [l.tripKey, l.quantityText])).toEqual([['Sunday', '1 1/4 lb'], ['Wednesday', '8 oz']]);
  });

  test('edited items (sources without amounts) stay whole, bought by their earliest day', () => {
    const salmon = byKey(items(), 'salmon')[0];
    const edited = { ...salmon, sources: salmon.sources.map(({ parts, ...rest }) => rest), parts: [{ value: 2, unit: 'lb', category: 'weight' }], quantityText: '2 lb' };
    const lines = splitItemIntoLines(edited, TWO);
    expect(lines.map((l) => [l.tripKey, l.quantityText])).toEqual([['Sunday', '2 lb']]);
  });
});

describe('buildTripView', () => {
  test('one section per trip, each by aisle with its own counts; Already have at the bottom', () => {
    const pantry = [{ id: 'p1', name: 'Rice', quantity: null }];
    const view = buildTripView(items(), pantry, TWO, { listId: 'L1' });
    expect(view.trips.map((t) => [t.label, t.cover])).toEqual([
      ['Trip 1 · Sunday', 'for Mon–Tue meals'],
      ['Trip 2 · Wednesday', 'for Wed–Sun meals'],
    ]);
    expect(view.trips[0].toBuy.map((g) => g.aisle.name)).toEqual(['Produce', 'Meat & Seafood']);
    expect(view.trips[0].counts).toEqual({ toBuy: 3, bought: 0, remaining: 3 }); // avocado, onion, salmon
    expect(view.trips[1].counts).toEqual({ toBuy: 1, bought: 0, remaining: 1 }); // salmon
    expect(view.have.map((i) => i.name)).toEqual(['Rice']);
    expect(view.counts).toEqual({ toBuy: 4, bought: 0, remaining: 4, have: 1 });
  });

  test('an item the pantry covers is not on any trip, and is one "Already have" row', () => {
    const view = buildTripView(items(), [{ id: 'p', name: 'Salmon', quantity: null }], TWO);
    const onTrips = view.trips.flatMap((t) => t.toBuy.flatMap((g) => g.items)).map((l) => l.key);
    expect(onTrips).not.toContain('salmon');
    const salmon = view.have.filter((i) => i.key === 'salmon');
    expect(salmon).toHaveLength(1);
    expect(salmon[0].quantityText).toBe('1 1/2 lb');
  });

  test('pantry stock covers the earliest trip first; a "have" override covers every line', () => {
    const view = buildTripView(items(), [{ id: 'p', name: 'Salmon', quantity: 1, unit: 'lb' }], TWO);
    const lines = view.lines.filter((l) => l.key === 'salmon');
    expect(lines.map((l) => l.effectiveStatus)).toEqual(['have', 'need']);

    const overridden = items().map((i) => (i.key === 'salmon' ? { ...i, pantryOverride: 'have' } : i));
    const v2 = buildTripView(overridden, [], TWO);
    expect(v2.lines.filter((l) => l.key === 'salmon').every((l) => l.effectiveStatus === 'have')).toBe(true);
  });

  test('a bought line claims its own recorded purchase, so the other trip still needs it', () => {
    const list = items().map((i) => (i.key === 'salmon' ? { ...i, boughtTrips: { Wednesday: true } } : i));
    // Wednesday's 8 oz was recorded in the pantry for this list when it was ticked.
    const pantry = [{ id: 'p', name: 'Salmon', quantity: 8, unit: 'oz', fromPurchase: true, purchasedForListId: 'L1' }];
    const lines = buildTripView(list, pantry, TWO, { listId: 'L1' }).lines.filter((l) => l.key === 'salmon');
    expect(lines.map((l) => [l.tripKey, l.completed, l.effectiveStatus])).toEqual([
      ['Sunday', false, 'need'],
      ['Wednesday', true, 'have'],
    ]);
  });

  test('a partly covered line buys (and records) only what is missing on that trip', () => {
    const view = buildTripView(items(), [{ id: 'p', name: 'Salmon', quantity: 12, unit: 'oz' }], TWO);
    const sunday = view.lines.find((l) => l.key === 'salmon' && l.tripKey === 'Sunday');
    expect(sunday.effectiveStatus).toBe('partial');
    expect(purchaseFromItem(sunday)).toEqual({ name: 'Salmon', quantity: 0.25, unit: 'lb' }) // 1 lb needed, 12 oz in the pantry;
  });
});

describe('per-trip ticks', () => {
  const salmon = () => byKey(items(), 'salmon')[0];
  const KEYS = ['Sunday', 'Wednesday'];

  test('ticking one trip\'s line does not tick the other, and records that line', () => {
    const { item, undo, purchases } = toggleTick(salmon(), { tripKey: 'Wednesday', bought: true, tripKeys: KEYS });
    expect(item.boughtTrips).toEqual({ Wednesday: true });
    expect(item.completed).toBe(false);
    expect(isLineBought(item, 'Wednesday')).toBe(true);
    expect(isLineBought(item, 'Sunday')).toBe(false);
    expect(undo).toEqual([]);
    expect(purchases).toEqual(['Wednesday']);
    const lines = splitItemIntoLines(item, TWO);
    expect(lines.map((l) => l.completed)).toEqual([false, true]);
  });

  test('ticking every line marks the whole item bought (so 1 trip shows it bought)', () => {
    const a = toggleTick(salmon(), { tripKey: 'Sunday', bought: true, tripKeys: KEYS }).item;
    const b = toggleTick(a, { tripKey: 'Wednesday', bought: true, tripKeys: KEYS }).item;
    expect(b.completed).toBe(true);
    expect(groupForDisplay(annotateList([b], [])).counts.bought).toBe(1);
  });

  test('unticking a line takes back only that line\'s purchase', () => {
    const rec = { pantryId: 'pp1', created: true, previous: null };
    const ticked = { ...salmon(), boughtTrips: { Sunday: true, Wednesday: true }, completed: true, pantryAddedTrips: { Sunday: rec, Wednesday: { pantryId: 'pp2' } } };
    const { item, undo, purchases } = toggleTick(ticked, { tripKey: 'Sunday', bought: false, tripKeys: KEYS });
    expect(item).toMatchObject({ completed: false, boughtTrips: { Wednesday: true }, pantryAddedTrips: { Wednesday: { pantryId: 'pp2' } } });
    expect(undo).toEqual([rec]);
    expect(purchases).toEqual([]);
  });

  test('1 -> 2 trips: an item bought as a whole shows bought on every trip; unticking one line keeps the others', () => {
    const rec = { pantryId: 'whole', created: false, previous: { quantity: 0 } };
    const whole = { ...salmon(), completed: true, addedToPantry: true, pantryAdded: rec };
    expect(splitItemIntoLines(whole, TWO).every((l) => l.completed)).toBe(true);

    const { item, undo, purchases } = toggleTick(whole, { tripKey: 'Wednesday', bought: false, tripKeys: KEYS });
    expect(item).toMatchObject({ completed: false, boughtTrips: { Sunday: true }, addedToPantry: false, pantryAdded: null });
    expect(undo).toEqual([rec]); // the whole purchase comes back out...
    expect(purchases).toEqual(['Sunday']); // ...and Sunday's share is recorded again
  });

  test('2 -> 1 trip: line ticks are kept; the whole item shows bought only when every line is', () => {
    const partly = toggleTick(salmon(), { tripKey: 'Sunday', bought: true, tripKeys: KEYS }).item;
    expect(annotateList([partly], [])[0].completed).toBe(false);
    // ...and come back when switching to 2 trips again.
    expect(splitItemIntoLines(partly, TWO).map((l) => l.completed)).toEqual([true, false]);
  });

  test('ticking the whole item (1 trip) replaces line purchases with one whole purchase', () => {
    const rec = { pantryId: 'line' };
    const partly = { ...salmon(), boughtTrips: { Sunday: true }, pantryAddedTrips: { Sunday: rec } };
    const { item, undo, purchases } = toggleTick(partly, { tripKey: null, bought: true });
    expect(item.completed).toBe(true);
    expect(item.boughtTrips).toBeUndefined();
    expect(item.pantryAddedTrips).toBeUndefined();
    expect(undo).toEqual([rec]);
    expect(purchases).toEqual([null]);
  });

  test('unticking the whole item (1 trip) clears every line and takes every purchase back', () => {
    const recs = [{ pantryId: 'w' }, { pantryId: 'l' }];
    const all = { ...salmon(), completed: true, pantryAdded: recs[0], addedToPantry: true, boughtTrips: { Sunday: true }, pantryAddedTrips: { Sunday: recs[1] } };
    const { item, undo } = toggleTick(all, { tripKey: null, bought: false });
    expect(item).toMatchObject({ completed: false, addedToPantry: false, pantryAdded: null });
    expect(item.boughtTrips).toBeUndefined();
    expect(undo).toEqual([recs[1], recs[0]]);
  });

  test('older items recorded without an undo record are never recorded twice', () => {
    const legacy = { ...salmon(), completed: true, addedToPantry: true };
    const unticked = toggleTick(legacy, { tripKey: null, bought: false });
    expect(unticked.item.pantryOverride).toBe('need');
    const again = toggleTick(unticked.item, { tripKey: 'Sunday', bought: true, tripKeys: KEYS });
    expect(again.purchases).toEqual([]);
  });

  test('adding more of an item reopens only its first-trip line', () => {
    const ticked = { ...salmon(), completed: true, boughtTrips: { Sunday: true, Wednesday: true } };
    const reopened = reopenItem(ticked, 'Sunday');
    expect(reopened.completed).toBe(false);
    expect(reopened.boughtTrips).toEqual({ Wednesday: true });
    expect(reopenItem({ ...salmon(), completed: true }, null).completed).toBe(false);
  });

  test('purchase records land on the line they were made for; untouched lines are stale', () => {
    const list = [{ ...salmon(), boughtTrips: { Wednesday: true } }, { id: 'gone' }];
    const { items: next, stale, changed } = attachPurchaseRecords(list, [
      { itemId: list[0].id, tripKey: 'Wednesday', record: { pantryId: 'a' } },
      { itemId: list[0].id, tripKey: 'Sunday', record: { pantryId: 'b' } }, // unticked meanwhile
      { itemId: 'missing', tripKey: null, record: { pantryId: 'c' } },
    ]);
    expect(changed).toBe(true);
    expect(next[0].pantryAddedTrips).toEqual({ Wednesday: { pantryId: 'a' } });
    expect(stale).toEqual([{ pantryId: 'b' }, { pantryId: 'c' }]);
  });

  test('ticks survive saving and reloading; old lists without them still load', () => {
    const ticked = { ...salmon(), boughtTrips: { Wednesday: true, Bogus: false }, pantryAddedTrips: { Wednesday: { pantryId: 'x' }, Junk: 3 } };
    const [saved] = prepareItemsForSave([ticked], []);
    expect(saved.boughtTrips).toEqual({ Wednesday: true });
    expect(saved.pantryAddedTrips).toEqual({ Wednesday: { pantryId: 'x' } });
    const [reloaded] = normalizeList([saved]);
    expect(splitItemIntoLines(reloaded, TWO).map((l) => l.completed)).toEqual([false, true]);

    const [old] = normalizeList([{ id: 'o', name: 'Milk', quantity: 1, unit: 'cup', completed: true }]);
    expect(old.boughtTrips).toBeUndefined();
    expect(splitItemIntoLines(old, TWO).every((l) => l.completed)).toBe(true);
  });
});
