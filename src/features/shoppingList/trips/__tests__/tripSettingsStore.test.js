import {
  normalizeTripSettings,
  activeTripDays,
  setTripCount,
  setTripDay,
  loadTripSettings,
  saveTripSettings,
} from '../tripSettingsStore';

const memoryStorage = () => {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};

describe('trip settings', () => {
  test('defaults: 1 trip on Sunday; 2 -> Sun + Wed; 3 -> Sun + Tue + Thu', () => {
    const s = normalizeTripSettings(null);
    expect(s.count).toBe(1);
    expect(activeTripDays(s)).toEqual(['Sunday']);
    expect(activeTripDays(setTripCount(s, 2))).toEqual(['Sunday', 'Wednesday']);
    expect(activeTripDays(setTripCount(s, 3))).toEqual(['Sunday', 'Tuesday', 'Thursday']);
  });

  test('bad values are cleaned up', () => {
    const s = normalizeTripSettings({ count: 7, days: { 2: ['Friday', 'Friday', 'Noday'] } });
    expect(s.count).toBe(1);
    expect(s.days[2]).toEqual(['Sunday', 'Friday']);
    expect(setTripCount(s, 'x')).toEqual(s);
  });

  test('changing a day keeps days distinct (swaps) and in week order; days are kept per count', () => {
    let s = setTripCount(null, 2);
    s = setTripDay(s, 1, 'Thursday');
    expect(activeTripDays(s)).toEqual(['Sunday', 'Thursday']);
    s = setTripDay(s, 0, 'Thursday'); // swap with trip 2
    expect(activeTripDays(s)).toEqual(['Sunday', 'Thursday']);
    s = setTripDay(s, 0, 'Saturday');
    expect(activeTripDays(s)).toEqual(['Thursday', 'Saturday']);
    s = setTripCount(setTripCount(s, 3), 2);
    expect(activeTripDays(s)).toEqual(['Thursday', 'Saturday']);
  });

  test('saved per user; unreadable or blocked storage falls back to defaults', () => {
    const storage = memoryStorage();
    expect(saveTripSettings('u1', setTripCount(null, 3), storage)).toBe(true);
    expect(loadTripSettings('u1', storage).count).toBe(3);
    expect(loadTripSettings('u2', storage).count).toBe(1);

    storage.data['savor.shoppingTrips.v1:u3'] = '{not json';
    expect(loadTripSettings('u3', storage).count).toBe(1);
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadTripSettings('u1', throwing).count).toBe(1);
    expect(saveTripSettings('u1', null, throwing)).toBe(false);
  });
});
